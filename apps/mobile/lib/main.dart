import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:media_kit/media_kit.dart';
import 'core/device_type.dart';
import 'core/app_theme.dart';
import 'p2p/client/p2p_client_store.dart';
import 'p2p/server/p2p_server_store.dart';
import 'p2p/p2p_manager.dart';
import 'stores/profile_store.dart';
import 'stores/settings_store.dart';
import 'stores/content_store.dart';
import 'stores/media_player_store.dart';
import 'stores/remote_player_store.dart';
import 'stores/universal_player_store.dart';
import 'stores/zenith_store.dart';
import 'p2p/models/index.dart';
import 'ui/shell/app_shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MediaKit.ensureInitialized();

  // Lock to landscape for TV experience
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
    DeviceOrientation.portraitUp,
  ]);

  runApp(const ZenithApp());
}

class ZenithApp extends StatelessWidget {
  const ZenithApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<DeviceTypeDetector>.value(value: DeviceTypeDetector.instance),
        ChangeNotifierProvider(create: (_) => SettingsStore()),
        ChangeNotifierProvider(create: (_) => ZenithStore()),
        ChangeNotifierProvider(create: (_) => ProfileStore()),
        ChangeNotifierProxyProvider<ProfileStore, ContentStore>(
          create: (ctx) => ContentStore(
            profileStore: ctx.read<ProfileStore>(),
          ),
          update: (_, profileStore, prev) =>
              prev ?? ContentStore(profileStore: profileStore),
        ),
        ChangeNotifierProvider(create: (_) => P2PClientStore()),
        ChangeNotifierProvider(create: (_) => P2PServerStore()),
        ChangeNotifierProvider(create: (_) => MediaPlayerStore()),
        ChangeNotifierProvider(create: (_) => RemotePlayerStore()),
        ChangeNotifierProxyProvider2<MediaPlayerStore, RemotePlayerStore,
            UniversalPlayerStore>(
          create: (ctx) => UniversalPlayerStore(
            localPlayer: ctx.read<MediaPlayerStore>(),
            remotePlayer: ctx.read<RemotePlayerStore>(),
          ),
          update: (_, local, remote, prev) =>
              prev ?? UniversalPlayerStore(localPlayer: local, remotePlayer: remote),
        ),
      ],
      child: Builder(builder: (context) {
        // Detect device type once layout is available
        final shortestSide = MediaQuery.of(context).size.shortestSide;
        DeviceTypeDetector.instance.detect(shortestSide);

        return MaterialApp(
          title: 'Zenith TV',
          debugShowCheckedModeBanner: false,
          theme: buildAppTheme(),
          home: const _AppInitializer(),
        );
      }),
    );
  }
}

/// Initializes stores on first frame, then shows AppShell.
class _AppInitializer extends StatefulWidget {
  const _AppInitializer();

  @override
  State<_AppInitializer> createState() => _AppInitializerState();
}

class _AppInitializerState extends State<_AppInitializer> {
  bool _initialized = false;
  P2PManager? _p2pManager;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final settingsStore = context.read<SettingsStore>();
    final profileStore = context.read<ProfileStore>();
    final contentStore = context.read<ContentStore>();
    final clientStore  = context.read<P2PClientStore>();
    final serverStore  = context.read<P2PServerStore>();
    final playerStore  = context.read<MediaPlayerStore>();
    final universalPlayer = context.read<UniversalPlayerStore>();

    await settingsStore.init();
    if (!settingsStore.rememberLayout) settingsStore.resetLayout();
    await profileStore.init();

    // Auto-load last profile on startup (all platforms)
    if (settingsStore.autoLoadLastProfile) {
      final username = settingsStore.lastProfileUsername;
      final uuid     = settingsStore.lastProfileUUID;
      if (username != null && uuid != null &&
          profileStore.getProfile(username) != null) {
        await contentStore.setContent(username, uuid);
      }
    }

    // Persist last profile whenever content changes (for autoLoadLastProfile)
    contentStore.addListener(() {
      final username = contentStore.currentUsername;
      final uuid     = contentStore.currentUUID;
      if (username != null && uuid != null) {
        settingsStore.setLastProfile(username, uuid);
      }
    });

