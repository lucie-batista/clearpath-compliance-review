import { useState } from 'react'
import { DueDate } from '../../../components/DueDate'
import { StatusBadge } from '../../../components/StatusBadge'
import { ASSET_TYPE_LABELS, PRODUCT_LABELS } from '../../../domain/catalog'
import { submitterTerms } from '../../../domain/partners'
import { unreviewedFindings } from '../../../domain/queue'
import type { Partner, Submission } from '../../../domain/types'
import { canRequestChanges, isUnderReview, latestVersion, sharedComments } from '../../../domain/workflow'
import { timeAgo } from '../../../lib/format'
import { useActions } from '../../../state/store'

export type Outcome = { eventId: string } & (
  | { type: 'changes_requested'; shared: number }
  | { type: 'approved' }
  | { type: 'rejected' }
)

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

interface Props {
  submission: Submission
  partner?: Partner
  onDecided: (outcome: Outcome) => void
}

export function WorkspaceHeader({ submission, partner, onDecided }: Props) {
  const actions = useActions()
  const version = latestVersion(submission)
  const underReview = isUnderReview(submission)
  const [mode, setMode] = useState<'idle' | 'request' | 'approve' | 'reject'>('idle')
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')

  const shared = sharedComments(submission, version.number).length
  const unreviewed = unreviewedFindings(submission)
  const canRequest = canRequestChanges(submission)
  const terms = submitterTerms(partner)
  const partnerName = partner?.name ?? `the ${terms.noun}`

  function approve() {
    const eventId = actions.approve(submission.id)
    setMode('idle')
    onDecided({ type: 'approved', eventId })
  }

  function sendRequest() {
    const eventId = actions.requestChanges(submission.id, note.trim() || undefined)
    setMode('idle')
    onDecided({ type: 'changes_requested', shared, eventId })
  }

  function reject() {
    if (!reason.trim()) return
    const eventId = actions.reject(submission.id, reason.trim())
    setMode('idle')
    onDecided({ type: 'rejected', eventId })
  }

  return (
    <header className="ws-header card">
      <div className="ws-title-row">
        <div className="ws-title">
          <h1>{submission.title}</h1>
          <StatusBadge status={submission.status} />
        </div>
        {underReview && mode === 'idle' && (
          <div className="ws-actions">
            <button
              className={canRequest ? 'btn btn-primary' : 'btn'}
              disabled={!canRequest}
              title={canRequest ? undefined : `Confirm an issue or add feedback for the ${terms.noun} first`}
              onClick={() => setMode('request')}
            >
              Request changes{canRequest && ` (${shared})`}
            </button>
            <button
              className={canRequest ? 'btn' : 'btn btn-primary'}
              onClick={() => (unreviewed > 0 || shared > 0 ? setMode('approve') : approve())}
            >
              Approve
            </button>
            <button className="btn btn-quiet" onClick={() => setMode('reject')}>
              Reject
            </button>
          </div>
        )}
      </div>

      <dl className="ws-details">
        <div>
          <dt>{terms.label}</dt>
          <dd>
            {partnerName}
            <span className="subtle"> · {partner?.kind === 'internal' ? 'Internal' : 'Affiliate'}</span>
          </dd>
        </div>
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
          <dd>
            v{version.number}
            {version.number > 1 && <span className="subtle"> · Resubmitted</span>}
          </dd>
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

      {underReview && mode === 'idle' && (
        <p className={canRequest ? 'ws-hint ws-hint-ready' : 'ws-hint'}>
          {canRequest
            ? `${plural(shared, 'feedback item')} ready to send. Nothing reaches ${partnerName} until you request changes.`
            : `To request changes, confirm a potential issue or add a comment for ${partnerName}.`}
        </p>
      )}

      {underReview && mode === 'request' && (
        <div className="decision-panel">
          <h2>Request changes from {partnerName}</h2>
          <p className="muted">
            {plural(shared, 'feedback item')} will be shared with {partnerName}. Internal notes and dismissed
            issues stay internal.
          </p>
          <label className="field">
            <span>
              Message to {partnerName} <span className="subtle">(optional)</span>
            </span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please address the items below and resubmit by Friday."
            />
          </label>
          <div className="button-row">
            <button className="btn btn-primary" onClick={sendRequest}>
              Send request
            </button>
            <button className="btn" onClick={() => setMode('idle')}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {underReview && mode === 'approve' && (
        <div className="decision-panel decision-panel-warning">
          <h2>Approve with open items?</h2>
          <ul>
            {unreviewed > 0 && <li>{plural(unreviewed, 'potential issue')} not yet reviewed.</li>}
            {shared > 0 && (
              <li>
                {plural(shared, 'feedback item')} you added won’t be sent to {partnerName} if you approve.
              </li>
            )}
          </ul>
          <div className="button-row">
            <button className="btn btn-primary" onClick={approve}>
              Approve anyway
            </button>
            <button className="btn" onClick={() => setMode('idle')}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {underReview && mode === 'reject' && (
        <div className="decision-panel decision-panel-danger">
          <h2>Reject this submission?</h2>
          <p className="muted">
            Use this when the asset can’t be fixed with edits. {partnerName} will see your reason and would need to
            start a new submission. Feedback in your draft won’t be sent.
          </p>
          <label className="field">
            Reason <span className="subtle">(required, shared with {partnerName})</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Promotes terms ClearPath doesn’t offer. Please build a new asset from approved messaging."
              autoFocus
            />
          </label>
          <div className="button-row">
            <button className="btn btn-danger" disabled={!reason.trim()} onClick={reject}>
              Reject submission
            </button>
            <button className="btn" onClick={() => setMode('idle')}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
