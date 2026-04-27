# P2P Sistem Raporu — Flutter Mobile

> Tarih: 2026-04-27  
> Dal: flutter-desktop  
> Kapsam: `lib/p2p/`, `lib/components/p2p/`, `lib/stores/`, `lib/main.dart`

---

> **Tasarım Kararları (Kullanıcı Notu)**
>
> - **Off:** Kontroller doğrudan local MediaPlayer'a gider.
> - **Server:** Kontroller seçili client'a WebSocket üzerinden gider, local player kullanılmaz.
> - **Client:** Hem kendi local player'ını yönetir (off gibi), hem P2P'den gelen komutları local player'a uygular, hem de local player'dan gelen event'leri sunucuya yayınlar.
> - **Cihaz rolleri sabittir:** Telefon = sadece Server, TV = sadece Client, Tablet = her ikisi.
> - **Tablet mod geçişi** store'lar üzerinden yapılıyor (server çalışıyorsa önce durdur, sonra client'a geç). `UniversalPlayerStore` burada güncellenmesi bekleniyor ama bağlantı eksik.
> - **Telefon startup:** Ayarlarda "sunucuyu otomatik başlat" seçeneği olmalı. Açık bırakıldıysa uygulama açılışında da başlatılmalı, trusted client gelince izin verilmeli.
> - **TV startup:** Ayarlarda "otomatik bağlan" seçeneği olmalı. Açılışta periyodik tarama yapılarak daha önce bağlanılmış server bulununca otomatik bağlanmalı.

## 1. Dosya Haritası — Ne İşe Yarar

### 1.1 `lib/p2p/` — Çekirdek P2P Katmanı

```
lib/p2p/
├── p2p_manager.dart              ← Merkezi mesaj yönlendirici (orkestratör)
│
├── client/
│   ├── p2p_client.dart           ← Düşük seviye WebSocket istemcisi
│   ├── p2p_client_store.dart     ← İstemci durum yöneticisi (ChangeNotifier)
│   └── trusted_server.dart       ← Güvenilir sunucu modeli + SharedPreferences kalıcılığı
│
├── server/
│   ├── p2p_server.dart           ← HTTP + WebSocket sunucusu (shelf tabanlı)
│   └── p2p_server_store.dart     ← Sunucu durum yöneticisi (ChangeNotifier)
│
├── discovery/
│   ├── http_discovery_service.dart ← /24 subnet taraması (Isolate'te çalışır)
│   └── network_info.dart          ← Yerel IP tespiti (dart:io NetworkInterface)
│
├── models/
│   ├── p2p_message.dart          ← Mesaj zarfı + P2PMessageType sabitleri
│   ├── p2p_connection.dart       ← Aktif bağlantı modeli (id, ip, handshake durumu)
│   ├── client_event.dart         ← Oynatıcı → sunucu durum bildirimi (ClientEventData)
│   ├── player_commands.dart      ← Sunucu → oynatıcı komut payload'ları
│   ├── profile_sync_payload.dart ← Profil senkronizasyon zarfı
│   ├── discovered_controller.dart← HTTP taramasında bulunan sunucu modeli
│   └── index.dart                ← Tüm modelleri tek noktadan dışa aktarır
│
└── utils/
    └── merge_user_data.dart      ← Zaman damgası tabanlı userData birleştirme
```

### 1.2 `lib/components/p2p/` — UI Katmanı

```
lib/components/p2p/
├── p2p_panel.dart                ← Cihaz tipine göre hangi panel gösterileceğine karar verir
├── shared/
│   ├── client_section.dart       ← İstemci modu UI: keşif, bağlantı listesi, manuel bağlantı
│   └── server_section.dart       ← Sunucu modu UI: başlat/durdur, bağlı cihazlar, güven yönetimi
├── phone/
│   └── p2p_panel_phone.dart      ← Telefon: sadece ServerSection gösterir
├── tablet/
│   └── p2p_panel_tablet.dart     ← Tablet: Off/Server/Client mod seçici + ilgili section
└── tv/
    └── p2p_panel_tv.dart         ← TV: sadece ClientSection gösterir
```

