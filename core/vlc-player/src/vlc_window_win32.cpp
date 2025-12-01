#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>

// =================================================================================================
// Windows Constants
// =================================================================================================

// Window styles
constexpr DWORD WS_STANDARD = WS_OVERLAPPEDWINDOW | WS_VISIBLE;
constexpr DWORD WS_FULLSCREEN = WS_POPUP | WS_VISIBLE;

// =================================================================================================
// Windows Keyboard Hook
// =================================================================================================

// Helper function to convert Windows Virtual Key Code to JavaScript key code string
static std::string VKeyToKeyCode(WPARAM vkey) {
    // Map Windows VK codes to JavaScript KeyboardEvent.code format
    switch (vkey) {
        // Alphabet keys
        case 0x41: return "KeyA";
        case 0x42: return "KeyB";
        case 0x43: return "KeyC";
        case 0x44: return "KeyD";
        case 0x45: return "KeyE";
        case 0x46: return "KeyF";
        case 0x47: return "KeyG";
        case 0x48: return "KeyH";
        case 0x49: return "KeyI";
        case 0x4A: return "KeyJ";
        case 0x4B: return "KeyK";
        case 0x4C: return "KeyL";
        case 0x4D: return "KeyM";
        case 0x4E: return "KeyN";
        case 0x4F: return "KeyO";
        case 0x50: return "KeyP";
        case 0x51: return "KeyQ";
        case 0x52: return "KeyR";
        case 0x53: return "KeyS";
        case 0x54: return "KeyT";
        case 0x55: return "KeyU";
        case 0x56: return "KeyV";
        case 0x57: return "KeyW";
        case 0x58: return "KeyX";
        case 0x59: return "KeyY";
        case 0x5A: return "KeyZ";

        // Arrow keys
        case VK_LEFT: return "ArrowLeft";
        case VK_RIGHT: return "ArrowRight";
        case VK_UP: return "ArrowUp";
        case VK_DOWN: return "ArrowDown";

        // Special keys
        case VK_SPACE: return "Space";
        case VK_ESCAPE: return "Escape";
        case VK_RETURN: return "Enter";
        case VK_TAB: return "Tab";
        case VK_BACK: return "Backspace";

        // Function keys
        case VK_F1: return "F1";
        case VK_F2: return "F2";
        case VK_F3: return "F3";
        case VK_F4: return "F4";
        case VK_F5: return "F5";
        case VK_F6: return "F6";
        case VK_F7: return "F7";
        case VK_F8: return "F8";
        case VK_F9: return "F9";
        case VK_F10: return "F10";
        case VK_F11: return "F11";
        case VK_F12: return "F12";

        // Digit keys
        case 0x30: return "Digit0";
        case 0x31: return "Digit1";
        case 0x32: return "Digit2";
        case 0x33: return "Digit3";
        case 0x34: return "Digit4";
        case 0x35: return "Digit5";
        case 0x36: return "Digit6";
        case 0x37: return "Digit7";
        case 0x38: return "Digit8";
        case 0x39: return "Digit9";

        default: return "";
    }
}

// Window procedure for handling all events
static LRESULT CALLBACK VlcWindowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    // Retrieve the VlcPlayer instance from window user data
    VlcPlayer* player = reinterpret_cast<VlcPlayer*>(GetWindowLongPtr(hwnd, GWLP_USERDATA));

    switch (msg) {
        case WM_KEYDOWN: {
            std::string keyCode = VKeyToKeyCode(wParam);
            if (!keyCode.empty() && player) {
                player->ProcessKeyPress(keyCode);
            }
            return 0;
        }

        case WM_LBUTTONDOWN:
            if (player) {
                player->ProcessKeyPress("MouseLeft");
            }
            return 0;

        case WM_MBUTTONDOWN:
            if (player) {
                player->ProcessKeyPress("MouseMiddle");
            }
            return 0;

        case WM_RBUTTONDOWN: {
            if (player) {
                // Get cursor position in window coordinates
                POINT pt;
                pt.x = LOWORD(lParam);
                pt.y = HIWORD(lParam);

                // Convert to screen coordinates for TrackPopupMenu
                ClientToScreen(hwnd, &pt);

                // Show context menu at cursor position
                player->ShowContextMenu(pt.x, pt.y);
            }
            return 0;
        }

        case WM_MOUSEWHEEL: {
            int delta = GET_WHEEL_DELTA_WPARAM(wParam);
            if (player) {
                if (delta > 0) {
                    player->ProcessKeyPress("MouseWheelUp");
                } else if (delta < 0) {
                    player->ProcessKeyPress("MouseWheelDown");
                }
            }
            return 0;
        }

        case WM_CLOSE:
            // Close button clicked - emit stop but don't close window
            if (player) {
                player->EmitShortcut("stop");
            }
            return 0;

        case WM_SIZE: {
            if (player && wParam == SIZE_MINIMIZED) {
                // Window minimized - smart pause
                bool is_playing = libvlc_media_player_is_playing(player->media_player_);
                player->was_playing_before_minimize_ = is_playing;

                if (is_playing) {
                    libvlc_media_player_pause(player->media_player_);
                }
            } else if (player && wParam == SIZE_RESTORED) {
                // Window restored - smart resume
                if (player->was_playing_before_minimize_) {
                    libvlc_media_player_play(player->media_player_);
                    player->was_playing_before_minimize_ = false;
                }
            }
            break;
        }

        case WM_GETMINMAXINFO: {
            if (player && (player->min_width_ > 0 || player->min_height_ > 0)) {
                MINMAXINFO* mmi = (MINMAXINFO*)lParam;
                if (player->min_width_ > 0) {
                    mmi->ptMinTrackSize.x = player->min_width_;
                }
                if (player->min_height_ > 0) {
                    mmi->ptMinTrackSize.y = player->min_height_;
                }
                return 0;
            }
            break;
        }
    }

    // Default window procedure
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

