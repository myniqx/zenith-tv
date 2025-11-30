#include "vlc_player.h"

#ifdef __linux__
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xatom.h>
#include <cmath>
#include <algorithm>

// =================================================================================================
// OSD Linux (X11) Platform-Specific Implementation
// =================================================================================================

/**
 * Set X11 window opacity for fade animations
 */
void VlcPlayer::SetOSDWindowOpacity(::Window window, float opacity) {
    if (!osd_display_ || !window) return;

    Atom atom = XInternAtom(osd_display_, "_NET_WM_WINDOW_OPACITY", False);
    unsigned long opacity_value = (unsigned long)(std::clamp(opacity, 0.0f, 1.0f) * 0xFFFFFFFF);
    
    // XChangeProperty expects 'long' for format 32, even on 64-bit systems where long is 64-bit.
    // However, the data is expected to be packed as 32-bit values if format is 32.
    // On 64-bit Linux, 'unsigned long' is 64-bit. We should strictly use a type that matches 'long' 
    // but ensure the value is correct.
    // Actually, Xlib handles the conversion if we pass 'long'.
    long data = (long)opacity_value;

    XChangeProperty(osd_display_, window, atom, XA_CARDINAL, 32, PropModeReplace,
                    (unsigned char*)&data, 1);
}

/**
 * Draw text on pixmap buffer
 */
void VlcPlayer::DrawText(::Window window, Pixmap buffer, GC gc,
                         const std::string& text, int x, int y,
                         unsigned long color, XFontSet font) {
    if (!osd_display_ || !buffer) return;

    XSetForeground(osd_display_, gc, color);
    // XFontSet is used with Xutf8DrawString, no need to set font in GC manually if using Xutf8DrawString with FontSet
    
    if (font) {
        Xutf8DrawString(osd_display_, buffer, font, gc, x, y, text.c_str(), text.length());
    } else {
        // Fallback if no fontset
        XDrawString(osd_display_, buffer, gc, x, y, text.c_str(), text.length());
    }
}

/**
 * Draw progress bar on pixmap buffer
 */
void VlcPlayer::DrawProgressBar(::Window window, Pixmap buffer, GC gc,
                                int x, int y, int width, int height,
                                float progress, unsigned long fg_color,
                                unsigned long bg_color) {
    if (!osd_display_ || !buffer) return;

    progress = std::clamp(progress, 0.0f, 1.0f);

    // Draw background (unfilled portion)
    XSetForeground(osd_display_, gc, bg_color);
    XFillRectangle(osd_display_, buffer, gc, x, y, width, height);

    // Draw foreground (filled portion)
    if (progress > 0.0f) {
        XSetForeground(osd_display_, gc, fg_color);
        int filled_width = static_cast<int>(width * progress);
        XFillRectangle(osd_display_, buffer, gc, x, y, filled_width, height);
    }
}

/**
 * Draw rounded rectangle (simplified - uses sharp corners for now)
 * TODO: Implement proper rounded corners with XFillArc
 */
void VlcPlayer::DrawRoundedRect(::Window window, Pixmap buffer, GC gc,
                                int x, int y, int width, int height,
                                unsigned long color, int radius) {
    if (!osd_display_ || !buffer) return;

    // For now, just draw a simple filled rectangle
    // Rounded corners can be added later with XFillArc if needed
    XSetForeground(osd_display_, gc, color);
    XFillRectangle(osd_display_, buffer, gc, x, y, width, height);
}

/**
 * Draw icon using Unicode symbols or simple geometric shapes
 */
