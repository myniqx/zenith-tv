#ifndef VLC_PLAYER_H
#define VLC_PLAYER_H

#include <napi.h>

// Windows-specific type definitions needed by VLC headers
#ifdef _WIN32
#include <BaseTsd.h>
typedef SSIZE_T ssize_t;
#endif

#include <cstdint>
#include <vlc/vlc.h>
#include <string>
#include <vector>
#include <mutex>
#include <atomic>

#ifdef _WIN32
#include <windows.h>
#elif defined(__linux__)
#include <X11/Xlib.h>
#elif defined(__APPLE__)
#include <objc/objc.h>
#endif

class VlcPlayer : public Napi::ObjectWrap<VlcPlayer> {
public:
    // Constants
    static constexpr int MIN_WINDOW_SIZE = 1;
    static constexpr size_t MAX_URL_LENGTH = 8192;

    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VlcPlayer(const Napi::CallbackInfo& info);
    ~VlcPlayer();

    // Internal members accessible by split files
    libvlc_instance_t* vlc_instance_;
    libvlc_media_player_t* media_player_;
    libvlc_media_t* current_media_;
    std::mutex mutex_;
    std::atomic<bool> disposed_{false};
    std::string rendering_mode_; // "mem" or "win"

    // Child window handles (platform-specific)
#ifdef _WIN32
    HWND child_hwnd_;
    HWND parent_hwnd_;
#elif defined(__linux__)
    Display* display_;
    Window child_window_;
    Window parent_window_;
#elif defined(__APPLE__)
    void* child_nsview_;
    void* parent_nsview_;
#endif
    bool child_window_created_;

    // Video memory (vmem) callback support
    unsigned int video_width_;
    unsigned int video_height_;
    unsigned int video_pitch_;
    std::vector<uint8_t> frame_buffer_;
    std::mutex frame_mutex_;
    bool frame_ready_;

private:
    // Core VLC methods
    Napi::Value Play(const Napi::CallbackInfo& info);
    Napi::Value Pause(const Napi::CallbackInfo& info);
    Napi::Value Resume(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value SetMedia(const Napi::CallbackInfo& info);

    // Playback control
    Napi::Value Seek(const Napi::CallbackInfo& info);
    Napi::Value SetVolume(const Napi::CallbackInfo& info);
    Napi::Value GetVolume(const Napi::CallbackInfo& info);
    Napi::Value SetMute(const Napi::CallbackInfo& info);
    Napi::Value GetMute(const Napi::CallbackInfo& info);
    Napi::Value SetRate(const Napi::CallbackInfo& info);
    Napi::Value GetRate(const Napi::CallbackInfo& info);

    // Time/Position
    Napi::Value GetTime(const Napi::CallbackInfo& info);
    Napi::Value GetLength(const Napi::CallbackInfo& info);
    Napi::Value GetPosition(const Napi::CallbackInfo& info);
    Napi::Value SetPosition(const Napi::CallbackInfo& info);

    // State
    Napi::Value GetState(const Napi::CallbackInfo& info);
    Napi::Value IsPlaying(const Napi::CallbackInfo& info);
    Napi::Value IsSeekable(const Napi::CallbackInfo& info);

    // Audio tracks
    Napi::Value GetAudioTracks(const Napi::CallbackInfo& info);
    Napi::Value GetAudioTrack(const Napi::CallbackInfo& info);
    Napi::Value SetAudioTrack(const Napi::CallbackInfo& info);

    // Subtitle tracks
    Napi::Value GetSubtitleTracks(const Napi::CallbackInfo& info);
    Napi::Value GetSubtitleTrack(const Napi::CallbackInfo& info);
    Napi::Value SetSubtitleTrack(const Napi::CallbackInfo& info);
    Napi::Value SetSubtitleDelay(const Napi::CallbackInfo& info);

    // Video tracks
    Napi::Value GetVideoTracks(const Napi::CallbackInfo& info);

    // Window embedding (legacy - sets VLC to render on given window)
    Napi::Value SetWindow(const Napi::CallbackInfo& info);

    // Child window embedding (new - creates native child window for VLC)
    Napi::Value CreateChildWindow(const Napi::CallbackInfo& info);
    Napi::Value DestroyChildWindow(const Napi::CallbackInfo& info);
    Napi::Value SetBounds(const Napi::CallbackInfo& info);
    Napi::Value ShowWindow(const Napi::CallbackInfo& info);
    Napi::Value HideWindow(const Napi::CallbackInfo& info);

    // Event callbacks
    Napi::Value On(const Napi::CallbackInfo& info);
    Napi::Value Off(const Napi::CallbackInfo& info);

    // Cleanup
    Napi::Value Dispose(const Napi::CallbackInfo& info);

    // Event handling
    Napi::ThreadSafeFunction tsfn_time_changed_;
    Napi::ThreadSafeFunction tsfn_state_changed_;
    Napi::ThreadSafeFunction tsfn_end_reached_;
    Napi::ThreadSafeFunction tsfn_error_;

    // Event manager
    libvlc_event_manager_t* event_manager_;

    void SetupEventCallbacks();
    void CleanupEventCallbacks();

    // Static event handlers
    static void HandleTimeChanged(const libvlc_event_t* event, void* data);
    static void HandleStateChanged(const libvlc_event_t* event, void* data);
    static void HandleEndReached(const libvlc_event_t* event, void* data);
    static void HandleError(const libvlc_event_t* event, void* data);

    // Video memory callbacks
    void SetupVideoCallbacks();
    static void* VideoLockCallback(void* opaque, void** planes);
    static void VideoUnlockCallback(void* opaque, void* picture, void* const* planes);
    static void VideoDisplayCallback(void* opaque, void* picture);

    // Frame retrieval
    Napi::Value GetFrame(const Napi::CallbackInfo& info);
    Napi::Value GetVideoFormat(const Napi::CallbackInfo& info);
};

#endif // VLC_PLAYER_H
