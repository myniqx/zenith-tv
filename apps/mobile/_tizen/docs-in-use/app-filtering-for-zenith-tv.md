# Zenith TV - Application Filtering

Uygulama filtreleme, uygulamanızın sadece uygun cihazlarda görünmesini sağlar.

## TV Profili Tanımlama (Zorunlu)

config.xml'de TV profilini belirtmek **zorunludur**:

```xml
<widget xmlns="http://www.w3.org/ns/widgets"
        xmlns:tizen="http://tizen.org/ns/widgets">
    <tizen:profile name="tv-samsung"/>
</widget>
```

## Feature-Based Filtering

Zenith TV için gerekli olan feature'lar:

### Zorunlu Feature'lar

```xml
<!-- TV Input Device - Kumanda kontrolü için -->
<tizen:feature name="http://tizen.org/feature/tv.inputdevice"/>

<!-- Internet - IPTV stream için -->
<tizen:feature name="http://tizen.org/feature/network.internet"/>
```

### Opsiyonel Feature'lar

```xml
<!-- TV Audio Control -->
<tizen:feature name="http://tizen.org/feature/tv.audio"/>

<!-- TV Display Control -->
<tizen:feature name="http://tizen.org/feature/tv.display"/>

<!-- External Storage - M3U dosyaları için -->
<tizen:feature name="http://tizen.org/feature/storage.external"/>

<!-- Display State -->
<tizen:feature name="http://tizen.org/feature/display.state"/>

<!-- Bluetooth (eğer P2P için kullanılacaksa) -->
<tizen:feature name="http://tizen.org/feature/network.bluetooth"/>
```

## Screen Size Filtering (TV için önerilmez)

TV uygulamaları için screen size filtering genelde kullanılmaz çünkü TV'ler responsive olmalı.

Ancak gerekirse:

```xml
<!-- Tüm ekran boyutlarını destekle -->
<tizen:feature name="http://tizen.org/feature/screen.size.all"/>
```

## Feature Hierarchy

Feature'lar hiyerarşiktir. Örneğin:

- `http://tizen.org/feature/network.bluetooth` tanımlarsanız → BLE, Classic Bluetooth vb. desteklenir
- `http://tizen.org/feature/network.bluetooth.le` tanımlarsanız → Sadece BLE desteklenir

**Zenith TV için öneri**: Genel feature'ları kullan, spesifik olma (örn: `network.bluetooth` kullan, `network.bluetooth.le` değil)

## Önemli Notlar

1. **AND Logic**: Birden fazla feature tanımlarsanız, cihaz **hepsini** desteklemeli (screen size hariç)
2. **Store Filtering**: Feature'lar tanımlanırsa, store sadece uyumlu cihazlara uygulamayı gösterir
3. **Runtime Check**: Runtime'da da feature kontrolü yapabilirsiniz:

```javascript
// Runtime feature check
tizen.systeminfo.getCapability('http://tizen.org/feature/tv.inputdevice')
```

## Zenith TV için Önerilen config.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets"
        xmlns:tizen="http://tizen.org/ns/widgets"
        id="http://zenith-tv.app/tizen"
        version="1.0.0">
    <name>Zenith TV</name>

    <!-- TV Profile -->
    <tizen:profile name="tv-samsung"/>

    <!-- Required Features -->
    <tizen:feature name="http://tizen.org/feature/tv.inputdevice"/>

    <!-- Optional Features (değerlendirilebilir) -->
    <tizen:feature name="http://tizen.org/feature/tv.audio"/>
    <tizen:feature name="http://tizen.org/feature/storage.external"/>
</widget>
```

## Feature vs Privilege Farkı

- **Feature**: Donanım/yazılım yeteneği (kamera, GPS, vs.)
- **Privilege**: API kullanım izni (internet, dosya sistemi, vs.)

Her ikisi de config.xml'de tanımlanır ama farklı amaçlara hizmet eder!
