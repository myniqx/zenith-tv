#ifndef VLC_OS_WINDOW_WIN32_H
#define VLC_OS_WINDOW_WIN32_H

#include "../vlc_os_window.h"
#include <windows.h>
#include <gdiplus.h>
#include <map>
#include <vector>
#include <algorithm>

#pragma comment(lib, "gdiplus.lib")

// =================================================================================================
// Win32 Main Window - VLC player window with OSD management
// =================================================================================================

class Win32Window : public OSWindow
{
public:
    Win32Window(VlcPlayer *player);
    ~Win32Window() override;

    // =================================================================================================
    // Window Lifecycle (OSWindow abstract methods)
    // =================================================================================================

    bool Create(int width, int height) override;
    void Destroy() override;
    bool IsCreated() const override;
    bool Bind(libvlc_media_player_t *media_player) override;

    // =================================================================================================
    // Window State Queries (OSWindow abstract methods)
    // =================================================================================================

    bool IsVisible() const override;
    bool IsMinimized() const override;
    bool IsFullscreen() const override;
    bool IsOnTop() const override;
    void GetBounds(WindowBounds *bounds) const override;
    WindowBounds GetClientArea() const override;

    // =================================================================================================
    // Text Measurement (OSWindow abstract method)
    // =================================================================================================

    Dimension MeasureText(OSDFont font, const std::string &text) override;

protected:
    // =================================================================================================
    // Color/Font Management (OSWindow abstract methods)
    // =================================================================================================

    OSDColor CreateColor(int r, int g, int b, int a) override;
    OSDFont CreateFont(bool bold) override;
    void DestroyColor(OSDColor color) override;
    void DestroyFont(OSDFont font) override;

    // =================================================================================================
    // OSD Management (OSWindow abstract methods)
    // =================================================================================================

    std::shared_ptr<OSDWindow> CreateOSDWindow() override;
    void InitializeOSDPlatform() override;
    void ShutdownOSDPlatform() override;
    void DestroyOSDWindow(std::shared_ptr<OSDWindow> osd) override;

    // =================================================================================================
    // Context Menu (OSWindow abstract methods)
    // =================================================================================================

    void CreateContextMenu(std::vector<VlcPlayer::MenuItem> items, int x, int y) override;
    void DestroyContextMenu() override;

    // =================================================================================================
    // Window Manipulation Internal (OSWindow abstract methods)
    // =================================================================================================

    void SetBoundsInternal(int x, int y, int width, int height) override;
    void SetStyleInternal(const WindowStyle &style) override;

private:
    // =================================================================================================
    // Win32 Window Management
    // =================================================================================================

    HWND hwnd_;                          // Main window handle
    HINSTANCE hinstance_;                // Application instance
    HMENU hmenu_;                        // Context menu handle

    // Window state (cached for queries)
    bool is_created_;
    bool is_visible_;
    bool is_minimized_;
    WindowBounds bounds_;
    WindowBounds client_area_;
    WindowStyle current_style_;

    // VLC integration
    libvlc_media_player_t *media_player_;

    // GDI+ for text measurement and color management
    ULONG_PTR gdiplus_token_;           // GDI+ initialization token
    Gdiplus::Graphics *measure_graphics_;
    HDC measure_dc_;

    // Stored colors and fonts (for cleanup)
    std::vector<Gdiplus::Color *> colors_;
    std::vector<Gdiplus::Font *> fonts_;

    // Context menu tracking
    std::map<UINT, VlcPlayer::MenuItem> menu_item_map_;
    UINT next_menu_id_;

    // =================================================================================================
    // Window Procedure & Message Handling
    // =================================================================================================

    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
    LRESULT HandleMessage(UINT msg, WPARAM wParam, LPARAM lParam);

    // Message handlers
    void HandleKeyDown(WPARAM wParam, LPARAM lParam);
    void HandleMouseMove(LPARAM lParam);
    void HandleMouseButton(UINT msg, WPARAM wParam, LPARAM lParam);
    void HandleSize(WPARAM wParam, LPARAM lParam);
    void HandleMove(LPARAM lParam);

    // =================================================================================================
    // Helper Methods
    // =================================================================================================

    void RegisterWindowClass();
    void UnregisterWindowClass();
    void UpdateClientArea();
    void ApplyWindowStyle(const WindowStyle &style);
    std::string GetKeyName(WPARAM wParam, LPARAM lParam);
    bool GetKeyModifiers(bool &ctrl, bool &shift, bool &alt, bool &meta);

    // Context menu helpers
    void BuildWin32Menu(HMENU menu, const std::vector<VlcPlayer::MenuItem> &items);
    void HandleMenuCommand(UINT command_id);
};

#endif // VLC_OS_WINDOW_WIN32_H
