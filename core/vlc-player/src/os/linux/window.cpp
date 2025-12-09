#include "window.h"
#include "osd.h"
#include "../../vlc_player.h"
#include <vlc/vlc.h>
#include <X11/Xatom.h>
#include <X11/Xlib.h>
#include <X11/keysym.h>
#include <cstring>
#include <algorithm>
#include <mutex>
#include <X11/keysym.h>
#include <cstring>
#include <algorithm>

// =================================================================================================
// Motif Window Manager Hints (for window decorations)
// =================================================================================================

struct MotifWmHints
{
    unsigned long flags;
    unsigned long functions;
    unsigned long decorations;
    long input_mode;
    unsigned long status;
};

constexpr unsigned long MWM_HINTS_DECORATIONS = 2;
constexpr unsigned long MWM_DECOR_BORDER = (1L << 1);
constexpr unsigned long MWM_DECOR_RESIZEH = (1L << 2);
constexpr unsigned long MWM_DECOR_TITLE = (1L << 3);

// =================================================================================================
// Constructor & Destructor
// =================================================================================================

LinuxWindow::LinuxWindow(VlcPlayer *player)
    : OSWindow(player),
      display_(nullptr),
      window_(0),
      screen_(0),
      is_created_(false),
      is_visible_(false),
      is_minimized_(false),
      is_fullscreen_(false),
      is_on_top_(false),
      media_player_(nullptr),
      xft_draw_(nullptr),
      root_menu_(nullptr),
      context_menu_active_(false)
{
    VlcPlayer::Log("LinuxWindow constructor started");
    bounds_ = {0, 0, 0, 0};
    client_area_ = {0, 0, 0, 0};
    saved_state_ = {0, 0, 0, 0};
    VlcPlayer::Log("LinuxWindow constructor completed");
}

LinuxWindow::~LinuxWindow()
{
    VlcPlayer::Log("LinuxWindow destructor started");
    Destroy();
    VlcPlayer::Log("LinuxWindow destructor completed");
}

// =================================================================================================
// Window Lifecycle
// =================================================================================================

bool LinuxWindow::Create(int width, int height)
{
    std::lock_guard<std::mutex> lock(window_mutex_);

    // Initialize X11 threading support (must be first Xlib call)
    static std::once_flag x11_init_flag;
    std::call_once(x11_init_flag, []() {
        Status status = XInitThreads();
        VlcPlayer::Log("XInitThreads() called, status: %d", status);
    });

    if (is_created_)
    {
        VlcPlayer::Log("Window already created");
        return true;
    }

    // Set X11 Error Handler
    XSetErrorHandler([](Display *d, XErrorEvent *e) -> int {
        char buffer[1024];
        XGetErrorText(d, e->error_code, buffer, sizeof(buffer));
        VlcPlayer::Log("X11 ERROR: Request: %d, Error: %s", e->request_code, buffer);
        return 0;
    });

    VlcPlayer::Log("Creating Linux X11 window (%dx%d)", width, height);

    // Connect to X11 display
    const char *display_name = getenv("DISPLAY");
    display_ = XOpenDisplay(display_name);

    if (!display_)
    {
        VlcPlayer::Log("ERROR: XOpenDisplay failed (DISPLAY=%s)", display_name ? display_name : "null");
        return false;
    }

    screen_ = DefaultScreen(display_);
    ::Window root = RootWindow(display_, screen_);
    Visual *visual = DefaultVisual(display_, screen_);
    Colormap cmap = DefaultColormap(display_, screen_);

    // Initialize atoms
    InitializeAtoms();

    // Create window
    XSetWindowAttributes attrs;
    attrs.colormap = cmap;
    attrs.background_pixel = BlackPixel(display_, screen_);
    attrs.border_pixel = WhitePixel(display_, screen_);
    attrs.event_mask = ExposureMask | StructureNotifyMask | KeyPressMask |
                       ButtonPressMask | ButtonReleaseMask | PointerMotionMask |
                       PropertyChangeMask | VisibilityChangeMask;

    window_ = XCreateWindow(
        display_,
        root,
        100, 100,
        static_cast<unsigned int>(width),
        static_cast<unsigned int>(height),
        2,
        DefaultDepth(display_, screen_),
        InputOutput,
        visual,
        CWColormap | CWBackPixel | CWBorderPixel | CWEventMask,
        &attrs);

    if (!window_)
    {
        VlcPlayer::Log("ERROR: XCreateWindow failed");
        XCloseDisplay(display_);
        display_ = nullptr;
        return false;
    }

    // Set window title
    XStoreName(display_, window_, "Zenith TV Player");

    // Set size hints
    XSizeHints *size_hints = XAllocSizeHints();
    if (size_hints)
    {
        size_hints->flags = PPosition | PSize | PMinSize;
        size_hints->min_width = 320;
        size_hints->min_height = 240;
        XSetWMNormalHints(display_, window_, size_hints);
        XFree(size_hints);
    }

    // Set WM protocols
    XSetWMProtocols(display_, window_, &wm_delete_window_atom_, 1);

    // Create Xft draw context
    xft_draw_ = XftDrawCreate(display_, window_, visual, cmap);
    if (!xft_draw_)
    {
        VlcPlayer::Log("ERROR: XftDrawCreate failed");
        XDestroyWindow(display_, window_);
        XCloseDisplay(display_);
        display_ = nullptr;
        window_ = 0;
        return false;
    }

    // Map window
    XMapWindow(display_, window_);
    XRaiseWindow(display_, window_);
    XSync(display_, False);
    XFlush(display_);

    // Initialize state
    bounds_ = {100, 100, width, height};
    client_area_ = {100, 100, width, height};
    saved_state_ = bounds_;
    is_created_ = true;
    is_visible_ = true;

    // Re-initialize colors now that display is ready
    // (The first call in constructor failed because display_ was null)
    Initialize();

    // Start message loop
    StartMessageLoop();

    VlcPlayer::Log("Linux X11 window created successfully (Window ID: 0x%lx)", window_);

    return true;
}

