import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FocusCard } from '@/components/Navigation'
import { CardContent } from '@zenith-tv/ui/card'

interface NavigationCardProps {
  type: 'prev' | 'next'
  onClick: () => void
  page?: number
}

export function NavigationCard({ type, onClick, page }: NavigationCardProps) {
  return (
    <FocusCard
      focusId={`nav-${type}`}
      onClick={onClick}
      className="bg-gray-800 border-2 border-dashed border-gray-600 hover:border-gray-500 transition-colors h-full"
    >
      <CardContent className="p-6 flex flex-col items-center justify-center h-full">
        {type === 'prev' ? (
          <>
            <ChevronLeft className="w-12 h-12 mb-2 text-gray-400" />
            <span className="text-lg font-semibold text-gray-300">Previous</span>
            {page !== undefined && (
              <span className="text-sm text-gray-500 mt-1">Page {page}</span>
            )}
          </>
        ) : (
          <>
            <ChevronRight className="w-12 h-12 mb-2 text-gray-400" />
            <span className="text-lg font-semibold text-gray-300">Next</span>
            {page !== undefined && (
              <span className="text-sm text-gray-500 mt-1">Page {page}</span>
            )}
          </>
        )}
      </CardContent>
    </FocusCard>
  )
}
