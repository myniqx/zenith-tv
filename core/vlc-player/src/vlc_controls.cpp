#include "vlc_player.h"

// Core playback methods
Napi::Value VlcPlayer::SetMedia(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "URL string expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string url = info[0].As<Napi::String>().Utf8Value();

    if (url.empty()) {
        Napi::Error::New(env, "Empty URL provided").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    if (url.length() > MAX_URL_LENGTH) {
        Napi::Error::New(env, "URL exceeds maximum length").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::lock_guard<std::mutex> lock(mutex_);

    // Release previous media
    if (current_media_) {
        printf("[VLC] CALL: libvlc_media_release(current_media=%p)\n", (void*)current_media_);
        libvlc_media_release(current_media_);
        fflush(stdout);
    }

    // Create new media from URL or path
    bool is_url = url.find("://") != std::string::npos;

    if (is_url) {
        printf("[VLC] CALL: libvlc_media_new_location(url='%s')\n", url.c_str());
        current_media_ = libvlc_media_new_location(vlc_instance_, url.c_str());
    } else {
        printf("[VLC] CALL: libvlc_media_new_path(path='%s')\n", url.c_str());
        current_media_ = libvlc_media_new_path(vlc_instance_, url.c_str());
    }
    printf("[VLC] RETURN: current_media=%p\n", (void*)current_media_);
    fflush(stdout);

    if (!current_media_) {
        Napi::Error::New(env, "Failed to create media").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    printf("[VLC] CALL: libvlc_media_player_set_media(media_player=%p, media=%p)\n",
           (void*)media_player_, (void*)current_media_);
    libvlc_media_player_set_media(media_player_, current_media_);
    fflush(stdout);

    // Release media immediately after setting (media player holds its own reference)
    printf("[VLC] CALL: libvlc_media_release(media=%p)\n", (void*)current_media_);
    libvlc_media_release(current_media_);
    current_media_ = nullptr;
    fflush(stdout);

    // Re-set window handle after media is set to ensure vout initializes
    if (child_window_created_) {
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

    return env.Undefined();
}

Napi::Value VlcPlayer::Play(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Optional: allow passing URL directly to play
    if (info.Length() > 0 && info[0].IsString()) {
        SetMedia(info);
    }

    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_) {
        return Napi::Boolean::New(env, false);
    }

    // Enforce window binding before play to ensure it's not lost
    if (child_window_created_) {
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
        #endif
    }

    // Check if xwindow is set
    #ifdef __linux__
    uint32_t xwin = libvlc_media_player_get_xwindow(media_player_);
    printf("[VLC] CALL: libvlc_media_player_get_xwindow()\n");
    printf("[VLC] RETURN: xwindow=0x%x\n", xwin);
    fflush(stdout);
    #endif

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

    return Napi::Boolean::New(env, result == 0);
}

Napi::Value VlcPlayer::Pause(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        printf("[VLC] CALL: libvlc_media_player_pause()\n");
        libvlc_media_player_pause(media_player_);
        fflush(stdout);
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Resume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        printf("[VLC] CALL: libvlc_media_player_set_pause(pause=0)\n");
        libvlc_media_player_set_pause(media_player_, 0);
        fflush(stdout);
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        printf("[VLC] CALL: libvlc_media_player_stop()\n");
        libvlc_media_player_stop(media_player_);
        fflush(stdout);
    }

    return env.Undefined();
}

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

Napi::Value VlcPlayer::GetTime(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int64_t time = libvlc_media_player_get_time(media_player_);
        return Napi::Number::New(env, static_cast<double>(time));
    }

    return Napi::Number::New(env, 0);
}

Napi::Value VlcPlayer::GetLength(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int64_t length = libvlc_media_player_get_length(media_player_);
        return Napi::Number::New(env, static_cast<double>(length));
    }

    return Napi::Number::New(env, 0);
}

Napi::Value VlcPlayer::GetPosition(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        float position = libvlc_media_player_get_position(media_player_);
        return Napi::Number::New(env, position);
    }

    return Napi::Number::New(env, 0);
}

