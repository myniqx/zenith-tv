import { ReactNode, useEffect, createContext, useContext } from 'react'
import { useNavigation } from './NavigationContext'

interface FocusScopeProps {
  id: string
  children: ReactNode
  active?: boolean
  onBack?: () => void
  onLeave?: (direction: 'up' | 'down' | 'left' | 'right') => void
}

interface FocusScopeContextValue {
  scopeId: string
}

const FocusScopeContext = createContext<FocusScopeContextValue | null>(null)

export function useFocusScopeContext() {
  return useContext(FocusScopeContext)
}

export function FocusScope({ id, children, active = true, onBack, onLeave }: FocusScopeProps) {
  const { pushScope, popScope } = useNavigation()

  useEffect(() => {
    if (active) {
      pushScope(id, onBack, onLeave)
      return () => {
        popScope(id)
      }
    }
  }, [id, active, onBack, onLeave, pushScope, popScope])

  return (
    <FocusScopeContext.Provider value={{ scopeId: id }}>
      {children}
    </FocusScopeContext.Provider>
  )
}
