Linux VLC SDK Setup
====================

Linux uses system-installed VLC libraries.
Install the development packages:

Ubuntu/Debian:
  sudo apt install libvlc-dev vlc

Fedora:
  sudo dnf install vlc-devel vlc

Arch Linux:
  sudo pacman -S vlc

The binding.gyp is configured to use system headers from /usr/include/vlc
and link against the system libvlc.
