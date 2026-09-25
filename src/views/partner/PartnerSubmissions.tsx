import { Link, useNavigate, useParams } from 'react-router'
import { StatusBadge } from '../../components/StatusBadge'
import { ASSET_TYPE_LABELS, PRODUCT_LABELS } from '../../domain/catalog'
import { lastEventAt } from '../../domain/queue'
import type { Submission } from '../../domain/types'
import { latestVersion } from '../../domain/workflow'
import { timeAgo } from '../../lib/format'
import { useAppState } from '../../state/store'

// Anything the partner needs to act on comes first, then most recent activity.
const byActionThenRecent = (a: Submission, b: Submission) =>
  Number(b.status === 'changes_requested') - Number(a.status === 'changes_requested') ||
  lastEventAt(b).localeCompare(lastEventAt(a))

export function PartnerSubmissions() {
  const { partnerId } = useParams()
  const { submissions, partners } = useAppState()
  const navigate = useNavigate()
  const partner = partners.find((p) => p.id === partnerId)

  if (!partner) {
    return (
      <div className="empty-state card">
        <h2>Partner not found</h2>
        <Link to="/review">Back to review queue</Link>
      </div>
    )
  }

  const mine = submissions.filter((s) => s.partnerId === partner.id).sort(byActionThenRecent)
  const actionNeeded = mine.filter((s) => s.status === 'changes_requested').length

  return (
    <section className="page">
      <header className="page-header">
        <h1>Your submissions</h1>
        <p className="page-summary">
          {partner.name} · Marketing submitted to ClearPath Financial for compliance review
          {actionNeeded > 0 && (
            <>
              {' · '}
              <strong className="due-soon">{actionNeeded}</strong> need{actionNeeded === 1 ? 's' : ''} your changes
            </>
          )}
        </p>
      </header>

      {mine.length === 0 ? (
        <div className="empty-state card">
          <h2>No submissions yet</h2>
          <p>Marketing you submit for review will appear here.</p>
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Submission</th>
                <th>Product & asset</th>
                <th>Version</th>
                <th>Status</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((s) => (
                <tr
                  key={s.id}
                  className="clickable-row"
                  onClick={() => navigate(`/partner/${partner.id}/${s.id}`)}
                >
                  <td>
                    <div className="cell-stack">
                      <Link
                        to={`/partner/${partner.id}/${s.id}`}
                        className="row-title"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {s.title}
                      </Link>
                      {s.status === 'changes_requested' && (
                        <span className="pill pill-action">Action needed</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span>{PRODUCT_LABELS[s.product]}</span>
                      <span className="subtle">{ASSET_TYPE_LABELS[s.assetType]}</span>
                    </div>
                  </td>
                  <td>v{latestVersion(s).number}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>{timeAgo(lastEventAt(s))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
