import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AssetFields } from '../../components/AssetFields'
import { History } from '../../components/History'
import { NotFound } from '../../components/NotFound'
import { ASSET_TYPE_LABELS, FIELD_LABELS, PRODUCT_LABELS, STATUS_LABELS } from '../../domain/catalog'
import { CHECK_RULES } from '../../domain/checks'
import type { FieldKey, Submission, Visibility } from '../../domain/types'
import {
  canRequestChanges,
  commentsForVersion,
  currentFindings,
  findingReview,
  isUnderReview,
  latestVersion,
} from '../../domain/workflow'
import { formatDate } from '../../lib/format'
import { useActions, useAppState } from '../../state/store'

export function ReviewWorkspace() {
  const { submissionId } = useParams()
  const { submissions, partners } = useAppState()
  const submission = submissions.find((s) => s.id === submissionId)

  if (!submission) return <NotFound backTo="/review" backLabel="Back to review queue" />

  const partner = partners.find((p) => p.id === submission.partnerId)
  const version = latestVersion(submission)

  return (
    <section>
      <Link to="/review">← Review queue</Link>
      <h1>{submission.title}</h1>
      <p>
        <strong>{STATUS_LABELS[submission.status]}</strong> · {partner?.name} ·{' '}
        {PRODUCT_LABELS[submission.product]} · {ASSET_TYPE_LABELS[submission.assetType]} · v
        {version.number} submitted by {version.submittedBy}
        {submission.neededBy && <> · needed by {formatDate(submission.neededBy)}</>}
      </p>

      <div className="workspace">
        <div>
          <h2>Asset</h2>
          <AssetFields fields={version.fields} />
          <h2>History</h2>
          <History events={submission.events} />
        </div>
        <div>
          <PotentialIssues submission={submission} />
          <Feedback key={`${submission.id}-v${version.number}`} submission={submission} />
          <Decision submission={submission} />
        </div>
      </div>
    </section>
  )
}

function PotentialIssues({ submission }: { submission: Submission }) {
  const actions = useActions()
  const findings = currentFindings(submission)
  const editable = isUnderReview(submission)

  return (
    <div className="panel">
      <h2>Potential issues ({findings.length})</h2>
      {findings.length === 0 && (
        <p className="muted">
          No potential issues detected by automated checks. Reviewer judgment still required.
        </p>
      )}
      <ul className="findings">
        {findings.map((finding) => {
          const rule = CHECK_RULES[finding.ruleId]
          const review = findingReview(submission, finding.key)
          return (
            <li key={finding.key}>
              <div>
                <strong>{rule.label}</strong> in {FIELD_LABELS[finding.field]}: “{finding.text}”
              </div>
              <div className="muted">{rule.explanation}</div>
              <div>
                {review ? (
                  <>
                    {review.decision === 'confirmed' ? 'Confirmed, shared with partner' : 'Dismissed'}
                    {review.note && <> ({review.note})</>}
                    {editable && (
                      <button onClick={() => actions.clearFindingReview(submission.id, finding.key)}>
                        Undo
                      </button>
                    )}
                  </>
                ) : editable ? (
                  <>
                    <button
                      onClick={() =>
                        actions.reviewFinding(submission.id, finding, 'confirmed', rule.guidance)
                      }
                    >
                      Confirm
                    </button>
                    <button onClick={() => actions.reviewFinding(submission.id, finding, 'dismissed')}>
                      Dismiss
                    </button>
                  </>
                ) : (
                  <span className="muted">Not reviewed</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Feedback({ submission }: { submission: Submission }) {
  const actions = useActions()
  const version = latestVersion(submission)
  const editable = isUnderReview(submission)
  const current = commentsForVersion(submission, version.number)
  const earlier = submission.comments.filter((c) => c.version < version.number)

  const [field, setField] = useState<FieldKey>(version.fields[0].key)
  const [quote, setQuote] = useState('')
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('shared')

  function submit() {
    if (!body.trim()) return
    actions.addComment(submission.id, { field, quote: quote.trim() || undefined, body, visibility })
    setQuote('')
    setBody('')
  }

  return (
    <div className="panel">
      <h2>Feedback on v{version.number}</h2>
      {current.length === 0 && <p className="muted">No feedback yet.</p>}
      <ul className="comments">
        {current.map((c) => (
          <li key={c.id}>
            <span className="tag">{c.visibility === 'shared' ? 'Shared with partner' : 'Internal note'}</span>{' '}
            {FIELD_LABELS[c.field]}
            {c.quote && <> · “{c.quote}”</>}
            <div>{c.body}</div>
            {editable && (
              <button onClick={() => actions.deleteComment(submission.id, c.id)}>Delete</button>
            )}
          </li>
        ))}
      </ul>

      {editable && (
        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label>
            Field
            <select value={field} onChange={(e) => setField(e.target.value as FieldKey)}>
              {version.fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {FIELD_LABELS[f.key]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quoted text (optional)
            <input value={quote} onChange={(e) => setQuote(e.target.value)} />
          </label>
          <label>
            Comment
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </label>
          <label>
            Visibility
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
              <option value="shared">Shared with partner</option>
              <option value="internal">Internal note</option>
            </select>
          </label>
          <button type="submit" disabled={!body.trim()}>
            Add feedback
          </button>
        </form>
      )}

      {earlier.length > 0 && (
        <>
          <h3>Earlier feedback</h3>
          <ul className="comments">
            {earlier.map((c) => (
              <li key={c.id}>
                <span className="tag">v{c.version}</span>{' '}
                <span className="tag">{c.visibility === 'shared' ? 'Shared' : 'Internal'}</span>{' '}
                {FIELD_LABELS[c.field]}
                {c.quote && <> · “{c.quote}”</>}
                <div>{c.body}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Decision({ submission }: { submission: Submission }) {
  const actions = useActions()
  if (!isUnderReview(submission)) {
    return (
      <div className="panel">
        <h2>Decision</h2>
        <p>{STATUS_LABELS[submission.status]}. No further action needed until the next submission.</p>
      </div>
    )
  }
  const canRequest = canRequestChanges(submission)
  return (
    <div className="panel">
      <h2>Decision</h2>
      <button disabled={!canRequest} onClick={() => actions.requestChanges(submission.id)}>
        Request changes
      </button>{' '}
      <button onClick={() => actions.approve(submission.id)}>Approve</button>
      {!canRequest && (
        <p className="muted">Add at least one piece of feedback shared with the partner to request changes.</p>
      )}
    </div>
  )
}