### 1.3 `lib/stores/` — Uygulama Store'ları

```
lib/stores/
├── zenith_store.dart             ← UI'ya özel geçici durum (P2PUIMode: off/server/client)
├── universal_player_store.dart   ← Oynatıcı facade'ı — hangi backend'i kullanacağına karar verir
├── media_player_store.dart       ← Yerel oynatıcı (media_kit / ExoPlayer)
├── remote_player_store.dart      ← Uzak oynatıcı aynası (client_event ile beslenir)
├── settings_store.dart           ← Uygulama ayarları (SharedPreferences)
├── content_store.dart            ← İçerik yönetimi (gruplar, M3U)
└── profile_store.dart            ← Profil yönetimi
```

---

## 2. Sistem Nasıl Çalışıyor — Bağlantı Şeması

### 2.1 Katman Mimarisi

```
┌─────────────────────────────────────────────────────────┐
│  UI Katmanı                                             │
│  P2PPanel → [Phone: Server] [Tablet: Off/Server/Client] │
│             [TV: Client]                                │
└────────────┬────────────────────────────────────────────┘
             │ context.watch / Provider
┌────────────▼────────────────────────────────────────────┐
│  Store Katmanı                                          │
│  P2PClientStore ◄──────────────────► P2PServerStore    │
│       │                                      │         │
│       └──────────► P2PManager ◄──────────────┘         │
│                        │                               │
│                 UniversalPlayerStore                    │
│                 ┌──────┴───────┐                       │
│           MediaPlayerStore  RemotePlayerStore           │
└─────────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────┐
│  Ağ Katmanı                                             │
│  P2PClient (WebSocket)    P2PServer (shelf HTTP+WS)     │
│  HttpDiscoveryService     NetworkInfo                   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Client Modu Akışı (Telefon/Tablet video oynatır, uzaktan kontrol edilir)

```
Desktop/Sunucu cihaz
    │
    │ WebSocket: handshake_request
    ▼
P2PClient.connect() → P2PClientStore
    │
    │ P2PManager._setupClientListeners()
    ▼
handshake_request alınır → handshake_response gönderilir
    │
    │ Bağlantı kuruldu → P2PManager._startBroadcast()
    ▼
Timer(500ms): getPlayerState() → client_event → sunucuya
    │
    │ Sunucudan komut gelirse:
    ▼
open/playback/audio/subtitle/window/shortcut
    │ → onPlayerCommand(type, payload)
    │ → main.dart'ta switch/case → MediaPlayerStore
    ▼
Video oynatılır / kontrol edilir
```

### 2.3 Server Modu Akışı (Telefon/Tablet uzaktan kumanda olarak çalışır)

```
P2PServer.start() → HTTP + WebSocket dinlemeye başlar
    │
    │ Yeni bağlantı gelince:
    ▼
P2PServer._handleWebSocket() → handshake_request gönderilir
    │                        → 15sn timer başlar
    │
    │ handshake_response alınır:
    ▼
P2PServerStore.updateHandshake() → handshake tamamlandı
    │
    │ Cihaz zaten güvenilir mi?
    ├── Evet → _sendWelcome() → profile_sync gönderilir
    └── Hayır → UI'da "Trust This Device" butonu gösterilir
                → Kullanıcı tıklarsa trustClient() → onTrusted callback
                → _sendWelcome() → profile_sync gönderilir
    │
    │ Bağlı cihazdan client_event gelirse:
    ▼
onRemoteStateUpdate → RemotePlayerStore.applyClientEvent()
    │
    │ Kullanıcı UI'dan komut verirse:
    ▼
UniversalPlayerStore.sendP2PCommand → serverStore.broadcast()
    → Tüm bağlı istemcilere gönderilir
```

### 2.4 Handshake Akışı

```
Sunucu                              İstemci
  │── handshake_request ──────────►  │
  │                                  │── handshake_response ──► │
  │                                  │   {deviceId, deviceName} │
  │ Güvenilir mi?                     │
  ├── Evet: timer iptal, welcome gönder
  └── Hayır: UI "Trust" butonu
  │── profile_sync (welcome) ──────►  │
  │                                  │── profile_sync (reply) ──► │
