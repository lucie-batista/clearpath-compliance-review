import { dueLabel } from '../lib/format'
import type { EventType, Partner, Product, Submission } from './types'
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

export type QueueSort = 'urgent' | 'oldest' | 'issues' | 'newest'

export const QUEUE_SORTS: { id: QueueSort; label: string }[] = [
  { id: 'urgent', label: 'Most urgent' },
  { id: 'oldest', label: 'Oldest waiting' },
  { id: 'issues', label: 'Most potential issues' },
  { id: 'newest', label: 'Newest' },
]

export interface QueueFilters {
  search: string
  product: Product | ''
  partnerId: string
}

/** Matches title, submitter name, or any text in the latest version. */
export function filterSubmissions(
  submissions: Submission[],
  filters: QueueFilters,
  partners: Partner[],
): Submission[] {
  const needle = filters.search.trim().toLowerCase()
  return submissions.filter((s) => {
    if (filters.product && s.product !== filters.product) return false
    if (filters.partnerId && s.partnerId !== filters.partnerId) return false
    if (!needle) return true
    const partner = partners.find((p) => p.id === s.partnerId)?.name ?? ''
    const text = [s.title, partner, ...latestVersion(s).fields.map((f) => f.text)].join(' ').toLowerCase()
    return text.includes(needle)
  })
}

/** Tab membership plus ordering. "Most urgent" keeps each tab's natural order. */
export function queueFor(submissions: Submission[], tab: QueueTab, sort: QueueSort = 'urgent'): Submission[] {
  const rows = tabRows(submissions, tab)
  const submitted = (s: Submission) => time(latestVersion(s).submittedAt)
  switch (sort) {
    case 'urgent':
      return rows
    case 'oldest':
      return [...rows].sort((a, b) => submitted(a) - submitted(b))
    case 'newest':
      return [...rows].sort((a, b) => submitted(b) - submitted(a))
    case 'issues':
      // Stable sort keeps the tab's natural order among equals.
      return [...rows].sort((a, b) => unreviewedFindings(b) - unreviewedFindings(a))
  }
}

function tabRows(submissions: Submission[], tab: QueueTab): Submission[] {
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
