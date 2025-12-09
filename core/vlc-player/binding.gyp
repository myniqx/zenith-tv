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
        "src/vlc_context_menu_actions.cpp",
        "src/os/window_base.cpp",
        "src/os/base_osd.cpp"
      ],
      "include_dirs": [
        "node_modules/node-addon-api"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "RuntimeLibrary": 3,
          "MultiProcessorCompilation": "true",
          "AdditionalOptions": ["/MP"]
        }
      },
      "configurations": {
        "Debug": {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "RuntimeLibrary": 3,
              "Optimization": 0,
              "MinimalRebuild": "false",
              "OmitFramePointers": "false",
              "BasicRuntimeChecks": 3
            },
            "VCLinkerTool": {
              "LinkIncremental": 2,
              "GenerateDebugInformation": "true"
            }
          },
          "defines": ["DEBUG", "_DEBUG"]
        },
        "Release": {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "RuntimeLibrary": 2,
              "Optimization": 3,
              "FavorSizeOrSpeed": 1,
              "InlineFunctionExpansion": 2,
              "WholeProgramOptimization": "true",
              "OmitFramePointers": "true",
              "EnableFunctionLevelLinking": "true",
              "EnableIntrinsicFunctions": "true"
            },
            "VCLinkerTool": {
              "LinkTimeCodeGeneration": 1,
              "OptimizeReferences": 2,
              "EnableCOMDATFolding": 2,
              "LinkIncremental": 1,
              "GenerateDebugInformation": "false"
            }
          },
          "defines": ["NDEBUG"]
        }
      },
      "conditions": [
        [
          "OS=='win'",
          {
            "sources+": [
              "src/os/win32/window.cpp",
              "src/os/win32/osd.cpp"
            ]
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
              }
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
            "sources+": [
              "src/os/linux/window.cpp",
              "src/os/linux/context_menu.cpp",
              "src/os/linux/osd.cpp"
            ],
            "cflags_cc": ["-std=c++17"],
            "include_dirs": [
              "/usr/include/vlc",
              "/usr/include/freetype2"
            ],
            "libraries": [
              "-lvlc",
              "-lX11",
              "-lXft",
              "-lXrender",
              "-lXcomposite"
            ]
          }
        ],
        [
          "OS=='mac'",
          {
            "sources+": ["src/vlc_window_mac.cpp", "src/vlc_context_menu_mac.cpp"],
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
