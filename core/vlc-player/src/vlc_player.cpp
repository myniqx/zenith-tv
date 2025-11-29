#include "vlc_player.h"

Napi::Object VlcPlayer::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VlcPlayer", {
        // Unified API Methods
        InstanceMethod("open", &VlcPlayer::Open),
        InstanceMethod("playback", &VlcPlayer::Playback),
        InstanceMethod("audio", &VlcPlayer::Audio),
        InstanceMethod("video", &VlcPlayer::Video),
        InstanceMethod("subtitle", &VlcPlayer::Subtitle),
        InstanceMethod("window", &VlcPlayer::Window),
        InstanceMethod("shortcut", &VlcPlayer::Shortcut),
        InstanceMethod("getMediaInfo", &VlcPlayer::GetMediaInfo),

        // Events
        InstanceMethod("setEventCallback", &VlcPlayer::SetEventCallback),

        // Frame retrieval (memory rendering mode)
        InstanceMethod("getFrame", &VlcPlayer::GetFrame),
        InstanceMethod("getVideoFormat", &VlcPlayer::GetVideoFormat),

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
      rendering_mode_("win"), // Default to window mode
#ifdef _WIN32
      child_hwnd_(nullptr),
      parent_hwnd_(nullptr),
#elif defined(__linux__)
      display_(nullptr),
      child_window_(0),
      parent_window_(0),
#elif defined(__APPLE__)
      child_nsview_(nullptr),
      parent_nsview_(nullptr),
#endif
      child_window_created_(false),
      video_width_(0),
      video_height_(0),
      video_pitch_(0),
      frame_ready_(false),
      event_manager_(nullptr) {

    Napi::Env env = info.Env();

    // Optional: Accept mode parameter ("mem" or "win")
    if (info.Length() > 0 && info[0].IsString()) {
        rendering_mode_ = info[0].As<Napi::String>().Utf8Value();
        printf("[VLC] Rendering mode: %s\n", rendering_mode_.c_str());
        fflush(stdout);
    }

    // Initialize VLC with platform-specific parameters
#ifdef _WIN32
    const char* args[] = {
        "--no-video-title-show",
        "--intf=dummy",
        "--no-plugins-cache"
    };
#elif defined(__linux__)
    const char* args[] = {
        "--vout=xcb_x11",
        "--osd",
        "--no-plugins-cache"
    };

    const char* plugin_path = getenv("VLC_PLUGIN_PATH");
    if (!plugin_path) {
        const char* default_plugin_path = "/usr/lib/x86_64-linux-gnu/vlc/plugins";
        setenv("VLC_PLUGIN_PATH", default_plugin_path, 1);
    }
#elif defined(__APPLE__)
    const char* args[] = {
        "--no-video-title-show",
        "--intf=dummy",
        "--no-plugins-cache"
    };
#else
    const char* args[] = {
        "-vv",
        "--no-video-title-show",
        "--intf=dummy",
        "--no-plugins-cache"
    };
#endif

    printf("[VLC] CALL: libvlc_new(argc=%zu, args=[...])\n", sizeof(args) / sizeof(args[0]));
    vlc_instance_ = libvlc_new(sizeof(args) / sizeof(args[0]), args);
    printf("[VLC] RETURN: vlc_instance=%p\n", (void*)vlc_instance_);
    fflush(stdout);

    if (!vlc_instance_) {
        Napi::Error::New(env, "Failed to initialize libVLC").ThrowAsJavaScriptException();
        return;
    }

    printf("[VLC] CALL: libvlc_media_player_new(vlc_instance=%p)\n", (void*)vlc_instance_);
    media_player_ = libvlc_media_player_new(vlc_instance_);
    printf("[VLC] RETURN: media_player=%p\n", (void*)media_player_);
    fflush(stdout);

    if (!media_player_) {
        libvlc_release(vlc_instance_);
        vlc_instance_ = nullptr;
        Napi::Error::New(env, "Failed to create media player").ThrowAsJavaScriptException();
        return;
    }

    // Setup video callbacks only in memory rendering mode
    if (rendering_mode_ == "mem") {
        SetupVideoCallbacks();
    }

    // Initialize default keyboard shortcuts
    InitializeDefaultShortcuts();

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
        libvlc_event_attach(event_manager_, libvlc_MediaPlayerLengthChanged, HandleLengthChanged, this);
        libvlc_event_attach(event_manager_, libvlc_MediaPlayerBuffering, HandleBuffering, this);
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
        libvlc_event_detach(event_manager_, libvlc_MediaPlayerLengthChanged, HandleLengthChanged, this);
        libvlc_event_detach(event_manager_, libvlc_MediaPlayerBuffering, HandleBuffering, this);
        event_manager_ = nullptr;
    }

    // Release thread-safe function
    if (tsfn_events_) tsfn_events_.Release();
}

