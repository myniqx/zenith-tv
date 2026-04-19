import { Search, UserCircle, Settings } from 'lucide-react'
import { HorizontalList, Button } from '@navix/react'
import { cn } from '@zenith-tv/ui/lib'

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

export const HEADER_HEIGHT = 80

const NAV_SECTIONS: MenuSection[] = ['favorites', 'all', 'p2p']

export function Header({ activeSection, onSectionChange }: HeaderProps) {
  return (
    <header className="glass-header shrink-0 w-full shadow-2xl shadow-black/50">
      <HorizontalList fKey="menu">
        <div className="flex items-center justify-between w-full px-12 py-5">

          <div className="flex items-center gap-12">
            <h1 className="text-2xl font-black italic tracking-tighter text-white">
              Zenith TV
            </h1>

            <nav className="flex items-center gap-8">
              {NAV_SECTIONS.map((section) => {
                const isActive = activeSection === section
                return (
                  <Button
                    key={section}
                    fKey={`menu-${section}`}
                    onClick={() => onSectionChange(section)}
                    className="relative"
                  >
                    {({ focused }) => (
                      <>
                        <span className={cn(
                          'text-xs font-bold tracking-widest uppercase transition-colors duration-200',
                          focused ? 'text-foreground' : isActive ? 'text-primary' : 'text-muted-foreground',
                        )}>
                          {MENU_LABELS[section]}
                        </span>
                        {isActive && (
                          <span className={cn(
                            'absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                            focused ? 'bg-foreground' : 'bg-primary',
                          )} />
                        )}
                      </>
                    )}
                  </Button>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/60 border border-border/20">
              <Search size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ara...</span>
            </div>

            <Button fKey="menu-profile" onClick={() => onSectionChange('profile')}>
              {({ focused }) => (
                <UserCircle size={22} className={cn(
                  'transition-colors duration-200',
                  focused || activeSection === 'profile' ? 'text-primary' : 'text-foreground',
                )} />
              )}
            </Button>

            <Button fKey="menu-settings" onClick={() => onSectionChange('settings')}>
              {({ focused }) => (
                <Settings size={22} className={cn(
                  'transition-colors duration-200',
                  focused || activeSection === 'settings' ? 'text-primary' : 'text-foreground',
                )} />
              )}
            </Button>
          </div>

        </div>
      </HorizontalList>
    </header>
  )
}
