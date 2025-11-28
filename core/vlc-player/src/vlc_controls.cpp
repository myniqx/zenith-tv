#include "vlc_player.h"
#include <algorithm>

// =================================================================================================
// Unified API Implementation
// =================================================================================================

Napi::Value VlcPlayer::Open(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object options = info[0].As<Napi::Object>();
    
    if (!options.Has("file") || !options.Get("file").IsString()) {
        Napi::Error::New(env, "File path/url is required").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string url = options.Get("file").As<Napi::String>().Utf8Value();

    // Store other options for media initialization
    media_options_.clear();

    // Check for subtitle options
    if (options.Has("subtitle")) {
        // Napi::Object subOpts = options.Get("subtitle").As<Napi::Object>();
        // Add subtitle options to media_options_ map if needed for libvlc_media_add_option
        // For now, we handle them via Subtitle() method after media is playing,
        // but some might need to be set here if they are media-level options.
    }

    // Get initial window size from options
    int window_width = 1280;  // Default 16:9
    int window_height = 720;

    if (options.Has("window")) {
        Napi::Object windowOpts = options.Get("window").As<Napi::Object>();
        if (windowOpts.Has("width")) {
            window_width = windowOpts.Get("width").As<Napi::Number>().Int32Value();
        }
        if (windowOpts.Has("height")) {
            window_height = windowOpts.Get("height").As<Napi::Number>().Int32Value();
        }
    }

    // Call internal SetMedia logic
    // We can reuse the logic but we need to adapt it to use media_options_

    if (url.empty()) {
        Napi::Error::New(env, "Empty URL provided").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::lock_guard<std::mutex> lock(mutex_);

    // Create window if in "win" mode and not created yet
    if (rendering_mode_ == "win" && !child_window_created_) {
        CreateChildWindowInternal(window_width, window_height);
    }

    // Release previous media
    if (current_media_) {
        libvlc_media_release(current_media_);
    }

    // Create new media
    bool is_url = url.find("://") != std::string::npos;
    if (is_url) {
        current_media_ = libvlc_media_new_location(vlc_instance_, url.c_str());
    } else {
        current_media_ = libvlc_media_new_path(vlc_instance_, url.c_str());
    }

    if (!current_media_) {
        Napi::Error::New(env, "Failed to create media").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Apply media options
    for (const auto& opt : media_options_) {
        std::string option_str = opt.first + "=" + opt.second;
        libvlc_media_add_option(current_media_, option_str.c_str());
    }

    libvlc_media_player_set_media(media_player_, current_media_);

    // Release media immediately after setting
    libvlc_media_release(current_media_);
    current_media_ = nullptr;

    // Re-set window handle if needed
    if (child_window_created_ && rendering_mode_ == "win") {
        #ifdef _WIN32
        if (child_hwnd_) libvlc_media_player_set_hwnd(media_player_, child_hwnd_);
        #elif defined(__linux__)
        if (child_window_) libvlc_media_player_set_xwindow(media_player_, static_cast<uint32_t>(child_window_));
        #elif defined(__APPLE__)
        if (child_nsview_) libvlc_media_player_set_nsobject(media_player_, child_nsview_);
        #endif
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Playback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject()) return env.Undefined();

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_) return env.Undefined();

    if (options.Has("action")) {
        std::string action = options.Get("action").As<Napi::String>().Utf8Value();
        if (action == "play") {
            // Enforce window binding before play to ensure it's not lost
            if (child_window_created_ && rendering_mode_ == "win") {
                #ifdef _WIN32
                if (child_hwnd_) {
                    printf("[VLC] CALL: libvlc_media_player_set_hwnd(hwnd=%p)\n", child_hwnd_);
                    libvlc_media_player_set_hwnd(media_player_, child_hwnd_);
                    fflush(stdout);
                }
                #elif defined(__linux__)
                if (child_window_) {
                    if (child_window_ > UINT32_MAX) {
                        printf("[VLC] ERROR: Window ID 0x%lx exceeds 32-bit limit\n", child_window_);
                        fflush(stdout);
                    } else {
                        printf("[VLC] CALL: libvlc_media_player_set_xwindow(xwindow=0x%lx)\n", child_window_);
                        libvlc_media_player_set_xwindow(media_player_, static_cast<uint32_t>(child_window_));
                        fflush(stdout);
                    }
                }
                #elif defined(__APPLE__)
                if (child_nsview_) {
                    printf("[VLC] CALL: libvlc_media_player_set_nsobject(nsview=%p)\n", child_nsview_);
                    libvlc_media_player_set_nsobject(media_player_, child_nsview_);
                    fflush(stdout);
                }
                #endif
            }

            printf("[VLC] CALL: libvlc_media_player_play()\n");
            int result = libvlc_media_player_play(media_player_);
            printf("[VLC] RETURN: result=%d\n", result);
            fflush(stdout);

            // Check state after play
            libvlc_state_t state = libvlc_media_player_get_state(media_player_);
            const char* state_str = "unknown";
            switch (state) {
                case libvlc_NothingSpecial: state_str = "NothingSpecial"; break;
                case libvlc_Opening: state_str = "Opening"; break;
                case libvlc_Buffering: state_str = "Buffering"; break;
                case libvlc_Playing: state_str = "Playing"; break;
                case libvlc_Paused: state_str = "Paused"; break;
                case libvlc_Stopped: state_str = "Stopped"; break;
                case libvlc_Ended: state_str = "Ended"; break;
                case libvlc_Error: state_str = "Error"; break;
            }
            printf("[VLC] CALL: libvlc_media_player_get_state()\n");
            printf("[VLC] RETURN: state=%s\n", state_str);
            fflush(stdout);
        }
        else if (action == "pause") {
            printf("[VLC] CALL: libvlc_media_player_pause()\n");
            libvlc_media_player_pause(media_player_);
            fflush(stdout);
        }
        else if (action == "resume") {
            printf("[VLC] CALL: libvlc_media_player_set_pause(pause=0)\n");
            libvlc_media_player_set_pause(media_player_, 0);
            fflush(stdout);
        }
        else if (action == "stop") {
            printf("[VLC] CALL: libvlc_media_player_stop()\n");
            libvlc_media_player_stop(media_player_);
            fflush(stdout);

            // Auto-destroy window when stopping in window rendering mode
            if (rendering_mode_ == "win" && child_window_created_) {
                printf("[VLC] Auto-destroying window on stop\n");
                fflush(stdout);
                DestroyChildWindowInternal();
            }
        }
    }

    if (options.Has("time")) {
        int64_t time = options.Get("time").As<Napi::Number>().Int64Value();
        libvlc_media_player_set_time(media_player_, time);
    }

    if (options.Has("position")) {
        float pos = options.Get("position").As<Napi::Number>().FloatValue();
        libvlc_media_player_set_position(media_player_, pos);
    }

    if (options.Has("rate")) {
        float rate = options.Get("rate").As<Napi::Number>().FloatValue();
        libvlc_media_player_set_rate(media_player_, rate);
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Audio(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject()) return env.Undefined();

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_) return env.Undefined();

    if (options.Has("volume")) {
        int vol = options.Get("volume").As<Napi::Number>().Int32Value();
        libvlc_audio_set_volume(media_player_, vol);
    }

    if (options.Has("mute")) {
        bool mute = options.Get("mute").As<Napi::Boolean>().Value();
        libvlc_audio_set_mute(media_player_, mute ? 1 : 0);
    }

    if (options.Has("track")) {
        int track = options.Get("track").As<Napi::Number>().Int32Value();
        libvlc_audio_set_track(media_player_, track);
    }

    if (options.Has("delay")) {
        int64_t delay = options.Get("delay").As<Napi::Number>().Int64Value();
        libvlc_audio_set_delay(media_player_, delay);

        // Emit event with new delay value
        if (tsfn_events_) {
            tsfn_events_.NonBlockingCall([delay](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object currentVideo = Napi::Object::New(env);
                currentVideo.Set("audioDelay", Napi::Number::New(env, static_cast<double>(delay)));
                payload.Set("currentVideo", currentVideo);
                callback.Call({payload});
            });
        }
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Video(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject()) return env.Undefined();

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_) return env.Undefined();

    if (options.Has("track")) {
        int track = options.Get("track").As<Napi::Number>().Int32Value();
        libvlc_video_set_track(media_player_, track);
    }
    
    // Scale
    if (options.Has("scale")) {
        float scale = options.Get("scale").As<Napi::Number>().FloatValue();
        libvlc_video_set_scale(media_player_, scale);

        // Emit event
        if (tsfn_events_) {
            tsfn_events_.NonBlockingCall([scale](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object currentVideo = Napi::Object::New(env);
                currentVideo.Set("scale", Napi::Number::New(env, scale));
                payload.Set("currentVideo", currentVideo);
                callback.Call({payload});
            });
        }
    }

    // Aspect Ratio
    if (options.Has("aspectRatio")) {
        std::string ar = options.Get("aspectRatio").As<Napi::String>().Utf8Value();
        libvlc_video_set_aspect_ratio(media_player_, ar.empty() ? nullptr : ar.c_str());

        // Emit event
        if (tsfn_events_) {
            std::string aspectRatio = ar; // Capture for lambda
            tsfn_events_.NonBlockingCall([aspectRatio](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object currentVideo = Napi::Object::New(env);
                if (aspectRatio.empty()) {
                    currentVideo.Set("aspectRatio", env.Null());
                } else {
                    currentVideo.Set("aspectRatio", Napi::String::New(env, aspectRatio));
                }
                payload.Set("currentVideo", currentVideo);
                callback.Call({payload});
            });
        }
    }

    // Crop
    if (options.Has("crop")) {
        std::string crop = options.Get("crop").As<Napi::String>().Utf8Value();
        libvlc_video_set_crop_geometry(media_player_, crop.empty() ? nullptr : crop.c_str());

        // Emit event
        if (tsfn_events_) {
            std::string cropValue = crop; // Capture for lambda
            tsfn_events_.NonBlockingCall([cropValue](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object currentVideo = Napi::Object::New(env);
                if (cropValue.empty()) {
                    currentVideo.Set("crop", env.Null());
                } else {
                    currentVideo.Set("crop", Napi::String::New(env, cropValue));
                }
                payload.Set("currentVideo", currentVideo);
                callback.Call({payload});
            });
        }
    }

    // Deinterlace
    if (options.Has("deinterlace")) {
        std::string mode = options.Get("deinterlace").As<Napi::String>().Utf8Value();
        if (mode == "off") {
            libvlc_video_set_deinterlace(media_player_, nullptr);
        } else {
            libvlc_video_set_deinterlace(media_player_, mode.c_str());
        }

        // Emit event
        if (tsfn_events_) {
            std::string deinterlace = mode; // Capture for lambda
            tsfn_events_.NonBlockingCall([deinterlace](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object currentVideo = Napi::Object::New(env);
                if (deinterlace == "off") {
                    currentVideo.Set("deinterlace", env.Null());
                } else {
                    currentVideo.Set("deinterlace", Napi::String::New(env, deinterlace));
                }
                payload.Set("currentVideo", currentVideo);
                callback.Call({payload});
            });
        }
    }

    // Teletext
    if (options.Has("teletext")) {
        int page = options.Get("teletext").As<Napi::Number>().Int32Value();
        libvlc_video_set_teletext(media_player_, page);
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Subtitle(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject()) return env.Undefined();

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_) return env.Undefined();

    if (options.Has("track")) {
        int track = options.Get("track").As<Napi::Number>().Int32Value();
        libvlc_video_set_spu(media_player_, track);
    }

    if (options.Has("delay")) {
        int64_t delay = options.Get("delay").As<Napi::Number>().Int64Value();
        libvlc_video_set_spu_delay(media_player_, delay);

        // Emit event with new delay value
        if (tsfn_events_) {
            tsfn_events_.NonBlockingCall([delay](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object currentVideo = Napi::Object::New(env);
                currentVideo.Set("subtitleDelay", Napi::Number::New(env, static_cast<double>(delay)));
                payload.Set("currentVideo", currentVideo);
                callback.Call({payload});
            });
        }
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::GetMediaInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::lock_guard<std::mutex> lock(mutex_);
    return GetMediaInfoObject(env);
}

Napi::Object VlcPlayer::GetMediaInfoObject(Napi::Env env) {
    Napi::Object result = Napi::Object::New(env);
    
    // Note: mutex_ should be locked by caller if needed, but here we access libvlc functions which are thread-safe 
    // or we should lock. Since this is called from JS (GetMediaInfo) and Event Thread (HandleLengthChanged), 
    // we need to be careful. 
    // However, GetMediaInfo locks mutex_. HandleLengthChanged doesn't lock mutex_ but runs on VLC thread.
    // libvlc functions are generally thread-safe.
    
    if (!media_player_) return result;

    // Duration
    result.Set("duration", Napi::Number::New(env, libvlc_media_player_get_length(media_player_)));
    
    // Is Seekable
    result.Set("isSeekable", Napi::Boolean::New(env, libvlc_media_player_is_seekable(media_player_)));
    
    // Meta (Basic)
    Napi::Object meta = Napi::Object::New(env);
    // TODO: Implement meta retrieval if needed
    result.Set("meta", meta);

    // Audio Tracks
    Napi::Array audioTracks = Napi::Array::New(env);
    libvlc_track_description_t* a_tracks = libvlc_audio_get_track_description(media_player_);
    if (a_tracks) {
        libvlc_track_description_t* t = a_tracks;
        int i = 0;
        while(t) {
            Napi::Object track = Napi::Object::New(env);
            track.Set("id", t->i_id);
            track.Set("name", t->psz_name ? t->psz_name : "");
            audioTracks.Set(i++, track);
            t = t->p_next;
        }
        libvlc_track_description_list_release(a_tracks);
    }
    result.Set("audioTracks", audioTracks);

    // Subtitle Tracks
    Napi::Array subTracks = Napi::Array::New(env);
    libvlc_track_description_t* s_tracks = libvlc_video_get_spu_description(media_player_);
    if (s_tracks) {
        libvlc_track_description_t* t = s_tracks;
        int i = 0;
        while(t) {
            Napi::Object track = Napi::Object::New(env);
            track.Set("id", t->i_id);
            track.Set("name", t->psz_name ? t->psz_name : "");
            subTracks.Set(i++, track);
            t = t->p_next;
        }
        libvlc_track_description_list_release(s_tracks);
    }
    result.Set("subtitleTracks", subTracks);

    // Video Tracks
    Napi::Array videoTracks = Napi::Array::New(env);
    libvlc_track_description_t* v_tracks = libvlc_video_get_track_description(media_player_);
    if (v_tracks) {
        libvlc_track_description_t* t = v_tracks;
        int i = 0;
        while(t) {
            Napi::Object track = Napi::Object::New(env);
            track.Set("id", t->i_id);
            track.Set("name", t->psz_name ? t->psz_name : "");
            videoTracks.Set(i++, track);
            t = t->p_next;
        }
        libvlc_track_description_list_release(v_tracks);
    }
    result.Set("videoTracks", videoTracks);

    // Current Tracks
    result.Set("currentAudioTrack", Napi::Number::New(env, libvlc_audio_get_track(media_player_)));
    result.Set("currentSubtitleTrack", Napi::Number::New(env, libvlc_video_get_spu(media_player_)));
    result.Set("currentVideoTrack", Napi::Number::New(env, libvlc_video_get_track(media_player_)));

    return result;
}

Napi::Value VlcPlayer::GetPlayerInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);
    
    std::lock_guard<std::mutex> lock(mutex_);
    if (!media_player_) return result;

    // Current time
    result.Set("time", Napi::Number::New(env, libvlc_media_player_get_time(media_player_)));
    
    // Length/Duration
    result.Set("length", Napi::Number::New(env, libvlc_media_player_get_length(media_player_)));
    
    // State
    libvlc_state_t vlc_state = libvlc_media_player_get_state(media_player_);
    std::string state_str;
    switch (vlc_state) {
        case libvlc_NothingSpecial: state_str = "idle"; break;
        case libvlc_Opening: state_str = "opening"; break;
        case libvlc_Buffering: state_str = "buffering"; break;
        case libvlc_Playing: state_str = "playing"; break;
        case libvlc_Paused: state_str = "paused"; break;
        case libvlc_Stopped: state_str = "stopped"; break;
        case libvlc_Ended: state_str = "ended"; break;
        case libvlc_Error: state_str = "error"; break;
        default: state_str = "unknown"; break;
    }
    result.Set("state", Napi::String::New(env, state_str));
    
    // Is Playing
    result.Set("isPlaying", Napi::Boolean::New(env, libvlc_media_player_is_playing(media_player_)));

    return result;
}

// Core playback methods
// Time/Position
Napi::Value VlcPlayer::Seek(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Time in milliseconds expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int64_t time = static_cast<int64_t>(info[0].As<Napi::Number>().Int64Value());

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        printf("[VLC] CALL: libvlc_media_player_set_time(time=%lld)\n", (long long)time);
        libvlc_media_player_set_time(media_player_, time);
        fflush(stdout);
    }

    return env.Undefined();
}

