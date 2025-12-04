#include "window.h"
#include "osd.h"
#include "../../vlc_player.h"
#include <vlc/vlc.h>
#include <windowsx.h>
#include <string>

// Undefine Windows macros that conflict with our method names
#undef IsMinimized

// Win32 window class name
static const wchar_t *WINDOW_CLASS_NAME = L"VLC_Player_Window";
static bool g_window_class_registered = false;

// =================================================================================================
// Dark Mode Support Helpers
// =================================================================================================

// Check if Windows is in dark mode
static bool IsWindowsDarkMode()
{
    HKEY hKey;
    LONG result = RegOpenKeyExW(
        HKEY_CURRENT_USER,
        L"Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
        0,
        KEY_READ,
        &hKey);

    if (result == ERROR_SUCCESS)
    {
        DWORD value = 1; // Default to light mode
        DWORD size = sizeof(value);
        LONG queryResult = RegQueryValueExW(
            hKey,
            L"AppsUseLightTheme",
            NULL,
            NULL,
            (LPBYTE)&value,
            &size);
        RegCloseKey(hKey);

        if (queryResult == ERROR_SUCCESS)
        {
            return (value == 0); // 0 = dark mode, 1 = light mode
        }
    }

    return false; // Default to light mode
}

// Enable dark mode for Windows 10 20H1+ menus
static void EnableDarkModeForMenu(HWND hwnd)
{
    HMODULE hUxtheme = LoadLibraryW(L"uxtheme.dll");
    if (!hUxtheme)
        return;

    // Use ordinal 135 for SetPreferredAppMode (Windows 10 1903+)
    typedef int(WINAPI * SetPreferredAppMode_t)(int);
    SetPreferredAppMode_t SetPreferredAppMode =
        (SetPreferredAppMode_t)GetProcAddress(hUxtheme, MAKEINTRESOURCEA(135));

    if (SetPreferredAppMode)
    {
        SetPreferredAppMode(1); // 1 = ForceDark
    }

    FreeLibrary(hUxtheme);
}

// =================================================================================================
// Constructor & Destructor
// =================================================================================================

Win32Window::Win32Window(VlcPlayer *player)
    : OSWindow(player),
      hwnd_(nullptr),
      hinstance_(GetModuleHandleW(NULL)),
      hmenu_(nullptr),
      is_created_(false),
      is_visible_(false),
      is_minimized_(false),
      media_player_(nullptr),
      gdiplus_token_(0),
      measure_graphics_(nullptr),
      measure_dc_(nullptr),
      next_menu_id_(1000)
{
    bounds_ = {0, 0, 0, 0};
    client_area_ = {0, 0, 0, 0};
    current_style_ = {true, true, true, true, false, false};
}

Win32Window::~Win32Window()
{
    Destroy();
}

// =================================================================================================
// Window Lifecycle
// =================================================================================================

bool Win32Window::Create(int width, int height)
{
    if (is_created_)
        return true;

    // Register window class first (outside thread)
    RegisterWindowClass();

    // Start message pump thread
    message_thread_running_ = true;
    message_thread_ = std::thread([this, width, height]()
                                  {
        // Store thread ID for debugging
        window_thread_id_ = GetCurrentThreadId();

        // Initialize GDI+
        Gdiplus::GdiplusStartupInput gdiplusStartupInput;
        Gdiplus::GdiplusStartup(&gdiplus_token_, &gdiplusStartupInput, NULL);

        // Create measure DC for text measurement
        measure_dc_ = CreateCompatibleDC(NULL);
        measure_graphics_ = new Gdiplus::Graphics(measure_dc_);
        measure_graphics_->SetTextRenderingHint(Gdiplus::TextRenderingHintAntiAlias);

        // Create main window
        hwnd_ = CreateWindowExW(
            0,
            WINDOW_CLASS_NAME,
            L"VLC Player",
            WS_OVERLAPPEDWINDOW,
            CW_USEDEFAULT, CW_USEDEFAULT,
            width, height,
            NULL, NULL, hinstance_,
            this // Pass 'this' pointer for WM_CREATE
        );

        if (!hwnd_)
        {
            if (measure_graphics_)
            {
                delete measure_graphics_;
                measure_graphics_ = nullptr;
            }
            if (measure_dc_)
            {
                DeleteDC(measure_dc_);
                measure_dc_ = nullptr;
            }
            Gdiplus::GdiplusShutdown(gdiplus_token_);
            message_thread_running_ = false;
            return;
        }

        // Show window
        ShowWindow(hwnd_, SW_SHOW);
        UpdateWindow(hwnd_);

        // Update state
        is_created_ = true;
        is_visible_ = true;
        is_minimized_ = false;

        // Get initial bounds
        RECT rect;
        GetWindowRect(hwnd_, &rect);
        bounds_ = {rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top};

        UpdateClientArea();

        // Message loop (~60fps with 16ms sleep)
        MSG msg;
        while (message_thread_running_)
        {
            while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE))
            {
                if (msg.message == WM_QUIT)
                {
                    message_thread_running_ = false;
                    return;
                }
                TranslateMessage(&msg);
                DispatchMessage(&msg);
            }
            Sleep(16); // ~60fps
        } });

    // Wait for window creation (timeout after 5 seconds)
    auto start_time = std::chrono::steady_clock::now();
    while (!is_created_ && message_thread_running_)
    {
        std::this_thread::sleep_for(std::chrono::milliseconds(10));

        // Timeout check
        auto elapsed = std::chrono::steady_clock::now() - start_time;
        if (std::chrono::duration_cast<std::chrono::seconds>(elapsed).count() >= 5)
        {
            message_thread_running_ = false;
            if (message_thread_.joinable())
            {
                message_thread_.join();
            }
            return false;
        }
    }

    return is_created_;
}

