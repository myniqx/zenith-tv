#include "vlc_player.h"

// =================================================================================================
// Subtitle Control API
// =================================================================================================

Napi::Value VlcPlayer::Subtitle(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject())
        return env.Undefined();

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_)
        return env.Undefined();

    if (options.Has("track"))
    {
        int track = options.Get("track").As<Napi::Number>().Int32Value();
        libvlc_video_set_spu(media_player_, track);

        // Show Subtitle Track OSD
        std::string text = (track == -1) ? "Subtitle: Disabled" : ("Subtitle Track: " + std::to_string(track));
        osd_window_->ShowNotificationOSD(text);

        EmitCurrentVideo([track](Napi::Env env, Napi::Object &cv)
                         { cv.Set("subtitleTrack", Napi::Number::New(env, track)); });
    }

    if (options.Has("delay"))
    {
        int64_t delay = options.Get("delay").As<Napi::Number>().Int64Value();
        libvlc_video_set_spu_delay(media_player_, delay);

        EmitCurrentVideo([delay](Napi::Env env, Napi::Object &cv)
                         { cv.Set("subtitleDelay", Napi::Number::New(env, static_cast<double>(delay))); });
    }

    return env.Undefined();
}
