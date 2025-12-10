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
    XRaiseWindow(display_, window_); // Ensure it's on top
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
    // REMOVED: We handle opacity manually in ConvertToXRenderColor by scaling the alpha channel.
    // Setting _NET_WM_WINDOW_OPACITY causes double-fading and can cause the window to disappear
    // at 100% opacity on some compositors (likely due to interaction with ARGB visual).
    
    /*
    Atom atom = XInternAtom(display_, "_NET_WM_WINDOW_OPACITY", False);
    unsigned long opacity_value = static_cast<unsigned long>(opacity * 0xFFFFFFFF);
    XChangeProperty(display_, window_, atom, XA_CARDINAL, 32, PropModeReplace,
                    reinterpret_cast<unsigned char *>(&opacity_value), 1);
    */

    XFlush(display_);
}

// =================================================================================================
// Buffer Flush
// =================================================================================================

void LinuxOSDWindow::Flush()
{
    if (!display_ || !window_)
    {
        return;
    }

    if (!pixmap_picture_ || !window_picture_)
    {
        XFlush(display_);
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
    
    // Ensure window stays on top (some WMs might lower override_redirect windows)
    XRaiseWindow(display_, window_);
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
    
    // Apply opacity to Alpha
    render_color.alpha = static_cast<unsigned short>(
        xft_color->color.alpha * current_opacity_
    );

    // Apply opacity to RGB (Premultiplied Alpha)
    // XRender expects R, G, B <= Alpha
    render_color.red = static_cast<unsigned short>(
        xft_color->color.red * current_opacity_
    );
    render_color.green = static_cast<unsigned short>(
        xft_color->color.green * current_opacity_
    );
    render_color.blue = static_cast<unsigned short>(
        xft_color->color.blue * current_opacity_
    );

    return render_color;
}

void LinuxOSDWindow::SetXRenderColor(const XRenderColor *color)
{
    if (!display_ || !gc_ || !color)
    {
        return;
    }

    // Convert XRenderColor to X11 pixel value (approximate)
    // For ARGB32, we need to include alpha. Assuming standard layout (A R G B)
    unsigned long pixel = ((color->alpha >> 8) << 24) |
                          ((color->red >> 8) << 16) |
                          ((color->green >> 8) << 8) |
                          (color->blue >> 8);

    XSetForeground(display_, gc_, pixel);
}
