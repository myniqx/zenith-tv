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
import 'stores/content_store.dart';
import 'stores/media_player_store.dart';
import 'stores/remote_player_store.dart';
import 'stores/universal_player_store.dart';
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
        DeviceTypeDetector.detect(shortestSide);

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
    final profileStore = context.read<ProfileStore>();
    final contentStore = context.read<ContentStore>();
    final clientStore = context.read<P2PClientStore>();
    final serverStore = context.read<P2PServerStore>();
    final playerStore = context.read<MediaPlayerStore>();
    final universalPlayer = context.read<UniversalPlayerStore>();

    await profileStore.init();
    await playerStore.init();
    await clientStore.init();

    _p2pManager = P2PManager(
      clientStore: DeviceTypeDetector.canBeClient ? clientStore : null,
      serverStore: DeviceTypeDetector.canBeServer ? serverStore : null,

      // Client mode: incoming commands → local player
      onPlayerCommand: (type, payload) {
        switch (type) {
          case 'open':
            final url = payload?['file'] as String?;
            if (url != null) playerStore.open(url);
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

    if (mounted) setState(() => _initialized = true);
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
