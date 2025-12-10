#include "base_osd.h"
#include "window_base.h"
#include "../vlc_player.h"
#include <algorithm>
#include <cmath>

/**
 * Find existing OSD of given type or create new one
 */
std::shared_ptr<OSDWindow> OSWindow::FindOrCreateOSD(OSDType type, bool allow_visible_reuse)
{
    std::lock_guard<std::mutex> lock(osd_mutex_);
    auto now = std::chrono::steady_clock::now();

    // Try to find existing OSD of same type
    for (auto &osd : active_osds_)
    {
        if (osd->GetType() != type)
            continue;

        // For notifications: never reuse visible OSDs
        if (!allow_visible_reuse && osd->IsCurrentlyVisible(now))
            continue;

        return osd;
    }

    // Not found, create new
    try
    {
        auto osd = CreateOSDWindow();
        if (!osd)
        {
            VlcPlayer::Log("ERROR: CreateOSDWindow returned null for type %d", (int)type);
            return nullptr;
        }
        osd->SetType(type);
        active_osds_.push_back(osd);
        return osd;
    }
    catch (const std::exception &e)
    {
        VlcPlayer::Log("ERROR: Exception creating OSD: %s", e.what());
        return nullptr;
    }
}

/**
 * Show volume OSD
 */
void OSWindow::ShowVolumeOSD(float progress)
{
    if (!IsCreated() || !IsVisible())
    {
        VlcPlayer::Log("Window not created or not visible, skipping OSD");
        return;
    }

    auto osd = FindOrCreateOSD(OSDType::VOLUME, true);
    if (!osd)
    {
        VlcPlayer::Log("ERROR: Failed to find/create volume OSD");
        return;
    }

    auto now = std::chrono::steady_clock::now();

    // Skip fade_in if already visible
    if (osd->IsCurrentlyVisible(now))
    {
        osd->SetCreatedAt(now - std::chrono::milliseconds(200));
    }
    else
    {
        osd->SetCreatedAt(now);
    }

    // Text is auto-generated inside SetData for VOLUME type
    osd->SetData("", "", progress,
                 progress == 0.0f ? OSDIcon::VOLUME_MUTE : OSDIcon::VOLUME_UP);
}

/**
 * Show seek OSD
 */
void OSWindow::ShowSeekOSD(int64_t time, int64_t duration)
{
    if (!IsCreated() || !IsVisible())
        return;

    auto osd = FindOrCreateOSD(OSDType::SEEK, true);
    if (!osd)
        return;

    // Format time display
    std::string current_time = osd->FormatTime(time);
    std::string total_time = osd->FormatTime(duration);
    std::string time_display = current_time + " / " + total_time;

    // Calculate progress
    float progress = (duration > 0) ? static_cast<float>(time) / duration : 0.0f;

    auto now = std::chrono::steady_clock::now();

    // Skip fade_in if already visible
    if (osd->IsCurrentlyVisible(now))
    {
        osd->SetCreatedAt(now - std::chrono::milliseconds(200));
    }
    else
    {
        osd->SetCreatedAt(now);
    }

    // time_display goes to subtext for SEEK type
    osd->SetData("", time_display, progress, OSDIcon::NONE);
}

/**
 * Show playback state OSD
 */
void OSWindow::ShowPlaybackOSD(const std::string &state)
{
    if (!IsCreated() || !IsVisible())
        return;

    auto osd = FindOrCreateOSD(OSDType::PLAYBACK, true);
    if (!osd)
        return;

    // Map state to text and icon
    std::string text;
    OSDIcon icon = OSDIcon::NONE;

    if (state == "playing")
    {
        text = "Playing";
        icon = OSDIcon::PLAY;
    }
    else if (state == "paused")
    {
        text = "Paused";
        icon = OSDIcon::PAUSE;
    }
    else if (state == "stopped")
    {
        text = "Stopped";
        icon = OSDIcon::STOP;
    }
    else
    {
        text = state; // Fallback to state string itself
        icon = OSDIcon::NONE;
    }

    auto now = std::chrono::steady_clock::now();

    // Skip fade_in if already visible
    if (osd->IsCurrentlyVisible(now))
    {
        osd->SetCreatedAt(now - std::chrono::milliseconds(200));
    }
    else
    {
        osd->SetCreatedAt(now);
    }

    osd->SetData(text, "", 0.0f, icon);
}

