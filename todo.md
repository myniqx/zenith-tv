# Zenith TV — Android / Flutter Todo

## Genel Prensipler

- Cihaz tipi (TV / tablet / phone) uygulama başlarken bir kez tespit edilir ve tüm UI buna göre şekillenir.
- TV ise: client-only P2P, D-pad layout, tam ekran oynatıcı.
- Tablet/phone ise: hem client hem server P2P, touch layout.
- Shared paket (TypeScript) referans alınır ama Dart'a port edilir. Mantık birebir aynı kalır.
- Video oynatma en son hedef. Ağ altyapısı önce kurulur, UI ve player sonra gelir.

---

## Step 1 — Flutter Proje Kurulumu

- [ ] Flutter SDK kur (stable channel)
- [ ] Android Studio veya VS Code + Flutter extension kur
- [ ] Android emülatör oluştur (Pixel tablet API 33+ ve Android TV API 33+)
- [ ] `apps/mobile/` altında Flutter projesi oluştur: `flutter create --org com.zenith --project-name zenith_tv .`
- [ ] `pubspec.yaml`'a minimum bağımlılıklar ekle:
  - `provider` veya `riverpod` — state management
  - `shared_preferences` — basit persist (Zustand persist karşılığı)
  - `web_socket_channel` — WebSocket client/server
  - `shelf` + `shelf_web_socket` — HTTP + WebSocket server (phone/tablet için)
  - `http` — subnet scan HTTP istekleri
  - `device_info_plus` — cihaz tipi tespiti
  - `network_info_plus` — local IP alma
- [ ] `android/app/src/main/AndroidManifest.xml` izinleri:
  - `INTERNET`
  - `ACCESS_WIFI_STATE`
  - `ACCESS_NETWORK_STATE`
  - `CHANGE_WIFI_MULTICAST_STATE`

---

## Step 2 — Cihaz Tipi Tespiti

Referans: `apps/tizen/src/App.tsx` (TV kontrolü) + desktop'ta mode switching mantığı.

- [ ] `lib/core/device_type.dart` oluştur:
  - `DeviceType` enum: `tv`, `tablet`, `phone`
  - `DeviceTypeDetector.detect()` — Android `UiModeManager` üzerinden TV tespiti, ekran boyutundan tablet/phone ayrımı
  - TV tespiti için native Android channel yaz (`android/app/src/main/kotlin/.../DeviceTypePlugin.kt`)
- [ ] `DeviceType` uygulama başlarken `main.dart`'ta tespit edilip global provider'a yazılır
- [ ] Test: emülatörde TV ve tablet modunu doğrula

---

## Step 3 — P2P Altyapısı — Ortak Tipler

Referans: `shared/content/src/types/p2p.ts`

- [ ] `lib/p2p/models/` oluştur:
  - `p2p_message.dart` — `P2PMessage<T>` generic class (type + payload)
  - `discovered_controller.dart` — `DiscoveredController` (deviceId, deviceName, ip, port, version)
  - `p2p_connection.dart` — `P2PConnection` (id, ip, deviceName)
  - `profile_sync_payload.dart` — `ProfileSyncPayload` (profile, request, m3uData, userData)
- [ ] Tüm modeller JSON serialize/deserialize destekler (`fromJson` / `toJson`)
- [ ] Mesaj tipleri sabitleri: `open`, `playback`, `audio`, `video`, `subtitle`, `window`, `shortcut`, `state_update`, `profile_sync`

---

## Step 4 — HTTP Discovery (Client tarafı)

Referans: `shared/content/src/utils/httpDiscovery.ts`

- [ ] `lib/p2p/discovery/http_discovery_service.dart` oluştur:
  - `getLocalIP()` — `network_info_plus` ile WiFi IP al
  - `scan()` — subnet `/24` üzerinde 254 adrese paralel HTTP isteği (`http://ip:8080/api/discover`)
  - Her istek 300ms timeout, `role === 'controller'` kontrolü
  - `stopScan()` — devam eden taramayı iptal et
- [ ] `Isolate` veya `compute()` ile arka planda çalıştır, UI thread'i bloklamaz
- [ ] Test: desktop uygulaması açıkken emülatörden tarama yap, desktop'u bul

---

## Step 5 — WebSocket Client

Referans: `apps/tizen/src/stores/p2pClientStore.ts`

- [ ] `lib/p2p/client/p2p_client.dart` oluştur:
  - `connect(ip, port)` — `web_socket_channel` ile bağlan
  - `disconnect()` — bağlantıyı kapat
  - `sendMessage(P2PMessage)` — JSON serialize edip gönder
  - `messageStream` — gelen mesajları `Stream<P2PMessage>` olarak yayar
  - `onClose` / `onError` callback'leri
- [ ] `lib/p2p/client/p2p_client_store.dart` oluştur (Riverpod `StateNotifier` veya `ChangeNotifier`):
  - `connectionStatus`: disconnected / connecting / connected / error
  - `trustedServers` listesi — `shared_preferences`'a persist edilir
  - `discoveredServers` listesi
  - `currentServer`
  - `scan()`, `connect()`, `disconnect()`, `sendMessage()`
  - `autoConnect` — uygulama açılışında trusted server varsa otomatik bağlan
  - `lastReceivedMessage` — gelen son mesaj, listener'lar bunu izler
