{
  "targets": [
    {
      "target_name": "vlc_player",
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "sources": [
        "src/vlc_player.cpp",
        "src/vlc_callbacks.cpp",
        "src/vlc_playback.cpp",
        "src/vlc_audio.cpp",
        "src/vlc_video.cpp",
        "src/vlc_subtitle.cpp",
        "src/vlc_window.cpp",
        "src/vlc_info.cpp",
        "src/vlc_shortcuts.cpp",
        "src/vlc_vmem.cpp",
        "src/vlc_context_menu.cpp",
        "src/vlc_context_menu_actions.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        [
          "OS=='win'",
          {
            "sources": ["src/vlc_window_win32.cpp", "src/vlc_context_menu_win32.cpp"]
          }
        ],
        [
          "OS=='win' and target_arch=='arm64'",
          {
            "include_dirs": ["lib/win32-arm64/sdk/include"],
            "libraries": [
              "<(module_root_dir)/lib/win32-arm64/sdk/lib/libvlc.lib"
            ],
            "copies": [
              {
                "destination": "<(PRODUCT_DIR)",
                "files": [
                  "<(module_root_dir)/lib/win32-arm64/libvlc.dll",
                  "<(module_root_dir)/lib/win32-arm64/libvlccore.dll"
                ]
              }
            ]
          }
        ],
        [
          "OS=='win' and target_arch=='x64'",
          {
            "include_dirs": ["lib/win32/sdk/include"],
            "libraries": [
              "<(module_root_dir)/lib/win32/sdk/lib/libvlc.lib"
            ],
            "copies": [
              {
                "destination": "<(PRODUCT_DIR)",
                "files": [
                  "<(module_root_dir)/lib/win32/libvlc.dll",
                  "<(module_root_dir)/lib/win32/libvlccore.dll"
                ]
              },
            ]
          }
        ],
        [
          "OS=='win' and target_arch!='arm64' and target_arch!='x64'",
          {
            "include_dirs": ["lib/win32/sdk/include"],
            "libraries": [
              "<(module_root_dir)/lib/win32/sdk/lib/libvlc.lib"
            ],
            "copies": [
              {
                "destination": "<(PRODUCT_DIR)",
                "files": [
                  "<(module_root_dir)/lib/win32/libvlc.dll",
                  "<(module_root_dir)/lib/win32/libvlccore.dll"
                ]
              }
            ]
          }
        ],
        [
          "OS=='linux'",
          {
            "sources": ["src/vlc_window_linux.cpp", "src/vlc_context_menu_linux.cpp"],
            "cflags_cc": ["-std=c++17"],
            "include_dirs": ["/usr/include/vlc"],
            "libraries": ["-lvlc", "-lX11"]
          }
        ],
        [
          "OS=='mac'",
          {
            "sources": ["src/vlc_window_mac.cpp", "src/vlc_context_menu_mac.cpp"],
            "xcode_settings": {
              "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
              "CLANG_CXX_LIBRARY": "libc++",
              "MACOSX_DEPLOYMENT_TARGET": "10.15"
            },
            "include_dirs": [
              "/Applications/VLC.app/Contents/MacOS/include"
            ],
            "libraries": [
              "-L/Applications/VLC.app/Contents/MacOS/lib",
              "-lvlc"
            ]
          }
        ]
      ]
    }
  ]
}
