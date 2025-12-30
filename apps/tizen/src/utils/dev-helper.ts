import { useProfilesStore } from '@/stores/profiles'

const DEV_MODE = import.meta.env.DEV

const TEST_M3U_PATH = '/test/test.m3u'
const TEST_PROFILE_NAME = 'Test User'

export async function initDevEnvironment() {
  if (!DEV_MODE) return

  const { profiles, createProfile, addM3UToProfile, selectProfile, getUrlFromUUID } = useProfilesStore.getState()

  let existingProfile = profiles.find(p => p.username === TEST_PROFILE_NAME)

  if (!existingProfile) {
    console.log('[DEV] Creating test profile...')
    try {
      createProfile(TEST_PROFILE_NAME)
      existingProfile = useProfilesStore.getState().profiles.find(p => p.username === TEST_PROFILE_NAME)
    } catch (error) {
      console.error('[DEV] Failed to create test profile:', error)
      return
    }
  }

  if (!existingProfile) {
    console.error('[DEV] Profile not found after creation')
    return
  }

  const testM3UURL = window.location.origin + TEST_M3U_PATH
  const existingUUID = existingProfile.m3uRefs.find(uuid => {
    const url = getUrlFromUUID(uuid)
    return url === testM3UURL
  })

  let uuid = existingUUID

  if (!existingUUID) {
    console.log('[DEV] Adding test M3U to profile...')
    try {
      uuid = addM3UToProfile(TEST_PROFILE_NAME, testM3UURL)
    } catch (error) {
      console.error('[DEV] Failed to add M3U:', error)
      return
    }
  }

  if (uuid) {
    console.log('[DEV] Loading test content...')
    try {
      await selectProfile(TEST_PROFILE_NAME, uuid)
      console.log('[DEV] Test environment ready!')
    } catch (error) {
      console.error('[DEV] Failed to load content:', error)
    }
  }
}
