import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AssetFields } from '../../components/AssetFields'
import { DueDate } from '../../components/DueDate'
import { NotFound } from '../../components/NotFound'
import { StatusBadge } from '../../components/StatusBadge'
import { ASSET_TYPE_LABELS, FIELD_LABELS, PRODUCT_LABELS } from '../../domain/catalog'
import { lastEventAt } from '../../domain/queue'
import type { AssetField, Comment, Submission } from '../../domain/types'
import { canResubmit, fieldsChanged, latestVersion, sharedComments } from '../../domain/workflow'
import { formatDate, timeAgo } from '../../lib/format'
import { useActions, useAppState } from '../../state/store'

export function PartnerSubmission() {
  const { partnerId, submissionId } = useParams()
  const { submissions } = useAppState()
  const submission = submissions.find((s) => s.id === submissionId && s.partnerId === partnerId)
  const backTo = `/partner/${partnerId}`

  if (!submission) return <NotFound backTo={backTo} backLabel="Back to your submissions" />

  const version = latestVersion(submission)
  // Partners only ever see feedback explicitly shared with them. Internal notes and dismissed issues stay internal.
  const feedback = sharedComments(submission, version.number)
  const lastDecision = submission.events.findLast((e) => e.type !== 'submitted' && e.type !== 'resubmitted')

  return (
    <section className="page">
      <Link to={backTo} className="back-link">
        ← Your submissions
      </Link>

      <header className="ws-header card">
        <div className="ws-title">
          <h1>{submission.title}</h1>
          <StatusBadge status={submission.status} />
        </div>
        <dl className="ws-details">
          <div>
            <dt>Product</dt>
            <dd>{PRODUCT_LABELS[submission.product]}</dd>
          </div>
          <div>
            <dt>Asset type</dt>
            <dd>{ASSET_TYPE_LABELS[submission.assetType]}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>v{version.number}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>
              {version.submittedBy}
              <span className="subtle"> · {timeAgo(version.submittedAt)}</span>
            </dd>
          </div>
          <div>
            <dt>Needed by</dt>
            <dd>
              <DueDate
                iso={submission.neededBy}
                open={submission.status === 'awaiting_review' || submission.status === 'changes_requested'}
              />
            </dd>
          </div>
        </dl>
      </header>

      {submission.status === 'changes_requested' && (
        <>
          <div className="banner banner-info partner-request">
            <div>
              <strong>
                ClearPath compliance requested {feedback.length} change{feedback.length === 1 ? '' : 's'}
              </strong>
              <span> · {timeAgo(lastEventAt(submission, 'changes_requested'))}</span>
              {lastDecision?.note && <p className="partner-request-note">“{lastDecision.note}”</p>}
            </div>
          </div>
          {/* Keyed by version so the form resets after each resubmission. */}
          <ReviseForm key={version.number} submission={submission} feedback={feedback} />
        </>
      )}

      {submission.status === 'awaiting_review' && (
        <>
          <div className="banner banner-neutral">
            {version.number > 1
              ? `v${version.number} submitted ${timeAgo(version.submittedAt)}. In review with ClearPath compliance.`
              : 'In review with ClearPath compliance. You’ll see feedback here if changes are needed.'}
          </div>
          <CurrentVersion fields={version.fields} />
        </>
      )}

      {submission.status === 'approved' && (
        <>
          <div className="banner banner-success">
            Approved by ClearPath compliance on {formatDate(lastEventAt(submission, 'approved'))}. Publish this exact
            version; any changes need a new review.
          </div>
          <CurrentVersion fields={version.fields} />
        </>
      )}

      {submission.status === 'rejected' && (
        <>
          <div className="banner banner-danger">
            Not approved{lastDecision?.note && <>: {lastDecision.note}</>}
          </div>
          <CurrentVersion fields={version.fields} />
        </>
      )}
    </section>
  )
}

function CurrentVersion({ fields }: { fields: AssetField[] }) {
  return (
    <section className="panel">
      <h2>Submitted version</h2>
      <AssetFields fields={fields} />
    </section>
  )
}

