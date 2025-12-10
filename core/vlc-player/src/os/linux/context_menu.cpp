#include "window.h"
#include "../../vlc_player.h"
#include <X11/Xatom.h>
#include <X11/keysym.h>
#include <fstream>
#include <sstream>
#include <unistd.h>
#include <cstring>

// =================================================================================================
// GTK Theme Detection
// =================================================================================================

static std::string ExecuteCommand(const char *cmd)
{
    char buffer[128];
    std::string result;
    FILE *pipe = popen(cmd, "r");
    if (!pipe)
    {
        return result;
    }

    while (fgets(buffer, sizeof(buffer), pipe) != nullptr)
    {
        result += buffer;
    }
    pclose(pipe);

    // Trim newline
    if (!result.empty() && result[result.length() - 1] == '\n')
    {
        result.erase(result.length() - 1);
    }

    return result;
}

LinuxWindow::MenuColors LinuxWindow::GetGtkThemeColors()
{
    MenuColors colors;
    bool isDark = false;

    // Method 1: Try gsettings (GNOME, Cinnamon, MATE)
    std::string gtkTheme = ExecuteCommand("gsettings get org.gnome.desktop.interface gtk-theme 2>/dev/null");
    if (!gtkTheme.empty())
    {
        // Remove quotes
        if (gtkTheme.front() == '\'' && gtkTheme.back() == '\'')
        {
            gtkTheme = gtkTheme.substr(1, gtkTheme.length() - 2);
        }

        // Check if theme name contains "dark"
        if (gtkTheme.find("dark") != std::string::npos ||
            gtkTheme.find("Dark") != std::string::npos ||
            gtkTheme.find("DARK") != std::string::npos)
        {
            isDark = true;
        }
    }

    // Method 2: Try reading GTK3 settings.ini (fallback)
    if (!isDark)
    {
        const char *homeDir = getenv("HOME");
        if (homeDir)
        {
            std::string gtkSettingsPath = std::string(homeDir) + "/.config/gtk-3.0/settings.ini";
            std::ifstream gtkSettings(gtkSettingsPath);
            if (gtkSettings.is_open())
            {
                std::string line;
                while (std::getline(gtkSettings, line))
                {
                    if (line.find("gtk-application-prefer-dark-theme") != std::string::npos)
                    {
                        if (line.find("true") != std::string::npos || line.find("1") != std::string::npos)
                        {
                            isDark = true;
                        }
                    }
                    if (line.find("gtk-theme-name") != std::string::npos &&
                        (line.find("dark") != std::string::npos || line.find("Dark") != std::string::npos))
                    {
                        isDark = true;
                    }
                }
                gtkSettings.close();
            }
        }
    }

    // Set colors based on theme
    if (isDark)
    {
        // Dark theme colors
        colors.background = 0x2b2b2b;
        colors.foreground = 0xe0e0e0;
        colors.hoverBackground = 0x404040;
        colors.hoverForeground = 0xffffff;
        colors.border = 0x1a1a1a;
        colors.separator = 0x404040;
        colors.disabledText = 0x707070;
    }
    else
    {
        // Light theme colors
        colors.background = 0xfafafa;
        colors.foreground = 0x2b2b2b;
        colors.hoverBackground = 0xe8e8e8;
        colors.hoverForeground = 0x000000;
        colors.border = 0xd0d0d0;
        colors.separator = 0xd0d0d0;
        colors.disabledText = 0xa0a0a0;
    }

    return colors;
}

unsigned long LinuxWindow::AllocColor(unsigned long rgb)
{
    if (!display_)
    {
        return 0;
    }

    Colormap colormap = DefaultColormap(display_, screen_);
    XColor color;
    color.red = static_cast<unsigned short>(((rgb >> 16) & 0xFF) * 257);
    color.green = static_cast<unsigned short>(((rgb >> 8) & 0xFF) * 257);
    color.blue = static_cast<unsigned short>((rgb & 0xFF) * 257);
    color.flags = DoRed | DoGreen | DoBlue;

    if (XAllocColor(display_, colormap, &color))
    {
        return color.pixel;
    }

    return WhitePixel(display_, screen_);
}

