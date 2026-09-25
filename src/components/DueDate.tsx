import { dueLabel, formatDate } from '../lib/format'

export function DueDate({ iso }: { iso?: string }) {
  if (!iso) return <span className="subtle">No date</span>
  const { label, urgency } = dueLabel(iso)
  return (
    <span className={`due due-${urgency}`} title={formatDate(iso)}>
      {label}
    </span>
  )
}
