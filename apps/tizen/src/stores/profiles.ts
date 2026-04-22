import { createProfilesStore } from '@zenith-tv/content'
import { fileSystem } from '@/lib/filesystem'

// Lazy getter to break circular dependency: content.ts imports profiles.ts, profiles.ts imports content.ts
// The getter is called at runtime (not module init time), so both modules are already loaded by then.
let _getContentState: (() => ReturnType<typeof import('./content')['useContentStore']['getState']>) | null = null

const getContentStore = () => {
  if (!_getContentState) {
    // Dynamic import is not needed — by the time any action is called, both stores are initialized.
    // We import the module reference lazily via a side-effect-free accessor.
    _getContentState = () => (globalThis as any).__zenith_content_store?.getState() ?? null
  }
  const state = _getContentState()
  if (!state) return null
  return {
    currentUsername: state.currentUsername,
    currentUUID: state.currentUUID,
    reset: state.reset,
    setContent: state.setContent,
  }
}

export const useProfilesStore = createProfilesStore(
  { fileSystem, getContentStore },
  'zenith-tizen-profiles'
)

export type { Profile } from '@zenith-tv/content'
