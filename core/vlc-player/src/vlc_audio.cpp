#include "vlc_player.h"

// =================================================================================================
// Audio Control API
// =================================================================================================

Napi::Value VlcPlayer::Audio(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject()) return env.Undefined();

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_) return env.Undefined();

    if (options.Has("volume")) {
        int vol = options.Get("volume").As<Napi::Number>().Int32Value();
        libvlc_audio_set_volume(media_player_, vol);

        EmitPlayerInfo([vol](Napi::Env env, Napi::Object& playerInfo) {
            playerInfo.Set("volume", Napi::Number::New(env, vol));
        });
    }

    if (options.Has("mute")) {
        bool mute = options.Get("mute").As<Napi::Boolean>().Value();
        libvlc_audio_set_mute(media_player_, mute ? 1 : 0);

        EmitPlayerInfo([mute](Napi::Env env, Napi::Object& playerInfo) {
            playerInfo.Set("muted", Napi::Boolean::New(env, mute));
        });
    }

    if (options.Has("track")) {
        int track = options.Get("track").As<Napi::Number>().Int32Value();
        libvlc_audio_set_track(media_player_, track);

        EmitCurrentVideo([track](Napi::Env env, Napi::Object& cv) {
            cv.Set("audioTrack", Napi::Number::New(env, track));
        });
    }

    if (options.Has("delay")) {
        int64_t delay = options.Get("delay").As<Napi::Number>().Int64Value();
        libvlc_audio_set_delay(media_player_, delay);

        EmitCurrentVideo([delay](Napi::Env env, Napi::Object& cv) {
            cv.Set("audioDelay", Napi::Number::New(env, static_cast<double>(delay)));
        });
    }

    return env.Undefined();
}
