import { useState, useEffect, useMemo } from 'react'
import { useProfilesStore } from '@/stores/profiles'
import { FocusScope } from '@/contexts/FocusScope'
import { ProfileList } from './ProfileList'
import { M3USourceList } from './M3USourceList'
import { AddProfileForm } from './AddProfileForm'
import { AddM3UForm } from './AddM3UForm'
import { ConfirmDialog } from './ConfirmDialog'
import type { View, DeleteItem } from './types'
import { useContentStore } from '@/stores/content'

export function ProfileManager() {
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

  const { currentUUID, update } = useContentStore()

  const [view, setView] = useState<View>('main')
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<DeleteItem | null>(null)
  const [syncingUUID, setSyncingUUID] = useState<string | null>(null)

  const currentUsername = getCurrentUsername()

  const sortedProfiles = useMemo(() => {
    return [...profiles].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0))
  }, [profiles])

  useEffect(() => {
    if (!selectedProfile && sortedProfiles.length > 0) {
      setSelectedProfile(currentUsername || sortedProfiles[0].username)
    }
  }, [sortedProfiles, currentUsername, selectedProfile])

  const handleSyncM3U = async (uuid: string) => {
    setSyncingUUID(uuid)
    try {
      if (currentUUID === uuid) {
        update()
      } else {
        if (selectedProfile) {
          await selectProfile(selectedProfile, uuid)
          await update()
        }
      }
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

  const handleAddProfile = async (username: string, url: string) => {
    try {
      await createProfile(username)
      await addM3UToProfile(username, url)
      setView('main')
      setSelectedProfile(username)
    } catch (error) {
      console.error('Failed to add profile:', error)
    }
  }

  const handleAddM3U = async (url: string) => {
    if (!selectedProfile) return

    try {
      await addM3UToProfile(selectedProfile, url)
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
            profiles={sortedProfiles}
            selectedProfile={selectedProfile}
            currentUsername={currentUsername}
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
      <FocusScope id="add-profile-form" onBack={() => setView('main')}>
        <AddProfileForm
          onSubmit={handleAddProfile}
          onCancel={() => setView('main')}
        />
      </FocusScope>
    )
  }

  if (view === 'add-m3u') {
    return (
      <FocusScope id="add-m3u-form" onBack={() => setView('main')}>
        <AddM3UForm
          onSubmit={handleAddM3U}
          onCancel={() => setView('main')}
        />
      </FocusScope>
    )
  }

  if (view === 'confirm-delete' && deleteItem) {
    return (
      <FocusScope
        id="confirm-dialog"
        onBack={() => {
          setView('main')
          setDeleteItem(null)
        }}
      >
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

}