void Win32Window::Destroy()
{
    if (!is_created_)
        return;

    // Stop message pump thread
    if (message_thread_running_)
    {
        message_thread_running_ = false;

        // Send WM_QUIT to exit message loop
        if (hwnd_)
        {
            PostMessage(hwnd_, WM_QUIT, 0, 0);
        }

        // Wait for thread to finish
        if (message_thread_.joinable())
        {
            message_thread_.join();
        }
    }

    // Unbind VLC
    if (media_player_)
    {
        libvlc_media_player_set_hwnd(media_player_, NULL);
        media_player_ = nullptr;
    }

    // Cleanup fonts
    for (auto *font : fonts_)
    {
        delete font;
    }
    fonts_.clear();

    // Cleanup colors
    for (auto *color : colors_)
    {
        delete color;
    }
    colors_.clear();

    // Cleanup GDI+
    if (measure_graphics_)
    {
        delete measure_graphics_;
        measure_graphics_ = nullptr;
    }

    if (measure_dc_)
    {
        DeleteDC(measure_dc_);
        measure_dc_ = nullptr;
    }

    Gdiplus::GdiplusShutdown(gdiplus_token_);

    // Destroy window
    if (hwnd_)
    {
        DestroyWindow(hwnd_);
        hwnd_ = nullptr;
    }

    UnregisterWindowClass();

    is_created_ = false;
    is_visible_ = false;
}

bool Win32Window::IsCreated() const
{
    return is_created_ && hwnd_ != nullptr && IsWindow(hwnd_);
}

bool Win32Window::Bind(libvlc_media_player_t *media_player)
{
    if (!IsCreated())
        return false;

    media_player_ = media_player;

    // Bind VLC to window handle
    libvlc_media_player_set_hwnd(media_player_, hwnd_);

    return true;
}

// =================================================================================================
// Window State Queries
// =================================================================================================

bool Win32Window::IsVisible() const
{
    return is_created_ && is_visible_ && IsWindowVisible(hwnd_);
}

bool Win32Window::IsMinimized() const
{
    return is_created_ && is_minimized_;
}

bool Win32Window::IsFullscreen() const
{
    return current_style_.fullscreen;
}

bool Win32Window::IsOnTop() const
{
    return current_style_.on_top;
}

void Win32Window::GetBounds(WindowBounds *bounds) const
{
    if (bounds)
    {
        *bounds = bounds_;
    }
}

WindowBounds Win32Window::GetClientArea() const
{
    return client_area_;
}

// =================================================================================================
// Window Manipulation Internal
// =================================================================================================

void Win32Window::SetBoundsInternal(int x, int y, int width, int height)
{
    if (!IsCreated())
        return;

    SetWindowPos(hwnd_, NULL, x, y, width, height,
                 SWP_NOZORDER | SWP_NOACTIVATE);

    bounds_ = {x, y, width, height};
    UpdateClientArea();
}

void Win32Window::SetStyleInternal(const WindowStyle &style)
{
    if (!IsCreated())
        return;

    current_style_ = style;
    ApplyWindowStyle(style);
}

