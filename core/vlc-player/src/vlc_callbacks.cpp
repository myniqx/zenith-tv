#include "vlc_player.h"

// =================================================================================================
// Event Emission Helpers
// =================================================================================================

void VlcPlayer::EmitShortcut(const std::string& action) {
    if (!tsfn_events_) return;

    tsfn_events_.NonBlockingCall([action](Napi::Env env, Napi::Function callback) {
        Napi::Object payload = Napi::Object::New(env);
        payload.Set("shortcut", Napi::String::New(env, action));
        callback.Call({payload});
    });
}

void VlcPlayer::EmitCurrentVideo(std::function<void(Napi::Env, Napi::Object&)> builder) {
    if (!tsfn_events_) return;

    tsfn_events_.NonBlockingCall([builder](Napi::Env env, Napi::Function callback) {
        Napi::Object payload = Napi::Object::New(env);
        Napi::Object currentVideo = Napi::Object::New(env);

        builder(env, currentVideo);

        payload.Set("currentVideo", currentVideo);
        callback.Call({payload});
    });
}

void VlcPlayer::EmitPlayerInfo(std::function<void(Napi::Env, Napi::Object&)> builder) {
    if (!tsfn_events_) return;

    tsfn_events_.NonBlockingCall([builder](Napi::Env env, Napi::Function callback) {
        Napi::Object payload = Napi::Object::New(env);
        Napi::Object playerInfo = Napi::Object::New(env);

        builder(env, playerInfo);

        payload.Set("playerInfo", playerInfo);
        callback.Call({payload});
    });
}

void VlcPlayer::EmitMediaInfo() {
    if (!tsfn_events_ || !media_player_ || disposed_) return;

    tsfn_events_.NonBlockingCall([this](Napi::Env env, Napi::Function callback) {
        if (disposed_ || !media_player_) return;

        Napi::Object payload = Napi::Object::New(env);
        Napi::Object mediaInfo = GetMediaInfoObject(env);
        payload.Set("mediaInfo", mediaInfo);

        callback.Call({payload});
    });
}
