# Tizen Navigation System Guide

Modern TV remote navigation için tasarlanmış sistem. D-pad, klavye ve mouse desteği.

## Core Components

### NavigationProvider
Global navigation state ve keyboard listener yönetimi.

### FocusScope
Navigation scope'larını tanımlar. Context üzerinden child componentlere `scopeId` sağlar.

```tsx
<FocusScope id="app">
  {/* Bu scope içindeki tüm FocusButton'lar otomatik "app" scopeId'yi alır */}
  <Header />
</FocusScope>
```

### FocusButton
Focus management built-in button component (shadcn Button extend eder).

```tsx
import { FocusButton } from '@/components/Navigation'

<FocusButton focusId="my-button" onClick={handleClick}>
  Click Me
</FocusButton>
```

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

### 3. Modals/Dialogs

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

## Checklist

Yeni component eklerken:
- [ ] `FocusButton` kullanıyorum (veya gerekçeli custom)
- [ ] FocusScope doğru yerde (sadece modal/dialog için)
- [ ] `focusId` unique
- [ ] Prop drilling yok (store kullanıyorum)
- [ ] Liste ise `stopPropagation()` ekledim
