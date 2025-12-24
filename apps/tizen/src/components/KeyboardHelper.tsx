import { useEffect, useState } from 'react'

export function KeyboardHelper() {
  const [visible, setVisible] = useState(true)
  const [lastKey, setLastKey] = useState<string>('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<number, string> = {
        38: '↑ (Up)',
        40: '↓ (Down)',
        37: '← (Left)',
        39: '→ (Right)',
        13: 'Enter',
        27: 'Esc (Back)',
        8: 'Backspace (Back)',
      }

      if (keyMap[e.keyCode]) {
        setLastKey(keyMap[e.keyCode])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white p-4 rounded-lg text-sm max-w-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Klavye Simülasyonu</h3>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1 text-xs">
        <p>↑ ↓ ← → : Navigasyon</p>
        <p>Enter : Seç</p>
        <p>Esc/Backspace : Geri</p>
      </div>

      {lastKey && (
        <div className="mt-2 pt-2 border-t border-gray-600">
          <p className="text-green-400">Son tuş: {lastKey}</p>
        </div>
      )}
    </div>
  )
}
