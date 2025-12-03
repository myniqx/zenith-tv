

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
  STICKY,
  FULLSCREEN
}

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
