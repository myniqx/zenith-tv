#include "osd.h"
#include "window.h"
#include "../../vlc_player.h"
#include <X11/Xatom.h>
#include <X11/extensions/Xcomposite.h>
#include <cstring>
#include <cmath>

// Undefine X11 macros that conflict with our code
#undef None
#undef Status

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// =================================================================================================
// Constructor & Destructor
// =================================================================================================

LinuxOSDWindow::LinuxOSDWindow(OSWindow *parent)
    : OSDWindow(parent),
      display_(nullptr),
      window_(0),
      screen_(0),
      visual_(nullptr),
      colormap_(0),
      pixmap_(0),
      pixmap_picture_(0),
      window_picture_(0),
      gc_(nullptr),
      xft_draw_(nullptr),
      has_composite_(false),
      current_opacity_(1.0f)
{
}

LinuxOSDWindow::~LinuxOSDWindow()
{
    DestroyWindowInternal();
}

// =================================================================================================
// Window State Query
// =================================================================================================

bool LinuxOSDWindow::isWindowCreated() const
{
    return window_ != 0;
}

// =================================================================================================
// ARGB Visual Detection
// =================================================================================================

bool LinuxOSDWindow::FindARGBVisual()
{
    if (!display_)
    {
        return false;
    }

    // Find a visual with 32-bit depth (ARGB)
    XVisualInfo vinfo_template;
    vinfo_template.screen = screen_;
    vinfo_template.depth = 32;
    vinfo_template.c_class = TrueColor;

    int nitems;
    XVisualInfo *vinfo = XGetVisualInfo(
        display_,
        VisualScreenMask | VisualDepthMask | VisualClassMask,
        &vinfo_template,
        &nitems);

    if (vinfo && nitems > 0)
    {
        visual_ = vinfo[0].visual;
        XFree(vinfo);
        return true;
    }

    // Fallback to default visual (no alpha channel)
    visual_ = DefaultVisual(display_, screen_);
    return false;
}

// =================================================================================================
// XRender Initialization
// =================================================================================================

void LinuxOSDWindow::InitializeXRender()
{
    if (!display_ || !window_)
    {
        return;
    }

    // Check for XComposite extension
    int event_base, error_base;
    has_composite_ = XCompositeQueryExtension(display_, &event_base, &error_base);

    // Create pixmap for offscreen rendering
    pixmap_ = XCreatePixmap(display_, window_, width(), height(), 32);

    // Create XRender pictures
    XRenderPictFormat *format = XRenderFindStandardFormat(display_, PictStandardARGB32);
    if (format)
    {
        XRenderPictureAttributes pict_attr;
        pict_attr.graphics_exposures = False;

        pixmap_picture_ = XRenderCreatePicture(
            display_, pixmap_, format,
            CPGraphicsExposure, &pict_attr);

        window_picture_ = XRenderCreatePicture(
            display_, window_, format,
            CPGraphicsExposure, &pict_attr);
    }

    // Create Xft drawing context for pixmap
    xft_draw_ = XftDrawCreate(display_, pixmap_, visual_, colormap_);

    // Pre-compute corner masks for common radius values (2 and 4)
    corner_masks_[2] = CreateCornerMask(2);
    corner_masks_[4] = CreateCornerMask(4);

    VlcPlayer::Log("LinuxOSDWindow - Pre-computed corner masks (radius 2, 4)");
}

void LinuxOSDWindow::CleanupXRender()
{
    if (xft_draw_)
    {
        XftDrawDestroy(xft_draw_);
        xft_draw_ = nullptr;
    }

    if (pixmap_picture_)
    {
        XRenderFreePicture(display_, pixmap_picture_);
        pixmap_picture_ = 0;
    }

    if (window_picture_)
    {
        XRenderFreePicture(display_, window_picture_);
        window_picture_ = 0;
    }

    if (pixmap_)
    {
        XFreePixmap(display_, pixmap_);
        pixmap_ = 0;
    }

    if (gc_)
    {
        XFreeGC(display_, gc_);
        gc_ = nullptr;
    }

    // Cleanup corner masks
    CleanupCornerMasks();
}

