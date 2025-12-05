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
    VlcPlayer::Log("FindOrCreateOSD(type=%d, allow_visible_reuse=%d)", (int)type, allow_visible_reuse);
    std::lock_guard<std::mutex> lock(osd_mutex_);
    auto now = std::chrono::steady_clock::now();

    // Try to find existing OSD of same type
    VlcPlayer::Log("Searching for existing OSD (active_osds_.size=%zu)", active_osds_.size());
    for (auto &osd : active_osds_)
    {
        if (osd->GetType() != type)
            continue;

        // For notifications: never reuse visible OSDs
        if (!allow_visible_reuse && osd->IsCurrentlyVisible(now))
            continue;

        VlcPlayer::Log("Found existing OSD, reusing");
        return osd;
    }

    // Not found, create new
    VlcPlayer::Log("Creating new OSD window...");
    try
    {
        auto osd = CreateOSDWindow();
        if (!osd)
        {
            VlcPlayer::Log("ERROR: CreateOSDWindow returned null for type %d", (int)type);
            fprintf(stderr, "CreateOSDWindow returned null for type %d\n", (int)type);
            return nullptr;
        }
        VlcPlayer::Log("OSD window created, setting type...");
        osd->SetType(type);
        active_osds_.push_back(osd);
        VlcPlayer::Log("OSD added to active list (total=%zu)", active_osds_.size());
        return osd;
    }
    catch (const std::exception &e)
    {
        VlcPlayer::Log("ERROR: Exception creating OSD: %s", e.what());
        fprintf(stderr, "Failed to create OSD window: %s\n", e.what());
        return nullptr;
    }
}

/**
 * Show volume OSD
 */
void OSWindow::ShowVolumeOSD(float progress)
{
    VlcPlayer::Log("ShowVolumeOSD(progress=%.2f) called", progress);

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
    VlcPlayer::Log("Volume OSD ready, setting data...");

    auto now = std::chrono::steady_clock::now();

    // Skip fade_in if already visible
    if (osd->IsCurrentlyVisible(now))
    {
        osd->SetCreatedAt(now + std::chrono::milliseconds(200));
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
        osd->SetCreatedAt(now + std::chrono::milliseconds(200));
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
        osd->SetCreatedAt(now + std::chrono::milliseconds(200));
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
    VlcPlayer::Log("StartOSDRenderLoop() called");

    if (osd_thread_running_)
    {
        VlcPlayer::Log("OSD render loop already running, skipping");
        return;
    }

    VlcPlayer::Log("Starting OSD render thread...");
    osd_thread_running_ = true;
    osd_render_thread_ = std::thread([this]()
                                     {
        VlcPlayer::Log("OSD render thread started");
        const auto frame_duration = std::chrono::milliseconds(16); // ~60 FPS
        const auto timing = 1.0f / frame_duration.count();

        while (osd_thread_running_)
        {
            auto frame_start = std::chrono::steady_clock::now();

            {
                std::lock_guard<std::mutex> lock(osd_mutex_);

                auto bound = this->GetClientArea();
                float offsetY = 0.0f;
                // Update all OSDs
                for (auto &osd : active_osds_)
                {
                    // the logic behind the offset y is that
                    // we want to move osd's upper when any above osd is faded out.
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
    : osd_thread_running_(false),
      background(nullptr),
      text_primary(nullptr),
      text_secondary(nullptr),
      progress_fg(nullptr),
      progress_bg(nullptr),
      border(nullptr),
      defaultFont(nullptr),
      boldFont(nullptr),
      player(player)
{
}

OSWindow::~OSWindow()
{
    VlcPlayer::Log("OSWindow destructor started");
    StopOSDRenderLoop();
    VlcPlayer::Log("OSD render loop stopped");
    ClearOSDs();
    VlcPlayer::Log("OSDs cleared");

    // Note: Fonts and colors are cleaned up by derived classes in their Destroy() methods
    // We cannot call virtual methods (DestroyFont/DestroyColor) from base class destructor
    // as the derived class vtable has already been destroyed at this point.
    VlcPlayer::Log("OSWindow destructor completed");
}

void OSWindow::Initialize()
{
    VlcPlayer::Log("OSWindow::Initialize() started");

    // Initialize colors (platform-specific CreateColor implementation)
    VlcPlayer::Log("Creating colors...");
    background = CreateColor(0x1a, 0x1a, 0x1a, 0xE0);
    text_primary = CreateColor(0xff, 0xff, 0xff, 0xff);
    text_secondary = CreateColor(0xb0, 0xb0, 0xb0, 0xff);
    progress_fg = CreateColor(0x4a, 0x9e, 0xff, 0xff);
    progress_bg = CreateColor(0x3a, 0x3a, 0x3a, 0xff);
    border = CreateColor(0x2a, 0x2a, 0x2a, 0xff);
    VlcPlayer::Log("Colors created (background=%p, text_primary=%p)", background, text_primary);

    // Initialize fonts (platform-specific CreateFont implementation)
    VlcPlayer::Log("Creating fonts...");
    defaultFont = CreateOSDFont(false);
    boldFont = CreateOSDFont(true);
    VlcPlayer::Log("Fonts created (defaultFont=%p, boldFont=%p)", defaultFont, boldFont);

    // Start OSD system
    VlcPlayer::Log("Starting OSD render loop...");
    StartOSDRenderLoop();
    VlcPlayer::Log("OSWindow::Initialize() completed");
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
    if (_contextMenuActive)
    {
        _contextMenuActive = false;
        DestroyContextMenu();
    }
}

void OSWindow::OnRightClick(int x, int y)
{
    auto menu = player->BuildContextMenu();
    CreateContextMenu(menu, x, y);
    _contextMenuActive = true;
}

void OSWindow::OnMinimize(bool minimized)
{
    if (minimized)
    {
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
    // Window is closing, cleanup OSD system
    StopOSDRenderLoop();
    ClearOSDs();
}

void OSWindow::OnResize(int x, int y, int width, int height)
{
    if (_screenMode == ScreenMode::FREE)
    {
        _freeBounds = {x, y, width, height};
    }
}
