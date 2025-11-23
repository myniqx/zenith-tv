/**
 * @zenith-tv/vlc-player - Native libVLC bindings for Node.js/Electron
 *
 * Provides cross-platform video playback with full codec support including:
 * - MKV container support
 * - Multi-track audio selection
 * - Multi-track subtitle selection (ASS, SRT, PGS, etc.)
 * - Live streaming (HLS, RTMP, RTSP)
 */

#include <napi.h>

// Windows-specific type definitions needed by VLC headers
#ifdef _WIN32
#include <BaseTsd.h>
typedef SSIZE_T ssize_t;
#endif

#include <cstdint>
#include <vlc/vlc.h>
#include <string>
#include <vector>
#include <mutex>
#include <atomic>

#ifdef _WIN32
#include <windows.h>
#elif defined(__linux__)
#include <X11/Xlib.h>
#elif defined(__APPLE__)
#include <objc/objc.h>
#endif

class VlcPlayer : public Napi::ObjectWrap<VlcPlayer> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VlcPlayer(const Napi::CallbackInfo& info);
    ~VlcPlayer();

private:
    // Core VLC methods
    Napi::Value Play(const Napi::CallbackInfo& info);
    Napi::Value Pause(const Napi::CallbackInfo& info);
    Napi::Value Resume(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value SetMedia(const Napi::CallbackInfo& info);

    // Playback control
    Napi::Value Seek(const Napi::CallbackInfo& info);
    Napi::Value SetVolume(const Napi::CallbackInfo& info);
    Napi::Value GetVolume(const Napi::CallbackInfo& info);
    Napi::Value SetMute(const Napi::CallbackInfo& info);
    Napi::Value GetMute(const Napi::CallbackInfo& info);
    Napi::Value SetRate(const Napi::CallbackInfo& info);
    Napi::Value GetRate(const Napi::CallbackInfo& info);

    // Time/Position
    Napi::Value GetTime(const Napi::CallbackInfo& info);
    Napi::Value GetLength(const Napi::CallbackInfo& info);
    Napi::Value GetPosition(const Napi::CallbackInfo& info);
    Napi::Value SetPosition(const Napi::CallbackInfo& info);

    // State
    Napi::Value GetState(const Napi::CallbackInfo& info);
    Napi::Value IsPlaying(const Napi::CallbackInfo& info);
    Napi::Value IsSeekable(const Napi::CallbackInfo& info);

    // Audio tracks
    Napi::Value GetAudioTracks(const Napi::CallbackInfo& info);
    Napi::Value GetAudioTrack(const Napi::CallbackInfo& info);
    Napi::Value SetAudioTrack(const Napi::CallbackInfo& info);

    // Subtitle tracks
    Napi::Value GetSubtitleTracks(const Napi::CallbackInfo& info);
    Napi::Value GetSubtitleTrack(const Napi::CallbackInfo& info);
    Napi::Value SetSubtitleTrack(const Napi::CallbackInfo& info);
    Napi::Value SetSubtitleDelay(const Napi::CallbackInfo& info);

    // Video tracks
    Napi::Value GetVideoTracks(const Napi::CallbackInfo& info);

    // Window embedding
    Napi::Value SetWindow(const Napi::CallbackInfo& info);

    // Event callbacks
    Napi::Value On(const Napi::CallbackInfo& info);
    Napi::Value Off(const Napi::CallbackInfo& info);

    // Cleanup
    Napi::Value Dispose(const Napi::CallbackInfo& info);

    // Internal members
    libvlc_instance_t* vlc_instance_;
    libvlc_media_player_t* media_player_;
    libvlc_media_t* current_media_;

    // Event handling
    Napi::ThreadSafeFunction tsfn_time_changed_;
    Napi::ThreadSafeFunction tsfn_state_changed_;
    Napi::ThreadSafeFunction tsfn_end_reached_;
    Napi::ThreadSafeFunction tsfn_error_;

    std::mutex mutex_;
    std::atomic<bool> disposed_{false};

    // Event manager
    libvlc_event_manager_t* event_manager_;

    void SetupEventCallbacks();
    void CleanupEventCallbacks();

    // Static event handlers
    static void HandleTimeChanged(const libvlc_event_t* event, void* data);
    static void HandleStateChanged(const libvlc_event_t* event, void* data);
    static void HandleEndReached(const libvlc_event_t* event, void* data);
    static void HandleError(const libvlc_event_t* event, void* data);
};

