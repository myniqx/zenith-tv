#include "vlc_player.h"
#include <algorithm>

// =================================================================================================
// Keyboard Shortcut API
// =================================================================================================

// IMPORTANT: This action list MUST be kept in sync with apps/desktop/src/stores/helpers/shortcutAction.ts
// Both files must contain the exact same ShortcutAction types.
// When adding a new shortcut action:
//   1. Add it to ShortcutAction type in apps/desktop/src/types/types.ts
//   2. Add default key mapping here (can be empty array {})
//   3. Add action handler in apps/desktop/src/stores/helpers/shortcutAction.ts
void VlcPlayer::InitializeDefaultShortcuts() {
    action_to_keys_.clear();

    action_to_keys_["playPause"] = {"Space", "MouseLeft"};
    action_to_keys_["stop"] = {};
    action_to_keys_["seekForward"] = {"ArrowRight"};
    action_to_keys_["seekBackward"] = {"ArrowLeft"};
    action_to_keys_["seekForwardSmall"] = {};
    action_to_keys_["seekBackwardSmall"] = {};
    action_to_keys_["volumeUp"] = {"ArrowUp"};
    action_to_keys_["volumeDown"] = {"ArrowDown"};
    action_to_keys_["toggleMute"] = {};
    action_to_keys_["toggleFullscreen"] = {"MouseMiddle"};
    action_to_keys_["exitFullscreen"] = {"Escape"};
    action_to_keys_["stickyMode"] = {};
    action_to_keys_["freeScreenMode"] = {};
    action_to_keys_["subtitleDelayPlus"] = {};
    action_to_keys_["subtitleDelayMinus"] = {};
    action_to_keys_["subtitleDisable"] = {};
}

std::string VlcPlayer::GetFirstKeyForAction(const std::string& action) {
    auto it = action_to_keys_.find(action);
    if (it != action_to_keys_.end() && !it->second.empty()) {
        return it->second[0];
    }
    return "";
}

bool VlcPlayer::HasKeyForAction(const std::string& action) {
    auto it = action_to_keys_.find(action);
    return it != action_to_keys_.end() && !it->second.empty();
}

bool VlcPlayer::IsKnownAction(const std::string& action) {
    return action_to_keys_.find(action) != action_to_keys_.end();
}

Napi::Value VlcPlayer::Shortcut(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object options = info[0].As<Napi::Object>();

    if (!options.Has("shortcuts") || !options.Get("shortcuts").IsObject()) {
        Napi::Error::New(env, "shortcuts object is required").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object shortcuts = options.Get("shortcuts").As<Napi::Object>();
    Napi::Array actions = shortcuts.GetPropertyNames();

    // DON'T clear - merge with existing shortcuts to preserve all actions
    // action_to_keys_.clear();

    for (uint32_t i = 0; i < actions.Length(); i++) {
        std::string action = actions.Get(i).As<Napi::String>().Utf8Value();

        // Only update known actions (defined in InitializeDefaultShortcuts)
        if (!IsKnownAction(action)) {
            continue; // Skip unknown actions
        }

        Napi::Value keysValue = shortcuts.Get(action);
        std::vector<std::string> keys;

        if (keysValue.IsArray()) {
            Napi::Array keysArray = keysValue.As<Napi::Array>();
            for (uint32_t j = 0; j < keysArray.Length(); j++) {
                keys.push_back(keysArray.Get(j).As<Napi::String>().Utf8Value());
            }
        } else if (keysValue.IsString()) {
            keys.push_back(keysValue.As<Napi::String>().Utf8Value());
        }

        action_to_keys_[action] = keys;
    }

    return env.Undefined();
}

void VlcPlayer::ProcessKeyPress(const std::string& key_code) {
    for (const auto& [action, keys] : action_to_keys_) {
        if (std::find(keys.begin(), keys.end(), key_code) != keys.end()) {
            EmitShortcut(action);
            return;
        }
    }
}
