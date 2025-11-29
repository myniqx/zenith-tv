#include "vlc_player.h"

// =================================================================================================
// Media & Player Info API
// =================================================================================================

Napi::Value VlcPlayer::GetMediaInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::lock_guard<std::mutex> lock(mutex_);
    return GetMediaInfoObject(env);
}

Napi::Object VlcPlayer::GetMediaInfoObject(Napi::Env env) {
    Napi::Object result = Napi::Object::New(env);

    if (!media_player_) return result;

    result.Set("duration", Napi::Number::New(env, libvlc_media_player_get_length(media_player_)));
    result.Set("isSeekable", Napi::Boolean::New(env, libvlc_media_player_is_seekable(media_player_)));

    Napi::Object meta = Napi::Object::New(env);
    result.Set("meta", meta);

    // Audio Tracks
    Napi::Array audioTracks = Napi::Array::New(env);
    libvlc_track_description_t* a_tracks = libvlc_audio_get_track_description(media_player_);
    if (a_tracks) {
        libvlc_track_description_t* t = a_tracks;
        int i = 0;
        while(t) {
            Napi::Object track = Napi::Object::New(env);
            track.Set("id", t->i_id);
            track.Set("name", t->psz_name ? t->psz_name : "");
            audioTracks.Set(i++, track);
            t = t->p_next;
        }
        libvlc_track_description_list_release(a_tracks);
    }
    result.Set("audioTracks", audioTracks);

    // Subtitle Tracks
    Napi::Array subTracks = Napi::Array::New(env);
    libvlc_track_description_t* s_tracks = libvlc_video_get_spu_description(media_player_);
    if (s_tracks) {
        libvlc_track_description_t* t = s_tracks;
        int i = 0;
        while(t) {
            Napi::Object track = Napi::Object::New(env);
            track.Set("id", t->i_id);
            track.Set("name", t->psz_name ? t->psz_name : "");
            subTracks.Set(i++, track);
            t = t->p_next;
        }
        libvlc_track_description_list_release(s_tracks);
    }
    result.Set("subtitleTracks", subTracks);

    // Video Tracks
    Napi::Array videoTracks = Napi::Array::New(env);
    libvlc_track_description_t* v_tracks = libvlc_video_get_track_description(media_player_);
    if (v_tracks) {
        libvlc_track_description_t* t = v_tracks;
        int i = 0;
        while(t) {
            Napi::Object track = Napi::Object::New(env);
            track.Set("id", t->i_id);
            track.Set("name", t->psz_name ? t->psz_name : "");
            videoTracks.Set(i++, track);
            t = t->p_next;
        }
        libvlc_track_description_list_release(v_tracks);
    }
    result.Set("videoTracks", videoTracks);

    return result;
}
