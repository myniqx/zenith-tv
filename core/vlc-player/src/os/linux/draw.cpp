#include "osd.h"
#include "../../vlc_player.h"

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
    if (!display_ || !xft_draw_)
    {
        return;
    }

    if (!font)
    {
        VlcPlayer::Log("DrawText: Font is NULL!");
        return;
    }

    if (text.empty())
    {
        return;
    }

    XftColor *xft_color = static_cast<XftColor *>(color);
    XftFont *xft_font = static_cast<XftFont *>(font);

    // Apply current opacity to text color (Premultiplied Alpha)
    XftColor modified_color = *xft_color;
    modified_color.color.alpha = static_cast<unsigned short>(
        xft_color->color.alpha * current_opacity_
    );
    modified_color.color.red = static_cast<unsigned short>(
        xft_color->color.red * current_opacity_
    );
    modified_color.color.green = static_cast<unsigned short>(
        xft_color->color.green * current_opacity_
    );
    modified_color.color.blue = static_cast<unsigned short>(
        xft_color->color.blue * current_opacity_
    );

    // XftDrawStringUtf8 uses baseline coordinates, but we are passed top-left.
    // Add ascent to y to correct this.
    XftDrawStringUtf8(xft_draw_, &modified_color, xft_font, x, y + xft_font->ascent,
                      reinterpret_cast<const XftChar8 *>(text.c_str()),
                      static_cast<int>(text.length()));
}