// Volume control
Napi::Value VlcPlayer::SetVolume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Volume (0-100) expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int volume = info[0].As<Napi::Number>().Int32Value();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        printf("[VLC] CALL: libvlc_audio_set_volume(volume=%d)\n", volume);
        libvlc_audio_set_volume(media_player_, volume);
        fflush(stdout);

        // Emit PlayerInfo event
        if (tsfn_events_) {
            tsfn_events_.NonBlockingCall([volume](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object playerInfo = Napi::Object::New(env);
                playerInfo.Set("volume", Napi::Number::New(env, volume));
                payload.Set("playerInfo", playerInfo);
                callback.Call({payload});
            });
        }
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::SetMute(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBoolean()) {
        Napi::TypeError::New(env, "Boolean expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    bool mute = info[0].As<Napi::Boolean>().Value();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_audio_set_mute(media_player_, mute ? 1 : 0);

        // Emit PlayerInfo event
        if (tsfn_events_) {
            tsfn_events_.NonBlockingCall([mute](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object playerInfo = Napi::Object::New(env);
                playerInfo.Set("muted", Napi::Boolean::New(env, mute));
                payload.Set("playerInfo", playerInfo);
                callback.Call({payload});
            });
        }
    }

    return env.Undefined();
}

// Playback rate
Napi::Value VlcPlayer::SetRate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Rate expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    float rate = info[0].As<Napi::Number>().FloatValue();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_media_player_set_rate(media_player_, rate);

        // Emit PlayerInfo event
        if (tsfn_events_) {
            tsfn_events_.NonBlockingCall([rate](Napi::Env env, Napi::Function callback) {
                Napi::Object payload = Napi::Object::New(env);
                Napi::Object playerInfo = Napi::Object::New(env);
                playerInfo.Set("rate", Napi::Number::New(env, rate));
                payload.Set("playerInfo", playerInfo);
                callback.Call({payload});
            });
        }
    }

    return env.Undefined();
}

