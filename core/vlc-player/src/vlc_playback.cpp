#include "vlc_player.h"

// =================================================================================================
// Playback Control API
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

    media_options_.clear();

    int window_width = 1280;
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

    if (url.empty()) {
        Napi::Error::New(env, "Empty URL provided").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::lock_guard<std::mutex> lock(mutex_);

    if (rendering_mode_ == "win" && !child_window_created_) {
        CreateChildWindowInternal(window_width, window_height);
    }

    if (current_media_) {
        libvlc_media_release(current_media_);
    }

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

    for (const auto& opt : media_options_) {
        std::string option_str = opt.first + "=" + opt.second;
        libvlc_media_add_option(current_media_, option_str.c_str());
    }

    libvlc_media_player_set_media(media_player_, current_media_);
    libvlc_media_release(current_media_);
    current_media_ = nullptr;

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
            if (child_window_created_ && rendering_mode_ == "win") {
                #ifdef _WIN32
                if (child_hwnd_) {
                    libvlc_media_player_set_hwnd(media_player_, child_hwnd_);
                }
                #elif defined(__linux__)
                if (child_window_) {
                    libvlc_media_player_set_xwindow(media_player_, static_cast<uint32_t>(child_window_));
                }
                #elif defined(__APPLE__)
                if (child_nsview_) {
                    libvlc_media_player_set_nsobject(media_player_, child_nsview_);
                }
                #endif
            }

            libvlc_media_player_play(media_player_);
        }
        else if (action == "pause") {
            libvlc_media_player_pause(media_player_);
        }
        else if (action == "resume") {
            libvlc_media_player_set_pause(media_player_, 0);
        }
        else if (action == "stop") {
            libvlc_media_player_stop(media_player_);

            if (rendering_mode_ == "win" && child_window_created_) {
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

        EmitPlayerInfo([rate](Napi::Env env, Napi::Object& playerInfo) {
            playerInfo.Set("rate", Napi::Number::New(env, rate));
        });
    }

    return env.Undefined();
}
