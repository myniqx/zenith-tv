import { useState, useEffect, useRef } from 'react'
import { useContentStore } from '@/stores/content'
import { ProfileList } from './ProfileList'
import { M3USourceList } from './M3USourceList'
import { StatusBar } from './StatusBar'
import { HorizontalList } from '@navix/react'

interface ProfileManagerProps {
  onDone?: () => void
}

export function ProfileManager({ onDone }: ProfileManagerProps) {
  const { statusMessage } = useContentStore()
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const pendingDone = useRef(false)
  const isLocked = statusMessage.status === 'loading' && statusMessage.percent !== null

  useEffect(() => {
    if (pendingDone.current && statusMessage.status === 'ready') {
      pendingDone.current = false
      onDone?.()
    }
    if (pendingDone.current && statusMessage.status === 'error') {
      pendingDone.current = false
    }
  }, [statusMessage.status, onDone])

  return (
    <div className="flex-1 min-h-0 bg-background text-foreground flex flex-col relative">
      <HorizontalList fKey={'profile-columns'}>
        <div className={`flex-1 flex overflow-hidden${isLocked ? ' pointer-events-none select-none opacity-60' : ''}`}>
          <ProfileList
            selectedProfile={selectedProfile}
            onSelectProfile={setSelectedProfile}
            onDeleted={() => setSelectedProfile(null)}
            onAdded={(username) => { setSelectedProfile(username); pendingDone.current = true }}
          />
          <M3USourceList
            selectedProfile={selectedProfile}
            onPendingSelect={() => { pendingDone.current = true }}
          />
        </div>
      </HorizontalList>
      <StatusBar />
    </div>
  )
}
