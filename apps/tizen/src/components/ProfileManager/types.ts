export type View = 'main' | 'add-profile' | 'add-m3u' | 'confirm-delete'

export interface DeleteItem {
  type: 'profile' | 'm3u'
  username?: string
  uuid?: string
  displayName?: string
}

export interface M3UStatsPlaceholderProps {
  uuid: string
}

export interface AddProfileFormProps {
  username: string
  url: string
  onUsernameChange: (value: string) => void
  onUrlChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export interface AddM3UFormProps {
  url: string
  onUrlChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export interface ProfileListProps {
  profiles: Array<{ username: string; m3uRefs: string[] }>
  selectedIndex: number
  isFocused: boolean
  onDeleteProfile: (username: string) => void
}

export interface M3USourceListProps {
  profile: { username: string; m3uRefs: string[] }
  selectedIndex: number
  isFocused: boolean
  syncingUUID: string | null
  getM3UDisplayName: (uuid: string) => string
  onSyncM3U: (uuid: string) => void
  onDeleteM3U: (username: string, uuid: string) => void
}