    await playerStore.init();
    await clientStore.init();
    await serverStore.loadTrustedClients();

    // Wire track auto-selection when tracks load:
    // 1. userData.tracks (last manual selection) takes priority
    // 2. preferred language from settings
    // 3. first available track
    playerStore.onTracksReady = (audioTracks, subtitleTracks) {
      final item = playerStore.currentItem;
      final savedTracks = item?.userData.tracks;

      if (savedTracks != null) {
        // Restore previous manual track selection
        if (savedTracks.audio != null) {
          playerStore.audio(track: savedTracks.audio!);
        }
        if (savedTracks.subtitle != null) {
          playerStore.subtitle(track: savedTracks.subtitle!);
        }
      } else {
        _applyPreferredTracks(
          playerStore: playerStore,
          settingsStore: settingsStore,
          audioTracks: audioTracks,
          subtitleTracks: subtitleTracks,
        );
      }
    };

    // Seek to saved position on first play
    playerStore.onFirstPlay = () {
      final item = playerStore.currentItem;
      if (item == null) return;

      // Seek to saved position if available
      final progress = item.userData.watchProgress?.progress;
      if (progress != null && progress > 0 && progress < 0.95) {
        final seekTime = progress * playerStore.duration;
        if (seekTime > 0) playerStore.playback(time: seekTime);
      }

      // Save total duration if not yet known
      final durationMs = (playerStore.duration * 1000).round();
      if (durationMs > 0) contentStore.saveDuration(item, durationMs);
    };

    // Save watch progress on pause / stop / close
    playerStore.onSaveProgress = (time, duration) {
      final item = playerStore.currentItem;
      if (item != null) contentStore.saveWatchProgress(item, time, duration);
    };

    // Save manual track selection
    playerStore.onSaveTrackSelection = (audioTrack, subtitleTrack) {
      final item = playerStore.currentItem;
      if (item != null) {
        contentStore.saveTrackSelection(
          item,
          audioTrack: audioTrack >= 0 ? audioTrack : null,
          subtitleTrack: subtitleTrack >= 0 ? subtitleTrack : null,
        );
      }
    };

    _p2pManager = P2PManager(
      clientStore: DeviceTypeDetector.instance.canBeClient ? clientStore : null,
      serverStore: DeviceTypeDetector.instance.canBeServer ? serverStore : null,

      // Client mode: incoming commands → local player
      onPlayerCommand: (type, payload) {
        switch (type) {
          case 'open':
            final url = payload?['file'] as String?;
            if (url != null) {
              final item = contentStore.findByUrl(url);
              playerStore.open(url, item: item);
            }
          case 'playback':
            playerStore.playback(
              action: payload?['action'] as String?,
              time: (payload?['time'] as num?)?.toDouble(),
              position: (payload?['position'] as num?)?.toDouble(),
              rate: (payload?['rate'] as num?)?.toDouble(),
            );
          case 'audio':
            playerStore.audio(
              volume: (payload?['volume'] as num?)?.toDouble(),
              mute: payload?['mute'] as bool?,
              track: (payload?['track'] as num?)?.toInt(),
            );
          case 'subtitle':
            playerStore.subtitle(
              track: (payload?['track'] as num?)?.toInt(),
            );
        }
      },

      // Client mode: broadcast local player state to server
      getPlayerState: () => universalPlayer.getFullClientEvent().toJson(),

      // Server mode: incoming client_event → remote mirror store
      onRemoteStateUpdate: (state) {
        final event = ClientEventData.fromJson(state);
        universalPlayer.applyClientEvent(event);
      },

      // Profile sync (both modes)
      onProfileSync: (payload, reply) async {
        await _handleProfileSync(
          payload: payload,
          contentStore: contentStore,
          profileStore: profileStore,
          reply: reply,
        );
      },

      // Server mode: send welcome profile_sync to newly connected client
      onClientConnected: (_) {
        return contentStore.getWelcomePayload();
      },
    );

    _p2pManager!.init();

    // When a device is trusted via UI, send the welcome profile_sync
    serverStore.onTrusted = (connectionId) {
      _p2pManager!.sendWelcomeToConnection(connectionId);
    };

