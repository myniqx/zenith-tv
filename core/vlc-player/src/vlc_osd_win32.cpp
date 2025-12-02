#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>
#include <wingdi.h>
#include <algorithm>
#include <cmath>

// =================================================================================================
// OSD Windows (GDI) Platform-Specific Implementation
// =================================================================================================

/**
 * Set Windows window opacity for fade animations using layered window attributes
 */
void VlcPlayer::SetOSDWindowOpacity(HWND window, float opacity) {
    if (!window) return;

    // Clamp opacity to valid range
    opacity = std::clamp(opacity, 0.0f, 1.0f);

    // Convert to 0-255 range for Windows alpha
    BYTE alpha = static_cast<BYTE>(opacity * 255);

    // Set layered window attribute with alpha transparency
    SetLayeredWindowAttributes(window, 0, alpha, LWA_ALPHA);
}

/**
 * Draw text on device context
 */
void VlcPlayer::DrawText(HWND window, HDC hdc, const std::string& text,
                         int x, int y, COLORREF color, HFONT font) {
    if (!hdc || text.empty()) return;

    // Select font if provided
    HFONT oldFont = NULL;
    if (font) {
        oldFont = (HFONT)SelectObject(hdc, font);
    }

    // Set text color and background mode
    SetTextColor(hdc, color);
    SetBkMode(hdc, TRANSPARENT);

    // Draw text (convert std::string to wide string for Unicode support)
    int len = MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, NULL, 0);
    if (len > 0) {
        wchar_t* wtext = new wchar_t[len];
        MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, wtext, len);
        TextOutW(hdc, x, y, wtext, len - 1);
        delete[] wtext;
    }

    // Restore old font
    if (oldFont) {
        SelectObject(hdc, oldFont);
    }
}

/**
 * Draw progress bar on device context
 */
void VlcPlayer::DrawProgressBar(HWND window, HDC hdc, int x, int y,
                                int width, int height, float progress,
                                COLORREF fg_color, COLORREF bg_color) {
    if (!hdc) return;

    progress = std::clamp(progress, 0.0f, 1.0f);

    // Draw background (unfilled portion)
    HBRUSH bgBrush = CreateSolidBrush(bg_color);
    RECT bgRect = { x, y, x + width, y + height };
    FillRect(hdc, &bgRect, bgBrush);
    DeleteObject(bgBrush);

    // Draw foreground (filled portion)
    if (progress > 0.0f) {
        HBRUSH fgBrush = CreateSolidBrush(fg_color);
        int filled_width = static_cast<int>(width * progress);
        RECT fgRect = { x, y, x + filled_width, y + height };
        FillRect(hdc, &fgRect, fgBrush);
        DeleteObject(fgBrush);
    }
}

/**
 * Draw rounded rectangle
 */
void VlcPlayer::DrawRoundedRect(HWND window, HDC hdc, int x, int y,
                                int width, int height, COLORREF color, int radius) {
    if (!hdc) return;

    // Create brush and pen
    HBRUSH brush = CreateSolidBrush(color);
    HPEN pen = CreatePen(PS_SOLID, 1, color);

    HBRUSH oldBrush = (HBRUSH)SelectObject(hdc, brush);
    HPEN oldPen = (HPEN)SelectObject(hdc, pen);

    // Draw rounded rectangle
    RoundRect(hdc, x, y, x + width, y + height, radius * 2, radius * 2);

    // Restore and cleanup
    SelectObject(hdc, oldBrush);
    SelectObject(hdc, oldPen);
    DeleteObject(brush);
    DeleteObject(pen);
}

/**
 * Draw icon using simple geometric shapes
 */