// =================================================================================================
// Menu Layout Calculations
// =================================================================================================

int LinuxWindow::CalculateMenuHeight(const std::vector<MenuItem> &items)
{
    constexpr int itemHeight = 28;
    constexpr int separatorHeight = 8;
    int height = 4; // Top padding

    for (const auto &item : items)
    {
        height += item.separator ? separatorHeight : itemHeight;
    }
    height += 4; // Bottom padding

    return height;
}

// =================================================================================================
// Menu State Management
// =================================================================================================

LinuxWindow::MenuWindowState *LinuxWindow::CreateMenuState(
    int x, int y,
    const std::vector<MenuItem> &items,
    const MenuColors &colors,
    MenuWindowState *parent)
{
    if (!display_)
    {
        return nullptr;
    }

    ::Window root = RootWindow(display_, screen_);

    // Get screen dimensions for boundary checking
    int screenWidth = DisplayWidth(display_, screen_);
    int screenHeight = DisplayHeight(display_, screen_);

    // Calculate menu dimensions
    constexpr int menuWidth = 280;
    int menuHeight = CalculateMenuHeight(items);

    // Auto positioning: adjust if menu would go off-screen
    int finalX = x;
    int finalY = y;

    // For submenus, check if we should open to the left instead of right
    if (parent)
    {
        if (x + menuWidth > screenWidth)
        {
            // Open to the left instead
            finalX = parent->posX - menuWidth + 2;
        }
    }

    // Adjust vertical position if menu goes off bottom
    if (finalY + menuHeight > screenHeight)
    {
        finalY = screenHeight - menuHeight - 10;
        if (finalY < 0)
        {
            finalY = 0;
        }
    }

    // Adjust horizontal position if menu goes off right edge
    if (finalX + menuWidth > screenWidth)
    {
        finalX = screenWidth - menuWidth - 10;
        if (finalX < 0)
        {
            finalX = 0;
        }
    }

    // Create popup window
    XSetWindowAttributes attrs;
    attrs.override_redirect = True;
    attrs.background_pixel = colors.background;
    attrs.border_pixel = colors.border;
    attrs.event_mask = ExposureMask | ButtonPressMask | ButtonReleaseMask |
                       PointerMotionMask | LeaveWindowMask | KeyPressMask;
    attrs.save_under = True;

    ::Window menuWindow = XCreateWindow(
        display_, root, finalX, finalY, menuWidth, menuHeight, 1,
        CopyFromParent, InputOutput, CopyFromParent,
        CWOverrideRedirect | CWBackPixel | CWBorderPixel | CWEventMask | CWSaveUnder,
        &attrs);

    if (!menuWindow)
    {
        VlcPlayer::Log("Failed to create menu window");
        return nullptr;
    }

    // Make menu appear on top
    Atom wmStateAbove = XInternAtom(display_, "_NET_WM_STATE_ABOVE", False);
    Atom wmState = XInternAtom(display_, "_NET_WM_STATE", False);
    XChangeProperty(display_, menuWindow, wmState, XA_ATOM, 32, PropModeReplace,
                    reinterpret_cast<unsigned char *>(&wmStateAbove), 1);

    // Create back buffer for flicker-free rendering
    Pixmap backBuffer = XCreatePixmap(display_, menuWindow, menuWidth, menuHeight,
                                      static_cast<unsigned int>(DefaultDepth(display_, screen_)));

    // Create and initialize menu state
    MenuWindowState *menu = new MenuWindowState();
    menu->window = menuWindow;
    menu->backBuffer = backBuffer;
    menu->items = items;
    menu->width = menuWidth;
    menu->height = menuHeight;
    menu->posX = finalX;
    menu->posY = finalY;
    menu->parent = parent;
    menu->active = true;

    return menu;
}

