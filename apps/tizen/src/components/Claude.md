# Tizen Navigation System Guide

Modern TV remote navigation için tasarlanmış sistem. D-pad, klavye ve mouse desteği.

## Core Components

### NavigationProvider
Global navigation state ve keyboard listener yönetimi.

### FocusScope
Navigation scope'larını tanımlar. Context üzerinden child componentlere `scopeId` sağlar.

```tsx
<FocusScope id="app">
  {/* Bu scope içindeki tüm Focus* componentler otomatik "app" scopeId'yi alır */}
  <Header />
</FocusScope>
```

## Focus Components (shadcn extensions)

Tüm Focus* componentler shadcn/ui componentlerini extend eder ve TV navigation desteği ekler.

### FocusButton
Button component with focus management (shadcn Button extend eder).

```tsx
import { FocusButton } from '@/components/Navigation'

<FocusButton focusId="my-button" onClick={handleClick} variant="default">
  Click Me
</FocusButton>
```

### FocusInput
Input component with focus management (shadcn Input extend eder).

```tsx
import { FocusInput } from '@/components/Navigation'

<FocusInput
  focusId="username"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  onEnter={handleSubmit}
  placeholder="Username"
/>
```

### FocusCard
Card component with focus management (shadcn Card extend eder). İki farklı pattern ile kullanılabilir:

**Pattern 1: Simple Clickable Card** - Tek aksiyonlu kartlar (content grid)
**Pattern 2: Card with Hidden Action Scope** - Kompleks aksiyonlar (edit/delete)

Detaylı kullanım için aşağıdaki "FocusCard Usage Patterns" bölümüne bakın.

## Quick Start

### 1. App Layout

```tsx
function App() {
  return (
    <NavigationProvider initialFocusId="menu-all" onBack={handleBack}>
      <FocusScope id="app">
        <Header />
        <Content />
      </FocusScope>
    </NavigationProvider>
  )
}
```

### 2. Buttons

```tsx
// FocusScope içinde - scopeId otomatik
<FocusButton focusId="save" onClick={handleSave}>
  Kaydet
</FocusButton>

// Manuel scopeId override
<FocusButton focusId="special" scopeId="custom" onClick={...}>
  Özel
</FocusButton>

// Variants (shadcn)
<FocusButton focusId="delete" variant="destructive">
  Sil
</FocusButton>
```

### 3. Form Inputs

```tsx
function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <FocusScope id="login-form">
      <Label>Username</Label>
      <FocusInput
        focusId="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <Label>Password</Label>
      <FocusInput
        focusId="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onEnter={handleSubmit}
      />

      <FocusButton focusId="submit" onClick={handleSubmit}>
        Login
      </FocusButton>
    </FocusScope>
  )
}
```

### 4. Cards (Lists)

```tsx
function ProfileList() {
  const { profiles } = useProfilesStore()

  return (
    <div className="space-y-3">
      {profiles.map(profile => (
        <FocusCard
          key={profile.id}
          focusId={`profile-${profile.id}`}
          onClick={() => selectProfile(profile)}
        >
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold">{profile.username}</h3>
            <p className="text-gray-400">{profile.m3uRefs.length} kaynak</p>
          </CardContent>
        </FocusCard>
      ))}
    </div>
  )
}
```

### 5. Modals/Dialogs

```tsx
function MyDialog() {
  return (
    <FocusScope id="dialog">
      <FocusButton focusId="ok">OK</FocusButton>
      <FocusButton focusId="cancel">Cancel</FocusButton>
    </FocusScope>
  )
}
```

Modal açıldığında sadece modal içindeki butonlar erişilebilir.

## Scope Stack System

Scope'lar **stack** olarak yönetilir. Son açılan scope aktiftir.

```tsx
<FocusScope id="app">
  <Header />  {/* activeScopeId = "app" */}

  {showDialog && (
    <FocusScope id="dialog">
      <DialogContent />  {/* activeScopeId = "dialog" */}

      {showConfirm && (
        <FocusScope id="confirm">
          <ConfirmButtons />  {/* activeScopeId = "confirm" */}
        </FocusScope>
      )}
    </FocusScope>
  )}
</FocusScope>
```

**Stack timeline:**
1. Initial: `["app"]` → navigation in app
2. Dialog opens: `["app", "dialog"]` → navigation in dialog only
3. Confirm opens: `["app", "dialog", "confirm"]` → navigation in confirm only
4. Confirm closes: `["app", "dialog"]` → back to dialog automatically
5. Dialog closes: `["app"]` → back to app automatically

## FocusCard Usage Patterns

FocusCard iki farklı şekilde kullanılabilir:

