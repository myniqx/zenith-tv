import { useState, useEffect } from 'react'
import { useProfilesStore } from '@/stores/profiles'
import { ProfileList } from './ProfileList'
import { M3USourceList } from './M3USourceList'
import { AddProfileForm } from './AddProfileForm'
import { AddM3UForm } from './AddM3UForm'
import { ConfirmDialog } from './ConfirmDialog'
import type { View, DeleteItem } from './types'

export function ProfileManager() {
  const {
    profiles,
    createProfile,
    deleteProfile,
    addM3UToProfile,
    removeM3UFromProfile,
  } = useProfilesStore()

  const [view, setView] = useState<View>('main')
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(0)
  const [focusArea, setFocusArea] = useState<'profiles' | 'm3u'>('profiles')
  const [selectedM3UIndex, setSelectedM3UIndex] = useState(0)

  const [newUsername, setNewUsername] = useState('')
  const [newM3UUrl, setNewM3UUrl] = useState('')

  const [deleteItem, setDeleteItem] = useState<DeleteItem | null>(null)

  const [syncingUUID, setSyncingUUID] = useState<string | null>(null)

  const selectedProfile = profiles[selectedProfileIndex]

  useEffect(() => {
    setSelectedM3UIndex(0)
  }, [selectedProfileIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'main') return

      const keyMap: Record<number, string> = {
        38: 'up',
        40: 'down',
        37: 'left',
        39: 'right',
        13: 'enter',
        8: 'back',
        27: 'back',
      }

      const action = keyMap[e.keyCode]
      if (!action) return

      e.preventDefault()

      switch (action) {
        case 'up':
          if (focusArea === 'profiles') {
            setSelectedProfileIndex(Math.max(0, selectedProfileIndex - 1))
          } else if (selectedProfile) {
            setSelectedM3UIndex(Math.max(0, selectedM3UIndex - 1))
          }
          break

        case 'down':
          if (focusArea === 'profiles') {
            setSelectedProfileIndex(Math.min(profiles.length, selectedProfileIndex + 1))
          } else if (selectedProfile) {
            setSelectedM3UIndex(Math.min(selectedProfile.m3uRefs.length, selectedM3UIndex + 1))
          }
          break

        case 'left':
          setFocusArea('profiles')
          break

        case 'right':
          if (selectedProfile) {
            setFocusArea('m3u')
          }
          break

        case 'enter':
          handleEnter()
          break

        case 'back':
          window.dispatchEvent(new CustomEvent('close-profile-manager'))
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, focusArea, selectedProfileIndex, selectedM3UIndex, profiles, selectedProfile])

  const handleEnter = () => {
    if (focusArea === 'profiles') {
      if (selectedProfileIndex === profiles.length) {
        setView('add-profile')
      }
    } else if (focusArea === 'm3u' && selectedProfile) {
      if (selectedM3UIndex === selectedProfile.m3uRefs.length) {
        setView('add-m3u')
      } else {
        const uuid = selectedProfile.m3uRefs[selectedM3UIndex]
        handleSyncM3U(uuid)
      }
    }
  }

  const handleSyncM3U = async (uuid: string) => {
    setSyncingUUID(uuid)
    try {
      await syncM3U(uuid)
    } catch (error) {
      console.error('Failed to sync M3U:', error)
    } finally {
      setSyncingUUID(null)
    }
  }

  const handleDeleteProfile = (username: string) => {
    setDeleteItem({
      type: 'profile',
      username,
      displayName: username
    })
    setView('confirm-delete')
  }

  const handleDeleteM3U = (username: string, uuid: string) => {
    const { getUrlFromUUID } = useProfilesStore.getState()
    const url = getUrlFromUUID(uuid)
    let displayName = uuid.slice(0, 8)

    if (url) {
      try {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname
        const filename = pathname.split('/').pop()
        displayName = filename || urlObj.hostname
      } catch {
        displayName = url.slice(0, 30) + (url.length > 30 ? '...' : '')
      }
    }

    setDeleteItem({
      type: 'm3u',
      username,
      uuid,
      displayName
    })
    setView('confirm-delete')
  }

  const handleConfirmDelete = async () => {
    if (!deleteItem) return

    try {
      if (deleteItem.type === 'profile' && deleteItem.username) {
        await deleteProfile(deleteItem.username)
        setSelectedProfileIndex(Math.max(0, selectedProfileIndex - 1))
      } else if (deleteItem.type === 'm3u' && deleteItem.username && deleteItem.uuid) {
        await removeM3UFromProfile(deleteItem.username, deleteItem.uuid)
        setSelectedM3UIndex(Math.max(0, selectedM3UIndex - 1))
      }
      setView('main')
      setDeleteItem(null)
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleAddProfile = async () => {
    if (!newUsername.trim() || !newM3UUrl.trim()) return

    try {
      await createProfile(newUsername.trim())
      await addM3UToProfile(newUsername.trim(), newM3UUrl.trim())
      setNewUsername('')
      setNewM3UUrl('')
      setView('main')
      setSelectedProfileIndex(profiles.length)
    } catch (error) {
      console.error('Failed to add profile:', error)
    }
  }

  const handleAddM3U = async () => {
    if (!selectedProfile || !newM3UUrl.trim()) return

    try {
      await addM3UToProfile(selectedProfile.username, newM3UUrl.trim())
      setNewM3UUrl('')
      setView('main')
    } catch (error) {
      console.error('Failed to add M3U:', error)
    }
  }

  if (view === 'main') {
    return (
      <div className="h-full bg-gray-900 text-white flex flex-col">
        <div className="flex-1 flex overflow-hidden">
          <ProfileList
            selectedIndex={selectedProfileIndex}
            isFocused={focusArea === 'profiles'}
            onDeleteProfile={handleDeleteProfile}
            onAddProfile={() => setView('add-profile')}
          />

          <M3USourceList
            selectedProfileIndex={selectedProfileIndex}
            selectedIndex={selectedM3UIndex}
            isFocused={focusArea === 'm3u'}
            syncingUUID={syncingUUID}
            onSyncM3U={handleSyncM3U}
            onDeleteM3U={handleDeleteM3U}
            onAddM3U={() => setView('add-m3u')}
          />
        </div>

        <div className="bg-gray-800 px-8 py-4 text-gray-400 text-sm flex gap-8">
          <span>↑ ↓ : Listede gezin</span>
          <span>← → : Panel değiştir</span>
          <span>Enter : Seç</span>
          <span>ESC : Çık</span>
        </div>
      </div>
    )
  }

  if (view === 'add-profile') {
    return (
      <AddProfileForm
        username={newUsername}
        url={newM3UUrl}
        onUsernameChange={setNewUsername}
        onUrlChange={setNewM3UUrl}
        onSubmit={handleAddProfile}
        onCancel={() => {
          setView('main')
          setNewUsername('')
          setNewM3UUrl('')
        }}
      />
    )
  }

  if (view === 'add-m3u') {
    return (
      <AddM3UForm
        url={newM3UUrl}
        onUrlChange={setNewM3UUrl}
        onSubmit={handleAddM3U}
        onCancel={() => {
          setView('main')
          setNewM3UUrl('')
        }}
      />
    )
  }

  if (view === 'confirm-delete' && deleteItem) {
    return (
      <ConfirmDialog
        title="Silme Onayı"
        message={
          deleteItem.type === 'profile'
            ? `"${deleteItem.displayName}" profilini ve tüm verilerini kalıcı olarak silmek istediğinizden emin misiniz?`
            : `"${deleteItem.displayName}" M3U kaynağını bu profilden kaldırmak istediğinizden emin misiniz?`
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setView('main')
          setDeleteItem(null)
        }}
      />
    )
  }

  return null
}

async function syncM3U(uuid: string): Promise<void> {
  console.log('TODO: Sync M3U', uuid)
  await new Promise(resolve => setTimeout(resolve, 1000))
}
