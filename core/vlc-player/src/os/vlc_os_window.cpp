#include "vlc_os_window.h"
#include <algorithm>

// =================================================================================================
// OSWindow - Protected Drawing Implementation
// =================================================================================================

void OSWindow::RenderOSD(std::shared_ptr<OSDWindow> osd)
{
    if (!osd)
        return;

    WindowBounds player_area = GetClientArea();
    int player_x = player_area.x;
    int player_y = player_area.y;
    int player_width = player_area.width;
    int player_height = player_area.height;

    // Ensure OSD size is set
    int osd_width = osd->width();
    int osd_height = osd->height();

    // Calculate position relative to player window
    int x = 0, y = 0;
    switch (osd->position)
    {
    case OSDPosition::TOP_LEFT:
        x = player_x + 20;
        y = player_y + 20;
        break;

    case OSDPosition::TOP_RIGHT:
        x = player_x + player_width - osd_width - 20;
        y = player_y + 20 + (osd->slot_index * 60); // Stack vertically
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
    if (!osd->window)
    {
        osd->Create(x, y)
    }
    else
    {
        osd->Move(x, y);
    }

    void *drawable = osd->drawable;
    if (!drawable)
        return;

    ClearDrawable(drawable, 0, 0, osd->width, osd->height, background);

    // Render based on OSD type
    switch (osd->GetType())
    {
    case OSDType::VOLUME:
    {
        // Draw icon (left side, 15px from edge)
        OSDIcon icon = (osd->progress == 0.0f) ? VOLUME_MUTE : VOLUME_UP;
        DrawIcon(drawable, icon, 15, 10, 24, text_primary);

        // Draw text (next to icon)
        // NOTE: Needs font handle - platform specific, may need GetOSDFont() method
        DrawText(drawable, osd->text, 50, 25, text_primary, nullptr);

        // Draw progress bar (below text)
        DrawProgressBar(drawable, 15, 45, 190, 16, osd->progress,
                        progress_fg, progress_bg);
        break;
    }

    case OSDType::PLAYBACK:
    case OSDType::NOTIFICATION:
    case OSDType::AUDIO_TRACK:
    case OSDType::SUBTITLE_TRACK:
    {
        // Draw icon if specified
        if (osd->icon != STOP) // Assuming STOP is default/none
        {
            DrawIcon(drawable, osd->icon, 15, 15, 20, text_primary);
        }

        // Draw text (centered vertically)
        int text_x = (osd->icon != STOP) ? 45 : 15;
        DrawText(drawable, osd->text, text_x, 30, text_primary, nullptr);
        break;
    }

    case OSDType::SEEK:
    {
        // Draw time text (top, centered)
        if (!osd->subtext.empty())
        {
            // NOTE: Text width calculation is platform-specific
            // For now, estimate center position (platform can override if needed)
            // NOTE: May need GetTextWidth() - NOT YET IN HEADER
            int text_x = (osd->width - static_cast<int>(osd->subtext.length() * 8)) / 2;
            DrawText(drawable, osd->subtext, text_x, 30, text_primary, nullptr);
        }

        // Draw progress bar (below time, full width with margins)
        DrawProgressBar(drawable, 10, 50, 580, 24, osd->progress,
                        progress_fg, progress_bg);

        // Draw position marker (circle on bar)
        if (osd->progress > 0.0f && osd->progress < 1.0f)
        {
            int marker_x = 10 + static_cast<int>(580 * osd->progress);
            DrawCircle(drawable, marker_x - 6, 50 + 12 - 6, 12, text_primary);
        }
        break;
    }
    }

    FlushOSDDrawable(osd);
    SetOSDWindowOpacity(osd, osd->opacity);
}

// =================================================================================================
// OSWindow - Protected Drawing Implementation (Continued)
// =================================================================================================

void OSWindow::DrawProgressBar(void *drawable,
                               int x, int y,
                               int width, int height,
                               float progress,
                               OSDColor fg_color,
                               OSDColor bg_color)
{
    if (!drawable)
        return;
    progress = std::clamp(progress, 0.0f, 1.0f);
    DrawRoundedRect(drawable, x, y, width, height, bg_color, 4);
    if (progress > 0.0f)
    {
        int padding = 2;
        int filled_width = static_cast<int>(width * progress) - padding * 2;
        DrawRoundedRect(drawable, x + padding, y + padding, filled_width, height - padding * 2, fg_color, 4);
    }
}

void OSWindow::DrawIcon(void *drawable,
                        const OSDIcon &icon,
                        int x, int y,
                        int size,
                        OSDColor color)
{
    if (!drawable)
        return;

    if (icon == PLAY)
    {
        // Triangle pointing right
        Point points[3];
        points[0] = {x, y};
        points[1] = {x + size, y + size / 2};
        points[2] = {x, y + size};
        DrawPolygon(drawable, points, 3, color);
    }
    else if (icon == PAUSE)
    {
        // Two vertical bars
        int bar_width = size / 3;
        DrawRoundedRect(drawable, x, y, bar_width, size, color, 0);
        DrawRoundedRect(drawable, x + size - bar_width, y, size, size, color, 0);
    }
    else if (icon == STOP)
    {
        // Square
        DrawProgressBar(drawable, x, y, size, size, 1.0f, color, color);
    }
    else if (icon == VOLUME_UP || icon == VOLUME_DOWN)
    {
        // Speaker icon (simplified trapezoid)
        Point points[4];
        points[0] = {x, y + size / 3};
        points[1] = {x + size / 2, y};
        points[2] = {x + size / 2, y + size};
        points[3] = {x, y + 2 * size / 3};
        DrawPolygon(drawable, points, 4, color);

        // Add sound waves for volume_up
        if (icon == VOLUME_UP)
        {
            DrawArc(drawable, x + size / 2, y + size / 4, size / 2, size / 2, 0, 360.f * 64.f, color);
        }
    }
    else if (icon == VOLUME_MUTE)
    {
        // Speaker with X
        Point points[4];
        points[0] = {x, y + size / 3};
        points[1] = {x + size / 2, y};
        points[2] = {x + size / 2, y + size};
        points[3] = {x, y + 2 * size / 3};
        DrawPolygon(drawable, points, 4, color);

        // Draw X over it
        DrawLine(drawable, x + size / 2, y, x + size, y + size, color);
        DrawLine(drawable, x + size, y, x + size / 2, y + size, color);
    }
}
