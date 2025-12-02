#include "common.h"
#include <cstdint>
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <atomic>
#include <memory>
#include <chrono>
#include <thread>

class OSWindow;

class OSDWindow
{
  OSDType _type;
  int _x, _y, _width, _height;
  int _opacity; /* 0-100*/
  OSWindow *window = nullptr;

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
                       OSDColor bg_color)
  {
    DrawRoundedRect(x, y, width, height, bg_color, 4);
    if (progress > 0.0f)
    {
      int padding = 2;
      int filled_width = static_cast<int>(width * progress) - padding * 2;
      DrawRoundedRect(x + padding, y + padding, filled_width, height - padding * 2, fg_color, 4);
    }
  }

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
  virtual void ClearDrawable(void *drawable,
                             int x, int y, int width, int height,
                             OSDColor color) = 0;
  virtual void DrawText(const std::string &text,
                        int x, int y,
                        OSDColor color,
                        void *font_handle) = 0;
  void DrawIcon(const OSDIcon &icon,
                int x, int y,
                int size,
                OSDColor color)
  {

    if (icon == PLAY)
    {
      // Triangle pointing right
      Point points[3];
      points[0] = {x, y};
      points[1] = {x + size, y + size / 2};
      points[2] = {x, y + size};
      DrawPolygon(points, 3, color);
    }
    else if (icon == PAUSE)
    {
      // Two vertical bars
      int bar_width = size / 3;
      DrawRoundedRect(x, y, bar_width, size, color, 0);
      DrawRoundedRect(x + size - bar_width, y, size, size, color, 0);
    }
    else if (icon == STOP)
    {
      // Square
      DrawProgressBar(x, y, size, size, 1.0f, color, color);
    }
    else if (icon == VOLUME_UP || icon == VOLUME_DOWN)
    {
      // Speaker icon (simplified trapezoid)
      Point points[4];
      points[0] = {x, y + size / 3};
      points[1] = {x + size / 2, y};
      points[2] = {x + size / 2, y + size};
      points[3] = {x, y + 2 * size / 3};
      DrawPolygon(points, 4, color);

      // Add sound waves for volume_up
      if (icon == VOLUME_UP)
      {
        DrawArc(x + size / 2, y + size / 4, size / 2, size / 2, 0, 360.f * 64.f, color);
      }
    }
    else if (icon == VOLUME_MUTE)
    {
      // Speaker with X
      Point points[4];
      points[0] = {x, y + size / 3};
      points[1] = {x + size / 2, y};
      points[2] = {x + size / 2, y + size};
      points[3] = {x, y + 2 * size / 3};
      DrawPolygon(points, 4, color);

      // Draw X over it
      DrawLine(x + size / 2, y, x + size, y + size, color);
      DrawLine(x + size, y, x + size / 2, y + size, color);
    }
  }

