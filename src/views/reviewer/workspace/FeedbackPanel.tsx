import { useState } from 'react'
import { FIELD_LABELS } from '../../../domain/catalog'
import type { Comment, FieldKey, Partner, Submission, Visibility } from '../../../domain/types'
import { commentsForVersion, isUnderReview, latestVersion } from '../../../domain/workflow'
import { useActions } from '../../../state/store'

export function FeedbackPanel({ submission, partner }: { submission: Submission; partner?: Partner }) {
  const actions = useActions()
  const version = latestVersion(submission)
  const editable = isUnderReview(submission)
  const current = commentsForVersion(submission, version.number)
  const earlier = submission.comments.filter((c) => c.version < version.number)
  const forPartner = current.filter((c) => c.visibility === 'shared').length
  const partnerName = partner?.name ?? 'the partner'

  const [open, setOpen] = useState(false)
  const [field, setField] = useState<FieldKey>(version.fields[0].key)
  const [quote, setQuote] = useState('')
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('shared')

  function add() {
    if (!body.trim()) return
    actions.addComment(submission.id, { field, quote: quote.trim() || undefined, body, visibility })
    setQuote('')
    setBody('')
    setOpen(false)
  }

  const sentToPartner = submission.status === 'changes_requested' || submission.status === 'rejected'

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{editable ? 'Feedback draft' : 'Feedback'}</h2>
        {current.length > 0 && (
          <span className="subtle">
            {forPartner} for partner · {current.length - forPartner} internal
          </span>
        )}
      </div>

      {editable ? (
        <p className="draft-note">
          {forPartner > 0
            ? `Not sent yet. ${partnerName} receives the “For partner” items when you request changes. Internal notes stay with your team.`
            : current.length > 0
              ? `Internal notes are saved to this submission’s record for your team. They’re never shared with ${partnerName}.`
              : `Confirm issues or add comments. Items for ${partnerName} are sent when you request changes; internal notes stay with your team.`}
        </p>
      ) : (
        forPartner > 0 &&
        sentToPartner && <p className="draft-note draft-note-sent">Sent to {partnerName}.</p>
      )}

      {current.length === 0 && !editable && <p className="muted">No feedback was added to this version.</p>}

      <ul className="comment-list">
        {current.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            onEdit={editable ? (text) => actions.editComment(submission.id, c.id, text) : undefined}
            onDelete={editable ? () => actions.deleteComment(submission.id, c.id) : undefined}
          />
        ))}
      </ul>

      {editable &&
        (open ? (
          <form
            className="comment-form"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <div className="segmented" role="radiogroup" aria-label="Visibility">
              {(['shared', 'internal'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={visibility === v}
                  className={visibility === v ? 'segment segment-active' : 'segment'}
                  onClick={() => setVisibility(v)}
                >
                  {v === 'shared' ? 'For partner' : 'Internal note'}
                </button>
              ))}
            </div>
            <label className="field">
              Field
              <select value={field} onChange={(e) => setField(e.target.value as FieldKey)}>
                {version.fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {FIELD_LABELS[f.key]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Refers to text <span className="subtle">(optional)</span>
              <input
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Paste the exact words this comment is about"
              />
            </label>
            <label className="field">
              Comment
              <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
            </label>
            <div className="button-row">
              <button type="submit" className="btn btn-primary" disabled={!body.trim()}>
                Add comment
              </button>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn add-comment" onClick={() => setOpen(true)}>
            + Add comment
          </button>
        ))}

      {earlier.length > 0 && (
        <details className="earlier">
          <summary>Feedback on earlier versions ({earlier.length})</summary>
          <ul className="comment-list">
            {earlier.map((c) => (
              <CommentItem key={c.id} comment={c} showVersion />
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function CommentItem({
  comment,
  onEdit,
  onDelete,
  showVersion,
}: {
  comment: Comment
  onEdit?: (body: string) => void
  onDelete?: () => void
  showVersion?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <li className="comment">
      <div className="comment-meta">
        {showVersion && <span className="tag">v{comment.version}</span>}
        <span className={`tag ${comment.visibility === 'shared' ? 'tag-shared' : 'tag-internal'}`}>
          {comment.visibility === 'shared' ? 'For partner' : 'Internal'}
        </span>
        <span className="subtle">
          {FIELD_LABELS[comment.field]}
          {comment.quote && <> · “{comment.quote}”</>}
        </span>
      </div>

      {draft !== null && onEdit ? (
        <div className="comment-edit">
          <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <div className="button-row">
            <button
              className="btn btn-primary"
              disabled={!draft.trim()}
              onClick={() => {
                onEdit(draft)
                setDraft(null)
              }}
            >
              Save
            </button>
            <button className="btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="comment-body">{comment.body}</p>
          {(onEdit || onDelete) && (
            <div className="comment-actions">
              {onEdit && (
                <button className="btn-link" onClick={() => setDraft(comment.body)}>
                  Edit
                </button>
              )}
              {onDelete && (
                <button className="btn-link" onClick={onDelete}>
                  Remove
                </button>
              )}
            </div>
          )}
        </>
      )}
    </li>
  )
}