void LinuxOSDWindow::CleanupCornerMasks()
{
    for (auto &pair : corner_masks_)
    {
        if (pair.second && display_)
        {
            XRenderFreePicture(display_, pair.second);
        }
    }
    corner_masks_.clear();
}

Picture LinuxOSDWindow::CreateCornerMask(int radius)
{
    if (!display_ || radius <= 0)
    {
        return 0;
    }

    // Create alpha-only pixmap for mask (8-bit depth)
    Pixmap mask_pixmap = XCreatePixmap(display_, RootWindow(display_, screen_),
                                       radius, radius, 8);
    if (!mask_pixmap)
    {
        return 0;
    }

    // Create Picture for alpha mask
    XRenderPictFormat *alpha_format = XRenderFindStandardFormat(display_, PictStandardA8);
    if (!alpha_format)
    {
        XFreePixmap(display_, mask_pixmap);
        return 0;
    }

    Picture mask_picture = XRenderCreatePicture(display_, mask_pixmap, alpha_format, 0, nullptr);
    if (!mask_picture)
    {
        XFreePixmap(display_, mask_pixmap);
        return 0;
    }

    // Clear mask to transparent
    XRenderColor transparent = {0, 0, 0, 0};
    XRenderFillRectangle(display_, PictOpSrc, mask_picture, &transparent, 0, 0, radius, radius);

    // Fill circle area with opaque (create rounded corner)
    XRenderColor opaque = {0, 0, 0, 0xFFFF}; // Full alpha
    for (int dy = 0; dy < radius; dy++)
    {
        for (int dx = 0; dx < radius; dx++)
        {
            int dist_sq = (dx - radius) * (dx - radius) + (dy - radius) * (dy - radius);
            if (dist_sq <= radius * radius)
            {
                XRenderFillRectangle(display_, PictOpOver, mask_picture, &opaque,
                                     dx, dy, 1, 1);
            }
        }
    }

    // Free pixmap (Picture holds reference)
    XFreePixmap(display_, mask_pixmap);

    return mask_picture;
}

// =================================================================================================
// Window Lifecycle
// =================================================================================================

void LinuxOSDWindow::CreateWindowInternal(int x, int y)
{
    LinuxWindow *linux_window = static_cast<LinuxWindow *>(window);
    if (!linux_window)
    {
        VlcPlayer::Log("ERROR: LinuxOSDWindow - Parent window is not LinuxWindow");
        return;
    }

    // Share display connection with parent window (efficient)
    display_ = linux_window->GetDisplay();
    if (!display_)
    {
        VlcPlayer::Log("ERROR: LinuxOSDWindow - Parent display is null");
        return;
    }

    screen_ = linux_window->GetScreen();
    ::Window root = RootWindow(display_, screen_);

    // Find ARGB visual
    bool has_alpha = FindARGBVisual();

    // Create colormap
    colormap_ = XCreateColormap(display_, root, visual_, AllocNone);

    // Create window attributes
    XSetWindowAttributes attrs;
    attrs.colormap = colormap_;
    attrs.background_pixel = 0; // Transparent
    attrs.border_pixel = 0;
    attrs.override_redirect = True; // No window manager decorations
    attrs.event_mask = 0;           // No events (OSD is output-only)

    unsigned long attr_mask = CWColormap | CWBackPixel | CWBorderPixel | CWOverrideRedirect | CWEventMask;

    // Create window
    window_ = XCreateWindow(
        display_, root,
        x, y, width(), height(),
        0, // No border
        has_alpha ? 32 : DefaultDepth(display_, screen_),
        InputOutput,
        visual_,
        attr_mask,
        &attrs);

    if (!window_)
    {
        VlcPlayer::Log("ERROR: LinuxOSDWindow - XCreateWindow failed");
        XCloseDisplay(display_);
        display_ = nullptr;
        return;
    }

    // Make window always on top
    Atom wmStateAbove = XInternAtom(display_, "_NET_WM_STATE_ABOVE", False);
    Atom wmState = XInternAtom(display_, "_NET_WM_STATE", False);
    XChangeProperty(display_, window_, wmState, XA_ATOM, 32, PropModeReplace,
                    reinterpret_cast<unsigned char *>(&wmStateAbove), 1);

    // Set window type to notification (hint for compositors)
    Atom wmWindowType = XInternAtom(display_, "_NET_WM_WINDOW_TYPE", False);
    Atom wmWindowTypeNotification = XInternAtom(display_, "_NET_WM_WINDOW_TYPE_NOTIFICATION", False);
    XChangeProperty(display_, window_, wmWindowType, XA_ATOM, 32, PropModeReplace,
                    reinterpret_cast<unsigned char *>(&wmWindowTypeNotification), 1);

    // Create GC
    gc_ = XCreateGC(display_, window_, 0, nullptr);

    // Initialize XRender
    InitializeXRender();

    // Map window
    XMapWindow(display_, window_);
    XFlush(display_);

    VlcPlayer::Log("LinuxOSDWindow created (Window ID: 0x%lx, ARGB: %s)", window_, has_alpha ? "yes" : "no");
}

