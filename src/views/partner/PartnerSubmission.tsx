import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AssetFields } from '../../components/AssetFields'
import { NotFound } from '../../components/NotFound'
import { FIELD_LABELS, STATUS_LABELS } from '../../domain/catalog'
import type { AssetField, Submission } from '../../domain/types'
import { canResubmit, fieldsChanged, latestVersion, sharedComments } from '../../domain/workflow'
import { useActions, useAppState } from '../../state/store'

export function PartnerSubmission() {
  const { partnerId, submissionId } = useParams()
  const { submissions } = useAppState()
  const submission = submissions.find((s) => s.id === submissionId && s.partnerId === partnerId)
  const backTo = `/partner/${partnerId}`

  if (!submission) return <NotFound backTo={backTo} backLabel="Back to your submissions" />

  const version = latestVersion(submission)
  // Partners only ever see feedback explicitly shared with them. Internal notes stay internal.
  const feedback = sharedComments(submission, version.number)

  return (
    <section>
      <Link to={backTo}>← Your submissions</Link>
      <h1>{submission.title}</h1>
      <p>
        <strong>{STATUS_LABELS[submission.status]}</strong> · v{version.number}
      </p>

      {submission.status === 'changes_requested' ? (
        <>
          <h2>Requested changes</h2>
          <ul className="comments">
            {feedback.map((c) => (
              <li key={c.id}>
                {FIELD_LABELS[c.field]}
                {c.quote && <> · “{c.quote}”</>}
                <div>{c.body}</div>
              </li>
            ))}
          </ul>
          {/* Keyed by version so the form resets after each resubmission. */}
          <ReviseForm key={version.number} submission={submission} />
        </>
      ) : (
        <>
          {submission.status === 'awaiting_review' && (
            <p className="muted">ClearPath compliance is reviewing this version.</p>
          )}
          <h2>Current version</h2>
          <AssetFields fields={version.fields} />
        </>
      )}
    </section>
  )
}

function ReviseForm({ submission }: { submission: Submission }) {
  const actions = useActions()
  const version = latestVersion(submission)
  const [fields, setFields] = useState<AssetField[]>(version.fields)

  const update = (index: number, text: string) =>
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, text } : f)))

  const changed = fieldsChanged(version.fields, fields)
  const allFilled = fields.every((f) => f.text.trim())

  return (
    <form
      className="revise-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (canResubmit(submission, fields)) actions.resubmit(submission.id, fields, version.submittedBy)
      }}
    >
      <h2>Revise and resubmit</h2>
      {fields.map((f, i) => (
        <label key={f.key}>
          {FIELD_LABELS[f.key]}
          <textarea value={f.text} rows={f.key === 'body' ? 5 : 2} onChange={(e) => update(i, e.target.value)} />
        </label>
      ))}
      <button type="submit" disabled={!changed || !allFilled}>
        Resubmit for review
      </button>
      {!changed && <p className="muted">Make at least one change before resubmitting.</p>}
      {!allFilled && <p className="muted">Every field needs content.</p>}
    </form>
  )
}