void LinuxWindow::Destroy()
{
    std::lock_guard<std::mutex> lock(window_mutex_);

    if (!is_created_)
    {
        return;
    }

    VlcPlayer::Log("Destroying Linux X11 window");

    // Stop message loop
    StopMessageLoop();

    // Destroy context menu if active
    DestroyContextMenu();

    // Cleanup Xft
    if (xft_draw_)
    {
        XftDrawDestroy(xft_draw_);
        xft_draw_ = nullptr;
    }

    // Cleanup colors
    for (auto *color : colors_)
    {
        if (color)
        {
            XftColorFree(display_, DefaultVisual(display_, screen_),
                         DefaultColormap(display_, screen_), color);
            delete color;
        }
    }
    colors_.clear();

    // Cleanup fonts
    for (auto *font : fonts_)
    {
        if (font)
        {
            XftFontClose(display_, font);
        }
    }
    fonts_.clear();

    // Destroy window
    if (window_)
    {
        XDestroyWindow(display_, window_);
        window_ = 0;
    }

    // Close display
    if (display_)
    {
        XCloseDisplay(display_);
        display_ = nullptr;
    }

    is_created_ = false;
    is_visible_ = false;
    is_fullscreen_ = false;
    media_player_ = nullptr;

    VlcPlayer::Log("Linux X11 window destroyed");
}

bool LinuxWindow::IsCreated() const
{
    return is_created_;
}

bool LinuxWindow::Bind(libvlc_media_player_t *media_player)
{
    if (!is_created_ || !window_)
    {
        VlcPlayer::Log("ERROR: Cannot bind - window not created");
        return false;
    }

    media_player_ = media_player;

    // Set VLC to render on this window
    if (window_ <= UINT32_MAX)
    {
        libvlc_media_player_set_xwindow(media_player_, static_cast<uint32_t>(window_));
        VlcPlayer::Log("VLC media player bound to X11 window (0x%lx)", window_);
        return true;
    }

    VlcPlayer::Log("ERROR: Window ID too large for uint32_t");
    return false;
}

// =================================================================================================
// Window State Queries
// =================================================================================================

bool LinuxWindow::IsVisible() const
{
    return is_visible_;
}

bool LinuxWindow::IsMinimized() const
{
    return is_minimized_;
}

bool LinuxWindow::IsFullscreen() const
{
    return is_fullscreen_;
}

bool LinuxWindow::IsOnTop() const
{
    return is_on_top_;
}

void LinuxWindow::GetBounds(WindowBounds *bounds) const
{
    if (bounds)
    {
        *bounds = bounds_;
    }
}