void VlcPlayer::DrawIcon(HWND window, HDC hdc, const std::string& icon_name,
                         int x, int y, int size, COLORREF color) {
    if (!hdc) return;

    // Create brush and pen for drawing
    HBRUSH brush = CreateSolidBrush(color);
    HPEN pen = CreatePen(PS_SOLID, 2, color);

    HBRUSH oldBrush = (HBRUSH)SelectObject(hdc, brush);
    HPEN oldPen = (HPEN)SelectObject(hdc, pen);

    if (icon_name == "play") {
        // Triangle pointing right
        POINT points[3];
        points[0] = { x, y };
        points[1] = { x + size, y + size / 2 };
        points[2] = { x, y + size };
        Polygon(hdc, points, 3);
    }
    else if (icon_name == "pause") {
        // Two vertical bars
        int bar_width = size / 3;
        RECT bar1 = { x, y, x + bar_width, y + size };
        RECT bar2 = { x + size - bar_width, y, x + size, y + size };
        FillRect(hdc, &bar1, brush);
        FillRect(hdc, &bar2, brush);
    }
    else if (icon_name == "stop") {
        // Square
        RECT square = { x, y, x + size, y + size };
        FillRect(hdc, &square, brush);
    }
    else if (icon_name == "volume_up" || icon_name == "volume_down") {
        // Speaker icon (simplified trapezoid)
        POINT points[4];
        points[0] = { x, y + size / 3 };
        points[1] = { x + size / 2, y };
        points[2] = { x + size / 2, y + size };
        points[3] = { x, y + 2 * size / 3 };
        Polygon(hdc, points, 4);

        // Add sound waves for volume_up
        if (icon_name == "volume_up") {
            Arc(hdc, x + size / 2, y + size / 4, x + size, y + 3 * size / 4,
                x + size / 2, y + size / 2, x + size / 2, y + size / 2);
        }
    }
    else if (icon_name == "volume_mute") {
        // Speaker with X
        POINT points[4];
        points[0] = { x, y + size / 3 };
        points[1] = { x + size / 2, y };
        points[2] = { x + size / 2, y + size };
        points[3] = { x, y + 2 * size / 3 };
        Polygon(hdc, points, 4);

        // Draw X over it
        MoveToEx(hdc, x + size / 2, y, NULL);
        LineTo(hdc, x + size, y + size);
        MoveToEx(hdc, x + size, y, NULL);
        LineTo(hdc, x + size / 2, y + size);
    }

    // Restore and cleanup
    SelectObject(hdc, oldBrush);
    SelectObject(hdc, oldPen);
    DeleteObject(brush);
    DeleteObject(pen);
}

/**
 * Create OSD window at specified position
 */
void VlcPlayer::CreateOSDWindow(std::shared_ptr<OSDElement> osd, int x, int y) {
    if (!child_hwnd_) return;

    // Use centralized size logic
    GetOSDSize(osd->type, osd->width, osd->height);

    // Create layered window with transparency support
    HWND hwnd = CreateWindowExW(
        WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
        L"STATIC",
        L"",
        WS_POPUP,
        x, y, osd->width, osd->height,
        NULL,  // No parent - toplevel window
        NULL,
        GetModuleHandle(NULL),
        NULL
    );

    if (!hwnd) {
        printf("[VLC OSD] ERROR: Failed to create OSD window (error: %lu)\n", GetLastError());
        fflush(stdout);
        return;
    }

    osd->window = hwnd;

    // Create memory DC for double buffering with proper color depth
    HDC screenDC = GetDC(NULL);  // Get screen DC instead of window DC
    osd->memDC = CreateCompatibleDC(screenDC);

    // Create a DIB section for proper 32-bit color
    BITMAPINFO bmi = {};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = osd->width;
    bmi.bmiHeader.biHeight = -osd->height;  // Negative for top-down DIB
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;  // 32-bit color
    bmi.bmiHeader.biCompression = BI_RGB;

    void* pBits = nullptr;
    osd->memBitmap = CreateDIBSection(screenDC, &bmi, DIB_RGB_COLORS, &pBits, NULL, 0);
    osd->oldBitmap = (HBITMAP)SelectObject(osd->memDC, osd->memBitmap);

    ReleaseDC(NULL, screenDC);

    // Initially invisible (will fade in)
    SetOSDWindowOpacity(hwnd, 0.0f);

    // Show window
    ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    UpdateWindow(hwnd);

    printf("[VLC OSD] Created window: type=%d, pos=(%d,%d), size=(%dx%d), hwnd=%p\n",
           static_cast<int>(osd->type), x, y, osd->width, osd->height, hwnd);
    fflush(stdout);
}

/**
 * Destroy OSD window and cleanup resources
 */
void VlcPlayer::DestroyOSDWindow(std::shared_ptr<OSDElement> osd) {
    if (!osd) return;

    // Cleanup memory DC resources
    if (osd->memDC) {
        if (osd->oldBitmap) {
            SelectObject(osd->memDC, osd->oldBitmap);
            osd->oldBitmap = NULL;
        }
        if (osd->memBitmap) {
            DeleteObject(osd->memBitmap);
            osd->memBitmap = NULL;
        }
        DeleteDC(osd->memDC);
        osd->memDC = NULL;
    }

    // Destroy window
    if (osd->window) {
        DestroyWindow(osd->window);
        osd->window = NULL;
    }
}

/**
 * Render OSD based on type
 */
