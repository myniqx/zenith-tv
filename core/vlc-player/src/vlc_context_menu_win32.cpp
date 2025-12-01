#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>
#include <vector>
#include <string>
#include <functional>

// =================================================================================================
// Windows Context Menu Implementation
// =================================================================================================

// Check if Windows is in dark mode
static bool IsWindowsDarkMode() {
    // Check registry for dark mode preference
    HKEY hKey;
    LONG result = RegOpenKeyExW(
        HKEY_CURRENT_USER,
        L"Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
        0,
        KEY_READ,
        &hKey
    );

    if (result == ERROR_SUCCESS) {
        DWORD value = 1; // Default to light mode
        DWORD size = sizeof(value);
        LONG queryResult = RegQueryValueExW(
            hKey,
            L"AppsUseLightTheme",
            NULL,
            NULL,
            (LPBYTE)&value,
            &size
        );
        RegCloseKey(hKey);

        if (queryResult == ERROR_SUCCESS) {
            // 0 = dark mode, 1 = light mode
            bool isDark = (value == 0);
            printf("[VLC] Windows theme detected: %s\n", isDark ? "dark" : "light");
            fflush(stdout);
            return isDark;
        }
    }

    printf("[VLC] Failed to detect Windows theme, defaulting to light mode\n");
    fflush(stdout);
    return false;
}

// Enable dark mode for Windows 10 20H1+ menus
// This uses undocumented APIs but is widely used (Chrome, Firefox, etc.)
static void EnableDarkModeForMenu(HWND hwnd) {
    // Try to load uxtheme.dll for dark mode support
    HMODULE hUxtheme = LoadLibraryW(L"uxtheme.dll");
    if (!hUxtheme) {
        return;
    }

    // Use ordinal 135 for SetPreferredAppMode (Windows 10 1903+)
    typedef int (WINAPI *SetPreferredAppMode_t)(int);
    SetPreferredAppMode_t SetPreferredAppMode =
        (SetPreferredAppMode_t)GetProcAddress(hUxtheme, MAKEINTRESOURCEA(135));

    if (SetPreferredAppMode) {
        // 1 = ForceDark, 0 = Default, 2 = ForceLight
        SetPreferredAppMode(1);
        printf("[VLC] Dark mode enabled for menus\n");
        fflush(stdout);
    }

    FreeLibrary(hUxtheme);
}

void VlcPlayer::ShowContextMenu(int x, int y) {
    if (!child_hwnd_) {
        printf("[VLC] Cannot show context menu: window not available\n");
        fflush(stdout);
        return;
    }

    printf("[VLC] Building Windows context menu at (%d, %d)...\n", x, y);
    fflush(stdout);

    // Check if dark mode is enabled
    bool isDarkMode = IsWindowsDarkMode();

    // Enable dark mode for menus if system is in dark mode
    if (isDarkMode) {
        EnableDarkModeForMenu(child_hwnd_);
    }

    // Build menu structure
    std::vector<MenuItem> menuItems = BuildContextMenu();

    if (menuItems.empty()) {
        printf("[VLC] Context menu is empty\n");
        fflush(stdout);
        return;
    }

    printf("[VLC] Context menu has %zu items\n", menuItems.size());
    fflush(stdout);

    // Create popup menu
    HMENU hMenu = CreatePopupMenu();
    if (!hMenu) {
        printf("[VLC] Failed to create popup menu\n");
        fflush(stdout);
        return;
    }
    
    // Helper function to add menu items recursively
    std::function<void(HMENU, const std::vector<MenuItem>&, UINT&)> addMenuItems;
    addMenuItems = [&](HMENU parentMenu, const std::vector<MenuItem>& items, UINT& commandId) {
        for (const auto& item : items) {
            if (item.separator) {
                AppendMenuW(parentMenu, MF_SEPARATOR, 0, nullptr);
            } else if (!item.submenu.empty()) {
                // Create submenu
                HMENU hSubMenu = CreatePopupMenu();
                addMenuItems(hSubMenu, item.submenu, commandId);
                
                std::wstring wLabel(item.label.begin(), item.label.end());
                AppendMenuW(parentMenu, MF_POPUP | (item.enabled ? MF_ENABLED : MF_GRAYED), 
                           (UINT_PTR)hSubMenu, wLabel.c_str());
            } else {
                // Regular menu item
                std::wstring wLabel(item.label.begin(), item.label.end());
                if (!item.shortcut.empty()) {
                    wLabel += L"\t" + std::wstring(item.shortcut.begin(), item.shortcut.end());
                }
                
                AppendMenuW(parentMenu, item.enabled ? MF_ENABLED : MF_GRAYED, 
                           commandId++, wLabel.c_str());
            }
        }
    };
    
    UINT commandId = 1000;
    addMenuItems(hMenu, menuItems, commandId);

    // Set modern menu style
    MENUINFO mi = {};
    mi.cbSize = sizeof(MENUINFO);
    mi.fMask = MIM_STYLE;
    mi.dwStyle = MNS_NOTIFYBYPOS;  // Modern notification style
    SetMenuInfo(hMenu, &mi);

    printf("[VLC] Showing menu at screen coordinates (%d, %d)\n", x, y);
    fflush(stdout);

    // Track popup menu with right-button tracking for better UX
    UINT selectedId = TrackPopupMenu(
        hMenu,
        TPM_LEFTALIGN | TPM_TOPALIGN | TPM_RETURNCMD | TPM_NONOTIFY | TPM_RIGHTBUTTON,
        x, y,
        0,
        child_hwnd_,
        nullptr
    );
    
    if (selectedId >= 1000) {
        // Find the selected item
        UINT index = selectedId - 1000;
        UINT currentIndex = 0;

        std::function<bool(const std::vector<MenuItem>&)> findAndExecute;
        findAndExecute = [&](const std::vector<MenuItem>& items) -> bool {
            for (const auto& item : items) {
                if (item.separator) {
                    continue;
                }

                if (!item.submenu.empty()) {
                    if (findAndExecute(item.submenu)) {
                        return true;
                    }
                } else {
                    if (currentIndex == index) {
                        printf("[VLC] Menu item selected: '%s' (action: %s)\n",
                               item.label.c_str(), item.action.c_str());
                        fflush(stdout);

                        // Execute the action
                        ExecuteMenuAction(item.action);

                        return true;
                    }
                    currentIndex++;
                }
            }
            return false;
        };

        findAndExecute(menuItems);
    } else {
        printf("[VLC] Context menu dismissed (no selection)\n");
        fflush(stdout);
    }

    // Cleanup
    DestroyMenu(hMenu);

    printf("[VLC] Context menu closed\n");
    fflush(stdout);
}

#endif // _WIN32
