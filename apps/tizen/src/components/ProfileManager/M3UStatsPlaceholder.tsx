import { Film, Tv, Radio } from 'lucide-react'
import type { M3UStatsPlaceholderProps } from './types'

export function M3UStatsPlaceholder(_props: M3UStatsPlaceholderProps) {
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
