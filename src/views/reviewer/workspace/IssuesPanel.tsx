import { FIELD_LABELS } from '../../../domain/catalog'
import { CHECK_RULES, type Finding } from '../../../domain/checks'
import type { Submission } from '../../../domain/types'
import { currentFindings, findingReview, isUnderReview } from '../../../domain/workflow'
import { useActions } from '../../../state/store'

interface Props {
  submission: Submission
  activeKey: string | null
  onSelect: (key: string) => void
}

export function IssuesPanel({ submission, activeKey, onSelect }: Props) {
  const findings = currentFindings(submission)
  const reviewed = findings.filter((f) => findingReview(submission, f.key)).length

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Potential issues</h2>
        {findings.length > 0 && (
          <span className="subtle">
            {reviewed} of {findings.length} reviewed
          </span>
        )}
      </div>

      {findings.length === 0 ? (
        <p className="muted">No potential issues detected by automated checks. Reviewer judgment still required.</p>
      ) : (
        <ul className="issue-list">
          {findings.map((f) => (
            <IssueCard
              key={f.key}
              submission={submission}
              finding={f}
              active={f.key === activeKey}
              onSelect={() => onSelect(f.key)}
            />
          ))}
        </ul>
      )}

      <p className="panel-footnote">
        Automated checks flag language for review. They don’t make compliance determinations.
      </p>
    </section>
  )
}

interface CardProps {
  submission: Submission
  finding: Finding
  active: boolean
  onSelect: () => void
}

function IssueCard({ submission, finding, active, onSelect }: CardProps) {
  const actions = useActions()
  const rule = CHECK_RULES[finding.ruleId]
  const review = findingReview(submission, finding.key)
  const editable = isUnderReview(submission)

  const state = review ? review.decision : 'open'

  return (
    <li
      className={`issue-card issue-${state} ${active ? 'issue-active' : ''}`}
      data-issue={finding.key}
      onClick={onSelect}
    >
      <div className="issue-top">
        <span className="issue-rule">{rule.label}</span>
        <span className="subtle">{FIELD_LABELS[finding.field]}</span>
      </div>
      <div className="issue-quote">“{finding.text}”</div>
      <p className="issue-why">{rule.explanation}</p>

      {review ? (
        <div className="issue-status" onClick={(e) => e.stopPropagation()}>
          <span className={review.decision === 'confirmed' ? 'status-confirmed' : 'status-dismissed'}>
            {review.decision === 'confirmed'
              ? editable
                ? 'Confirmed · added to feedback draft'
                : 'Confirmed · included in feedback'
              : 'Dismissed'}
          </span>
          {review.note && <span className="subtle"> · {review.note}</span>}
          {editable && (
            <button className="btn-link" onClick={() => actions.clearFindingReview(submission.id, finding.key)}>
              Undo
            </button>
          )}
        </div>
      ) : editable ? (
        <div className="button-row" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn"
            onClick={() => actions.reviewFinding(submission.id, finding, 'confirmed', rule.guidance)}
          >
            Confirm issue
          </button>
          <button className="btn" onClick={() => actions.reviewFinding(submission.id, finding, 'dismissed')}>
            Dismiss
          </button>
        </div>
      ) : (
        <span className="subtle">Not reviewed</span>
      )}
    </li>
  )
}
