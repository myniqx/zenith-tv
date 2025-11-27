#include "vlc_player.h"
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xatom.h>

// =================================================================================================
// Internal Window Management Methods
// =================================================================================================

void VlcPlayer::CreateChildWindowInternal(int width, int height) {
    if (child_window_created_) {
        return; // Already created
    }

    printf("[VLC] Creating child window: %dx%d\n", width, height);
    fflush(stdout);

    // Connect to X11 display
    const char* display_name = getenv("DISPLAY");
    printf("[VLC] CALL: XOpenDisplay(display='%s')\n", display_name ? display_name : ":0");
    display_ = XOpenDisplay(display_name);
    printf("[VLC] RETURN: display=%p\n", (void*)display_);
    fflush(stdout);

    if (!display_) {
        printf("[VLC] ERROR: XOpenDisplay failed\n");
        fflush(stdout);
        return;
    }

    int screen = DefaultScreen(display_);
    ::Window root = RootWindow(display_, screen);  // Use :: to avoid conflict with Window() method
    Visual* visual = DefaultVisual(display_, screen);
    Colormap cmap = DefaultColormap(display_, screen);

    // Create standalone window
    XSetWindowAttributes attrs;
    attrs.colormap = cmap;
    attrs.background_pixel = BlackPixel(display_, screen);
    attrs.border_pixel = WhitePixel(display_, screen);
    attrs.event_mask = ExposureMask | StructureNotifyMask | KeyPressMask | ButtonPressMask;

    printf("[VLC] CALL: XCreateWindow(parent=root, x=100, y=100, w=%d, h=%d)\n", width, height);
    child_window_ = XCreateWindow(
        display_,
        root,
        100, 100,
        (unsigned int)width,
        (unsigned int)height,
        2,
        DefaultDepth(display_, screen),
        InputOutput,
        visual,
        CWColormap | CWBackPixel | CWBorderPixel | CWEventMask,
        &attrs
    );
    printf("[VLC] RETURN: child_window=0x%lx\n", child_window_);
    fflush(stdout);

    if (!child_window_) {
        printf("[VLC] ERROR: XCreateWindow failed\n");
        XCloseDisplay(display_);
        display_ = nullptr;
        fflush(stdout);
        return;
    }

    XStoreName(display_, child_window_, "VLC Player");

    XSizeHints* size_hints = XAllocSizeHints();
    if (size_hints) {
        size_hints->flags = PPosition | PSize | PMinSize;
        size_hints->min_width = 320;
        size_hints->min_height = 240;
        XSetWMNormalHints(display_, child_window_, size_hints);
        XFree(size_hints);
    }

    Atom wm_delete_window = XInternAtom(display_, "WM_DELETE_WINDOW", False);
    XSetWMProtocols(display_, child_window_, &wm_delete_window, 1);

    printf("[VLC] CALL: XMapWindow(window=0x%lx)\n", child_window_);
    XMapWindow(display_, child_window_);
    XRaiseWindow(display_, child_window_);
    XSync(display_, False);
    XFlush(display_);
    fflush(stdout);

    // Set VLC to render on this window
    if (child_window_ <= UINT32_MAX) {
        libvlc_media_player_set_xwindow(media_player_, static_cast<uint32_t>(child_window_));
    }

    child_window_created_ = true;

    // Initialize window state
    XWindowAttributes wa;
    XGetWindowAttributes(display_, child_window_, &wa);
    saved_window_state_.x = wa.x;
    saved_window_state_.y = wa.y;
    saved_window_state_.width = wa.width;
    saved_window_state_.height = wa.height;
    saved_window_state_.has_border = true;
    saved_window_state_.has_titlebar = true;
    saved_window_state_.is_resizable = true;
    is_fullscreen_ = false;

    printf("[VLC] Child window created successfully\n");
    fflush(stdout);
}

void VlcPlayer::DestroyChildWindowInternal() {
    if (!child_window_created_) {
        return;
    }

    printf("[VLC] Destroying child window: window=0x%lx\n", child_window_);
    fflush(stdout);

    if (display_ && child_window_) {
        XDestroyWindow(display_, child_window_);
        child_window_ = 0;
    }

    if (display_) {
        XCloseDisplay(display_);
        display_ = nullptr;
    }

    child_window_ = 0;
    child_window_created_ = false;
    is_fullscreen_ = false;
}

