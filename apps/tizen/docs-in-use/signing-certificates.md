# Zenith TV - Signing ve Certificates

Tizen'de tüm uygulamalar imzalanmak zorundadır.

## İmza Türleri

Her Tizen uygulamasında **2 imza** olmalı:

### 1. Author Signature

**Kim imzalar**: Geliştirici (siz)
**Nerede**: Tizen Studio
**Dosya**: `author-signature.xml`

**Amaçlar**:
- Aynı author signature = aynı geliştirici
- App güncelleme: Eski ve yeni version aynı author signature'a sahip olmalı
- Kaynak paylaşımı: Aynı author signature'lı uygulamalar data paylaşabilir

### 2. Distributor Signature

**Kim imzalar**: App store (Samsung App Store)
**Nerede**: Store submission sonrası
**Dosya**: `signature1.xml`

**Amaçlar**:
- Store validation proof
- API privilege level belirleme (Public/Partner/Platform)

## Certificate Privilege Levels

| Level | Kullanım | API Erişimi |
|-------|----------|-------------|
| **Public** | Herkes | Public level APIs |
| **Partner** | Vendor partnership | Public + Partner APIs |
| **Platform** | Vendor internal | Public + Partner + Platform APIs |

**Zenith TV için**: Public level yeterli (tüm gerekli API'ler public)

## Development Flow

### 1. Tizen Studio'da Certificate Oluşturma

```
Tools → Certificate Manager → +
→ Samsung Certificate
→ Author Certificate (Create New)
→ Distributor Certificate (Use default)
```

**Çıktı**:
- `author.p12`: Author signing key
- `distributor.p12`: Test distributor signing key (public level)

### 2. Certificate Profile Oluşturma

Certificate Manager'da:
1. Create new profile
2. İsim ver: "zenith-tv-profile"
3. Author + Distributor certificate seç
4. Device ID ekle (TV'nin DUID'si)

### 3. Project'e Profile Atama

```
Right-click project → Properties
→ Tizen Studio → Certificate
→ "zenith-tv-profile" seç
```

## Signing Flow

### Development

```
1. pnpm build
2. Tizen Studio packaging
3. Author signature eklenir (author.p12)
4. Distributor signature eklenir (test distributor)
5. zenith-tv.wgt oluşur
```

### Production (Store)

```
1. .wgt dosyasını store'a yükle
2. Store test distributor signature'ı siler
3. Store kendi distributor signature'ını ekler
4. Store .wgt'yi yayınlar
```

## Samsung TV için Özel Gereksinimler

Samsung TV'ler sadece **yetkili uygulamaları** yükler. Development için:

### Seçenek 1: Developer Mode (Önerilen)

TV'de Developer Mode aç:
1. Smart Hub → 12345 tuşla
2. Developer Mode → ON
3. PC IP ekle

Artık test certificate ile yükleyebilirsiniz.

### Seçenek 2: Samsung Certificate

Ticari cihazlarda test etmek için:

1. https://developer.samsung.com/smarttv → Register
2. Certificate request
3. Device DUID ekle
4. Samsung certificate indir
5. Tizen Studio'da import et

**DUID alma**:
```bash
# TV'de Developer Mode açıksa
# TV Settings → Developer → Device UID
```

## CLI ile Signing

```bash
# Manual signing (optional)
tizen package -t wgt -s <profile_name> -- dist/

# Profile listesi
tizen security-profiles list

# Yeni profile ekle
tizen security-profiles add -n zenith-tv -a author.p12 -p <password>
```

## Signature Dosya Yapısı

```
zenith-tv.wgt
├── author-signature.xml     # Author imzası
│   ├── SignatureValue       # İmza değeri
│   └── KeyInfo              # Author certificate
└── signature1.xml           # Distributor imzası (ilk geçerli)
    ├── SignatureValue       # İmza değeri
    └── KeyInfo              # Distributor certificate
```

## Common Issues

### "Invalid signature" hatası

**Sebep**: Certificate expire olmuş veya geçersiz

**Çözüm**:
```bash
# Certificate kontrolü
openssl pkcs12 -in author.p12 -info

# Yeni certificate oluştur
Tizen Studio → Certificate Manager → Create
```

### "Unauthorized application" hatası

**Sebep**: Samsung TV'de Developer Mode kapalı

**Çözüm**:
1. TV'de Developer Mode aç
2. Veya Samsung certificate kullan

### "Author signature mismatch" (update sırasında)

**Sebep**: Eski ve yeni version farklı author certificate kullanıyor

**Çözüm**: Aynı author certificate ile imzala

## Security Best Practices

1. **Private key koruma**: `author.p12` dosyasını güvenli sakla
2. **Password güvenliği**: Güçlü password kullan
3. **Certificate backup**: author.p12'yi yedekle
4. **Team sharing**: Takımla aynı author certificate paylaş (güncelleme için)

## Certificate Expiration

**Author certificate**: 10 yıl geçerli
**Distributor certificate**: Store tarafından yenilenir

Expire olmadan **6 ay önce** yenile!

## Zenith TV için Checklist

Development:
- [x] Tizen Studio kurulu
- [x] Samsung certificate oluşturuldu
- [x] Certificate profile oluşturuldu
- [x] Project'e profile atandı
- [x] TV Developer Mode aktif

Production:
- [ ] author.p12 yedeklendi
- [ ] Samsung Seller Office'e kayıt olundu
- [ ] .wgt store'a yüklendi
- [ ] Store distributor signature eklendi

## Faydalı Komutlar

```bash
# Certificate bilgisi
tizen certificate info -p <profile_name>

# Security profiles listesi
tizen security-profiles list

# Profile sil
tizen security-profiles remove -n <profile_name>

# DUID check (TV'ye bağlıyken)
sdb devices
sdb capability
```

## References

- [Samsung Certificate Extension](https://developer.samsung.com/smarttv/develop/extension-libraries/samsung-certificate-extension.html)
- [W3C Widget Signature Spec](https://www.w3.org/TR/widgets-digsig/)
