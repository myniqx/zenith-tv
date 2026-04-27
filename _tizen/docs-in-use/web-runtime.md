# Zenith TV - Web Runtime (WRT)

Tizen Web Runtime, web uygulamalarının tarayıcı dışında standalone olarak çalışmasını sağlar.

## Uygulama Tipleri

### 1. Packaged Web App (Önerilen - Zenith TV için)

Tüm dosyalar .wgt içinde paketlenir:

```
zenith-tv.wgt
├── index.html
├── assets/
├── config.xml
└── ...
```

**Avantajlar**:
- Offline çalışır
- Hızlı başlatma
- Tizen Device API'ye tam erişim

### 2. Hosted Web App

Ana sayfa harici sunucuda barındırılır:

```xml
<!-- config.xml -->
<content src="https://example.com/app/index.html"/>
```

**Dezavantajlar**:
- Internet gerektirir
- Tizen Device API kısıtlı
- Cross-origin sorunları

**Zenith TV için**: Packaged App kullanıyoruz (M3U parsing ve local storage için)

## Lifecycle Management

### Page Load Events

```javascript
// DOM ready
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready')
})

// Page fully loaded
window.addEventListener('load', () => {
  console.log('Page loaded')
})

// Page unload
window.addEventListener('unload', () => {
  console.log('Cleaning up...')
})
```

### Visibility Events (Önemli!)

Uygulama background'a gittiğinde:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // App background'a gitti
    console.log('App hidden - pausing video')
    // Video pause et, timer durdur, vs.
  } else {
    // App foreground'a geldi
    console.log('App visible - resuming')
    // Video devam ettir
  }
})
```

**Önemli**: Background'dayken JavaScript **suspend** edilir (background service değilse)

## Content Security Policy (CSP)

Zenith TV için CSP yapılandırması:

### config.xml'de CSP

```xml
<tizen:content-security-policy>
  default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval' http: https: ws: wss:;
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline'
</tizen:content-security-policy>
```

**Açıklama**:
- `default-src 'self'`: Kendi dosyalarına izin ver
- `http: https:`: IPTV stream URL'lerine izin ver
- `ws: wss:`: WebSocket (P2P için)
- `blob:`: WASM parser için
- `'unsafe-inline'`: Inline script/style (React için gerekli)
- `'unsafe-eval'`: eval() (bazı bundler'lar için)

### CSP Modes

1. **CSP-based mode** (Zenith TV kullanıyor):
   - Modern güvenlik
   - `<tizen:content-security-policy>` tanımlı

2. **WARP-based mode** (Legacy):
   - Eski `<access>` tag sistemi
   - Önerilmez

## Storage Support

Her uygulamanın private storage'ı var:

```javascript
// LocalStorage (5-10 MB)
localStorage.setItem('settings', JSON.stringify(settings))

// IndexedDB (50+ MB) - M3U cache için
import Dexie from 'dexie'
const db = new Dexie('zenithTV')
db.version(1).stores({
  m3uCache: 'uuid, content, timestamp'
})

// File System API (Unlimited) - Büyük M3U dosyaları için
const root = await navigator.storage.getDirectory()
const fileHandle = await root.getFileHandle('playlist.m3u', { create: true })
```

**Zenith TV stratejisi**:
- Settings → localStorage
- M3U cache → IndexedDB
- Büyük dosyalar (>10MB) → File System API

## API Support

### Tizen Device API

Sadece **local domain** (kendi dosyalarınız) erişebilir:

```javascript
// ✅ İzinli - Local file'dan
tizen.systeminfo.getCapability('http://tizen.org/feature/tv.inputdevice')

// ❌ Yasak - Remote iframe'den
<iframe src="https://example.com"></iframe> içinde tizen.* kullanılamaz
```

### W3C/HTML5 APIs

Hem local hem remote domain kullanabilir:

```javascript
// Geolocation, WebSocket, IndexedDB, vs.
// Her yerde çalışır
```

## Application Protection

Encryption aktif edersek (opsiyonel):

```xml
<tizen:setting encrypt="true"/>
```

**Koruma**:
- HTML, JS, CSS dosyaları şifrelenir
- Runtime'da otomatik decrypt edilir
- Kod tersine mühendislik zorlaşır

**Zenith TV için**: Gerekli değil (open source olmayacak ama şifreleme overhead'i gereksiz)

## URI Schemes

Desteklenen URI şemaları:

```javascript
// Email
window.location.href = 'mailto:support@zenith-tv.app'

// SMS (mobile devices)
window.location.href = 'sms:+1234567890'

// Custom schemes (eğer kayıtlıysa)
window.location.href = 'zenith://play?stream=...'
```

## Multiple Browsing Contexts

```javascript
// Yeni pencere aç (WRT ignore eder position/size)
window.open('https://example.com', '_blank')

// iframe kullanımı
<iframe src="settings.html"></iframe>
```

**Not**: Tizen Device API sadece top-level context'te çalışır (iframe'de değil)

## Performance Considerations

### Background Suspension

App background'a gittiğinde:
- ❌ JavaScript çalışmaz (setTimeout, setInterval durur)
- ❌ CSS animasyonlar durur
- ❌ Video oynatma durur
- ✅ WebSocket bağlantısı kesilir

**Çözüm**: Background service olarak işaretleyin:

```xml
<tizen:background-category value="media"/>
```

### Localization

```xml
<!-- config.xml -->
<name>Zenith TV</name>
<name xml:lang="tr">Zenith TV</name>
<name xml:lang="en">Zenith TV</name>
```

Runtime'da:

```javascript
// Dil algılama
const lang = navigator.language // 'tr-TR', 'en-US', vs.
```

## Security Best Practices

1. **CSP kullan**: XSS saldırılarını önle
2. **HTTPS kullan**: M3U URL'leri için (mümkünse)
3. **Input validation**: Kullanıcı M3U URL'lerini validate et
4. **Privilege minimization**: Sadece gerekli privilege'ları ekle
5. **Resource encryption**: Hassas veriler için encrypt et

## Zenith TV için Öneriler

```javascript
// App.tsx
useEffect(() => {
  // Visibility change dinle
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Video pause et
      pauseVideo()
    } else {
      // Video resume et
      resumeVideo()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [])
```

## Troubleshooting

### "Security Error" alıyorum
→ Privilege eksik veya CSP kısıtlaması

### Background'da app donuyor
→ Background service tanımla veya visibility event'i dinle

### Remote URL'den Tizen API çağrılamıyor
→ Normal, sadece local domain'den çağırılabilir

### CORS hatası
→ CSP'ye domain ekle veya proxy kullan