void VlcPlayer::SetWindowBounds(int x, int y, int width, int height) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    printf("[VLC] SetWindowBounds: x=%d, y=%d, w=%d, h=%d\n", x, y, width, height);
    fflush(stdout);

    XMoveResizeWindow(display_, child_window_, x, y,
                      static_cast<unsigned int>(width),
                      static_cast<unsigned int>(height));
    XFlush(display_);

    // Update saved state if not in fullscreen
    if (!is_fullscreen_) {
        saved_window_state_.x = x;
        saved_window_state_.y = y;
        saved_window_state_.width = width;
        saved_window_state_.height = height;
    }
}

void VlcPlayer::SetWindowFullscreen(bool fullscreen) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    printf("[VLC] SetWindowFullscreen: %s\n", fullscreen ? "true" : "false");
    fflush(stdout);

    Atom wm_state = XInternAtom(display_, "_NET_WM_STATE", False);
    Atom wm_fullscreen = XInternAtom(display_, "_NET_WM_STATE_FULLSCREEN", False);

    XEvent xev;
    memset(&xev, 0, sizeof(xev));
    xev.type = ClientMessage;
    xev.xclient.window = child_window_;
    xev.xclient.message_type = wm_state;
    xev.xclient.format = 32;
    xev.xclient.data.l[0] = fullscreen ? 1 : 0; // _NET_WM_STATE_ADD : _NET_WM_STATE_REMOVE
    xev.xclient.data.l[1] = wm_fullscreen;
    xev.xclient.data.l[2] = 0;

    XSendEvent(display_, DefaultRootWindow(display_), False,
               SubstructureRedirectMask | SubstructureNotifyMask, &xev);
    XFlush(display_);
}

void VlcPlayer::SetWindowOnTop(bool onTop) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    printf("[VLC] SetWindowOnTop: %s\n", onTop ? "true" : "false");
    fflush(stdout);

    Atom wm_state = XInternAtom(display_, "_NET_WM_STATE", False);
    Atom wm_above = XInternAtom(display_, "_NET_WM_STATE_ABOVE", False);

    XEvent xev;
    memset(&xev, 0, sizeof(xev));
    xev.type = ClientMessage;
    xev.xclient.window = child_window_;
    xev.xclient.message_type = wm_state;
    xev.xclient.format = 32;
    xev.xclient.data.l[0] = onTop ? 1 : 0;
    xev.xclient.data.l[1] = wm_above;
    xev.xclient.data.l[2] = 0;

    XSendEvent(display_, DefaultRootWindow(display_), False,
               SubstructureRedirectMask | SubstructureNotifyMask, &xev);
    XFlush(display_);
}

void VlcPlayer::SetWindowVisible(bool visible) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    printf("[VLC] SetWindowVisible: %s\n", visible ? "true" : "false");
    fflush(stdout);

    if (visible) {
        XMapWindow(display_, child_window_);
    } else {
        XUnmapWindow(display_, child_window_);
    }
    XFlush(display_);
}

void VlcPlayer::SetWindowStyle(bool border, bool titlebar, bool resizable) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    printf("[VLC] SetWindowStyle: border=%d, titlebar=%d, resizable=%d\n", border, titlebar, resizable);
    fflush(stdout);

    // Use Motif hints to control window decorations
    Atom motif_hints = XInternAtom(display_, "_MOTIF_WM_HINTS", False);

    struct {
        unsigned long flags;
        unsigned long functions;
        unsigned long decorations;
        long input_mode;
        unsigned long status;
    } hints;

    hints.flags = 2; // MWM_HINTS_DECORATIONS
    hints.functions = 0;
    hints.decorations = 0;
    hints.input_mode = 0;
    hints.status = 0;

    if (border || titlebar) {
        hints.decorations |= (1L << 1); // MWM_DECOR_BORDER
    }
    if (titlebar) {
        hints.decorations |= (1L << 3); // MWM_DECOR_TITLE
    }
    if (resizable) {
        hints.decorations |= (1L << 2); // MWM_DECOR_RESIZEH
    }

    XChangeProperty(display_, child_window_, motif_hints, motif_hints, 32,
                    PropModeReplace, (unsigned char*)&hints, 5);
    XFlush(display_);
}

void VlcPlayer::GetWindowBounds(WindowState* state) {
    if (!child_window_created_ || !display_ || !child_window_ || !state) return;

    XWindowAttributes wa;
    XGetWindowAttributes(display_, child_window_, &wa);

    state->x = wa.x;
    state->y = wa.y;
    state->width = wa.width;
    state->height = wa.height;

    // X11 doesn't provide easy way to query decorations, use saved state
    state->has_border = saved_window_state_.has_border;
    state->has_titlebar = saved_window_state_.has_titlebar;
    state->is_resizable = saved_window_state_.is_resizable;
}