// =================================================================================================
// Internal Window Management Methods
// =================================================================================================

// Windows message loop thread function
static void WindowMessageLoop(VlcPlayer* player) {
    MSG msg;
    while (player->window_thread_running_) {
        // Process all pending messages
        while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) {
                player->window_thread_running_ = false;
                return;
            }
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }

        // Sleep to avoid busy-waiting (16ms = ~60fps)
        Sleep(16);
    }
}

void VlcPlayer::CreateChildWindowInternal(int width, int height) {
    if (child_window_created_) {
        return;
    }

    // Start window thread - it will create the window and run message loop
    window_thread_running_ = true;
    window_thread_ = std::thread([this, width, height]() {
        // Register custom window class in this thread
        WNDCLASSEXW wc = {};
        wc.cbSize = sizeof(WNDCLASSEXW);
        wc.lpfnWndProc = VlcWindowProc;
        wc.hInstance = GetModuleHandle(NULL);
        wc.lpszClassName = L"VLCPlayerWindow";
        wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
        wc.hCursor = LoadCursor(NULL, IDC_ARROW);

        RegisterClassExW(&wc);

        // Create window in this thread
        child_hwnd_ = CreateWindowExW(
            WS_EX_APPWINDOW | WS_EX_WINDOWEDGE,
            L"VLCPlayerWindow",
            L"VLC Player",
            WS_STANDARD,
            CW_USEDEFAULT, CW_USEDEFAULT,
            width, height,
            NULL,
            NULL,
            GetModuleHandle(NULL),
            NULL
        );

        if (!child_hwnd_) {
            printf("[VLC] ERROR: Failed to create child window\n");
            fflush(stdout);
            window_thread_running_ = false;
            return;
        }

        // Store 'this' pointer for WndProc callback
        SetWindowLongPtr(child_hwnd_, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(this));

        libvlc_media_player_set_hwnd(media_player_, child_hwnd_);

        // Initialize window state
        RECT rect;
        GetWindowRect(child_hwnd_, &rect);
        saved_window_state_.x = rect.left;
        saved_window_state_.y = rect.top;
        saved_window_state_.width = rect.right - rect.left;
        saved_window_state_.height = rect.bottom - rect.top;
        saved_window_state_.has_border = true;
        saved_window_state_.has_titlebar = true;
        saved_window_state_.is_resizable = true;
        is_fullscreen_ = false;

        // Mark window as created before starting message loop
        child_window_created_ = true;

        printf("[VLC] Window created and message pump thread started\n");
        fflush(stdout);

        // Initialize OSD system
        InitializeOSD();

        printf("[VLC] OSD system initialized\n");
        fflush(stdout);

        // Run message loop in this same thread
        WindowMessageLoop(this);

        printf("[VLC] Window message pump thread exiting\n");
        fflush(stdout);
    });

    // Wait for window creation to complete
    while (!child_window_created_ && window_thread_running_) {
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }

    printf("[VLC] Window creation completed\n");
    fflush(stdout);
}

void VlcPlayer::DestroyChildWindowInternal() {
    if (!child_window_created_) {
        return;
    }

    // Stop message pump thread first
    if (window_thread_running_) {
        window_thread_running_ = false;

        // Post WM_QUIT to wake up the message loop
        if (child_hwnd_) {
            PostMessage(child_hwnd_, WM_QUIT, 0, 0);
        }

        // Wait for thread to finish
        if (window_thread_.joinable()) {
            window_thread_.join();
        }

        printf("[VLC] Window message pump thread stopped\n");
        fflush(stdout);
    }

    if (child_hwnd_) {
        DestroyWindow(child_hwnd_);
        child_hwnd_ = nullptr;
    }

    child_window_created_ = false;
    is_fullscreen_ = false;
}

