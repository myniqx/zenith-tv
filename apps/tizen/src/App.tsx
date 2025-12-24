import { useState } from 'react'
import { Header, MenuSection } from './components/Header'
import { Layout } from './components/Layout'
import { KeyboardHelper } from './components/KeyboardHelper'
import { useDpadNavigation } from './hooks/useDpadNavigation'

function App() {
  const [activeSection, setActiveSection] = useState<MenuSection>('all')

  useDpadNavigation({
    initialFocusId: 'menu-all',
    onBack: () => {
      console.log('Back button pressed')
    },
  })

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      <Header activeSection={activeSection} onSectionChange={setActiveSection} />

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

      <KeyboardHelper />
    </div>
  )
}

export default App