    // Wire server-mode P2P command dispatch into UniversalPlayerStore.
    // When mode==server, play/playback/audio/subtitle calls route here
    // instead of driving the local media_kit player.
    universalPlayer.sendP2PCommand = (type, payload) {
      serverStore.broadcast(P2PMessage(type: type, payload: payload));
    };

    if (mounted) setState(() => _initialized = true);
  }

  void _applyPreferredTracks({
    required MediaPlayerStore playerStore,
    required SettingsStore settingsStore,
    required List audioTracks,
    required List subtitleTracks,
  }) {
    bool matchTrack(String trackName, String language) =>
        trackName.toLowerCase().contains(language.toLowerCase());

    // Audio — try each preferred language in order, fall back to first track
    final audioPref = settingsStore.preferredAudioLanguages;
    if (audioPref.isNotEmpty && audioTracks.isNotEmpty) {
      int? selectedId;
      for (final lang in audioPref) {
        final match = audioTracks.firstWhere(
          (t) => matchTrack(t.name as String, lang),
          orElse: () => null,
        );
        if (match != null) {
          selectedId = match.id as int;
          break;
        }
      }
      // Fall back to first track if no preferred language matched
      selectedId ??= audioTracks.first.id as int;
      playerStore.audio(track: selectedId);
    } else if (audioTracks.isNotEmpty) {
      // No preference — select first track so audio plays
      playerStore.audio(track: audioTracks.first.id as int);
    }

    // Subtitle — only select if there's a preference match, otherwise disable
    final subPref = settingsStore.preferredSubtitleLanguages;
    if (subPref.isNotEmpty && subtitleTracks.isNotEmpty) {
      for (final lang in subPref) {
        final match = subtitleTracks.firstWhere(
          (t) => matchTrack(t.name as String, lang),
          orElse: () => null,
        );
        if (match != null) {
          playerStore.subtitle(track: match.id as int);
          return;
        }
      }
      // No match — disable subtitles
      playerStore.subtitle(track: -1);
    } else {
      // No preference — disable subtitles
      playerStore.subtitle(track: -1);
    }
  }

  Future<void> _handleProfileSync({
    required ProfileSyncPayload payload,
    required ContentStore contentStore,
    required ProfileStore profileStore,
    required void Function(P2PMessage) reply,
  }) async {
    // Server requested full M3U data
    if (payload.request == 'full') {
      final uuid = profileStore.m3uMap.values.firstOrNull;
      if (uuid == null) return;
      final url = profileStore.getUrlFromUUID(uuid);
      if (url == null) return;
      // M3U raw data would need to be read from cache — stub for now
      // since file reading from path_provider is async and context-dependent.
      // The content store syncM3UData path handles the reverse direction.
      return;
    }

    // Remote pushed profile info → create/select profile, request M3U if missing
    if (payload.profile != null) {
      final p = payload.profile!;
      final m3uExists = profileStore.getUUIDFromURL(p.url) != null;

      if (profileStore.getProfile(p.username) == null) {
        profileStore.createProfile(p.username);
      }
      final localUuid = profileStore.addM3UToProfile(p.username, p.url);
      await contentStore.setContent(p.username, localUuid);

      if (!m3uExists) {
        reply(P2PMessage(
          type: P2PMessageType.profileSync,
          payload: {'request': 'full'},
        ));
      }
    }

    // Remote pushed M3U data → write to cache and reload
    if (payload.m3uData != null) {
      final m3u = payload.m3uData!;
      final uuid = profileStore.getUUIDFromURL(m3u.source);
      if (uuid != null) {
        await contentStore.syncM3UData(uuid, m3u.source, m3u.update, m3u.stats);
      }
    }

    // Remote pushed userData → merge and send merged back
    if (payload.userData != null) {
      final merged = await contentStore.mergeAndSaveUserData(payload.userData!);
      reply(P2PMessage(
        type: P2PMessageType.profileSync,
        payload: {'userData': merged},
      ));
    }
  }

  @override
  void dispose() {
    _p2pManager?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized) {
      return const Scaffold(
        backgroundColor: ZColors.background,
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return const AppShell();
  }
}
