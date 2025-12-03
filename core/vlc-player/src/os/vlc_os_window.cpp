#include "../vlc_player.h"
#include "vlc_os_window.h"
#include <algorithm>
#include <cmath>

/**
 * Update OSD lifecycles: fade in/out and expiration
 */
void OSWindow::UpdateOSDLifecycles()
{
    auto now = std::chrono::steady_clock::now();
    const float fade_duration = 200.0f; // 200ms fade in/out

    for (auto &osd : active_osds_)
    {
        // Calculate elapsed time since creation
        auto elapsed = std::chrono::duration<float, std::milli>(
                           now - osd->created_at)
                           .count();

        // Calculate total duration for this OSD
        auto total_duration = std::chrono::duration<float, std::milli>(
                                  osd->expire_at - osd->created_at)
                                  .count();

        // Calculate time remaining until expiration
        auto time_remaining = std::chrono::duration<float, std::milli>(
                                  osd->expire_at - now)
                                  .count();

        // State machine for opacity
        if (elapsed < fade_duration)
        {
            // Phase 1: Fade in (0-200ms)
            osd->opacity = elapsed / fade_duration;
            osd->fading_out = false;
        }
        else if (elapsed >= fade_duration && time_remaining > fade_duration)
        {
            // Phase 2: Fully visible (200ms - (total-200ms))
            osd->opacity = 1.0f;
            osd->fading_out = false;
        }
        else if (time_remaining > 0.0f && time_remaining <= fade_duration)
        {
            // Phase 3: Fade out (last 200ms)
            osd->opacity = time_remaining / fade_duration;
            osd->fading_out = true;
        }
        else
        {
            // Phase 4: Expired
            osd->opacity = 0.0f;
            osd->fading_out = true;
        }

        // Debug log with real timestamp (can be removed later)
        if (elapsed < 100.0f || (time_remaining < 300.0f && time_remaining > 0.0f))
        {
            // Get current time in milliseconds since epoch
            auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                              std::chrono::system_clock::now().time_since_epoch())
                              .count();

            printf("[%lld] [VLC OSD] type=%d, elapsed=%.0fms, remaining=%.0fms, opacity=%.2f\n",
                   now_ms, static_cast<int>(osd->type), elapsed, time_remaining, osd->opacity);
            fflush(stdout);
        }
    }
}

/**
 * Remove expired OSDs and cleanup resources
 */
void OSWindow::RemoveExpiredOSDs()
{
    auto it = active_osds_.begin();
    while (it != active_osds_.end())
    {
        if ((*it)->opacity <= 0.0f && (*it)->fading_out)
        {
            // Cleanup platform-specific resources
            DestroyOSDWindow(*it);

            // Remove from active list
            it = active_osds_.erase(it);
        }
        else
        {
            ++it;
        }
    }
}

/**
 * Show OSD with specified type and content
 */
void OSWindow::ShowOSD(OSDType type, const std::string &text,
                       const std::string &subtext, float progress)
{
    if (!IsCreated())
        return; // Window not ready

    // Skip if window is not visible (minimized/hidden)
    if (!IsVisible())
        return;

    std::lock_guard<std::mutex> lock(osd_mutex_);

    // For PLAYBACK type in TOP_RIGHT: replace existing playback OSD
    // For other TOP_RIGHT types: find new slot
    std::shared_ptr<OSDElement> existing_osd = nullptr;
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
        osd->type = type;
        active_osds_.push_back(osd);
        existing_osd = osd;
    }

    // Update existing OSD with same duration logic
    existing_osd->text = text;
    existing_osd->subtext = subtext;
    existing_osd->progress = progress;
    existing_osd->created_at = now;

    int duration_ms;
    if (type == OSDType::SEEK)
    {
        duration_ms = 4000;
    }
    else if (type == OSDType::VOLUME)
    {
        duration_ms = 3000;
    }
    else
    {
        duration_ms = 2500;
    }

    existing_osd->expire_at = existing_osd->created_at + std::chrono::milliseconds(duration_ms);
    existing_osd->opacity = 0.0f; // Restart fade in
    existing_osd->fading_out = false;
}

/**
 * Hide OSD of specified type
 */
void OSWindow::HideOSD(OSDType type)
{
    std::lock_guard<std::mutex> lock(osd_mutex_);

    for (auto &osd : active_osds_)
    {
        if (osd->type == type)
        {
            osd->expire_at = std::chrono::steady_clock::now(); // Force immediate fade out
        }
    }
}

void OSWindow::ClearAllOSDs()
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
 * Initialize OSD system
 */
void OSWindow::InitializeOSD()
{
    // Platform-specific initialization (colors, fonts, graphics context)
    InitializeOSDPlatform();

    // Start render loop (platform-agnostic)
    StartOSDRenderLoop();
}

/**
 * Shutdown OSD system
 */
void OSWindow::ShutdownOSD()
{
    // Stop render loop
    StopOSDRenderLoop();

    // Clear all OSDs
    ClearAllOSDs();

    // Platform-specific cleanup
    ShutdownOSDPlatform();
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
        const auto frame_duration = std::chrono::milliseconds(16);  // ~60 FPS
        const auto timing = 1.0f / frame_duration.count();

        while (osd_thread_running_) {
            auto frame_start = std::chrono::steady_clock::now();

            {
                std::lock_guard<std::mutex> lock(osd_mutex_);

                UpdateOSDLifecycles();

                auto bound = this->GetClientArea();
                for (auto& osd : active_osds_) {
                    osd->Render(bound);
                }

                RemoveExpiredOSDs();

                // Compact TOP_RIGHT slots
                CompactSlots(OSDPosition::TOP_RIGHT);
            }

            // Maintain 60 FPS
            auto elapsed = std::chrono::steady_clock::now() - frame_start;
            if (elapsed < frame_duration) {
                std::this_thread::sleep_for(frame_duration - elapsed);
            }
        }

        printf("[VLC OSD] Render loop stopped\n");
        fflush(stdout); });
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
