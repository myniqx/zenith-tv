import { useState, useEffect } from 'react'
import { Header, MenuSection } from './components/Header'
import { Layout } from './components/Layout'
import { KeyboardHelper } from './components/KeyboardHelper'
import { ProfileManager } from './components/ProfileManager'
import { NavigationProvider } from './contexts/NavigationContext'
import { FocusScope } from './contexts/FocusScope'

function App() {
  const [activeSection, setActiveSection] = useState<MenuSection>('all')
  const [showProfileManager, setShowProfileManager] = useState(false)

  // Handle section changes
  useEffect(() => {
    if (activeSection === 'profile') {
      setShowProfileManager(true)
    } else if (activeSection === 'exit') {
      // TODO: Exit app (tizen.application.getCurrentApplication().exit())
      console.log('Exit requested')
    } else {
      setShowProfileManager(false)
    }
  }, [activeSection])

  // Handle profile manager close
  useEffect(() => {
    const handleClose = () => {
      setShowProfileManager(false)
      setActiveSection('all')
    }

    window.addEventListener('close-profile-manager', handleClose)
    return () => window.removeEventListener('close-profile-manager', handleClose)
  }, [])

  const handleBack = () => {
    if (showProfileManager) {
      setShowProfileManager(false)
      setActiveSection('all')
    } else {
      console.log('Back button pressed at top level')
    }
  }

  return (
    <NavigationProvider initialFocusId="menu-all" onBack={handleBack}>
      <div className="w-full h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
        <FocusScope id="header" active={!showProfileManager}>
          <Header activeSection={activeSection} onSectionChange={setActiveSection} />
        </FocusScope>

        {showProfileManager ? (
          <div className="flex-1 overflow-hidden">
            <FocusScope id="profile-manager" active={true}>
              <ProfileManager />
            </FocusScope>
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
    </NavigationProvider>
  )
}

export default App
