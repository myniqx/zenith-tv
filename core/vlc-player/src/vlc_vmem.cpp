#include "vlc_player.h"
#include <cstring>
#include <cstdio>

// Video memory callback implementations
void VlcPlayer::SetupVideoCallbacks() {
    if (!media_player_) return;

    // Set video format callback
    libvlc_video_set_format_callbacks(
        media_player_,
        [](void** opaque, char* chroma, unsigned* width, unsigned* height, unsigned* pitches, unsigned* lines) -> unsigned {
            VlcPlayer* player = static_cast<VlcPlayer*>(*opaque);
            
            // Request RGBA format
            memcpy(chroma, "RV32", 4);
            
            // Store dimensions
            player->video_width_ = *width;
            player->video_height_ = *height;
            player->video_pitch_ = *width * 4; // 4 bytes per pixel (RGBA)
            *pitches = player->video_pitch_;
            *lines = *height;
            
            // Allocate frame buffer
            std::lock_guard<std::mutex> lock(player->frame_mutex_);
            player->frame_buffer_.resize(player->video_pitch_ * player->video_height_);
            
            printf("[VLC] Video format: %ux%u, pitch: %u\n", *width, *height, player->video_pitch_);
            fflush(stdout);
            
            return 1;
        },
        nullptr // cleanup callback
    );

    // Set video callbacks
    libvlc_video_set_callbacks(
        media_player_,
        VlcPlayer::VideoLockCallback,
        VlcPlayer::VideoUnlockCallback,
        VlcPlayer::VideoDisplayCallback,
        this
    );
}

void* VlcPlayer::VideoLockCallback(void* opaque, void** planes) {
    VlcPlayer* player = static_cast<VlcPlayer*>(opaque);
    std::lock_guard<std::mutex> lock(player->frame_mutex_);
    
    if (!player->frame_buffer_.empty()) {
        *planes = player->frame_buffer_.data();
    }
    
    return nullptr; // picture identifier (not used)
}

void VlcPlayer::VideoUnlockCallback(void* opaque, void* picture, void* const* planes) {
    // Nothing to do - we're using a persistent buffer
    (void)opaque;
    (void)picture;
    (void)planes;
}

void VlcPlayer::VideoDisplayCallback(void* opaque, void* picture) {
    VlcPlayer* player = static_cast<VlcPlayer*>(opaque);
    player->frame_ready_ = true;
    (void)picture;
}

Napi::Value VlcPlayer::GetFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    std::lock_guard<std::mutex> lock(frame_mutex_);
    
    if (!frame_ready_ || frame_buffer_.empty()) {
        return env.Null();
    }
    
    // Create a Node.js Buffer from the frame data
    // Note: This creates a copy of the data
    return Napi::Buffer<uint8_t>::Copy(env, frame_buffer_.data(), frame_buffer_.size());
}

Napi::Value VlcPlayer::GetVideoFormat(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    Napi::Object format = Napi::Object::New(env);
    format.Set("width", Napi::Number::New(env, video_width_));
    format.Set("height", Napi::Number::New(env, video_height_));
    format.Set("pitch", Napi::Number::New(env, video_pitch_));
    
    return format;
}
