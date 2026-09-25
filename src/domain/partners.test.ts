import { describe, expect, it } from 'vitest'
import { createSeed } from '../data/seed'
import { partnerHistory } from './partners'
import { filterSubmissions, nextInQueue, queueFor, unreviewedFindings } from './queue'

const state = createSeed(new Date('2026-09-24T12:00:00.000Z'))
const get = (id: string) => state.submissions.find((s) => s.id === id)!

describe('partnerHistory', () => {
  it('summarizes the partner’s other submissions and previously confirmed issue types', () => {
    const history = partnerHistory(state.submissions, get('s-1001'))
    // BrightPath: s-1003 (changes requested), s-1008 (approved after changes), s-1013 (awaiting).
    expect(history.total).toBe(3)
    expect(history.neededChanges).toBe(2)
    expect(history.approved).toBe(1)
    expect(history.flagged).toEqual([
      { ruleId: 'absolute_claim', count: 2 },
      { ruleId: 'approval_certainty', count: 1 },
    ])
  })

  it('never counts the current submission', () => {
    const history = partnerHistory(state.submissions, get('s-1003'))
    expect(history.total).toBe(3)
    expect(history.flagged).toEqual([
      { ruleId: 'absolute_claim', count: 1 },
      { ruleId: 'approval_certainty', count: 1 },
    ])
  })
})

describe('nextInQueue', () => {
  it('returns the most urgent other submission awaiting review', () => {
    const next = nextInQueue(state.submissions, 's-1013')
    expect(next?.status).toBe('awaiting_review')
    expect(next?.id).not.toBe('s-1013')
  })
})

describe('queue filters and sorting', () => {
  const none = { search: '', product: '' as const, partnerId: '' }

  it('filters by product, submitter, and free-text search across title, partner, and ad copy', () => {
    const { submissions, partners } = state
    expect(filterSubmissions(submissions, { ...none, product: 'mortgage_prequal' }, partners).every((s) => s.product === 'mortgage_prequal')).toBe(true)
    expect(filterSubmissions(submissions, { ...none, partnerId: 'p-ratescout' }, partners).map((s) => s.id).sort()).toEqual(['s-1004', 's-1009', 's-1015'])
    // "Guaranteed approval" only appears in ad copy
    expect(filterSubmissions(submissions, { ...none, search: 'guaranteed approval' }, partners).map((s) => s.id)).toContain('s-1001')
    expect(filterSubmissions(submissions, { ...none, search: 'lendcompare' }, partners).every((s) => s.partnerId === 'p-lendcompare')).toBe(true)
  })

  it('sorts by most potential issues, keeping urgency order among ties', () => {
    const rows = queueFor(state.submissions, 'needs_review', 'issues')
    const counts = rows.map((s) => unreviewedFindings(s))
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  it('sorts oldest and newest by when the latest version arrived', () => {
    const oldest = queueFor(state.submissions, 'needs_review', 'oldest')
    const newest = queueFor(state.submissions, 'needs_review', 'newest')
    expect(newest.map((s) => s.id)).toEqual([...oldest].reverse().map((s) => s.id))
  })
})
