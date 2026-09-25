import { FIELD_LABELS } from '../../../domain/catalog'
import { feedbackStatus, previousVersion, type FeedbackStatus } from '../../../domain/revision'
import type { Submission } from '../../../domain/types'
import { isUnderReview, latestVersion } from '../../../domain/workflow'
import { useActions } from '../../../state/store'

const STATUS: Record<FeedbackStatus, { label: string; tone: string }> = {
  text_changed: { label: 'Text changed', tone: 'changed' },
  field_changed: { label: 'Field changed', tone: 'changed' },
  text_unchanged: { label: 'Text unchanged', tone: 'unchanged' },
  field_unchanged: { label: 'Field unchanged', tone: 'unchanged' },
}

/**
 * Feedback sent on the previous version, checked against the new text. The status says
 * what changed; the reviewer decides whether each item was actually addressed.
 */
export function PreviousFeedback({ submission }: { submission: Submission }) {
  const actions = useActions()
  const prev = previousVersion(submission)
  if (!prev) return null
  const current = latestVersion(submission)
  const items = submission.comments.filter((c) => c.version === prev.number)
  if (items.length === 0) return null
  const editable = isUnderReview(submission)
  const resolved = items.filter((c) => c.resolved).length

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Feedback from v{prev.number}</h2>
        <span className="subtle">
          {resolved} of {items.length} marked addressed
        </span>
      </div>
      <ul className="comment-list">
        {items.map((c) => {
          const status = STATUS[feedbackStatus(c, current.fields, prev.fields)]
          return (
            <li key={c.id} className={`comment ${c.resolved ? 'comment-resolved' : ''}`}>
              <div className="comment-meta">
                <span className={`change-status change-${status.tone}`}>{status.label}</span>
                <span className={`tag ${c.visibility === 'shared' ? 'tag-shared' : 'tag-internal'}`}>
                  {c.visibility === 'shared' ? 'For partner' : 'Internal'}
                </span>
                <span className="subtle">
                  {FIELD_LABELS[c.field]}
                  {c.quote && <> · “{c.quote}”</>}
                </span>
              </div>
              <p className="comment-body">{c.body}</p>
              {editable ? (
                <label className="resolve-toggle">
                  <input
                    type="checkbox"
                    checked={c.resolved}
                    onChange={(e) => actions.setCommentResolved(submission.id, c.id, e.target.checked)}
                  />
                  Addressed in v{current.number}
                </label>
              ) : (
                c.resolved && <span className="subtle">Marked addressed</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
