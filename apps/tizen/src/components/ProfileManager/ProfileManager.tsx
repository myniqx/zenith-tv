import { useState } from 'react'
import { useProfilesStore } from '@/stores/profiles'
import { FocusScope } from '@/contexts/FocusScope'
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
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)

  const [newUsername, setNewUsername] = useState('')
  const [newM3UUrl, setNewM3UUrl] = useState('')

  const [deleteItem, setDeleteItem] = useState<DeleteItem | null>(null)

  const [syncingUUID, setSyncingUUID] = useState<string | null>(null)

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
        setSelectedProfile(null)
      } else if (deleteItem.type === 'm3u' && deleteItem.username && deleteItem.uuid) {
        await removeM3UFromProfile(deleteItem.username, deleteItem.uuid)
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
      setSelectedProfile(newUsername.trim())
    } catch (error) {
      console.error('Failed to add profile:', error)
    }
  }

  const handleAddM3U = async () => {
    if (!selectedProfile || !newM3UUrl.trim()) return

    try {
      await addM3UToProfile(selectedProfile, newM3UUrl.trim())
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
            selectedProfile={selectedProfile}
            onSelectProfile={setSelectedProfile}
            onDeleteProfile={handleDeleteProfile}
            onAddProfile={() => setView('add-profile')}
          />

          <M3USourceList
            selectedProfile={selectedProfile}
            syncingUUID={syncingUUID}
            onSyncM3U={handleSyncM3U}
            onDeleteM3U={handleDeleteM3U}
            onAddM3U={() => setView('add-m3u')}
          />
        </div>

        <div className="bg-gray-800 px-8 py-4 text-gray-400 text-sm flex gap-8">
          <span>↑ ↓ ← → : Gezin</span>
          <span>Enter : Seç</span>
          <span>ESC : Çık</span>
        </div>
      </div>
    )
  }

  if (view === 'add-profile') {
    return (
      <FocusScope id="add-profile-form" active={true}>
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
      </FocusScope>
    )
  }

  if (view === 'add-m3u') {
    return (
      <FocusScope id="add-m3u-form" active={true}>
        <AddM3UForm
          url={newM3UUrl}
          onUrlChange={setNewM3UUrl}
          onSubmit={handleAddM3U}
          onCancel={() => {
            setView('main')
            setNewM3UUrl('')
          }}
        />
      </FocusScope>
    )
  }

  if (view === 'confirm-delete' && deleteItem) {
    return (
      <FocusScope id="confirm-dialog" active={true}>
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
      </FocusScope>
    )
  }

  return null
}

async function syncM3U(uuid: string): Promise<void> {
  console.log('TODO: Sync M3U', uuid)
  await new Promise(resolve => setTimeout(resolve, 1000))
}
