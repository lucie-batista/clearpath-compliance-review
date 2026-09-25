import { EVENT_LABELS } from '../domain/catalog'
import type { HistoryEvent } from '../domain/types'
import { formatDateTime } from '../lib/format'

/** Newest first. Every submission and decision is recorded with who and when. */
export function History({ events }: { events: HistoryEvent[] }) {
  return (
    <ol className="timeline">
      {[...events].reverse().map((e) => (
        <li key={e.id} className={`timeline-item timeline-${e.type}`}>
          <div className="timeline-line">
            <strong>{EVENT_LABELS[e.type]}</strong>
            <span className="subtle">
              {' '}
              v{e.version} · {e.actor} · {formatDateTime(e.at)}
            </span>
          </div>
          {e.note && <p className="timeline-note">{e.note}</p>}
        </li>
      ))}
    </ol>
  )
}
