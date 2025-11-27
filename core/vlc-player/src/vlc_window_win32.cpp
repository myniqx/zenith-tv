#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>

// =================================================================================================
// Internal Window Management Methods
// =================================================================================================

void VlcPlayer::CreateChildWindowInternal(int width, int height) {
    if (child_window_created_) {
        return; // Already created
    }

    printf("[VLC] Creating child window: %dx%d\n", width, height);
    fflush(stdout);

    // For Windows, we create a standalone top-level window (not child of Electron)
    // This allows independent window management
    child_hwnd_ = CreateWindowExW(
        WS_EX_APPWINDOW | WS_EX_WINDOWEDGE,
        L"STATIC",
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
        SetClassLongPtr(child_hwnd_, GCLP_HBRBACKGROUND, (LONG_PTR)GetStockObject(BLACK_BRUSH));
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

void VlcPlayer::SetWindowStyle(bool border, bool titlebar, bool resizable) {
    if (!child_window_created_ || !child_hwnd_) return;

    printf("[VLC] SetWindowStyle: border=%d, titlebar=%d, resizable=%d\n", border, titlebar, resizable);
    fflush(stdout);

    DWORD style = WS_POPUP | WS_VISIBLE;
    if (border) style |= WS_BORDER;
    if (titlebar) style |= WS_CAPTION | WS_SYSMENU;
    if (resizable) style |= WS_THICKFRAME | WS_MAXIMIZEBOX;

    SetWindowLongPtr(child_hwnd_, GWL_STYLE, style);
    SetWindowPos(child_hwnd_, NULL, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED);
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
