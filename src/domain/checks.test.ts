import { describe, expect, it } from 'vitest'
import { runChecks } from './checks'
import type { AssetField, Product } from './types'

const body = (text: string): AssetField[] => [{ key: 'body', text }]
const ruleIds = (fields: AssetField[], product: Product = 'personal_loan') =>
  runChecks(fields, product).map((f) => f.ruleId)

describe('runChecks', () => {
  it('returns nothing for clean copy', () => {
    expect(runChecks(body('Check your rate in minutes. Terms apply.'), 'personal_loan')).toEqual([])
  })

  it('flags approval certainty', () => {
    expect(ruleIds(body('Guaranteed approval for everyone.'))).toEqual(['approval_certainty'])
    expect(ruleIds(body("You're already approved!"))).toEqual(['approval_certainty'])
  })

  it('flags no credit check claims', () => {
    expect(ruleIds(body('Apply with no credit check.'))).toEqual(['no_credit_check'])
  })

  it('flags pre-approval wording only for the prequalification product', () => {
    const fields = body('Get pre-approved today.')
    expect(ruleIds(fields, 'mortgage_prequal')).toEqual(['prequal_wording'])
    expect(ruleIds(fields, 'credit_card')).toEqual([])
  })

  describe('rate claim without APR (contextual)', () => {
    it('flags rates and payment amounts when APR is never mentioned', () => {
      expect(ruleIds(body('Rates as low as 7.99%. Payments from $199/mo.'))).toEqual([
        'rate_without_apr',
        'rate_without_apr',
      ])
    })

    it('catches mortgage-style rates with three decimals', () => {
      expect(runChecks(body('Rates as low as 5.875%.'), 'mortgage_prequal').map((f) => f.text)).toEqual([
        '5.875%',
      ])
    })

    it('does not flag when APR appears anywhere in the asset, including another field', () => {
      const fields: AssetField[] = [
        { key: 'body', text: 'Rates as low as 7.99%.' },
        { key: 'disclosure', text: 'APR ranges from 7.99% to 35.99%.' },
      ]
      expect(ruleIds(fields)).toEqual([])
    })
  })

  it('flags unsupported superlatives', () => {
    expect(ruleIds(body('The lowest rates and the #1 card.'))).toEqual(['superlative', 'superlative'])
    expect(ruleIds(body('Our best customers love us.'))).toEqual([])
  })

  it('flags absolute risk or cost claims but not specific fee statements', () => {
    expect(ruleIds(body('Risk-free with no fees.'))).toEqual(['absolute_claim', 'absolute_claim'])
    expect(ruleIds(body('No annual fee.'))).toEqual([])
  })

  it('reports exact positions of the matched text', () => {
    const text = 'Enjoy risk-free rewards.'
    const [finding] = runChecks(body(text), 'credit_card')
    expect(text.slice(finding.start, finding.end)).toBe('risk-free')
  })

  it('produces keys that are stable across versions for unchanged text', () => {
    const v1 = runChecks(body('Guaranteed approval. Lowest rates.'), 'personal_loan')
    const v2 = runChecks(body('Now with guaranteed approval!'), 'personal_loan')
    expect(v2.map((f) => f.key)).toEqual([v1[0].key])
  })

  it('distinguishes repeated occurrences of the same phrase', () => {
    const keys = runChecks(body('No risk. Really, no risk.'), 'personal_loan').map((f) => f.key)
    expect(new Set(keys).size).toBe(2)
  })

  it('orders findings by field order, then position', () => {
    const fields: AssetField[] = [
      { key: 'headline', text: 'Unbeatable offer' },
      { key: 'body', text: 'No credit check. Guaranteed approval.' },
    ]
    expect(ruleIds(fields)).toEqual(['superlative', 'no_credit_check', 'approval_certainty'])
  })
})