void LinuxOSDWindow::DestroyWindowInternal()
{
    if (!display_)
    {
        return;
    }

    CleanupXRender();

    if (window_)
    {
        XDestroyWindow(display_, window_);
        window_ = 0;
    }

    if (colormap_)
    {
        XFreeColormap(display_, colormap_);
        colormap_ = 0;
    }

    // Note: Do NOT close display_ - it's shared with parent LinuxWindow
    display_ = nullptr;
}

void LinuxOSDWindow::MoveInternal(int x, int y)
{
    if (!display_ || !window_)
    {
        return;
    }

    XMoveWindow(display_, window_, x, y);
    XFlush(display_);
}

void LinuxOSDWindow::SetSizeInternal(int width, int height)
{
    if (!display_ || !window_)
    {
        return;
    }

    XResizeWindow(display_, window_, width, height);

    // Recreate offscreen buffer with new size
    CleanupXRender();
    InitializeXRender();

    XFlush(display_);
}

void LinuxOSDWindow::SetOpacityInternal(float opacity)
{
    if (!display_ || !window_)
    {
        return;
    }

    current_opacity_ = opacity;

    // Set window opacity property (for compositing window managers)
    Atom atom = XInternAtom(display_, "_NET_WM_WINDOW_OPACITY", False);
    unsigned long opacity_value = static_cast<unsigned long>(opacity * 0xFFFFFFFF);
    XChangeProperty(display_, window_, atom, XA_CARDINAL, 32, PropModeReplace,
                    reinterpret_cast<unsigned char *>(&opacity_value), 1);

    XFlush(display_);
}

// =================================================================================================
// Buffer Flush
// =================================================================================================

void LinuxOSDWindow::Flush()
{
    if (!display_ || !window_ || !pixmap_picture_ || !window_picture_)
    {
        return;
    }

    // Copy pixmap to window using XRender (preserves alpha channel)
    XRenderComposite(
        display_,
        PictOpSrc,
        pixmap_picture_,
        0, // No mask
        window_picture_,
        0, 0, // src x, y
        0, 0, // mask x, y
        0, 0, // dst x, y
        width(), height());

    XFlush(display_);
}

// =================================================================================================
// XRender Color Conversion
// =================================================================================================

XRenderColor LinuxOSDWindow::ConvertToXRenderColor(OSDColor color)
{
    if (!color)
    {
        return {0, 0, 0, 0};
    }

    XftColor *xft_color = static_cast<XftColor *>(color);
    XRenderColor render_color;
    render_color.red = xft_color->color.red;
    render_color.green = xft_color->color.green;
    render_color.blue = xft_color->color.blue;
    render_color.alpha = xft_color->color.alpha;
    return render_color;
}

