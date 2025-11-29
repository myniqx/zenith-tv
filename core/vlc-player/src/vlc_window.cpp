#include "vlc_player.h"

// =================================================================================================
// Unified Window API
// =================================================================================================

Napi::Value VlcPlayer::Window(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        // Window not created yet
        return Napi::Boolean::New(env, false);
    }

    // Handle resize
    if (options.Has("resize")) {
        Napi::Object resize = options.Get("resize").As<Napi::Object>();
        int x = resize.Get("x").As<Napi::Number>().Int32Value();
        int y = resize.Get("y").As<Napi::Number>().Int32Value();
        int width = resize.Get("width").As<Napi::Number>().Int32Value();
        int height = resize.Get("height").As<Napi::Number>().Int32Value();
        SetWindowBounds(x, y, width, height);
    }

    // Handle fullscreen
    if (options.Has("fullscreen")) {
        bool fullscreen = options.Get("fullscreen").As<Napi::Boolean>().Value();

        if (fullscreen && !is_fullscreen_) {
            // Save current state before going fullscreen
            GetWindowBounds(&saved_window_state_);
        } else if (!fullscreen && is_fullscreen_) {
            // Restore previous state when exiting fullscreen
            SetWindowBounds(
                saved_window_state_.x,
                saved_window_state_.y,
                saved_window_state_.width,
                saved_window_state_.height
            );
        }

        SetWindowFullscreen(fullscreen);
        is_fullscreen_ = fullscreen;
    }

    // Handle onTop
    if (options.Has("onTop")) {
        bool onTop = options.Get("onTop").As<Napi::Boolean>().Value();
        SetWindowOnTop(onTop);
    }

    // Handle visible
    if (options.Has("visible")) {
        bool visible = options.Get("visible").As<Napi::Boolean>().Value();
        SetWindowVisible(visible);
    }

    // Handle style
    if (options.Has("style")) {
        Napi::Object style = options.Get("style").As<Napi::Object>();
        bool border = style.Has("border") ? style.Get("border").As<Napi::Boolean>().Value() : saved_window_state_.has_border;
        bool titleBar = style.Has("titleBar") ? style.Get("titleBar").As<Napi::Boolean>().Value() : saved_window_state_.has_titlebar;
        bool resizable = style.Has("resizable") ? style.Get("resizable").As<Napi::Boolean>().Value() : saved_window_state_.is_resizable;
        bool taskbar = style.Has("taskbar") ? style.Get("taskbar").As<Napi::Boolean>().Value() : true;

        SetWindowStyle(border, titleBar, resizable, taskbar);

        // Update saved state
        saved_window_state_.has_border = border;
        saved_window_state_.has_titlebar = titleBar;
        saved_window_state_.is_resizable = resizable;

        // If taskbar is false, also remove minimum size constraints for sticky mode
        if (!taskbar) {
            SetWindowMinSizeInternal(0, 0);
        } else {
            // Restore default minimum size
            SetWindowMinSizeInternal(320, 240);
        }
    }

    return Napi::Boolean::New(env, true);
}
