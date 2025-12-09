#ifndef VLC_OS_WINDOW_LINUX_H
#define VLC_OS_WINDOW_LINUX_H

#include "../window_base.h"
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xft/Xft.h>
#include <map>
#include <vector>
#include <thread>
#include <atomic>
#include <mutex>

// Undefine X11 macros that conflict with our method names
#undef None


// =================================================================================================
// Linux X11 Window - VLC player window with OSD management
// =================================================================================================

class LinuxWindow : public OSWindow
{
public:
    LinuxWindow(VlcPlayer *player);
    ~LinuxWindow() override;

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

    // =================================================================================================
    // X11 Resource Access (for OSDWindow sharing)
    // =================================================================================================

    Display *GetDisplay() const { return display_; }
    int GetScreen() const { return screen_; }

protected:
    // =================================================================================================
    // Color/Font Management (OSWindow abstract methods)
    // =================================================================================================

    OSDColor CreateColor(int r, int g, int b, int a) override;
    OSDFont CreateOSDFont(bool bold) override;
    void DestroyColor(OSDColor color) override;
    void DestroyFont(OSDFont font) override;

    // =================================================================================================
    // OSD Management (OSWindow abstract methods)
    // =================================================================================================

    std::shared_ptr<OSDWindow> CreateOSDWindow() override;

    // =================================================================================================
    // Context Menu (OSWindow abstract methods)
    // =================================================================================================

    void CreateContextMenu(std::vector<MenuItem> items, int x, int y) override;
    void DestroyContextMenu() override;

    // =================================================================================================
    // Window Manipulation Internal (OSWindow abstract methods)
    // =================================================================================================

    void SetBoundsInternal(int x, int y, int width, int height) override;
    void SetStyleInternal(const WindowStyle &style) override;

private:
    // =================================================================================================
    // X11 Window Management
    // =================================================================================================

    Display *display_;               // X11 display connection
    ::Window window_;                // Main window handle
    int screen_;                     // X11 screen number

    // Cached X11 atoms (for performance)
    Atom wm_delete_window_atom_;
    Atom wm_state_atom_;
    Atom wm_state_fullscreen_atom_;
    Atom wm_state_above_atom_;
    Atom wm_state_skip_taskbar_atom_;
    Atom motif_hints_atom_;
    Atom wm_window_opacity_atom_;

    // Window state (cached for queries)
    bool is_created_;
    bool is_visible_;
    bool is_minimized_;
    bool is_fullscreen_;
    bool is_on_top_;
    WindowBounds bounds_;
    WindowBounds client_area_;
    WindowBounds saved_state_;       // For fullscreen toggle

    // VLC integration
    libvlc_media_player_t *media_player_;

    // Xft for text rendering
    XftDraw *xft_draw_;              // Xft drawing context
    std::vector<XftColor *> colors_; // Stored colors (for cleanup)
    std::vector<XftFont *> fonts_;   // Stored fonts (for cleanup)

    // Message loop thread
    std::thread message_thread_;
    std::atomic<bool> message_thread_running_{false};
    std::mutex window_mutex_;

    // =================================================================================================
    // Window Procedure & Message Handling
    // =================================================================================================

    void StartMessageLoop();
    void StopMessageLoop();
    void ProcessEvents();

    // Event handlers
    void HandleKeyPress(XEvent *event);
    void HandleButtonPress(XEvent *event);
    void HandleConfigureNotify(XEvent *event);
    void HandlePropertyNotify(XEvent *event);
    void HandleClientMessage(XEvent *event);
    void HandleMapNotify();
    void HandleUnmapNotify();

    // =================================================================================================
    // Helper Methods
    // =================================================================================================

    void InitializeAtoms();
    void UpdateClientArea();
    void SendWindowStateMessage(Atom state_atom, bool enable);
    std::string GetKeyName(KeySym keysym);
    bool GetKeyModifiers(bool &ctrl, bool &shift, bool &alt, bool &meta);

    // =================================================================================================
    // Context Menu Structures and Methods (implemented in context_menu.cpp)
    // =================================================================================================

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

    // Context menu state
    MenuWindowState *root_menu_;
    bool context_menu_active_;

    // Context menu methods (implemented in context_menu.cpp)
    MenuColors GetGtkThemeColors();
    unsigned long AllocColor(unsigned long rgb);
    int CalculateMenuHeight(const std::vector<MenuItem> &items);
    MenuWindowState *CreateMenuState(int x, int y, const std::vector<MenuItem> &items,
                                     const MenuColors &colors, MenuWindowState *parent = nullptr);
    void DestroyMenuState(MenuWindowState *menu);
    void CloseChildMenus(MenuWindowState *menu);
    void DrawMenuItem(::Window window, GC gc, const MenuItem &item, int yPos,
                      int width, int height, bool hovered, bool selected, const MenuColors &colors);
    void RedrawMenu(MenuWindowState *menu, GC gc, const MenuColors &colors);
    bool OpenSubmenu(MenuWindowState *menu, int itemIndex, GC gc, const MenuColors &colors);
    bool HandleMenuEvent(MenuWindowState *rootMenu, XEvent &event, GC gc,
                         const MenuColors &colors, bool &menuActive);
    void SetMenuOpacity(::Window window, double opacity);
};

#endif // VLC_OS_WINDOW_LINUX_H
