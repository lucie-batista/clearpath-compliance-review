import { CHECK_RULES, runChecks, type RuleId } from '../domain/checks'
import type {
  AppState,
  AssetType,
  Comment,
  FieldKey,
  FindingReview,
  HistoryEvent,
  Partner,
  Product,
  Submission,
  SubmissionStatus,
  Version,
} from '../domain/types'

export const REVIEWER_NAME = 'Lucie Batista'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const PARTNERS: Partner[] = [
  { id: 'p-brightpath', name: 'BrightPath Media', kind: 'affiliate' },
  { id: 'p-lendcompare', name: 'LendCompare', kind: 'affiliate' },
  { id: 'p-ratescout', name: 'RateScout', kind: 'affiliate' },
  { id: 'p-frugal', name: 'The Frugal Ledger', kind: 'affiliate' },
  { id: 'p-growth', name: 'ClearPath Growth Marketing', kind: 'internal' },
]

// ---------- Seed builder ----------

type Fields = [FieldKey, string][]

interface SeedReview {
  /** Offset from now, in ms (negative = in the past). */
  at: number
  decision: 'changes_requested' | 'approved' | 'rejected'
  note?: string
  /** Findings the reviewer confirmed, by rule (and occurrence, if a rule matched more than once). */
  confirm?: (RuleId | [RuleId, number])[]
  dismiss?: { rule: RuleId; nth?: number; note: string }[]
  comments?: { field: FieldKey; quote?: string; body: string; internal?: boolean }[]
}

interface SeedRound {
  at: number
  by: string
  fields: Fields
  review?: SeedReview
}

interface SeedSubmission {
  id: string
  title: string
  product: Product
  assetType: AssetType
  partnerId: string
  neededBy?: number
  url: string
  rounds: SeedRound[]
}

function build(spec: SeedSubmission, now: number): Submission {
  const iso = (offset: number) => new Date(now + offset).toISOString()
  const versions: Version[] = []
  const findingReviews: FindingReview[] = []
  const comments: Comment[] = []
  const events: HistoryEvent[] = []
  let status: SubmissionStatus = 'awaiting_review'
  let n = 0
  const nextId = (prefix: string) => `${spec.id}-${prefix}${++n}`

  spec.rounds.forEach((round, i) => {
    const number = i + 1
    const fields = round.fields.map(([key, text]) => ({ key, text }))
    versions.push({ number, fields, destinationUrl: spec.url, submittedAt: iso(round.at), submittedBy: round.by })
    events.push({ id: nextId('e'), type: i === 0 ? 'submitted' : 'resubmitted', actor: round.by, at: iso(round.at), version: number })
    status = 'awaiting_review'

    const review = round.review
    if (!review) return
    const findings = runChecks(fields, spec.product)
    const find = (rule: RuleId, nth = 0) => {
      const match = findings.filter((f) => f.ruleId === rule)[nth]
      if (!match) throw new Error(`Seed ${spec.id} v${number}: no "${rule}" finding #${nth}`)
      return match
    }
    const at = iso(review.at)

    for (const entry of review.confirm ?? []) {
      const [rule, nth] = Array.isArray(entry) ? entry : [entry, 0]
      const finding = find(rule, nth)
      findingReviews.push({ findingKey: finding.key, version: number, decision: 'confirmed', reviewer: REVIEWER_NAME, at })
      comments.push({
        id: nextId('c'),
        version: number,
        field: finding.field,
        quote: finding.text,
        body: CHECK_RULES[rule].guidance,
        visibility: 'shared',
        author: REVIEWER_NAME,
        at,
        findingKey: finding.key,
        resolved: false,
      })
    }
    for (const d of review.dismiss ?? []) {
      findingReviews.push({
        findingKey: find(d.rule, d.nth).key,
        version: number,
        decision: 'dismissed',
        note: d.note,
        reviewer: REVIEWER_NAME,
        at,
      })
    }
    for (const c of review.comments ?? []) {
      comments.push({
        id: nextId('c'),
        version: number,
        field: c.field,
        quote: c.quote,
        body: c.body,
        visibility: c.internal ? 'internal' : 'shared',
        author: REVIEWER_NAME,
        at,
        resolved: false,
      })
    }
    events.push({
      id: nextId('e'),
      type: review.decision,
      actor: REVIEWER_NAME,
      at,
      version: number,
      ...(review.note ? { note: review.note } : {}),
    })
    status = review.decision
  })

  return {
    id: spec.id,
    title: spec.title,
    product: spec.product,
    assetType: spec.assetType,
    partnerId: spec.partnerId,
    ...(spec.neededBy !== undefined ? { neededBy: iso(spec.neededBy) } : {}),
    status,
    versions,
    findingReviews,
    comments,
    events,
  }
}

