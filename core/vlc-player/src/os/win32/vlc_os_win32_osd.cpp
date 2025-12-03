#include "vlc_os_win32_osd.h"
#include "../vlc_os_window.h"
#include <algorithm>

// Win32 window class name for OSD windows
static const wchar_t* OSD_WINDOW_CLASS = L"VLC_OSD_Window";
static bool g_window_class_registered = false;

// =================================================================================================
// Window Procedure for OSD windows (minimal, no input handling)
// =================================================================================================

static LRESULT CALLBACK OSDWindowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
    switch (msg)
    {
    case WM_CREATE:
        return 0;
    case WM_CLOSE:
        return 0; // Don't allow user to close OSD windows
    case WM_DESTROY:
        return 0;
    default:
        return DefWindowProcW(hwnd, msg, wParam, lParam);
    }
}

// =================================================================================================
// Constructor & Destructor
// =================================================================================================

Win32OSDWindow::Win32OSDWindow(OSWindow *parent)
    : OSDWindow(parent),
      hwnd_(nullptr),
      mem_dc_(nullptr),
      mem_bitmap_(nullptr),
      old_bitmap_(nullptr),
      graphics_(nullptr),
      bitmap_bits_(nullptr),
      current_opacity_(0.0f)
{
    // Register window class once
    if (!g_window_class_registered)
    {
        WNDCLASSEXW wc = {};
        wc.cbSize = sizeof(WNDCLASSEXW);
        wc.lpfnWndProc = OSDWindowProc;
        wc.hInstance = GetModuleHandleW(NULL);
        wc.lpszClassName = OSD_WINDOW_CLASS;
        wc.hCursor = LoadCursor(NULL, IDC_ARROW);

        if (RegisterClassExW(&wc))
        {
            g_window_class_registered = true;
        }
    }
}

Win32OSDWindow::~Win32OSDWindow()
{
    DestroyWindowInternal();
}

// =================================================================================================
// Window State Query
// =================================================================================================

bool Win32OSDWindow::isWindowCreated() const
{
    return hwnd_ != nullptr && IsWindow(hwnd_);
}

// =================================================================================================
// Window Lifecycle
// =================================================================================================

void Win32OSDWindow::CreateWindowInternal(int x, int y)
{
    if (isWindowCreated())
        return;

    // Create layered window (transparent, topmost, no input)
    hwnd_ = CreateWindowExW(
        WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
        OSD_WINDOW_CLASS,
        L"VLC OSD",
        WS_POPUP,
        x, y, width(), height(),
        NULL, NULL, GetModuleHandleW(NULL), NULL);

    if (!hwnd_)
        return;

    InitializeGraphics();
}

void Win32OSDWindow::DestroyWindowInternal()
{
    CleanupGraphics();

    if (hwnd_)
    {
        DestroyWindow(hwnd_);
        hwnd_ = nullptr;
    }
}

