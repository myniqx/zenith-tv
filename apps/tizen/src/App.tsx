import { useState, useEffect } from 'react'
import { Header, MenuSection } from './components/Header'
import { Layout } from './components/Layout'
import { KeyboardHelper } from './components/KeyboardHelper'
import { ProfileManager } from './components/ProfileManager'
import { NavigationProvider } from './contexts/NavigationContext'
import { FocusScope } from './contexts/FocusScope'

function App() {
  const [activeSection, setActiveSection] = useState<MenuSection>('all')

  useEffect(() => {
    if (activeSection === 'exit') {
      // TODO: Exit app (tizen.application.getCurrentApplication().exit())
      console.log('Exit requested')
    }
  }, [activeSection])

  const handleBack = () => {
    if (activeSection === 'profile') {
      setActiveSection('all')
    } else {
      console.log('Back button pressed at top level')
    }
  }

  return (
    <NavigationProvider initialFocusId="menu-all" onBack={handleBack}>
      <FocusScope id="app" active={true}>
        <div className="w-full h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
          <Header activeSection={activeSection} onSectionChange={setActiveSection} />

          {activeSection === 'profile' ? (
            <div className="flex-1 overflow-hidden">
              <ProfileManager />
            </div>
          ) : (
            <Layout>
              <div className="p-8">
                <div className="text-center">
                  <h2 className="text-4xl font-bold mb-4">
                    Hoş Geldiniz
                  </h2>
                  <p className="text-gray-400 text-xl mb-2">
                    Aktif Bölüm: <span className="text-red-500 font-semibold">{activeSection}</span>
                  </p>
                  <p className="text-gray-500 mt-8">
                    Tizen TV platformu için modern IPTV oynatıcı
                  </p>
                  <p className="text-gray-600 mt-4 text-sm">
                    Navigasyon için yön tuşlarını (↑ ↓ ← →) kullanın
                  </p>
                </div>
              </div>
            </Layout>
          )}

          <KeyboardHelper />
        </div>
      </FocusScope>
    </NavigationProvider>
  )
}

export default App
