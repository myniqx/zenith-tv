# Zenith TV - Build ve Packaging

## Build Süreci

### 1. Vite Build

```bash
cd apps/tizen
pnpm build
```

**Build çıktısı**: `dist/` klasörü

**Build işlemi:**
- TypeScript → JavaScript
- React JSX → JavaScript
- Tailwind CSS → Minified CSS
- Asset optimization
- Source maps (production'da kapatılabilir)

### 2. Validation (Otomatik)

Build sırasında otomatik kontroller:
- ✅ JavaScript syntax check
- ✅ CSS validation
- ✅ Privilege validation (config.xml)

### 3. .wgt Packaging

```bash
pnpm package
```

Bu komut şunları yapar:
1. `pnpm build` çalıştırır
2. `config.xml`'i `dist/` klasörüne kopyalar
3. `dist/` klasörünü ZIP olarak sıkıştırır
4. `zenith-tv.wgt` dosyası oluşturur

## .wgt Dosya Yapısı

```
zenith-tv.wgt (ZIP archive)
├── config.xml           # App manifest
├── index.html           # Entry point
├── icon.png             # App icon
├── assets/
│   ├── index-[hash].js  # Main bundle
│   ├── index-[hash].css # Styles
│   └── ...
├── author-signature.xml # Author signature (Tizen Studio)
└── signature1.xml       # Distributor signature (Store)
```

## Packaging Script Detayları

`scripts/create-wgt.js`:

```javascript
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'

// 1. config.xml'i dist'e kopyala
fs.copyFileSync('config.xml', 'dist/config.xml')

// 2. dist/ klasörünü ZIP'le
const output = fs.createWriteStream('zenith-tv.wgt')
const archive = archiver('zip', { zlib: { level: 9 } })

archive.pipe(output)
archive.directory('dist/', false)
await archive.finalize()
```

## Optimization (Production)

vite.config.ts'de production optimizasyonları:

```typescript
export default defineConfig({
  build: {
    target: 'es2015',        // Tizen 5.0+ uyumluluk
    minify: 'terser',        // JS minification
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          parser: ['@zenith-tv/parser'],
        },
      },
    },
  },
})
```

## Test ve Deploy

### 1. PC'de Test (Development)

```bash
pnpm dev
# http://localhost:5173
```

Tarayıcıda aç ve klavye ile test et:
- ↑ ↓ ← → : Navigasyon
- Enter : Seç
- Esc : Geri

### 2. Tizen Emulator'de Test

```bash
# Build ve package
pnpm package

# Tizen CLI ile yükle (Tizen Studio gerekli)
tizen install -n zenith-tv.wgt -t [EMULATOR_ID]
```

### 3. Gerçek TV'de Test

Samsung TV'de Developer Mode etkinleştir:
1. TV'de Smart Hub aç
2. "12345" tuşla
3. Developer Mode → ON
4. TV'nin IP adresini not et

```bash
# TV'ye bağlan
tizen connect [TV_IP]

# Uygulamayı yükle
tizen install -n zenith-tv.wgt -t [TV_IP]
```

## Signing (İmzalama)

### Development için

Tizen Studio otomatik olarak test signature ekler:
- **Author signature**: Sizin test sertifikanız
- **Distributor signature**: Tizen public test sertifikası

### Production için (Store'a gönderirken)

1. Samsung Seller Office'e kayıt ol
2. .wgt dosyasını yükle
3. Store otomatik olarak:
   - Test distributor signature'ı siler
   - Store distributor signature ekler
   - Public/Partner/Platform seviyesinde imzalar

## File Size Optimizasyonu

Zenith TV için tahmini dosya boyutları:

```
React + ReactDOM:      ~150 KB (gzipped)
Tailwind CSS:          ~10 KB (gzipped)
M3U Parser (WASM):     ~100 KB
Zenith TV kod:         ~50 KB (gzipped)
-----------------------------------
Toplam:                ~310 KB
```

Store limiti: Genelde **100 MB** (yeterli)

## Build Scriptleri

package.json'a eklenen scriptler:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "package": "pnpm build && pnpm create-wgt",
    "create-wgt": "node scripts/create-wgt.js",
    "type-check": "tsc --noEmit"
  }
}
```

## Troubleshooting

### Build hatası: "Module not found"
```bash
pnpm install
```

### .wgt dosyası oluşturulmuyor
```bash
# Scripti manuel çalıştır
node scripts/create-wgt.js
```

### TV'ye yüklenmiyor
1. Developer Mode aktif mi?
2. IP adresi doğru mu?
3. Signature geçerli mi?

```bash
# Connection test
tizen connect [TV_IP]
tizen list
```

## Store Submission Süreci

1. Build ve package yap
2. Samsung Seller Office'e giriş yap
3. Yeni uygulama oluştur
4. .wgt dosyasını yükle
5. Metadata ekle (açıklama, screenshot, vs.)
6. Submit → Review → Publish

**Review süresi**: 2-5 iş günü

## Checklist

Submission öncesi kontrol listesi:

- [ ] `pnpm type-check` başarılı
- [ ] `pnpm build` başarılı
- [ ] `pnpm package` .wgt oluşturdu
- [ ] Emulator'de test edildi
- [ ] Gerçek TV'de test edildi
- [ ] icon.png mevcut (512x512 önerilen)
- [ ] config.xml doğru (name, version, privileges)
- [ ] Screenshot'lar hazır (1920x1080)