void LinuxWindow::DestroyMenuState(MenuWindowState *menu)
{
    if (!menu)
    {
        return;
    }

    // Destroy child first (recursively)
    if (menu->child)
    {
        DestroyMenuState(menu->child);
        menu->child = nullptr;
    }

    // Cleanup resources
    if (menu->backBuffer)
    {
        XFreePixmap(display_, menu->backBuffer);
    }
    if (menu->window)
    {
        XDestroyWindow(display_, menu->window);
    }

    delete menu;
}

void LinuxWindow::CloseChildMenus(MenuWindowState *menu)
{
    if (!menu || !menu->child)
    {
        return;
    }

    DestroyMenuState(menu->child);
    menu->child = nullptr;
}

// =================================================================================================
// Menu Rendering
// =================================================================================================

void LinuxWindow::DrawMenuItem(
    ::Window window, GC gc,
    const MenuItem &item,
    int yPos, int width, int height,
    bool hovered, bool selected,
    const MenuColors &colors)
{
    if (item.separator)
    {
        // Draw separator line
        XSetForeground(display_, gc, colors.separator);
        XDrawLine(display_, window, gc, 10, yPos + 2, width - 10, yPos + 2);
        return;
    }

    // Draw background (keyboard selection has priority over hover)
    if ((selected || hovered) && item.enabled)
    {
        XSetForeground(display_, gc, colors.hoverBackground);
        XFillRectangle(display_, window, gc, 0, yPos, width, height);

        // Add selection indicator for keyboard navigation
        if (selected)
        {
            XSetForeground(display_, gc, colors.hoverForeground);
            XFillRectangle(display_, window, gc, 2, yPos + 2, 3, height - 4);
        }
    }

    // Set text color
    if (!item.enabled)
    {
        XSetForeground(display_, gc, colors.disabledText);
    }
    else if (selected || hovered)
    {
        XSetForeground(display_, gc, colors.hoverForeground);
    }
    else
    {
        XSetForeground(display_, gc, colors.foreground);
    }

    // Draw item text
    std::string displayText = item.label;
    if (!item.submenu.empty())
    {
        displayText += " >";
    }

    XDrawString(display_, window, gc, 15, yPos + 17,
                displayText.c_str(), static_cast<int>(displayText.length()));

    // Draw shortcut on the right (only if no submenu)
    if (!item.shortcut.empty() && item.submenu.empty())
    {
        XSetForeground(display_, gc, colors.disabledText);
        int shortcutX = width - 70;
        XDrawString(display_, window, gc, shortcutX, yPos + 17,
                    item.shortcut.c_str(), static_cast<int>(item.shortcut.length()));
    }
}

void LinuxWindow::RedrawMenu(MenuWindowState *menu, GC gc, const MenuColors &colors)
{
    if (!menu || !menu->active || !menu->backBuffer)
    {
        return;
    }

    // Clear back buffer with background color
    XSetForeground(display_, gc, colors.background);
    XFillRectangle(display_, menu->backBuffer, gc, 0, 0, menu->width, menu->height);

    // Draw all menu items to back buffer
    int yPos = 4;
    for (size_t i = 0; i < menu->items.size(); i++)
    {
        const auto &item = menu->items[i];
        bool hovered = static_cast<int>(i) == menu->hoveredItem;
        bool selected = static_cast<int>(i) == menu->selectedItem;
        DrawMenuItem(menu->backBuffer, gc, item, yPos, menu->width, 28, hovered, selected, colors);
        yPos += item.separator ? 8 : 28;
    }

    // Copy back buffer to window (eliminates flicker)
    XCopyArea(display_, menu->backBuffer, menu->window, gc, 0, 0,
              menu->width, menu->height, 0, 0);
}

// =================================================================================================
// Submenu Management
// =================================================================================================

