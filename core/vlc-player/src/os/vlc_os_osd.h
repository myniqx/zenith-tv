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

class OSDWindow
{
  OSDType _type;
  int _x, _y, _width, _height;
  int _opacity; /* 0-100*/

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

  void DrawRoundedRect(int x, int y,
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
  void DrawIcon(const OSDIcon &icon,
                int x, int y,
                int size,
                OSDColor color) = 0;
  virtual void DrawCircle(int x, int y,
                          int radius,
                          OSDColor color) = 0;
  virtual void ClearDrawable(void *drawable,
                             int x, int y, int width, int height,
                             OSDColor color) = 0;

public:
  OSDType GetType() const { return type; }
  int x() const { return _x; }
  int y() const { return _y; }
  int width() const { return _width; }
  int height() const { return _height; }
  virtual bool isWindowCreated() const = 0;

  OSDPosition position;
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
        progress(0.0f), opacity(0.0f), fading_out(false),
        window(nullptr), drawable(nullptr),
        width(0), height(0), slot_index(0)
  {
    SetType(OSDType::NOTIFICATION);
  }

  void SetType(OSDType type)
  {
    _type = type;
    switch (type)
    {
    case OSDType::VOLUME:
      width = 220;
      height = 70;
      break;

    case OSDType::PLAYBACK:
    case OSDType::NOTIFICATION:
    case OSDType::AUDIO_TRACK:
    case OSDType::SUBTITLE_TRACK:
      width = 160;
      height = 50;
      break;

    case OSDType::SEEK:
      width = 600;
      height = 80;
      break;

    default:
      width = 200;
      height = 60;
      break;
    }
  }
};

typedef void *OSDColor;
