import { useState, type ReactNode } from 'react'
import { FIELD_LABELS } from '../../../domain/catalog'
import { CHECK_RULES, type Finding } from '../../../domain/checks'
import { compareFindings } from '../../../domain/revision'
import type { Submission } from '../../../domain/types'
import { currentFindings, findingReview, isUnderReview, previousFindingReview } from '../../../domain/workflow'
import { REVIEWER_NAME } from '../../../data/seed'
import { useActions } from '../../../state/store'

interface Props {
  submission: Submission
  activeKey: string | null
  onSelect: (key: string) => void
}

export function IssuesPanel({ submission, activeKey, onSelect }: Props) {
  const findings = currentFindings(submission)
  const reviewed = findings.filter((f) => findingReview(submission, f.key)).length
  const comparison = compareFindings(submission)

  const card = (f: Finding) => (
    <IssueCard
      key={f.key}
      submission={submission}
      finding={f}
      active={f.key === activeKey}
      onSelect={() => onSelect(f.key)}
    />
  )

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

      {findings.length === 0 && (
        <p className="muted">No potential issues detected by automated checks. Reviewer judgment still required.</p>
      )}

      {comparison ? (
        // Resubmission: group by what changed since the previous version.
        <>
          {comparison.introduced.length > 0 && (
            <IssueGroup title={`New in v${comparison.toVersion}`}>{comparison.introduced.map(card)}</IssueGroup>
          )}
          {comparison.stillPresent.length > 0 && (
            <IssueGroup title={`Still there from v${comparison.fromVersion}`}>{comparison.stillPresent.map(card)}</IssueGroup>
          )}
          {comparison.resolved.length > 0 && (
            <IssueGroup title={`Fixed since v${comparison.fromVersion}`}>
              {comparison.resolved.map((f) => (
                <li key={f.key} className="issue-card issue-resolved">
                  <div className="issue-top">
                    <span className="issue-rule">{CHECK_RULES[f.ruleId].label}</span>
                    <span className="subtle">{FIELD_LABELS[f.field]}</span>
                  </div>
                  <div className="issue-quote">
                    <del>“{f.text}”</del>
                  </div>
                </li>
              ))}
            </IssueGroup>
          )}
        </>
      ) : (
        findings.length > 0 && <ul className="issue-list">{findings.map(card)}</ul>
      )}

      <p className="panel-footnote">
        Automated checks flag language for review. They don’t make compliance determinations.
      </p>
    </section>
  )
}

function IssueGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="issue-group">
      <h3 className="issue-group-title">{title}</h3>
      <ul className="issue-list">{children}</ul>
    </div>
  )
}

/** "You" for the person reviewing now, otherwise the colleague's name. */
const byWhom = (reviewer: string) => (reviewer === REVIEWER_NAME ? 'You' : reviewer)

interface CardProps {
  submission: Submission
  finding: Finding
  active: boolean
  onSelect: () => void
}

function IssueCard({ submission, finding, active, onSelect }: CardProps) {
  const actions = useActions()
  const rule = CHECK_RULES[finding.ruleId]
  const carried = findingReview(submission, finding.key)
  const prior = previousFindingReview(submission, finding.key)
  const editable = isUnderReview(submission)
  // "Review again" on a decision carried over from the previous version reopens the card.
  const [reopened, setReopened] = useState(false)
  const review = reopened && carried?.carriedFrom ? undefined : carried

  const state = review ? review.decision : 'open'
  const confirm = () => actions.reviewFinding(submission.id, finding, 'confirmed', rule.guidance)

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

      {!review && prior?.decision === 'confirmed' && (
        <p className="issue-history">Confirmed on v{prior.version} and sent back for changes. Text is unchanged.</p>
      )}

      {review ? (
        <div className="issue-status" onClick={(e) => e.stopPropagation()}>
          {review.carriedFrom ? (
            <>
              <span className="status-dismissed">
                {byWhom(review.reviewer)} dismissed this on v{review.carriedFrom}
              </span>
              <span className="subtle"> · text unchanged since</span>
              {review.note && <div className="status-note">“{review.note}”</div>}
              {editable && (
                <button className="btn-link btn-link-block" onClick={() => setReopened(true)}>
                  Change decision
                </button>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : editable ? (
        <div className="button-row" onClick={(e) => e.stopPropagation()}>
          <button className="btn" onClick={confirm}>
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
