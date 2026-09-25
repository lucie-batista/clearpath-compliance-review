const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => date.format(new Date(iso))

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "just now", "12m ago", "3h ago", "2d ago" */
export function timeAgo(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime()
  if (ms < MINUTE) return 'just now'
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`
  return `${Math.floor(ms / DAY)}d ago`
}

export type Urgency = 'overdue' | 'soon' | 'normal'

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Calendar-day deadline label plus urgency, e.g. "Due tomorrow" / soon. */
export function dueLabel(iso: string, now = new Date()): { label: string; urgency: Urgency } {
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY)
  if (days < 0) return { label: days === -1 ? 'Overdue by 1 day' : `Overdue by ${-days} days`, urgency: 'overdue' }
  if (days === 0) return { label: 'Due today', urgency: 'soon' }
  if (days === 1) return { label: 'Due tomorrow', urgency: 'soon' }
  if (days === 2) return { label: 'Due in 2 days', urgency: 'soon' }
  return { label: `Due in ${days} days`, urgency: 'normal' }
}
