#include "vlc_player.h"
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xatom.h>
#include <X11/keysym.h>
#include <thread>
#include <vector>

// =================================================================================================
// X11 Constants
// =================================================================================================

// Motif Window Manager Hints
constexpr unsigned long MWM_HINTS_DECORATIONS = 2;
constexpr unsigned long MWM_DECOR_BORDER = (1L << 1);
constexpr unsigned long MWM_DECOR_RESIZEH = (1L << 2);
constexpr unsigned long MWM_DECOR_TITLE = (1L << 3);

// Window Manager States
constexpr long WM_STATE_NORMAL = 1;
constexpr long WM_STATE_ICONIC = 3;

// _NET_WM_STATE actions
constexpr long NET_WM_STATE_REMOVE = 0;
constexpr long NET_WM_STATE_ADD = 1;

// =================================================================================================
// Internal Window Management Methods
// =================================================================================================

void VlcPlayer::CreateChildWindowInternal(int width, int height) {
    if (child_window_created_) {
        return; // Already created
    }

    // Connect to X11 display
    const char* display_name = getenv("DISPLAY");
    display_ = XOpenDisplay(display_name);

    if (!display_) {
        printf("[VLC] ERROR: XOpenDisplay failed\n");
        fflush(stdout);
        return;
    }

    int screen = DefaultScreen(display_);
    ::Window root = RootWindow(display_, screen);
    Visual* visual = DefaultVisual(display_, screen);
    Colormap cmap = DefaultColormap(display_, screen);

    // Create standalone window
    XSetWindowAttributes attrs;
    attrs.colormap = cmap;
    attrs.background_pixel = BlackPixel(display_, screen);
    attrs.border_pixel = WhitePixel(display_, screen);
    attrs.event_mask = ExposureMask | StructureNotifyMask | KeyPressMask |
                       ButtonPressMask | ButtonReleaseMask | PropertyChangeMask;

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

    // Cache frequently used atoms
    wm_delete_window_atom_ = XInternAtom(display_, "WM_DELETE_WINDOW", False);
    wm_state_atom_ = XInternAtom(display_, "_NET_WM_STATE", False);
    wm_state_fullscreen_atom_ = XInternAtom(display_, "_NET_WM_STATE_FULLSCREEN", False);
    wm_state_above_atom_ = XInternAtom(display_, "_NET_WM_STATE_ABOVE", False);
    wm_state_skip_taskbar_atom_ = XInternAtom(display_, "_NET_WM_STATE_SKIP_TASKBAR", False);
    motif_hints_atom_ = XInternAtom(display_, "_MOTIF_WM_HINTS", False);

    XSetWMProtocols(display_, child_window_, &wm_delete_window_atom_, 1);

    XMapWindow(display_, child_window_);
    XRaiseWindow(display_, child_window_);
    XSync(display_, False);
    XFlush(display_);

    // Set VLC to render on this window
    if (child_window_ <= UINT32_MAX) {
        libvlc_media_player_set_xwindow(media_player_, static_cast<uint32_t>(child_window_));
    }

    child_window_created_ = true;

    // Start event loop for keyboard shortcuts
    StartEventLoop();

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
}

void VlcPlayer::DestroyChildWindowInternal() {
    if (!child_window_created_) {
        return;
    }

    // Stop event loop before destroying window
    StopEventLoop();

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

// Helper function to send window state messages
void VlcPlayer::SendWindowStateMessage(Atom state_atom, bool enable) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    XEvent xev;
    memset(&xev, 0, sizeof(xev));
    xev.type = ClientMessage;
    xev.xclient.window = child_window_;
    xev.xclient.message_type = wm_state_atom_;
    xev.xclient.format = 32;
    xev.xclient.data.l[0] = enable ? NET_WM_STATE_ADD : NET_WM_STATE_REMOVE;
    xev.xclient.data.l[1] = state_atom;
    xev.xclient.data.l[2] = 0;

    XSendEvent(display_, DefaultRootWindow(display_), False,
               SubstructureRedirectMask | SubstructureNotifyMask, &xev);
    XFlush(display_);
}

void VlcPlayer::SetWindowFullscreen(bool fullscreen) {
    SendWindowStateMessage(wm_state_fullscreen_atom_, fullscreen);
}

void VlcPlayer::SetWindowOnTop(bool onTop) {
    SendWindowStateMessage(wm_state_above_atom_, onTop);
}

