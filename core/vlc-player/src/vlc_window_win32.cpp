#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>
#include "os/win32/window.h"

// =================================================================================================
// Windows Window Management (OSWindow-based implementation)
// =================================================================================================

void VlcPlayer::CreateChildWindowInternal(int width, int height)
{
    if (osd_window_)
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

    // Initialize OSD system (colors, fonts, render thread)
    osd_window_->Initialize();

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

    printf("[VLC] OSWindow created successfully\n");
    fflush(stdout);
}

void VlcPlayer::DestroyChildWindowInternal()
{
    printf("[VLC] Destroying OSWindow...\n");
    fflush(stdout);

    if (osd_window_)
    {
        osd_window_->Destroy();
        delete osd_window_;
        osd_window_ = nullptr;
    }

    printf("[VLC] OSWindow destroyed\n");
    fflush(stdout);
}

#endif // _WIN32
