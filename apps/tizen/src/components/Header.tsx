import { FocusButton } from './Navigation'

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
  return (
    <FocusButton
      focusId={`menu-${section}`}
      onClick={onClick}
      variant={active ? 'default' : 'secondary'}
      className={active ? 'bg-red-600 hover:bg-red-700' : ''}
    >
      {MENU_LABELS[section]}
    </FocusButton>
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