void VlcPlayer::DrawIcon(::Window window, Pixmap buffer, GC gc,
                         const std::string& icon_name, int x, int y, int size,
                         unsigned long color) {
    if (!osd_display_ || !buffer) return;

    XSetForeground(osd_display_, gc, color);

    // Simple geometric icons (can be replaced with Unicode or images later)
    if (icon_name == "play") {
        // Triangle pointing right
        XPoint points[3];
        points[0] = {static_cast<short>(x), static_cast<short>(y)};
        points[1] = {static_cast<short>(x + size), static_cast<short>(y + size/2)};
        points[2] = {static_cast<short>(x), static_cast<short>(y + size)};
        XFillPolygon(osd_display_, buffer, gc, points, 3, Convex, CoordModeOrigin);
    }
    else if (icon_name == "pause") {
        // Two vertical bars
        int bar_width = size / 3;
        XFillRectangle(osd_display_, buffer, gc, x, y, bar_width, size);
        XFillRectangle(osd_display_, buffer, gc, x + size - bar_width, y, bar_width, size);
    }
    else if (icon_name == "stop") {
        // Square
        XFillRectangle(osd_display_, buffer, gc, x, y, size, size);
    }
    else if (icon_name == "volume_up" || icon_name == "volume_down") {
        // Speaker icon (simplified trapezoid)
        XPoint points[4];
        points[0] = {static_cast<short>(x), static_cast<short>(y + size/3)};
        points[1] = {static_cast<short>(x + size/2), static_cast<short>(y)};
        points[2] = {static_cast<short>(x + size/2), static_cast<short>(y + size)};
        points[3] = {static_cast<short>(x), static_cast<short>(y + 2*size/3)};
        XFillPolygon(osd_display_, buffer, gc, points, 4, Convex, CoordModeOrigin);

        // Add sound waves for volume_up
        if (icon_name == "volume_up") {
            XDrawArc(osd_display_, buffer, gc, x + size/2, y + size/4, size/2, size/2, 0, 360*64);
        }
    }
    else if (icon_name == "volume_mute") {
        // Speaker with X
        XPoint points[4];
        points[0] = {static_cast<short>(x), static_cast<short>(y + size/3)};
        points[1] = {static_cast<short>(x + size/2), static_cast<short>(y)};
        points[2] = {static_cast<short>(x + size/2), static_cast<short>(y + size)};
        points[3] = {static_cast<short>(x), static_cast<short>(y + 2*size/3)};
        XFillPolygon(osd_display_, buffer, gc, points, 4, Convex, CoordModeOrigin);

        // Draw X over it
        XDrawLine(osd_display_, buffer, gc, x + size/2, y, x + size, y + size);
        XDrawLine(osd_display_, buffer, gc, x + size, y, x + size/2, y + size);
    }
}

/**
 * Create OSD window at specified position
 */
void VlcPlayer::CreateOSDWindow(std::shared_ptr<OSDElement> osd, int x, int y) {
    if (!osd_display_ || !child_window_) return;

    int screen = DefaultScreen(osd_display_);
    ::Window root = RootWindow(osd_display_, screen);

    // Use centralized size logic
    GetOSDSize(osd->type, osd->width, osd->height);

    // Create override-redirect window (no window manager decorations)
    XSetWindowAttributes attrs;
    attrs.override_redirect = True;
    attrs.background_pixel = osd_colors_.background;
    attrs.border_pixel = osd_colors_.border;
    attrs.event_mask = ExposureMask;
    attrs.save_under = True;
    attrs.backing_store = WhenMapped;

    osd->window = XCreateWindow(
        osd_display_, root, x, y, osd->width, osd->height, 1,
        CopyFromParent, InputOutput, CopyFromParent,
        CWOverrideRedirect | CWBackPixel | CWBorderPixel | CWEventMask | CWSaveUnder | CWBackingStore,
        &attrs
    );

    if (!osd->window) {
        printf("[VLC OSD] ERROR: Failed to create OSD window\n");
        fflush(stdout);
        return;
    }

    // Create back buffer for double buffering (eliminates flicker)
    osd->backBuffer = XCreatePixmap(osd_display_, osd->window, osd->width, osd->height,
                                    DefaultDepth(osd_display_, screen));

    // Make window appear on top
    Atom wmStateAbove = XInternAtom(osd_display_, "_NET_WM_STATE_ABOVE", False);
    Atom wmState = XInternAtom(osd_display_, "_NET_WM_STATE", False);
    XChangeProperty(osd_display_, osd->window, wmState, XA_ATOM, 32, PropModeReplace,
                    (unsigned char*)&wmStateAbove, 1);

    // Initially invisible (will fade in)
    SetOSDWindowOpacity(osd->window, 0.0f);

    // Map window
    XMapRaised(osd_display_, osd->window);
    XFlush(osd_display_);

    printf("[VLC OSD] Created window: type=%d, pos=(%d,%d), size=(%dx%d), window=%lu\n",
           static_cast<int>(osd->type), x, y, osd->width, osd->height, osd->window);
    fflush(stdout);
}

/**
 * Destroy OSD window and cleanup resources
 */
void VlcPlayer::DestroyOSDWindow(std::shared_ptr<OSDElement> osd) {
    if (!osd_display_) return;

    if (osd->backBuffer) {
        XFreePixmap(osd_display_, osd->backBuffer);
        osd->backBuffer = 0;
    }

    if (osd->window) {
        XDestroyWindow(osd_display_, osd->window);
        osd->window = 0;
    }
}

/**
 * Render OSD based on type
 */