void LinuxOSDWindow::SetXRenderColor(const XRenderColor *color)
{
    if (!display_ || !gc_ || !color)
    {
        return;
    }

    // Convert XRenderColor to X11 pixel value (approximate, no alpha)
    unsigned long pixel = ((color->red >> 8) << 16) |
                          ((color->green >> 8) << 8) |
                          (color->blue >> 8);

    XSetForeground(display_, gc_, pixel);
}

// =================================================================================================
// Drawing Primitives
// =================================================================================================

void LinuxOSDWindow::ClearDrawable(int x, int y, int width, int height, OSDColor color)
{
    if (!display_ || !pixmap_picture_)
    {
        return;
    }

    XRenderColor render_color = ConvertToXRenderColor(color);
    XRenderFillRectangle(display_, PictOpSrc, pixmap_picture_, &render_color,
                         x, y, width, height);
}

void LinuxOSDWindow::DrawRoundedRect(int x, int y, int width, int height, OSDColor color, int radius)
{
    if (!display_ || !pixmap_picture_)
    {
        return;
    }

    XRenderColor render_color = ConvertToXRenderColor(color);

    // If radius is 0 or negative, draw normal rectangle
    if (radius <= 0)
    {
        XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                             x, y, width, height);
        return;
    }

    // Try to find pre-computed mask for this radius
    Picture corner_mask = 0;
    auto it = corner_masks_.find(radius);
    if (it != corner_masks_.end())
    {
        corner_mask = it->second;
    }
    else
    {
        // Radius not cached, create on-the-fly (rare case)
        corner_mask = CreateCornerMask(radius);
        if (corner_mask)
        {
            corner_masks_[radius] = corner_mask;
            VlcPlayer::Log("LinuxOSDWindow - Created corner mask for radius %d (on-demand)", radius);
        }
    }

    // Draw main rectangle (center area + edges without corners)
    XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                         x + radius, y, width - 2 * radius, height);
    XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                         x, y + radius, radius, height - 2 * radius);
    XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                         x + width - radius, y + radius, radius, height - 2 * radius);

    if (corner_mask)
    {
        // Draw rounded corners using pre-computed mask (FAST!)
        // Create a solid color Picture for the fill
        XRenderPictFormat *format = XRenderFindStandardFormat(display_, PictStandardARGB32);
        Pixmap color_pixmap = XCreatePixmap(display_, window_, 1, 1, 32);
        Picture color_picture = XRenderCreatePicture(display_, color_pixmap, format, 0, nullptr);
        XRenderFillRectangle(display_, PictOpSrc, color_picture, &render_color, 0, 0, 1, 1);

        // Composite each corner with mask
        // Top-left
        XRenderComposite(display_, PictOpOver, color_picture, corner_mask, pixmap_picture_,
                         0, 0, 0, 0, x, y, radius, radius);
        // Top-right (flip horizontally)
        XTransform xform_h = {{{-XDoubleToFixed(1), 0, XDoubleToFixed(radius)},
                               {0, XDoubleToFixed(1), 0},
                               {0, 0, XDoubleToFixed(1)}}};
        XRenderSetPictureTransform(display_, corner_mask, &xform_h);
        XRenderComposite(display_, PictOpOver, color_picture, corner_mask, pixmap_picture_,
                         0, 0, 0, 0, x + width - radius, y, radius, radius);

        // Bottom-left (flip vertically)
        XTransform xform_v = {{{XDoubleToFixed(1), 0, 0},
                               {0, XDoubleToFixed(-1), XDoubleToFixed(radius)},
                               {0, 0, XDoubleToFixed(1)}}};
        XRenderSetPictureTransform(display_, corner_mask, &xform_v);
        XRenderComposite(display_, PictOpOver, color_picture, corner_mask, pixmap_picture_,
                         0, 0, 0, 0, x, y + height - radius, radius, radius);

        // Bottom-right (flip both)
        XTransform xform_hv = {{{XDoubleToFixed(-1), 0, XDoubleToFixed(radius)},
                                {0, XDoubleToFixed(-1), XDoubleToFixed(radius)},
                                {0, 0, XDoubleToFixed(1)}}};
        XRenderSetPictureTransform(display_, corner_mask, &xform_hv);
        XRenderComposite(display_, PictOpOver, color_picture, corner_mask, pixmap_picture_,
                         0, 0, 0, 0, x + width - radius, y + height - radius, radius, radius);

        // Reset transform
        XTransform identity = {{{XDoubleToFixed(1), 0, 0},
                                {0, XDoubleToFixed(1), 0},
                                {0, 0, XDoubleToFixed(1)}}};
        XRenderSetPictureTransform(display_, corner_mask, &identity);

        // Cleanup temporary Picture
        XRenderFreePicture(display_, color_picture);
        XFreePixmap(display_, color_pixmap);
    }
    else
    {
        // Fallback: No mask available, draw sharp corners (graceful degradation)
        XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                             x, y, radius, radius);
        XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                             x + width - radius, y, radius, radius);
        XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                             x, y + height - radius, radius, radius);
        XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                             x + width - radius, y + height - radius, radius, radius);
    }
}

