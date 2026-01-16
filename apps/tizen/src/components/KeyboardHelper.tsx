import { useEffect, useState } from 'react'
import { useNavigation } from '../contexts/NavigationContext'

interface LogEntry {
  id: number
  type: 'key' | 'event'
  message: string
  timestamp: string
  detail?: string
}

export function KeyboardHelper() {
  const [visible, setVisible] = useState(true)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const { activeScopeId, focusedId } = useNavigation()

  const addLog = (type: 'key' | 'event', message: string, detail?: string) => {
    setLogs(prev => {
      const newLog = {
        id: Date.now(),
        type,
        message,
        detail,
        timestamp: new Date().toLocaleTimeString().split(' ')[0]
      }
      return [newLog, ...prev].slice(0, 5) // Keep last 5
    })
  }

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
        10009: 'Return (Back)',
      }

      if (keyMap[e.keyCode]) {
        addLog('key', keyMap[e.keyCode])
      } else {
        addLog('key', `Key: ${e.keyCode}`)
      }
    }

    const handleLeave = (e: Event) => {
      const detail = (e as CustomEvent).detail
      addLog('event', 'onLeave', `Dir: ${detail.direction}`)
    }

    const handleBack = (e: Event) => {
      const detail = (e as CustomEvent).detail
      addLog('event', 'onBack', `Scope: ${detail.scope}`)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('navigation:leave', handleLeave)
    window.addEventListener('navigation:back', handleBack)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('navigation:leave', handleLeave)
      window.removeEventListener('navigation:back', handleBack)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white p-4 rounded-lg text-sm w-64 shadow-lg border border-gray-700 z-50">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
        <h3 className="font-bold text-yellow-500">Event Debugger</h3>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1 mb-3 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Active Scope:</span>
          <span className="text-blue-400 font-mono">{activeScopeId || 'null'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Focused ID:</span>
          <span className="text-purple-400 font-mono">{focusedId || 'null'}</span>
        </div>
      </div>

      <div className="space-y-2 max-h-40 overflow-hidden">
        {logs.map(log => (
          <div key={log.id} className="text-xs border-l-2 pl-2 border-gray-700">
            <div className="flex justify-between text-gray-500 text-[10px]">
              <span>{log.timestamp}</span>
              <span className={log.type === 'key' ? 'text-green-500' : 'text-orange-500'}>
                {log.type.toUpperCase()}
              </span>
            </div>
            <div className="font-mono text-white">
              {log.message}
              {log.detail && <span className="text-gray-400 ml-1">({log.detail})</span>}
            </div>
          </div>
        ))}
        {logs.length === 0 && <div className="text-gray-600 italic text-xs">Waiting for events...</div>}
      </div>
    </div>
  )
}
