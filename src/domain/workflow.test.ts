import { describe, expect, it } from 'vitest'
import { createSeed } from '../data/seed'
import { runChecks } from './checks'
import type { AppState, Submission } from './types'
import { canRequestChanges, latestVersion, reducer } from './workflow'

const AT = '2026-09-24T12:00:00.000Z'
const REVIEWER = 'Reviewer'

const get = (state: AppState, id: string): Submission =>
  state.submissions.find((s) => s.id === id)!

/** s-1001 is awaiting review; s-1003 has changes requested. */
function seed() {
  return createSeed(new Date(AT))
}

function firstFinding(state: AppState, id: string) {
  const s = get(state, id)
  return runChecks(latestVersion(s).fields, s.product)[0]
}

describe('reviewing findings', () => {
  it('confirming a finding records the decision and creates shared feedback anchored to the text', () => {
    let state = seed()
    const finding = firstFinding(state, 's-1001')
    state = reducer(state, {
      type: 'review_finding',
      submissionId: 's-1001',
      finding,
      decision: 'confirmed',
      reviewer: REVIEWER,
      at: AT,
      comment: { id: 'c1', body: 'Please remove.' },
    })
    const s = get(state, 's-1001')
    expect(s.findingReviews).toHaveLength(1)
    expect(s.comments).toEqual([
      expect.objectContaining({
        id: 'c1',
        quote: finding.text,
        field: finding.field,
        visibility: 'shared',
        findingKey: finding.key,
      }),
    ])
  })

  it('changing a confirmed finding to dismissed removes the feedback it created', () => {
    let state = seed()
    const finding = firstFinding(state, 's-1001')
    const base = { type: 'review_finding', submissionId: 's-1001', finding, reviewer: REVIEWER, at: AT } as const
    state = reducer(state, { ...base, decision: 'confirmed', comment: { id: 'c1', body: 'Fix.' } })
    state = reducer(state, { ...base, decision: 'dismissed' })
    const s = get(state, 's-1001')
    expect(s.comments).toEqual([])
    expect(s.findingReviews).toEqual([expect.objectContaining({ decision: 'dismissed' })])
  })

  it('cannot change reviews once the submission is no longer under review', () => {
    const state = seed()
    const next = reducer(state, {
      type: 'review_finding',
      submissionId: 's-1003',
      finding: firstFinding(state, 's-1003'),
      decision: 'dismissed',
      reviewer: REVIEWER,
      at: AT,
    })
    expect(next).toBe(state)
  })
})

describe('editing draft feedback', () => {
  it('edits unsent feedback, but not feedback already sent to the partner', () => {
    let state = seed()
    state = reducer(state, {
      type: 'add_comment',
      submissionId: 's-1001',
      comment: { id: 'c1', field: 'body', body: 'Draft', visibility: 'shared', author: REVIEWER, at: AT },
    })
    state = reducer(state, { type: 'edit_comment', submissionId: 's-1001', commentId: 'c1', body: ' Revised ' })
    expect(get(state, 's-1001').comments[0].body).toBe('Revised')

    // s-1003 already had its feedback sent (changes requested), so it is locked.
    const sent = seed()
    const commentId = get(sent, 's-1003').comments[0].id
    expect(reducer(sent, { type: 'edit_comment', submissionId: 's-1003', commentId, body: 'x' })).toBe(sent)
  })
})

describe('decisions', () => {
  it('request changes requires at least one shared comment', () => {
    let state = seed()
    const request = { type: 'request_changes', submissionId: 's-1001', actor: REVIEWER, at: AT, eventId: 'e1' } as const

    expect(reducer(state, request)).toBe(state)

    state = reducer(state, {
      type: 'add_comment',
      submissionId: 's-1001',
      comment: { id: 'c1', field: 'body', body: 'Internal only', visibility: 'internal', author: REVIEWER, at: AT },
    })
    expect(canRequestChanges(get(state, 's-1001'))).toBe(false)

    state = reducer(state, {
      type: 'add_comment',
      submissionId: 's-1001',
      comment: { id: 'c2', field: 'body', body: 'Please fix', visibility: 'shared', author: REVIEWER, at: AT },
    })
    state = reducer(state, request)
    const s = get(state, 's-1001')
    expect(s.status).toBe('changes_requested')
    expect(s.events.at(-1)).toEqual(expect.objectContaining({ type: 'changes_requested', version: 1 }))
  })

  it('approves a submission under review and records the event', () => {
    const state = reducer(seed(), { type: 'approve', submissionId: 's-1002', actor: REVIEWER, at: AT, eventId: 'e1' })
    const s = get(state, 's-1002')
    expect(s.status).toBe('approved')
    expect(s.events.at(-1)?.type).toBe('approved')
  })

  it('reject requires a reason', () => {
    const state = seed()
    const reject = { type: 'reject', submissionId: 's-1002', actor: REVIEWER, at: AT, eventId: 'e1' } as const
    expect(reducer(state, { ...reject, note: '  ' })).toBe(state)
    expect(get(reducer(state, { ...reject, note: 'Product not offered' }), 's-1002').status).toBe('rejected')
  })
})

