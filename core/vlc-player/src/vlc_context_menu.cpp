#include "vlc_player.h"
#include <vlc/vlc.h>

// =================================================================================================
// Context Menu Builder
// =================================================================================================

std::vector<VlcPlayer::MenuItem> VlcPlayer::BuildContextMenu() {
    std::vector<MenuItem> menu;
    
    // Get current player state
    bool isPlaying = false;
    bool hasMedia = false;
    
    if (media_player_) {
        isPlaying = libvlc_media_player_is_playing(media_player_);
        libvlc_state_t state = libvlc_media_player_get_state(media_player_);
        hasMedia = (state != libvlc_NothingSpecial && state != libvlc_Stopped);
    }
    
    // =================================================================================================
    // Playback Controls
    // =================================================================================================
    
    // Play/Pause (dynamic based on state)
    MenuItem playPause;
    playPause.label = isPlaying ? "Pause" : "Play";
    playPause.action = "playPause";
    playPause.shortcut = GetFirstKeyForAction("playPause");
    playPause.enabled = hasMedia;
    menu.push_back(playPause);

    // Stop
    MenuItem stop;
    stop.label = "Stop";
    stop.action = "stop";
    stop.shortcut = GetFirstKeyForAction("stop");
    stop.enabled = hasMedia;
    menu.push_back(stop);
    
    // Separator
    MenuItem sep1;
    sep1.separator = true;
    menu.push_back(sep1);
    
    // Forward +3s (Small)
    MenuItem forward3;
    forward3.label = "Forward +3s";
    forward3.action = "seekForwardSmall";
    forward3.shortcut = GetFirstKeyForAction("seekForwardSmall");
    forward3.enabled = hasMedia;
    menu.push_back(forward3);

    // Forward +10s
    MenuItem forward10;
    forward10.label = "Forward +10s";
    forward10.action = "seekForward";
    forward10.shortcut = GetFirstKeyForAction("seekForward");
    forward10.enabled = hasMedia;
    menu.push_back(forward10);

    // Backward -3s (Small)
    MenuItem backward3;
    backward3.label = "Backward -3s";
    backward3.action = "seekBackwardSmall";
    backward3.shortcut = GetFirstKeyForAction("seekBackwardSmall");
    backward3.enabled = hasMedia;
    menu.push_back(backward3);

    // Backward -10s
    MenuItem backward10;
    backward10.label = "Backward -10s";
    backward10.action = "seekBackward";
    backward10.shortcut = GetFirstKeyForAction("seekBackward");
    backward10.enabled = hasMedia;
    menu.push_back(backward10);
    
    // Separator
    MenuItem sep2;
    sep2.separator = true;
    menu.push_back(sep2);
    
    // =================================================================================================
    // Window Modes
    // =================================================================================================
    
    // Fullscreen
    MenuItem fullscreen;
    fullscreen.label = is_fullscreen_ ? "Exit Fullscreen" : "Fullscreen";
    fullscreen.action = is_fullscreen_ ? "exitFullscreen" : "toggleFullscreen";
    fullscreen.shortcut = GetFirstKeyForAction(is_fullscreen_ ? "exitFullscreen" : "toggleFullscreen");
    fullscreen.enabled = child_window_created_;
    menu.push_back(fullscreen);

    // Sticky Mode (always on top, no taskbar)
    MenuItem sticky;
    sticky.label = "Sticky Mode";
    sticky.action = "stickyMode";
    sticky.shortcut = GetFirstKeyForAction("stickyMode");
    sticky.enabled = child_window_created_;
    menu.push_back(sticky);

    // Free Screen Mode (borderless, no decorations)
    MenuItem freeScreen;
    freeScreen.label = "Free Screen Mode";
    freeScreen.action = "freeScreenMode";
    freeScreen.shortcut = GetFirstKeyForAction("freeScreenMode");
    freeScreen.enabled = child_window_created_;
    menu.push_back(freeScreen);
    
    // Separator
    MenuItem sep3;
    sep3.separator = true;
    menu.push_back(sep3);
    
    // =================================================================================================
    // Subtitle Submenu
    // =================================================================================================
    
    MenuItem subtitleMenu;
    subtitleMenu.label = "Subtitle";
    subtitleMenu.enabled = hasMedia;
    
    // Delay +100ms
    MenuItem subDelayPlus;
    subDelayPlus.label = "Delay +100ms";
    subDelayPlus.action = "subtitleDelayPlus";
    subDelayPlus.shortcut = GetFirstKeyForAction("subtitleDelayPlus");
    subtitleMenu.submenu.push_back(subDelayPlus);

    // Delay -100ms
    MenuItem subDelayMinus;
    subDelayMinus.label = "Delay -100ms";
    subDelayMinus.action = "subtitleDelayMinus";
    subDelayMinus.shortcut = GetFirstKeyForAction("subtitleDelayMinus");
    subtitleMenu.submenu.push_back(subDelayMinus);
    
    // Separator in submenu
    MenuItem subSep;
    subSep.separator = true;
    subtitleMenu.submenu.push_back(subSep);
    
    // Get subtitle tracks
    if (media_player_) {
        libvlc_track_description_t* tracks = libvlc_video_get_spu_description(media_player_);
        int currentTrack = libvlc_video_get_spu(media_player_);
        
        if (tracks) {
            libvlc_track_description_t* track = tracks;
            while (track) {
                MenuItem trackItem;
                trackItem.label = track->psz_name ? track->psz_name : "Unknown";
                trackItem.action = "subtitleTrack_" + std::to_string(track->i_id);
                trackItem.enabled = true;
                // Add checkmark if current track
                if (track->i_id == currentTrack) {
                    trackItem.label = "✓ " + trackItem.label;
                }
                subtitleMenu.submenu.push_back(trackItem);
                track = track->p_next;
            }
            libvlc_track_description_list_release(tracks);
        }
    }
    
    // Disable subtitles
    MenuItem disableSub;
    disableSub.label = "Disable";
    disableSub.action = "subtitleDisable";
    disableSub.shortcut = GetFirstKeyForAction("subtitleDisable");
    subtitleMenu.submenu.push_back(disableSub);
    
    menu.push_back(subtitleMenu);
    
    // =================================================================================================
    // Audio Submenu
    // =================================================================================================
    
    MenuItem audioMenu;
    audioMenu.label = "Audio";
    audioMenu.enabled = hasMedia;
    
    // Volume Up
    MenuItem volUp;
    volUp.label = "Volume Up";
    volUp.action = "volumeUp";
    volUp.shortcut = GetFirstKeyForAction("volumeUp");
    audioMenu.submenu.push_back(volUp);

    // Volume Down
    MenuItem volDown;
    volDown.label = "Volume Down";
    volDown.action = "volumeDown";
    volDown.shortcut = GetFirstKeyForAction("volumeDown");
    audioMenu.submenu.push_back(volDown);

    // Mute
    MenuItem mute;
    mute.label = "Mute";
    mute.action = "toggleMute";
    mute.shortcut = GetFirstKeyForAction("toggleMute");
    audioMenu.submenu.push_back(mute);
    
    // Separator
    MenuItem audioSep;
    audioSep.separator = true;
    audioMenu.submenu.push_back(audioSep);
    
    // Get audio tracks
    if (media_player_) {
        libvlc_track_description_t* tracks = libvlc_audio_get_track_description(media_player_);
        int currentTrack = libvlc_audio_get_track(media_player_);
        
        if (tracks) {
            libvlc_track_description_t* track = tracks;
            while (track) {
                MenuItem trackItem;
                trackItem.label = track->psz_name ? track->psz_name : "Unknown";
                trackItem.action = "audioTrack_" + std::to_string(track->i_id);
                trackItem.enabled = true;
                // Add checkmark if current track
                if (track->i_id == currentTrack) {
                    trackItem.label = "✓ " + trackItem.label;
                }
                audioMenu.submenu.push_back(trackItem);
                track = track->p_next;
            }
            libvlc_track_description_list_release(tracks);
        }
    }
    
    menu.push_back(audioMenu);
    
    // =================================================================================================
    // Video Submenu
    // =================================================================================================
    
    MenuItem videoMenu;
    videoMenu.label = "Video";
    videoMenu.enabled = hasMedia;
    
    // Aspect Ratio submenu
    MenuItem aspectRatio;
    aspectRatio.label = "Aspect Ratio";
    
    const char* aspectRatios[] = {"Default", "16:9", "4:3", "16:10", "2.21:1", "2.35:1", "2.39:1", "5:4"};
    for (const char* ar : aspectRatios) {
        MenuItem arItem;
        arItem.label = ar;
        arItem.action = std::string("aspectRatio_") + ar;
        arItem.enabled = true;
        aspectRatio.submenu.push_back(arItem);
    }
    videoMenu.submenu.push_back(aspectRatio);
    
    // Crop submenu
    MenuItem crop;
    crop.label = "Crop";
    
    const char* cropRatios[] = {"Default", "16:9", "4:3", "16:10", "1.85:1", "2.21:1", "2.35:1", "2.39:1", "5:3", "5:4", "1:1"};
    for (const char* cr : cropRatios) {
        MenuItem crItem;
        crItem.label = cr;
        crItem.action = std::string("crop_") + cr;
        crItem.enabled = true;
        crop.submenu.push_back(crItem);
    }
    videoMenu.submenu.push_back(crop);
    
    // Scale
    MenuItem scale;
    scale.label = "Scale";
    scale.action = "scale";
    scale.shortcut = "Z";
    videoMenu.submenu.push_back(scale);
    
    // Deinterlace
    MenuItem deinterlace;
    deinterlace.label = "Deinterlace";
    
    const char* deinterlaceModes[] = {"Off", "Blend", "Discard", "Linear", "Mean", "Bob", "Yadif", "Yadif (2x)"};
    for (const char* mode : deinterlaceModes) {
        MenuItem modeItem;
        modeItem.label = mode;
        modeItem.action = std::string("deinterlace_") + mode;
        modeItem.enabled = true;
        deinterlace.submenu.push_back(modeItem);
    }
    videoMenu.submenu.push_back(deinterlace);
    
    menu.push_back(videoMenu);
    
    return menu;
}
