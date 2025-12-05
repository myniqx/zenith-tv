#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>
#include "os/win32/window.h"

// =================================================================================================
// Windows Window Management (OSWindow-based implementation)
// =================================================================================================

void VlcPlayer::CreateChildWindowInternal(int width, int height)
{
    Log("CreateChildWindowInternal called (width=%d, height=%d)", width, height);

    if (osd_window_ && osd_window_->IsCreated())
    {
        Log("Window instance exists and is already created, skipping");
        return;
    }

    if (!osd_window_)
    {
        Log("No window instance, creating new Win32Window...");
        osd_window_ = new Win32Window(this);
        Log("Win32Window instance created");
    }
    else
    {
        Log("Window instance exists but not created yet, will create it now");
    }

    printf("[VLC] Creating window using OSWindow system...\n");
    fflush(stdout);

    Log("Calling osd_window_->Create(%d, %d)...", width, height);
    if (!osd_window_->Create(width, height))
    {
        Log("ERROR: osd_window_->Create() returned false");
        printf("[VLC] ERROR: Failed to create OSWindow\n");
        fflush(stdout);
        delete osd_window_;
        osd_window_ = nullptr;
        return;
    }
    Log("osd_window_->Create() succeeded");

    // Initialize OSD system (colors, fonts, render thread)
    Log("Calling osd_window_->Initialize()...");
    osd_window_->Initialize();
    Log("osd_window_->Initialize() completed");

    // Bind VLC media player to window
    Log("Calling osd_window_->Bind(media_player_=%p)...", (void*)media_player_);
    if (!osd_window_->Bind(media_player_))
    {
        Log("ERROR: osd_window_->Bind() returned false");
        printf("[VLC] ERROR: Failed to bind VLC to OSWindow\n");
        fflush(stdout);
        osd_window_->Destroy();
        delete osd_window_;
        osd_window_ = nullptr;
        return;
    }
    Log("osd_window_->Bind() succeeded");

    printf("[VLC] OSWindow created successfully\n");
    fflush(stdout);
    Log("CreateChildWindowInternal completed successfully");
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
