#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>
#include "os/win32/vlc_os_window_win32.h"

// =================================================================================================
// Windows Window Management (OSWindow-based implementation)
// =================================================================================================

void VlcPlayer::CreateChildWindowInternal(int width, int height)
{
    if (child_window_created_)
        return;

    printf("[VLC] Creating window using OSWindow system...\n");
    fflush(stdout);

    // Create platform-specific window
    osd_window_ = new Win32Window(this);

    if (!osd_window_->Create(width, height))
    {
        printf("[VLC] ERROR: Failed to create OSWindow\n");
        fflush(stdout);
        delete osd_window_;
        osd_window_ = nullptr;
        return;
    }

    // Bind VLC media player to window
    if (!osd_window_->Bind(media_player_))
    {
        printf("[VLC] ERROR: Failed to bind VLC to OSWindow\n");
        fflush(stdout);
        osd_window_->Destroy();
        delete osd_window_;
        osd_window_ = nullptr;
        return;
    }

    // Initialize OSD system (colors, fonts, render thread)
    osd_window_->Initialize();

    // Set default minimum size
    if (auto *win32_window = dynamic_cast<Win32Window *>(osd_window_))
    {
        win32_window->SetMinSize(320, 240);
    }

    // Initialize window state
    WindowBounds bounds;
    osd_window_->GetBounds(&bounds);
    saved_window_state_.x = bounds.x;
    saved_window_state_.y = bounds.y;
    saved_window_state_.width = bounds.width;
    saved_window_state_.height = bounds.height;
    saved_window_state_.has_border = true;
    saved_window_state_.has_titlebar = true;
    saved_window_state_.is_resizable = true;
    is_fullscreen_ = false;

    child_window_created_ = true;
    is_window_visible_ = true;

    printf("[VLC] OSWindow created successfully\n");
    fflush(stdout);
}

void VlcPlayer::DestroyChildWindowInternal()
{
    if (!child_window_created_)
        return;

    printf("[VLC] Destroying OSWindow...\n");
    fflush(stdout);

    if (osd_window_)
    {
        osd_window_->Destroy();
        delete osd_window_;
        osd_window_ = nullptr;
    }

    child_window_created_ = false;
    is_window_visible_ = false;

    printf("[VLC] OSWindow destroyed\n");
    fflush(stdout);
}

#endif // _WIN32
