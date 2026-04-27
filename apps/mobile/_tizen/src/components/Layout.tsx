import { ReactNode } from 'react'
import { HEADER_HEIGHT } from './Header'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <main
      className="bg-background overflow-auto"
      style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT}px)` }}
    >
      {children}
    </main>
  )
}