### Pattern 1: Simple Clickable Card

Tek aksiyonlu, içinde başka focusable element olmayan kartlar için.

**Kullanım Alanları:**
- İçerik grid'leri (filmler, diziler, müzikler)
- Menu item'ları
- Navigation kartları

**Örnek:**
```tsx
<FocusCard focusId="movie-123" onClick={() => playMovie(123)}>
  <img src={posterUrl} alt={title} />
  <CardContent>
    <h3>{title}</h3>
    <p>{year} • {genre}</p>
    <Badge>{rating}</Badge>
  </CardContent>
</FocusCard>
```

**Özellikler:**
- ✅ Tek aksiyon (onClick)
- ✅ İçinde nested focusable YOK
- ✅ Spatial navigation ile hareket
- ✅ Kompleks görsel içerik gösterebilir

---

### Pattern 2: Card with Hidden Action Scope

Kart tıklandığında/seçildiğinde içinde gizli action scope'u açan kartlar.

**Kullanım Alanları:**
- Liste item'ları (profile, playlist, folder)
- Kompleks aksiyonlar gerektiren kartlar (edit, delete, share)
- Context menu benzeri davranış

**Örnek:**
```tsx
function ProfileCard({ profile, isSelected, onSelect }) {
  const [showActions, setShowActions] = useState(false)

  return (
    <FocusCard
      focusId={`profile-${profile.id}`}
      onClick={() => {
        onSelect(profile.id)
        setShowActions(true)
      }}
      className={isSelected && 'bg-red-600'}
    >
      <CardContent>
        <h3>{profile.username}</h3>
        <p>{profile.m3uRefs.length} kaynak</p>

        {showActions && (
          <FocusScope
            id={`actions-${profile.id}`}
            onBack={() => setShowActions(false)}
          >
            <div className="flex gap-2 mt-4">
              <FocusButton
                focusId="edit"
                onClick={handleEdit}
                variant="ghost"
                size="icon"
              >
                <Edit className="w-4 h-4" />
              </FocusButton>
              <FocusButton
                focusId="delete"
                onClick={handleDelete}
                variant="ghost"
                size="icon"
              >
                <Trash2 className="w-4 h-4" />
              </FocusButton>
            </div>
          </FocusScope>
        )}
      </CardContent>
    </FocusCard>
  )
}
```

**Özellikler:**
- ✅ Card click/select → hidden scope açılır
- ✅ Scope stack otomatik yönetim
- ✅ Back tuşu → scope kapanır (`onBack` handler)
- ✅ Nested focusable çakışması YOK (scope izolasyonu)

**Nasıl Çalışır:**
1. Card'a tıkla/Enter → `showActions = true` → FocusScope render
2. FocusScope mount → `pushScope(id, onBack)` → sadece action button'lar navigate edilebilir
3. Back tuşu → FocusScope'un `onBack()` çağrılır → `setShowActions(false)`
4. FocusScope unmount → `popScope()` → card'lara geri dön

**Kritik:** `onBack` prop'u olmadan back tuşu çalışmaz! Scope'u conditional render yapan state'i false yapmalısın.

## Custom Focusable Components

useFocusable hook ile custom component oluşturabilirsin:

```tsx
function CustomButton({ focusId, onClick }) {
  const { ref, isFocused, focusProps } = useFocusable({
    focusId,
    onEnter: onClick,
  })

  return (
    <button
      ref={ref}
      {...focusProps}
      onClick={onClick}
      className={isFocused ? 'ring-4 ring-white' : ''}
    >
      Button
    </button>
  )
}
```

**Note:** Çoğu durumda `FocusButton` kullanmak daha iyi.

## Manual List Navigation

Spatial navigation yerine manuel index yönetimi:

```tsx
function MyList({ items }) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode === 38) { // Up
        e.preventDefault()
        e.stopPropagation()  // ÖNEMLİ!
        setSelectedIndex(Math.max(0, selectedIndex - 1))
      }
      if (e.keyCode === 40) { // Down
        e.preventDefault()
        e.stopPropagation()  // ÖNEMLİ!
        setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, items])

  return (
    <div>
      {items.map((item, idx) => (
        <div
          key={item.id}
          className={idx === selectedIndex ? 'selected' : ''}
        >
          {item.name}
        </div>
      ))}
    </div>
  )
}
```

**Key:** `stopPropagation()` mutlaka ekle!

## State Management

### ❌ Prop Drilling Yapma

```tsx
// YANLIŞ
<ProfileManager profiles={p} onDelete={handleDelete} />
```

### ✅ Zustand Store Kullan

