#ifndef VLC_OS_WIN32_OSD_H
#define VLC_OS_WIN32_OSD_H

#include "../vlc_os_osd.h"
#include <windows.h>
#include <gdiplus.h>

#pragma comment(lib, "gdiplus.lib")

// =================================================================================================
// Win32 OSD Window - Layered transparent overlay window
// =================================================================================================

class Win32OSDWindow : public OSDWindow
{
public:
    Win32OSDWindow(OSWindow *parent);
    ~Win32OSDWindow() override;

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

    // Drawing primitives
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
    HWND hwnd_;                          // Layered window handle
    HDC mem_dc_;                         // Memory device context
    HBITMAP mem_bitmap_;                 // Offscreen bitmap
    HBITMAP old_bitmap_;                 // Original bitmap (for cleanup)
    Gdiplus::Graphics *graphics_;        // GDI+ graphics context
    void *bitmap_bits_;                  // Bitmap pixel data pointer
    float current_opacity_;              // Current opacity (0.0-1.0)

    // Helper methods
    void InitializeGraphics();
    void CleanupGraphics();
    void UpdateLayeredWindow();          // Apply alpha-blended rendering

    // GDI+ helper conversions
    Gdiplus::Color* GetGdiplusColor(OSDColor color);
    Gdiplus::Font* GetGdiplusFont(OSDFont font);
};

#endif // VLC_OS_WIN32_OSD_H