Napi::Object VlcPlayer::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VlcPlayer", {
        // Core methods
        InstanceMethod("play", &VlcPlayer::Play),
        InstanceMethod("pause", &VlcPlayer::Pause),
        InstanceMethod("resume", &VlcPlayer::Resume),
        InstanceMethod("stop", &VlcPlayer::Stop),
        InstanceMethod("setMedia", &VlcPlayer::SetMedia),

        // Playback control
        InstanceMethod("seek", &VlcPlayer::Seek),
        InstanceMethod("setVolume", &VlcPlayer::SetVolume),
        InstanceMethod("getVolume", &VlcPlayer::GetVolume),
        InstanceMethod("setMute", &VlcPlayer::SetMute),
        InstanceMethod("getMute", &VlcPlayer::GetMute),
        InstanceMethod("setRate", &VlcPlayer::SetRate),
        InstanceMethod("getRate", &VlcPlayer::GetRate),

        // Time/Position
        InstanceMethod("getTime", &VlcPlayer::GetTime),
        InstanceMethod("getLength", &VlcPlayer::GetLength),
        InstanceMethod("getPosition", &VlcPlayer::GetPosition),
        InstanceMethod("setPosition", &VlcPlayer::SetPosition),

        // State
        InstanceMethod("getState", &VlcPlayer::GetState),
        InstanceMethod("isPlaying", &VlcPlayer::IsPlaying),
        InstanceMethod("isSeekable", &VlcPlayer::IsSeekable),

        // Audio tracks
        InstanceMethod("getAudioTracks", &VlcPlayer::GetAudioTracks),
        InstanceMethod("getAudioTrack", &VlcPlayer::GetAudioTrack),
        InstanceMethod("setAudioTrack", &VlcPlayer::SetAudioTrack),

        // Subtitle tracks
        InstanceMethod("getSubtitleTracks", &VlcPlayer::GetSubtitleTracks),
        InstanceMethod("getSubtitleTrack", &VlcPlayer::GetSubtitleTrack),
        InstanceMethod("setSubtitleTrack", &VlcPlayer::SetSubtitleTrack),
        InstanceMethod("setSubtitleDelay", &VlcPlayer::SetSubtitleDelay),

        // Video tracks
        InstanceMethod("getVideoTracks", &VlcPlayer::GetVideoTracks),

        // Window
        InstanceMethod("setWindow", &VlcPlayer::SetWindow),

        // Events
        InstanceMethod("on", &VlcPlayer::On),
        InstanceMethod("off", &VlcPlayer::Off),

        // Cleanup
        InstanceMethod("dispose", &VlcPlayer::Dispose),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("VlcPlayer", func);
    return exports;
}

