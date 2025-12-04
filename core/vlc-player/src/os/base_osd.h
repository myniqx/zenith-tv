#ifndef VLC_OS_BASE_OSD_H
#define VLC_OS_BASE_OSD_H

#include "common.h"

class OSWindow;

class OSDWindow
{
  OSDType _type;
  int _x, _y, _width, _height;
  int _opacity; /* 0-100*/
  OSWindow *window = nullptr;
  float _offsetY = 0;
  std::string text;    // Primary text
  std::string subtext; // Secondary text (e.g., time display)
  float progress;      // 0.0-1.0 for progress bars
  OSDIcon icon;
  int duration;

  // Lifecycle
  std::chrono::steady_clock::time_point created_at;
  std::chrono::steady_clock::time_point expire_at;

protected:
  virtual void MoveInternal(int x, int y) = 0;
  virtual void SetSizeInternal(int width, int height) = 0;
  virtual void CreateWindowInternal(int x, int y) = 0;
  virtual void DestroyWindowInternal() = 0;
  virtual void SetOpacityInternal(float opacity) = 0;

  void DrawProgressBar(int x, int y,
                       int width, int height,
                       float progress,
                       OSDColor fg_color,
                       OSDColor bg_color);

  virtual void DrawRoundedRect(int x, int y,
                               int width, int height,
                               OSDColor color,
                               int radius) = 0;
  virtual void DrawPolygon(Point *points,
                           int pointSize,
                           OSDColor color) = 0;
  virtual void DrawArc(int x, int y, int width, int height,
                       int startAngle, int endAngle,
                       OSDColor color) = 0;
  virtual void DrawLine(int x1, int y1,
                        int x2, int y2,
                        OSDColor color) = 0;
  virtual void DrawCircle(int x, int y,
                          int radius,
                          OSDColor color) = 0;
  virtual void ClearDrawable(int x, int y, int width, int height,
                             OSDColor color) = 0;
  virtual void DrawText(const std::string &text,
                        int x, int y,
                        OSDColor color,
                        OSDFont font) = 0;
  void DrawIcon(const OSDIcon &icon,
                int x, int y,
                int size,
                OSDColor color);

public:
  OSDType GetType() const { return _type; }
  int x() const { return _x; }
  int y() const { return _y; }
  int width() const { return _width; }
  int height() const { return _height; }
  virtual bool isWindowCreated() const = 0;

  void Destroy() { DestroyWindowInternal(); }

  void Hide();

  int GetHeight() const
  {
    // dont return height for volume or seek
    if (_type == OSDType::SEEK || _type == OSDType::VOLUME)
      return 0;

    // dont return height if opacity is 0 (its hidden)
    if (_opacity <= 0)
      return 0;

    auto padding = 4;
    return _height + padding;
  }

  /**
   * Check if this OSD is currently visible to the user
   * @param now Current time point (for checking expiration)
   * @return true if OSD is visible (not expired and has opacity > 0)
   */
  bool IsCurrentlyVisible(std::chrono::steady_clock::time_point now) const;

  std::string FormatTime(int64_t time_ms) const;

  void SetCreatedAt(std::chrono::steady_clock::time_point time);

  void SetData(const std::string &text, const std::string &subtext, float progress = 0, OSDIcon icon = OSDIcon::NONE);

  void Create(int x, int y);

  void SetOpacity(int opacity);

  void Move(int x, int y);

  void SetSize(int width, int height);

  virtual void Flush() = 0;

  OSDWindow(OSWindow *window);

  virtual ~OSDWindow() = default;

  void SetType(OSDType type);

  void Update(WindowBounds bounds, int offsetY, float time);

  void Render();

  void RenderVolume();

  void RenderPlayback();

  void RenderSeek();
};

#endif // VLC_OS_BASE_OSD_H
