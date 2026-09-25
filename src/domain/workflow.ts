import { runChecks, type Finding } from './checks'
import type {
  AppState,
  AssetField,
  Comment,
  FieldKey,
  FindingReview,
  HistoryEvent,
  Submission,
  Version,
  Visibility,
} from './types'

/**
 * All state changes go through this reducer, so reviewer and partner views
 * always operate on the same submission / version / history state.
 * IDs and timestamps are supplied by the caller to keep the reducer pure.
 */
export type Action =
  | {
      type: 'review_finding'
      submissionId: string
      finding: { key: string; field: FieldKey; text: string }
      decision: 'confirmed' | 'dismissed'
      reviewer: string
      at: string
      note?: string
      /** Required when confirming: the feedback shared with the partner. */
      comment?: { id: string; body: string }
    }
  | { type: 'clear_finding_review'; submissionId: string; findingKey: string }
  | {
      type: 'add_comment'
      submissionId: string
      comment: {
        id: string
        field: FieldKey
        quote?: string
        body: string
        visibility: Visibility
        author: string
        at: string
      }
    }
  | { type: 'delete_comment'; submissionId: string; commentId: string }
  | { type: 'edit_comment'; submissionId: string; commentId: string; body: string }
  | { type: 'set_comment_resolved'; submissionId: string; commentId: string; resolved: boolean }
  | { type: 'request_changes'; submissionId: string; actor: string; at: string; eventId: string; note?: string }
  | { type: 'approve'; submissionId: string; actor: string; at: string; eventId: string; note?: string }
  | { type: 'reject'; submissionId: string; actor: string; at: string; eventId: string; note: string }
  /** Reverts a decision that is still the latest thing that happened (nothing has built on it yet). */
  | { type: 'undo_decision'; submissionId: string; eventId: string }
  | {
      type: 'resubmit'
      submissionId: string
      fields: AssetField[]
      actor: string
      at: string
      eventId: string
    }
  | {
      type: 'create_submission'
      submission: {
        id: string
        title: string
        product: Submission['product']
        assetType: Submission['assetType']
        partnerId: string
        neededBy?: string
        destinationUrl?: string
        fields: AssetField[]
      }
      actor: string
      at: string
      eventId: string
    }
  | { type: 'reset'; state: AppState }

// ---------- Selectors ----------

export function latestVersion(submission: Submission): Version {
  return submission.versions[submission.versions.length - 1]
}

/** Potential issues on the latest version. Always computed from the content, never stored. */
export function currentFindings(submission: Submission): Finding[] {
  return runChecks(latestVersion(submission).fields, submission.product)
}

export type EffectiveReview = FindingReview & { carriedFrom?: number }

/**
 * The reviewer's decision on a finding in the latest version. A dismissal carries forward
 * from the previous version when the exact same text is flagged again, so reviewers don't
 * re-decide unchanged content. Confirmed issues never carry forward: if they're still
 * present, the reviewer should see them again.
 */
export function findingReview(submission: Submission, findingKey: string): EffectiveReview | undefined {
  const version = latestVersion(submission).number
  const own = submission.findingReviews.find((r) => r.version === version && r.findingKey === findingKey)
  if (own) return own
  const prior = previousFindingReview(submission, findingKey)
  return prior?.decision === 'dismissed' ? { ...prior, carriedFrom: prior.version } : undefined
}

export function previousFindingReview(submission: Submission, findingKey: string): FindingReview | undefined {
  const version = latestVersion(submission).number - 1
  return submission.findingReviews.find((r) => r.version === version && r.findingKey === findingKey)
}

export function isUnderReview(submission: Submission): boolean {
  return submission.status === 'awaiting_review'
}

export function commentsForVersion(submission: Submission, version: number): Comment[] {
  return submission.comments.filter((c) => c.version === version)
}

export function sharedComments(submission: Submission, version: number): Comment[] {
  return commentsForVersion(submission, version).filter((c) => c.visibility === 'shared')
}

/** Request changes needs at least one piece of feedback the partner can act on. */
export function canRequestChanges(submission: Submission): boolean {
  return (
    isUnderReview(submission) &&
    sharedComments(submission, latestVersion(submission).number).length > 0
  )
}

export function fieldsChanged(previous: AssetField[], next: AssetField[]): boolean {
  const before = new Map(previous.map((f) => [f.key, f.text.trim()]))
  return (
    previous.length !== next.length || next.some((f) => before.get(f.key) !== f.text.trim())
  )
}

export function canResubmit(submission: Submission, fields: AssetField[]): boolean {
  return (
    submission.status === 'changes_requested' &&
    fields.every((f) => f.text.trim().length > 0) &&
    fieldsChanged(latestVersion(submission).fields, fields)
  )
}

// ---------- Reducer ----------

function updateSubmission(
  state: AppState,
  id: string,
  update: (s: Submission) => Submission,
): AppState {
  let changed = false
  const submissions = state.submissions.map((s) => {
    if (s.id !== id) return s
    const next = update(s)
    changed = next !== s
    return next
  })
  return changed ? { ...state, submissions } : state
}

function event(
  id: string,
  type: HistoryEvent['type'],
  actor: string,
  at: string,
  version: number,
  note?: string,
): HistoryEvent {
  return { id, type, actor, at, version, ...(note ? { note } : {}) }
}

