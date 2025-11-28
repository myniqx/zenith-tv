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
#include <map>
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
    ::Window child_window_;  // Use :: to avoid conflict with Window() method
    ::Window parent_window_;
    std::atomic<bool> event_loop_running_{false};
    void StartEventLoop();
    void StopEventLoop();
#elif defined(__APPLE__)
    void* child_nsview_;
    void* parent_nsview_;
#endif
    bool child_window_created_;

    // Window state management
    struct WindowState {
        int x;
        int y;
        int width;
        int height;
        bool has_border;
        bool has_titlebar;
        bool is_resizable;
    };
    WindowState saved_window_state_;
    bool is_fullscreen_;

    // Video memory (vmem) callback support
    unsigned int video_width_;
    unsigned int video_height_;
    unsigned int video_pitch_;
    std::vector<uint8_t> frame_buffer_;
    std::mutex frame_mutex_;
    bool frame_ready_;
    std::atomic<float> buffering_progress_{0.0f};

private:
    // Unified API Methods
    Napi::Value Open(const Napi::CallbackInfo& info);
    Napi::Value Playback(const Napi::CallbackInfo& info);
    Napi::Value Audio(const Napi::CallbackInfo& info);
    Napi::Value Video(const Napi::CallbackInfo& info);
    Napi::Value Subtitle(const Napi::CallbackInfo& info);
    /**
     * Get comprehensive media information (tracks, duration, seekability)
     * Returns: { duration, isSeekable, audioTracks, subtitleTracks, currentAudioTrack, currentSubtitleTrack }
     */
    Napi::Value GetMediaInfo(const Napi::CallbackInfo& info);

    /**
     * Get current player state information (time, length, state, isPlaying)
     * Returns: { time, length, state, isPlaying }
     */
    Napi::Value GetPlayerInfo(const Napi::CallbackInfo& info);

    // Internal storage for media options (applied on Open)
    std::map<std::string, std::string> media_options_;

    // Playback control setters (used by unified APIs)
    Napi::Value Seek(const Napi::CallbackInfo& info);
    Napi::Value SetVolume(const Napi::CallbackInfo& info);
    Napi::Value SetMute(const Napi::CallbackInfo& info);
    Napi::Value SetRate(const Napi::CallbackInfo& info);
    Napi::Value SetAudioTrack(const Napi::CallbackInfo& info);
    Napi::Value SetSubtitleTrack(const Napi::CallbackInfo& info);
    Napi::Value SetSubtitleDelay(const Napi::CallbackInfo& info);

    // Track list getters (used by getMediaInfo)
    Napi::Value GetAudioTracks(const Napi::CallbackInfo& info);
    Napi::Value GetSubtitleTracks(const Napi::CallbackInfo& info);
    Napi::Value GetVideoTracks(const Napi::CallbackInfo& info);

    // Unified Window API (declared before internal methods to avoid X11 Window typedef conflict)
    Napi::Value Window(const Napi::CallbackInfo& info);

    // Unified Shortcut API
    Napi::Value Shortcut(const Napi::CallbackInfo& info);

    // Unified Event Callback
    Napi::Value SetEventCallback(const Napi::CallbackInfo& info);

    // Internal window management methods (platform-specific implementations)
    void CreateChildWindowInternal(int width = 1280, int height = 720);
    void DestroyChildWindowInternal();
    void SetWindowBounds(int x, int y, int width, int height);
    void SetWindowFullscreen(bool fullscreen);
    void SetWindowOnTop(bool onTop);
    void SetWindowVisible(bool visible);
    void SetWindowStyle(bool border, bool titlebar, bool resizable, bool taskbar);
    void SetWindowMinSizeInternal(int min_width, int min_height);
    void GetWindowBounds(WindowState* state);

    // Cleanup
    Napi::Value Dispose(const Napi::CallbackInfo& info);

    // Event handling
    Napi::ThreadSafeFunction tsfn_events_;

    // Keyboard shortcut mapping (action -> keys[])
    // New format: { "playPause": ["Space", "KeyK"], "volumeUp": ["ArrowUp", "Equal"] }
    std::map<std::string, std::vector<std::string>> action_to_keys_;
    void ProcessKeyPress(const std::string& key_code);

    // Context Menu Infrastructure
    struct MenuItem {
        std::string label;
        std::string action;        // Action name to trigger via ProcessKeyPress
        std::string shortcut;      // Keyboard shortcut display (e.g., "F11", "Space")
        bool enabled;
        bool separator;
        std::vector<MenuItem> submenu;
        
        MenuItem() : enabled(true), separator(false) {}
    };
    
    std::vector<MenuItem> BuildContextMenu();
    void ShowContextMenu(int x, int y);
    void ExecuteMenuAction(const std::string& action);


    // Event manager
    libvlc_event_manager_t* event_manager_;

    void SetupEventCallbacks();
    void CleanupEventCallbacks();

    // Static event handlers
    static void HandleTimeChanged(const libvlc_event_t* event, void* data);
    static void HandleStateChanged(const libvlc_event_t* event, void* data);
    static void HandleEndReached(const libvlc_event_t* event, void* data);
    static void HandleError(const libvlc_event_t* event, void* data);
    static void HandleLengthChanged(const libvlc_event_t* event, void* data);
    static void HandleBuffering(const libvlc_event_t* event, void* data);

    // Shortcut management
    void InitializeDefaultShortcuts();
    std::string GetFirstKeyForAction(const std::string& action);
    bool HasKeyForAction(const std::string& action);
    bool IsKnownAction(const std::string& action);

    // Helpers
    Napi::Object GetMediaInfoObject(Napi::Env env);

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