```

### 2.5 Profile Sync Akışı

```
Sunucu (Server) → profile_sync {profile, userData} → İstemci (Client)

İstemci:
  1. profile.username ile profil yoksa oluştur
  2. M3U URL'ini profile'a ekle
  3. M3U daha önce hiç yüklenmemiş mi? → reply: {request: 'full'}
  4. userData gelirse → mergeAndSaveUserData → reply: {userData: merged}

Sunucu: reply: {request: 'full'} alırsa → M3U raw içeriğini gönder  [STUB]
```

### 2.6 Discovery (Ağ Keşfi) Akışı

```
P2PClientStore.scan()
    │
    ▼
NetworkInfo.getLocalIp() → örn: "192.168.1.42"
    │
    ▼
HttpDiscoveryService.scan("192.168.1.42")
    │
    ▼ Isolate'te paralel tarama (254 host, 300ms timeout)
GET http://192.168.1.{1..254}:8080/api/discover
    │
    ▼ role == 'controller' olan cevaplar filtrelenir
List<DiscoveredController> → P2PClientStore._discoveredServers
    │
    ▼ autoConnect && trustedServer.autoConnect?
P2PClientStore.connect(discovered)
```

---

## 3. Dosyalar Arası Bağımlılık Grafiği

```
main.dart
  ├── P2PManager            (orkestratör — tüm callback'leri burada bağlar)
  ├── P2PClientStore        ──► P2PClient (WebSocket)
  │                         ──► HttpDiscoveryService (Isolate scan)
  │                         ──► TrustedServer (SharedPreferences)
  ├── P2PServerStore        ──► P2PServer (shelf HTTP+WS)
  ├── UniversalPlayerStore  ──► MediaPlayerStore (local)
  │                         ──► RemotePlayerStore (mirror)
  └── ContentStore, ProfileStore, SettingsStore

P2PManager
  ├── P2PClientStore.messageStream  (client mesajları dinlenir)
  ├── P2PServerStore.messageStream  (server mesajları dinlenir)
  ├── P2PClientStore.addListener    (bağlantı durumu → broadcast timer)
  ├── onPlayerCommand               (→ main.dart → MediaPlayerStore)
  ├── getPlayerState                (← main.dart ← UniversalPlayerStore)
  ├── onRemoteStateUpdate           (→ main.dart → UniversalPlayerStore.applyClientEvent)
  ├── onProfileSync                 (→ main.dart → _handleProfileSync)
  └── onClientConnected             (→ main.dart → ContentStore.getWelcomePayload)

P2PPanel
  ├── [phone]  → P2PPanelPhone  → ServerSection → P2PServerStore
  ├── [tablet] → P2PPanelTablet → ZenithStore (mod seçici)
  │                             → ServerSection / ClientSection
  └── [tv]    → P2PPanelTv    → ClientSection  → P2PClientStore

ServerSection
  └── server.trustClient(id) → P2PServerStore.onTrusted
                             → main.dart: _p2pManager.sendWelcomeToConnection(id)

ClientSection
  └── store.connect(discovered) → P2PClientStore → P2PClient.connect()
```

---

## 4. P2P Mesaj Protokolü (Özet)

| Mesaj Tipi         | Yön                   | İşlev                                              |
|--------------------|-----------------------|----------------------------------------------------|
| `handshake_request`  | Sunucu → İstemci    | "Kimsiniz?" sorusu — bağlantıda ilk gönderilir     |
| `handshake_response` | İstemci → Sunucu    | Kimlik yanıtı (deviceId, deviceName)               |
| `open`               | Sunucu → İstemci    | URL aç ve oynat                                    |
| `playback`           | Sunucu → İstemci    | play/pause/stop/seek/rate                          |
| `audio`              | Sunucu → İstemci    | ses, mute, ses parçası                             |
| `subtitle`           | Sunucu → İstemci    | altyazı parçası                                    |
| `video`              | Sunucu → İstemci    | video parçası, scale, aspect ratio                 |
| `window`             | Sunucu → İstemci    | ekran modu                                         |
| `shortcut`           | Sunucu → İstemci    | klavye kısayolu eylemi                             |
| `state_request`      | Sunucu → İstemci    | anlık durum isteği                                 |
| `client_event`       | İstemci → Sunucu    | oynatıcı durumu bildirimi (500ms'de bir)           |
| `profile_sync`       | Çift yönlü          | profil / M3U / userData senkronizasyonu            |

---

## 5. Eksiklikler ve Sorunlar

### 5.1 KRİTİK — `UniversalPlayerStore.mode` hiç güncellemiyor (yalnızca server modu için geçerli)

**Sorun:** `UniversalPlayerStore`'da `P2PMode` enum'u (off/client/server) var ama `main.dart`'ta `setMode()` **hiç çağrılmıyor**.

Client modda `setMode()` gerekmez — client modda `UniversalPlayerStore` zaten local player'ı kullanmalı (off ile aynı davranış), P2PManager komutları doğrudan `MediaPlayerStore`'a zaten yönlendiriyor. **Dolayısıyla client modu için bu eksiklik işlevsel bir sorun yaratmıyor.**

Server modu için ise kritik: `_isServerMode` her zaman `false` döndüğü için:
- UI'dan verilen play/audio/subtitle komutları P2P üzerinden değil, local `MediaPlayerStore`'a gidiyor.
- `sendP2PCommand` callback'i wire edilmiş ama `_isServerMode == false` olduğu için hiç çağrılmıyor.
- Tablet "Server" moduna geçip içerik tıklansa bile bağlı TV/client'a hiçbir şey gitmiyor.

**Nerede:** `main.dart` → `_AppInitializerState._init()`

**Çözüm:** `P2PServerStore`'a listener ekle: `isRunning` true olduğunda `universalPlayer.setMode(P2PMode.server)`, false olduğunda `universalPlayer.setMode(P2PMode.off)` çağır. Client modu için `setMode` gerekmez.

---

### 5.2 — Telefon cihazı client moduna geçemiyor (KASITLI TASARIM KARARI)

`DeviceTypeDetector`: `phone → canBeClient: false`, `tv → canBeClient: true`, `tablet → canBeClient: true`.  
Bu kısıtlama bilinçli: telefon yalnızca uzaktan kumanda (server), TV/tablet yalnızca veya ayrıca oynatıcı (client).  
**Sorun yok, değiştirilmeyecek.**

---

### 5.3 ORTA — Server modda `broadcast` yerine `selectedDevice`'a gönderilmeli

**Sorun:** `main.dart:277`:
```dart
universalPlayer.sendP2PCommand = (type, payload) {
  serverStore.broadcast(P2PMessage(type: type, payload: payload));
};
```

`broadcast()` tüm bağlı istemcilere gönderir. Oysa sunucuya birden fazla cihaz bağlanabilir (örn. Tizen TV + bir tablet). Seçili cihaza gitmesi gerekirken herkese gidiyor.

`P2PServerStore.sendToSelected()` metodu zaten var ve `selectedDeviceId` de tutuluyor — ama kullanılmıyor.

---

### 5.4 ~~ORTA~~ TAMAMLANDI — Profile sync `request: 'full'`

**Sorun:** `main.dart:344–352`:
```dart
if (payload.request == 'full') {
  // M3U raw data would need to be read from cache — stub for now
  // Referans implementasyon: apps/desktop/src/components/P2P/P2PManager.tsx L155–L199
  return;
}
```

İstemci "M3U'yu gönder" dediğinde sunucu hiçbir şey göndermeden `return` yapıyor.

**Etki:** İlk kez bağlanan yeni cihaz profil bilgisini alıyor, M3U listesini alamıyor. İçerik listesi boş kalıyor.

---

### 5.5 ORTA — `P2PManager` client dinleyicisi için `addListener` / `removeListener` uyumsuzluğu

**Sorun:** `P2PManager._setupClientListeners()` metodunda:
```dart
client.addListener(_onClientStatusChanged);
```

Ama `P2PManager.dispose()` içinde bu listener kaldırılmıyor:
```dart
void dispose() {
  _clientMessageSub?.cancel();
  _serverMessageSub?.cancel();
  _broadcastTimer?.cancel();
  // client.removeListener(_onClientStatusChanged) ← EKSİK
}
```

**Etki:** `P2PManager` dispose edilirse (sıcak yeniden yükleme veya widget ağacı yeniden inşası) listener sızıntısı oluşur, broadcast timer durması gerekirken çalışmaya devam edebilir.

---

### 5.6 DÜŞÜK — `P2PServer.deviceId` her uygulama başlatmasında yeniden üretiliyor

**Sorun:** `P2PServer` constructor'ında `deviceId = _generateDeviceId()` çağrılıyor. Bu, her `startServer()` çağrısında (her uygulama başlatmasında) yeni bir `deviceId` üretildiği anlamına gelir.

**Etki:** İstemci cihazlar sunucuyu `deviceId` ile güvenilir listesine ekliyor (`TrustedClient`). Sunucu yeniden başlatılınca `deviceId` değiştiği için istemci tarafında aynı cihaz artık "güvenilmez" görünüyor, Trust akışı tekrar gerekiyor.

**Çözüm:** `deviceId` SharedPreferences'a kalıcı olarak kaydedilmeli.

---

### 5.7 DÜŞÜK — Handshake yanıtında `clientStore.trustedServers.firstOrNull?.deviceId`

**Sorun:** `p2p_manager.dart:103`:
```dart
'deviceId': clientStore?.trustedServers.firstOrNull?.deviceId ?? 'unknown',
```

Handshake yanıtında `deviceId` olarak güvenilir sunucu listesinin ilk elemanının `deviceId`'si kullanılıyor. Bu, mobil cihazın kendi kimliğini değil, daha önce bağlandığı sunucunun kimliğini gönderdiği anlamına gelir. Mantıksal olarak yanlış — istemci kendi `deviceId`'sini bildirmeli.

---

### 5.8 ~~DÜŞÜK~~ TAMAMLANDI — `_handleProfileSync` içinde `request: 'full'` stub'ı

**Sorun:** `ContentStore` M3U cache'ini zaten tutuyor, teknik engel yok — implementasyon eksik bırakılmış.  
Referans: `apps/desktop/src/components/P2P/P2PManager.tsx` L155–L199. (5.4 ile aynı madde, ayrıca gösterilmektedir.)

---

### 5.9 DÜŞÜK — `_onClientStatusChanged` sadece broadcast timer'ı yönetiyor

**Sorun:** `P2PManager._onClientStatusChanged()` bağlantı durumu değişince sadece broadcast timer'ı başlatıp durduruyor. `UniversalPlayerStore.setMode()` çağrılmıyor — ama 5.1'e göre client modu için `setMode` zaten gerekmez. Bu not yalnızca server modu için: server stop edildiğinde 5.1'deki listener `setMode(off)` yapmalı, bu metod bunu yapmıyor.

---

### 5.10 DÜŞÜK — Tablet mod geçişinde `UniversalPlayerStore.setMode()` çağrılmıyor

**Sorun:** `P2PPanelTablet._ModeSelector._select()` ZenithStore UI modunu güncelliyor ama `UniversalPlayerStore.setMode()` çağrılmıyor.  
**Not:** TODO-1 tamamlanınca `P2PServerStore` listener'ı bu durumu otomatik ele alır — tablet için ayrıca bir düzeltme gerekmeyebilir.

---

## 6. Genel Değerlendirme

Mimari sağlam tasarlanmış. Katmanlama doğru: ağ katmanı (P2PClient/P2PServer) → durum yönetimi (Store'lar) → orkestrasyon (P2PManager) → UI (component'lar) zinciri temiz ayrışmış. Model tipleri eksiksiz ve desktop/Tizen ile protokol uyumluluğu korunmuş.

Temel problem: `ZenithStore.P2PUIMode` (UI navigasyonu) ile `UniversalPlayerStore.P2PMode` (gerçek davranış) birbirine bağlı değil. Client modda bu bağlantı zaten gerekmiyor — local player doğru şekilde çalışıyor. **Server modda ise kritik:** sunucu başlatılınca `UniversalPlayerStore.setMode(server)` çağrılmadığı için UI'dan verilen tüm komutlar local player'a gidiyor, bağlı client'a hiçbir şey gitmiyor. Bunun yanı sıra startup otomasyonu (telefon için otomatik server başlatma, TV için otomatik bağlanma) henüz `SettingsStore`'a entegre edilmemiş.

---

## TODO

### Kritik (Server modu çalışmıyor)

- [ ] **TODO-1:** `main.dart` içinde `P2PServerStore`'a listener ekle.  
  `serverStore.isRunning == true` → `universalPlayer.setMode(P2PMode.server)`  
  `serverStore.isRunning == false` → `universalPlayer.setMode(P2PMode.off)`  
  *(Client modu için `setMode` gerekmez — client modda local player kullanımı zaten doğru.)*

- [ ] **TODO-2:** `main.dart` içinde `universalPlayer.sendP2PCommand` callback'ini `serverStore.broadcast()` yerine `serverStore.sendToSelected()` kullanacak şekilde değiştir.  
  Birden fazla client bağlı olduğunda komutlar seçili olana gitmeli, herkese değil.

### Orta (Önemli işlev eksikliği)

- [x] **TODO-3:** `main.dart._handleProfileSync` içindeki `request: 'full'` stub'ını gerçek implementasyonla doldur.  
  `ContentStore` üzerinden M3U cache içeriğini oku, `M3UDataSync` olarak reply ile gönder.  
  Referans: `apps/desktop/src/components/P2P/P2PManager.tsx` L155–L199.

- [ ] **TODO-4:** `P2PManager.dispose()` içine `clientStore?.removeListener(_onClientStatusChanged)` ekle. Listener sızıntısını engeller.

- [ ] **TODO-5 (YENİ):** `SettingsStore`'a `autoStartServer` (bool) flag'i ekle.  
  `main.dart` init'te: `settingsStore.autoStartServer == true` ise `serverStore.startServer()` çağır.  
  `P2PPanelPhone`'a bu ayarı açıp kapayan bir toggle ekle.

- [ ] **TODO-6 (YENİ):** `SettingsStore`'a `autoConnectClient` (bool) flag'i ekle.  
  `P2PClientStore.init()` zaten `autoConnect` var ama bu `SettingsStore`'a bağlı değil — sadece `P2PClientStore` içinde SharedPreferences'a yazılıyor.  
  TV layout için `P2PPanelTv`'ye (veya settings ekranına) bu toggle'ı ekle; `init()`'te `settingsStore.autoConnectClient` değeriyle `clientStore.setAutoConnect()` çağır.  
  Startup'ta periyodik tarama için: bağlantı kesilince belirli aralıklarla tekrar `scan()` çağrısı yapacak bir mekanizma ekle (örn. 30sn retry timer).

### Düşük (Kalite / doğruluk)

- [ ] **TODO-7:** `P2PServer.deviceId`'yi SharedPreferences'a kalıcı kaydet — her başlatmada yeniden üretilmesini engelle. Aksi hâlde client tarafında her yeniden başlatmada Trust akışı tekrar gerekiyor.

- [ ] **TODO-8:** `p2p_manager.dart:103` handshake yanıtındaki `deviceId`'yi düzelt.  
  Şu an `trustedServers.firstOrNull?.deviceId` kullanıyor — bu mobil cihazın kendi kimliği değil, bağlandığı sunucunun kimliği. Mobil cihaz kendi kalıcı `deviceId`'sini bildirmeli (TODO-7 ile birlikte çözülür: aynı kalıcı ID her iki taraf için de gerekli).