void VlcPlayer::RenderOSD(std::shared_ptr<OSDElement> osd) {
    if (!osd_display_ || !osd) return;

    // Get VLC player window position and size securely
    int player_x = 0, player_y = 0;
    int player_width = 0, player_height = 0;
    bool window_valid = false;

    {
        std::lock_guard<std::mutex> lock(window_mutex_);
        if (child_window_) {
            // Note: We are using osd_display_ to query child_window_ which belongs to another connection.
            // This is generally allowed in X11 as long as the window ID is valid.
            // However, we should handle errors if the window is gone.
            
            // To be safe, we should probably use the main display connection for this query,
            // but that would require locking the main display which is used by another thread.
            // Instead, we use osd_display_ but we must be prepared for X errors if the window is destroyed.
            // Ideally, we sync with the main thread via window_mutex_.
            
            XWindowAttributes player_attrs;
            // We use osd_display_ to query the window.
            Status status = XGetWindowAttributes(osd_display_, child_window_, &player_attrs);
            
            if (status) {
                ::Window child_return;
                XTranslateCoordinates(osd_display_, child_window_,
                                    DefaultRootWindow(osd_display_),
                                    0, 0, &player_x, &player_y, &child_return);
                
                player_width = player_attrs.width;
                player_height = player_attrs.height;
                window_valid = true;
            }
        }
    }

    if (!window_valid) return;

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
        XMoveWindow(osd_display_, osd->window, x, y);
        
        // CRITICAL FIX: Raise window to ensure it stays on top of the video
        // The video output might be repainting constantly, obscuring the OSD
        XRaiseWindow(osd_display_, osd->window);
    }

    if (!osd->backBuffer) return;

    // Clear back buffer
    XSetForeground(osd_display_, osd_gc_, osd_colors_.background);
    XFillRectangle(osd_display_, osd->backBuffer, osd_gc_, 0, 0, osd->width, osd->height);

    // Render based on OSD type
    switch (osd->type) {
        case OSDType::VOLUME: {
            // Draw icon (left side, 20px from edge)
            std::string icon = (osd->progress == 0.0f) ? "volume_mute" : "volume_up";
            DrawIcon(osd->window, osd->backBuffer, osd_gc_, icon, 15, 10, 24, osd_colors_.text_primary);

            // Draw text (next to icon)
            DrawText(osd->window, osd->backBuffer, osd_gc_, osd->text,
                    50, 25, osd_colors_.text_primary, osd_font_normal_);

            // Draw progress bar (below text)
            DrawProgressBar(osd->window, osd->backBuffer, osd_gc_,
                           15, 45, 190, 16, osd->progress,
                           osd_colors_.progress_fg, osd_colors_.progress_bg);
            break;
        }

        case OSDType::PLAYBACK:
        case OSDType::NOTIFICATION:
        case OSDType::AUDIO_TRACK:
        case OSDType::SUBTITLE_TRACK: {
            // Draw icon if specified
            if (!osd->icon.empty()) {
                DrawIcon(osd->window, osd->backBuffer, osd_gc_, osd->icon,
                        15, 15, 20, osd_colors_.text_primary);
            }

            // Draw text (centered vertically)
            int text_x = osd->icon.empty() ? 15 : 45;
            DrawText(osd->window, osd->backBuffer, osd_gc_, osd->text,
                    text_x, 30, osd_colors_.text_primary, osd_font_normal_);
            break;
        }

        case OSDType::SEEK: {
            // Draw time text (top, centered)
            if (!osd->subtext.empty()) {
                // XTextWidth is for XFontStruct, for XFontSet use Xutf8TextEscapement
                XRectangle ink, logical;
                Xutf8TextExtents(osd_font_bold_, osd->subtext.c_str(), osd->subtext.length(), &ink, &logical);
                int text_width = logical.width;
                
                int text_x = (osd->width - text_width) / 2;
                DrawText(osd->window, osd->backBuffer, osd_gc_, osd->subtext,
                        text_x, 30, osd_colors_.text_primary, osd_font_bold_);
            }

            // Draw progress bar (below time, full width with margins)
            DrawProgressBar(osd->window, osd->backBuffer, osd_gc_,
                           10, 50, 580, 24, osd->progress,
                           osd_colors_.progress_fg, osd_colors_.progress_bg);

            // Draw position marker (circle on bar)
            if (osd->progress > 0.0f && osd->progress < 1.0f) {
                int marker_x = 10 + static_cast<int>(580 * osd->progress);
                XSetForeground(osd_display_, osd_gc_, osd_colors_.text_primary);
                XFillArc(osd_display_, osd->backBuffer, osd_gc_,
                        marker_x - 6, 50 + 12 - 6, 12, 12, 0, 360*64);
            }
            break;
        }
    }

    // Copy back buffer to window
    XCopyArea(osd_display_, osd->backBuffer, osd->window, osd_gc_, 0, 0,
              osd->width, osd->height, 0, 0);

    // Update window opacity (for fade animation)
    SetOSDWindowOpacity(osd->window, osd->opacity);

    // Ensure window is mapped (visible) - X11 can unmap windows with 0 opacity
    XWindowAttributes attrs;
    XGetWindowAttributes(osd_display_, osd->window, &attrs);
    if (attrs.map_state != IsViewable) {
        XMapRaised(osd_display_, osd->window);
    }

    XFlush(osd_display_);
}

#endif // __linux__
