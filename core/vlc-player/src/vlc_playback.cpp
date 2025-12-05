#include "vlc_player.h"

// =================================================================================================
// Playback Control API
// =================================================================================================

Napi::Value VlcPlayer::Open(const Napi::CallbackInfo &info)
{
    Log("Open() called");
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject())
    {
        Log("ERROR: Open() - Options object expected");
        Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object options = info[0].As<Napi::Object>();

    if (!options.Has("file") || !options.Get("file").IsString())
    {
        Log("ERROR: Open() - File path/url is required");
        Napi::Error::New(env, "File path/url is required").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string url = options.Get("file").As<Napi::String>().Utf8Value();
    Log("Open() - URL: %s", url.c_str());

    media_options_.clear();

    int window_width = 1280;
    int window_height = 720;

    if (options.Has("window"))
    {
        Napi::Object windowOpts = options.Get("window").As<Napi::Object>();
        if (windowOpts.Has("width"))
        {
            window_width = windowOpts.Get("width").As<Napi::Number>().Int32Value();
        }
        if (windowOpts.Has("height"))
        {
            window_height = windowOpts.Get("height").As<Napi::Number>().Int32Value();
        }
    }

    if (url.empty())
    {
        Napi::Error::New(env, "Empty URL provided").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::lock_guard<std::mutex> lock(mutex_);

    Log("Creating child window (width=%d, height=%d)...", window_width, window_height);
    CreateChildWindowInternal(window_width, window_height);
    Log("Child window creation call completed, osd_window_=%p", (void*)osd_window_);

    if (current_media_)
    {
        Log("Releasing previous media...");
        libvlc_media_release(current_media_);
    }

    bool is_url = url.find("://") != std::string::npos;
    Log("Creating media (is_url=%d)...", is_url);
    if (is_url)
    {
        current_media_ = libvlc_media_new_location(vlc_instance_, url.c_str());
    }
    else
    {
        current_media_ = libvlc_media_new_path(vlc_instance_, url.c_str());
    }

    if (!current_media_)
    {
        Log("ERROR: Failed to create media");
        Napi::Error::New(env, "Failed to create media").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    Log("Media created successfully");

    for (const auto &opt : media_options_)
    {
        std::string option_str = opt.first + "=" + opt.second;
        libvlc_media_add_option(current_media_, option_str.c_str());
    }

    libvlc_media_player_set_media(media_player_, current_media_);
    libvlc_media_release(current_media_);
    current_media_ = nullptr;

    return env.Undefined();
}

Napi::Value VlcPlayer::Playback(const Napi::CallbackInfo &info)
{
    Log("Playback() called");
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject())
    {
        Log("ERROR: Playback() - Options object expected");
        return env.Undefined();
    }

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_)
    {
        Log("ERROR: Playback() - media_player_ is null");
        return env.Undefined();
    }

    if (options.Has("action"))
    {
        std::string action = options.Get("action").As<Napi::String>().Utf8Value();
        Log("Playback() - action: %s", action.c_str());
        if (action == "play")
        {
            Log("Playback action: play");
            if (osd_window_)
            {
                Log("Binding osd_window_ to media player...");
                osd_window_->Bind(media_player_);
                Log("Bind completed");
            }
            else
            {
                Log("WARNING: osd_window_ is null, skipping Bind()");
            }
            Log("Starting playback...");
            libvlc_media_player_play(media_player_);
            Log("Playback started");
        }
        else if (action == "pause")
        {
            libvlc_media_player_pause(media_player_);
        }
        else if (action == "resume")
        {
            libvlc_media_player_set_pause(media_player_, 0);
        }
        else if (action == "stop")
        {
            libvlc_media_player_stop(media_player_);
            DestroyChildWindowInternal();
        }
    }

    if (options.Has("time"))
    {
        int64_t time = options.Get("time").As<Napi::Number>().Int64Value();
        libvlc_media_player_set_time(media_player_, time);

        // Show Seek OSD (formatting happens inside)
        int64_t duration = libvlc_media_player_get_length(media_player_);
        osd_window_->ShowSeekOSD(time, duration);
    }

    if (options.Has("position"))
    {
        float pos = options.Get("position").As<Napi::Number>().FloatValue();
        libvlc_media_player_set_position(media_player_, pos);

        // Show Seek OSD (formatting happens inside)
        int64_t duration = libvlc_media_player_get_length(media_player_);
        int64_t time = static_cast<int64_t>(pos * duration);
        osd_window_->ShowSeekOSD(time, duration);
    }

    if (options.Has("rate"))
    {
        float rate = options.Get("rate").As<Napi::Number>().FloatValue();
        libvlc_media_player_set_rate(media_player_, rate);

        EmitPlayerInfo([rate](Napi::Env env, Napi::Object &playerInfo)
                       { playerInfo.Set("rate", Napi::Number::New(env, rate)); });
    }

    return env.Undefined();
}
