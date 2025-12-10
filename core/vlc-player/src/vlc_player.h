#ifndef VLC_PLAYER_H
#define VLC_PLAYER_H

#include <napi.h>

// Windows-specific type definitions needed by VLC headers
#ifdef _WIN32
#include <BaseTsd.h>
typedef SSIZE_T ssize_t;
#endif

#include <cstdint>
#include <cstdarg>
#include <vlc/vlc.h>
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <atomic>
#include <memory>
#include <chrono>
#include <thread>
#include "os/common.h"
#include "os/window_base.h"

#ifdef _WIN32
#include <windows.h>
#elif defined(__linux__)
#include <X11/Xlib.h>
#elif defined(__APPLE__)
#include <objc/objc.h>
#endif

class VlcPlayer : public Napi::ObjectWrap<VlcPlayer>
{
public:
    // Constants
    static constexpr int MIN_WINDOW_SIZE = 1;
    static constexpr size_t MAX_URL_LENGTH = 8192;

    // Debug logging helper
    static void Log(const char *format, ...)
    {
        printf("[VLC Node] ");
        va_list args;
        va_start(args, format);
        vprintf(format, args);
        va_end(args);
        printf("\n");
        fflush(stdout);
    }

    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VlcPlayer(const Napi::CallbackInfo &info);
    ~VlcPlayer();

#ifdef _WIN32
    // Windows needs access to these methods from the window procedure
    friend LRESULT CALLBACK VlcWindowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
    friend class Win32Window;
#endif

    // Internal members accessible by split files
    libvlc_instance_t *vlc_instance_;
    libvlc_media_player_t *media_player_;
    libvlc_media_t *current_media_;
    std::mutex mutex_;
    std::atomic<bool> disposed_{false};
    OSWindow *osd_window_;


    // Video memory (vmem) callback support
    unsigned int video_width_;
    unsigned int video_height_;
    unsigned int video_pitch_;
    std::vector<uint8_t> frame_buffer_;
    std::mutex frame_mutex_;
    bool frame_ready_;
    std::atomic<float> buffering_progress_{0.0f};

    void ProcessKeyPress(const std::string &key_code);

    std::vector<MenuItem> BuildContextMenu();

    void EmitShortcut(const std::string &action);

private:
    // Unified API Methods
    Napi::Value Open(const Napi::CallbackInfo &info);
    Napi::Value Playback(const Napi::CallbackInfo &info);
    Napi::Value Audio(const Napi::CallbackInfo &info);
    Napi::Value Video(const Napi::CallbackInfo &info);
    Napi::Value Subtitle(const Napi::CallbackInfo &info);
    /**
     * Get comprehensive media information (tracks, duration, seekability)
     * Returns: { duration, isSeekable, audioTracks, subtitleTracks, videoTracks }
     */
    Napi::Value GetMediaInfo(const Napi::CallbackInfo &info);

    // Internal storage for media options (applied on Open)
    std::map<std::string, std::string> media_options_;

    // Unified Window API (declared before internal methods to avoid X11 Window typedef conflict)
    Napi::Value Window(const Napi::CallbackInfo &info);

    // Unified Shortcut API
    Napi::Value Shortcut(const Napi::CallbackInfo &info);

    // Unified Event Callback
    Napi::Value SetEventCallback(const Napi::CallbackInfo &info);

    // Cleanup
    Napi::Value Dispose(const Napi::CallbackInfo &info);

    // Event handling
    Napi::ThreadSafeFunction tsfn_events_;

    // Keyboard shortcut mapping (action -> keys[])
    // New format: { "playPause": ["Space", "KeyK"], "volumeUp": ["ArrowUp", "Equal"] }
    std::map<std::string, std::vector<std::string>> action_to_keys_;

    void ExecuteMenuAction(const std::string &action);

    // Helper methods for OSD (delegates to osd_window_)
    std::string FormatTime(int64_t time_ms);

    // Event manager
    libvlc_event_manager_t *event_manager_;

    void SetupEventCallbacks();
    void CleanupEventCallbacks();

    // Static event handlers
    static void HandleTimeChanged(const libvlc_event_t *event, void *data);
    static void HandleStateChanged(const libvlc_event_t *event, void *data);
    static void HandleEndReached(const libvlc_event_t *event, void *data);
    static void HandleError(const libvlc_event_t *event, void *data);
    static void HandleLengthChanged(const libvlc_event_t *event, void *data);
    static void HandleBuffering(const libvlc_event_t *event, void *data);

    // Shortcut management
    void InitializeDefaultShortcuts();
    std::string GetFirstKeyForAction(const std::string &action);
    bool HasKeyForAction(const std::string &action);
    bool IsKnownAction(const std::string &action);

    // Helpers
    Napi::Object GetMediaInfoObject(Napi::Env env);

    // Event emission helpers
    void EmitCurrentVideo(std::function<void(Napi::Env, Napi::Object &)> builder);
    void EmitPlayerInfo(std::function<void(Napi::Env, Napi::Object &)> builder);
    void EmitMediaInfo();

    // Video memory callbacks
    void SetupVideoCallbacks();
    static void *VideoLockCallback(void *opaque, void **planes);
    static void VideoUnlockCallback(void *opaque, void *picture, void *const *planes);
    static void VideoDisplayCallback(void *opaque, void *picture);

    // Frame retrieval
    Napi::Value GetFrame(const Napi::CallbackInfo &info);
    Napi::Value GetVideoFormat(const Napi::CallbackInfo &info);
};

#endif // VLC_PLAYER_H
