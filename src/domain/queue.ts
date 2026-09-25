import { dueLabel } from '../lib/format'
import type { EventType, Submission } from './types'
import { currentFindings, findingReview, latestVersion, sharedComments } from './workflow'

export type QueueTab = 'needs_review' | 'waiting' | 'approved' | 'all'

export const QUEUE_TABS: { id: QueueTab; label: string }[] = [
  { id: 'needs_review', label: 'Needs review' },
  { id: 'waiting', label: 'Waiting on partner' },
  { id: 'approved', label: 'Approved' },
  { id: 'all', label: 'All' },
]

const time = (iso?: string) => (iso ? new Date(iso).getTime() : Infinity)

export function lastEventAt(submission: Submission, type?: EventType): string {
  const events = type ? submission.events.filter((e) => e.type === type) : submission.events
  return events[events.length - 1]?.at ?? latestVersion(submission).submittedAt
}

/** Potential issues on the latest version that the reviewer hasn't confirmed or dismissed yet. */
export function unreviewedFindings(submission: Submission): number {
  return currentFindings(submission).filter((f) => !findingReview(submission, f.key)).length
}

export function feedbackSent(submission: Submission): number {
  return sharedComments(submission, latestVersion(submission).number).length
}

/** Uses the same calendar-day rules as the deadline labels, so counts and labels always agree. */
function urgencyOf(submission: Submission, now: Date) {
  if (submission.status !== 'awaiting_review' || !submission.neededBy) return 'normal'
  return dueLabel(submission.neededBy, now).urgency
}

export function queueFor(submissions: Submission[], tab: QueueTab): Submission[] {
  switch (tab) {
    case 'needs_review':
      // Most urgent first; among equals, whoever has waited longest.
      return submissions
        .filter((s) => s.status === 'awaiting_review')
        .sort(
          (a, b) =>
            time(a.neededBy) - time(b.neededBy) ||
            time(latestVersion(a).submittedAt) - time(latestVersion(b).submittedAt),
        )
    case 'waiting':
      return submissions
        .filter((s) => s.status === 'changes_requested')
        .sort((a, b) => time(lastEventAt(a)) - time(lastEventAt(b)))
    case 'approved':
      return submissions
        .filter((s) => s.status === 'approved')
        .sort((a, b) => time(lastEventAt(b)) - time(lastEventAt(a)))
    case 'all':
      return [...submissions].sort((a, b) => time(lastEventAt(b)) - time(lastEventAt(a)))
  }
}

/** The next submission a reviewer should pick up after finishing the current one. */
export function nextInQueue(submissions: Submission[], currentId: string): Submission | undefined {
  return queueFor(submissions, 'needs_review').find((s) => s.id !== currentId)
}

export function queueCounts(submissions: Submission[], now = new Date()) {
  return {
    needs_review: submissions.filter((s) => s.status === 'awaiting_review').length,
    waiting: submissions.filter((s) => s.status === 'changes_requested').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    all: submissions.length,
    overdue: submissions.filter((s) => urgencyOf(s, now) === 'overdue').length,
    dueSoon: submissions.filter((s) => urgencyOf(s, now) === 'soon').length,
  }
}