WindowBounds LinuxWindow::GetClientArea() const
{
    return client_area_;
}

// =================================================================================================
// Text Measurement
// =================================================================================================

Dimension LinuxWindow::MeasureText(OSDFont font, const std::string &text)
{
    if (!font || text.empty())
    {
        return {0, 0};
    }

    XftFont *xft_font = static_cast<XftFont *>(font);
    XGlyphInfo extents;
    XftTextExtentsUtf8(display_, xft_font,
                       reinterpret_cast<const XftChar8 *>(text.c_str()),
                       static_cast<int>(text.length()), &extents);

    return {extents.width, extents.height};
}

// =================================================================================================
// Color/Font Management
// =================================================================================================

OSDColor LinuxWindow::CreateColor(int r, int g, int b, int a)
{
    if (!display_)
    {
        return nullptr;
    }

    XftColor *color = new XftColor();
    XRenderColor render_color;
    render_color.red = static_cast<unsigned short>(r * 257);
    render_color.green = static_cast<unsigned short>(g * 257);
    render_color.blue = static_cast<unsigned short>(b * 257);
    render_color.alpha = static_cast<unsigned short>(a * 257);

    if (!XftColorAllocValue(display_, DefaultVisual(display_, screen_),
                            DefaultColormap(display_, screen_), &render_color, color))
    {
        delete color;
        return nullptr;
    }

    colors_.push_back(color);
    return static_cast<OSDColor>(color);
}

OSDFont LinuxWindow::CreateOSDFont(bool bold)
{
    if (!display_)
    {
        return nullptr;
    }

    // Use DejaVu Sans or Liberation Sans (common on Linux)
    const char *pattern = bold ? "DejaVu Sans:style=Bold:size=13" : "DejaVu Sans:style=Regular:size=13";

    XftFont *font = XftFontOpenName(display_, screen_, pattern);
    if (!font)
    {
        // Fallback to Liberation Sans
        pattern = bold ? "Liberation Sans:style=Bold:size=13" : "Liberation Sans:style=Regular:size=13";
        font = XftFontOpenName(display_, screen_, pattern);
    }
    if (!font)
    {
        // Final fallback to sans
        pattern = bold ? "sans:style=Bold:size=13" : "sans:style=Regular:size=13";
        font = XftFontOpenName(display_, screen_, pattern);
    }

    if (font)
    {
        fonts_.push_back(font);
    }
    else
    {
        // All fallbacks failed - critical error
        VlcPlayer::Log("ERROR: Failed to load any Xft font (tried DejaVu Sans, Liberation Sans, sans). "
                       "OSD text rendering will not work. Install 'fonts-dejavu' or 'fonts-liberation' package.");
    }

    return static_cast<OSDFont>(font);
}

void LinuxWindow::DestroyColor(OSDColor color)
{
    if (!color || !display_)
    {
        return;
    }

    XftColor *xft_color = static_cast<XftColor *>(color);
    auto it = std::find(colors_.begin(), colors_.end(), xft_color);
    if (it != colors_.end())
    {
        XftColorFree(display_, DefaultVisual(display_, screen_),
                     DefaultColormap(display_, screen_), xft_color);
        delete xft_color;
        colors_.erase(it);
    }
}

void LinuxWindow::DestroyFont(OSDFont font)
{
    if (!font || !display_)
    {
        return;
    }

    XftFont *xft_font = static_cast<XftFont *>(font);
    auto it = std::find(fonts_.begin(), fonts_.end(), xft_font);
    if (it != fonts_.end())
    {
        XftFontClose(display_, xft_font);
        fonts_.erase(it);
    }
}

// =================================================================================================
// OSD Management
// =================================================================================================

std::shared_ptr<OSDWindow> LinuxWindow::CreateOSDWindow()
{
    return std::make_shared<LinuxOSDWindow>(this);
}

// =================================================================================================
// Context Menu (implemented in context_menu.cpp)
// =================================================================================================

void LinuxWindow::DestroyContextMenu()
{
    if (root_menu_)
    {
        DestroyMenuState(root_menu_);
        root_menu_ = nullptr;
    }
    context_menu_active_ = false;
}

// =================================================================================================
// Window Manipulation Internal
// =================================================================================================

