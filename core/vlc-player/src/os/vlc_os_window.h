#ifndef VLC_OS_WINDOW_H
#define VLC_OS_WINDOW_H

#include <string>
#include <functional>
#include <memory>
#include <cstdint>
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <atomic>
#include <memory>
#include <chrono>
#include <thread>
#include "common.h"
#include "vlc_os_osd.h"

// =================================================================================================
// Forward Declarations
// =================================================================================================

struct libvlc_media_player_t;

class OSWindow
{
public:
    // =================================================================================================
    // Constructor & Destructor
    // =================================================================================================

    OSWindow();
    ~OSWindow();

    // Prevent copy/move
    OSWindow(const OSWindow &) = delete;
    OSWindow &operator=(const OSWindow &) = delete;
    OSWindow(OSWindow &&) = delete;
    OSWindow &operator=(OSWindow &&) = delete;

    // =================================================================================================
    // Window Lifecycle
    // =================================================================================================

    /**
     * Create the main window for VLC player
     * @param width Initial window width
     * @param height Initial window height
     * @return true if successful, false otherwise
     */
    virtual bool Create(int width, int height) = 0;
    virtual void Destroy() = 0;
    virtual bool IsCreated() const = 0;

    /**
     * Bind VLC media player to this window
     * @param media_player VLC media player instance
     * @return true if successful, false otherwise
     */
    virtual bool Bind(libvlc_media_player_t *media_player) = 0;

    // =================================================================================================
    // Window State Queries
    // =================================================================================================

    /**
     * Check if window is currently visible (not hidden or minimized)
     */
    bool IsVisible() const;
    bool IsMinimized() const;
    bool IsFullscreen() const;
    bool IsOnTop() const;

    /**
     * Get current window bounds (position and size)
     * @param bounds Output parameter for window bounds
     */
    void GetBounds(WindowBounds *bounds) const;

    /**
     * Get window client area (inner drawable area, excluding title bar and borders)
     * This is the usable area for rendering content like OSD overlays.
     * Pre-calculated and cached on resize/style change events.
     * Coordinates are in screen space.
     * @return WindowBounds with client area coordinates and size
     */
    WindowBounds GetClientArea() const;

    /**
     * Get current window style
     * @param style Output parameter for window style
     */
    void GetStyle(WindowStyle *style) const;

    // =================================================================================================
    // Window Manipulation
    // =================================================================================================

    void SetBounds(int x, int y, int width, int height);
    void SetFullscreen(bool fullscreen);
    void SetOnTop(bool on_top);
    void SetVisible(bool visible);
    void SetStyle(const WindowStyle &style);

    // =================================================================================================
    // OSD Management (Fully Encapsulated)
    // =================================================================================================

    /**
     * Show an OSD overlay
     * @param type OSD type (determines position, layout, and duration)
     * @param text Primary text to display
     * @param subtext Secondary text (optional, e.g., "00:45 / 02:30" for SEEK)
     * @param progress Progress value 0.0-1.0 (for VOLUME, SEEK)
     */
    void ShowOSD(OSDType type,
                 const std::string &text,
                 const std::string &subtext = "",
                 float progress = 0.0f);

    /**
     * Update existing OSD content without resetting timer
     * Useful for continuous updates (e.g., volume dragging)
     * @param type OSD type to update
     * @param text New text
     * @param progress New progress value
     */
    void UpdateOSD(OSDType type,
                   const std::string &text,
                   float progress);

    /**
     * Hide specific OSD type immediately (fade out)
     * @param type OSD type to hide
     */
    void HideOSD(OSDType type);

    /**
     * Hide all active OSDs immediately
     * Called automatically on minimize/hide/destroy
     */
    void HideAllOSDs();

    OSDColor background;     // 0x1a1a1a (dark semi-transparent)
    OSDColor text_primary;   // 0xffffff (white)
    OSDColor text_secondary; // 0xb0b0b0 (light gray)
    OSDColor progress_fg;    // 0x4a9eff (blue accent)
    OSDColor progress_bg;    // 0x3a3a3a (dark gray)
    OSDColor border;         // 0x2a2a2a (subtle border)

protected:
    virtual OSDColor CreateColor(int r, int g, int b, int a) = 0;
    virtual void DestroyColor(OSDColor color) = 0;

    // =================================================================================================
    // Platform-Agnostic Event Handlers (implemented in vlc_os_window.cpp)
    // =================================================================================================
    // These methods are called by platform-specific code when events occur.
    // They handle common logic across all platforms (e.g., OSD updates, state tracking).
    // Platform implementations call these from their event loops.

    /**
     * Called when keyboard or mouse input is received
     * @param key_code Key identifier ("Space", "KeyF", "MouseLeft", "MouseWheelUp", etc.)
     * @param ctrl Is Ctrl key pressed?
     * @param shift Is Shift key pressed?
     * @param alt Is Alt key pressed?
     * @param meta Is Windows/Command key pressed?
     */
    void OnInput(const std::string &key_code, bool ctrl, bool shift, bool alt, bool meta);
    void OnMinimize(bool minimized);
    void OnClose();
    void OnResize(int x, int y, int width, int height);

    /**
     * Called when window visibility changes (hide/show)
     * @param visible true if visible, false if hidden
     */
    void OnVisibilityChange(bool visible);

    /**
     * Called when right-click context menu is requested
     * @param screen_x Screen X coordinate
     * @param screen_y Screen Y coordinate
     */
    void OnContextMenu(int screen_x, int screen_y);

private:
    // =================================================================================================
    // OSD Internal Management (implemented in vlc_os_window.cpp)
    // =================================================================================================

    OSDPosition GetPositionForType(OSDType type);
    std::string FormatTime(int64_t time_ms);
    int CalculateSlotIndex(OSDPosition position);
    void CompactSlots(OSDPosition position);
    void StartOSDRenderLoop();
    void StopOSDRenderLoop();
    void UpdateOSDLifecycles();
    void RemoveExpiredOSDs();
    void RenderOSD(std::shared_ptr<OSDWindow> osd);

    std::vector<std::shared_ptr<OSDWindow>> active_osds_;
    std::mutex osd_mutex_;
    std::atomic<bool> osd_thread_running_{false};
    std::thread osd_render_thread_;
};

#endif // VLC_OS_WINDOW_H