// Unified Event Registration
Napi::Value VlcPlayer::SetEventCallback(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsFunction()) {
        Napi::TypeError::New(env, "Callback function expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Release existing if any
    if (tsfn_events_) {
        tsfn_events_.Release();
    }

    tsfn_events_ = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "VlcEvents",
        0,
        1
    );

    return env.Undefined();
}

// Static event handlers
void VlcPlayer::HandleTimeChanged(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_ || !player->media_player_) return;

    int64_t time = event->u.media_player_time_changed.new_time;

    player->EmitCurrentVideo([player, time](Napi::Env env, Napi::Object& currentVideo) {
        if (player->disposed_ || !player->media_player_) return;

        // Time
        currentVideo.Set("time", Napi::Number::New(env, static_cast<double>(time)));

        // Position (normalized 0.0 - 1.0)
        float position = libvlc_media_player_get_position(player->media_player_);
        currentVideo.Set("position", Napi::Number::New(env, position));

        // Buffering progress (only if currently buffering)
        libvlc_state_t state = libvlc_media_player_get_state(player->media_player_);
        if (state == libvlc_Buffering) {
            float bufferingProgress = player->buffering_progress_.load();
            currentVideo.Set("buffering", Napi::Number::New(env, bufferingProgress));
        }
    });
}

void VlcPlayer::HandleStateChanged(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_) return;

    std::string state;
    switch (event->type) {
        case libvlc_MediaPlayerPlaying: state = "playing"; break;
        case libvlc_MediaPlayerPaused: state = "paused"; break;
        case libvlc_MediaPlayerStopped: state = "stopped"; break;
        default: state = "unknown"; break;
    }

    player->EmitCurrentVideo([state](Napi::Env env, Napi::Object& currentVideo) {
        currentVideo.Set("state", Napi::String::New(env, state));
    });
}

void VlcPlayer::HandleEndReached(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_) return;

    player->EmitCurrentVideo([](Napi::Env env, Napi::Object& currentVideo) {
        currentVideo.Set("endReached", Napi::Boolean::New(env, true));
        currentVideo.Set("state", Napi::String::New(env, "ended"));
    });
}

void VlcPlayer::HandleError(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_) return;

    player->EmitCurrentVideo([](Napi::Env env, Napi::Object& currentVideo) {
        currentVideo.Set("error", Napi::String::New(env, "Playback error occurred"));
    });
}