void VlcPlayer::RenderOSD(std::shared_ptr<OSDElement> osd) {
    if (!osd || !child_hwnd_) return;

    // Get VLC player window client area (excludes title bar and borders)
    RECT clientRect;
    if (!GetClientRect(child_hwnd_, &clientRect)) {
        return;
    }

    // Convert client rect to screen coordinates
    POINT topLeft = { clientRect.left, clientRect.top };
    POINT bottomRight = { clientRect.right, clientRect.bottom };
    ClientToScreen(child_hwnd_, &topLeft);
    ClientToScreen(child_hwnd_, &bottomRight);

    int player_x = topLeft.x;
    int player_y = topLeft.y;
    int player_width = bottomRight.x - topLeft.x;
    int player_height = bottomRight.y - topLeft.y;

    // Ensure OSD size is set
    GetOSDSize(osd->type, osd->width, osd->height);
    int osd_width = osd->width;
    int osd_height = osd->height;

    // Calculate position relative to player window
    int x = 0, y = 0;
    switch (osd->position) {
        case OSDPosition::TOP_LEFT:
            x = player_x + 20;
            y = player_y + 20;
            break;

        case OSDPosition::TOP_RIGHT:
            x = player_x + player_width - osd_width - 20;
            y = player_y + 20 + (osd->slot_index * 60);  // Stack vertically
            break;

        case OSDPosition::BOTTOM_CENTER:
            x = player_x + (player_width / 2) - (osd_width / 2);
            y = player_y + player_height - 120;
            break;

        case OSDPosition::CENTER:
            x = player_x + (player_width / 2) - (osd_width / 2);
            y = player_y + (player_height / 2) - (osd_height / 2);
            break;
    }

    // Create window if not yet created
    if (!osd->window) {
        CreateOSDWindow(osd, x, y);
    } else {
        // Update position (follow the player window)
        SetWindowPos(osd->window, HWND_TOPMOST, x, y, 0, 0,
                     SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
    }

    if (!osd->memDC) return;

    // Clear back buffer (fill with background color)
    HBRUSH bgBrush = CreateSolidBrush(osd_colors_win32_[0]);  // background
    RECT clearRect = { 0, 0, osd->width, osd->height };
    FillRect(osd->memDC, &clearRect, bgBrush);
    DeleteObject(bgBrush);

    // Render based on OSD type
    switch (osd->type) {
        case OSDType::VOLUME: {
            // Draw icon (left side, 20px from edge)
            std::string icon = (osd->progress == 0.0f) ? "volume_mute" : "volume_up";
            DrawIcon(osd->window, osd->memDC, icon, 15, 10, 24, osd_colors_win32_[1]);  // text_primary

            // Draw text (next to icon)
            DrawText(osd->window, osd->memDC, osd->text,
                    50, 25, osd_colors_win32_[1], osd_font_normal_);  // text_primary

            // Draw progress bar (below text)
            DrawProgressBar(osd->window, osd->memDC,
                           15, 45, 190, 16, osd->progress,
                           osd_colors_win32_[3], osd_colors_win32_[4]);  // progress_fg, progress_bg
            break;
        }

        case OSDType::PLAYBACK:
        case OSDType::NOTIFICATION:
        case OSDType::AUDIO_TRACK:
        case OSDType::SUBTITLE_TRACK: {
            // Draw icon if specified
            if (!osd->icon.empty()) {
                DrawIcon(osd->window, osd->memDC, osd->icon,
                        15, 15, 20, osd_colors_win32_[1]);  // text_primary
            }

            // Draw text (centered vertically)
            int text_x = osd->icon.empty() ? 15 : 45;
            DrawText(osd->window, osd->memDC, osd->text,
                    text_x, 30, osd_colors_win32_[1], osd_font_normal_);  // text_primary
            break;
        }

        case OSDType::SEEK: {
            // Draw time text (top, centered)
            if (!osd->subtext.empty()) {
                // Calculate text width for centering
                SIZE textSize;
                HDC hdc = osd->memDC;
                HFONT oldFont = (HFONT)SelectObject(hdc, osd_font_bold_);

                int len = MultiByteToWideChar(CP_UTF8, 0, osd->subtext.c_str(), -1, NULL, 0);
                if (len > 0) {
                    wchar_t* wtext = new wchar_t[len];
                    MultiByteToWideChar(CP_UTF8, 0, osd->subtext.c_str(), -1, wtext, len);
                    GetTextExtentPoint32W(hdc, wtext, len - 1, &textSize);

                    int text_x = (osd->width - textSize.cx) / 2;
                    DrawText(osd->window, osd->memDC, osd->subtext,
                            text_x, 30, osd_colors_win32_[1], osd_font_bold_);  // text_primary

                    delete[] wtext;
                }

                SelectObject(hdc, oldFont);
            }

            // Draw progress bar (below time, full width with margins)
            DrawProgressBar(osd->window, osd->memDC,
                           10, 50, 580, 24, osd->progress,
                           osd_colors_win32_[3], osd_colors_win32_[4]);  // progress_fg, progress_bg

            // Draw position marker (circle on bar)
            if (osd->progress > 0.0f && osd->progress < 1.0f) {
                int marker_x = 10 + static_cast<int>(580 * osd->progress);

                HBRUSH markerBrush = CreateSolidBrush(osd_colors_win32_[1]);  // text_primary
                HPEN markerPen = CreatePen(PS_SOLID, 1, osd_colors_win32_[1]);

                HBRUSH oldBrush = (HBRUSH)SelectObject(osd->memDC, markerBrush);
                HPEN oldPen = (HPEN)SelectObject(osd->memDC, markerPen);

                Ellipse(osd->memDC, marker_x - 6, 50 + 12 - 6, marker_x + 6, 50 + 12 + 6);

                SelectObject(osd->memDC, oldBrush);
                SelectObject(osd->memDC, oldPen);
                DeleteObject(markerBrush);
                DeleteObject(markerPen);
            }
            break;
        }
    }

    // Copy back buffer to window using BitBlt
    HDC windowDC = GetDC(osd->window);
    if (windowDC) {
        BitBlt(windowDC, 0, 0, osd->width, osd->height, osd->memDC, 0, 0, SRCCOPY);
        ReleaseDC(osd->window, windowDC);
    }

    // Update window opacity for fade animations
    SetOSDWindowOpacity(osd->window, osd->opacity);
}

/**
 * Initialize platform-specific OSD resources (Windows GDI)
 */
void VlcPlayer::InitializeOSDPlatform() {
    if (!child_hwnd_) {
        printf("[VLC OSD] ERROR: Child window not available\n");
        fflush(stdout);
        return;
    }

    // Initialize color palette (convert from RGB to COLORREF)
    osd_colors_win32_[0] = RGB(0x1a, 0x1a, 0x1a);  // background
    osd_colors_win32_[1] = RGB(0xff, 0xff, 0xff);  // text_primary
    osd_colors_win32_[2] = RGB(0xb0, 0xb0, 0xb0);  // text_secondary
    osd_colors_win32_[3] = RGB(0x4a, 0x9e, 0xff);  // progress_fg
    osd_colors_win32_[4] = RGB(0x3a, 0x3a, 0x3a);  // progress_bg
    osd_colors_win32_[5] = RGB(0x2a, 0x2a, 0x2a);  // border

    // Create brushes for colors
    for (int i = 0; i < 6; i++) {
        osd_brushes_[i] = CreateSolidBrush(osd_colors_win32_[i]);
    }

    // Create fonts
    osd_font_normal_ = CreateFontW(
        -12,                        // Height
        0,                          // Width
        0,                          // Escapement
        0,                          // Orientation
        FW_NORMAL,                  // Weight
        FALSE,                      // Italic
        FALSE,                      // Underline
        FALSE,                      // StrikeOut
        DEFAULT_CHARSET,            // CharSet
        OUT_DEFAULT_PRECIS,         // OutputPrecision
        CLIP_DEFAULT_PRECIS,        // ClipPrecision
        CLEARTYPE_QUALITY,          // Quality
        DEFAULT_PITCH | FF_SWISS,   // PitchAndFamily
        L"Segoe UI"                 // FaceName
    );

    osd_font_bold_ = CreateFontW(
        -14,                        // Height
        0,                          // Width
        0,                          // Escapement
        0,                          // Orientation
        FW_BOLD,                    // Weight
        FALSE,                      // Italic
        FALSE,                      // Underline
        FALSE,                      // StrikeOut
        DEFAULT_CHARSET,            // CharSet
        OUT_DEFAULT_PRECIS,         // OutputPrecision
        CLIP_DEFAULT_PRECIS,        // ClipPrecision
        CLEARTYPE_QUALITY,          // Quality
        DEFAULT_PITCH | FF_SWISS,   // PitchAndFamily
        L"Segoe UI"                 // FaceName
    );

    printf("[VLC OSD] Windows GDI resources initialized\n");
    fflush(stdout);
}

/**
 * Shutdown platform-specific OSD resources (Windows GDI)
 */
void VlcPlayer::ShutdownOSDPlatform() {
    // Delete brushes
    for (int i = 0; i < 6; i++) {
        if (osd_brushes_[i]) {
            DeleteObject(osd_brushes_[i]);
            osd_brushes_[i] = NULL;
        }
    }

    // Delete fonts
    if (osd_font_normal_) {
        DeleteObject(osd_font_normal_);
        osd_font_normal_ = NULL;
    }

    if (osd_font_bold_) {
        DeleteObject(osd_font_bold_);
        osd_font_bold_ = NULL;
    }

    printf("[VLC OSD] Windows GDI resources cleaned up\n");
    fflush(stdout);
}

#endif // _WIN32