// Audio tracks
Napi::Value VlcPlayer::GetAudioTracks(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array tracks = Napi::Array::New(env);

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_track_description_t* track_desc = libvlc_audio_get_track_description(media_player_);
        libvlc_track_description_t* track = track_desc;

        uint32_t index = 0;
        while (track) {
            Napi::Object trackObj = Napi::Object::New(env);
            trackObj.Set("id", Napi::Number::New(env, track->i_id));
            trackObj.Set("name", Napi::String::New(env, track->psz_name ? track->psz_name : ""));
            tracks.Set(index++, trackObj);
            track = track->p_next;
        }

        if (track_desc) {
            libvlc_track_description_list_release(track_desc);
        }
    }

    return tracks;
}

Napi::Value VlcPlayer::SetAudioTrack(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Track ID expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int trackId = info[0].As<Napi::Number>().Int32Value();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int result = libvlc_audio_set_track(media_player_, trackId);
        return Napi::Boolean::New(env, result == 0);
    }

    return Napi::Boolean::New(env, false);
}

// Subtitle tracks
Napi::Value VlcPlayer::GetSubtitleTracks(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array tracks = Napi::Array::New(env);

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_track_description_t* track_desc = libvlc_video_get_spu_description(media_player_);
        libvlc_track_description_t* track = track_desc;

        uint32_t index = 0;
        while (track) {
            Napi::Object trackObj = Napi::Object::New(env);
            trackObj.Set("id", Napi::Number::New(env, track->i_id));
            trackObj.Set("name", Napi::String::New(env, track->psz_name ? track->psz_name : ""));
            tracks.Set(index++, trackObj);
            track = track->p_next;
        }

        if (track_desc) {
            libvlc_track_description_list_release(track_desc);
        }
    }

    return tracks;
}

