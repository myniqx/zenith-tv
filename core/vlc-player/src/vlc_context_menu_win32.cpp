#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>
#include <vector>
#include <string>

// =================================================================================================
// Windows Context Menu Implementation
// =================================================================================================

void VlcPlayer::ShowContextMenu(int x, int y) {
    if (!child_hwnd_) {
        printf("[VLC] Cannot show context menu: window not available\n");
        fflush(stdout);
        return;
    }
    
    printf("[VLC] Building Windows context menu...\n");
    fflush(stdout);
    
    // Build menu structure
    std::vector<MenuItem> menuItems = BuildContextMenu();
    
    if (menuItems.empty()) {
        printf("[VLC] Context menu is empty\n");
        fflush(stdout);
        return;
    }
    
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
    
    // Show menu at cursor position
    POINT pt = {x, y};
    
    // Track popup menu
    UINT selectedId = TrackPopupMenu(
        hMenu,
        TPM_LEFTALIGN | TPM_TOPALIGN | TPM_RETURNCMD | TPM_NONOTIFY,
        pt.x, pt.y,
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
                        printf("[VLC] Menu item selected: %s (action: %s)\n", 
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
    }
    
    // Cleanup
    DestroyMenu(hMenu);
    
    printf("[VLC] Context menu closed\n");
    fflush(stdout);
}

#endif // _WIN32
