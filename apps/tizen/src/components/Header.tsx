import { cn } from '@zenith-tv/ui/lib/cn'

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
          <button
            key={section}
            id={`menu-${section}`}
            data-focusable="true"
            onClick={() => onSectionChange(section)}
            className={cn(
              'px-6 py-2 rounded-lg transition-all font-semibold focus:outline-none',
              activeSection === section
                ? 'bg-red-600 text-white scale-105'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            )}
          >
            {MENU_LABELS[section]}
          </button>
        ))}
      </nav>
    </header>
  )
}
