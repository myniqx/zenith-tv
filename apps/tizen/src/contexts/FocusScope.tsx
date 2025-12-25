import { ReactNode, useEffect } from 'react'
import { useNavigation } from './NavigationContext'

interface FocusScopeProps {
  id: string
  children: ReactNode
  active?: boolean
}

export function FocusScope({ id, children, active = true }: FocusScopeProps) {
  const { setActiveScope } = useNavigation()

  useEffect(() => {
    if (active) {
      setActiveScope(id)
      return () => setActiveScope(null)
    }
  }, [id, active, setActiveScope])

  return <>{children}</>
}
