

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
};

// =================================================================================================
// OSWindow - Platform-Agnostic Window Manager
// =================================================================================================

enum OSDIcon
{
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
  VOLUME,        // Top-left: icon + text + progress bar
  PLAYBACK,      // Top-right queue: play/pause/stop icons
  SEEK,          // Bottom-center: full-width progress + time
  NOTIFICATION,  // Top-right queue: generic text messages
  AUDIO_TRACK,   // Top-right queue: "Audio: Track 2"
  SUBTITLE_TRACK // Top-right queue: "Subtitle: English"
};

enum class OSDPosition
{
  TOP_LEFT,
  TOP_RIGHT,
  BOTTOM_CENTER,
  CENTER
};

typedef void *OSDColor;
