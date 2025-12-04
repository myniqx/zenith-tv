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
#include <memory>
#include <chrono>
#include <thread>
#include "os/vlc_os_window.h"

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

    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VlcPlayer(const Napi::CallbackInfo &info);
    ~VlcPlayer();

#ifdef _WIN32
    // Windows needs access to these methods from the window procedure
    friend LRESULT CALLBACK VlcWindowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
#endif

    // Internal members accessible by split files
    libvlc_instance_t *vlc_instance_;
    libvlc_media_player_t *media_player_;
    libvlc_media_t *current_media_;
    std::mutex mutex_;
    std::atomic<bool> disposed_{false};
    OSWindow *osd_window_;

    // Child window handles (platform-specific - kept for Linux/Mac compatibility)
#ifdef __linux__
    Display *display_;
    ::Window child_window_;
    ::Window parent_window_;
    std::atomic<bool> event_loop_running_{false};
    std::atomic<bool> was_playing_before_minimize_{false};
    std::mutex window_mutex_; // Protects child_window_ access

    // Cached X11 atoms (initialized in CreateChildWindowInternal)
    Atom wm_delete_window_atom_;
    Atom wm_state_atom_;
    Atom wm_state_fullscreen_atom_;
    Atom wm_state_above_atom_;
    Atom wm_state_skip_taskbar_atom_;
    Atom motif_hints_atom_;

    void StartEventLoop();
    void StopEventLoop();
    void SendWindowStateMessage(Atom state_atom, bool enable);
#elif defined(__APPLE__)
    void *child_nsview_;
    void *parent_nsview_;
#endif
    bool child_window_created_;

    // Window state management
    struct WindowState
    {
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
    bool is_window_visible_; // Track window visibility (minimize/hide state)

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

    // Internal window management methods
    void CreateChildWindowInternal(int width = 1280, int height = 720);
    void DestroyChildWindowInternal();

    // Cleanup
    Napi::Value Dispose(const Napi::CallbackInfo &info);

    // Event handling
    Napi::ThreadSafeFunction tsfn_events_;

    // Keyboard shortcut mapping (action -> keys[])
    // New format: { "playPause": ["Space", "KeyK"], "volumeUp": ["ArrowUp", "Equal"] }
    std::map<std::string, std::vector<std::string>> action_to_keys_;
    void ProcessKeyPress(const std::string &key_code);


    // Context Menu Infrastructure
    struct MenuItem
    {
        std::string label;
        std::string action;   // Action name to trigger via ProcessKeyPress
        std::string shortcut; // Keyboard shortcut display (e.g., "F11", "Space")
        bool enabled;
        bool separator;
        bool disabled;
        bool checked;
        std::function<void()> callback;
        std::vector<MenuItem> submenu;

        MenuItem() : enabled(true), separator(false), disabled(false), checked(false) {}
    };

    std::vector<MenuItem> BuildContextMenu();
    void ExecuteMenuAction(const std::string &action);

    // Helper methods for OSD (delegates to osd_window_)
    std::string FormatTime(int64_t time_ms);

#ifdef __linux__
    struct MenuColors
    {
        unsigned long background;
        unsigned long foreground;
        unsigned long hoverBackground;
        unsigned long hoverForeground;
        unsigned long border;
        unsigned long separator;
        unsigned long disabledText;
    };

    // Enhanced menu state for multi-level support
    struct MenuWindowState
    {
        ::Window window;
        Pixmap backBuffer;
        std::vector<MenuItem> items;
        int hoveredItem;
        int selectedItem; // For keyboard navigation
        int width;
        int height;
        int posX;
        int posY;
        MenuWindowState *parent;
        MenuWindowState *child;
        bool active;

        MenuWindowState()
            : window(0), backBuffer(0), hoveredItem(-1), selectedItem(-1),
              width(0), height(0), posX(0), posY(0),
              parent(nullptr), child(nullptr), active(false) {}
    };

    // Helper methods for menu rendering (Linux X11)
    MenuColors GetGtkThemeColors();
    unsigned long AllocColor(unsigned long rgb);
    void DrawMenuItem(::Window window, GC gc, const MenuItem &item, int yPos,
                      int width, int height, bool hovered, bool selected, const MenuColors &colors);
    void RedrawMenu(MenuWindowState *menu, GC gc, const MenuColors &colors);
    MenuWindowState *CreateMenuState(int x, int y, const std::vector<MenuItem> &items,
                                     const MenuColors &colors, MenuWindowState *parent = nullptr);
    void DestroyMenuState(MenuWindowState *menu);
    void CloseChildMenus(MenuWindowState *menu);
    bool OpenSubmenu(MenuWindowState *menu, int itemIndex, GC gc, const MenuColors &colors);
    bool HandleMenuEvent(MenuWindowState *rootMenu, XEvent &event, GC gc,
                         const MenuColors &colors, bool &menuActive);
    int CalculateMenuHeight(const std::vector<MenuItem> &items);
    bool IsPointInMenu(MenuWindowState *menu, int x, int y);
    void SetMenuOpacity(::Window window, double opacity);
#endif

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
    void EmitShortcut(const std::string &action);
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
