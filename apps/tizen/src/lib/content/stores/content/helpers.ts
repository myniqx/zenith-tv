import { WatchableObject, GroupObject } from '../../models'
import type { SortBy, SortOrder } from './types'

export const ALPHABETIC_GROUPS = [
  'A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'Ğ', 'H', 'I', 'İ', 'J', 'K', 'L',
  'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z', '#'
]

export const secondsToProgress = (position: number, duration: number): number => {
  if (duration <= 0) return 0
  return position / duration
}

export const sortItems = <T extends WatchableObject | GroupObject>(
  items: T[],
  sortBy: SortBy,
  sortOrder: SortOrder
): T[] => {
  return [...items].sort((a, b) => {
    let comparison = 0

    if (a instanceof WatchableObject && b instanceof WatchableObject) {
      switch (sortBy) {
        case 'name':
          comparison = a.Name.localeCompare(b.Name)
          break
        case 'date':
          comparison = new Date(a.AddedDate!).getTime() - new Date(b.AddedDate!).getTime()
          break
        case 'recent': {
          const aLastWatched = a.userData?.watchProgress?.updatedAt
          const bLastWatched = b.userData?.watchProgress?.updatedAt
          if (aLastWatched && bLastWatched) {
            comparison = bLastWatched - aLastWatched
          } else if (aLastWatched) {
            comparison = -1
          } else if (bLastWatched) {
            comparison = 1
          }
          break
        }
      }
    } else {
      comparison = a.Name.localeCompare(b.Name)
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })
}

export const filterBySearch = (items: WatchableObject[], searchQuery: string): WatchableObject[] => {
  if (!searchQuery.trim()) return items
  const query = searchQuery.toLowerCase()
  return items.filter(item => item.Name.toLowerCase().includes(query))
}

export const getFirstLetter = (name: string): string => {
  const firstChar = name.charAt(0).toUpperCase()
  if (ALPHABETIC_GROUPS.includes(firstChar)) {
    return firstChar
  }
  return '#'
}

export const collectGroupsRecursive = (group: GroupObject): GroupObject[] => {
  const collected: GroupObject[] = [...group.Groups]
  group.Groups.forEach(g => collected.push(...collectGroupsRecursive(g)))
  return collected
}

export const collectWatchablesRecursive = (group: GroupObject): WatchableObject[] => {
  const collected: WatchableObject[] = [...group.Watchables]
  group.Groups.forEach(g => collected.push(...collectWatchablesRecursive(g)))
  return collected
}

export const getUserDataPath = (username: string) => `userData/${username}.json`
export const getM3USource = (uuid: string) => `m3u/${uuid}/source.m3u`
export const getM3UUpdate = (uuid: string) => `m3u/${uuid}/update.json`
export const getM3UStats = (uuid: string) => `m3u/${uuid}/stats.json`