void LinuxOSDWindow::DrawLine(int x1, int y1, int x2, int y2, OSDColor color)
{
    if (!display_ || !pixmap_ || !gc_)
    {
        return;
    }

    XRenderColor render_color = ConvertToXRenderColor(color);
    SetXRenderColor(&render_color);
    XDrawLine(display_, pixmap_, gc_, x1, y1, x2, y2);
}

void LinuxOSDWindow::DrawCircle(int x, int y, int radius, OSDColor color)
{
    if (!display_ || !pixmap_picture_)
    {
        return;
    }

    XRenderColor render_color = ConvertToXRenderColor(color);

    // Draw filled circle using pixel-by-pixel approach
    for (int dy = -radius; dy <= radius; dy++)
    {
        for (int dx = -radius; dx <= radius; dx++)
        {
            if (dx * dx + dy * dy <= radius * radius)
            {
                XRenderFillRectangle(display_, PictOpOver, pixmap_picture_, &render_color,
                                     x + dx, y + dy, 1, 1);
            }
        }
    }
}

void LinuxOSDWindow::DrawPolygon(Point *points, int pointSize, OSDColor color)
{
    if (!display_ || !pixmap_ || !gc_ || !points || pointSize < 3)
    {
        return;
    }

    XRenderColor render_color = ConvertToXRenderColor(color);
    SetXRenderColor(&render_color);

    XPoint *xpoints = new XPoint[pointSize];
    for (int i = 0; i < pointSize; i++)
    {
        xpoints[i].x = static_cast<short>(points[i].x);
        xpoints[i].y = static_cast<short>(points[i].y);
    }

    XFillPolygon(display_, pixmap_, gc_, xpoints, pointSize, Complex, CoordModeOrigin);

    delete[] xpoints;
}

void LinuxOSDWindow::DrawArc(int x, int y, int width, int height,
                             int startAngle, int endAngle, OSDColor color)
{
    if (!display_ || !pixmap_ || !gc_)
    {
        return;
    }

    XRenderColor render_color = ConvertToXRenderColor(color);
    SetXRenderColor(&render_color);

    // X11 angles are in 64ths of a degree
    int angle1 = startAngle * 64;
    int angle2 = (endAngle - startAngle) * 64;

    XFillArc(display_, pixmap_, gc_, x, y, width, height, angle1, angle2);
}

void LinuxOSDWindow::DrawText(const std::string &text, int x, int y, OSDColor color, OSDFont font)
{
    if (!display_ || !xft_draw_ || !font || text.empty())
    {
        return;
    }

    XftColor *xft_color = static_cast<XftColor *>(color);
    XftFont *xft_font = static_cast<XftFont *>(font);

    XftDrawStringUtf8(xft_draw_, xft_color, xft_font, x, y,
                      reinterpret_cast<const XftChar8 *>(text.c_str()),
                      static_cast<int>(text.length()));
}
