#include "vlc_player.h"

#ifdef _WIN32
#include <windows.h>
#endif

Napi::Value VlcPlayer::CreateChildWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 5) {
        Napi::TypeError::New(env, "Expected: parentHandle, x, y, width, height").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    int x = info[1].As<Napi::Number>().Int32Value();
    int y = info[2].As<Napi::Number>().Int32Value();
    int width = info[3].As<Napi::Number>().Int32Value();
    int height = info[4].As<Napi::Number>().Int32Value();

    std::lock_guard<std::mutex> lock(mutex_);

    if (child_window_created_) {
        // Already created, just update bounds
        return Napi::Boolean::New(env, true);
    }

#ifdef _WIN32
    // Windows implementation
    if (info[0].IsBuffer()) {
        Napi::Buffer<void*> buffer = info[0].As<Napi::Buffer<void*>>();
        parent_hwnd_ = *reinterpret_cast<HWND*>(buffer.Data());
    } else if (info[0].IsNumber()) {
        parent_hwnd_ = reinterpret_cast<HWND>(static_cast<intptr_t>(info[0].As<Napi::Number>().Int64Value()));
    }

    if (!parent_hwnd_) {
        return Napi::Boolean::New(env, false);
    }

    // Create child window with WS_CHILD style
    child_hwnd_ = CreateWindowExW(
        0,
        L"STATIC",  // Simple window class
        L"VLC Video",
        WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS,
        x, y, width, height,
        parent_hwnd_,
        NULL,
        GetModuleHandle(NULL),
        NULL
    );

    if (child_hwnd_) {
        // Set black background
        SetClassLongPtr(child_hwnd_, GCLP_HBRBACKGROUND, (LONG_PTR)GetStockObject(BLACK_BRUSH));
        libvlc_media_player_set_hwnd(media_player_, child_hwnd_);
        child_window_created_ = true;
        return Napi::Boolean::New(env, true);
    }
#endif

    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::DestroyChildWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        return Napi::Boolean::New(env, true);
    }

#ifdef _WIN32
    if (child_hwnd_) {
        DestroyWindow(child_hwnd_);
        child_hwnd_ = nullptr;
    }
#endif

    child_window_created_ = false;
    return Napi::Boolean::New(env, true);
}

Napi::Value VlcPlayer::SetBounds(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 4) {
        Napi::TypeError::New(env, "Expected: x, y, width, height").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    int x = info[0].As<Napi::Number>().Int32Value();
    int y = info[1].As<Napi::Number>().Int32Value();
    int width = info[2].As<Napi::Number>().Int32Value();
    int height = info[3].As<Napi::Number>().Int32Value();

    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        return Napi::Boolean::New(env, false);
    }

#ifdef _WIN32
    if (child_hwnd_) {
        SetWindowPos(child_hwnd_, NULL, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);
        return Napi::Boolean::New(env, true);
    }
#endif

    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::ShowWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        return Napi::Boolean::New(env, false);
    }

#ifdef _WIN32
    if (child_hwnd_) {
        ::ShowWindow(child_hwnd_, SW_SHOW);
        return Napi::Boolean::New(env, true);
    }
#endif

    return Napi::Boolean::New(env, false);
}

Napi::Value VlcPlayer::HideWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_) {
        return Napi::Boolean::New(env, false);
    }

#ifdef _WIN32
    if (child_hwnd_) {
        ::ShowWindow(child_hwnd_, SW_HIDE);
        return Napi::Boolean::New(env, true);
    }
#endif

    return Napi::Boolean::New(env, false);
}
