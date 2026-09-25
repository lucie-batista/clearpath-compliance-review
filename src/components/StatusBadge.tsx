import { STATUS_LABELS } from '../domain/catalog'
import type { SubmissionStatus } from '../domain/types'

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}