Napi::Value VlcPlayer::SetSubtitleTrack(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Track ID expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int trackId = info[0].As<Napi::Number>().Int32Value();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int result = libvlc_video_set_spu(media_player_, trackId);
        return Napi::Boolean::New(env, result == 0);
    }

    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::SetSubtitleDelay(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Delay in microseconds expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int64_t delay = static_cast<int64_t>(info[0].As<Napi::Number>().Int64Value());

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int result = libvlc_video_set_spu_delay(media_player_, delay);
        return Napi::Boolean::New(env, result == 0);
    }

    return Napi::Boolean::New(env, false);
}

// Video tracks
Napi::Value VlcPlayer::GetVideoTracks(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array tracks = Napi::Array::New(env);

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_track_description_t* track_desc = libvlc_video_get_track_description(media_player_);
        libvlc_track_description_t* track = track_desc;

        uint32_t index = 0;
        while (track) {
            Napi::Object trackObj = Napi::Object::New(env);
            trackObj.Set("id", Napi::Number::New(env, track->i_id));
            trackObj.Set("name", Napi::String::New(env, track->psz_name ? track->psz_name : ""));
            tracks.Set(index++, trackObj);
            track = track->p_next;
        }

        if (track_desc) {
            libvlc_track_description_list_release(track_desc);
        }
    }

    return tracks;
}

