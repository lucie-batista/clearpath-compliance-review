import { useState } from 'react'
import { AI_CATEGORY_LABELS, FIELD_LABELS } from '../../../domain/catalog'
import type { AiFinding, Submission } from '../../../domain/types'
import { currentAiReview, findingReview, isUnderReview } from '../../../domain/workflow'
import { requestAiReview, type AiReviewError } from '../../../lib/aiReview'
import { timeAgo } from '../../../lib/format'
import { useActions } from '../../../state/store'

const ERROR_MESSAGES: Record<AiReviewError, string> = {
  not_configured: 'AI review isn’t enabled on this deployment. The rule-based checks above still apply.',
  rate_limited: 'Too many AI reviews in a short time. Try again in a few minutes.',
  busy: 'Claude is busy right now. Try again shortly.',
  declined: 'The AI review didn’t complete for this copy. The rule-based checks above still apply.',
  invalid: 'This copy can’t be sent for AI review.',
  failed: 'The AI review didn’t complete. Try again, or continue with the rule-based checks.',
  network: 'Couldn’t reach the AI review service. Check your connection and try again.',
}

const modelName = (id: string) => (id === 'claude-opus-5' ? 'Claude Opus 5' : id)

interface Props {
  submission: Submission
  activeKey: string | null
  onSelect: (key: string) => void
}

/** Optional AI second opinion. Suggestions only: the reviewer confirms or dismisses each one. */
export function AiReviewPanel({ submission, activeKey, onSelect }: Props) {
  const actions = useActions()
  const review = currentAiReview(submission)
  const editable = isUnderReview(submission)
  const [status, setStatus] = useState<{ state: 'idle' | 'loading' } | { state: 'error'; message: string }>({
    state: 'idle',
  })

  async function run() {
    setStatus({ state: 'loading' })
    const result = await requestAiReview(submission)
    if (result.ok) {
      actions.setAiReview(submission.id, result.review)
      setStatus({ state: 'idle' })
    } else {
      setStatus({ state: 'error', message: result.message ?? ERROR_MESSAGES[result.error] })
    }
  }

  if (!review && !editable) return null
  const loading = status.state === 'loading'

  return (
    <section className="panel ai-panel">
      <div className="panel-heading">
        <h2>
          AI second opinion <span className="ai-tag">Claude</span>
        </h2>
        {review && editable && !loading && (
          <button className="btn-link" onClick={run}>
            Re-run
          </button>
        )}
      </div>

      {!review && !loading && (
        <>
          <p className="panel-intro">
            Optional. Claude looks for what keyword checks miss: implied promises, missing context, and text aimed at
            reviewers. You make every decision.
          </p>
          <button className="btn" onClick={run}>
            Run AI review
          </button>
        </>
      )}

      {loading && (
        <p className="ai-loading" role="status">
          <span className="spinner" aria-hidden="true" /> Claude is reviewing the copy. This usually takes 10–30
          seconds.
        </p>
      )}

      {status.state === 'error' && <p className="ai-error">{status.message}</p>}

      {review && !loading && (
        <>
          <p className="subtle ai-meta">
            Ran {timeAgo(review.at)} · {modelName(review.model)}
          </p>
          {review.findings.length === 0 ? (
            <p className="muted">
              No additional potential issues found. Reviewer judgment still required.
            </p>
          ) : (
            <ul className="issue-list">
              {review.findings.map((f) => (
                <AiFindingCard
                  key={f.key}
                  submission={submission}
                  finding={f}
                  active={f.key === activeKey}
                  onSelect={() => onSelect(f.key)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <p className="ai-footnote">
        AI suggestions can be wrong. Nothing is sent or approved without you. The copy is treated as untrusted data,
        and text that tries to instruct reviewers is reported, never followed.
      </p>
    </section>
  )
}

function AiFindingCard({
  submission,
  finding,
  active,
  onSelect,
}: {
  submission: Submission
  finding: AiFinding
  active: boolean
  onSelect: () => void
}) {
  const actions = useActions()
  const review = findingReview(submission, finding.key)
  const editable = isUnderReview(submission)
  const state = review ? review.decision : 'open'
  const target = { key: finding.key, field: finding.field, text: finding.quote }

  return (
    <li
      className={`issue-card ai-card issue-${state} ${active ? 'issue-active' : ''}`}
      data-issue={finding.key}
      onClick={onSelect}
    >
      <div className="issue-top">
        <span className="issue-rule">
          <span className="ai-tag">AI suggestion</span> {finding.title}
        </span>
        <span className="subtle">{FIELD_LABELS[finding.field]}</span>
      </div>
      <div className="issue-quote">“{finding.quote}”</div>
      <p className="issue-why">
        <span className="ai-category">{AI_CATEGORY_LABELS[finding.category]}.</span> {finding.explanation}
      </p>

      {review ? (
        <div className="issue-status" onClick={(e) => e.stopPropagation()}>
          <span className={review.decision === 'confirmed' ? 'status-confirmed' : 'status-dismissed'}>
            {review.decision === 'confirmed'
              ? editable
                ? 'Confirmed · added to feedback draft'
                : 'Confirmed · included in feedback'
              : 'Dismissed'}
          </span>
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
            onClick={() => actions.reviewFinding(submission.id, target, 'confirmed', finding.suggestedFeedback)}
          >
            Confirm issue
          </button>
          <button className="btn" onClick={() => actions.reviewFinding(submission.id, target, 'dismissed')}>
            Dismiss
          </button>
        </div>
      ) : (
        <span className="subtle">Not reviewed</span>
      )}
    </li>
  )
}
