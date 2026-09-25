import { createSeed } from '../data/seed'
import type { AppState } from '../domain/types'

// Bump when the stored shape changes, so browsers holding old data start fresh from the seed.
const STORAGE_KEY = 'clearpath-review:v2'

function isAppState(value: unknown): value is AppState {
  const v = value as AppState | null
  return (
    !!v &&
    Array.isArray(v.partners) &&
    Array.isArray(v.submissions) &&
    v.submissions.every((s) => Array.isArray(s.versions) && s.versions.length > 0)
  )
}

/** Loads saved state, falling back to fresh seed data if nothing valid is stored. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isAppState(parsed)) return parsed
    }
  } catch {
    // Unreadable or corrupt storage: start from seed data.
  }
  return createSeed()
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage may be unavailable (private mode, quota). The app still works in memory.
  }
}
