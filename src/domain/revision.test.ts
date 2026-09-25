import { describe, expect, it } from 'vitest'
import { createSeed } from '../data/seed'
import { runChecks } from './checks'
import { compareFindings, countEdits, diffFields, feedbackStatus, previousVersion, revisionSummary } from './revision'
import type { AppState, AssetField, Comment } from './types'
import { findingReview, latestVersion, reducer } from './workflow'

const AT = '2026-09-24T12:00:00.000Z'
const seed = () => createSeed(new Date(AT))
const get = (state: AppState, id: string) => state.submissions.find((s) => s.id === id)!

describe('diffFields', () => {
  it('marks added and removed words per field, and which fields changed', () => {
    const before: AssetField[] = [
      { key: 'headline', text: 'Guaranteed approval today' },
      { key: 'cta', text: 'Apply now' },
    ]
    const after: AssetField[] = [
      { key: 'headline', text: 'Check your rate today' },
      { key: 'cta', text: 'Apply now' },
    ]
    const [headline, cta] = diffFields(before, after)
    expect(headline.changed).toBe(true)
    expect(headline.parts.filter((p) => p.change === 'removed').map((p) => p.text.trim())).toContain('Guaranteed approval')
    expect(headline.parts.filter((p) => p.change === 'added').map((p) => p.text.trim())).toContain('Check your rate')
    expect(cta.changed).toBe(false)
    expect(countEdits([headline, cta])).toBe(1)
  })
})

describe('feedbackStatus', () => {
  const before: AssetField[] = [{ key: 'body', text: 'Risk-free rewards. No annual fee.' }]
  const comment = (quote?: string): Comment => ({
    id: 'c',
    version: 1,
    field: 'body',
    quote,
    body: 'x',
    visibility: 'shared',
    author: 'r',
    at: AT,
    resolved: false,
  })

  it('reports whether the quoted text is still there, without claiming it was addressed', () => {
    const after: AssetField[] = [{ key: 'body', text: 'Rewards on every purchase. No annual fee.' }]
    expect(feedbackStatus(comment('Risk-free'), after, before)).toBe('text_changed')
    expect(feedbackStatus(comment('No annual fee.'), after, before)).toBe('text_unchanged')
  })

  it('falls back to the whole field when the comment has no quote', () => {
    expect(feedbackStatus(comment(), before, before)).toBe('field_unchanged')
    expect(feedbackStatus(comment(), [{ key: 'body', text: 'Changed' }], before)).toBe('field_changed')
  })
})

describe('seeded resubmission (s-1006)', () => {
  const s = get(seed(), 's-1006')

  it('groups findings into resolved, still present, and newly introduced', () => {
    const c = compareFindings(s)!
    expect(c.resolved.map((f) => f.ruleId).sort()).toEqual(['approval_certainty', 'rate_without_apr'])
    expect(c.stillPresent).toEqual([])
    expect(c.introduced.map((f) => f.ruleId)).toEqual(['superlative'])
  })

  it('summarizes the revision', () => {
    const summary = revisionSummary(s)!
    expect(summary).toMatchObject({ fromVersion: 1, toVersion: 2, fieldsChanged: 3, resolved: 2, introduced: 1 })
    expect(summary.feedbackTotal).toBe(3)
    // "Guaranteed approval" and the disclosure changed. "6.99%" is still there (now followed by "APR"),
    // so it reads as unchanged: the system reports text changes and the reviewer judges whether feedback was addressed.
    expect(summary.feedbackTextChanged).toBe(2)
  })
})

describe('carrying decisions forward', () => {
  // s-1003: "3%" and "1%" were dismissed on v1 as cash-back percentages; "Risk-free" was confirmed.
  function resubmitCashBack(headline: string) {
    const state = seed()
    const fields = latestVersion(get(state, 's-1003')).fields.map((f) =>
      f.key === 'headline' ? { ...f, text: headline } : f,
    )
    return get(
      reducer(state, { type: 'resubmit', submissionId: 's-1003', fields, actor: 'Partner', at: AT, eventId: 'e' }),
      's-1003',
    )
  }

  it('carries a dismissal forward when the same text is flagged again', () => {
    const s = resubmitCashBack('Rewards on every purchase')
    const rate = runChecks(latestVersion(s).fields, s.product).find((f) => f.ruleId === 'rate_without_apr')!
    expect(findingReview(s, rate.key)).toMatchObject({ decision: 'dismissed', carriedFrom: 1 })
    expect(previousVersion(s)?.number).toBe(1)
  })

  it('never carries a confirmed issue forward: if it is still there, the reviewer sees it again', () => {
    const s = resubmitCashBack('Risk-free rewards on everything you buy')
    const riskFree = runChecks(latestVersion(s).fields, s.product).find((f) => f.ruleId === 'absolute_claim')!
    expect(findingReview(s, riskFree.key)).toBeUndefined()
  })
})