bool LinuxWindow::OpenSubmenu(MenuWindowState *menu, int itemIndex, GC gc, const MenuColors &colors)
{
    if (!menu || itemIndex < 0 || itemIndex >= static_cast<int>(menu->items.size()))
    {
        return false;
    }

    const auto &item = menu->items[itemIndex];
    if (item.submenu.empty())
    {
        return false;
    }

    // Close existing child if different item
    if (menu->child)
    {
        CloseChildMenus(menu);
    }

    // Calculate submenu position
    int yPos = 4; // Top padding
    for (int i = 0; i < itemIndex; i++)
    {
        yPos += menu->items[i].separator ? 8 : 28;
    }

    int submenuX = menu->posX + menu->width - 2; // Overlap slightly
    int submenuY = menu->posY + yPos;

    // Create submenu
    menu->child = CreateMenuState(submenuX, submenuY, item.submenu, colors, menu);

    if (menu->child)
    {
        // Show submenu with fade-in
        XMapRaised(display_, menu->child->window);

        // Fade in animation (10 steps)
        for (int i = 1; i <= 10; i++)
        {
            SetMenuOpacity(menu->child->window, i * 0.1);
            RedrawMenu(menu->child, gc, colors);
            XFlush(display_);
            usleep(10000); // 10ms per step = 100ms total
        }

        return true;
    }

    return false;
}

void LinuxWindow::SetMenuOpacity(::Window window, double opacity)
{
    if (!display_ || !window)
    {
        return;
    }

    Atom atom = XInternAtom(display_, "_NET_WM_WINDOW_OPACITY", False);
    unsigned long opacityValue = static_cast<unsigned long>(opacity * 0xFFFFFFFF);
    XChangeProperty(display_, window, atom, XA_CARDINAL, 32, PropModeReplace,
                    reinterpret_cast<unsigned char *>(&opacityValue), 1);
}

// =================================================================================================
// Menu Event Handling
// =================================================================================================