describe('undoing a decision', () => {
  it('returns the submission to review and removes the decision from history', () => {
    const approved = reducer(seed(), { type: 'approve', submissionId: 's-1002', actor: REVIEWER, at: AT, eventId: 'e1' })
    const undone = get(reducer(approved, { type: 'undo_decision', submissionId: 's-1002', eventId: 'e1' }), 's-1002')
    expect(undone.status).toBe('awaiting_review')
    expect(undone.events.map((e) => e.type)).toEqual(['submitted'])
  })

  it('keeps feedback when undoing a change request, so the reviewer can adjust and resend', () => {
    const state = seed()
    const before = get(state, 's-1003')
    const commentsBefore = before.comments
    const eventId = before.events[before.events.length - 1].id
    const undone = get(reducer(state, { type: 'undo_decision', submissionId: 's-1003', eventId }), 's-1003')
    expect(undone.status).toBe('awaiting_review')
    expect(undone.comments).toEqual(commentsBefore)
  })

  it('refuses once something has happened since (e.g. the partner resubmitted)', () => {
    let state = reducer(seed(), { type: 'approve', submissionId: 's-1002', actor: REVIEWER, at: AT, eventId: 'e1' })
    state = reducer(state, { type: 'undo_decision', submissionId: 's-1002', eventId: 'wrong-id' })
    expect(get(state, 's-1002').status).toBe('approved')
    // Latest event on s-1006 is a resubmission, not a decision.
    const seeded = seed()
    const events = get(seeded, 's-1006').events
    const lastId = events[events.length - 1].id
    expect(reducer(seeded, { type: 'undo_decision', submissionId: 's-1006', eventId: lastId })).toBe(seeded)
  })
})

describe('resubmission', () => {
  const revised = (state: AppState) =>
    latestVersion(get(state, 's-1003')).fields.map((f) =>
      f.key === 'headline' ? { ...f, text: 'Rewards on every purchase' } : f,
    )

  it('creates a new version and returns the submission to the review queue', () => {
    const state = reducer(seed(), {
      type: 'resubmit',
      submissionId: 's-1003',
      fields: revised(seed()),
      actor: 'Partner',
      at: AT,
      eventId: 'e1',
    })
    const s = get(state, 's-1003')
    expect(s.status).toBe('awaiting_review')
    expect(s.versions.map((v) => v.number)).toEqual([1, 2])
    expect(latestVersion(s).fields[0].text).toBe('Rewards on every purchase')
    expect(s.events.at(-1)).toEqual(expect.objectContaining({ type: 'resubmitted', version: 2 }))
    // Earlier feedback is preserved against the version it was written on.
    expect(s.comments.every((c) => c.version === 1)).toBe(true)
  })

  it('blocks a resubmission with no changes', () => {
    const state = seed()
    const unchanged = latestVersion(get(state, 's-1003')).fields
    const next = reducer(state, {
      type: 'resubmit',
      submissionId: 's-1003',
      fields: unchanged.map((f) => ({ ...f, text: `  ${f.text} ` })),
      actor: 'Partner',
      at: AT,
      eventId: 'e1',
    })
    expect(next).toBe(state)
  })

  it('blocks resubmission of a submission that is not waiting on changes', () => {
    const state = seed()
    const fields = latestVersion(get(state, 's-1001')).fields.map((f) => ({ ...f, text: `${f.text}!` }))
    const next = reducer(state, { type: 'resubmit', submissionId: 's-1001', fields, actor: 'Partner', at: AT, eventId: 'e1' })
    expect(next).toBe(state)
  })
})

