import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AssetFields, type Highlight } from '../../components/AssetFields'
import { DiffFields } from '../../components/DiffFields'
import { History } from '../../components/History'
import { NotFound } from '../../components/NotFound'
import { CHECK_RULES } from '../../domain/checks'
import { lastEventAt, nextInQueue } from '../../domain/queue'
import { diffFields, previousVersion, revisionSummary } from '../../domain/revision'
import type { Partner, Submission } from '../../domain/types'
import { currentAiReview, currentFindings, findingReview, latestVersion } from '../../domain/workflow'
import { timeAgo } from '../../lib/format'
import { useActions, useAppState } from '../../state/store'
import { AiReviewPanel } from './workspace/AiReviewPanel'
import { FeedbackPanel } from './workspace/FeedbackPanel'
import { IssuesPanel } from './workspace/IssuesPanel'
import { PartnerContext } from './workspace/PartnerContext'
import { PreviousFeedback } from './workspace/PreviousFeedback'
import { RevisionSummary } from './workspace/RevisionSummary'
import { WorkspaceHeader, type Outcome } from './workspace/WorkspaceHeader'

export function ReviewWorkspace() {
  const { submissionId } = useParams()
  const { submissions } = useAppState()
  const submission = submissions.find((s) => s.id === submissionId)

  if (!submission) return <NotFound backTo="/review" backLabel="Back to review queue" />
  // Keyed so per-submission UI state (selection, drafts, outcome) resets when moving to the next item.
  return <Workspace key={submission.id} submission={submission} />
}

function Workspace({ submission }: { submission: Submission }) {
  const { partners } = useAppState()
  const partner = partners.find((p) => p.id === submission.partnerId)
  const version = latestVersion(submission)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const actions = useActions()
  const prev = previousVersion(submission)
  const summary = revisionSummary(submission)
  // On a resubmission, start with what changed: that is what the reviewer needs to verify.
  const [view, setView] = useState<'changes' | 'clean'>(prev ? 'changes' : 'clean')

  const highlights: Highlight[] = currentFindings(submission).map((f) => ({
    id: f.key,
    field: f.field,
    start: f.start,
    end: f.end,
    tone: findingReview(submission, f.key)?.decision ?? 'open',
    label: CHECK_RULES[f.ruleId].label,
  }))
  for (const f of currentAiReview(submission)?.findings ?? []) {
    const text = version.fields.find((x) => x.key === f.field)?.text ?? ''
    const start = text.indexOf(f.quote)
    if (start < 0) continue
    highlights.push({
      id: f.key,
      field: f.field,
      start,
      end: start + f.quote.length,
      tone: findingReview(submission, f.key)?.decision ?? 'open',
      label: `AI suggestion: ${f.title}`,
    })
  }

  function selectFromText(key: string) {
    setActiveKey(key)
    document
      .querySelector(`[data-issue="${CSS.escape(key)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <section className="page">
      <Link to="/review" className="back-link">
        ← Review queue
      </Link>

      {outcome ? (
        <OutcomeBanner
          submission={submission}
          partner={partner}
          outcome={outcome}
          onUndo={() => {
            actions.undoDecision(submission.id, outcome.eventId)
            setOutcome(null)
          }}
        />
      ) : (
        <StatusBanner submission={submission} partner={partner} />
      )}

      <WorkspaceHeader submission={submission} partner={partner} onDecided={setOutcome} />

      {summary && <RevisionSummary summary={summary} />}

      <div className="workspace">
        <div className="ws-main">
          <section className="panel">
            <div className="panel-heading panel-heading-wrap">
              <h2>Asset</h2>
              {prev && (
                <div className="segmented" role="radiogroup" aria-label="Asset view">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={view === 'changes'}
                    className={view === 'changes' ? 'segment segment-active' : 'segment'}
                    onClick={() => setView('changes')}
                  >
                    Changes since v{prev.number}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={view === 'clean'}
                    className={view === 'clean' ? 'segment segment-active' : 'segment'}
                    onClick={() => setView('clean')}
                  >
                    Potential issues
                  </button>
                </div>
              )}
            </div>
            {version.destinationUrl && (
              <p className="destination subtle" title="Destination URL">
                Destination: {version.destinationUrl}
              </p>
            )}
            {prev && view === 'changes' ? (
              <DiffFields diffs={diffFields(prev.fields, version.fields)} />
            ) : (
              <AssetFields
                fields={version.fields}
                highlights={highlights}
                activeId={activeKey}
                onSelect={selectFromText}
              />
            )}
          </section>
        </div>
        {/* Background context comes last on narrow screens, after the work itself. */}
        <div className="ws-context">
          <PartnerContext submission={submission} partner={partner} />
          <section className="panel">
            <h2>Activity</h2>
            <History events={submission.events} />
          </section>
        </div>
        <div className="ws-side">
          <IssuesPanel
            submission={submission}
            activeKey={activeKey}
            onSelect={(key) => {
              setActiveKey(key)
              setView('clean') // show the highlight in context
            }}
          />
          <AiReviewPanel
            submission={submission}
            activeKey={activeKey}
            onSelect={(key) => {
              setActiveKey(key)
              setView('clean')
            }}
          />
          <PreviousFeedback submission={submission} partner={partner} />
          <FeedbackPanel key={version.number} submission={submission} partner={partner} />
        </div>
      </div>
    </section>
  )
}

function OutcomeBanner({
  submission,
  partner,
  outcome,
  onUndo,
}: {
  submission: Submission
  partner?: Partner
  outcome: Outcome
  onUndo: () => void
}) {
  const { submissions } = useAppState()
  const next = nextInQueue(submissions, submission.id)
  const ref = useRef<HTMLDivElement>(null)

  // The decision is often made while scrolled down; bring the confirmation into view.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ref.current?.focus()
  }, [])
  const name = partner?.name ?? 'the submitter'
  const message =
    outcome.type === 'approved'
      ? 'Approved.'
      : outcome.type === 'rejected'
        ? `Rejected. ${name} can see your reason.`
        : `Changes requested. ${outcome.shared} feedback item${outcome.shared === 1 ? '' : 's'} shared with ${name}.`
  // Undo stays available only while nothing has happened since (e.g. no resubmission).
  const canUndo = submission.events[submission.events.length - 1]?.id === outcome.eventId

  return (
    <div className="banner banner-success banner-outcome" role="status" ref={ref} tabIndex={-1}>
      <span>
        {message}
        {canUndo && (
          <button className="btn-link" onClick={onUndo}>
            Undo
          </button>
        )}
      </span>
      {next ? (
        <Link to={`/review/${next.id}`} className="btn btn-primary">
          Next in queue: {next.title} →
        </Link>
      ) : (
        <Link to="/review" className="btn">
          Queue clear. Back to queue
        </Link>
      )}
    </div>
  )
}

function StatusBanner({ submission, partner }: { submission: Submission; partner?: Partner }) {
  const last = submission.events[submission.events.length - 1]
  switch (submission.status) {
    case 'changes_requested':
      return (
        <div className="banner banner-info">
          Waiting on {partner?.name ?? 'the submitter'} to revise. Changes requested{' '}
          {timeAgo(lastEventAt(submission, 'changes_requested'))}.
        </div>
      )
    case 'approved':
      return (
        <div className="banner banner-success">
          Approved by {last.actor} {timeAgo(last.at)}.
        </div>
      )
    case 'rejected':
      return (
        <div className="banner banner-danger">
          Rejected by {last.actor} {timeAgo(last.at)}
          {last.note && <>: {last.note}</>}
        </div>
      )
    default:
      return null
  }
}
