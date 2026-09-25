import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Start each new page at the top. Keyed on the path only, so switching queue tabs doesn't jump. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
