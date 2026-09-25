import { ruleIdFromKey, type RuleId } from './checks'
import type { Submission } from './types'

export interface PartnerHistory {
  /** Other submissions from the same partner. */
  total: number
  neededChanges: number
  approved: number
  rejected: number
  /** Issue types reviewers previously confirmed for this partner, most frequent first. */
  flagged: { ruleId: RuleId; count: number }[]
}

export function partnerHistory(submissions: Submission[], current: Submission): PartnerHistory {
  const others = submissions.filter((s) => s.partnerId === current.partnerId && s.id !== current.id)
  const flagged = new Map<RuleId, number>()
  for (const s of others) {
    for (const r of s.findingReviews) {
      if (r.decision !== 'confirmed') continue
      const rule = ruleIdFromKey(r.findingKey)
      flagged.set(rule, (flagged.get(rule) ?? 0) + 1)
    }
  }
  return {
    total: others.length,
    neededChanges: others.filter((s) => s.events.some((e) => e.type === 'changes_requested')).length,
    approved: others.filter((s) => s.status === 'approved').length,
    rejected: others.filter((s) => s.status === 'rejected').length,
    flagged: [...flagged].map(([ruleId, count]) => ({ ruleId, count })).sort((a, b) => b.count - a.count),
  }
}