// =================================================================================================
// Unified Window API
// =================================================================================================
Napi::Value VlcPlayer::Window(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        // Window not created yet
        return Napi::Boolean::New(env, false);
    }

    // Handle resize
    if (options.Has("resize")) {
        Napi::Object resize = options.Get("resize").As<Napi::Object>();
        int x = resize.Get("x").As<Napi::Number>().Int32Value();
        int y = resize.Get("y").As<Napi::Number>().Int32Value();
        int width = resize.Get("width").As<Napi::Number>().Int32Value();
        int height = resize.Get("height").As<Napi::Number>().Int32Value();
        SetWindowBounds(x, y, width, height);
    }

    // Handle fullscreen
    if (options.Has("fullscreen")) {
        bool fullscreen = options.Get("fullscreen").As<Napi::Boolean>().Value();

        if (fullscreen && !is_fullscreen_) {
            // Save current state before going fullscreen
            GetWindowBounds(&saved_window_state_);
        } else if (!fullscreen && is_fullscreen_) {
            // Restore previous state when exiting fullscreen
            SetWindowBounds(
                saved_window_state_.x,
                saved_window_state_.y,
                saved_window_state_.width,
                saved_window_state_.height
            );
        }

        SetWindowFullscreen(fullscreen);
        is_fullscreen_ = fullscreen;
    }

    // Handle onTop
    if (options.Has("onTop")) {
        bool onTop = options.Get("onTop").As<Napi::Boolean>().Value();
        SetWindowOnTop(onTop);
    }

    // Handle visible
    if (options.Has("visible")) {
        bool visible = options.Get("visible").As<Napi::Boolean>().Value();
        SetWindowVisible(visible);
    }

    // Handle style
    if (options.Has("style")) {
        Napi::Object style = options.Get("style").As<Napi::Object>();
        bool border = style.Has("border") ? style.Get("border").As<Napi::Boolean>().Value() : saved_window_state_.has_border;
        bool titleBar = style.Has("titleBar") ? style.Get("titleBar").As<Napi::Boolean>().Value() : saved_window_state_.has_titlebar;
        bool resizable = style.Has("resizable") ? style.Get("resizable").As<Napi::Boolean>().Value() : saved_window_state_.is_resizable;
        bool taskbar = style.Has("taskbar") ? style.Get("taskbar").As<Napi::Boolean>().Value() : true;

        SetWindowStyle(border, titleBar, resizable, taskbar);

        // Update saved state
        saved_window_state_.has_border = border;
        saved_window_state_.has_titlebar = titleBar;
        saved_window_state_.is_resizable = resizable;

        // If taskbar is false, also remove minimum size constraints for sticky mode
        if (!taskbar) {
            SetWindowMinSizeInternal(0, 0);
        } else {
            // Restore default minimum size
            SetWindowMinSizeInternal(320, 240);
        }
    }

    return Napi::Boolean::New(env, true);
}

