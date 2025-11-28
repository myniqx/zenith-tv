#include "vlc_player.h"
#include <vlc/vlc.h>
#include <string>

// =================================================================================================
// Context Menu Action Handler
// =================================================================================================

void VlcPlayer::ExecuteMenuAction(const std::string& action) {
    printf("[VLC] Executing menu action: %s\n", action.c_str());
    fflush(stdout);
    
    if (!media_player_) {
        printf("[VLC] No media player available\n");
        fflush(stdout);
        return;
    }
    
    // Playback actions
    if (action == "playPause") {
        if (libvlc_media_player_is_playing(media_player_)) {
            libvlc_media_player_pause(media_player_);
        } else {
            libvlc_media_player_play(media_player_);
        }
    }
    else if (action == "stop") {
        libvlc_media_player_stop(media_player_);
    }
    else if (action == "forward1") {
        int64_t time = libvlc_media_player_get_time(media_player_);
        libvlc_media_player_set_time(media_player_, time + 1000);  // +1 second
    }
    else if (action == "forward10") {
        int64_t time = libvlc_media_player_get_time(media_player_);
        libvlc_media_player_set_time(media_player_, time + 10000);  // +10 seconds
    }
    else if (action == "backward1") {
        int64_t time = libvlc_media_player_get_time(media_player_);
        libvlc_media_player_set_time(media_player_, time - 1000);  // -1 second
    }
    else if (action == "backward10") {
        int64_t time = libvlc_media_player_get_time(media_player_);
        libvlc_media_player_set_time(media_player_, time - 10000);  // -10 seconds
    }
    
    // Window mode actions
    else if (action == "fullscreen") {
        SetWindowFullscreen(!is_fullscreen_);
        is_fullscreen_ = !is_fullscreen_;
    }
    else if (action == "stickyMode") {
        // Sticky mode: always on top, no taskbar
        SetWindowOnTop(true);
        SetWindowStyle(true, true, true, false);  // Keep border/titlebar, remove from taskbar
    }
    else if (action == "freeScreenMode") {
        // Free screen mode: borderless, no decorations
        SetWindowStyle(false, false, false, true);  // No border, no titlebar
    }
    
    // Subtitle actions
    else if (action == "subtitleDelayPlus") {
        int64_t currentDelay = libvlc_video_get_spu_delay(media_player_);
        libvlc_video_set_spu_delay(media_player_, currentDelay + 100000);  // +100ms in microseconds
    }
    else if (action == "subtitleDelayMinus") {
        int64_t currentDelay = libvlc_video_get_spu_delay(media_player_);
        libvlc_video_set_spu_delay(media_player_, currentDelay - 100000);  // -100ms in microseconds
    }
    else if (action == "subtitleDisable") {
        libvlc_video_set_spu(media_player_, -1);  // Disable subtitles
    }
    else if (action.find("subtitleTrack_") == 0) {
        int trackId = std::stoi(action.substr(14));
        libvlc_video_set_spu(media_player_, trackId);
    }
    
    // Audio actions
    else if (action == "volumeUp") {
        int volume = libvlc_audio_get_volume(media_player_);
        libvlc_audio_set_volume(media_player_, std::min(volume + 10, 100));
    }
    else if (action == "volumeDown") {
        int volume = libvlc_audio_get_volume(media_player_);
        libvlc_audio_set_volume(media_player_, std::max(volume - 10, 0));
    }
    else if (action == "mute") {
        int muted = libvlc_audio_get_mute(media_player_);
        libvlc_audio_set_mute(media_player_, !muted);
    }
    else if (action.find("audioTrack_") == 0) {
        int trackId = std::stoi(action.substr(11));
        libvlc_audio_set_track(media_player_, trackId);
    }
    
    // Video actions - Aspect Ratio
    else if (action.find("aspectRatio_") == 0) {
        std::string ratio = action.substr(12);
        if (ratio == "Default") {
            libvlc_video_set_aspect_ratio(media_player_, nullptr);
        } else {
            libvlc_video_set_aspect_ratio(media_player_, ratio.c_str());
        }
    }
    
    // Video actions - Crop
    else if (action.find("crop_") == 0) {
        std::string crop = action.substr(5);
        if (crop == "Default") {
            libvlc_video_set_crop_geometry(media_player_, nullptr);
        } else {
            libvlc_video_set_crop_geometry(media_player_, crop.c_str());
        }
    }
    
    // Video actions - Deinterlace
    else if (action.find("deinterlace_") == 0) {
        std::string mode = action.substr(12);
        if (mode == "Off") {
            libvlc_video_set_deinterlace(media_player_, nullptr);
        } else {
            // Convert mode name to lowercase for libvlc
            std::string vlcMode = mode;
            std::transform(vlcMode.begin(), vlcMode.end(), vlcMode.begin(), ::tolower);
            
            // Handle special cases
            if (mode == "Yadif (2x)") {
                vlcMode = "yadif2x";
            }
            
            libvlc_video_set_deinterlace(media_player_, vlcMode.c_str());
        }
    }
    
    else {
        printf("[VLC] Unknown menu action: %s\n", action.c_str());
        fflush(stdout);
    }
}
