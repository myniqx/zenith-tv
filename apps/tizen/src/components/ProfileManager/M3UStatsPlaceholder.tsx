import { useState, useEffect } from 'react'
import { Film, Tv, Radio } from 'lucide-react'
import { fileSystem } from '@/lib/filesystem'
import type { M3UStats } from '../../lib/content'

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
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5" />
          Henüz senkronize edilmedi
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Film className="w-3.5 h-3.5" />
        {stats.movieCount} film
      </span>
      <span className="flex items-center gap-1.5">
        <Tv className="w-3.5 h-3.5" />
        {stats.tvShowCount} dizi
      </span>
      <span className="flex items-center gap-1.5">
        <Radio className="w-3.5 h-3.5" />
        {stats.liveStreamCount} canlı
      </span>
    </div>
  )
}
