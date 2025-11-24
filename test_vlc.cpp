#include <X11/Xlib.h>
#include <vlc/vlc.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main() {
    // 1. Initialize X11
    Display *d = XOpenDisplay(NULL);
    if (d == NULL) {
        fprintf(stderr, "Cannot open display\n");
        return 1;
    }
    int s = DefaultScreen(d);
    Window root = RootWindow(d, s);
    
    // Match vlc_window_linux.cpp window creation
    XSetWindowAttributes attrs;
    attrs.background_pixel = BlackPixel(d, s);
    attrs.border_pixel = WhitePixel(d, s);
    attrs.event_mask = ExposureMask | StructureNotifyMask | KeyPressMask;
    
    Window w = XCreateWindow(
        d, root, 
        10, 10, 800, 600, 
        1, 
        DefaultDepth(d, s), 
        InputOutput, 
        DefaultVisual(d, s),
        CWBackPixel | CWBorderPixel | CWEventMask, 
        &attrs
    );
    
    XMapWindow(d, w);
    XFlush(d);

    printf("Window created. ID: %lu\n", w);

    // 2. Initialize libVLC
    const char *args[] = {
        "-vv",
        "--vout=xcb_x11",
        "--no-video-title-show",
        "--osd",
        "--no-plugins-cache"
    };
    
    setenv("VLC_PLUGIN_PATH", "/usr/lib/x86_64-linux-gnu/vlc/plugins", 1);

    libvlc_instance_t *vlc = libvlc_new(sizeof(args) / sizeof(args[0]), args);
    if (!vlc) {
        fprintf(stderr, "Failed to create libvlc instance\n");
        return 1;
    }

    // 3. Create Media Player (Match vlc_player.cpp: new then set_media)
    libvlc_media_player_t *mp = libvlc_media_player_new(vlc);
    
    libvlc_media_t *m = libvlc_media_new_location(vlc, "http://vizyon.pw:8080/movie/merveokur/N328M8VJ/52581.mkv");
    libvlc_media_player_set_media(mp, m);
    libvlc_media_release(m);

    // 4. Set Window ID
    libvlc_media_player_set_xwindow(mp, w);

    // 5. Play
    libvlc_media_player_play(mp);

    // 6. Event Loop (REMOVED for testing)
    printf("Playing... Sleeping for 10 seconds (no event loop).\n");
    sleep(10);
    /*
    XEvent e;
    int running = 1;
    while (running) {
        XNextEvent(d, &e);
        if (e.type == KeyPress)
            running = 0;
    }
    */

    // 7. Cleanup
    libvlc_media_player_stop(mp);
    libvlc_media_player_release(mp);
    libvlc_release(vlc);
    XDestroyWindow(d, w);
    XCloseDisplay(d);

    return 0;
}