export function reducer(state: AppState, action: Action): AppState {
  if (action.type === 'reset') return action.state

  if (action.type === 'create_submission') {
    const { submission: s, actor, at, eventId } = action
    const fields = s.fields.map((f) => ({ ...f, text: f.text.trim() }))
    if (!s.title.trim() || fields.length === 0 || fields.some((f) => !f.text)) return state
    if (!state.partners.some((p) => p.id === s.partnerId)) return state
    const created: Submission = {
      id: s.id,
      title: s.title.trim(),
      product: s.product,
      assetType: s.assetType,
      partnerId: s.partnerId,
      ...(s.neededBy ? { neededBy: s.neededBy } : {}),
      status: 'awaiting_review',
      versions: [
        {
          number: 1,
          fields,
          ...(s.destinationUrl?.trim() ? { destinationUrl: s.destinationUrl.trim() } : {}),
          submittedAt: at,
          submittedBy: actor,
        },
      ],
      findingReviews: [],
      comments: [],
      events: [event(eventId, 'submitted', actor, at, 1)],
    }
    return { ...state, submissions: [...state.submissions, created] }
  }

  return updateSubmission(state, action.submissionId, (s) => {
    const current = latestVersion(s).number

    switch (action.type) {
      case 'review_finding': {
        if (!isUnderReview(s)) return s
        if (action.decision === 'confirmed' && !action.comment) return s
        const { finding } = action
        // A re-decision replaces the earlier one, along with any feedback it created.
        const reviews = s.findingReviews.filter(
          (r) => !(r.version === current && r.findingKey === finding.key),
        )
        let comments = s.comments.filter(
          (c) => !(c.version === current && c.findingKey === finding.key),
        )
        if (action.decision === 'confirmed' && action.comment) {
          comments = [
            ...comments,
            {
              id: action.comment.id,
              version: current,
              field: finding.field,
              quote: finding.text,
              body: action.comment.body,
              visibility: 'shared',
              author: action.reviewer,
              at: action.at,
              findingKey: finding.key,
              resolved: false,
            },
          ]
        }
        return {
          ...s,
          comments,
          findingReviews: [
            ...reviews,
            {
              findingKey: finding.key,
              version: current,
              decision: action.decision,
              reviewer: action.reviewer,
              at: action.at,
              ...(action.note ? { note: action.note } : {}),
            },
          ],
        }
      }

      case 'clear_finding_review': {
        if (!isUnderReview(s)) return s
        return {
          ...s,
          findingReviews: s.findingReviews.filter(
            (r) => !(r.version === current && r.findingKey === action.findingKey),
          ),
          comments: s.comments.filter(
            (c) => !(c.version === current && c.findingKey === action.findingKey),
          ),
        }
      }

      case 'add_comment': {
        if (!isUnderReview(s) || !action.comment.body.trim()) return s
        return {
          ...s,
          comments: [
            ...s.comments,
            { ...action.comment, body: action.comment.body.trim(), version: current, resolved: false },
          ],
        }
      }

      case 'delete_comment': {
        // Only feedback that hasn't been sent to the partner yet can be deleted.
        if (!isUnderReview(s)) return s
        const target = s.comments.find((c) => c.id === action.commentId)
        if (!target || target.version !== current) return s
        return {
          ...s,
          comments: s.comments.filter((c) => c.id !== action.commentId),
          findingReviews: target.findingKey
            ? s.findingReviews.filter(
                (r) => !(r.version === current && r.findingKey === target.findingKey),
              )
            : s.findingReviews,
        }
      }

      case 'edit_comment': {
        // Only unsent feedback on the version under review can be edited.
        if (!isUnderReview(s) || !action.body.trim()) return s
        const target = s.comments.find((c) => c.id === action.commentId)
        if (!target || target.version !== current) return s
        return {
          ...s,
          comments: s.comments.map((c) => (c.id === action.commentId ? { ...c, body: action.body.trim() } : c)),
        }
      }

      case 'set_comment_resolved': {
        if (!isUnderReview(s)) return s
        return {
          ...s,
          comments: s.comments.map((c) =>
            c.id === action.commentId ? { ...c, resolved: action.resolved } : c,
          ),
        }
      }

      case 'request_changes': {
        if (!canRequestChanges(s)) return s
        return {
          ...s,
          status: 'changes_requested',
          events: [
            ...s.events,
            event(action.eventId, 'changes_requested', action.actor, action.at, current, action.note),
          ],
        }
      }

      case 'approve': {
        if (!isUnderReview(s)) return s
        return {
          ...s,
          status: 'approved',
          events: [
            ...s.events,
            event(action.eventId, 'approved', action.actor, action.at, current, action.note),
          ],
        }
      }

      case 'reject': {
        if (!isUnderReview(s) || !action.note.trim()) return s
        return {
          ...s,
          status: 'rejected',
          events: [
            ...s.events,
            event(action.eventId, 'rejected', action.actor, action.at, current, action.note.trim()),
          ],
        }
      }

      case 'undo_decision': {
        const last = s.events[s.events.length - 1]
        const isDecision = last?.type === 'approved' || last?.type === 'changes_requested' || last?.type === 'rejected'
        if (!isDecision || last.id !== action.eventId) return s
        return { ...s, status: 'awaiting_review', events: s.events.slice(0, -1) }
      }

      case 'resubmit': {
        if (!canResubmit(s, action.fields)) return s
        const version: Version = {
          ...latestVersion(s),
          number: current + 1,
          fields: action.fields.map((f) => ({ ...f, text: f.text.trim() })),
          submittedAt: action.at,
          submittedBy: action.actor,
        }
        return {
          ...s,
          status: 'awaiting_review',
          versions: [...s.versions, version],
          events: [
            ...s.events,
            event(action.eventId, 'resubmitted', action.actor, action.at, version.number),
          ],
        }
      }
    }
  })
}
