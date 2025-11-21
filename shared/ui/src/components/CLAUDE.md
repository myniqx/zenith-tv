# shadcn/ui Components Guide

This directory contains shadcn/ui components for Zenith TV project.

## Adding New shadcn Components

### 1. Install Component via CLI

```bash
cd shared/ui
npx shadcn@latest add <component-name>
```

Examples:
```bash
npx shadcn@latest add button
npx shadcn@latest add dialog input label
npx shadcn@latest add select checkbox switch
```

### 2. Fix Import Paths

After installation, shadcn uses `@/lib/cn` imports. We need relative paths instead.

**Automatic fix for all components:**
```bash
cd shared/ui/src/components/ui
for file in *.tsx; do
  sed -i 's|@/lib/cn|../../lib/cn|g' "$file"
  sed -i 's|@/lib"|../../lib"|g' "$file"
done
```

**Manual fix (single file):**
```tsx
// Change this:
import { cn } from "@/lib/cn"

// To this:
import { cn } from "../../lib/cn"
```

### 3. Add Export to package.json

Edit `shared/ui/package.json` and add the component to exports:

```json
"exports": {
  "./button": "./src/components/ui/button.tsx",
  "./dialog": "./src/components/ui/dialog.tsx",
  "./new-component": "./src/components/ui/new-component.tsx",
  // ... other exports
}
```

### 4. Verify Installation

Check that the component file exists and imports are correct:
```bash
ls -la shared/ui/src/components/ui/
cat shared/ui/src/components/ui/new-component.tsx | grep "import.*cn"
```

## Using Components in Apps

### Import Pattern

```tsx
// Import from @zenith-tv/ui/<component-name>
import { Button } from '@zenith-tv/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@zenith-tv/ui/dialog';
import { Input } from '@zenith-tv/ui/input';
import { Label } from '@zenith-tv/ui/label';
```

### With Lucide Icons

```tsx
import { Button } from '@zenith-tv/ui/button';
import { Plus, Trash2, Settings } from 'lucide-react';

function MyComponent() {
  return (
    <Button variant="outline">
      <Plus className="w-4 h-4 mr-2" />
      Add Item
    </Button>
  );
}
```

### Component Variants

Most shadcn components support variants via CVA (Class Variance Authority):

```tsx
// Button variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Button sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon Only</Button>
```

## Common Components Reference

### Currently Installed:
- `button` - Buttons with variants and sizes
- `dialog` - Modal dialogs
- `input` - Form inputs
- `label` - Form labels
- `card` - Card containers (Card, CardHeader, CardContent, CardFooter)
- `badge` - Small status badges
- `alert-dialog` - Confirmation dialogs
- `separator` - Horizontal/vertical separators

### To Install Later (as needed):
- `select` - Dropdown select menus
- `checkbox` - Checkboxes
- `switch` - Toggle switches
- `radio-group` - Radio button groups
- `tabs` - Tab navigation
- `toast` - Toast notifications
- `dropdown-menu` - Context menus
- `popover` - Popover menus
- `scroll-area` - Custom scrollbars
- `sheet` - Side panels
- `tooltip` - Tooltips

## Styling & Customization

### Using cn() Utility

The `cn()` utility merges Tailwind classes properly:

```tsx
import { Button } from '@zenith-tv/ui/button';
import { cn } from '@zenith-tv/ui/lib/cn';

function MyButton() {
  return (
    <Button className={cn("custom-class", "hover:bg-red-500")}>
      Click Me
    </Button>
  );
}
```

### CSS Variables

Theme colors are defined in `shared/ui/src/styles.css`:

```css
:root {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 62.8% 30.6%;
  /* ... more variables */
}
```

Use these in Tailwind classes:
```tsx
<div className="bg-background text-foreground">
<div className="bg-primary text-primary-foreground">
<div className="bg-destructive text-destructive-foreground">
```

## Troubleshooting

### Import Error: "Cannot resolve @/lib/cn"

**Problem:** Component still uses alias imports.

**Solution:** Fix import paths (see step 2 above).

### Component Not Found

**Problem:** Component not exported in package.json.

**Solution:** Add export entry (see step 3 above).

### Styling Issues

**Problem:** Component doesn't match theme.

**Solution:**
1. Check that `shared/ui/src/styles.css` is imported
2. Verify CSS variables are defined in `:root`
3. Apps should import styles: `import '@zenith-tv/ui/styles'` (if needed)

## Best Practices

1. **Always use the CLI** - Don't manually copy component code
2. **Fix imports immediately** - After installation, fix `@/lib` imports
3. **Update package.json** - Don't forget to add exports
4. **Use TypeScript types** - All components are fully typed
5. **Leverage variants** - Use built-in variants instead of custom classes
6. **Consistent icons** - Always use lucide-react for icons
7. **Accessibility** - shadcn components have ARIA labels built-in

## Cross-Platform Usage

These components work across all platforms:

- ✅ **Desktop (Electron)** - Full support
- ✅ **Tizen (Web)** - Full support (planned)
- ✅ **Android (Flutter WebView)** - Full support (planned)

All use the same imports from `@zenith-tv/ui/*`.