public:
  OSDType GetType() const { return _type; }
  int x() const { return _x; }
  int y() const { return _y; }
  int width() const { return _width; }
  int height() const { return _height; }
  virtual bool isWindowCreated() const = 0;

  static std::string FormatTime(int64_t time_ms)
  {
    if (time_ms < 0)
      time_ms = 0;

    int64_t total_seconds = time_ms / 1000;
    int hours = total_seconds / 3600;
    int minutes = (total_seconds % 3600) / 60;
    int seconds = total_seconds % 60;

    char buffer[32]; // Increased buffer size to avoid warnings
    if (hours > 0)
    {
      snprintf(buffer, sizeof(buffer), "%02d:%02d:%02d", hours, minutes, seconds);
    }
    else
    {
      snprintf(buffer, sizeof(buffer), "%02d:%02d", minutes, seconds);
    }

    return std::string(buffer);
  }

  OSDPosition GetPosition() const
  {
    switch (_type)
    {
    case OSDType::VOLUME:
      return OSDPosition::TOP_LEFT;

    case OSDType::PLAYBACK:
    case OSDType::NOTIFICATION:
    case OSDType::AUDIO_TRACK:
    case OSDType::SUBTITLE_TRACK:
      return OSDPosition::TOP_RIGHT;

    case OSDType::SEEK:
      return OSDPosition::BOTTOM_CENTER;

    default:
      return OSDPosition::CENTER;
    }
  }
  std::string text;    // Primary text
  std::string subtext; // Secondary text (e.g., time display)
  float progress;      // 0.0-1.0 for progress bars
  OSDIcon icon;        // Icon identifier (play, pause, volume_up, etc.)

  // Lifecycle
  std::chrono::steady_clock::time_point created_at;
  std::chrono::steady_clock::time_point expire_at;
  bool fading_out;

  // window pointer
  void *window;
  void *drawable;
  int slot_index; // For multi-line notifications (0 = first line)

  // Statics
  static OSDColor background;

  void Create(int x, int y)
  {
    if (isWindowCreated())
      Move(x, y);
    else
    {
      CreateWindowInternal(x, y);
      SetOpacity(0.0f);
    }
  }

  void SetOpacity(int opacity)
  {
    opacity = std::clamp(opacity, 0, 100);
    if (_opacity != opacity)
    {
      _opacity = opacity;
      SetOpacityInternal(opacity / 100.0f);
    }
  }

  void Move(int x, int y)
  {
    if (_x != x || _y != y)
    {
      MoveInternal(x, y);
      _x = x;
      _y = y;
    }
  }

  void SetSize(int width, int height)
  {
    if (_width != width || _height != height)
    {
      SetSizeInternal(width, height);
      _width = width;
      _height = height;
    }
  }

  virtual void Flush() = 0;

  OSDWindow()
      : position(OSDPosition::CENTER),
        progress(0.0f), _opacity(-1), fading_out(false),
        window(nullptr), drawable(nullptr),
        _width(0), _height(0), slot_index(0)
  {
    SetType(OSDType::NOTIFICATION);
  }

  void SetType(OSDType type)
  {
    _type = type;
    switch (type)
    {
    case OSDType::VOLUME:
      _width = 220;
      _height = 70;
      break;

    case OSDType::PLAYBACK:
    case OSDType::NOTIFICATION:
    case OSDType::AUDIO_TRACK:
    case OSDType::SUBTITLE_TRACK:
      _width = 160;
      _height = 50;
      break;

    case OSDType::SEEK:
      _width = 600;
      _height = 80;
      break;

    default:
      _width = 200;
      _height = 60;
      break;
    }
  }

  void Render(WindowBounds bounds)
  {

    int x = 0, y = 0;
    switch (position)
    {
    case OSDPosition::TOP_LEFT:
      x = bounds.x + 20;
      y = bounds.y + 20;
      break;

    case OSDPosition::TOP_RIGHT:
      x = bounds.x + bounds.width - _width - 20;
      y = bounds.y + 20 + (slot_index * 60); // Stack vertically
      break;

    case OSDPosition::BOTTOM_CENTER:
      x = bounds.x + bounds.width / 2 - _width / 2;
      y = bounds.y + bounds.height - _height - 20;
      break;

    case OSDPosition::CENTER:
      x = bounds.x + bounds.width / 2 - _width / 2;
      y = bounds.y + bounds.height / 2 - _height / 2;
      break;
    }

    if (isWindowCreated())
      Move(x, y);
    else
    {
      CreateWindowInternal(x, y);
      SetOpacity(0.0f);
    }

    ClearDrawable(0, 0, _width, _height, background);

    Flush();
    switch (GetType())
    {
    case OSDType::VOLUME:
      RenderVolume();
      break;

    case OSDType::PLAYBACK:
    case OSDType::NOTIFICATION:
    case OSDType::AUDIO_TRACK:
    case OSDType::SUBTITLE_TRACK:
      RenderPlayback();
      break;

    case OSDType::SEEK:
      RenderSeek();
      break;

    default:
      break;
    }
    SetOpacity(_opacity);
  }

  void RenderVolume()
  {
    // Draw icon (left side, 15px from edge)
    OSDIcon icon = (progress == 0.0f) ? VOLUME_MUTE : VOLUME_UP;
    DrawIcon(icon, 15, 10, 24, text_primary);

    // Draw text (next to icon)
    // NOTE: Needs font handle - platform specific, may need GetOSDFont() method
    DrawText(text, 50, 25, text_primary, nullptr);

    // Draw progress bar (below text)
    DrawProgressBar(15, 45, 190, 16, progress,
                    progress_fg, progress_bg);
  }

  void RenderPlayback()
  {
    if (icon != STOP) // Assuming STOP is default/none
    {
      DrawIcon(icon, 15, 15, 20, text_primary);
    }

    // Draw text (centered vertically)
    int text_x = (icon != STOP) ? 45 : 15;
    DrawText(text, text_x, 30, text_primary, nullptr);
  }

  void RenderSeek()
  {
    if (!subtext.empty())
    {
      // NOTE: Text width calculation is platform-specific
      // For now, estimate center position (platform can override if needed)
      // NOTE: May need GetTextWidth() - NOT YET IN HEADER
      int text_x = (_width - static_cast<int>(subtext.length() * 8)) / 2;
      DrawText(subtext, text_x, 30, text_primary, nullptr);
    }

    // Draw progress bar (below time, full width with margins)
    DrawProgressBar(10, 50, 580, 24, progress,
                    progress_fg, progress_bg);

    // Draw position marker (circle on bar)
    if (progress > 0.0f && progress < 1.0f)
    {
      int marker_x = 10 + static_cast<int>(580 * progress);
      DrawCircle(marker_x - 6, 50 + 12 - 6, 12, text_primary);
    }
  }
};
