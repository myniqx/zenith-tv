import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'core/device_type.dart';
import 'p2p/client/p2p_client_store.dart';
import 'p2p/server/p2p_server_store.dart';
import 'p2p/p2p_manager.dart';
import 'stores/profile_store.dart';
import 'stores/content_store.dart';
import 'ui/shell/app_shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

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
      ],
      child: Builder(builder: (context) {
        // Detect device type once layout is available
        final shortestSide = MediaQuery.of(context).size.shortestSide;
        DeviceTypeDetector.detect(shortestSide);

        return MaterialApp(
          title: 'Zenith TV',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorScheme: ColorScheme.dark(
              primary: const Color(0xFFEF4444),
              surface: const Color(0xFF0F172A),
            ),
            scaffoldBackgroundColor: const Color(0xFF0F172A),
            useMaterial3: true,
          ),
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
    final clientStore = context.read<P2PClientStore>();
    final serverStore = context.read<P2PServerStore>();

    await profileStore.init();
    await clientStore.init();

    _p2pManager = P2PManager(
      clientStore: clientStore,
      serverStore: DeviceTypeDetector.canBeServer ? serverStore : null,
      onPlayerCommand: (type, payload) {
        // TODO: route to video player store when content store is ready
        debugPrint('[P2PManager] Player command: $type payload: $payload');
      },
      getPlayerState: () {
        // TODO: return actual player state when video player is ready
        return {'playerState': 'idle'};
      },
      onRemoteStateUpdate: (state) {
        debugPrint('[P2PManager] Remote state update: $state');
      },
      onProfileSync: (payload, reply) async {
        // TODO: handle profile sync when content store is ready
        debugPrint('[P2PManager] Profile sync: $payload');
      },
    );

    _p2pManager!.init();

    if (mounted) setState(() => _initialized = true);
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
        backgroundColor: Color(0xFF0F172A),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFFEF4444)),
        ),
      );
    }

    return const AppShell();
  }
}
