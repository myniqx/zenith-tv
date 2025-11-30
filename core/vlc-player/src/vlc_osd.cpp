#include "vlc_player.h"
#include <algorithm>
#include <cmath>

// =================================================================================================
// OSD Core API - Platform Agnostic
// =================================================================================================

/**
 * Get OSD position based on type
 */
VlcPlayer::OSDPosition VlcPlayer::GetPositionForType(OSDType type) {
    switch (type) {
        case OSDType::VOLUME:
            return OSDPosition::TOP_LEFT;

        case OSDType::PLAYBACK:
        case OSDType::NOTIFICATION:
        case OSDType::AUDIO_TRACK:
        case OSDType::SUBTITLE_TRACK:
            return OSDPosition::TOP_RIGHT;

        case OSDType::SEEK:
            return OSDPosition::BOTTOM_CENTER;

        default:
            return OSDPosition::CENTER;
    }
}

/**
 * Get OSD size based on type
 */
void VlcPlayer::GetOSDSize(OSDType type, int& width, int& height) {
    switch (type) {
        case OSDType::VOLUME:
            width = 220;
            height = 70;
            break;

        case OSDType::PLAYBACK:
        case OSDType::NOTIFICATION:
        case OSDType::AUDIO_TRACK:
        case OSDType::SUBTITLE_TRACK:
            width = 160;
            height = 50;
            break;

        case OSDType::SEEK:
            width = 600;
            height = 80;
            break;

        default:
            width = 200;
            height = 60;
            break;
    }
}

/**
 * Format time in milliseconds to HH:MM:SS format
 */
std::string VlcPlayer::FormatTime(int64_t time_ms) {
    if (time_ms < 0) time_ms = 0;

    int64_t total_seconds = time_ms / 1000;
    int hours = total_seconds / 3600;
    int minutes = (total_seconds % 3600) / 60;
    int seconds = total_seconds % 60;

    char buffer[32];  // Increased buffer size to avoid warnings
    if (hours > 0) {
        snprintf(buffer, sizeof(buffer), "%02d:%02d:%02d", hours, minutes, seconds);
    } else {
        snprintf(buffer, sizeof(buffer), "%02d:%02d", minutes, seconds);
    }

    return std::string(buffer);
}

/**
 * Calculate next available slot index for position-based queuing
 */
int VlcPlayer::CalculateSlotIndex(OSDPosition position) {
    if (position != OSDPosition::TOP_RIGHT) {
        return 0;  // Only TOP_RIGHT uses multi-slot system
    }

    // Find highest slot index in use
    int max_slot = -1;
    for (const auto& osd : active_osds_) {
        if (osd->position == position) {
            max_slot = std::max(max_slot, osd->slot_index);
        }
    }

    return max_slot + 1;  // Next available slot
}

/**
 * Compact slots after an OSD expires (move remaining slots up)
 */
void VlcPlayer::CompactSlots(OSDPosition position) {
    if (position != OSDPosition::TOP_RIGHT) return;

    // Collect all active OSDs in this position
    std::vector<std::shared_ptr<OSDElement>> sorted_osds;
    for (auto& osd : active_osds_) {
        if (osd->position == position && osd->opacity > 0.0f) {
            sorted_osds.push_back(osd);
        }
    }

    // Sort by current slot index
    std::sort(sorted_osds.begin(), sorted_osds.end(),
              [](const auto& a, const auto& b) {
                  return a->slot_index < b->slot_index;
              });

    // Reassign sequential slot indices (0, 1, 2, ...)
    for (size_t i = 0; i < sorted_osds.size(); ++i) {
        sorted_osds[i]->slot_index = static_cast<int>(i);
    }
}

/**
 * Update OSD lifecycles: fade in/out and expiration
 */