void VlcPlayer::SetWindowBounds(int x, int y, int width, int height) {
    if (!child_window_created_ || !child_hwnd_) return;

    SetWindowPos(child_hwnd_, NULL, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);

    if (!is_fullscreen_) {
        saved_window_state_.x = x;
        saved_window_state_.y = y;
        saved_window_state_.width = width;
        saved_window_state_.height = height;
    }
}

void VlcPlayer::SetWindowFullscreen(bool fullscreen) {
    if (!child_window_created_ || !child_hwnd_) return;

    if (fullscreen) {
        HMONITOR monitor = MonitorFromWindow(child_hwnd_, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfo(monitor, &mi);

        SetWindowLongPtr(child_hwnd_, GWL_STYLE, WS_FULLSCREEN);
        SetWindowPos(
            child_hwnd_,
            HWND_TOP,
            mi.rcMonitor.left,
            mi.rcMonitor.top,
            mi.rcMonitor.right - mi.rcMonitor.left,
            mi.rcMonitor.bottom - mi.rcMonitor.top,
            SWP_FRAMECHANGED
        );
    } else {
        DWORD style = WS_STANDARD;
        if (!saved_window_state_.has_border) style &= ~WS_BORDER;
        if (!saved_window_state_.has_titlebar) style &= ~WS_CAPTION;
        if (!saved_window_state_.is_resizable) style &= ~WS_THICKFRAME;

        SetWindowLongPtr(child_hwnd_, GWL_STYLE, style);
        SetWindowPos(
            child_hwnd_,
            HWND_NOTOPMOST,
            saved_window_state_.x,
            saved_window_state_.y,
            saved_window_state_.width,
            saved_window_state_.height,
            SWP_FRAMECHANGED
        );
    }
}

void VlcPlayer::SetWindowOnTop(bool onTop) {
    if (!child_window_created_ || !child_hwnd_) return;

    SetWindowPos(
        child_hwnd_,
        onTop ? HWND_TOPMOST : HWND_NOTOPMOST,
        0, 0, 0, 0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
    );
}

void VlcPlayer::SetWindowVisible(bool visible) {
    if (!child_window_created_ || !child_hwnd_) return;

    ::ShowWindow(child_hwnd_, visible ? SW_SHOW : SW_HIDE);
}

void VlcPlayer::SetWindowStyle(bool border, bool titlebar, bool resizable, bool taskbar) {
    if (!child_window_created_ || !child_hwnd_) return;

    DWORD style = WS_POPUP | WS_VISIBLE;
    if (border) style |= WS_BORDER;
    if (titlebar) style |= WS_CAPTION | WS_SYSMENU;
    if (resizable) style |= WS_THICKFRAME | WS_MAXIMIZEBOX;

    SetWindowLongPtr(child_hwnd_, GWL_STYLE, style);

    // Control taskbar visibility
    DWORD exStyle = GetWindowLongPtr(child_hwnd_, GWL_EXSTYLE);
    if (!taskbar) {
        exStyle |= WS_EX_TOOLWINDOW;   // Hide from taskbar
        exStyle &= ~WS_EX_APPWINDOW;   // Remove from taskbar
    } else {
        exStyle &= ~WS_EX_TOOLWINDOW;  // Show in taskbar
        exStyle |= WS_EX_APPWINDOW;    // Add to taskbar
    }
    SetWindowLongPtr(child_hwnd_, GWL_EXSTYLE, exStyle);

    SetWindowPos(child_hwnd_, NULL, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
}

void VlcPlayer::SetWindowMinSizeInternal(int min_width, int min_height) {
    if (!child_window_created_ || !child_hwnd_) return;

    min_width_ = min_width;
    min_height_ = min_height;

    // WM_GETMINMAXINFO in WndProc will handle the actual constraint
}

void VlcPlayer::GetWindowBounds(WindowState* state) {
    if (!child_window_created_ || !child_hwnd_ || !state) return;

    RECT rect;
    GetWindowRect(child_hwnd_, &rect);

    state->x = rect.left;
    state->y = rect.top;
    state->width = rect.right - rect.left;
    state->height = rect.bottom - rect.top;

    LONG style = GetWindowLongPtr(child_hwnd_, GWL_STYLE);
    state->has_border = (style & WS_BORDER) != 0;
    state->has_titlebar = (style & WS_CAPTION) != 0;
    state->is_resizable = (style & WS_THICKFRAME) != 0;
}

#endif
