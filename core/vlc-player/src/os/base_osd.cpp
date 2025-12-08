#include "base_osd.h"
#include "window_base.h"
#include "../vlc_player.h"
#include <cstdint>
#include <string>
#include <vector>
#include <map>
#include <mutex>
#include <atomic>
#include <memory>
#include <chrono>
#include <thread>
#include <algorithm>

#ifdef DrawText
#undef DrawText
#endif

void OSDWindow::Hide()
{
  SetOpacity(0);
  expire_at = std::chrono::steady_clock::now();
}

void OSDWindow::SetCreatedAt(std::chrono::steady_clock::time_point time)
{
  created_at = time;
  expire_at = time + std::chrono::milliseconds(duration);
}

bool OSDWindow::IsCurrentlyVisible(std::chrono::steady_clock::time_point now) const
{
  // Check if expired
  if (expire_at <= now)
    return false;

  // Check if has visible opacity
  if (_opacity <= 0)
    return false;

  return true;
}

void OSDWindow::SetData(
    const std::string &text,
    const std::string &subtext,
    float progress,
    OSDIcon icon)
{
  this->progress = std::clamp(progress, 0.0f, 1.0f);
  this->icon = icon;

  // Type-specific text generation
  switch (_type)
  {
  case OSDType::VOLUME:
    // Generate percentage text from progress
    this->text = std::to_string((int)(this->progress * 100)) + "%";
    this->subtext = "";
    break;

  case OSDType::SEEK:
    // Seek uses subtext for time display
    this->text = "";
    this->subtext = subtext;
    break;

  case OSDType::PLAYBACK:
  case OSDType::NOTIFICATION:
    this->text = text;
    this->subtext = subtext;
    break;
  }

  // Measure and store text dimensions
  text_dim_ = window->MeasureText(window->defaultFont, this->text);
  if (!this->subtext.empty())
  {
    subtext_dim_ = window->MeasureText(window->boldFont, this->subtext);
  }
  else
  {
    subtext_dim_ = {0, 0};
  }

  // Dynamic sizing for notifications and playback
  if (_type == OSDType::NOTIFICATION || _type == OSDType::PLAYBACK)
  {
    int icon_width = (icon != NONE) ? (ICON_SIZE_SMALL + SPACING) : 0;
    int new_width = text_dim_.width + icon_width + PADDING * 2;
    int new_height = std::max(text_dim_.height + PADDING * 2, 50);

    if (_width != new_width || _height != new_height)
    {
      SetSize(new_width, new_height);
    }
  }
}

void OSDWindow::DrawProgressBar(int x, int y,
                                int width, int height,
                                float progress,
                                OSDColor fg_color,
                                OSDColor bg_color)
{
  if (progress > 0.0f)
  {
    int padding = 2;
    int filled_width = static_cast<int>(width * progress) - padding * 2;
    DrawRoundedRect(x + padding, y + padding, filled_width, height - padding * 2, fg_color, 4);
  }
}

void OSDWindow::DrawIcon(const OSDIcon &icon,
                         int x, int y,
                         int size,
                         OSDColor color)
{

  if (icon == PLAY)
  {
    Point points[3];
    points[0] = {x, y};
    points[1] = {x + size, y + size / 2};
    points[2] = {x, y + size};
    DrawPolygon(points, 3, color);
  }
  else if (icon == PAUSE)
  {
    int bar_width = size / 3;
    DrawRoundedRect(x, y, bar_width, size, color, 0);
    DrawRoundedRect(x + size - bar_width, y, bar_width, size, color, 0);
  }
  else if (icon == STOP)
  {
    DrawRoundedRect(x, y, size, size, color, 2);
  }
  else if (icon == VOLUME_UP || icon == VOLUME_DOWN)
  {
    Point points[4];
    points[0] = {x, y + size / 3};
    points[1] = {x + size / 2, y};
    points[2] = {x + size / 2, y + size};
    points[3] = {x, y + 2 * size / 3};
    DrawPolygon(points, 4, color);

    if (icon == VOLUME_UP)
    {
      DrawArc(x + size / 2, y + size / 4, size / 2, size / 2, 0, 360.f * 64.f, color);
    }
  }
  else if (icon == VOLUME_MUTE)
  {
    Point points[4];
    points[0] = {x, y + size / 3};
    points[1] = {x + size / 2, y};
    points[2] = {x + size / 2, y + size};
    points[3] = {x, y + 2 * size / 3};
    DrawPolygon(points, 4, color);

    DrawLine(x + size / 2, y, x + size, y + size, color);
    DrawLine(x + size, y, x + size / 2, y + size, color);
  }
}