/**
 * Show notification OSD
 */
void OSWindow::ShowNotificationOSD(const std::string &text, OSDIcon icon)
{
    if (!IsCreated() || !IsVisible())
        return;

    // Never reuse visible notifications (allow_visible_reuse = false)
    auto osd = FindOrCreateOSD(OSDType::NOTIFICATION, false);
    if (!osd)
        return;

    auto now = std::chrono::steady_clock::now();

    // Always start fresh (no fade_in skip for notifications)
    osd->SetCreatedAt(now);
    osd->SetData(text, "", 0.0f, icon);
}

void OSWindow::ClearOSDs()
{
    std::lock_guard<std::mutex> lock(osd_mutex_);

    if (active_osds_.empty())
        return;

    for (auto &osd : active_osds_)
    {
        if (osd && osd->isWindowCreated())
        {
            osd->Destroy();
        }
    }

    active_osds_.clear();
}

/**
 * Start OSD render loop (60 FPS)
 */
void OSWindow::StartOSDRenderLoop()
{
    if (osd_thread_running_)
    {
        VlcPlayer::Log("OSD render loop already running, skipping");
        return;
    }

    osd_thread_running_ = true;
    osd_render_thread_ = std::thread([this]()
                                     {
        const auto frame_duration = std::chrono::milliseconds(16); // ~60 FPS
        const auto timing = 1.0f / frame_duration.count();

        while (osd_thread_running_)
        {
            auto frame_start = std::chrono::steady_clock::now();

            {
                std::lock_guard<std::mutex> lock(osd_mutex_);

                auto bound = this->GetClientArea();

                float offsetY = 0.0f;
                for (auto &osd : active_osds_)
                {
                    osd->Update(bound, offsetY, timing);
                    offsetY += osd->GetHeight();
                }

                for (auto &osd : active_osds_)
                {
                    osd->Render();
                }
            }

            // Maintain 60 FPS
            auto elapsed = std::chrono::steady_clock::now() - frame_start;
            if (elapsed < frame_duration)
            {
                std::this_thread::sleep_for(frame_duration - elapsed);
            }
        }

        // Clear all OSDs on exit
        ClearOSDs(); });
}

/**
 * Stop OSD render loop
 */
void OSWindow::StopOSDRenderLoop()
{
    if (!osd_thread_running_)
        return;

    osd_thread_running_ = false;

    if (osd_render_thread_.joinable())
    {
        osd_render_thread_.join();
    }
}

// =================================================================================================
// Group 2: Constructor & Destructor
// =================================================================================================

OSWindow::OSWindow(VlcPlayer *player)
    : background(nullptr),
      text_primary(nullptr),
      text_secondary(nullptr),
      progress_fg(nullptr),
      progress_bg(nullptr),
      border(nullptr),
      defaultFont(nullptr),
      boldFont(nullptr),
      player(player),
      osd_thread_running_(false)
{
}

OSWindow::~OSWindow()
{
    StopOSDRenderLoop();
    OnContextMenuClose();
    ClearOSDs();
}

void OSWindow::Initialize()
{
    VlcPlayer::Log("OSWindow::Initialize() started");
    
    background = CreateColor(0x1a, 0x1a, 0x1a, 0xE0);
    text_primary = CreateColor(0xff, 0xff, 0xff, 0xff);
    text_secondary = CreateColor(0xb0, 0xb0, 0xb0, 0xff);
    progress_fg = CreateColor(0x4a, 0x9e, 0xff, 0xff);
    progress_bg = CreateColor(0x3a, 0x3a, 0x3a, 0xff);
    border = CreateColor(0x2a, 0x2a, 0x2a, 0xff);

    StartOSDRenderLoop();
}

