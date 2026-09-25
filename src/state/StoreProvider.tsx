import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { reducer } from '../domain/workflow'
import { loadState, saveState } from './persistence'
import { StoreContext } from './store'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => saveState(state), [state])

  const store = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
