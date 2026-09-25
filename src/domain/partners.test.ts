import { describe, expect, it } from 'vitest'
import { createSeed } from '../data/seed'
import { partnerHistory } from './partners'
import { nextInQueue } from './queue'

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