void VlcPlayer::SetWindowVisible(bool visible) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    if (visible) {
        XMapWindow(display_, child_window_);
    } else {
        XUnmapWindow(display_, child_window_);
    }
    XFlush(display_);
}

void VlcPlayer::SetWindowStyle(bool border, bool titlebar, bool resizable, bool taskbar) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    // Use Motif hints to control window decorations
    struct {
        unsigned long flags;
        unsigned long functions;
        unsigned long decorations;
        long input_mode;
        unsigned long status;
    } hints;

    hints.flags = MWM_HINTS_DECORATIONS;
    hints.functions = 0;
    hints.decorations = 0;
    hints.input_mode = 0;
    hints.status = 0;

    if (border || titlebar) {
        hints.decorations |= MWM_DECOR_BORDER;
    }
    if (titlebar) {
        hints.decorations |= MWM_DECOR_TITLE;
    }
    if (resizable) {
        hints.decorations |= MWM_DECOR_RESIZEH;
    }

    XChangeProperty(display_, child_window_, motif_hints_atom_, motif_hints_atom_, 32,
                    PropModeReplace, (unsigned char*)&hints, 5);

    // Control taskbar visibility
    if (!taskbar) {
        XChangeProperty(display_, child_window_, wm_state_atom_, XA_ATOM, 32,
                       PropModeAppend, (unsigned char*)&wm_state_skip_taskbar_atom_, 1);
    } else {
        // Remove skip taskbar hint
        Atom* atoms = nullptr;
        Atom actual_type;
        int actual_format;
        unsigned long nitems, bytes_after;

        if (XGetWindowProperty(display_, child_window_, wm_state_atom_, 0, 1024, False,
                              XA_ATOM, &actual_type, &actual_format, &nitems,
                              &bytes_after, (unsigned char**)&atoms) == Success) {
            if (atoms) {
                // Filter out skip_taskbar using std::vector (avoid VLA)
                std::vector<Atom> new_atoms;
                new_atoms.reserve(nitems);

                for (unsigned long i = 0; i < nitems; i++) {
                    if (atoms[i] != wm_state_skip_taskbar_atom_) {
                        new_atoms.push_back(atoms[i]);
                    }
                }

                XChangeProperty(display_, child_window_, wm_state_atom_, XA_ATOM, 32,
                               PropModeReplace, (unsigned char*)new_atoms.data(),
                               new_atoms.size());
                XFree(atoms);
            }
        }
    }

    XFlush(display_);
}

