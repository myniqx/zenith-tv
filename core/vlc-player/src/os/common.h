#ifndef VLC_OS_COMMON_H
#define VLC_OS_COMMON_H

#include <string>
#include <vector>
#include <functional>

#include <atomic>
#include <mutex>
#include <thread>
#include <chrono>

// =================================================================================================
// Window State Structures
// =================================================================================================

struct WindowBounds
{
  int x;
  int y;
  int width;
  int height;
};

struct WindowStyle
{
  bool has_border;
  bool has_titlebar;
  bool is_resizable;
  bool show_in_taskbar;
  bool fullscreen;
  bool on_top;
};

enum ScreenMode
{
  FREE,
  FREE_ON_TOP,
  STICKY,
  FULLSCREEN
};

// =================================================================================================
// OSWindow - Platform-Agnostic Window Manager
// =================================================================================================

enum OSDIcon
{
  NONE,
  PLAY,
  PAUSE,
  STOP,
  VOLUME_UP,
  VOLUME_DOWN,
  VOLUME_MUTE
};

struct Point
{
  int x;
  int y;
};

struct Dimension
{
  int width;
  int height;
};

enum class OSDType
{
  VOLUME = 0,       // Top-left: icon + text + progress bar
  SEEK = 1,         // Bottom-center: full-width progress + time
  PLAYBACK = 2,     // Top-right: icon + text
  NOTIFICATION = 3, // Top-right queue: generic text messages
};

typedef void *OSDColor;
typedef void *OSDFont;

// Menu Item

struct MenuItem
{
  std::string label;
  std::string action;   // Action name to trigger via ProcessKeyPress
  std::string shortcut; // Keyboard shortcut display (e.g., "F11", "Space")
  bool enabled;
  bool separator;
  bool disabled;
  bool checked;
  std::function<void()> callback;
  std::vector<MenuItem> submenu;

  MenuItem() : enabled(true), separator(false), disabled(false), checked(false) {}
};

#endif // VLC_OS_COMMON_H
