import { useState, useEffect } from 'react'
import { Film, Tv, Radio } from 'lucide-react'
import { fileSystem } from '@/lib/filesystem'
import type { M3UStats } from '@zenith-tv/content'

interface M3UStatsPlaceholderProps {
  uuid: string
}

const getM3UStats = (uuid: string) => `m3u/${uuid}/stats.json`

export function M3UStatsPlaceholder({ uuid }: M3UStatsPlaceholderProps) {
  const [stats, setStats] = useState<M3UStats | null>(null)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fileSystem.readJSONOrDefault<M3UStats | null>(getM3UStats(uuid), null)
        setStats(data)
      } catch (error) {
        console.error(`Failed to load stats for ${uuid}:`, error)
      }
    }

    loadStats()
  }, [uuid])

  if (!stats) {
    return (
      <div className="flex items-center gap-6 text-sm text-gray-400">
        <span className="flex items-center gap-2">
          <Film className="w-4 h-4" />
          --- filmler
        </span>
        <span className="flex items-center gap-2">
          <Tv className="w-4 h-4" />
          --- diziler
        </span>
        <span className="flex items-center gap-2">
          <Radio className="w-4 h-4" />
          --- canlı
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-6 text-sm text-gray-400">
      <span className="flex items-center gap-2">
        <Film className="w-4 h-4" />
        {stats.movieCount} filmler
      </span>
      <span className="flex items-center gap-2">
        <Tv className="w-4 h-4" />
        {stats.tvShowCount} diziler
      </span>
      <span className="flex items-center gap-2">
        <Radio className="w-4 h-4" />
        {stats.liveStreamCount} canlı
      </span>
    </div>
  )
}
