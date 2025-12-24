import { ReactNode } from 'react'
import { HEADER_HEIGHT } from './Header'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <main
      className="bg-gray-900 overflow-auto"
      style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}
    >
      {children}
    </main>
  )
}