void Win32OSDWindow::MoveInternal(int x, int y)
{
    if (!isWindowCreated())
        return;

    SetWindowPos(hwnd_, HWND_TOPMOST, x, y, 0, 0,
                 SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
}

void Win32OSDWindow::SetSizeInternal(int width, int height)
{
    if (!isWindowCreated())
        return;

    // Recreate graphics context with new size
    CleanupGraphics();
    SetWindowPos(hwnd_, NULL, 0, 0, width, height,
                 SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE);
    InitializeGraphics();
}

void Win32OSDWindow::SetOpacityInternal(float opacity)
{
    current_opacity_ = std::clamp(opacity, 0.0f, 1.0f);

    if (!isWindowCreated())
        return;

    // Opacity applied via UpdateLayeredWindow in Flush()
    if (opacity <= 0.0f)
    {
        ShowWindow(hwnd_, SW_HIDE);
    }
    else
    {
        ShowWindow(hwnd_, SW_SHOWNOACTIVATE);
    }
}

// =================================================================================================
// Graphics Initialization
// =================================================================================================

void Win32OSDWindow::InitializeGraphics()
{
    if (!isWindowCreated())
        return;

    HDC screen_dc = GetDC(NULL);
    mem_dc_ = CreateCompatibleDC(screen_dc);

    // Create DIB section for alpha channel support
    BITMAPINFO bmi = {};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = width();
    bmi.bmiHeader.biHeight = -height(); // Top-down DIB
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32; // ARGB
    bmi.bmiHeader.biCompression = BI_RGB;

    mem_bitmap_ = CreateDIBSection(mem_dc_, &bmi, DIB_RGB_COLORS,
                                   &bitmap_bits_, NULL, 0);
    old_bitmap_ = (HBITMAP)SelectObject(mem_dc_, mem_bitmap_);

    // Create GDI+ graphics context
    graphics_ = new Gdiplus::Graphics(mem_dc_);
    graphics_->SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
    graphics_->SetTextRenderingHint(Gdiplus::TextRenderingHintAntiAlias);

    ReleaseDC(NULL, screen_dc);
}

void Win32OSDWindow::CleanupGraphics()
{
    if (graphics_)
    {
        delete graphics_;
        graphics_ = nullptr;
    }

    if (mem_dc_)
    {
        if (old_bitmap_)
        {
            SelectObject(mem_dc_, old_bitmap_);
            old_bitmap_ = nullptr;
        }
        DeleteDC(mem_dc_);
        mem_dc_ = nullptr;
    }

    if (mem_bitmap_)
    {
        DeleteObject(mem_bitmap_);
        mem_bitmap_ = nullptr;
        bitmap_bits_ = nullptr;
    }
}

// =================================================================================================
// Buffer Flush (Apply to layered window)
// =================================================================================================

void Win32OSDWindow::Flush()
{
    UpdateLayeredWindow();
}

void Win32OSDWindow::UpdateLayeredWindow()
{
    if (!isWindowCreated() || !mem_dc_)
        return;

    HDC screen_dc = GetDC(NULL);
    POINT pt_src = {0, 0};
    POINT pt_dst = {x(), y()};
    SIZE size = {width(), height()};

    BLENDFUNCTION blend = {};
    blend.BlendOp = AC_SRC_OVER;
    blend.BlendFlags = 0;
    blend.SourceConstantAlpha = (BYTE)(current_opacity_ * 255);
    blend.AlphaFormat = AC_SRC_ALPHA; // Use per-pixel alpha

    ::UpdateLayeredWindow(hwnd_, screen_dc, &pt_dst, &size,
                         mem_dc_, &pt_src, 0, &blend, ULW_ALPHA);

    ReleaseDC(NULL, screen_dc);
}

// =================================================================================================
// Drawing Primitives
// =================================================================================================

void Win32OSDWindow::ClearDrawable(int x, int y, int width, int height, OSDColor color)
{
    if (!graphics_)
        return;

    Gdiplus::Color* gdi_color = GetGdiplusColor(color);
    Gdiplus::SolidBrush brush(*gdi_color);
    graphics_->FillRectangle(&brush, x, y, width, height);
}

void Win32OSDWindow::DrawRoundedRect(int x, int y, int width, int height,
                                     OSDColor color, int radius)
{
    if (!graphics_)
        return;

    Gdiplus::Color* gdi_color = GetGdiplusColor(color);
    Gdiplus::SolidBrush brush(*gdi_color);

    if (radius <= 0)
    {
        graphics_->FillRectangle(&brush, x, y, width, height);
        return;
    }

    // Create rounded rectangle path
    Gdiplus::GraphicsPath path;
    int diameter = radius * 2;

    path.AddArc(x, y, diameter, diameter, 180, 90); // Top-left
    path.AddArc(x + width - diameter, y, diameter, diameter, 270, 90); // Top-right
    path.AddArc(x + width - diameter, y + height - diameter, diameter, diameter, 0, 90); // Bottom-right
    path.AddArc(x, y + height - diameter, diameter, diameter, 90, 90); // Bottom-left
    path.CloseFigure();

    graphics_->FillPath(&brush, &path);
}

void Win32OSDWindow::DrawPolygon(Point *points, int pointSize, OSDColor color)
{
    if (!graphics_ || pointSize < 3)
        return;

    Gdiplus::Color* gdi_color = GetGdiplusColor(color);
    Gdiplus::SolidBrush brush(*gdi_color);

    Gdiplus::Point* gdi_points = new Gdiplus::Point[pointSize];
    for (int i = 0; i < pointSize; ++i)
    {
        gdi_points[i].X = points[i].x;
        gdi_points[i].Y = points[i].y;
    }

    graphics_->FillPolygon(&brush, gdi_points, pointSize);
    delete[] gdi_points;
}

void Win32OSDWindow::DrawArc(int x, int y, int width, int height,
                             int startAngle, int endAngle, OSDColor color)
{
    if (!graphics_)
        return;

    Gdiplus::Color* gdi_color = GetGdiplusColor(color);
    Gdiplus::Pen pen(*gdi_color, 2.0f);

    // GDI+ uses degrees, VLC uses degrees * 64
    float start = startAngle / 64.0f;
    float sweep = (endAngle - startAngle) / 64.0f;

    graphics_->DrawArc(&pen, x, y, width, height, start, sweep);
}

void Win32OSDWindow::DrawLine(int x1, int y1, int x2, int y2, OSDColor color)
{
    if (!graphics_)
        return;

    Gdiplus::Color* gdi_color = GetGdiplusColor(color);
    Gdiplus::Pen pen(*gdi_color, 2.0f);

    graphics_->DrawLine(&pen, x1, y1, x2, y2);
}

void Win32OSDWindow::DrawCircle(int x, int y, int radius, OSDColor color)
{
    if (!graphics_)
        return;

    Gdiplus::Color* gdi_color = GetGdiplusColor(color);
    Gdiplus::SolidBrush brush(*gdi_color);

    graphics_->FillEllipse(&brush, x - radius, y - radius, radius * 2, radius * 2);
}

void Win32OSDWindow::DrawText(const std::string &text, int x, int y,
                              OSDColor color, OSDFont font)
{
    if (!graphics_ || text.empty())
        return;

    Gdiplus::Color* gdi_color = GetGdiplusColor(color);
    Gdiplus::SolidBrush brush(*gdi_color);

    // Convert UTF-8 to wide string
    int wlen = MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, NULL, 0);
    wchar_t* wtext = new wchar_t[wlen];
    MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, wtext, wlen);

    Gdiplus::Font* gdi_font = GetGdiplusFont(font);
    Gdiplus::PointF point((Gdiplus::REAL)x, (Gdiplus::REAL)y);

    graphics_->DrawString(wtext, -1, gdi_font, point, &brush);

    delete[] wtext;
}

// =================================================================================================
// Helper Conversions
// =================================================================================================

Gdiplus::Color* Win32OSDWindow::GetGdiplusColor(OSDColor color)
{
    // OSDColor is void* pointing to Gdiplus::Color*
    return static_cast<Gdiplus::Color*>(color);
}

Gdiplus::Font* Win32OSDWindow::GetGdiplusFont(OSDFont font)
{
    // OSDFont is void* pointing to Gdiplus::Font*
    if (!font)
    {
        // Fallback to default font
        static Gdiplus::Font default_font(L"Segoe UI", 12);
        return &default_font;
    }
    return static_cast<Gdiplus::Font*>(font);
}