void VlcPlayer::UpdateOSDLifecycles() {
    auto now = std::chrono::steady_clock::now();
    const float fade_duration = 200.0f;  // 200ms fade in/out

    for (auto& osd : active_osds_) {
        // Calculate elapsed time since creation
        auto elapsed = std::chrono::duration<float, std::milli>(
            now - osd->created_at
        ).count();

        // Calculate total duration for this OSD
        auto total_duration = std::chrono::duration<float, std::milli>(
            osd->expire_at - osd->created_at
        ).count();

        // Calculate time remaining until expiration
        auto time_remaining = std::chrono::duration<float, std::milli>(
            osd->expire_at - now
        ).count();

        // State machine for opacity
        if (elapsed < fade_duration) {
            // Phase 1: Fade in (0-200ms)
            osd->opacity = elapsed / fade_duration;
            osd->fading_out = false;
        }
        else if (elapsed >= fade_duration && time_remaining > fade_duration) {
            // Phase 2: Fully visible (200ms - (total-200ms))
            osd->opacity = 1.0f;
            osd->fading_out = false;
        }
        else if (time_remaining > 0.0f && time_remaining <= fade_duration) {
            // Phase 3: Fade out (last 200ms)
            osd->opacity = time_remaining / fade_duration;
            osd->fading_out = true;
        }
        else {
            // Phase 4: Expired
            osd->opacity = 0.0f;
            osd->fading_out = true;
        }

        // Debug log with real timestamp (can be removed later)
        if (elapsed < 100.0f || (time_remaining < 300.0f && time_remaining > 0.0f)) {
            // Get current time in milliseconds since epoch
            auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()
            ).count();

            printf("[%lld] [VLC OSD] type=%d, elapsed=%.0fms, remaining=%.0fms, opacity=%.2f\n",
                   now_ms, static_cast<int>(osd->type), elapsed, time_remaining, osd->opacity);
            fflush(stdout);
        }
    }
}

/**
 * Remove expired OSDs and cleanup resources
 */
void VlcPlayer::RemoveExpiredOSDs() {
    auto it = active_osds_.begin();
    while (it != active_osds_.end()) {
        if ((*it)->opacity <= 0.0f && (*it)->fading_out) {
            // Cleanup platform-specific resources
            DestroyOSDWindow(*it);

            // Remove from active list
            it = active_osds_.erase(it);
        } else {
            ++it;
        }
    }
}

/**
 * Show OSD with specified type and content
 */