std::string OSDWindow::FormatTime(int64_t time_ms) const
{
  if (time_ms < 0)
    time_ms = 0;

  int64_t total_seconds = time_ms / 1000;
  int hours = total_seconds / 3600;
  int minutes = (total_seconds % 3600) / 60;
  int seconds = total_seconds % 60;

  char buffer[32];
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

void OSDWindow::Create(int x, int y)
{
  if (isWindowCreated())
    Move(x, y);
  else
  {
    CreateWindowInternal(x, y);
    SetOpacity(0.0f);
  }
}

void OSDWindow::SetOpacity(int opacity)
{
  opacity = std::clamp(opacity, 0, 100);
  if (_opacity != opacity)
  {
    _opacity = opacity;
    SetOpacityInternal(opacity / 100.0f);
  }
}

void OSDWindow::Move(int x, int y)
{
  if (_x != x || _y != y)
  {
    MoveInternal(x, y);
    _x = x;
    _y = y;
  }
}

void OSDWindow::SetSize(int width, int height)
{
  if (_width != width || _height != height)
  {
    SetSizeInternal(width, height);
    _width = width;
    _height = height;
  }
}

OSDWindow::OSDWindow(OSWindow *window)
    : progress(0.0f), _opacity(-1),
      window(window),
      _width(0), _height(0), duration(2000)
{
  SetType(OSDType::NOTIFICATION);
}

void OSDWindow::SetType(OSDType type)
{
  _type = type;
  switch (type)
  {
  case OSDType::VOLUME:
    _width = 220;
    _height = 70;
    duration = 2000;
    break;

  case OSDType::PLAYBACK:
    auto dimension = window->MeasureText(window->defaultFont, "Pause");
    _width = dimension.width + 30;
    _height = dimension.height + 20;
    duration = 2000;
    break;

  case OSDType::SEEK:
    _width = 600;
    _height = 80;
    duration = 4000;
    break;

  default:
    duration = 2000;
    // this will be dynamic
    _width = 200;
    _height = 60;
    break;
  }
}

void OSDWindow::Update(WindowBounds bounds, int offsetY, float time)
{
  auto now = std::chrono::steady_clock::now();
  const float fade_duration = 200.0f; // 200ms fade in/out

  // Calculate elapsed time since creation
  auto elapsed = std::chrono::duration<float, std::milli>(
                     now - created_at)
                     .count();

  // Calculate total duration for this OSD
  auto total_duration = std::chrono::duration<float, std::milli>(
                            expire_at - created_at)
                            .count();

  // Calculate time remaining until expiration
  auto time_remaining = std::chrono::duration<float, std::milli>(
                            expire_at - now)
                            .count();

  // State machine for opacity
  if (elapsed < fade_duration)
  {
    // Phase 1: Fade in (0-200ms)
    auto opacity = elapsed / fade_duration;
    SetOpacity((int)(opacity * 100.0f));
  }
  else if (elapsed >= fade_duration && time_remaining > fade_duration)
  {
    // Phase 2: Fully visible (200ms - (total-200ms))
    SetOpacity(100);
  }
  else if (time_remaining > 0.0f && time_remaining <= fade_duration)
  {
    // Phase 3: Fade out (last 200ms)
    auto opacity = time_remaining / fade_duration;
    SetOpacity((int)(opacity * 100.0f));
  }
  else
  {
    SetOpacity(0);
    _offsetY = 0;
    return;
  }

  int x = 0, y = 0;
  switch (_type)
  {
  case OSDType::VOLUME:
    x = bounds.x + 20;
    y = bounds.y + 20;
    break;

  default:
  case OSDType::NOTIFICATION:
    x = bounds.x + bounds.width - _width - 20;
    if (_offsetY <= offsetY)
    {
      _offsetY = offsetY;
    }
    else
    {
      _offsetY -= (_offsetY - offsetY) * time;
    }
    y = bounds.y + 20 + _offsetY;
    break;

  case OSDType::SEEK:
    x = bounds.x + bounds.width / 2 - _width / 2;
    y = bounds.y + bounds.height - _height - 20;
    break;
  }

  if (isWindowCreated())
    Move(x, y);
  else
  {
    CreateWindowInternal(x, y);
    SetOpacity(0.0f);
  }
}

void OSDWindow::Render()
{
  if (_opacity <= 0)
    return;

  ClearDrawable(0, 0, _width, _height, window->background);

  switch (GetType())
  {
  case OSDType::VOLUME:
    RenderVolume();
    break;

  case OSDType::PLAYBACK:
  case OSDType::NOTIFICATION:
    RenderPlayback();
    break;

  case OSDType::SEEK:
    RenderSeek();
    break;

  default:
    break;
  }

  Flush();
}

void OSDWindow::RenderVolume()
{
  int content_height = ICON_SIZE_LARGE + SPACING + PROGRESS_BAR_HEIGHT_THICK;
  int start_y = (_height - content_height) / 2;

  DrawIcon(progress == 0.0f ? VOLUME_MUTE : VOLUME_UP,
           PADDING, start_y, ICON_SIZE_LARGE, window->text_primary);

  int text_x = PADDING + ICON_SIZE_LARGE + SPACING;
  int text_y = start_y + ICON_SIZE_LARGE / 2 + text_dim_.height / 2 - 4;
  DrawText(text, text_x, text_y, window->text_primary, window->defaultFont);

  int bar_y = start_y + ICON_SIZE_LARGE + SPACING;
  int bar_width = _width - PADDING * 2;
  DrawProgressBar(PADDING, bar_y, bar_width, PROGRESS_BAR_HEIGHT_THICK,
                  progress, window->progress_fg, window->progress_bg);
}

void OSDWindow::RenderPlayback()
{
  int icon_width = (icon != NONE) ? (ICON_SIZE_SMALL + SPACING) : 0;
  int total_width = icon_width + text_dim_.width;

  int start_x = (_width - total_width) / 2;
  int center_y = _height / 2;

  if (icon != NONE)
  {
    int icon_y = center_y - ICON_SIZE_SMALL / 2;
    DrawIcon(icon, start_x, icon_y, ICON_SIZE_SMALL, window->text_primary);

    int text_x = start_x + ICON_SIZE_SMALL + SPACING;
    int text_y = center_y + text_dim_.height / 2 - 4;
    DrawText(text, text_x, text_y, window->text_primary, window->defaultFont);
  }
  else
  {
    int text_y = center_y + text_dim_.height / 2 - 4;
    DrawText(text, start_x, text_y, window->text_primary, window->defaultFont);
  }
}

void OSDWindow::RenderSeek()
{
  if (!subtext.empty() && subtext_dim_.width > 0)
  {
    int text_x = (_width - subtext_dim_.width) / 2;
    int text_y = PADDING + subtext_dim_.height;
    DrawText(subtext, text_x, text_y, window->text_primary, window->boldFont);
  }

  int bar_y = _height - PROGRESS_BAR_HEIGHT_THIN - PADDING - 12;
  int bar_width = _width - PADDING * 2;

  DrawProgressBar(PADDING, bar_y, bar_width, PROGRESS_BAR_HEIGHT_THIN,
                  progress, window->progress_fg, window->progress_bg);

  if (progress > 0.0f && progress < 1.0f)
  {
    int marker_x = PADDING + static_cast<int>(bar_width * progress);
    DrawCircle(marker_x, bar_y + PROGRESS_BAR_HEIGHT_THIN / 2, 6, window->text_primary);
  }
}
