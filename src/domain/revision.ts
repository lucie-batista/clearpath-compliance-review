import { diffWords } from 'diff'
import { runChecks, type Finding } from './checks'
import type { AssetField, Comment, FieldKey, Submission, Version } from './types'
import { latestVersion } from './workflow'

/**
 * Revision review: what changed between the previous version and the latest one,
 * so the reviewer verifies changes instead of rereading the whole asset.
 */

export interface DiffPart {
  text: string
  change: 'added' | 'removed' | 'same'
}

export interface FieldDiff {
  key: FieldKey
  parts: DiffPart[]
  changed: boolean
}

export function previousVersion(submission: Submission): Version | undefined {
  return submission.versions.length > 1 ? submission.versions[submission.versions.length - 2] : undefined
}

export function diffFields(before: AssetField[], after: AssetField[]): FieldDiff[] {
  return after.map((field) => {
    const old = before.find((f) => f.key === field.key)?.text ?? ''
    const parts: DiffPart[] = diffWords(old, field.text).map((c) => ({
      text: c.value,
      change: c.added ? 'added' : c.removed ? 'removed' : 'same',
    }))
    return { key: field.key, parts, changed: old !== field.text }
  })
}

/** Number of separate edits: each run of consecutive additions/removals counts once. */
export function countEdits(diffs: FieldDiff[]): number {
  let edits = 0
  for (const d of diffs) {
    let inEdit = false
    for (const p of d.parts) {
      const isChange = p.change !== 'same' && p.text.trim() !== ''
      if (isChange && !inEdit) edits++
      if (p.change === 'same' && p.text.trim() !== '') inEdit = false
      else if (isChange) inEdit = true
    }
  }
  return edits
}

export type FeedbackStatus = 'text_changed' | 'text_unchanged' | 'field_changed' | 'field_unchanged'

/**
 * Checks earlier feedback against the new version. This reports what changed, not whether the
 * feedback was addressed: that judgment stays with the reviewer.
 */
export function feedbackStatus(comment: Comment, after: AssetField[], before: AssetField[]): FeedbackStatus {
  const now = after.find((f) => f.key === comment.field)?.text ?? ''
  if (comment.quote) return now.includes(comment.quote) ? 'text_unchanged' : 'text_changed'
  const then = before.find((f) => f.key === comment.field)?.text ?? ''
  return now === then ? 'field_unchanged' : 'field_changed'
}

export interface FindingComparison {
  fromVersion: number
  toVersion: number
  /** Flagged on the previous version, no longer detected. */
  resolved: Finding[]
  /** Detected on both versions (same rule, field, and text). */
  stillPresent: Finding[]
  /** Only detected on the latest version. */
  introduced: Finding[]
}

export function compareFindings(submission: Submission): FindingComparison | undefined {
  const prev = previousVersion(submission)
  if (!prev) return undefined
  const before = runChecks(prev.fields, submission.product)
  const after = runChecks(latestVersion(submission).fields, submission.product)
  const beforeKeys = new Set(before.map((f) => f.key))
  const afterKeys = new Set(after.map((f) => f.key))
  return {
    fromVersion: prev.number,
    toVersion: latestVersion(submission).number,
    resolved: before.filter((f) => !afterKeys.has(f.key)),
    stillPresent: after.filter((f) => beforeKeys.has(f.key)),
    introduced: after.filter((f) => !beforeKeys.has(f.key)),
  }
}

export interface RevisionSummary {
  fromVersion: number
  toVersion: number
  edits: number
  fieldsChanged: number
  feedbackTotal: number
  feedbackTextChanged: number
  resolved: number
  stillPresent: number
  introduced: number
}

export function revisionSummary(submission: Submission): RevisionSummary | undefined {
  const prev = previousVersion(submission)
  const comparison = compareFindings(submission)
  if (!prev || !comparison) return undefined
  const current = latestVersion(submission)
  const diffs = diffFields(prev.fields, current.fields)
  const feedback = submission.comments.filter((c) => c.version === prev.number && c.visibility === 'shared')
  return {
    fromVersion: prev.number,
    toVersion: current.number,
    edits: countEdits(diffs),
    fieldsChanged: diffs.filter((d) => d.changed).length,
    feedbackTotal: feedback.length,
    feedbackTextChanged: feedback.filter((c) => {
      const s = feedbackStatus(c, current.fields, prev.fields)
      return s === 'text_changed' || s === 'field_changed'
    }).length,
    resolved: comparison.resolved.length,
    stillPresent: comparison.stillPresent.length,
    introduced: comparison.introduced.length,
  }
}