- [ ] Test: desktop'a bağlan, `state_update` mesajı al ve logla

---

## Step 6 — WebSocket Server (phone/tablet only)

Referans: `apps/desktop/electron/ipc/p2pServer.ts`

- [ ] TV ise bu adım atlanır (Step 2'deki `DeviceType` kontrolü)
- [ ] `lib/p2p/server/p2p_server.dart` oluştur:
  - `shelf` + `shelf_web_socket` ile HTTP + WebSocket server aynı port (8080)
  - `GET /api/discover` endpoint — `{ deviceId, deviceName, port, version, role: 'controller' }` döner
  - WebSocket bağlantı yönetimi — bağlanan client'lara connectionId ata
  - `send(connectionId, message)`, `broadcast(message)`
  - `onConnection`, `onMessage`, `onDisconnection` callback'leri
- [ ] `lib/p2p/server/p2p_server_store.dart`:
  - `startServer(port)`, `stopServer()`
  - `connections` listesi
  - `selectedDeviceId` — komut gönderilecek aktif client
  - Bağlanan ilk client otomatik `selectedDeviceId` olarak seçilir
- [ ] Android Foreground Service ekle — server arka plana geçince ayakta kalır:
  - `android/app/src/main/kotlin/.../P2PForegroundService.kt`
  - `flutter_foreground_task` paketi ile Flutter tarafına bağla
- [ ] Test: emülatörden desktop'a bağlantıyı kabul et, desktop üzerinden komut gönder

---

## Step 7 — P2P Manager (mesaj yönlendirme)

Referans: `apps/tizen/src/components/P2P/P2PManager.tsx` + `apps/desktop/src/components/P2P/P2PManager.tsx`

- [ ] `lib/p2p/p2p_manager.dart` oluştur — uygulama yaşam döngüsüne bağlı singleton servis:
  - Client modda: gelen mesajları player store'a yönlendir (`open`, `playback`, `audio`, `subtitle`, `window`, `shortcut`)
  - Client modda: player state'i 2 saniyede bir `state_update` olarak gönder
  - Server modda (phone/tablet): gelen `state_update`'i remote player store'a yaz
  - `profile_sync` akışı:
    - `profile` geldi → profil oluştur / seç
    - M3U yoksa `request: 'full'` gönder
    - `m3uData` geldi → diske yaz, içeriği yükle
    - `userData` geldi → `mergeUserData` uygula, merge sonucunu geri gönder
- [ ] `mergeUserData` Dart'a port et: `lib/p2p/utils/merge_user_data.dart`
  - Referans: `shared/content/src/utils/mergeUserData.ts` — birebir aynı mantık, timestamp bazlı

---

## Step 8 — P2P UI

Referans: `apps/tizen/src/components/P2P/P2PView.tsx`

- [ ] `lib/ui/p2p/p2p_screen.dart`:
  - Bağlantı durumu göstergesi
  - Bulunan cihazlar listesi + "Tara" butonu
  - Manuel IP girişi + bağlan
  - Trusted server listesi (autoConnect toggle, unut butonu)
  - TV layout ve touch layout ayrı widget — `DeviceType`'a göre seçilir
- [ ] TV layout: büyük kartlar, D-pad navigasyon (`FocusTraversalGroup`)
- [ ] Test: discovery, bağlantı, bağlantı kesme uçtan uca çalışıyor

---

## Step 9 — Uygulama Kabuğu

Referans: `apps/tizen/src/App.tsx` + `apps/desktop/src/App.tsx`

- [ ] `lib/ui/shell/app_shell.dart`:
  - TV: Tizen Header benzeri yatay menü (P2P, Ayarlar, Profil, Çıkış) + içerik alanı
  - Tablet/Phone: Bottom navigation veya drawer
- [ ] `DeviceType`'a göre doğru shell seçilir
- [ ] Ekranlar: P2P (Step 8), Profil (sonra), Ayarlar (sonra), İçerik (sonra)
- [ ] Back butonu yönetimi — TV'de Android back tuşu üst menüye döner

---

## Step 10 — Entegrasyon Testi

- [ ] Desktop (server modu) + Android TV emülatörü (client) — komut akışı uçtan uca
- [ ] Desktop (server modu) + Android phone (client) — aynı test
- [ ] Android phone (server modu) + Android TV emülatörü (client) — phone'dan TV'yi kontrol
- [ ] Profile sync akışı: desktop'ta profil var, Android'e bağlan, M3U ve userData senkronize oldu mu
- [ ] Bağlantı kopunca otomatik yeniden bağlanma

---

## Sonraki Aşamalar (bu todo dışında)

- M3U fetch ve Dart parser (Rust FFI sonraya)
- ContentBrowser UI (TV ve touch layout)
- media_kit entegrasyonu ve oynatma
- Rust FFI ile parser performans optimizasyonu
- SharedPreferences yerine dosya tabanlı storage (desktop/tizen ile aynı mantık)
- Google Play Store paketleme
