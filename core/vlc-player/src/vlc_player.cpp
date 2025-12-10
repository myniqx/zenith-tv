#include "vlc_player.h"

#ifdef _WIN32
#include "os/win32/window.h"
#elif defined(__linux__)
#include "os/linux/window.h"
#endif

Napi::Object VlcPlayer::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(
        env, "VlcPlayer",
        {
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

    Napi::FunctionReference *constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("VlcPlayer", func);
    return exports;
}

VlcPlayer::VlcPlayer(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<VlcPlayer>(info),
      vlc_instance_(nullptr),
      media_player_(nullptr),
      current_media_(nullptr),
      osd_window_(nullptr),


      video_width_(0),
      video_height_(0),
      video_pitch_(0),
      frame_ready_(false),
      tsfn_events_(),
      event_manager_(nullptr)
{
    Log("Constructor started");

    Napi::Env env = info.Env();

    // Initialize VLC with platform-specific parameters
#ifdef _WIN32
    // Windows: VLC plugins must be in the same directory as the .node file
    // This is handled by binding.gyp copying plugins to build directory
    const char *args[] = {
        "--no-video-title-show",
        "--intf=dummy",
        "--no-plugins-cache"};

    Log("CALL: libvlc_new(argc=%zu, args=[...])\n", sizeof(args) / sizeof(args[0]));
    vlc_instance_ = libvlc_new(sizeof(args) / sizeof(args[0]), args);
    Log("RETURN: vlc_instance=%p\n", (void *)vlc_instance_);

    Log("Creating Win32Window instance in constructor...");
    osd_window_ = new Win32Window(this);
    osd_window_->Initialize();

#elif defined(__linux__)
    Log("Creating LinuxWindow instance in constructor...");
    osd_window_ = new LinuxWindow(this);
    osd_window_->Initialize();

    const char *plugin_path = getenv("VLC_PLUGIN_PATH");
    if (!plugin_path)
    {
        const char *default_plugin_path = "/usr/lib/x86_64-linux-gnu/vlc/plugins";
        setenv("VLC_PLUGIN_PATH", default_plugin_path, 1);
    }

    const char *args[] = {
        "--vout=xcb_x11",
        "--osd",
        "--no-plugins-cache"};

    printf("[VLC Core] CALL: libvlc_new(argc=%zu, args=[...])\n", sizeof(args) / sizeof(args[0]));
    vlc_instance_ = libvlc_new(sizeof(args) / sizeof(args[0]), args);
#elif defined(__APPLE__)
    const char *args[] = {
        "--no-video-title-show",
        "--intf=dummy",
        "--no-plugins-cache"};

    printf("[VLC Core] CALL: libvlc_new(argc=%zu, args=[...])\n", sizeof(args) / sizeof(args[0]));
    vlc_instance_ = libvlc_new(sizeof(args) / sizeof(args[0]), args);
#else
    const char *args[] = {
        "-vv",
        "--no-video-title-show",
        "--intf=dummy",
        "--no-plugins-cache"};

    printf("[VLC Core] CALL: libvlc_new(argc=%zu, args=[...])\n", sizeof(args) / sizeof(args[0]));
    vlc_instance_ = libvlc_new(sizeof(args) / sizeof(args[0]), args);
#endif

    printf("[VLC Core] RETURN: vlc_instance=%p\n", (void *)vlc_instance_);
    fflush(stdout);

    if (!vlc_instance_)
    {
        Log("ERROR: Failed to initialize libVLC instance");
        Napi::Error::New(env, "Failed to initialize libVLC").ThrowAsJavaScriptException();
        return;
    }
    Log("libVLC instance created successfully");

    printf("[VLC Core] CALL: libvlc_media_player_new(vlc_instance=%p)\n", (void *)vlc_instance_);
    media_player_ = libvlc_media_player_new(vlc_instance_);
    printf("[VLC Core] RETURN: media_player=%p\n", (void *)media_player_);
    fflush(stdout);

    if (!media_player_)
    {
        Log("ERROR: Failed to create media player");
        libvlc_release(vlc_instance_);
        vlc_instance_ = nullptr;
        Napi::Error::New(env, "Failed to create media player").ThrowAsJavaScriptException();
        return;
    }
    Log("Media player created successfully");

    // Initialize default keyboard shortcuts
    Log("Initializing default shortcuts...");
    InitializeDefaultShortcuts();

    Log("Setting up event callbacks...");
    SetupEventCallbacks();

    Log("Constructor completed successfully");
}

VlcPlayer::~VlcPlayer()
{
    Log("Destructor started (disposed_=%d)", (int)disposed_);
    if (!disposed_)
    {
        osd_window_->Destroy();

        CleanupEventCallbacks();

        if (media_player_)
        {
            libvlc_media_player_stop(media_player_);
            libvlc_media_player_release(media_player_);
            media_player_ = nullptr;
        }

        if (current_media_)
        {
            libvlc_media_release(current_media_);
            current_media_ = nullptr;
        }

        if (vlc_instance_)
        {
            libvlc_release(vlc_instance_);
            vlc_instance_ = nullptr;
        }
    }
}

void VlcPlayer::SetupEventCallbacks()
{
    if (!media_player_)
        return;

    event_manager_ = libvlc_media_player_event_manager(media_player_);

    if (event_manager_)
    {
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

void VlcPlayer::CleanupEventCallbacks()
{
    if (event_manager_)
    {
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
    if (tsfn_events_)
        tsfn_events_.Release();
}

// Unified Event Registration
Napi::Value VlcPlayer::SetEventCallback(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsFunction())
    {
        Napi::TypeError::New(env, "Callback function expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Release existing if any
    if (tsfn_events_)
    {
        tsfn_events_.Release();
    }

    tsfn_events_ = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),
        "VlcEvents",
        0,
        1);

    return env.Undefined();
}

// Static event handlers
void VlcPlayer::HandleTimeChanged(const libvlc_event_t *event, void *data)
{
    VlcPlayer *player = static_cast<VlcPlayer *>(data);
    if (player->disposed_ || !player->media_player_)
        return;

    int64_t time = event->u.media_player_time_changed.new_time;

    player->EmitCurrentVideo([player, time](Napi::Env env, Napi::Object &currentVideo)
                             {
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
        } });
}

void VlcPlayer::HandleStateChanged(const libvlc_event_t *event, void *data)
{
    VlcPlayer *player = static_cast<VlcPlayer *>(data);
    if (player->disposed_)
        return;

    std::string state;

    switch (event->type)
    {
    case libvlc_MediaPlayerPlaying:
        state = "playing";
        break;
    case libvlc_MediaPlayerPaused:
        state = "paused";
        break;
    case libvlc_MediaPlayerStopped:
        state = "stopped";
        break;
    default:
        state = "unknown";
        break;
    }

    // Show Playback OSD (text and icon determined inside)
    if (state != "unknown" && player->osd_window_)
    {
        player->osd_window_->ShowPlaybackOSD(state);
    }

    player->EmitCurrentVideo([state](Napi::Env env, Napi::Object &currentVideo)
                             { currentVideo.Set("state", Napi::String::New(env, state)); });
}

void VlcPlayer::HandleEndReached(const libvlc_event_t *event, void *data)
{
    VlcPlayer *player = static_cast<VlcPlayer *>(data);
    if (player->disposed_)
        return;

    player->EmitCurrentVideo([](Napi::Env env, Napi::Object &currentVideo)
                             {
        currentVideo.Set("endReached", Napi::Boolean::New(env, true));
        currentVideo.Set("state", Napi::String::New(env, "ended")); });
}

void VlcPlayer::HandleError(const libvlc_event_t *event, void *data)
{
    VlcPlayer *player = static_cast<VlcPlayer *>(data);
    if (player->disposed_)
        return;

    player->EmitCurrentVideo([](Napi::Env env, Napi::Object &currentVideo)
                             { currentVideo.Set("error", Napi::String::New(env, "Playback error occurred")); });
}

void VlcPlayer::HandleLengthChanged(const libvlc_event_t *event, void *data)
{
    VlcPlayer *player = static_cast<VlcPlayer *>(data);
    if (player->disposed_ || !player->tsfn_events_)
        return;

    player->tsfn_events_.NonBlockingCall([player](Napi::Env env, Napi::Function callback)
                                         {
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

        callback.Call({payload}); });
}

void VlcPlayer::HandleBuffering(const libvlc_event_t *event, void *data)
{
    VlcPlayer *player = static_cast<VlcPlayer *>(data);
    if (player->disposed_)
        return;

    // Store buffering progress
    float cache = event->u.media_player_buffering.new_cache;
    player->buffering_progress_.store(cache);

    // Note: We don't emit buffering here separately
    // It will be sent with the next TimeChanged event if state is buffering
}

// Cleanup
Napi::Value VlcPlayer::Dispose(const Napi::CallbackInfo &info)
{
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

    if (media_player_)
    {
        libvlc_media_player_stop(media_player_);
        libvlc_media_player_release(media_player_);
        media_player_ = nullptr;
    }

    if (current_media_)
    {
        libvlc_media_release(current_media_);
        current_media_ = nullptr;
    }

    if (vlc_instance_)
    {
        libvlc_release(vlc_instance_);
        vlc_instance_ = nullptr;
    }

    return env.Undefined();
}

// ================================================================================================
// Helper Methods
// ================================================================================================

std::string VlcPlayer::FormatTime(int64_t time_ms)
{
    if (osd_window_)
    {
        // Delegate to OSWindow's FormatTime (available in OSDWindow base class)
        // Since we can't access it directly, we'll implement it here
        int64_t seconds = time_ms / 1000;
        int64_t minutes = seconds / 60;
        int64_t hours = minutes / 60;

        seconds %= 60;
        minutes %= 60;

        char buffer[32];
        if (hours > 0)
        {
            snprintf(buffer, sizeof(buffer), "%02lld:%02lld:%02lld", (long long)hours, (long long)minutes, (long long)seconds);
        }
        else
        {
            snprintf(buffer, sizeof(buffer), "%02lld:%02lld", (long long)minutes, (long long)seconds);
        }
        return std::string(buffer);
    }
    return "00:00";
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    return VlcPlayer::Init(env, exports);
}

NODE_API_MODULE(vlc_player, Init)
