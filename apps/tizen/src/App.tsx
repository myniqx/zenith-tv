import { useState, useEffect } from 'react'
import { FocusRoot, VerticalList } from '@navix/react'
import { twMerge } from 'tailwind-merge'
import { Header, MenuSection } from './components/Header'
import { Layout } from './components/Layout'
import { KeyboardHelper } from './components/KeyboardHelper'
import { ProfileManager } from './components/ProfileManager'
import { ContentBrowser } from './components/ContentBrowser'
import { useContentStore } from './stores/content'
import { initDevEnvironment } from './utils/dev-helper'
import { Toaster } from '@zenith-tv/ui/sonner'
import { P2PManager } from './components/P2P/P2PManager'
import { P2PView } from './components/P2P/P2PView'
import { Settings } from './components/Settings'

function App() {
  const [activeSection, setActiveSection] = useState<MenuSection>('all')
  const { movieGroup, favoriteGroup } = useContentStore()

  useEffect(() => {
    initDevEnvironment()
  }, [])

  useEffect(() => {
    if (activeSection === 'exit') {
      if (typeof window !== 'undefined' && (window as any).tizen?.application) {
        (window as any).tizen.application.getCurrentApplication().exit()
      } else {
        window.close()
      }
    }
  }, [activeSection])

  return (
    <>
      <FocusRoot mergeClassName={twMerge} inputConfig={{
        actions: {
          back: { keys: ['Backspace', 'Escape', 'XF86Back'] },
          enter: { keys: ['Enter', 'Space'] },
          up: { keys: ['ArrowUp', 'XF86Up'] },
          down: { keys: ['ArrowDown', 'XF86Down'] },
          left: { keys: ['ArrowLeft', 'XF86Left'] },
          right: { keys: ['ArrowRight', 'XF86Right'] },
        }
      }}>
        <P2PManager />
        <div className="w-full h-screen bg-background text-foreground flex flex-col overflow-hidden">
          <VerticalList fKey="app" className="flex-1 flex flex-col min-h-0 relative">
            <Header activeSection={activeSection} onSectionChange={setActiveSection} />

            <div className="absolute top-20 left-0 w-full h-[614px] bg-linear-to-b from-primary/5 to-transparent  pointer-events-none"></div>

            {activeSection === 'profile' && (
              <ProfileManager onDone={() => setActiveSection('all')} />
            )}
            {activeSection === 'p2p' && <P2PView />}
            {activeSection === 'settings' && <Settings />}
            {activeSection === 'all' && movieGroup && (
              <ContentBrowser initialGroup={movieGroup} className="flex-1 min-h-0" />
            )}
            {activeSection === 'favorites' && favoriteGroup && (
              <ContentBrowser initialGroup={favoriteGroup} className="flex-1 min-h-0" />
            )}
            {activeSection !== 'profile' && activeSection !== 'p2p' && activeSection !== 'settings' &&
              activeSection !== 'exit' && !movieGroup && !favoriteGroup && (
                <Layout>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <h2 className="text-4xl font-bold mb-4">Hoş Geldiniz</h2>
                      <p className="text-muted-foreground mt-4">
                        Tizen TV platformu için modern IPTV oynatıcı
                      </p>
                      <p className="text-muted-foreground/70 mt-2 text-sm">
                        Navigasyon için yön tuşlarını (↑ ↓ ← →) kullanın
                      </p>
                    </div>
                  </div>
                </Layout>
              )}
          </VerticalList>

          <KeyboardHelper />
        </div>
      </FocusRoot>
      <Toaster />
    </>
  )
}

export default App
