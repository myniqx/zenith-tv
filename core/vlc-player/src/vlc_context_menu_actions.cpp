#include "vlc_player.h"
#include <vlc/vlc.h>
#include <string>

// =================================================================================================
// Context Menu Action Handler
// =================================================================================================

void VlcPlayer::ExecuteMenuAction(const std::string& action) {
    printf("[VLC] Executing menu action: %s\n", action.c_str());
    fflush(stdout);

    // Check if this action is in our known shortcuts list (key atanmış olsun veya olmasın)
    // If yes, emit as shortcut event to frontend and return (frontend handles everything)
    if (IsKnownAction(action)) {
        printf("[VLC] Known action '%s', emitting shortcut event to frontend\n", action.c_str());
        fflush(stdout);

        if (tsfn_events_) {
            auto callback = [action](Napi::Env env, Napi::Function jsCallback) {
                Napi::Object payload = Napi::Object::New(env);
                payload.Set("shortcut", Napi::String::New(env, action));
                jsCallback.Call({payload});
            };
            tsfn_events_.NonBlockingCall(callback);
        }

        // Return immediately - frontend will handle this action
        return;
    }

    if (!media_player_) {
        printf("[VLC] No media player available\n");
        fflush(stdout);
        return;
    }

    // Only legacy/unknown actions continue below (dynamic actions like track selection)

    // Dynamic subtitle track selection
    if (action.find("subtitleTrack_") == 0) {
        int trackId = std::stoi(action.substr(14));
        libvlc_video_set_spu(media_player_, trackId);
    }

    // Dynamic audio track selection
    else if (action.find("audioTrack_") == 0) {
        int trackId = std::stoi(action.substr(11));
        libvlc_audio_set_track(media_player_, trackId);
    }

    // Dynamic video actions - Aspect Ratio
    else if (action.find("aspectRatio_") == 0) {
        std::string ratio = action.substr(12);
        if (ratio == "Default") {
            libvlc_video_set_aspect_ratio(media_player_, nullptr);
        } else {
            libvlc_video_set_aspect_ratio(media_player_, ratio.c_str());
        }
    }

    // Dynamic video actions - Crop
    else if (action.find("crop_") == 0) {
        std::string crop = action.substr(5);
        if (crop == "Default") {
            libvlc_video_set_crop_geometry(media_player_, nullptr);
        } else {
            libvlc_video_set_crop_geometry(media_player_, crop.c_str());
        }
    }

    // Dynamic video actions - Deinterlace
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