function ReviseForm({ submission, feedback }: { submission: Submission; feedback: Comment[] }) {
  const actions = useActions()
  const version = latestVersion(submission)
  const [fields, setFields] = useState<AssetField[]>(version.fields)
  // The partner's own checklist. Only they know whether they've handled a request.
  const [done, setDone] = useState<Set<string>>(new Set())
  const toggleDone = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const update = (index: number, text: string) =>
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, text } : f)))

  const changed = fieldsChanged(version.fields, fields)
  const allFilled = fields.every((f) => f.text.trim())
  // Number feedback in field order so the list and the inline notes match.
  const ordered = version.fields.flatMap((f) => feedback.filter((c) => c.field === f.key))
  const number = (c: Comment) => ordered.indexOf(c) + 1

  return (
    <form
      className="panel revise-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canResubmit(submission, fields)) return
        actions.resubmit(submission.id, fields, version.submittedBy)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
    >
      <div className="panel-heading">
        <h2>Revise and resubmit</h2>
        <span className="subtle">Edit the copy below. Each change request sits above the field it applies to.</span>
      </div>

      {fields.map((f, i) => (
        <ReviseField
          key={f.key}
          field={f}
          original={version.fields[i].text}
          notes={ordered.filter((c) => c.field === f.key)}
          number={number}
          done={done}
          onToggleDone={toggleDone}
          onChange={(text) => update(i, text)}
        />
      ))}

      <div className="revise-footer">
        <button type="submit" className="btn btn-primary" disabled={!changed || !allFilled}>
          Resubmit for review
        </button>
        {ordered.length > 0 && (
          <span className={done.size === ordered.length ? 'done-count done-count-complete' : 'done-count'}>
            {done.size} of {ordered.length} requests marked done
          </span>
        )}
        {!changed && <span className="subtle">Make at least one change before resubmitting.</span>}
        {changed && !allFilled && <span className="subtle">Every field needs content.</span>}
      </div>
    </form>
  )
}

function ReviseField({
  field,
  original,
  notes,
  number,
  done,
  onToggleDone,
  onChange,
}: {
  field: AssetField
  original: string
  notes: Comment[]
  number: (c: Comment) => number
  done: Set<string>
  onToggleDone: (id: string) => void
  onChange: (text: string) => void
}) {
  const [showOriginal, setShowOriginal] = useState(false)
  const edited = field.text !== original

  return (
    <div className={`revise-field ${notes.length ? 'revise-field-flagged' : ''}`}>
      <div className="revise-label-row">
        <label htmlFor={`field-${field.key}`}>
          {FIELD_LABELS[field.key]}
          {edited && <span className="edited-tag">Edited</span>}
        </label>
        {edited && (
          <span className="revise-tools">
            <button type="button" className="btn-link" onClick={() => setShowOriginal((v) => !v)}>
              {showOriginal ? 'Hide original' : 'Show original'}
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                onChange(original)
                setShowOriginal(false)
              }}
            >
              Reset
            </button>
          </span>
        )}
      </div>
      {notes.map((c) => {
        const isDone = done.has(c.id)
        return (
          <div key={c.id} className={`change-request ${isDone ? 'change-request-done' : ''}`}>
            <span className="change-number">{isDone ? '✓' : number(c)}</span>
            <div className="change-content">
              {c.quote && <div className="change-quote">“{c.quote}”</div>}
              <div>{c.body}</div>
            </div>
            <label className="done-toggle">
              <input type="checkbox" checked={isDone} onChange={() => onToggleDone(c.id)} />
              Done
            </label>
          </div>
        )
      })}
      {edited && showOriginal && (
        <p className="revise-original">
          <span className="revise-original-label">Original: </span>
          {original}
        </p>
      )}
      <textarea
        id={`field-${field.key}`}
        value={field.text}
        rows={field.key === 'body' || field.key === 'post' ? 4 : 2}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