void LinuxWindow::SetBoundsInternal(int x, int y, int width, int height)
{
    if (!is_created_ || !display_ || !window_)
    {
        return;
    }

    XMoveResizeWindow(display_, window_, x, y,
                      static_cast<unsigned int>(width),
                      static_cast<unsigned int>(height));
    XFlush(display_);

    bounds_ = {x, y, width, height};

    // Update saved state if not in fullscreen
    if (!is_fullscreen_)
    {
        saved_state_ = bounds_;
    }

    UpdateClientArea();
}

void LinuxWindow::SetStyleInternal(const WindowStyle &style)
{
    if (!is_created_ || !display_ || !window_)
    {
        return;
    }

    // Handle fullscreen
    if (style.fullscreen != is_fullscreen_)
    {
        SendWindowStateMessage(wm_state_fullscreen_atom_, style.fullscreen);
        is_fullscreen_ = style.fullscreen;
    }

    // Handle always on top
    if (style.on_top != is_on_top_)
    {
        SendWindowStateMessage(wm_state_above_atom_, style.on_top);
        is_on_top_ = style.on_top;
    }

    // Handle taskbar visibility
    if (!style.show_in_taskbar)
    {
        SendWindowStateMessage(wm_state_skip_taskbar_atom_, true);
    }
    else
    {
        SendWindowStateMessage(wm_state_skip_taskbar_atom_, false);
    }

    // Handle window decorations (border, titlebar, resizable)
    MotifWmHints hints;
    hints.flags = MWM_HINTS_DECORATIONS;
    hints.functions = 0;
    hints.decorations = 0;
    hints.input_mode = 0;
    hints.status = 0;

    if (style.has_border || style.has_titlebar)
    {
        hints.decorations |= MWM_DECOR_BORDER;
    }
    if (style.has_titlebar)
    {
        hints.decorations |= MWM_DECOR_TITLE;
    }
    if (style.is_resizable)
    {
        hints.decorations |= MWM_DECOR_RESIZEH;
    }

    XChangeProperty(display_, window_, motif_hints_atom_, motif_hints_atom_, 32,
                    PropModeReplace, reinterpret_cast<unsigned char *>(&hints), 5);

    XFlush(display_);
}

// =================================================================================================
// Message Loop & Event Handling
// =================================================================================================

void LinuxWindow::StartMessageLoop()
{
    if (message_thread_running_)
    {
        return;
    }

    message_thread_running_ = true;
    message_thread_ = std::thread([this]()
                                  { ProcessEvents(); });
}

void LinuxWindow::StopMessageLoop()
{
    if (!message_thread_running_)
    {
        return;
    }

    message_thread_running_ = false;
    if (message_thread_.joinable())
    {
        message_thread_.join();
    }
}

