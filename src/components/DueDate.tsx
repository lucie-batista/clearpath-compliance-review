import { dueLabel, formatDate } from '../lib/format'

/** Relative, color-coded deadline while work is open; a plain date once the submission is decided. */
export function DueDate({ iso, open = true }: { iso?: string; open?: boolean }) {
  if (!iso) return <span className="subtle">No date</span>
  if (!open) return <span className="due due-normal">{formatDate(iso)}</span>
  const { label, urgency } = dueLabel(iso)
  return (
    <span className={`due due-${urgency}`} title={formatDate(iso)}>
      {label}
    </span>
  )
}