Napi::Value VlcPlayer::SetPosition(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Position (0.0-1.0) expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    float position = info[0].As<Napi::Number>().FloatValue();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_media_player_set_position(media_player_, position);
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
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::GetVolume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int volume = libvlc_audio_get_volume(media_player_);
        return Napi::Number::New(env, volume);
    }

    return Napi::Number::New(env, 0);
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
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::GetMute(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int mute = libvlc_audio_get_mute(media_player_);
        return Napi::Boolean::New(env, mute != 0);
    }

    return Napi::Boolean::New(env, false);
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
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::GetRate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        float rate = libvlc_media_player_get_rate(media_player_);
        return Napi::Number::New(env, rate);
    }

    return Napi::Number::New(env, 1.0);
}

// State
Napi::Value VlcPlayer::GetState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_state_t state = libvlc_media_player_get_state(media_player_);

        std::string stateStr;
        switch (state) {
            case libvlc_NothingSpecial: stateStr = "idle"; break;
            case libvlc_Opening: stateStr = "opening"; break;
            case libvlc_Buffering: stateStr = "buffering"; break;
            case libvlc_Playing: stateStr = "playing"; break;
            case libvlc_Paused: stateStr = "paused"; break;
            case libvlc_Stopped: stateStr = "stopped"; break;
            case libvlc_Ended: stateStr = "ended"; break;
            case libvlc_Error: stateStr = "error"; break;
            default: stateStr = "unknown"; break;
        }

        return Napi::String::New(env, stateStr);
    }

    return Napi::String::New(env, "idle");
}

Napi::Value VlcPlayer::IsPlaying(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int playing = libvlc_media_player_is_playing(media_player_);
        return Napi::Boolean::New(env, playing != 0);
    }

    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::IsSeekable(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int seekable = libvlc_media_player_is_seekable(media_player_);
        return Napi::Boolean::New(env, seekable != 0);
    }

    return Napi::Boolean::New(env, false);
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

Napi::Value VlcPlayer::GetAudioTrack(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int track = libvlc_audio_get_track(media_player_);
        return Napi::Number::New(env, track);
    }

    return Napi::Number::New(env, -1);
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

Napi::Value VlcPlayer::GetSubtitleTrack(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int track = libvlc_video_get_spu(media_player_);
        return Napi::Number::New(env, track);
    }

    return Napi::Number::New(env, -1);
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

// Window embedding - Platform specific (Legacy)
Napi::Value VlcPlayer::SetWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Window handle expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_) {
        return Napi::Boolean::New(env, false);
    }

#ifdef _WIN32
    // Windows: Expect Buffer containing HWND
    if (info[0].IsBuffer()) {
        Napi::Buffer<void*> buffer = info[0].As<Napi::Buffer<void*>>();
        void* hwnd = *reinterpret_cast<void**>(buffer.Data());
        libvlc_media_player_set_hwnd(media_player_, hwnd);
        return Napi::Boolean::New(env, true);
    } else if (info[0].IsNumber()) {
        // Also accept number for backwards compatibility
        intptr_t hwnd = static_cast<intptr_t>(info[0].As<Napi::Number>().Int64Value());
        libvlc_media_player_set_hwnd(media_player_, reinterpret_cast<void*>(hwnd));
        return Napi::Boolean::New(env, true);
    }
#elif defined(__linux__)
    // Linux: X11 Window ID
    if (info[0].IsNumber()) {
        uint32_t xid = info[0].As<Napi::Number>().Uint32Value();
        libvlc_media_player_set_xwindow(media_player_, xid);
        return Napi::Boolean::New(env, true);
    }
#elif defined(__APPLE__)
    // macOS: NSView pointer
    if (info[0].IsBuffer()) {
        Napi::Buffer<void*> buffer = info[0].As<Napi::Buffer<void*>>();
        void* nsview = *reinterpret_cast<void**>(buffer.Data());
        libvlc_media_player_set_nsobject(media_player_, nsview);
        return Napi::Boolean::New(env, true);
    }
#endif

    Napi::TypeError::New(env, "Invalid window handle format").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
}
