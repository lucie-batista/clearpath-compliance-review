import type { AssetField, FieldKey, Product } from './types'

/**
 * Illustrative ClearPath policy checks. These are deterministic and explainable
 * by design: every finding is a *potential* issue for the reviewer to confirm
 * or dismiss, never a compliance determination.
 */

export type RuleId =
  | 'approval_certainty'
  | 'no_credit_check'
  | 'prequal_wording'
  | 'rate_without_apr'
  | 'superlative'
  | 'absolute_claim'

export interface CheckRule {
  id: RuleId
  label: string
  /** Why the check fired, shown to the reviewer. */
  explanation: string
  /** Default feedback shared with the partner when the reviewer confirms the finding. */
  guidance: string
}

export interface Finding {
  /** Stable across versions, so a re-run can tell "still detected" from "new". */
  key: string
  ruleId: RuleId
  field: FieldKey
  text: string
  start: number
  end: number
}

interface CheckContext {
  fields: AssetField[]
  product: Product
}

interface Match {
  field: FieldKey
  text: string
  start: number
}

interface RuleDefinition extends CheckRule {
  detect: (ctx: CheckContext) => Match[]
}

function matchAll(pattern: RegExp, fields: AssetField[]): Match[] {
  const matches: Match[] = []
  for (const field of fields) {
    for (const m of field.text.matchAll(pattern)) {
      matches.push({ field: field.key, text: m[0], start: m.index })
    }
  }
  return matches
}

const RATE_OR_PAYMENT =
  /\b\d{1,2}(?:\.\d{1,3})?\s?%|\$\d[\d,]*(?:\.\d{2})?\s?(?:\/\s?mo(?:nth)?|per month|a month)\b/gi
const APR_MENTION = /\bAPR\b|annual percentage rate/i

const RULES: RuleDefinition[] = [
  {
    id: 'approval_certainty',
    label: 'Approval certainty',
    explanation:
      'Language suggests approval is guaranteed or certain. Credit products typically require an application and a credit decision.',
    guidance:
      'Please remove language implying approval is guaranteed or certain. Approval depends on the application and credit decision.',
    detect: ({ fields }) =>
      matchAll(
        /\b(?:guaranteed(?: loan)? approval|approval (?:is )?guaranteed|you(?:'|’)re (?:already )?approved|everyone (?:qualifies|is approved)|100% approval)\b/gi,
        fields,
      ),
  },
  {
    id: 'no_credit_check',
    label: 'No credit check claim',
    explanation:
      'Claims no credit check is involved. This may be inaccurate if the application includes a credit review.',
    guidance:
      'Please remove or qualify the "no credit check" claim unless it accurately describes the full application process.',
    detect: ({ fields }) =>
      matchAll(/\b(?:no credit checks?|without (?:a )?credit check)\b/gi, fields),
  },
  {
    id: 'prequal_wording',
    label: 'Pre-approval wording',
    explanation:
      'Uses pre-approval language for a prequalification product. Prequalification is not an approval or a commitment to lend.',
    guidance:
      'Please use "prequalify" or "prequalification" instead of pre-approval language for this product.',
    detect: ({ fields, product }) =>
      product === 'mortgage_prequal' ? matchAll(/\bpre-?approv(?:ed|al)\b/gi, fields) : [],
  },
  {
    id: 'rate_without_apr',
    label: 'Rate claim without APR',
    explanation:
      'A rate or payment amount appears, but APR is not mentioned anywhere in the asset. Rate claims typically need accompanying disclosures.',
    guidance:
      'Please add the APR or APR range and relevant terms alongside this rate or payment claim, or in the disclosure.',
    detect: ({ fields }) =>
      fields.some((f) => APR_MENTION.test(f.text)) ? [] : matchAll(RATE_OR_PAYMENT, fields),
  },
  {
    id: 'superlative',
    label: 'Unsupported superlative',
    explanation: 'Comparative or superlative claim that may need substantiation.',
    guidance: 'Please remove this superlative or provide the basis for the claim.',
    detect: ({ fields }) =>
      matchAll(
        /#1\b|\b(?:lowest|best|cheapest)\s+(?:rates?|prices?|payments?|deals?|cards?|loans?|offers?)\b|\bnumber one\b|\bunbeatable\b/gi,
        fields,
      ),
  },
  {
    id: 'absolute_claim',
    label: 'Absolute risk or cost claim',
    explanation: 'Absolute claim about risk or cost that may be misleading.',
    guidance: 'Please remove or qualify absolute claims such as "risk-free" or "no fees".',
    detect: ({ fields }) =>
      matchAll(/\b(?:risk[- ]free|no risk|zero risk|no fees|free money)\b/gi, fields),
  },
]

export const CHECK_RULES: Record<RuleId, CheckRule> = Object.fromEntries(
  RULES.map(({ id, label, explanation, guidance }) => [id, { id, label, explanation, guidance }]),
) as Record<RuleId, CheckRule>

/** Finding keys start with the rule ID (see runChecks). */
export function ruleIdFromKey(key: string): RuleId {
  return key.split('|')[0] as RuleId
}

export function runChecks(fields: AssetField[], product: Product): Finding[] {
  const fieldOrder = new Map(fields.map((f, i) => [f.key, i]))
  const findings: Finding[] = []

  for (const rule of RULES) {
    const occurrences = new Map<string, number>()
    for (const match of rule.detect({ fields, product })) {
      const base = `${rule.id}|${match.field}|${match.text.toLowerCase()}`
      const n = occurrences.get(base) ?? 0
      occurrences.set(base, n + 1)
      findings.push({
        key: `${base}|${n}`,
        ruleId: rule.id,
        field: match.field,
        text: match.text,
        start: match.start,
        end: match.start + match.text.length,
      })
    }
  }

  return findings.sort(
    (a, b) => (fieldOrder.get(a.field) ?? 0) - (fieldOrder.get(b.field) ?? 0) || a.start - b.start,
  )
}
