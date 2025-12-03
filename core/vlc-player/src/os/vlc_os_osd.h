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
                OSDColor color);

public:
  OSDType GetType() const { return _type; }
  int x() const { return _x; }
  int y() const { return _y; }
  int width() const { return _width; }
  int height() const { return _height; }
  virtual bool isWindowCreated() const = 0;

  static std::string FormatTime(int64_t time_ms);

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

  void Create(int x, int y);

  void SetOpacity(int opacity);

  void Move(int x, int y);

  void SetSize(int width, int height);

  virtual void Flush() = 0;

  OSDWindow();

  void SetType(OSDType type);

  void Render(WindowBounds bounds);

  void RenderVolume();

  void RenderPlayback();

  void RenderSeek();
};
