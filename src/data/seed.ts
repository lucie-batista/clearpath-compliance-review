import { CHECK_RULES, runChecks } from '../domain/checks'
import type { AppState, AssetField, FindingReview, Comment, Partner, Submission } from '../domain/types'

export const REVIEWER_NAME = 'Maya Chen'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const PARTNERS: Partner[] = [
  { id: 'p-brightpath', name: 'BrightPath Media', kind: 'affiliate' },
  { id: 'p-lendcompare', name: 'LendCompare', kind: 'affiliate' },
  { id: 'p-growth', name: 'ClearPath Growth Marketing', kind: 'internal' },
]

/** Seed data with dates relative to `now`, so the queue never looks stale. */
export function createSeed(now: Date = new Date()): AppState {
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString()

  const cashBackV1: AssetField[] = [
    { key: 'headline', text: 'Risk-free rewards on every purchase' },
    {
      key: 'body',
      text: 'Earn 3% cash back on groceries and 1% on everything else. No annual fee.',
    },
    { key: 'cta', text: 'Apply now' },
  ]
  const cashBackFindings = runChecks(cashBackV1, 'credit_card')
  const riskFree = cashBackFindings.find((f) => f.ruleId === 'absolute_claim')!
  const cashBackRates = cashBackFindings.filter((f) => f.ruleId === 'rate_without_apr')
  const reviewedAt = at(-2 * DAY - 3 * HOUR)

  const cashBackReviews: FindingReview[] = [
    {
      findingKey: riskFree.key,
      version: 1,
      decision: 'confirmed',
      reviewer: REVIEWER_NAME,
      at: reviewedAt,
    },
    ...cashBackRates.map(
      (f): FindingReview => ({
        findingKey: f.key,
        version: 1,
        decision: 'dismissed',
        note: 'Cash-back percentages, not a rate claim.',
        reviewer: REVIEWER_NAME,
        at: reviewedAt,
      }),
    ),
  ]

  const cashBackComments: Comment[] = [
    {
      id: 'c-seed-1',
      version: 1,
      field: 'headline',
      quote: riskFree.text,
      body: CHECK_RULES.absolute_claim.guidance,
      visibility: 'shared',
      author: REVIEWER_NAME,
      at: reviewedAt,
      findingKey: riskFree.key,
      resolved: false,
    },
    {
      id: 'c-seed-2',
      version: 1,
      field: 'body',
      quote: 'No annual fee.',
      body: 'If there are other fees (late, foreign transaction), link to the full rates and fees page next to this claim.',
      visibility: 'shared',
      author: REVIEWER_NAME,
      at: reviewedAt,
      resolved: false,
    },
    {
      id: 'c-seed-3',
      version: 1,
      field: 'headline',
      body: 'Second BrightPath asset this month using "risk-free". Worth checking their other live placements.',
      visibility: 'internal',
      author: REVIEWER_NAME,
      at: reviewedAt,
      resolved: false,
    },
  ]

  const submissions: Submission[] = [
    {
      id: 's-1001',
      title: 'Debt consolidation email: summer send',
      product: 'personal_loan',
      assetType: 'email',
      partnerId: 'p-brightpath',
      neededBy: at(2 * DAY),
      status: 'awaiting_review',
      versions: [
        {
          number: 1,
          submittedAt: at(-20 * HOUR),
          submittedBy: 'Jordan Reyes',
          destinationUrl: 'https://offers.brightpathmedia.com/clearpath/consolidate',
          fields: [
            { key: 'subject', text: 'Guaranteed approval on personal loans up to $40,000' },
            {
              key: 'body',
              text: 'Tired of juggling credit card bills? Consolidate your debt with a ClearPath personal loan. Rates as low as 7.99% and one fixed monthly payment that fits your budget. Checking your options takes two minutes, with no credit check required.',
            },
            { key: 'cta', text: 'Get my loan today' },
            { key: 'disclosure', text: 'Loans offered by ClearPath Financial. Terms apply.' },
          ],
        },
      ],
      findingReviews: [],
      comments: [],
      events: [
        { id: 'e-1001-1', type: 'submitted', actor: 'Jordan Reyes', at: at(-20 * HOUR), version: 1 },
      ],
    },
    {
      id: 's-1002',
      title: 'Mortgage prequalification comparison page',
      product: 'mortgage_prequal',
      assetType: 'landing_page',
      partnerId: 'p-lendcompare',
      neededBy: at(5 * DAY),
      status: 'awaiting_review',
      versions: [
        {
          number: 1,
          submittedAt: at(-3 * DAY),
          submittedBy: 'Sam Okafor',
          destinationUrl: 'https://lendcompare.com/mortgage/clearpath',
          fields: [
            { key: 'headline', text: 'Get pre-approved for a mortgage in minutes' },
            {
              key: 'body',
              text: 'Compare offers from trusted lenders, including ClearPath Financial. ClearPath helps first-time buyers see what they may qualify for, with the lowest rates in the market. Prequalifying won’t affect your credit score.',
            },
            { key: 'cta', text: 'See my options' },
            {
              key: 'disclosure',
              text: 'Prequalification is not a commitment to lend. APR will vary based on credit profile, loan amount, and property details.',
            },
          ],
        },
      ],
      findingReviews: [],
      comments: [],
      events: [
        { id: 'e-1002-1', type: 'submitted', actor: 'Sam Okafor', at: at(-3 * DAY), version: 1 },
      ],
    },
    {
      id: 's-1003',
      title: 'Cash-back card display ad',
      product: 'credit_card',
      assetType: 'display_ad',
      partnerId: 'p-brightpath',
      neededBy: at(6 * DAY),
      status: 'changes_requested',
      versions: [
        {
          number: 1,
          submittedAt: at(-4 * DAY),
          submittedBy: 'Jordan Reyes',
          destinationUrl: 'https://offers.brightpathmedia.com/clearpath/cashback',
          fields: cashBackV1,
        },
      ],
      findingReviews: cashBackReviews,
      comments: cashBackComments,
      events: [
        { id: 'e-1003-1', type: 'submitted', actor: 'Jordan Reyes', at: at(-4 * DAY), version: 1 },
        {
          id: 'e-1003-2',
          type: 'changes_requested',
          actor: REVIEWER_NAME,
          at: reviewedAt,
          version: 1,
        },
      ],
    },
  ]

  return { partners: PARTNERS, submissions }
}