void Win32Window::ApplyWindowStyle(const WindowStyle &style)
{
    LONG window_style = 0;
    LONG ex_style = 0;

    if (style.fullscreen)
    {
        // Fullscreen: borderless, no taskbar, topmost
        window_style = WS_POPUP | WS_VISIBLE;
        ex_style = WS_EX_TOPMOST;

        // Get monitor size
        HMONITOR monitor = MonitorFromWindow(hwnd_, MONITOR_DEFAULTTOPRIMARY);
        MONITORINFO mi = {sizeof(mi)};
        GetMonitorInfo(monitor, &mi);

        SetWindowLongPtrW(hwnd_, GWL_STYLE, window_style);
        SetWindowLongPtrW(hwnd_, GWL_EXSTYLE, ex_style);
        SetWindowPos(hwnd_, HWND_TOPMOST,
                     mi.rcMonitor.left, mi.rcMonitor.top,
                     mi.rcMonitor.right - mi.rcMonitor.left,
                     mi.rcMonitor.bottom - mi.rcMonitor.top,
                     SWP_FRAMECHANGED);
    }
    else if (style.on_top)
    {
        // Sticky: borderless, always on top
        window_style = WS_POPUP | WS_VISIBLE;
        ex_style = WS_EX_TOPMOST;

        SetWindowLongPtrW(hwnd_, GWL_STYLE, window_style);
        SetWindowLongPtrW(hwnd_, GWL_EXSTYLE, ex_style);
        SetWindowPos(hwnd_, HWND_TOPMOST, 0, 0, 0, 0,
                     SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED);
    }
    else
    {
        // Normal windowed mode
        window_style = WS_OVERLAPPEDWINDOW | WS_VISIBLE;

        if (!style.is_resizable)
        {
            window_style &= ~(WS_THICKFRAME | WS_MAXIMIZEBOX);
        }
        if (!style.has_border)
        {
            window_style &= ~WS_BORDER;
        }
        if (!style.has_titlebar)
        {
            window_style &= ~WS_CAPTION;
        }

        ex_style = 0;
        if (!style.show_in_taskbar)
        {
            ex_style = WS_EX_TOOLWINDOW;
        }

        SetWindowLongPtrW(hwnd_, GWL_STYLE, window_style);
        SetWindowLongPtrW(hwnd_, GWL_EXSTYLE, ex_style);
        SetWindowPos(hwnd_, HWND_NOTOPMOST, 0, 0, 0, 0,
                     SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED);
    }

    UpdateClientArea();
}

// =================================================================================================
// Color & Font Management
// =================================================================================================

OSDColor Win32Window::CreateColor(int r, int g, int b, int a)
{
    auto *color = new Gdiplus::Color(a, r, g, b);
    colors_.push_back(color);
    return static_cast<OSDColor>(color);
}

OSDFont Win32Window::CreateOSDFont(bool bold)
{
    auto *font = new Gdiplus::Font(
        L"Segoe UI",
        12.0f,
        bold ? Gdiplus::FontStyleBold : Gdiplus::FontStyleRegular);
    fonts_.push_back(font);
    return static_cast<OSDFont>(font);
}

void Win32Window::DestroyColor(OSDColor color)
{
    if (!color)
        return;

    auto *gdi_color = static_cast<Gdiplus::Color *>(color);
    auto it = std::find(colors_.begin(), colors_.end(), gdi_color);
    if (it != colors_.end())
    {
        delete *it;
        colors_.erase(it);
    }
}

void Win32Window::DestroyFont(OSDFont font)
{
    if (!font)
        return;

    auto *gdi_font = static_cast<Gdiplus::Font *>(font);
    auto it = std::find(fonts_.begin(), fonts_.end(), gdi_font);
    if (it != fonts_.end())
    {
        delete *it;
        fonts_.erase(it);
    }
}

Dimension Win32Window::MeasureText(OSDFont font, const std::string &text)
{
    if (!measure_graphics_ || text.empty())
        return {0, 0};

    // Convert UTF-8 to wide string
    int wlen = MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, NULL, 0);
    if (wlen <= 0)
        return {0, 0};

    wchar_t *wtext = new wchar_t[wlen];
    MultiByteToWideChar(CP_UTF8, 0, text.c_str(), -1, wtext, wlen);

    // Get font (use default if null)
    Gdiplus::Font *gdi_font = font ? static_cast<Gdiplus::Font *>(font) : static_cast<Gdiplus::Font *>(defaultFont);
    if (!gdi_font)
    {
        delete[] wtext;
        return {0, 0};
    }

    // Measure text
    Gdiplus::RectF layout(0, 0, 10000, 10000);
    Gdiplus::RectF boundingBox;
    measure_graphics_->MeasureString(wtext, -1, gdi_font, layout, &boundingBox);

    delete[] wtext;
    return {(int)boundingBox.Width, (int)boundingBox.Height};
}

// =================================================================================================
// OSD Management
// =================================================================================================

std::shared_ptr<OSDWindow> Win32Window::CreateOSDWindow()
{
    return std::make_shared<Win32OSDWindow>(this);
}

