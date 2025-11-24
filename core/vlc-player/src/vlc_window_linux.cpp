#include "vlc_player.h"
#include <X11/Xlib.h>
#include <X11/Xutil.h>

Napi::Value VlcPlayer::CreateChildWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    // Get dimensions from arguments
    int width = 800;
    int height = 600;

    if (info.Length() >= 5) {
        width = info[3].As<Napi::Number>().Int32Value();
        height = info[4].As<Napi::Number>().Int32Value();
    }

    if (width <= 0 || height <= 0) {
        width = MIN_WINDOW_SIZE;
        height = MIN_WINDOW_SIZE;
    }

    // Connect to X11 display
    const char* display_name = getenv("DISPLAY");
    printf("[VLC] CALL: XOpenDisplay(display='%s')\n", display_name ? display_name : ":0");
    display_ = XOpenDisplay(display_name);
    printf("[VLC] RETURN: display=%p\n", (void*)display_);
    fflush(stdout);

    if (!display_) {
        Napi::Error::New(env, "XOpenDisplay failed").ThrowAsJavaScriptException();
        return env.Null();
    }

    int screen = DefaultScreen(display_);
    Window root = RootWindow(display_, screen);
    Visual* visual = DefaultVisual(display_, screen);
    Colormap cmap = DefaultColormap(display_, screen);

    // Create standalone window (not a child of Electron)
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
        Napi::Error::New(env, "XCreateWindow failed").ThrowAsJavaScriptException();
        XCloseDisplay(display_);
        display_ = nullptr;
        return env.Null();
    }

    XStoreName(display_, child_window_, "VLC Player Test Window");

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
    printf("[VLC] CALL: XSync(discard=False)\n");
    XSync(display_, False);  // Wait for window to be actually mapped
    printf("[VLC] RETURN: XSync completed\n");
    XFlush(display_);
    fflush(stdout);

    XWindowAttributes wa;
    XGetWindowAttributes(display_, child_window_, &wa);
    printf("[VLC] Window state: map_state=%d, geometry=%dx%d+%d+%d\n",
           wa.map_state, wa.width, wa.height, wa.x, wa.y);
    fflush(stdout);

    child_window_created_ = true;

    // Do NOT set XWindow here - media not yet set!
    // XWindow will be bound in SetMedia() after media is created

    return Napi::Boolean::New(env, true);
}

Napi::Value VlcPlayer::DestroyChildWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        return Napi::Boolean::New(env, true);
    }

    if (display_ && child_window_) {
        printf("[VLC] CALL: XDestroyWindow(window=0x%lx)\n", child_window_);
        XDestroyWindow(display_, child_window_);
        fflush(stdout);
        child_window_ = 0;
    }

    if (display_) {
        printf("[VLC] CALL: XCloseDisplay()\n");
        XCloseDisplay(display_);
        fflush(stdout);
        display_ = nullptr;
    }

    child_window_ = 0;
    child_window_created_ = false;

    return Napi::Boolean::New(env, true);
}

Napi::Value VlcPlayer::SetBounds(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 4) {
        Napi::TypeError::New(env, "Expected: x, y, width, height").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    int x = info[0].As<Napi::Number>().Int32Value();
    int y = info[1].As<Napi::Number>().Int32Value();
    int width = info[2].As<Napi::Number>().Int32Value();
    int height = info[3].As<Napi::Number>().Int32Value();

    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        return Napi::Boolean::New(env, false);
    }

    if (display_ && child_window_) {
        printf("[VLC] CALL: XMoveResizeWindow(window=0x%lx, x=%d, y=%d, w=%d, h=%d)\n",
               child_window_, x, y, width, height);
        XMoveResizeWindow(display_, child_window_, x, y,
                          static_cast<unsigned int>(width),
                          static_cast<unsigned int>(height));
        XFlush(display_);
        fflush(stdout);
        return Napi::Boolean::New(env, true);
    }

    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::ShowWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        return Napi::Boolean::New(env, false);
    }

    if (display_ && child_window_) {
        printf("[VLC] CALL: XMapWindow(window=0x%lx)\n", child_window_);
        XMapWindow(display_, child_window_);
        XFlush(display_);
        fflush(stdout);
        return Napi::Boolean::New(env, true);
    }

    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::HideWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        return Napi::Boolean::New(env, false);
    }

    if (display_ && child_window_) {
        printf("[VLC] CALL: XUnmapWindow(window=0x%lx)\n", child_window_);
        XUnmapWindow(display_, child_window_);
        XFlush(display_);
        fflush(stdout);
        return Napi::Boolean::New(env, true);
    }

    return Napi::Boolean::New(env, false);
}