// ---------- Submissions ----------

const SUBMISSIONS: SeedSubmission[] = [
  {
    id: 's-1001',
    title: 'Debt consolidation email: summer send',
    product: 'personal_loan',
    assetType: 'email',
    partnerId: 'p-brightpath',
    neededBy: 2 * DAY,
    url: 'https://offers.brightpathmedia.com/clearpath/consolidate',
    rounds: [
      {
        at: -20 * HOUR,
        by: 'Trevor Shepherd',
        fields: [
          ['subject', 'Guaranteed approval on personal loans up to $40,000'],
          [
            'body',
            'Tired of juggling credit card bills? Consolidate your debt with a ClearPath personal loan. Rates as low as 7.99% and one fixed monthly payment that fits your budget. Checking your options takes two minutes, with no credit check required.',
          ],
          ['cta', 'Get my loan today'],
          ['disclosure', 'Loans offered by ClearPath Financial. Terms apply.'],
        ],
      },
    ],
  },
  {
    id: 's-1002',
    title: 'Mortgage prequalification comparison page',
    product: 'mortgage_prequal',
    assetType: 'landing_page',
    partnerId: 'p-lendcompare',
    neededBy: 5 * DAY,
    url: 'https://lendcompare.com/mortgage/clearpath',
    rounds: [
      {
        at: -3 * DAY,
        by: 'Claire Rafferty',
        fields: [
          ['headline', 'Get pre-approved for a mortgage in minutes'],
          [
            'body',
            'Compare offers from trusted lenders, including ClearPath Financial. ClearPath helps first-time buyers see what they may qualify for, with the lowest rates in the market. Prequalifying won’t affect your credit score.',
          ],
          ['cta', 'See my options'],
          [
            'disclosure',
            'Prequalification is not a commitment to lend. APR will vary based on credit profile, loan amount, and property details.',
          ],
        ],
      },
    ],
  },
  {
    id: 's-1003',
    title: 'Cash-back card display ad',
    product: 'credit_card',
    assetType: 'display_ad',
    partnerId: 'p-brightpath',
    neededBy: 6 * DAY,
    url: 'https://offers.brightpathmedia.com/clearpath/cashback',
    rounds: [
      {
        at: -4 * DAY,
        by: 'Trevor Shepherd',
        fields: [
          ['headline', 'Risk-free rewards on every purchase'],
          ['body', 'Earn 3% cash back on groceries and 1% on everything else. No annual fee.'],
          ['cta', 'Apply now'],
        ],
        review: {
          at: -2 * DAY - 3 * HOUR,
          decision: 'changes_requested',
          confirm: ['absolute_claim'],
          dismiss: [
            { rule: 'rate_without_apr', nth: 0, note: 'Cash-back percentages, not a rate claim.' },
            { rule: 'rate_without_apr', nth: 1, note: 'Cash-back percentages, not a rate claim.' },
          ],
          comments: [
            {
              field: 'body',
              quote: 'No annual fee.',
              body: 'If there are other fees (late payment, foreign transaction), add a reference right after this claim, e.g. “See Rates & Fees for other fees.”',
            },
            {
              field: 'headline',
              body: 'Second BrightPath asset this month using "risk-free". Worth checking their other live placements.',
              internal: true,
            },
          ],
        },
      },
    ],
  },
  {
    id: 's-1004',
    title: 'Personal loan rate search ad',
    product: 'personal_loan',
    assetType: 'search_ad',
    partnerId: 'p-ratescout',
    neededBy: 1 * DAY,
    url: 'https://ratescout.com/go/clearpath-personal',
    rounds: [
      {
        at: -5 * HOUR,
        by: 'Emily Burger',
        fields: [
          ['headline', 'Personal Loans from 8.99% APR'],
          [
            'description',
            'Check your rate in minutes with no impact to your credit score. Loans from $2,000 to $40,000. Terms apply.',
          ],
        ],
      },
    ],
  },
  {
    id: 's-1005',
    title: 'Cash Rewards card creator post',
    product: 'credit_card',
    assetType: 'social_post',
    partnerId: 'p-frugal',
    neededBy: 3 * DAY,
    url: 'https://frugalledger.com/go/clearpath-cash',
    rounds: [
      {
        at: -1 * DAY - 2 * HOUR,
        by: 'Olivia Schleifer',
        fields: [
          [
            'post',
            'Finally switched to the ClearPath Cash Rewards card and honestly it’s the best card for everyday spending. No fees, no stress, just cash back on everything.',
          ],
          ['cta', 'Apply through my link'],
        ],
      },
    ],
  },
  {
    id: 's-1006',
    title: 'Personal loan comparison email',
    product: 'personal_loan',
    assetType: 'email',
    partnerId: 'p-lendcompare',
    neededBy: 1 * DAY,
    url: 'https://lendcompare.com/email/personal-loans',
    rounds: [
      {
        at: -3 * DAY,
        by: 'Claire Rafferty',
        fields: [
          ['subject', 'Guaranteed approval: rates from 6.99%'],
          [
            'body',
            'Compare personal loan offers from ClearPath Financial and other trusted lenders. Borrow $5,000 to $40,000 with fixed monthly payments and no prepayment penalties.',
          ],
          ['cta', 'Compare my offers'],
          ['disclosure', 'LendCompare is a comparison service and may receive compensation from lenders.'],
        ],
        review: {
          at: -2 * DAY,
          decision: 'changes_requested',
          confirm: ['approval_certainty', 'rate_without_apr'],
          comments: [
            {
              field: 'disclosure',
              body: 'Please identify ClearPath Financial as the lender for ClearPath offers in the disclosure.',
            },
          ],
        },
      },
      {
        at: -6 * HOUR,
        by: 'Claire Rafferty',
        fields: [
          ['subject', 'Personal loan rates from 6.99% APR'],
          [
            'body',
            'Compare personal loan offers from ClearPath Financial and other trusted lenders, with some of the lowest rates available. Borrow $5,000 to $40,000 with fixed monthly payments and no prepayment penalties.',
          ],
          ['cta', 'Compare my offers'],
          [
            'disclosure',
            'LendCompare is a comparison service and may receive compensation from lenders. Rates shown are for well-qualified borrowers; your APR will depend on your credit profile.',
          ],
        ],
      },
    ],
  },
  {
    id: 's-1007',
    title: 'Cash Rewards card landing page',
    product: 'credit_card',
    assetType: 'landing_page',
    partnerId: 'p-growth',
    neededBy: -4 * DAY,
    url: 'https://clearpathfinancial.com/cards/cash-rewards',
    rounds: [
      {
        at: -6 * DAY,
        by: 'Abdullah Fattahi',
        fields: [
          ['headline', 'Earn 2% cash back on every purchase'],
          [
            'body',
            'The ClearPath Cash Rewards card has no annual fee and earns unlimited 2% cash back. See the rates and fees page for APR and other terms.',
          ],
          ['cta', 'Apply now'],
          ['disclosure', 'Variable APR of 19.99%–28.99% based on creditworthiness. See rates and fees.'],
        ],
        review: { at: -5 * DAY, decision: 'approved' },
      },
    ],
  },
  {
    id: 's-1008',
    title: 'Debt consolidation social post',
    product: 'personal_loan',
    assetType: 'social_post',
    partnerId: 'p-brightpath',
    neededBy: -8 * DAY,
    url: 'https://offers.brightpathmedia.com/clearpath/social',
    rounds: [
      {
        at: -12 * DAY,
        by: 'Trevor Shepherd',
        fields: [
          [
            'post',
            'Need cash fast? ClearPath personal loans are risk-free to apply for and everyone qualifies for a rate check.',
          ],
          ['cta', 'Check your rate'],
        ],
        review: {
          at: -11 * DAY,
          decision: 'changes_requested',
          confirm: ['absolute_claim', 'approval_certainty'],
        },
      },
      {
        at: -10 * DAY,
        by: 'Trevor Shepherd',
        fields: [
          [
            'post',
            'Need to consolidate debt? Check your ClearPath personal loan rate in minutes. Checking your rate won’t affect your credit score.',
          ],
          ['cta', 'Check your rate'],
        ],
        review: { at: -9 * DAY, decision: 'approved' },
      },
    ],
  },
  {
    id: 's-1009',
    title: 'Mortgage prequalification search ad',
    product: 'mortgage_prequal',
    assetType: 'search_ad',
    partnerId: 'p-ratescout',
    neededBy: 4 * DAY,
    url: 'https://ratescout.com/go/clearpath-mortgage',
    rounds: [
      {
        at: -2 * DAY,
        by: 'Emily Burger',
        fields: [
          ['headline', 'Get Pre-Approved for a Mortgage Today'],
          ['description', 'Fast, simple online application. See how much home you can afford with ClearPath Financial.'],
        ],
        review: { at: -1 * DAY, decision: 'changes_requested', confirm: ['prequal_wording'] },
      },
    ],
  },
  {
    id: 's-1010',
    title: 'Personal loan landing page',
    product: 'personal_loan',
    assetType: 'landing_page',
    partnerId: 'p-frugal',
    neededBy: -5 * DAY,
    url: 'https://frugalledger.com/go/clearpath-loans',
    rounds: [
      {
        at: -8 * DAY,
        by: 'Olivia Schleifer',
        fields: [
          ['headline', 'Free money for your next big purchase'],
          [
            'body',
            'ClearPath personal loans put free money in your account with no credit check and funding guaranteed the same day.',
          ],
          ['cta', 'Get my money'],
          ['disclosure', 'The Frugal Ledger is not a lender.'],
        ],
        review: {
          at: -7 * DAY,
          decision: 'rejected',
          note: 'Describes loan proceeds as free money and promises guaranteed same-day funding, which ClearPath does not offer. Please submit a new asset built from approved messaging.',
          confirm: ['absolute_claim', 'no_credit_check'],
        },
      },
    ],
  },
  {
    id: 's-1011',
    title: 'Mortgage prequalification display ad',
    product: 'mortgage_prequal',
    assetType: 'display_ad',
    partnerId: 'p-growth',
    neededBy: 4 * DAY,
    url: 'https://clearpathfinancial.com/mortgage/prequalify',
    rounds: [
      {
        at: -1 * DAY,
        by: 'Abdullah Fattahi',
        fields: [
          ['headline', 'See what you could qualify for'],
          ['body', 'Prequalify for a ClearPath mortgage in minutes. Rates as low as 5.875%.'],
          ['cta', 'Prequalify now'],
        ],
      },
    ],
  },
  {
    id: 's-1012',
    title: 'Cash-back card comparison banner',
    product: 'credit_card',
    assetType: 'display_ad',
    partnerId: 'p-lendcompare',
    neededBy: -12 * DAY,
    url: 'https://lendcompare.com/cards/cash-back',
    rounds: [
      {
        at: -15 * DAY,
        by: 'Claire Rafferty',
        fields: [
          ['headline', 'Cash back on every purchase'],
          ['body', 'Compare ClearPath Cash Rewards with other cash back cards on LendCompare.'],
          ['cta', 'Compare cards'],
        ],
        review: { at: -14 * DAY, decision: 'approved' },
      },
    ],
  },
  {
    id: 's-1013',
    title: 'Lower monthly payment landing page',
    product: 'personal_loan',
    assetType: 'landing_page',
    partnerId: 'p-brightpath',
    neededBy: -1 * DAY,
    url: 'https://offers.brightpathmedia.com/clearpath/lower-payment',
    rounds: [
      {
        at: -2 * DAY - 4 * HOUR,
        by: 'Trevor Shepherd',
        fields: [
          ['headline', 'Lower your monthly payment today'],
          [
            'body',
            'Combine high-interest balances into one ClearPath personal loan. Payments from $189/mo for qualified borrowers, with the lowest rates we’ve seen from any lender.',
          ],
          ['cta', 'See my offers'],
          ['disclosure', 'Loan terms and eligibility vary. Subject to credit approval.'],
        ],
      },
    ],
  },
  {
    id: 's-1014',
    title: 'Cash Rewards card search ad',
    product: 'credit_card',
    assetType: 'search_ad',
    partnerId: 'p-growth',
    neededBy: 6 * DAY,
    url: 'https://clearpathfinancial.com/cards/cash-rewards',
    rounds: [
      {
        at: -40 * 60 * 1000,
        by: 'Abdullah Fattahi',
        fields: [
          ['headline', 'ClearPath Cash Rewards Card'],
          ['description', 'Unlimited 2% cash back and no annual fee. Apply online in minutes.'],
        ],
      },
    ],
  },
]

/** Seed data with dates relative to `now`, so the queue never looks stale. */
export function createSeed(now: Date = new Date()): AppState {
  const t = now.getTime()
  return { partners: PARTNERS, submissions: SUBMISSIONS.map((s) => build(s, t)) }
}