void VlcPlayer::ShowOSD(OSDType type, const std::string& text,
                        const std::string& subtext, float progress) {
    if (!child_window_created_ || !display_) {
        return;  // Window not ready
    }

    std::lock_guard<std::mutex> lock(osd_mutex_);

    OSDPosition position = GetPositionForType(type);

    // For PLAYBACK type in TOP_RIGHT: replace existing playback OSD
    // For other TOP_RIGHT types: find new slot
    std::shared_ptr<OSDElement> existing_osd = nullptr;

    if (type == OSDType::PLAYBACK && position == OSDPosition::TOP_RIGHT) {
        // Replace existing playback OSD in slot 0
        for (auto& osd : active_osds_) {
            if (osd->type == OSDType::PLAYBACK && osd->position == OSDPosition::TOP_RIGHT) {
                existing_osd = osd;
                break;
            }
        }
    } else if (position != OSDPosition::TOP_RIGHT) {
        // For non-queue positions (VOLUME, SEEK): replace existing of same type
        for (auto& osd : active_osds_) {
            if (osd->type == type) {
                existing_osd = osd;
                break;
            }
        }
    }

    // Update existing or create new
    if (existing_osd) {
        // Update existing OSD with same duration logic
        existing_osd->text = text;
        existing_osd->subtext = subtext;
        existing_osd->progress = progress;
        existing_osd->created_at = std::chrono::steady_clock::now();

        int duration_ms;
        if (type == OSDType::SEEK) {
            duration_ms = 4000;
        } else if (type == OSDType::VOLUME) {
            duration_ms = 3000;
        } else {
            duration_ms = 2500;
        }

        existing_osd->expire_at = existing_osd->created_at + std::chrono::milliseconds(duration_ms);
        existing_osd->opacity = 0.0f;  // Restart fade in
        existing_osd->fading_out = false;
    } else {
        // Create new OSD
        auto osd = std::make_shared<OSDElement>();
        osd->type = type;
        osd->position = position;
        osd->text = text;
        osd->subtext = subtext;
        osd->progress = progress;
        osd->created_at = std::chrono::steady_clock::now();

        // Duration: fade_in (200ms) + hold + fade_out (200ms)
        // Total times: Seek=4s, Volume=3s, Others=2.5s
        int duration_ms;
        if (type == OSDType::SEEK) {
            duration_ms = 4000;  // 200 + 3600 + 200 = 4 seconds
        } else if (type == OSDType::VOLUME) {
            duration_ms = 3000;  // 200 + 2600 + 200 = 3 seconds
        } else {
            duration_ms = 2500;  // 200 + 2100 + 200 = 2.5 seconds
        }

        osd->expire_at = osd->created_at + std::chrono::milliseconds(duration_ms);
        osd->opacity = 0.0f;
        osd->fading_out = false;

        // Assign slot for queued positions
        osd->slot_index = CalculateSlotIndex(position);

        active_osds_.push_back(osd);
    }

    printf("[VLC OSD] ShowOSD: type=%d, text='%s', subtext='%s', progress=%.2f\n",
           static_cast<int>(type), text.c_str(), subtext.c_str(), progress);
    fflush(stdout);
}

/**
 * Hide OSD of specified type
 */
void VlcPlayer::HideOSD(OSDType type) {
    std::lock_guard<std::mutex> lock(osd_mutex_);

    for (auto& osd : active_osds_) {
        if (osd->type == type) {
            osd->expire_at = std::chrono::steady_clock::now();  // Force immediate fade out
        }
    }
}

/**
 * Update existing OSD (without creating new one)
 */