void VlcPlayer::HandleLengthChanged(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_ || !player->tsfn_events_) return;

    player->tsfn_events_.NonBlockingCall([player](Napi::Env env, Napi::Function callback) {
        if (player->disposed_ || !player->media_player_) return;

        Napi::Object payload = Napi::Object::New(env);

        // Media Info (tracks, duration, etc.)
        Napi::Object mediaInfo = player->GetMediaInfoObject(env);
        payload.Set("mediaInfo", mediaInfo);

        // Player Settings (persistent across videos)
        Napi::Object playerInfo = Napi::Object::New(env);
        playerInfo.Set("volume", Napi::Number::New(env, libvlc_audio_get_volume(player->media_player_)));
        playerInfo.Set("muted", Napi::Boolean::New(env, libvlc_audio_get_mute(player->media_player_)));
        playerInfo.Set("rate", Napi::Number::New(env, libvlc_media_player_get_rate(player->media_player_)));
        payload.Set("playerInfo", playerInfo);

        // Current Video State (initial values for all video-specific settings)
        Napi::Object currentVideo = Napi::Object::New(env);

        // Length
        int64_t length = libvlc_media_player_get_length(player->media_player_);
        currentVideo.Set("length", Napi::Number::New(env, static_cast<double>(length)));

        // Is Seekable
        bool seekable = libvlc_media_player_is_seekable(player->media_player_);
        currentVideo.Set("isSeekable", Napi::Boolean::New(env, seekable));

        // Position (initial 0.0)
        currentVideo.Set("position", Napi::Number::New(env, 0.0));

        // Video settings
        const char* aspect = libvlc_video_get_aspect_ratio(player->media_player_);
        if (aspect) {
            currentVideo.Set("aspectRatio", Napi::String::New(env, aspect));
        } else {
            currentVideo.Set("aspectRatio", env.Null());
        }

        const char* crop = libvlc_video_get_crop_geometry(player->media_player_);
        if (crop) {
            currentVideo.Set("crop", Napi::String::New(env, crop));
        } else {
            currentVideo.Set("crop", env.Null());
        }

        float scale = libvlc_video_get_scale(player->media_player_);
        currentVideo.Set("scale", Napi::Number::New(env, scale));

        currentVideo.Set("deinterlace", env.Null());

        // Delay settings
        int64_t audioDelay = libvlc_audio_get_delay(player->media_player_);
        currentVideo.Set("audioDelay", Napi::Number::New(env, static_cast<double>(audioDelay)));

        int64_t subtitleDelay = libvlc_video_get_spu_delay(player->media_player_);
        currentVideo.Set("subtitleDelay", Napi::Number::New(env, static_cast<double>(subtitleDelay)));

        // Current tracks (per-video selection)
        currentVideo.Set("audioTrack", Napi::Number::New(env, libvlc_audio_get_track(player->media_player_)));
        currentVideo.Set("subtitleTrack", Napi::Number::New(env, libvlc_video_get_spu(player->media_player_)));
        currentVideo.Set("videoTrack", Napi::Number::New(env, libvlc_video_get_track(player->media_player_)));

        payload.Set("currentVideo", currentVideo);

        callback.Call({payload});
    });
}

void VlcPlayer::HandleBuffering(const libvlc_event_t* event, void* data) {
    VlcPlayer* player = static_cast<VlcPlayer*>(data);
    if (player->disposed_) return;

    // Store buffering progress
    float cache = event->u.media_player_buffering.new_cache;
    player->buffering_progress_.store(cache);

    // Note: We don't emit buffering here separately
    // It will be sent with the next TimeChanged event if state is buffering
}

// Cleanup
Napi::Value VlcPlayer::Dispose(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Set disposed flag under mutex protection to prevent race conditions
    {
        std::lock_guard<std::mutex> lock(mutex_);
        disposed_ = true;
    }

    // Cleanup event callbacks after setting disposed flag
    CleanupEventCallbacks();

    // Acquire mutex for cleanup operations
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

    if (child_window_created_) {
#ifdef _WIN32
        if (child_hwnd_) {
            DestroyWindow(child_hwnd_);
            child_hwnd_ = nullptr;
        }
#elif defined(__linux__)
        if (display_ && child_window_) {
            XDestroyWindow(display_, child_window_);
            XCloseDisplay(display_);
            display_ = nullptr;
            child_window_ = 0;
        }
#elif defined(__APPLE__)
        // macOS cleanup
#endif
        child_window_created_ = false;
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