bool LinuxWindow::HandleMenuEvent(
    MenuWindowState *rootMenu,
    XEvent &event,
    GC gc,
    const MenuColors &colors,
    bool &menuActive)
{
    if (!rootMenu)
    {
        return false;
    }

    // Find which menu this event belongs to
    MenuWindowState *targetMenu = nullptr;
    MenuWindowState *current = rootMenu;

    while (current)
    {
        if (event.xany.window == current->window)
        {
            targetMenu = current;
            break;
        }
        current = current->child;
    }

    if (!targetMenu)
    {
        return false;
    }

    switch (event.type)
    {
    case Expose:
        if (event.xexpose.count == 0)
        {
            RedrawMenu(targetMenu, gc, colors);
        }
        break;

    case MotionNotify:
    {
        int mouseY = event.xmotion.y;
        int yPos = 4;
        int newHovered = -1;

        for (size_t i = 0; i < targetMenu->items.size(); i++)
        {
            const auto &item = targetMenu->items[i];
            int height = item.separator ? 8 : 28;

            if (!item.separator && mouseY >= yPos && mouseY < yPos + height)
            {
                newHovered = static_cast<int>(i);
                break;
            }
            yPos += height;
        }

        if (newHovered != targetMenu->hoveredItem)
        {
            // Close child if hovering different item
            if (targetMenu->child && newHovered != targetMenu->hoveredItem)
            {
                CloseChildMenus(targetMenu);
            }

            targetMenu->hoveredItem = newHovered;
            targetMenu->selectedItem = newHovered; // Sync keyboard selection
            RedrawMenu(targetMenu, gc, colors);
        }
        break;
    }

    case ButtonPress:
    {
        if (event.xbutton.button == 1) // Left click
        {
            int mouseY = event.xbutton.y;
            int yPos = 4;

            for (size_t i = 0; i < targetMenu->items.size(); i++)
            {
                const auto &item = targetMenu->items[i];
                int height = item.separator ? 8 : 28;

                if (!item.separator && mouseY >= yPos && mouseY < yPos + height && item.enabled)
                {
                    if (!item.submenu.empty())
                    {
                        // Toggle submenu
                        if (targetMenu->child)
                        {
                            CloseChildMenus(targetMenu);
                        }
                        else
                        {
                            OpenSubmenu(targetMenu, static_cast<int>(i), gc, colors);
                        }
                    }
                    else
                    {
                        // Execute action
                        VlcPlayer::Log("Menu item selected: %s (action: %s)",
                                       item.label.c_str(), item.action.c_str());
                        player->ProcessKeyPress(item.action);
                        menuActive = false;
                    }
                    return true;
                }
                yPos += height;
            }
        }
        else
        {
            // Right click or other button - close menu
            menuActive = false;
        }
        break;
    }

    case KeyPress:
    {
        KeySym keysym = XLookupKeysym(&event.xkey, 0);

        switch (keysym)
        {
        case XK_Escape:
            // Close current menu or go back to parent
            if (targetMenu->parent)
            {
                CloseChildMenus(targetMenu->parent);
                RedrawMenu(targetMenu->parent, gc, colors);
            }
            else
            {
                menuActive = false;
            }
            break;

        case XK_Up:
        {
            // Move selection up (skip separators)
            int newSelected = targetMenu->selectedItem;
            do
            {
                newSelected--;
                if (newSelected < 0)
                {
                    newSelected = static_cast<int>(targetMenu->items.size()) - 1;
                }
            } while (targetMenu->items[newSelected].separator && newSelected != targetMenu->selectedItem);

            targetMenu->selectedItem = newSelected;
            targetMenu->hoveredItem = newSelected;
            CloseChildMenus(targetMenu);
            RedrawMenu(targetMenu, gc, colors);
            break;
        }

        case XK_Down:
        {
            // Move selection down (skip separators)
            int newSelected = targetMenu->selectedItem;
            if (newSelected < 0)
            {
                newSelected = 0;
            }
            do
            {
                newSelected++;
                if (newSelected >= static_cast<int>(targetMenu->items.size()))
                {
                    newSelected = 0;
                }
            } while (targetMenu->items[newSelected].separator && newSelected != targetMenu->selectedItem);

            targetMenu->selectedItem = newSelected;
            targetMenu->hoveredItem = newSelected;
            CloseChildMenus(targetMenu);
            RedrawMenu(targetMenu, gc, colors);
            break;
        }

        case XK_Left:
            // Go back to parent menu
            if (targetMenu->parent)
            {
                CloseChildMenus(targetMenu->parent);
                RedrawMenu(targetMenu->parent, gc, colors);
            }
            break;

        case XK_Right:
            // Open submenu if available
            if (targetMenu->selectedItem >= 0 &&
                !targetMenu->items[targetMenu->selectedItem].submenu.empty())
            {
                OpenSubmenu(targetMenu, targetMenu->selectedItem, gc, colors);
            }
            break;

        case XK_Return:
        case XK_KP_Enter:
        {
            // Execute selected item
            if (targetMenu->selectedItem >= 0)
            {
                const auto &item = targetMenu->items[targetMenu->selectedItem];
                if (item.enabled && !item.separator)
                {
                    if (!item.submenu.empty())
                    {
                        OpenSubmenu(targetMenu, targetMenu->selectedItem, gc, colors);
                    }
                    else
                    {
                        VlcPlayer::Log("Menu item selected: %s (action: %s)",
                                       item.label.c_str(), item.action.c_str());
                        player->ProcessKeyPress(item.action);
                        menuActive = false;
                    }
                }
            }
            break;
        }
        }
        break;
    }

    case LeaveNotify:
        // Reset hover when leaving menu (but keep selection for keyboard nav)
        if (targetMenu->hoveredItem != -1)
        {
            targetMenu->hoveredItem = -1;
            RedrawMenu(targetMenu, gc, colors);
        }
        break;
    }

    return true;
}

// =================================================================================================
// Main Context Menu Entry Point
// =================================================================================================