void VlcPlayer::SetWindowMinSizeInternal(int min_width, int min_height) {
    if (!child_window_created_ || !display_ || !child_window_) return;

    XSizeHints* size_hints = XAllocSizeHints();
    if (size_hints) {
        if (min_width > 0 || min_height > 0) {
            size_hints->flags = PMinSize;
            size_hints->min_width = min_width > 0 ? min_width : 1;
            size_hints->min_height = min_height > 0 ? min_height : 1;
        } else {
            // Remove minimum size constraints
            size_hints->flags = 0;
        }
        XSetWMNormalHints(display_, child_window_, size_hints);
        XFree(size_hints);
    }
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

// =================================================================================================
// X11 Event Loop for Keyboard Shortcuts
// =================================================================================================

// Helper function to convert X11 KeySym to JavaScript key code string
static std::string KeySymToKeyCode(KeySym keysym) {
    // Map X11 KeySym to JavaScript KeyboardEvent.code format
    switch (keysym) {
        // Alphabet keys
        case XK_a: case XK_A: return "KeyA";
        case XK_b: case XK_B: return "KeyB";
        case XK_c: case XK_C: return "KeyC";
        case XK_d: case XK_D: return "KeyD";
        case XK_e: case XK_E: return "KeyE";
        case XK_f: case XK_F: return "KeyF";
        case XK_g: case XK_G: return "KeyG";
        case XK_h: case XK_H: return "KeyH";
        case XK_i: case XK_I: return "KeyI";
        case XK_j: case XK_J: return "KeyJ";
        case XK_k: case XK_K: return "KeyK";
        case XK_l: case XK_L: return "KeyL";
        case XK_m: case XK_M: return "KeyM";
        case XK_n: case XK_N: return "KeyN";
        case XK_o: case XK_O: return "KeyO";
        case XK_p: case XK_P: return "KeyP";
        case XK_q: case XK_Q: return "KeyQ";
        case XK_r: case XK_R: return "KeyR";
        case XK_s: case XK_S: return "KeyS";
        case XK_t: case XK_T: return "KeyT";
        case XK_u: case XK_U: return "KeyU";
        case XK_v: case XK_V: return "KeyV";
        case XK_w: case XK_W: return "KeyW";
        case XK_x: case XK_X: return "KeyX";
        case XK_y: case XK_Y: return "KeyY";
        case XK_z: case XK_Z: return "KeyZ";

        // Arrow keys
        case XK_Left: return "ArrowLeft";
        case XK_Right: return "ArrowRight";
        case XK_Up: return "ArrowUp";
        case XK_Down: return "ArrowDown";

        // Special keys
        case XK_space: return "Space";
        case XK_Escape: return "Escape";
        case XK_Return: return "Enter";
        case XK_Tab: return "Tab";
        case XK_BackSpace: return "Backspace";

        // Function keys
        case XK_F1: return "F1";
        case XK_F2: return "F2";
        case XK_F3: return "F3";
        case XK_F4: return "F4";
        case XK_F5: return "F5";
        case XK_F6: return "F6";
        case XK_F7: return "F7";
        case XK_F8: return "F8";
        case XK_F9: return "F9";
        case XK_F10: return "F10";
        case XK_F11: return "F11";
        case XK_F12: return "F12";

        // Digit keys
        case XK_0: return "Digit0";
        case XK_1: return "Digit1";
        case XK_2: return "Digit2";
        case XK_3: return "Digit3";
        case XK_4: return "Digit4";
        case XK_5: return "Digit5";
        case XK_6: return "Digit6";
        case XK_7: return "Digit7";
        case XK_8: return "Digit8";
        case XK_9: return "Digit9";

        default: return "";
    }
}

void VlcPlayer::StartEventLoop() {
    if (event_loop_running_) return;
    event_loop_running_ = true;

    std::thread([this]() {
        XEvent event;
        Atom wm_state_property = XInternAtom(display_, "WM_STATE", False);

        while (event_loop_running_ && display_ && child_window_) {
            if (XPending(display_) > 0) {
                XNextEvent(display_, &event);

                if (event.type == KeyPress) {
                    KeySym keysym = XLookupKeysym(&event.xkey, 0);
                    std::string keyCode = KeySymToKeyCode(keysym);

                    if (!keyCode.empty()) {
                        ProcessKeyPress(keyCode);
                    }
                } else if (event.type == ButtonPress) {
                    if (event.xbutton.button == 1) {
                        ProcessKeyPress("MouseLeft");
                    } else if (event.xbutton.button == 2) {
                        ProcessKeyPress("MouseMiddle");
                    } else if (event.xbutton.button == 3) {
                        ShowContextMenu(event.xbutton.x_root, event.xbutton.y_root);
                    } else if (event.xbutton.button == 4) {
                        ProcessKeyPress("MouseWheelUp");
                    } else if (event.xbutton.button == 5) {
                        ProcessKeyPress("MouseWheelDown");
                    }
                } else if (event.type == ClientMessage) {
                    if (event.xclient.data.l[0] == (long)wm_delete_window_atom_) {
                        EmitShortcut("stop");
                    }
                } else if (event.type == PropertyNotify) {
                    // Check for window state changes (minimize/restore)
                    if (event.xproperty.atom == wm_state_property) {
                        Atom actual_type;
                        int actual_format;
                        unsigned long nitems, bytes_after;
                        unsigned char* prop_data = nullptr;

                        if (XGetWindowProperty(display_, child_window_, wm_state_property, 0, 2, False,
                                              wm_state_property, &actual_type, &actual_format, &nitems,
                                              &bytes_after, &prop_data) == Success) {
                            if (prop_data) {
                                long state = *(long*)prop_data;

                                if (state == WM_STATE_ICONIC) {
                                    bool is_playing = libvlc_media_player_is_playing(media_player_);
                                    was_playing_before_minimize_ = is_playing;

                                    if (is_playing) {
                                        libvlc_media_player_pause(media_player_);
                                    }
                                } else if (state == WM_STATE_NORMAL) {
                                    if (was_playing_before_minimize_) {
                                        libvlc_media_player_play(media_player_);
                                        was_playing_before_minimize_ = false;
                                    }
                                }

                                XFree(prop_data);
                            }
                        }
                    }
                }
            } else {
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
            }
        }
    }).detach();
}

void VlcPlayer::StopEventLoop() {
    event_loop_running_ = false;
}
