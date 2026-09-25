import { EVENT_LABELS } from '../domain/catalog'
import type { HistoryEvent } from '../domain/types'
import { formatDateTime } from '../lib/format'

export function History({ events }: { events: HistoryEvent[] }) {
  return (
    <ol className="history">
      {[...events].reverse().map((e) => (
        <li key={e.id}>
          <strong>{EVENT_LABELS[e.type]}</strong> v{e.version} · {e.actor} · {formatDateTime(e.at)}
          {e.note && <div className="muted">{e.note}</div>}
        </li>
      ))}
    </ol>
  )
}
