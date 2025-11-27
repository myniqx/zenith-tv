#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>

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

// Window procedure for handling keyboard events
static LRESULT CALLBACK VlcWindowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    // Retrieve the VlcPlayer instance from window user data
    VlcPlayer* player = reinterpret_cast<VlcPlayer*>(GetWindowLongPtr(hwnd, GWLP_USERDATA));

    if (msg == WM_KEYDOWN) {
        std::string keyCode = VKeyToKeyCode(wParam);
        if (!keyCode.empty() && player) {
            printf("[VLC] Win32 WM_KEYDOWN: VKey=0x%02llX, Code=%s\n", wParam, keyCode.c_str());
            fflush(stdout);
            player->ProcessKeyPress(keyCode);
        }
        return 0;
    }

    // Default window procedure
    return DefWindowProc(hwnd, msg, wParam, lParam);
}

// =================================================================================================
// Internal Window Management Methods
// =================================================================================================

void VlcPlayer::CreateChildWindowInternal(int width, int height) {
    if (child_window_created_) {
        return; // Already created
    }

    printf("[VLC] Creating child window: %dx%d\n", width, height);
    fflush(stdout);

    // Register custom window class with keyboard handling
    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(WNDCLASSEXW);
    wc.lpfnWndProc = VlcWindowProc;
    wc.hInstance = GetModuleHandle(NULL);
    wc.lpszClassName = L"VLCPlayerWindow";
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);

    // Register class (ignore error if already registered)
    RegisterClassExW(&wc);

    // For Windows, we create a standalone top-level window (not child of Electron)
    // This allows independent window management
    child_hwnd_ = CreateWindowExW(
        WS_EX_APPWINDOW | WS_EX_WINDOWEDGE,
        L"VLCPlayerWindow",  // Use our custom class
        L"VLC Player",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        CW_USEDEFAULT, CW_USEDEFAULT,
        width, height,
        NULL,  // No parent (standalone)
        NULL,
        GetModuleHandle(NULL),
        NULL
    );

    if (child_hwnd_) {
        // Store 'this' pointer in window user data for WndProc callback
        SetWindowLongPtr(child_hwnd_, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(this));

        libvlc_media_player_set_hwnd(media_player_, child_hwnd_);
        child_window_created_ = true;

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

        printf("[VLC] Child window created: hwnd=%p\n", child_hwnd_);
        fflush(stdout);
    } else {
        printf("[VLC] ERROR: Failed to create child window\n");
        fflush(stdout);
    }
}

void VlcPlayer::DestroyChildWindowInternal() {
    if (!child_window_created_) {
        return;
    }

    printf("[VLC] Destroying child window: hwnd=%p\n", child_hwnd_);
    fflush(stdout);

    if (child_hwnd_) {
        DestroyWindow(child_hwnd_);
        child_hwnd_ = nullptr;
    }

    child_window_created_ = false;
    is_fullscreen_ = false;
}

void VlcPlayer::SetWindowBounds(int x, int y, int width, int height) {
    if (!child_window_created_ || !child_hwnd_) return;

    printf("[VLC] SetWindowBounds: x=%d, y=%d, w=%d, h=%d\n", x, y, width, height);
    fflush(stdout);

    SetWindowPos(child_hwnd_, NULL, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);

    // Update saved state if not in fullscreen
    if (!is_fullscreen_) {
        saved_window_state_.x = x;
        saved_window_state_.y = y;
        saved_window_state_.width = width;
        saved_window_state_.height = height;
    }
}

void VlcPlayer::SetWindowFullscreen(bool fullscreen) {
    if (!child_window_created_ || !child_hwnd_) return;

    printf("[VLC] SetWindowFullscreen: %s\n", fullscreen ? "true" : "false");
    fflush(stdout);

    if (fullscreen) {
        // Get monitor info for fullscreen
        HMONITOR monitor = MonitorFromWindow(child_hwnd_, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfo(monitor, &mi);

        // Remove window decorations and maximize
        SetWindowLongPtr(child_hwnd_, GWL_STYLE, WS_POPUP | WS_VISIBLE);
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
        // Restore window decorations
        DWORD style = WS_OVERLAPPEDWINDOW | WS_VISIBLE;
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

    printf("[VLC] SetWindowOnTop: %s\n", onTop ? "true" : "false");
    fflush(stdout);

    SetWindowPos(
        child_hwnd_,
        onTop ? HWND_TOPMOST : HWND_NOTOPMOST,
        0, 0, 0, 0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
    );
}

void VlcPlayer::SetWindowVisible(bool visible) {
    if (!child_window_created_ || !child_hwnd_) return;

    printf("[VLC] SetWindowVisible: %s\n", visible ? "true" : "false");
    fflush(stdout);

    ::ShowWindow(child_hwnd_, visible ? SW_SHOW : SW_HIDE);
}

void VlcPlayer::SetWindowStyle(bool border, bool titlebar, bool resizable, bool taskbar) {
    if (!child_window_created_ || !child_hwnd_) return;

    printf("[VLC] SetWindowStyle: border=%d, titlebar=%d, resizable=%d, taskbar=%d\n", border, titlebar, resizable, taskbar);
    fflush(stdout);

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

    printf("[VLC] SetWindowMinSizeInternal: min_width=%d, min_height=%d\n", min_width, min_height);
    fflush(stdout);

    // Note: Windows doesn't have a direct API for min/max size.
    // This would need to be enforced in WM_GETMINMAXINFO message handler.
    // For now, we just log it. Full implementation would require window procedure changes.
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
