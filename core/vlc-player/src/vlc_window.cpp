#include "vlc_player.h"

// =================================================================================================
// Unified Window API
// =================================================================================================

Napi::Value VlcPlayer::Window(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsObject())
    {
        Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object options = info[0].As<Napi::Object>();
    std::lock_guard<std::mutex> lock(mutex_);

    if (!child_window_created_)
    {
        // Window not created yet
        return Napi::Boolean::New(env, false);
    }

    // Handle resize (for sticky mode positioning, etc.)
    if (options.Has("resize"))
    {
        Napi::Object resize = options.Get("resize").As<Napi::Object>();
        int x = resize.Get("x").As<Napi::Number>().Int32Value();
        int y = resize.Get("y").As<Napi::Number>().Int32Value();
        int width = resize.Get("width").As<Napi::Number>().Int32Value();
        int height = resize.Get("height").As<Napi::Number>().Int32Value();

        osd_window_->SetBounds(x, y, width, height);
    }

    // Handle visibility
    if (options.Has("visible"))
    {
        bool visible = options.Get("visible").As<Napi::Boolean>().Value();
        osd_window_->SetVisible(visible);
    }

    // Handle screen mode (replaces: fullscreen, onTop, border, titlebar, etc.)
    // This is the ONLY way to change window style/behavior
    if (options.Has("screenMode"))
    {
        std::string mode = options.Get("screenMode").As<Napi::String>().Utf8Value();
        ScreenMode newMode;
        std::string osdText;

        if (mode == "free")
        {
            newMode = ScreenMode::FREE;
            osdText = "Normal Mode";
        }
        else if (mode == "free_ontop")
        {
            newMode = ScreenMode::FREE_ON_TOP;
            osdText = "Always on Top";
        }
        else if (mode == "sticky")
        {
            newMode = ScreenMode::STICKY;
            osdText = "Sticky Mode";
        }
        else if (mode == "fullscreen")
        {
            newMode = ScreenMode::FULLSCREEN;
            osdText = "Fullscreen";
        }
        else
        {
            Napi::Error::New(env, "Invalid screenMode. Valid values: free, free_ontop, sticky, fullscreen")
                .ThrowAsJavaScriptException();
            return env.Undefined();
        }

        // Apply screen mode
        osd_window_->SetScreenMode(newMode);

        // Show OSD notification
        osd_window_->ShowNotificationOSD(osdText);

        // Emit window info with new screen mode
        EmitPlayerInfo([mode](Napi::Env env, Napi::Object &playerInfo)
                       { playerInfo.Set("screenMode", Napi::String::New(env, mode)); });
    }

    return Napi::Boolean::New(env, true);
}