// =================================================================================================
// Group 4: Window Manipulation
// =================================================================================================

void OSWindow::SetBounds(int x, int y, int width, int height)
{
    SetBoundsInternal(x, y, width, height);
}

void OSWindow::SetScreenMode(ScreenMode mode)
{
    _screenMode = mode;
    WindowStyle style = WindowStyle();
    switch (mode)
    {
    case ScreenMode::FREE:
        style.fullscreen = false;
        style.has_border = true;
        style.has_titlebar = true;
        style.is_resizable = true;
        style.show_in_taskbar = true;
        style.on_top = false;
        SetBoundsInternal(_freeBounds.x, _freeBounds.y, _freeBounds.width, _freeBounds.height);
        break;

    case ScreenMode::FREE_ON_TOP:
        style.fullscreen = false;
        style.has_border = true;
        style.has_titlebar = true;
        style.is_resizable = true;
        style.show_in_taskbar = true;
        style.on_top = true;
        SetBoundsInternal(_freeBounds.x, _freeBounds.y, _freeBounds.width, _freeBounds.height);
        break;

    case ScreenMode::FULLSCREEN:
        style.fullscreen = true;
        style.has_border = false;
        style.has_titlebar = false;
        style.is_resizable = false;
        style.show_in_taskbar = false;
        style.on_top = true;
        break;

    case ScreenMode::STICKY:
        style.fullscreen = false;
        style.has_border = false;
        style.has_titlebar = false;
        style.is_resizable = false;
        style.show_in_taskbar = false;
        style.on_top = true;
        break;
    }

    SetStyle(style);
}

void OSWindow::SetVisible(bool visible)
{
    if (!visible)
    {
        for (auto &osd : active_osds_)
        {
            osd->Hide();
        }
    }
}

void OSWindow::SetStyle(const WindowStyle &style)
{
    SetStyleInternal(style);
}

// =================================================================================================
// Group 5: Event Handlers (Platform-Agnostic Common Logic)
// =================================================================================================

void OSWindow::OnInput(const std::string &key_code, bool ctrl, bool shift, bool alt, bool meta)
{
    player->ProcessKeyPress(key_code);
    OnContextMenuClose();
}

void OSWindow::OnRightClick(int x, int y)
{
    OnContextMenuClose();

    auto menu = player->BuildContextMenu();
    _contextMenuActive = true; // Set BEFORE CreateContextMenu (it blocks)

    CreateContextMenu(menu, x, y); // This call blocks until menu closes
}

void OSWindow::OnContextMenuClose()
{
    if (_contextMenuActive)
    {
        _contextMenuActive = false;
        DestroyContextMenu();
    }
}

void OSWindow::OnMinimize(bool minimized)
{
    if (minimized)
    {
        OnContextMenuClose();
        // Clear all OSDs when minimizing
        ClearOSDs();

        // Smart pause: remember playback state and pause if playing
        if (player && player->media_player_)
        {
            bool is_playing = libvlc_media_player_is_playing(player->media_player_);
            was_playing_before_minimize_ = is_playing;
            if (is_playing)
            {
                libvlc_media_player_pause(player->media_player_);
            }
        }
    }
    else
    {
        // Smart resume: resume playback if it was playing before minimize
        if (was_playing_before_minimize_ && player && player->media_player_)
        {
            libvlc_media_player_play(player->media_player_);
            was_playing_before_minimize_ = false;
        }
    }
}

void OSWindow::OnClose()
{
    OnContextMenuClose();
    StopOSDRenderLoop();
    ClearOSDs();
    player->EmitShortcut("stop");
}

void OSWindow::OnResize(int x, int y, int width, int height)
{
    if (_screenMode == ScreenMode::FREE || _screenMode == ScreenMode::FREE_ON_TOP)
    {
        _freeBounds = {x, y, width, height};
    }
}