// =================================================================================================
// Keyboard Shortcut API
// =================================================================================================

// Initialize default shortcuts
void VlcPlayer::InitializeDefaultShortcuts() {
    action_to_keys_.clear();

    // Playback controls
    action_to_keys_["playPause"] = {"Space", "MouseLeft"};
    action_to_keys_["stop"] = {};

    // Seeking
    action_to_keys_["seekForward"] = {"ArrowRight"};
    action_to_keys_["seekBackward"] = {"ArrowLeft"};
    action_to_keys_["seekForwardSmall"] = {};
    action_to_keys_["seekBackwardSmall"] = {};

    // Volume
    action_to_keys_["volumeUp"] = {"ArrowUp"};
    action_to_keys_["volumeDown"] = {"ArrowDown"};
    action_to_keys_["toggleMute"] = {};

    // Window modes
    action_to_keys_["toggleFullscreen"] = {"MouseMiddle"};
    action_to_keys_["exitFullscreen"] = {"Escape"};
    action_to_keys_["stickyMode"] = {};
    action_to_keys_["freeScreenMode"] = {};

    // Subtitle
    action_to_keys_["subtitleDelayPlus"] = {};
    action_to_keys_["subtitleDelayMinus"] = {};
    action_to_keys_["subtitleDisable"] = {};

    printf("[VLC] Default shortcuts initialized\n");
    fflush(stdout);
}

