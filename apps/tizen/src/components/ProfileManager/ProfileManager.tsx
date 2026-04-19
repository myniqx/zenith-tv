import { useState, useEffect, useMemo, useRef } from 'react'
import { useProfilesStore } from '@/stores/profiles'
import { ProfileList } from './ProfileList'
import { M3USourceList } from './M3USourceList'
import { AddProfileForm } from './AddProfileForm'
import { ConfirmDialog } from './ConfirmDialog'
import type { DeleteItem } from './types'
import { useContentStore } from '@/stores/content'

interface ProfileManagerProps {
  onDone?: () => void
}

type Panel = 'list' | 'add-profile'

export function ProfileManager({ onDone }: ProfileManagerProps) {
  const {
    profiles,
    createProfile,
    deleteProfile,
    addM3UToProfile,
    removeM3UFromProfile,
    getUrlFromUUID,
    selectProfile,
    getCurrentUsername,
  } = useProfilesStore()

  const { currentUUID, update, statusMessage } = useContentStore()

  const [panel, setPanel] = useState<Panel>('list')
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<DeleteItem | null>(null)
  const [syncingUUID, setSyncingUUID] = useState<string | null>(null)

  // inline add-m3u form state
  const [showAddM3U, setShowAddM3U] = useState(false)
  const [addM3UUrl, setAddM3UUrl] = useState('')

  // add-profile form state
  const [newUsername, setNewUsername] = useState('')
  const [newProfileUrl, setNewProfileUrl] = useState('')

  const pendingDone = useRef(false)
  const isLocked = statusMessage.status === 'loading' && statusMessage.percent !== null
  const currentUsername = getCurrentUsername()

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0))
  }, [profiles])

  useEffect(() => {
    if (!selectedProfile && sortedProfiles.length > 0) {
      setSelectedProfile(currentUsername || sortedProfiles[0].username)
    }
  }, [sortedProfiles, currentUsername, selectedProfile])

  useEffect(() => {
    if (pendingDone.current && statusMessage.status === 'ready') {
      pendingDone.current = false
      onDone?.()
    }
    if (pendingDone.current && statusMessage.status === 'error') {
      pendingDone.current = false
    }
  }, [statusMessage.status, onDone])

  const handleSyncM3U = async (uuid: string) => {
    setSyncingUUID(uuid)
    try {
      if (currentUUID !== uuid && selectedProfile) {
        await selectProfile(selectedProfile, uuid)
      }
      await update()
    } catch (error) {
      console.error('Failed to sync M3U:', error)
    } finally {
      setSyncingUUID(null)
    }
  }

  const handleSelectM3U = async (username: string, uuid: string) => {
    if (currentUUID === uuid && getCurrentUsername() === username) return
    pendingDone.current = true
    await selectProfile(username, uuid)
  }

  const handleDeleteProfile = (username: string) => {
    setDeleteItem({ type: 'profile', username, displayName: username })
  }

  const handleDeleteM3U = (username: string, uuid: string) => {
    const url = getUrlFromUUID(uuid)
    let displayName = uuid.slice(0, 8)
    if (url) {
      try {
        const urlObj = new URL(url)
        const filename = urlObj.pathname.split('/').pop()
        displayName = filename || urlObj.hostname
      } catch {
        displayName = url.slice(0, 30) + (url.length > 30 ? '...' : '')
      }
    }
    setDeleteItem({ type: 'm3u', username, uuid, displayName })
  }

  const handleConfirmDelete = async () => {
    if (!deleteItem) return
    try {
      if (deleteItem.type === 'profile' && deleteItem.username) {
        await deleteProfile(deleteItem.username)
        setSelectedProfile(null)
      } else if (deleteItem.type === 'm3u' && deleteItem.username && deleteItem.uuid) {
        await removeM3UFromProfile(deleteItem.username, deleteItem.uuid)
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setDeleteItem(null)
    }
  }

  const handleAddProfile = async () => {
    if (!newUsername.trim() || !newProfileUrl.trim()) return
    try {
      createProfile(newUsername.trim())
      const uuid = addM3UToProfile(newUsername.trim(), newProfileUrl.trim())
      setPanel('list')
      setSelectedProfile(newUsername.trim())
      setNewUsername('')
      setNewProfileUrl('')
      pendingDone.current = true
      await selectProfile(newUsername.trim(), uuid)
      update()
    } catch (error) {
      console.error('Failed to add profile:', error)
    }
  }

  const handleAddM3USubmit = async () => {
    if (!selectedProfile || !addM3UUrl.trim()) return
    try {
      const uuid = addM3UToProfile(selectedProfile, addM3UUrl.trim())
      setShowAddM3U(false)
      setAddM3UUrl('')
      pendingDone.current = true
      await selectProfile(selectedProfile, uuid)
      update()
    } catch (error) {
      console.error('Failed to add M3U:', error)
    }
  }

  return (
    <div className="flex-1 min-h-0 bg-background text-foreground flex flex-col relative">
      <div className={`flex-1 flex overflow-hidden${isLocked ? ' pointer-events-none select-none opacity-60' : ''}`}>
        <ProfileList
          profiles={sortedProfiles}
          selectedProfile={selectedProfile}
          currentUsername={currentUsername}
          onSelectProfile={(u) => { setSelectedProfile(u); setPanel('list'); setShowAddM3U(false) }}
          onDeleteProfile={handleDeleteProfile}
          onAddProfile={() => { setPanel('add-profile'); setShowAddM3U(false) }}
        />

        {panel === 'add-profile' ? (
          <AddProfileForm
            username={newUsername}
            url={newProfileUrl}
            onUsernameChange={setNewUsername}
            onUrlChange={setNewProfileUrl}
            onSubmit={handleAddProfile}
            onCancel={() => setPanel('list')}
          />
        ) : (
          <M3USourceList
            selectedProfile={selectedProfile}
            syncingUUID={syncingUUID}
            showAddForm={showAddM3U}
            addUrl={addM3UUrl}
            onAddUrlChange={setAddM3UUrl}
            onSelectM3U={handleSelectM3U}
            onSyncM3U={handleSyncM3U}
            onDeleteM3U={handleDeleteM3U}
            onAddM3U={() => setShowAddM3U(true)}
            onAddSubmit={handleAddM3USubmit}
            onAddCancel={() => { setShowAddM3U(false); setAddM3UUrl('') }}
          />
        )}
      </div>

      {/* status bar */}
      <div className={`px-8 py-2 ${statusMessage.status === 'idle' ? 'invisible' : 'visible'}`}>
        <span className={`text-xs ${
          statusMessage.status === 'error' ? 'text-destructive' :
          statusMessage.status === 'ready' ? 'text-success' :
          'text-muted-foreground'
        }`}>
          {statusMessage.message ?? '\u00A0'}
        </span>
        <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-border/20">
          <div
            className={`h-full transition-all duration-300 ${
              statusMessage.status === 'loading' ? 'bg-primary' :
              statusMessage.status === 'ready' ? 'bg-success' :
              'bg-transparent'
            }`}
            style={{ width: statusMessage.percent !== null ? `${statusMessage.percent}%` : '0%' }}
          />
        </div>
      </div>

      <div className="px-8 py-3 border-t border-border/10 text-muted-foreground/50 text-xs flex gap-6">
        <span>↑ ↓ ← → Gezin</span>
        <span>Enter Seç</span>
        <span>ESC Çık</span>
      </div>

      {/* confirm overlay */}
      {deleteItem && (
        <ConfirmDialog
          title="Silme Onayı"
          message={
            deleteItem.type === 'profile'
              ? `"${deleteItem.displayName}" profilini ve tüm verilerini kalıcı olarak silmek istiyor musunuz?`
              : `"${deleteItem.displayName}" M3U kaynağını bu profilden kaldırmak istiyor musunuz?`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </div>
  )
}
