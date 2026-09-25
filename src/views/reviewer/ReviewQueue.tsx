import { Link } from 'react-router'
import { ASSET_TYPE_LABELS, PRODUCT_LABELS, STATUS_LABELS } from '../../domain/catalog'
import type { Submission } from '../../domain/types'
import { currentFindings, latestVersion } from '../../domain/workflow'
import { formatDate } from '../../lib/format'
import { useAppState } from '../../state/store'

const STATUS_ORDER = { awaiting_review: 0, changes_requested: 1, approved: 2, rejected: 3 }

function byQueueOrder(a: Submission, b: Submission) {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    (a.neededBy ?? '9999').localeCompare(b.neededBy ?? '9999')
  )
}

export function ReviewQueue() {
  const { submissions, partners } = useAppState()
  const partnerName = (id: string) => partners.find((p) => p.id === id)?.name ?? 'Unknown partner'

  return (
    <section>
      <h1>Review queue</h1>
      <table className="queue">
        <thead>
          <tr>
            <th>Submission</th>
            <th>Partner</th>
            <th>Product</th>
            <th>Asset type</th>
            <th>Version</th>
            <th>Status</th>
            <th>Potential issues</th>
            <th>Needed by</th>
          </tr>
        </thead>
        <tbody>
          {[...submissions].sort(byQueueOrder).map((s) => (
            <tr key={s.id}>
              <td>
                <Link to={`/review/${s.id}`}>{s.title}</Link>
              </td>
              <td>{partnerName(s.partnerId)}</td>
              <td>{PRODUCT_LABELS[s.product]}</td>
              <td>{ASSET_TYPE_LABELS[s.assetType]}</td>
              <td>v{latestVersion(s).number}</td>
              <td>{STATUS_LABELS[s.status]}</td>
              <td>{currentFindings(s).length}</td>
              <td>{s.neededBy ? formatDate(s.neededBy) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
