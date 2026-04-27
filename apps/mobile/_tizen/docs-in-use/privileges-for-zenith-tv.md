# Zenith TV - Tizen Privileges

Zenith TV IPTV uygulaması için gerekli Tizen privilege'ları:

## Kesinlikle Gerekli

### 1. Internet Access
```xml
<tizen:privilege name="http://tizen.org/privilege/internet"/>
```
- **Level**: Public
- **Privacy**: None
- **Neden**: M3U playlist dosyalarını URL'den çekmek ve IPTV stream'lerini oynatmak için internet erişimi şart.
- **Kullanım**: M3U fetch, video streaming, P2P WebSocket

### 2. File System Read
```xml
<tizen:privilege name="http://tizen.org/privilege/filesystem.read"/>
```
- **Level**: Public
- **Privacy**: None
- **Neden**: Cache edilmiş M3U dosyalarını ve kullanıcı verilerini okumak için.
- **Kullanım**: IndexedDB/File System API ile M3U cache okuma

### 3. File System Write
```xml
<tizen:privilege name="http://tizen.org/privilege/filesystem.write"/>
```
- **Level**: Public
- **Privacy**: None
- **Neden**: M3U dosyalarını cache'lemek, kullanıcı tercihlerini (favoriler, watch progress) kaydetmek için.
- **Kullanım**: IndexedDB/File System API ile M3U cache yazma, user data

### 4. TV Input Device
```xml
<tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
```
- **Level**: Public
- **Privacy**: None
- **Neden**: TV kumandası (D-pad, Enter, Back) tuşlarını yakalamak için.
- **Kullanım**: D-pad navigasyon, video player kontrolleri

## Opsiyonel / İleri Özellikler

### 5. Audio Volume (Deprecated since 5.0)
```xml
<tizen:privilege name="http://tizen.org/privilege/audiovolume"/>
```
veya
```xml
<tizen:privilege name="http://tizen.org/privilege/volume.set"/>
```
- **Level**: Public
- **Privacy**: None
- **Neden**: Video oynatıcıda ses seviyesini değiştirmek için.
- **Kullanım**: AVPlay volume control
- **Not**: tv.audio deprecated olduğu için volume.set kullan

### 6. Download (P2P için)
```xml
<tizen:privilege name="http://tizen.org/privilege/download"/>
```
- **Level**: Public
- **Privacy**: None
- **Neden**: Eğer P2P özelliğinde dosya indirme olacaksa.
- **Kullanım**: M3U dosyası background download

### 7. Application Launch
```xml
<tizen:privilege name="http://tizen.org/privilege/application.launch"/>
```
- **Level**: Public
- **Privacy**: None
- **Neden**: Eğer dışarıdan link açma özelliği eklenirse (örn: IMDB link).
- **Kullanım**: External app launch

### 8. Notification (İsteğe bağlı)
```xml
<tizen:privilege name="http://tizen.org/privilege/notification"/>
```
- **Level**: Public
- **Privacy**: None
- **Neden**: Kullanıcıya bildirim göstermek için (örn: M3U sync tamamlandı).
- **Kullanım**: Toast notifications, sync status

## Şu An İçin Gerekmeyenler

- **Power**: Ekranı karartma/açık tutma - Video player zaten bunu halleder
- **Bluetooth**: IPTV uygulaması için gerekli değil
- **Location**: Lokasyon bilgisine ihtiyaç yok
- **Contact/Calendar/Call**: Kişisel veri erişimi yok
- **Media Capture**: Kamera/mikrofon kullanmıyoruz
- **NFC**: NFC özelliği yok

## Önerilen config.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets"
        xmlns:tizen="http://tizen.org/ns/widgets"
        id="http://zenith-tv.app/tizen"
        version="1.0.0">
    <name>Zenith TV</name>

    <!-- Temel Privileges -->
    <tizen:privilege name="http://tizen.org/privilege/internet"/>
    <tizen:privilege name="http://tizen.org/privilege/filesystem.read"/>
    <tizen:privilege name="http://tizen.org/privilege/filesystem.write"/>
    <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>

    <!-- Video Player için -->
    <tizen:privilege name="http://tizen.org/privilege/volume.set"/>

    <!-- P2P ve Bildirimler için (opsiyonel) -->
    <tizen:privilege name="http://tizen.org/privilege/notification"/>
</widget>
```

## Privacy-Related Privileges

Yukarıdaki hiçbir privilege "Privacy-related" değil, yani kullanıcı izni gerektirmiyor.
Tizen 8.0+ ile Privacy Privilege Manager API'ları deprecated olacak.

## Notlar

1. Tüm privilege'lar **Public** seviyesinde - partner/platform sertifika gerekmez
2. Privacy-related privilege yok - runtime permission gerektirmez
3. Tizen 5.0+ için `tv.audio` yerine `volume.set` kullanılmalı
4. CSP (Content Security Policy) ayarlanmalı - `config.xml`'de mevcut