void VlcPlayer::UpdateOSD(OSDType type, const std::string& text, float progress) {
    std::lock_guard<std::mutex> lock(osd_mutex_);

    for (auto& osd : active_osds_) {
        if (osd->type == type) {
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
void VlcPlayer::InitializeOSD() {
    printf("[VLC OSD] Initializing OSD system...\n");
    fflush(stdout);

    // Initialize color palette
#ifdef __linux__
    if (display_) {
        // Open dedicated display connection for OSD thread
        osd_display_ = XOpenDisplay(NULL);
        if (!osd_display_) {
            printf("[VLC OSD] ERROR: Failed to open dedicated X11 display connection\n");
            return;
        }

        osd_colors_.background = AllocColor(0x1a1a1a);      // Dark gray
        osd_colors_.text_primary = AllocColor(0xffffff);    // White
        osd_colors_.text_secondary = AllocColor(0xb0b0b0);  // Light gray
        osd_colors_.progress_fg = AllocColor(0x4a9eff);     // Blue accent
        osd_colors_.progress_bg = AllocColor(0x3a3a3a);     // Dark gray
        osd_colors_.border = AllocColor(0x2a2a2a);          // Subtle border

        // Create GC for OSD rendering using OSD display
        // Note: child_window_ belongs to main display, but we can use it as drawable reference
        // IF we are careful. Better to use RootWindow of osd_display_ for GC creation if possible,
        // or wait until we create an OSD window.
        // Actually, for XCreateGC, the drawable determines the screen/depth.
        // We will create GC later or use DefaultRootWindow of osd_display_.
        int screen = DefaultScreen(osd_display_);
        osd_gc_ = XCreateGC(osd_display_, RootWindow(osd_display_, screen), 0, nullptr);

        // Load fonts using XCreateFontSet for UTF-8 support
        char **missing_list;
        int missing_count;
        char *def_string;

        osd_font_normal_ = XCreateFontSet(osd_display_,
            "-*-dejavu sans-medium-r-*-*-12-*-*-*-*-*-*-*,"
            "-*-liberation sans-medium-r-*-*-12-*-*-*-*-*-*-*,"
            "-*-*-medium-r-*-*-12-*-*-*-*-*-*-*",
            &missing_list, &missing_count, &def_string);

        if (missing_count > 0) {
            XFreeStringList(missing_list);
        }

        osd_font_bold_ = XCreateFontSet(osd_display_,
            "-*-dejavu sans-bold-r-*-*-14-*-*-*-*-*-*-*,"
            "-*-liberation sans-bold-r-*-*-14-*-*-*-*-*-*-*,"
            "-*-*-bold-r-*-*-14-*-*-*-*-*-*-*",
            &missing_list, &missing_count, &def_string);

        if (missing_count > 0) {
            XFreeStringList(missing_list);
        }

        if (!osd_font_bold_) {
            osd_font_bold_ = osd_font_normal_;
        }

        printf("[VLC OSD] X11 resources initialized (Display=%p, GC=%p)\n",
               (void*)osd_display_, (void*)osd_gc_);
        fflush(stdout);
    }
#endif

    // Start render loop
    StartOSDRenderLoop();

    printf("[VLC OSD] OSD system initialized\n");
    fflush(stdout);
}

/**
 * Shutdown OSD system
 */
void VlcPlayer::ShutdownOSD() {
    printf("[VLC OSD] Shutting down OSD system...\n");
    fflush(stdout);

    // Stop render loop
    StopOSDRenderLoop();

    // Cleanup all active OSDs
    {
        std::lock_guard<std::mutex> lock(osd_mutex_);
        for (auto& osd : active_osds_) {
            DestroyOSDWindow(osd);
        }
        active_osds_.clear();
    }

    // Cleanup X11 resources
#ifdef __linux__
    if (display_) {
        if (osd_display_) {
            if (osd_gc_) {
                XFreeGC(osd_display_, osd_gc_);
                osd_gc_ = nullptr;
            }
            if (osd_font_normal_ && osd_font_normal_ != osd_font_bold_) {
                XFreeFontSet(osd_display_, osd_font_normal_);
                osd_font_normal_ = nullptr;
            }
            if (osd_font_bold_) {
                XFreeFontSet(osd_display_, osd_font_bold_);
                osd_font_bold_ = nullptr;
            }
            XCloseDisplay(osd_display_);
            osd_display_ = nullptr;
        }
    }
#endif

    printf("[VLC OSD] OSD system shutdown complete\n");
    fflush(stdout);
}

/**
 * Start OSD render loop (60 FPS)
 */
void VlcPlayer::StartOSDRenderLoop() {
    if (osd_thread_running_) return;

    osd_thread_running_ = true;
    osd_render_thread_ = std::thread([this]() {
        const auto frame_duration = std::chrono::milliseconds(16);  // ~60 FPS

        printf("[VLC OSD] Render loop started\n");
        fflush(stdout);

        while (osd_thread_running_) {
            auto frame_start = std::chrono::steady_clock::now();

            {
                std::lock_guard<std::mutex> lock(osd_mutex_);

                // Update all OSD lifecycles (fade in/out)
                UpdateOSDLifecycles();

                // Render all visible OSDs
                for (auto& osd : active_osds_) {
                    if (osd->opacity > 0.0f) {
                        RenderOSD(osd);
                    }
                }

                // Remove expired OSDs
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
        fflush(stdout);
    });
}

/**
 * Stop OSD render loop
 */
void VlcPlayer::StopOSDRenderLoop() {
    if (!osd_thread_running_) return;

    osd_thread_running_ = false;

    if (osd_render_thread_.joinable()) {
        osd_render_thread_.join();
    }
}