VlcPlayer::VlcPlayer(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VlcPlayer>(info),
      vlc_instance_(nullptr),
      media_player_(nullptr),
      current_media_(nullptr),
      event_manager_(nullptr) {

    Napi::Env env = info.Env();

    // Initialize VLC with standard arguments
    const char* args[] = {
        "--no-xlib",          // Don't use Xlib (for Linux headless compatibility)
        "--quiet",            // Reduce log verbosity
        "--no-video-title-show"  // Don't show title on video
    };

    vlc_instance_ = libvlc_new(sizeof(args) / sizeof(args[0]), args);

    if (!vlc_instance_) {
        Napi::Error::New(env, "Failed to initialize libVLC").ThrowAsJavaScriptException();
        return;
    }

    media_player_ = libvlc_media_player_new(vlc_instance_);

    if (!media_player_) {
        libvlc_release(vlc_instance_);
        vlc_instance_ = nullptr;
        Napi::Error::New(env, "Failed to create media player").ThrowAsJavaScriptException();
        return;
    }

    SetupEventCallbacks();
}

VlcPlayer::~VlcPlayer() {
    if (!disposed_) {
        CleanupEventCallbacks();

        if (media_player_) {
            libvlc_media_player_stop(media_player_);
            libvlc_media_player_release(media_player_);
            media_player_ = nullptr;
        }

        if (current_media_) {
            libvlc_media_release(current_media_);
            current_media_ = nullptr;
        }

        if (vlc_instance_) {
            libvlc_release(vlc_instance_);
            vlc_instance_ = nullptr;
        }
    }
}

void VlcPlayer::SetupEventCallbacks() {
    if (!media_player_) return;

    event_manager_ = libvlc_media_player_event_manager(media_player_);

    if (event_manager_) {
        libvlc_event_attach(event_manager_, libvlc_MediaPlayerTimeChanged, HandleTimeChanged, this);
        libvlc_event_attach(event_manager_, libvlc_MediaPlayerPlaying, HandleStateChanged, this);
        libvlc_event_attach(event_manager_, libvlc_MediaPlayerPaused, HandleStateChanged, this);
        libvlc_event_attach(event_manager_, libvlc_MediaPlayerStopped, HandleStateChanged, this);
        libvlc_event_attach(event_manager_, libvlc_MediaPlayerEndReached, HandleEndReached, this);
        libvlc_event_attach(event_manager_, libvlc_MediaPlayerEncounteredError, HandleError, this);
    }
}

void VlcPlayer::CleanupEventCallbacks() {
    if (event_manager_) {
        libvlc_event_detach(event_manager_, libvlc_MediaPlayerTimeChanged, HandleTimeChanged, this);
        libvlc_event_detach(event_manager_, libvlc_MediaPlayerPlaying, HandleStateChanged, this);
        libvlc_event_detach(event_manager_, libvlc_MediaPlayerPaused, HandleStateChanged, this);
        libvlc_event_detach(event_manager_, libvlc_MediaPlayerStopped, HandleStateChanged, this);
        libvlc_event_detach(event_manager_, libvlc_MediaPlayerEndReached, HandleEndReached, this);
        libvlc_event_detach(event_manager_, libvlc_MediaPlayerEncounteredError, HandleError, this);
        event_manager_ = nullptr;
    }

    // Release thread-safe functions
    if (tsfn_time_changed_) tsfn_time_changed_.Release();
    if (tsfn_state_changed_) tsfn_state_changed_.Release();
    if (tsfn_end_reached_) tsfn_end_reached_.Release();
    if (tsfn_error_) tsfn_error_.Release();
}

// Static event handlers
void VlcPlayer::HandleTimeChanged(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_ || !player->tsfn_time_changed_) return;

    int64_t time = event->u.media_player_time_changed.new_time;
    player->tsfn_time_changed_.NonBlockingCall([time](Napi::Env env, Napi::Function callback) {
        callback.Call({Napi::Number::New(env, static_cast<double>(time))});
    });
}

void VlcPlayer::HandleStateChanged(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_ || !player->tsfn_state_changed_) return;

    std::string state;
    switch (event->type) {
        case libvlc_MediaPlayerPlaying: state = "playing"; break;
        case libvlc_MediaPlayerPaused: state = "paused"; break;
        case libvlc_MediaPlayerStopped: state = "stopped"; break;
        default: state = "unknown"; break;
    }

    player->tsfn_state_changed_.NonBlockingCall([state](Napi::Env env, Napi::Function callback) {
        callback.Call({Napi::String::New(env, state)});
    });
}

