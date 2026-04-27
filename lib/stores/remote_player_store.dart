import 'package:flutter/foundation.dart';
import '../p2p/models/client_event.dart';

/// Server-mode mirror store. Reflects a remote client's player state
/// via incoming client_event messages. Does NOT drive a local player —
/// all state here is driven exclusively by what the client sends.
///
/// Mirrors: apps/desktop/src/stores/p2pPlayerStore.ts
class RemotePlayerStore extends ChangeNotifier {
  // --- State ---
  String playerState = 'idle';
  double time = 0;
  double duration = 0;
  double position = 0;
  double buffering = 0;
  double volume = 100;
  bool isMuted = false;
  bool? noAudio; // true when client reports volume < 0 (no audio output)
  double rate = 1.0;
  bool isSeekable = false;
  String? error;
  String? currentUrl; // resolved by UniversalPlayerStore via findByUrl

  List<VlcTrack> audioTracks = [];
  List<VlcTrack> subtitleTracks = [];
  List<VlcTrack> videoTracks = [];
  int currentAudioTrack = -1;
  int currentSubtitleTrack = -1;
  int currentVideoTrack = -1;

  // ---------------------------------------------------------------------------
  // Apply incoming client_event — mirrors p2pPlayerStore._handleRemoteVlcEvent
  // Side-effect free: no watch progress, no track prefs, no sticky setup.
  // ---------------------------------------------------------------------------

  void applyClientEvent(ClientEventData event) {
    bool changed = false;

    if (event.mediaInfo != null) {
      final info = event.mediaInfo!;
      audioTracks = info.audioTracks;
      subtitleTracks = info.subtitleTracks;
      videoTracks = info.videoTracks;
      duration = info.duration;
      isSeekable = info.isSeekable;
      if (info.url != null) currentUrl = info.url;
      changed = true;
    }

    if (event.playerInfo != null) {
      final pi = event.playerInfo!;

      if (pi.volume != null) {
        if (pi.volume! < 0) {
          noAudio = true;
        } else {
          noAudio = false;
          volume = pi.volume!;
          if (pi.muted != null) isMuted = pi.muted!;
        }
      } else if (pi.muted != null && noAudio != true) {
        isMuted = pi.muted!;
      }

      if (pi.rate != null) rate = pi.rate!;
      changed = true;
    }

    if (event.currentVideo != null) {
      final cv = event.currentVideo!;

      if (cv.time != null) time = cv.time!;
      if (cv.position != null) position = cv.position!;
      if (cv.buffering != null) buffering = cv.buffering!;
      if (cv.length != null) duration = cv.length!;
      if (cv.isSeekable != null) isSeekable = cv.isSeekable!;

      if (cv.state != null) {
        playerState = cv.state!;
        if (cv.state == 'stopped') noAudio = null;
      }

      if (cv.endReached == true) playerState = 'ended';

      if (cv.error != null) {
        error = cv.error;
        playerState = 'error';
      }

      if (cv.audioTrack != null) currentAudioTrack = cv.audioTrack!;
      if (cv.subtitleTrack != null) currentSubtitleTrack = cv.subtitleTrack!;
      if (cv.videoTrack != null) currentVideoTrack = cv.videoTrack!;

      changed = true;
    }

    if (changed) notifyListeners();
  }

  void reset() {
    playerState = 'idle';
    time = 0;
    duration = 0;
    position = 0;
    buffering = 0;
    volume = 100;
    isMuted = false;
    noAudio = null;
    rate = 1.0;
    isSeekable = false;
    error = null;
    currentUrl = null;
    audioTracks = [];
    subtitleTracks = [];
    videoTracks = [];
    currentAudioTrack = -1;
    currentSubtitleTrack = -1;
    currentVideoTrack = -1;
    notifyListeners();
  }
}