// Get first key for action (for context menu display)
std::string VlcPlayer::GetFirstKeyForAction(const std::string& action) {
    auto it = action_to_keys_.find(action);
    if (it != action_to_keys_.end() && !it->second.empty()) {
        return it->second[0];
    }
    return "";
}

// Check if action has any keys mapped
bool VlcPlayer::HasKeyForAction(const std::string& action) {
    auto it = action_to_keys_.find(action);
    return it != action_to_keys_.end() && !it->second.empty();
}

// Check if action is in our known actions list (regardless of whether keys are mapped)
bool VlcPlayer::IsKnownAction(const std::string& action) {
    return action_to_keys_.find(action) != action_to_keys_.end();
}

Napi::Value VlcPlayer::Shortcut(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object options = info[0].As<Napi::Object>();

    if (!options.Has("shortcuts") || !options.Get("shortcuts").IsObject()) {
        Napi::Error::New(env, "shortcuts object is required").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object shortcuts = options.Get("shortcuts").As<Napi::Object>();
    Napi::Array actions = shortcuts.GetPropertyNames();

    // Clear and rebuild map
    action_to_keys_.clear();

    // Build new format: { "playPause": ["Space", "KeyK"], "volumeUp": ["ArrowUp"] }
    for (uint32_t i = 0; i < actions.Length(); i++) {
        std::string action = actions.Get(i).As<Napi::String>().Utf8Value();
        Napi::Value keysValue = shortcuts.Get(action);

        std::vector<std::string> keys;

        // Support both array and single string
        if (keysValue.IsArray()) {
            Napi::Array keysArray = keysValue.As<Napi::Array>();
            for (uint32_t j = 0; j < keysArray.Length(); j++) {
                keys.push_back(keysArray.Get(j).As<Napi::String>().Utf8Value());
            }
        } else if (keysValue.IsString()) {
            keys.push_back(keysValue.As<Napi::String>().Utf8Value());
        }

        action_to_keys_[action] = keys;

        printf("[VLC] Registered shortcuts for '%s': ", action.c_str());
        for (const auto& key : keys) {
            printf("%s ", key.c_str());
        }
        printf("\n");
        fflush(stdout);
    }

    return env.Undefined();
}

// Process key press from platform-specific window event handlers
void VlcPlayer::ProcessKeyPress(const std::string& key_code) {
    // Reverse lookup: key -> action
    for (const auto& [action, keys] : action_to_keys_) {
        // Check if this key is in the keys list for this action
        if (std::find(keys.begin(), keys.end(), key_code) != keys.end()) {
            printf("[VLC] Key pressed: %s -> Action: %s\n", key_code.c_str(), action.c_str());
            fflush(stdout);

            // Emit shortcut event to JavaScript
            if (tsfn_events_) {
                auto callback = [action](Napi::Env env, Napi::Function jsCallback) {
                    Napi::Object payload = Napi::Object::New(env);
                    payload.Set("shortcut", Napi::String::New(env, action));
                    jsCallback.Call({payload});
                };
                tsfn_events_.NonBlockingCall(callback);
            }

            return; // Execute first matching action only
        }
    }

    // Key not mapped
    printf("[VLC] Unmapped key: %s\n", key_code.c_str());
    fflush(stdout);
}
