import { useEffect, useState } from 'react'

interface LogEntry {
  id: number
  message: string
  timestamp: string
}

export function KeyboardHelper() {
  const [visible, setVisible] = useState(true)
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<number, string> = {
        38: '↑ Up',
        40: '↓ Down',
        37: '← Left',
        39: '→ Right',
        13: 'Enter',
        27: 'Esc',
        8: 'Backspace',
        10009: 'Return',
      }

      const label = keyMap[e.keyCode] ?? `Key: ${e.keyCode}`
      setLogs(prev => [{
        id: Date.now(),
        message: label,
        timestamp: new Date().toLocaleTimeString().split(' ')[0],
      }, ...prev].slice(0, 5))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg text-sm w-56 shadow-lg border border-gray-700 z-50">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
        <h3 className="font-bold text-yellow-500">Key Debugger</h3>
        <button onClick={() => setVisible(false)} className="text-gray-400 hover:text-white">✕</button>
      </div>

      <div className="space-y-2 max-h-40 overflow-hidden">
        {logs.map(log => (
          <div key={log.id} className="text-xs border-l-2 pl-2 border-gray-700 flex justify-between">
            <span className="font-mono text-white">{log.message}</span>
            <span className="text-gray-500">{log.timestamp}</span>
          </div>
        ))}
        {logs.length === 0 && <div className="text-gray-600 italic text-xs">Waiting for keys...</div>}
      </div>
    </div>
  )
}
