#include "vlc_player.h"

#ifdef __linux__
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xatom.h>
#include <cstring>
#include <vector>
#include <string>

// =================================================================================================
// X11 Context Menu Implementation
// =================================================================================================

// Simple X11 menu implementation using a popup window
// Note: X11 doesn't have native menu widgets, so we create a simple popup window

void VlcPlayer::ShowContextMenu(int x, int y) {
    if (!display_ || !child_window_) {
        printf("[VLC] Cannot show context menu: display or window not available\n");
        fflush(stdout);
        return;
    }
    
    printf("[VLC] Building context menu...\n");
    fflush(stdout);
    
    // Build menu structure
    std::vector<MenuItem> menuItems = BuildContextMenu();
    
    if (menuItems.empty()) {
        printf("[VLC] Context menu is empty\n");
        fflush(stdout);
        return;
    }
    
    printf("[VLC] Context menu has %zu items\n", menuItems.size());
    fflush(stdout);
    
    // For X11, we'll use a simple approach: create a popup window with text
    // In a production environment, you might want to use a toolkit like GTK+ or Qt
    // For now, we'll implement a basic text-based menu using XCreateWindow
    
    int screen = DefaultScreen(display_);
    ::Window root = RootWindow(display_, screen);
    
    // Calculate menu dimensions
    const int itemHeight = 25;
    const int menuWidth = 250;
    int menuHeight = 0;
    
    for (const auto& item : menuItems) {
        if (item.separator) {
            menuHeight += 5;
        } else {
            menuHeight += itemHeight;
        }
    }
    
    // Create popup window for menu
    XSetWindowAttributes attrs;
    attrs.override_redirect = True;  // No window manager decorations
    attrs.background_pixel = WhitePixel(display_, screen);
    attrs.border_pixel = BlackPixel(display_, screen);
    attrs.event_mask = ExposureMask | ButtonPressMask | ButtonReleaseMask | PointerMotionMask;
    
    ::Window menuWindow = XCreateWindow(
        display_,
        root,
        x, y,
        menuWidth, menuHeight,
        1,  // border width
        CopyFromParent,
        InputOutput,
        CopyFromParent,
        CWOverrideRedirect | CWBackPixel | CWBorderPixel | CWEventMask,
        &attrs
    );
    
    if (!menuWindow) {
        printf("[VLC] Failed to create menu window\n");
        fflush(stdout);
        return;
    }
    
    // Load font
    XFontStruct* font = XLoadQueryFont(display_, "fixed");
    if (!font) {
        font = XLoadQueryFont(display_, "*");
    }
    
    // Create GC for drawing
    GC gc = XCreateGC(display_, menuWindow, 0, nullptr);
    if (font) {
        XSetFont(display_, gc, font->fid);
    }
    XSetForeground(display_, gc, BlackPixel(display_, screen));
    XSetBackground(display_, gc, WhitePixel(display_, screen));
    
    // Map the window
    XMapRaised(display_, menuWindow);
    XFlush(display_);
    
    // Event loop for menu
    bool menuActive = true;
    int hoveredItem = -1;
    
    while (menuActive) {
        XEvent event;
        XNextEvent(display_, &event);
        
        if (event.xany.window != menuWindow) {
            continue;
        }
        
        switch (event.type) {
            case Expose:
                if (event.xexpose.count == 0) {
                    // Redraw menu
                    int yPos = 0;
                    int itemIndex = 0;
                    
                    for (size_t i = 0; i < menuItems.size(); i++) {
                        const auto& item = menuItems[i];
                        
                        if (item.separator) {
                            // Draw separator line
                            XDrawLine(display_, menuWindow, gc, 5, yPos + 2, menuWidth - 5, yPos + 2);
                            yPos += 5;
                        } else {
                            // Highlight hovered item
                            if ((int)i == hoveredItem) {
                                XSetForeground(display_, gc, BlackPixel(display_, screen));
                                XFillRectangle(display_, menuWindow, gc, 0, yPos, menuWidth, itemHeight);
                                XSetForeground(display_, gc, WhitePixel(display_, screen));
                            } else {
                                XSetForeground(display_, gc, BlackPixel(display_, screen));
                            }
                            
                            // Draw item text
                            std::string displayText = item.label;
                            if (!item.submenu.empty()) {
                                displayText += " >";
                            }
                            
                            XDrawString(display_, menuWindow, gc, 10, yPos + 17, 
                                       displayText.c_str(), displayText.length());
                            
                            // Draw shortcut on the right
                            if (!item.shortcut.empty() && item.submenu.empty()) {
                                int shortcutX = menuWidth - 60;
                                XDrawString(display_, menuWindow, gc, shortcutX, yPos + 17,
                                           item.shortcut.c_str(), item.shortcut.length());
                            }
                            
                            // Reset foreground
                            XSetForeground(display_, gc, BlackPixel(display_, screen));
                            
                            yPos += itemHeight;
                            itemIndex++;
                        }
                    }
                }
                break;
                
            case MotionNotify:
                {
                    int mouseY = event.xmotion.y;
                    int yPos = 0;
                    int newHovered = -1;
                    
                    for (size_t i = 0; i < menuItems.size(); i++) {
                        const auto& item = menuItems[i];
                        
                        if (item.separator) {
                            yPos += 5;
                        } else {
                            if (mouseY >= yPos && mouseY < yPos + itemHeight) {
                                newHovered = i;
                                break;
                            }
                            yPos += itemHeight;
                        }
                    }
                    
                    if (newHovered != hoveredItem) {
                        hoveredItem = newHovered;
                        // Trigger redraw
                        XClearWindow(display_, menuWindow);
                        XEvent exposeEvent;
                        exposeEvent.type = Expose;
                        exposeEvent.xexpose.window = menuWindow;
                        exposeEvent.xexpose.count = 0;
                        XSendEvent(display_, menuWindow, False, ExposureMask, &exposeEvent);
                        XFlush(display_);
                    }
                }
                break;
                
            case ButtonPress:
                if (event.xbutton.button == 1) {  // Left click
                    int mouseY = event.xbutton.y;
                    int yPos = 0;
                    
                    for (size_t i = 0; i < menuItems.size(); i++) {
                        const auto& item = menuItems[i];
                        
                        if (item.separator) {
                            yPos += 5;
                        } else {
                            if (mouseY >= yPos && mouseY < yPos + itemHeight && item.enabled) {
                                printf("[VLC] Menu item selected: %s (action: %s)\n", 
                                       item.label.c_str(), item.action.c_str());
                                fflush(stdout);
                                
                                // Execute the action
                                ExecuteMenuAction(item.action);
                                
                                // Close menu
                                menuActive = false;
                                break;
                            }
                            yPos += itemHeight;
                        }
                    }
                } else {
                    // Click outside or other button - close menu
                    menuActive = false;
                }
                break;
                
            case ButtonRelease:
                // Ignore for now
                break;
        }
    }
    
    // Cleanup
    XFreeGC(display_, gc);
    if (font) {
        XFreeFont(display_, font);
    }
    XDestroyWindow(display_, menuWindow);
    XFlush(display_);
    
    printf("[VLC] Context menu closed\n");
    fflush(stdout);
}

#endif // __linux__