```tsx
// stores/profiles.ts
export const useProfilesStore = create((set) => ({
  profiles: [],
  deleteProfile: (id) => set((s) => ({
    profiles: s.profiles.filter(p => p.id !== id)
  })),
}))

// Component
function ProfileList() {
  const { profiles, deleteProfile } = useProfilesStore()
  // Direkt kullan
}
```

**Kural:** 2+ seviye prop geçirme → Store/Context kullan.

## DOM Query System

Navigation sistemi **DOM query-based** çalışır:

```tsx
// Her navigation'da fresh DOM query
const focusables = document.querySelectorAll('[data-focus-scope="app"][data-focus-id]')
```

**Avantajlar:**
- Component re-render'da element kaybı yok
- Her zaman güncel DOM
- Registry sync problemi yok

## Common Patterns

### App Root
```tsx
<NavigationProvider>
  <FocusScope id="app">
    <Header />
    {activeSection === 'profile' && <ProfileManager />}
  </FocusScope>
</NavigationProvider>
```

### Nested Modal
```tsx
<FocusScope id="app">
  <Content />
  {showForm && (
    <FocusScope id="form">
      <FormContent />
    </FocusScope>
  )}
</FocusScope>
```

### Button Grid
```tsx
<FocusScope id="grid">
  {items.map(item => (
    <FocusButton
      key={item.id}
      focusId={`item-${item.id}`}
      onClick={() => handleClick(item)}
    >
      {item.name}
    </FocusButton>
  ))}
</FocusScope>
```

Spatial navigation otomatik grid layout handle eder.

### Card List with Actions
```tsx
<div className="space-y-3">
  {items.map((item, index) => (
    <FocusCard
      key={item.id}
      focusId={`item-${item.id}`}
      onClick={() => selectItem(item)}
      className={selectedIndex === index && 'bg-red-600'}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">{item.name}</h3>
            <p className="text-gray-400">{item.description}</p>
          </div>

          {selectedIndex === index && (
            <div className="flex gap-2">
              <FocusButton
                focusId={`edit-${item.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit(item)
                }}
                variant="ghost"
                size="icon"
              >
                <Edit className="w-5 h-5" />
              </FocusButton>

              <FocusButton
                focusId={`delete-${item.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(item)
                }}
                variant="ghost"
                size="icon"
              >
                <Trash2 className="w-5 h-5" />
              </FocusButton>
            </div>
          )}
        </div>
      </CardContent>
    </FocusCard>
  ))}
</div>
```

## Debug

KeyboardHelper component aktif scope ve focused element'i gösterir:

```tsx
// App.tsx içinde zaten var
<KeyboardHelper />
```

Sağ alt köşede:
- Aktif Scope: `app`
- Focused ID: `menu-all`
- Son Tuş: `→ (Right)`

## Component Selection Guide

Ne zaman hangi Focus component kullanmalı?

### FocusButton
✅ **Kullan:**
- Tıklanabilir aksiyonlar (Save, Delete, Cancel)
- Toolbar butonları
- Modal confirm/cancel butonları

❌ **Kullanma:**
- Liste itemleri için (FocusCard kullan)
- Form input'ları için (FocusInput kullan)

### FocusInput
✅ **Kullan:**
- Text input
- Password input
- URL/Email input
- Textarea

❌ **Kullanma:**
- Butonlar için (FocusButton kullan)

### FocusCard
✅ **Kullan:**
- **Pattern 1:** İçerik grid'leri (filmler, albümler, menü itemları)
- **Pattern 1:** Tek aksiyonlu navigation kartları
- **Pattern 2:** Liste itemları + kompleks aksiyonlar (edit, delete, share)
- **Pattern 2:** Context menu benzeri davranış

❌ **Kullanma:**
- Manuel navigation kullanıyorsan (düz Card kullan)
- Sadece bir buton varsa (FocusButton kullan)
- Form içindeyse (FocusInput kullan)

**Pattern Seçimi:**
- Tek aksiyon → **Pattern 1** (Simple Clickable Card)
- Çoklu aksiyon (edit, delete) → **Pattern 2** (Hidden Action Scope)

## Checklist

Yeni component eklerken:
- [ ] Doğru Focus* component seçtim (Button/Input/Card)
- [ ] FocusCard kullanıyorsam doğru pattern seçtim (Pattern 1/2)
- [ ] FocusScope kullanıyorsam `onBack` prop ekledim (state cleanup için)
- [ ] FocusScope doğru yerde (sadece modal/dialog/hidden actions için)
- [ ] `focusId` unique
- [ ] Prop drilling yok (store kullanıyorum)
- [ ] shadcn variants kullanıyorum (variant, size)
- [ ] Internal state tercih ettim (prop yerine)
