#include "vlc_player.h"

#ifdef __APPLE__
#include <objc/objc.h>
#endif

Napi::Value VlcPlayer::CreateChildWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // macOS implementation pending
    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::DestroyChildWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // macOS implementation pending
    return Napi::Boolean::New(env, true);
}

Napi::Value VlcPlayer::SetBounds(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // macOS implementation pending
    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::ShowWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // macOS implementation pending
    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::HideWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // macOS implementation pending
    return Napi::Boolean::New(env, false);
}
