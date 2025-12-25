import { cn } from '@zenith-tv/ui/lib/cn'
import { useFocusable } from '../hooks/useFocusable'

export type MenuSection = 'favorites' | 'all' | 'p2p' | 'settings' | 'profile' | 'exit'

interface HeaderProps {
  activeSection: MenuSection
  onSectionChange: (section: MenuSection) => void
}

const MENU_LABELS: Record<MenuSection, string> = {
  favorites: 'Favoriler',
  all: 'Tümü',
  p2p: 'P2P',
  settings: 'Ayarlar',
  profile: 'Profil',
  exit: 'Çıkış',
}

export const HEADER_HEIGHT = 72

function HeaderButton({ section, active, onClick }: { section: MenuSection; active: boolean; onClick: () => void }) {
  const { ref, isFocused, focusProps } = useFocusable({
    focusId: `menu-${section}`,
    scopeId: 'header',
    onEnter: onClick,
  })

  return (
    <button
      ref={ref}
      {...focusProps}
      onClick={onClick}
      className={cn(
        'px-6 py-2 rounded-lg transition-all font-semibold focus:outline-none',
        active && 'bg-red-600 text-white scale-105',
        !active && 'bg-gray-700 text-gray-300 hover:bg-gray-600',
        isFocused && 'ring-2 ring-white ring-offset-2 ring-offset-gray-800'
      )}
    >
      {MENU_LABELS[section]}
    </button>
  )
}

export function Header({ activeSection, onSectionChange }: HeaderProps) {
  const sections: MenuSection[] = ['favorites', 'all', 'p2p', 'settings', 'profile', 'exit']

  return (
    <header
      className="bg-gray-800 px-6 flex items-center justify-between shadow-lg"
      style={{ height: HEADER_HEIGHT }}
    >
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-red-500">Zenith TV</h1>
      </div>

      <nav className="flex gap-3">
        {sections.map((section) => (
          <HeaderButton
            key={section}
            section={section}
            active={activeSection === section}
            onClick={() => onSectionChange(section)}
          />
        ))}
      </nav>
    </header>
  )
}