// =================================================================================================
// Context Menu
// =================================================================================================

void Win32Window::CreateContextMenu(std::vector<MenuItem> items, int x, int y)
{
    DestroyContextMenu();

    // Enable dark mode if system is in dark mode
    if (IsWindowsDarkMode())
    {
        EnableDarkModeForMenu(hwnd_);
    }

    hmenu_ = CreatePopupMenu();
    next_menu_id_ = 1000;

    BuildWin32Menu(hmenu_, items);

    // Convert client to screen coordinates
    POINT pt = {x, y};
    ClientToScreen(hwnd_, &pt);

    // Show menu
    TrackPopupMenu(hmenu_, TPM_RIGHTBUTTON,
                   pt.x, pt.y, 0, hwnd_, NULL);
}

void Win32Window::BuildWin32Menu(HMENU menu, const std::vector<MenuItem> &items)
{
    for (const auto &item : items)
    {
        if (item.separator)
        {
            AppendMenuW(menu, MF_SEPARATOR, 0, NULL);
        }
        else if (!item.submenu.empty())
        {
            HMENU submenu = CreatePopupMenu();
            BuildWin32Menu(submenu, item.submenu);

            int wlen = MultiByteToWideChar(CP_UTF8, 0, item.label.c_str(), -1, NULL, 0);
            wchar_t *wlabel = new wchar_t[wlen];
            MultiByteToWideChar(CP_UTF8, 0, item.label.c_str(), -1, wlabel, wlen);

            AppendMenuW(menu, MF_POPUP, (UINT_PTR)submenu, wlabel);
            delete[] wlabel;
        }
        else
        {
            // Build label with shortcut (if available)
            std::string label_with_shortcut = item.label;
            if (!item.shortcut.empty())
            {
                label_with_shortcut += "\t" + item.shortcut;
            }

            int wlen = MultiByteToWideChar(CP_UTF8, 0, label_with_shortcut.c_str(), -1, NULL, 0);
            wchar_t *wlabel = new wchar_t[wlen];
            MultiByteToWideChar(CP_UTF8, 0, label_with_shortcut.c_str(), -1, wlabel, wlen);

            UINT flags = MF_STRING;
            if (item.disabled)
                flags |= MF_DISABLED | MF_GRAYED;
            if (item.checked)
                flags |= MF_CHECKED;

            UINT id = next_menu_id_++;
            AppendMenuW(menu, flags, id, wlabel);

            menu_item_map_[id] = item;
            delete[] wlabel;
        }
    }
}

void Win32Window::DestroyContextMenu()
{
    if (hmenu_)
    {
        DestroyMenu(hmenu_);
        hmenu_ = NULL;
    }
    menu_item_map_.clear();
}

void Win32Window::HandleMenuCommand(UINT command_id)
{
    auto it = menu_item_map_.find(command_id);
    if (it != menu_item_map_.end())
    {
        const MenuItem &item = it->second;

        // Execute action if available
        if (!item.action.empty() && player)
        {
            player->ExecuteMenuAction(item.action);
        }

        // Also call callback if available (for custom actions)
        if (item.callback)
        {
            item.callback();
        }
    }

    // Clean up menu after command execution
    DestroyContextMenu();
}

// =================================================================================================
// Helper Methods
// =================================================================================================

void Win32Window::RegisterWindowClass()
{
    if (g_window_class_registered)
        return;

    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(WNDCLASSEXW);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WindowProc;
    wc.hInstance = hinstance_;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    wc.lpszClassName = WINDOW_CLASS_NAME;

    if (RegisterClassExW(&wc))
    {
        g_window_class_registered = true;
    }
}

void Win32Window::UnregisterWindowClass()
{
    if (g_window_class_registered)
    {
        UnregisterClassW(WINDOW_CLASS_NAME, hinstance_);
        g_window_class_registered = false;
    }
}

void Win32Window::UpdateClientArea()
{
    if (!IsCreated())
        return;

    RECT client_rect;
    GetClientRect(hwnd_, &client_rect);

    POINT top_left = {0, 0};
    ClientToScreen(hwnd_, &top_left);

    client_area_.x = top_left.x;
    client_area_.y = top_left.y;
    client_area_.width = client_rect.right - client_rect.left;
    client_area_.height = client_rect.bottom - client_rect.top;
}