describe('creating a submission', () => {
  const base = {
    id: 's-new',
    title: ' New card email ',
    product: 'credit_card' as const,
    assetType: 'search_ad' as const,
    partnerId: 'p-ratescout',
    fields: [
      { key: 'headline' as const, text: 'Guaranteed approval' },
      { key: 'description' as const, text: 'Apply today.' },
    ],
  }
  const create = (state: AppState, submission = base) =>
    reducer(state, { type: 'create_submission', submission, actor: 'Emily Burger', at: AT, eventId: 'e1' })

  it('adds a v1 submission awaiting review, with a submitted event', () => {
    const s = get(create(seed()), 's-new')
    expect(s).toMatchObject({ title: 'New card email', status: 'awaiting_review' })
    expect(s.versions).toHaveLength(1)
    expect(s.events).toEqual([expect.objectContaining({ type: 'submitted', actor: 'Emily Burger', version: 1 })])
    // Checks run on it like any other submission.
    expect(runChecks(latestVersion(s).fields, s.product).map((f) => f.ruleId)).toEqual(['approval_certainty'])
  })

  it('rejects incomplete submissions and unknown partners', () => {
    const state = seed()
    expect(create(state, { ...base, title: ' ' })).toBe(state)
    expect(create(state, { ...base, fields: [{ key: 'headline', text: '' }] })).toBe(state)
    expect(create(state, { ...base, partnerId: 'p-nobody' })).toBe(state)
  })
})

describe('seed data', () => {
  it('only references findings that the checks actually produce on that version', () => {
    for (const s of seed().submissions) {
      for (const r of s.findingReviews) {
        const version = s.versions.find((v) => v.number === r.version)!
        const keys = runChecks(version.fields, s.product).map((f) => f.key)
        expect(keys, `${s.id} v${r.version}`).toContain(r.findingKey)
      }
    }
  })

  it('includes an asset that passes every keyword check but hides an instruction to reviewers (for the AI demo)', () => {
    const s = get(seed(), 's-1015')
    expect(runChecks(latestVersion(s).fields, s.product)).toEqual([])
    expect(latestVersion(s).fields.map((f) => f.text).join(' ')).toContain('Ignore previous instructions')
  })

  it('includes misleading copy that passes every keyword check (for the AI demo)', () => {
    const s = get(seed(), 's-1016')
    expect(runChecks(latestVersion(s).fields, s.product)).toEqual([])
  })

  it('covers every status, asset type, and product', () => {
    const subs = seed().submissions
    expect(new Set(subs.map((s) => s.status)).size).toBe(4)
    expect(new Set(subs.map((s) => s.assetType)).size).toBe(5)
    expect(new Set(subs.map((s) => s.product)).size).toBe(3)
  })
})

describe('AI second opinion results', () => {
  const review = (version: number) => ({
    version,
    at: AT,
    model: 'claude-opus-5',
    findings: [
      {
        key: 'ai|headline|x|0',
        field: 'subject' as const,
        quote: 'Guaranteed approval',
        category: 'implied_claim' as const,
        title: 't',
        explanation: 'e',
        suggestedFeedback: 'f',
      },
    ],
  })

  it('stores results against the current version, replacing an earlier run', () => {
    let state = reducer(seed(), { type: 'set_ai_review', submissionId: 's-1001', review: review(1) })
    state = reducer(state, { type: 'set_ai_review', submissionId: 's-1001', review: { ...review(1), model: 'rerun' } })
    expect(get(state, 's-1001').aiReviews).toEqual([expect.objectContaining({ version: 1, model: 'rerun' })])
  })

  it('ignores results for a version that is no longer current', () => {
    const state = seed()
    expect(reducer(state, { type: 'set_ai_review', submissionId: 's-1006', review: review(1) })).toBe(state)
  })

  it('lets the reviewer confirm an AI finding like any other, creating shared feedback', () => {
    let state = reducer(seed(), { type: 'set_ai_review', submissionId: 's-1001', review: review(1) })
    const f = review(1).findings[0]
    state = reducer(state, {
      type: 'review_finding',
      submissionId: 's-1001',
      finding: { key: f.key, field: f.field, text: f.quote },
      decision: 'confirmed',
      reviewer: REVIEWER,
      at: AT,
      comment: { id: 'c-ai', body: f.suggestedFeedback },
    })
    expect(get(state, 's-1001').comments).toEqual([
      expect.objectContaining({ id: 'c-ai', visibility: 'shared', quote: 'Guaranteed approval', findingKey: f.key }),
    ])
  })
})
