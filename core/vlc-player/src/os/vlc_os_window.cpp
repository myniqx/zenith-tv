#include "vlc_os_osd.h"
#include "vlc_os_window.h"
#include "../vlc_player.h"
#include <algorithm>
#include <cmath>

/**
 * Show OSD with specified type and content
 */
void OSWindow::ShowOSD(
    OSDType type,
    const std::string &text,
    const std::string &subtext,
    const OSDIcon icon,
    float progress)
{
    if (!IsCreated())
        return; // Window not ready

    // Skip if window is not visible (minimized/hidden)
    if (!IsVisible())
        return;

    std::lock_guard<std::mutex> lock(osd_mutex_);

    // For PLAYBACK type in TOP_RIGHT: replace existing playback OSD
    // For other TOP_RIGHT types: find new slot
    std::shared_ptr<OSDWindow> existing_osd = nullptr;
    std::chrono::steady_clock::time_point now = std::chrono::steady_clock::now();

    for (auto &osd : active_osds_)
    {
        if (osd->type == type)
        {
            if (type == OSDType::NOTIFICATION && osd->expire_at > now)
                continue;
            existing_osd = osd;
            break;
        }
    }

    if (!existing_osd)
    {
        auto osd = CreateOSDWindow();
        osd->SetType(type);
        active_osds_.push_back(osd);
        existing_osd = osd;
    }

    // Update existing OSD with same duration logic
    existing_osd->SetData(text, subtext, progress, icon);
    existing_osd->SetCreatedAt(now);
}

void OSWindow::ClearOSDs()
{
    std::lock_guard<std::mutex> lock(osd_mutex_);

    if (active_osds_.empty())
        return;

    for (auto &osd : active_osds_)
    {
        DestroyOSDWindow(osd);
    }

    active_osds_.clear();
}

/**
 * Update existing OSD (without creating new one)
 */
void OSWindow::UpdateOSD(OSDType type, const std::string &text, float progress)
{
    std::lock_guard<std::mutex> lock(osd_mutex_);

    for (auto &osd : active_osds_)
    {
        if (osd->type == type)
        {
            osd->text = text;
            osd->progress = progress;
            // Don't reset timer - just update content
            return;
        }
    }
}

/**
 * Start OSD render loop (60 FPS)
 */
void OSWindow::StartOSDRenderLoop()
{
    if (osd_thread_running_)
        return;

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
    StopOSDRenderLoop();
    ClearOSDs();

    // Cleanup fonts
    if (defaultFont)
        DestroyFont(defaultFont);
    if (boldFont)
        DestroyFont(boldFont);

    // Cleanup colors
    if (background)
        DestroyColor(background);
    if (text_primary)
        DestroyColor(text_primary);
    if (text_secondary)
        DestroyColor(text_secondary);
    if (progress_fg)
        DestroyColor(progress_fg);
    if (progress_bg)
        DestroyColor(progress_bg);
    if (border)
        DestroyColor(border);
}

void OSWindow::Initialize()
{
    // Initialize colors (platform-specific CreateColor implementation)
    background = CreateColor(0x1a, 0x1a, 0x1a, 0xE0);
    text_primary = CreateColor(0xff, 0xff, 0xff, 0xff);
    text_secondary = CreateColor(0xb0, 0xb0, 0xb0, 0xff);
    progress_fg = CreateColor(0x4a, 0x9e, 0xff, 0xff);
    progress_bg = CreateColor(0x3a, 0x3a, 0x3a, 0xff);
    border = CreateColor(0x2a, 0x2a, 0x2a, 0xff);

    // Initialize fonts (platform-specific CreateFont implementation)
    defaultFont = CreateFont(false);
    boldFont = CreateFont(true);

    // Start OSD system
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
    // Platform implementation will handle visibility
    // Common logic: hide OSDs when window is hidden
    if (!visible)
    {
        HideAllOSDs();
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
    // When window is minimized, hide all OSDs
    if (minimized)
    {
        HideAllOSDs();
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