void LinuxWindow::ProcessEvents()
{
    XEvent event;

    while (message_thread_running_)
    {
        {
            std::lock_guard<std::mutex> lock(window_mutex_);

            // Check if window/display still valid (thread-safe)
            if (!display_ || !window_)
            {
                break;
            }

            // Process pending events (X11 is not thread-safe, must lock)
            if (XPending(display_) > 0)
            {
                XNextEvent(display_, &event);

                // Handle event while holding lock (X11 calls inside handlers need protection)
                switch (event.type)
                {
                case KeyPress:
                    HandleKeyPress(&event);
                    break;
                case ButtonPress:
                    HandleButtonPress(&event);
                    break;
                case ConfigureNotify:
                    HandleConfigureNotify(&event);
                    break;
                case PropertyNotify:
                    HandlePropertyNotify(&event);
                    break;
                case ClientMessage:
                    HandleClientMessage(&event);
                    break;
                case MapNotify:
                    HandleMapNotify();
                    break;
                case UnmapNotify:
                    HandleUnmapNotify();
                    break;
                }
            }
        } // Lock released here

        // Sleep outside lock to allow other threads to access display
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}

void LinuxWindow::HandleKeyPress(XEvent *event)
{
    KeySym keysym = XLookupKeysym(&event->xkey, 0);
    std::string keyCode = GetKeyName(keysym);

    if (!keyCode.empty())
    {
        bool ctrl, shift, alt, meta;
        GetKeyModifiers(ctrl, shift, alt, meta);
        OnInput(keyCode, ctrl, shift, alt, meta);
    }
}

void LinuxWindow::HandleButtonPress(XEvent *event)
{
    if (event->xbutton.button == 3) // Right click
    {
        OnRightClick(event->xbutton.x_root, event->xbutton.y_root);
    }
    else if (event->xbutton.button == 1) // Left click
    {
        OnInput("MouseLeft", false, false, false, false);
    }
    else if (event->xbutton.button == 2) // Middle click
    {
        OnInput("MouseMiddle", false, false, false, false);
    }
    else if (event->xbutton.button == 4) // Scroll up
    {
        OnInput("MouseWheelUp", false, false, false, false);
    }
    else if (event->xbutton.button == 5) // Scroll down
    {
        OnInput("MouseWheelDown", false, false, false, false);
    }
}

void LinuxWindow::HandleConfigureNotify(XEvent *event)
{
    int new_x = event->xconfigure.x;
    int new_y = event->xconfigure.y;
    int new_width = event->xconfigure.width;
    int new_height = event->xconfigure.height;

    if (new_x != bounds_.x || new_y != bounds_.y ||
        new_width != bounds_.width || new_height != bounds_.height)
    {
        bounds_ = {new_x, new_y, new_width, new_height};
        UpdateClientArea();
        OnResize(new_x, new_y, new_width, new_height);
    }
}

void LinuxWindow::HandlePropertyNotify(XEvent *event)
{
    if (event->xproperty.atom == XInternAtom(display_, "WM_STATE", False))
    {
        // Window state changed (minimized/restored)
        Atom actual_type;
        int actual_format;
        unsigned long nitems, bytes_after;
        unsigned char *prop_data = nullptr;

        if (XGetWindowProperty(display_, window_, event->xproperty.atom, 0, 2, False,
                               event->xproperty.atom, &actual_type, &actual_format,
                               &nitems, &bytes_after, &prop_data) == Success)
        {
            if (prop_data)
            {
                long state = *reinterpret_cast<long *>(prop_data);
                bool was_minimized = is_minimized_;
                is_minimized_ = (state == 3); // IconicState = 3

                if (is_minimized_ != was_minimized)
                {
                    OnMinimize(is_minimized_);
                }

                XFree(prop_data);
            }
        }
    }
}

void LinuxWindow::HandleClientMessage(XEvent *event)
{
    if (static_cast<Atom>(event->xclient.data.l[0]) == wm_delete_window_atom_)
    {
        // Window close requested
        OnClose();
    }
}

void LinuxWindow::HandleMapNotify()
{
    is_visible_ = true;
}

void LinuxWindow::HandleUnmapNotify()
{
    is_visible_ = false;
}

// =================================================================================================
// Helper Methods
// =================================================================================================

void LinuxWindow::InitializeAtoms()
{
    wm_delete_window_atom_ = XInternAtom(display_, "WM_DELETE_WINDOW", False);
    wm_state_atom_ = XInternAtom(display_, "_NET_WM_STATE", False);
    wm_state_fullscreen_atom_ = XInternAtom(display_, "_NET_WM_STATE_FULLSCREEN", False);
    wm_state_above_atom_ = XInternAtom(display_, "_NET_WM_STATE_ABOVE", False);
    wm_state_skip_taskbar_atom_ = XInternAtom(display_, "_NET_WM_STATE_SKIP_TASKBAR", False);
    motif_hints_atom_ = XInternAtom(display_, "_MOTIF_WM_HINTS", False);
    wm_window_opacity_atom_ = XInternAtom(display_, "_NET_WM_WINDOW_OPACITY", False);
}

void LinuxWindow::UpdateClientArea()
{
    // For now, client area is same as window bounds (simple implementation)
    // In future, we can calculate actual client rect by subtracting decorations
    client_area_ = bounds_;
}

void LinuxWindow::SendWindowStateMessage(Atom state_atom, bool enable)
{
    if (!display_ || !window_)
    {
        return;
    }

    XEvent xev;
    memset(&xev, 0, sizeof(xev));
    xev.type = ClientMessage;
    xev.xclient.window = window_;
    xev.xclient.message_type = wm_state_atom_;
    xev.xclient.format = 32;
    xev.xclient.data.l[0] = enable ? 1 : 0; // _NET_WM_STATE_ADD / _NET_WM_STATE_REMOVE
    xev.xclient.data.l[1] = static_cast<long>(state_atom);
    xev.xclient.data.l[2] = 0;

    XSendEvent(display_, DefaultRootWindow(display_), False,
               SubstructureRedirectMask | SubstructureNotifyMask, &xev);
    XFlush(display_);
}

std::string LinuxWindow::GetKeyName(KeySym keysym)
{
    // Map X11 KeySym to JavaScript KeyboardEvent.code format
    switch (keysym)
    {
    // Alphabet keys
    case XK_a:
    case XK_A:
        return "KeyA";
    case XK_b:
    case XK_B:
        return "KeyB";
    case XK_c:
    case XK_C:
        return "KeyC";
    case XK_d:
    case XK_D:
        return "KeyD";
    case XK_e:
    case XK_E:
        return "KeyE";
    case XK_f:
    case XK_F:
        return "KeyF";
    case XK_g:
    case XK_G:
        return "KeyG";
    case XK_h:
    case XK_H:
        return "KeyH";
    case XK_i:
    case XK_I:
        return "KeyI";
    case XK_j:
    case XK_J:
        return "KeyJ";
    case XK_k:
    case XK_K:
        return "KeyK";
    case XK_l:
    case XK_L:
        return "KeyL";
    case XK_m:
    case XK_M:
        return "KeyM";
    case XK_n:
    case XK_N:
        return "KeyN";
    case XK_o:
    case XK_O:
        return "KeyO";
    case XK_p:
    case XK_P:
        return "KeyP";
    case XK_q:
    case XK_Q:
        return "KeyQ";
    case XK_r:
    case XK_R:
        return "KeyR";
    case XK_s:
    case XK_S:
        return "KeyS";
    case XK_t:
    case XK_T:
        return "KeyT";
    case XK_u:
    case XK_U:
        return "KeyU";
    case XK_v:
    case XK_V:
        return "KeyV";
    case XK_w:
    case XK_W:
        return "KeyW";
    case XK_x:
    case XK_X:
        return "KeyX";
    case XK_y:
    case XK_Y:
        return "KeyY";
    case XK_z:
    case XK_Z:
        return "KeyZ";

    // Arrow keys
    case XK_Left:
        return "ArrowLeft";
    case XK_Right:
        return "ArrowRight";
    case XK_Up:
        return "ArrowUp";
    case XK_Down:
        return "ArrowDown";

    // Special keys
    case XK_space:
        return "Space";
    case XK_Escape:
        return "Escape";
    case XK_Return:
        return "Enter";
    case XK_Tab:
        return "Tab";
    case XK_BackSpace:
        return "Backspace";

    // Function keys
    case XK_F1:
        return "F1";
    case XK_F2:
        return "F2";
    case XK_F3:
        return "F3";
    case XK_F4:
        return "F4";
    case XK_F5:
        return "F5";
    case XK_F6:
        return "F6";
    case XK_F7:
        return "F7";
    case XK_F8:
        return "F8";
    case XK_F9:
        return "F9";
    case XK_F10:
        return "F10";
    case XK_F11:
        return "F11";
    case XK_F12:
        return "F12";

    // Digit keys
    case XK_0:
        return "Digit0";
    case XK_1:
        return "Digit1";
    case XK_2:
        return "Digit2";
    case XK_3:
        return "Digit3";
    case XK_4:
        return "Digit4";
    case XK_5:
        return "Digit5";
    case XK_6:
        return "Digit6";
    case XK_7:
        return "Digit7";
    case XK_8:
        return "Digit8";
    case XK_9:
        return "Digit9";

    default:
        return "";
    }
}

bool LinuxWindow::GetKeyModifiers(bool &ctrl, bool &shift, bool &alt, bool &meta)
{
    if (!display_ || !window_)
    {
        ctrl = shift = alt = meta = false;
        return false;
    }

    ::Window root_return, child_return;
    int root_x, root_y, win_x, win_y;
    unsigned int mask;

    if (XQueryPointer(display_, window_, &root_return, &child_return,
                      &root_x, &root_y, &win_x, &win_y, &mask))
    {
        ctrl = (mask & ControlMask) != 0;
        shift = (mask & ShiftMask) != 0;
        alt = (mask & Mod1Mask) != 0;
        meta = (mask & Mod4Mask) != 0;
        return true;
    }

    ctrl = shift = alt = meta = false;
    return false;
}