void VlcPlayer::HandleEndReached(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_ || !player->tsfn_end_reached_) return;

    player->tsfn_end_reached_.NonBlockingCall([](Napi::Env env, Napi::Function callback) {
        callback.Call({});
    });
}

void VlcPlayer::HandleError(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_ || !player->tsfn_error_) return;

    player->tsfn_error_.NonBlockingCall([](Napi::Env env, Napi::Function callback) {
        callback.Call({Napi::String::New(env, "Playback error occurred")});
    });
}

// Core playback methods
Napi::Value VlcPlayer::SetMedia(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "URL string expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string url = info[0].As<Napi::String>().Utf8Value();

    std::lock_guard<std::mutex> lock(mutex_);

    // Release previous media
    if (current_media_) {
        libvlc_media_release(current_media_);
    }

    // Create new media from URL or path
    if (url.find("://") != std::string::npos) {
        current_media_ = libvlc_media_new_location(vlc_instance_, url.c_str());
    } else {
        current_media_ = libvlc_media_new_path(vlc_instance_, url.c_str());
    }

    if (!current_media_) {
        Napi::Error::New(env, "Failed to create media").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    libvlc_media_player_set_media(media_player_, current_media_);

    return env.Undefined();
}

Napi::Value VlcPlayer::Play(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Optional: allow passing URL directly to play
    if (info.Length() > 0 && info[0].IsString()) {
        SetMedia(info);
    }

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        int result = libvlc_media_player_play(media_player_);
        return Napi::Boolean::New(env, result == 0);
    }

    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::Pause(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_media_player_pause(media_player_);
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Resume(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_media_player_set_pause(media_player_, 0);
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_media_player_stop(media_player_);
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
        libvlc_media_player_set_time(media_player_, time);
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
        libvlc_audio_set_volume(media_player_, volume);
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

// Window embedding - Platform specific
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

// Event registration
Napi::Value VlcPlayer::On(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Event name and callback expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string event = info[0].As<Napi::String>().Utf8Value();
    Napi::Function callback = info[1].As<Napi::Function>();

    if (event == "timeChanged") {
        tsfn_time_changed_ = Napi::ThreadSafeFunction::New(
            env, callback, "TimeChanged", 0, 1
        );
    } else if (event == "stateChanged") {
        tsfn_state_changed_ = Napi::ThreadSafeFunction::New(
            env, callback, "StateChanged", 0, 1
        );
    } else if (event == "endReached") {
        tsfn_end_reached_ = Napi::ThreadSafeFunction::New(
            env, callback, "EndReached", 0, 1
        );
    } else if (event == "error") {
        tsfn_error_ = Napi::ThreadSafeFunction::New(
            env, callback, "Error", 0, 1
        );
    }

    return env.Undefined();
}

Napi::Value VlcPlayer::Off(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Event name expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string event = info[0].As<Napi::String>().Utf8Value();

    if (event == "timeChanged" && tsfn_time_changed_) {
        tsfn_time_changed_.Release();
    } else if (event == "stateChanged" && tsfn_state_changed_) {
        tsfn_state_changed_.Release();
    } else if (event == "endReached" && tsfn_end_reached_) {
        tsfn_end_reached_.Release();
    } else if (event == "error" && tsfn_error_) {
        tsfn_error_.Release();
    }

    return env.Undefined();
}

// Cleanup
Napi::Value VlcPlayer::Dispose(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    disposed_ = true;

    CleanupEventCallbacks();

    std::lock_guard<std::mutex> lock(mutex_);

    if (media_player_) {
        libvlc_media_player_stop(media_player_);
        libvlc_media_player_release(media_player_);
        media_player_ = nullptr;
    }

    if (current_media_) {
        libvlc_media_release(current_media_);
        current_media_ = nullptr;
    }

    if (vlc_instance_) {
        libvlc_release(vlc_instance_);
        vlc_instance_ = nullptr;
    }

    return env.Undefined();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return VlcPlayer::Init(env, exports);
}

NODE_API_MODULE(vlc_player, Init)
