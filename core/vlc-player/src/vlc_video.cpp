#include "vlc_player.h"
#include <algorithm>

// =================================================================================================
// Video Control API
// =================================================================================================

Napi::Value VlcPlayer::Video(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsObject()) return env.Undefined();

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!media_player_) return env.Undefined();

    if (options.Has("track")) {
        int track = options.Get("track").As<Napi::Number>().Int32Value();
        libvlc_video_set_track(media_player_, track);

        EmitCurrentVideo([track](Napi::Env env, Napi::Object& cv) {
            cv.Set("videoTrack", Napi::Number::New(env, track));
        });
    }

    if (options.Has("scale")) {
        float scale = options.Get("scale").As<Napi::Number>().FloatValue();
        libvlc_video_set_scale(media_player_, scale);

        EmitCurrentVideo([scale](Napi::Env env, Napi::Object& cv) {
            cv.Set("scale", Napi::Number::New(env, scale));
        });
    }

    if (options.Has("aspectRatio")) {
        std::string ar = options.Get("aspectRatio").As<Napi::String>().Utf8Value();
        libvlc_video_set_aspect_ratio(media_player_, ar.empty() ? nullptr : ar.c_str());

        EmitCurrentVideo([ar](Napi::Env env, Napi::Object& cv) {
            if (ar.empty()) {
                cv.Set("aspectRatio", env.Null());
            } else {
                cv.Set("aspectRatio", Napi::String::New(env, ar));
            }
        });
    }

    if (options.Has("crop")) {
        std::string crop = options.Get("crop").As<Napi::String>().Utf8Value();
        libvlc_video_set_crop_geometry(media_player_, crop.empty() ? nullptr : crop.c_str());

        EmitCurrentVideo([crop](Napi::Env env, Napi::Object& cv) {
            if (crop.empty()) {
                cv.Set("crop", env.Null());
            } else {
                cv.Set("crop", Napi::String::New(env, crop));
            }
        });
    }

    if (options.Has("deinterlace")) {
        std::string mode = options.Get("deinterlace").As<Napi::String>().Utf8Value();
        if (mode == "off") {
            libvlc_video_set_deinterlace(media_player_, nullptr);
        } else {
            libvlc_video_set_deinterlace(media_player_, mode.c_str());
        }

        EmitCurrentVideo([mode](Napi::Env env, Napi::Object& cv) {
            if (mode == "off") {
                cv.Set("deinterlace", env.Null());
            } else {
                cv.Set("deinterlace", Napi::String::New(env, mode));
            }
        });
    }

    if (options.Has("teletext")) {
        int page = options.Get("teletext").As<Napi::Number>().Int32Value();
        libvlc_video_set_teletext(media_player_, page);
    }

    return env.Undefined();
}
