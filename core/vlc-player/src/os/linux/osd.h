#ifndef VLC_OS_LINUX_OSD_H
#define VLC_OS_LINUX_OSD_H

#include "../base_osd.h"
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xft/Xft.h>
#include <X11/extensions/Xrender.h>
#include <map>

// Undefine X11 macros
#undef None


// =================================================================================================
// Linux X11 OSD Window - Transparent overlay window with Xft text and XRender transparency
// =================================================================================================

class LinuxOSDWindow : public OSDWindow
{
public:
    LinuxOSDWindow(OSWindow *parent);
    ~LinuxOSDWindow() override;

    // Window state query
    bool isWindowCreated() const override;

    // Buffer flush
    void Flush() override;

protected:
    // Window lifecycle
    void CreateWindowInternal(int x, int y) override;
    void DestroyWindowInternal() override;
    void MoveInternal(int x, int y) override;
    void SetSizeInternal(int width, int height) override;
    void SetOpacityInternal(float opacity) override;

    // Drawing primitives (X11 + XRender)
    void DrawRoundedRect(int x, int y, int width, int height,
                         OSDColor color, int radius) override;
    void DrawPolygon(Point *points, int pointSize, OSDColor color) override;
    void DrawArc(int x, int y, int width, int height,
                 int startAngle, int endAngle, OSDColor color) override;
    void DrawLine(int x1, int y1, int x2, int y2, OSDColor color) override;
    void DrawCircle(int x, int y, int radius, OSDColor color) override;
    void ClearDrawable(int x, int y, int width, int height, OSDColor color) override;
    void DrawText(const std::string &text, int x, int y,
                  OSDColor color, OSDFont font) override;

private:
    Display *display_;               // X11 display connection
    ::Window window_;                // OSD window handle
    int screen_;                     // X11 screen number
    Visual *visual_;                 // ARGB visual for transparency
    Colormap colormap_;              // Colormap for ARGB visual

    // Offscreen rendering
    Pixmap pixmap_;                  // Offscreen buffer
    Picture pixmap_picture_;         // XRender picture for pixmap
    Picture window_picture_;         // XRender picture for window
    GC gc_;                          // Graphics context
    XftDraw *xft_draw_;              // Xft drawing context

    // Transparency support
    bool has_composite_;             // XComposite extension available?
    float current_opacity_;          // Current opacity (0.0-1.0)

    // Pre-computed corner masks (for rounded rectangles)
    std::map<int, Picture> corner_masks_;  // radius -> XRender Picture

    // Helper methods
    bool FindARGBVisual();           // Find 32-bit ARGB visual
    void InitializeXRender();        // Initialize XRender pictures
    void CleanupXRender();           // Cleanup XRender resources
    void UpdateWindow();             // Copy pixmap to window with alpha

    // Corner mask creation
    Picture CreateCornerMask(int radius);  // Create pre-computed corner mask
    void CleanupCornerMasks();             // Cleanup all corner masks

    // XRender helper conversions
    void SetXRenderColor(const XRenderColor *color);
    XRenderColor ConvertToXRenderColor(OSDColor color);
};

#endif // VLC_OS_LINUX_OSD_H