std::string Win32Window::GetKeyName(WPARAM wParam, LPARAM lParam)
{
    // Virtual key code mapping
    switch (wParam)
    {
    case VK_SPACE:
        return "Space";
    case VK_RETURN:
        return "Enter";
    case VK_ESCAPE:
        return "Escape";
    case VK_TAB:
        return "Tab";
    case VK_BACK:
        return "Backspace";
    case VK_LEFT:
        return "ArrowLeft";
    case VK_RIGHT:
        return "ArrowRight";
    case VK_UP:
        return "ArrowUp";
    case VK_DOWN:
        return "ArrowDown";
    case VK_F11:
        return "F11";
    case 'F':
        return "KeyF";
    case 'M':
        return "KeyM";
    case 'K':
        return "KeyK";
    default:
        if (wParam >= 'A' && wParam <= 'Z')
        {
            return "Key" + std::string(1, (char)wParam);
        }
        return "";
    }
}

bool Win32Window::GetKeyModifiers(bool &ctrl, bool &shift, bool &alt, bool &meta)
{
    ctrl = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
    shift = (GetKeyState(VK_SHIFT) & 0x8000) != 0;
    alt = (GetKeyState(VK_MENU) & 0x8000) != 0;
    meta = (GetKeyState(VK_LWIN) & 0x8000) != 0 || (GetKeyState(VK_RWIN) & 0x8000) != 0;
    return true;
}

// =================================================================================================
// Window Procedure
// =================================================================================================

LRESULT CALLBACK Win32Window::WindowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
    Win32Window *window = nullptr;

    if (msg == WM_CREATE)
    {
        CREATESTRUCT *cs = reinterpret_cast<CREATESTRUCT *>(lParam);
        window = static_cast<Win32Window *>(cs->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(window));
    }
    else
    {
        window = reinterpret_cast<Win32Window *>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    }

    if (window)
    {
        return window->HandleMessage(msg, wParam, lParam);
    }

    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

LRESULT Win32Window::HandleMessage(UINT msg, WPARAM wParam, LPARAM lParam)
{
    switch (msg)
    {
    case WM_KEYDOWN:
    case WM_SYSKEYDOWN:
        HandleKeyDown(wParam, lParam);
        return 0;

    case WM_LBUTTONDOWN:
    case WM_RBUTTONDOWN:
    case WM_MBUTTONDOWN:
        HandleMouseButton(msg, wParam, lParam);
        return 0;

    case WM_MOUSEMOVE:
        HandleMouseMove(lParam);
        return 0;

    case WM_SIZE:
        HandleSize(wParam, lParam);
        return 0;

    case WM_MOVE:
        HandleMove(lParam);
        return 0;

    case WM_COMMAND:
        HandleMenuCommand(LOWORD(wParam));
        return 0;

    case WM_CLOSE:
        OnClose();
        return 0;

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }

    return DefWindowProcW(hwnd_, msg, wParam, lParam);
}

// =================================================================================================
// Message Handlers
// =================================================================================================

void Win32Window::HandleKeyDown(WPARAM wParam, LPARAM lParam)
{
    std::string key_name = GetKeyName(wParam, lParam);
    if (key_name.empty())
        return;

    bool ctrl, shift, alt, meta;
    GetKeyModifiers(ctrl, shift, alt, meta);

    OnInput(key_name, ctrl, shift, alt, meta);
}

void Win32Window::HandleMouseMove(LPARAM lParam)
{
    // Mouse move handling (future: cursor hiding, etc.)
}

void Win32Window::HandleMouseButton(UINT msg, WPARAM wParam, LPARAM lParam)
{
    int x = GET_X_LPARAM(lParam);
    int y = GET_Y_LPARAM(lParam);

    bool left = (msg == WM_LBUTTONDOWN);
    bool middle = (msg == WM_MBUTTONDOWN);
    bool right = (msg == WM_RBUTTONDOWN);

    if (right)
    {
        OnRightClick(x, y);
    }
}

void Win32Window::HandleSize(WPARAM wParam, LPARAM lParam)
{
    int width = LOWORD(lParam);
    int height = HIWORD(lParam);

    // Update minimized state
    is_minimized_ = (wParam == SIZE_MINIMIZED);

    if (wParam == SIZE_MINIMIZED)
    {
        OnMinimize(true);
    }
    else if (wParam == SIZE_RESTORED || wParam == SIZE_MAXIMIZED)
    {
        OnMinimize(false);

        RECT rect;
        GetWindowRect(hwnd_, &rect);
        OnResize(rect.left, rect.top, width, height);
        UpdateClientArea();
    }
}

void Win32Window::HandleMove(LPARAM lParam)
{
    int x = LOWORD(lParam);
    int y = HIWORD(lParam);

    RECT rect;
    GetWindowRect(hwnd_, &rect);
    bounds_.x = rect.left;
    bounds_.y = rect.top;

    UpdateClientArea();
}
