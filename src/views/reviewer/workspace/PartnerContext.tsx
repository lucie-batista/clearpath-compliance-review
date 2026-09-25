import { CHECK_RULES } from '../../../domain/checks'
import { partnerHistory } from '../../../domain/partners'
import type { Partner, Submission } from '../../../domain/types'
import { useAppState } from '../../../state/store'

export function PartnerContext({ submission, partner }: { submission: Submission; partner?: Partner }) {
  const { submissions } = useAppState()
  const history = partnerHistory(submissions, submission)

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Partner history</h2>
        <span className="subtle">{partner?.name}</span>
      </div>
      {history.total === 0 ? (
        <p className="muted">First submission from this partner. No review history yet.</p>
      ) : (
        <>
          <dl className="stats">
            <div>
              <dt>Other submissions</dt>
              <dd>{history.total}</dd>
            </div>
            <div>
              <dt>Needed changes</dt>
              <dd>{history.neededChanges}</dd>
            </div>
            <div>
              <dt>Approved</dt>
              <dd>{history.approved}</dd>
            </div>
          </dl>
          {history.flagged.length > 0 ? (
            <div className="flagged-before">
              <span className="subtle">Previously confirmed issues</span>
              <ul>
                {history.flagged.map((f) => (
                  <li key={f.ruleId}>
                    {CHECK_RULES[f.ruleId].label}
                    <span className="subtle"> × {f.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted">No issues confirmed on this partner’s previous submissions.</p>
          )}
        </>
      )}
    </section>
  )
}
