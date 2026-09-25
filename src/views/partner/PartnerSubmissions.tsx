import { Link, useParams } from 'react-router'
import { ASSET_TYPE_LABELS, STATUS_LABELS } from '../../domain/catalog'
import { latestVersion } from '../../domain/workflow'
import { formatDateTime } from '../../lib/format'
import { useAppState } from '../../state/store'

export function PartnerSubmissions() {
  const { partnerId } = useParams()
  const { submissions, partners } = useAppState()
  const partner = partners.find((p) => p.id === partnerId)
  const mine = submissions.filter((s) => s.partnerId === partnerId)

  if (!partner) return <p>Partner not found.</p>

  return (
    <section>
      <h1>{partner.name}: your submissions</h1>
      {mine.length === 0 && <p className="muted">You haven’t submitted anything for review yet.</p>}
      <ul className="partner-list">
        {mine.map((s) => (
          <li key={s.id}>
            <Link to={`/partner/${partner.id}/${s.id}`}>{s.title}</Link>
            {' · '}
            {ASSET_TYPE_LABELS[s.assetType]} · v{latestVersion(s).number} ·{' '}
            <strong>{s.status === 'changes_requested' ? 'Action needed: changes requested' : STATUS_LABELS[s.status]}</strong>
            <div className="muted">Last updated {formatDateTime(s.events[s.events.length - 1].at)}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}