void LinuxWindow::CreateContextMenu(std::vector<MenuItem> items, int x, int y)
{
    if (!display_ || !window_)
    {
        VlcPlayer::Log("Cannot show context menu: display or window not available");
        return;
    }

    VlcPlayer::Log("Creating context menu at (%d, %d) with %zu items", x, y, items.size());

    if (items.empty())
    {
        VlcPlayer::Log("Context menu is empty");
        return;
    }

    // Get theme colors
    MenuColors colors = GetGtkThemeColors();

    // Allocate colors
    colors.background = AllocColor(colors.background);
    colors.foreground = AllocColor(colors.foreground);
    colors.hoverBackground = AllocColor(colors.hoverBackground);
    colors.hoverForeground = AllocColor(colors.hoverForeground);
    colors.border = AllocColor(colors.border);
    colors.separator = AllocColor(colors.separator);
    colors.disabledText = AllocColor(colors.disabledText);

    // Create root menu
    root_menu_ = CreateMenuState(x, y, items, colors);
    if (!root_menu_)
    {
        VlcPlayer::Log("Failed to create menu");
        return;
    }

    // Load font
    XFontStruct *font = XLoadQueryFont(display_, "-*-dejavu sans-medium-r-*-*-13-*-*-*-*-*-*-*");
    if (!font)
    {
        font = XLoadQueryFont(display_, "-*-liberation sans-medium-r-*-*-13-*-*-*-*-*-*-*");
    }
    if (!font)
    {
        font = XLoadQueryFont(display_, "-*-sans-medium-r-*-*-13-*-*-*-*-*-*-*");
    }
    if (!font)
    {
        font = XLoadQueryFont(display_, "fixed");
    }

    // Create GC for drawing
    GC gc = XCreateGC(display_, root_menu_->window, 0, nullptr);
    if (font)
    {
        XSetFont(display_, gc, font->fid);
    }

    // Grab pointer for click-outside detection
    XGrabPointer(display_, root_menu_->window, True,
                 ButtonPressMask | ButtonReleaseMask | PointerMotionMask,
                 GrabModeAsync, GrabModeAsync, 0, 0, CurrentTime);

    // Show menu with fade-in
    XMapRaised(display_, root_menu_->window);
    for (int i = 1; i <= 10; i++)
    {
        SetMenuOpacity(root_menu_->window, i * 0.1);
        RedrawMenu(root_menu_, gc, colors);
        XFlush(display_);
        usleep(10000);
    }

    context_menu_active_ = true;

    // Event loop
    bool menuActive = true;
    while (menuActive && context_menu_active_)
    {
        if (XPending(display_) > 0)
        {
            XEvent event;
            XNextEvent(display_, &event);

            // Check if click is outside all menus
            if (event.type == ButtonPress)
            {
                ::Window eventWindow = event.xany.window;
                bool clickedInMenu = false;

                // Check if click is in root menu or any child
                MenuWindowState *current = root_menu_;
                while (current)
                {
                    if (eventWindow == current->window)
                    {
                        clickedInMenu = true;
                        break;
                    }
                    current = current->child;
                }

                // Close menu if clicked outside
                if (!clickedInMenu)
                {
                    menuActive = false;
                    continue;
                }
            }

            // Handle menu event
            HandleMenuEvent(root_menu_, event, gc, colors, menuActive);
        }

        usleep(10000); // 10ms sleep to avoid busy waiting
    }

    // Ungrab pointer
    XUngrabPointer(display_, CurrentTime);

    // Fade out
    for (int i = 10; i >= 1; i--)
    {
        SetMenuOpacity(root_menu_->window, i * 0.1);
        XFlush(display_);
        usleep(10000);
    }

    // Cleanup
    XFreeGC(display_, gc);
    if (font)
    {
        XFreeFont(display_, font);
    }
    DestroyMenuState(root_menu_);
    root_menu_ = nullptr;
    context_menu_active_ = false;
    XFlush(display_);

    VlcPlayer::Log("Context menu closed");

    // Notify parent that menu is closed
    OnContextMenuClose();
}
