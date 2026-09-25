import type { RevisionSummary as Summary } from '../../../domain/revision'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** One-line answer to "what do I need to look at in this resubmission?" */
export function RevisionSummary({ summary }: { summary: Summary }) {
  const items = [
    `${plural(summary.edits, 'edit')} in ${plural(summary.fieldsChanged, 'field')}`,
    summary.feedbackTotal > 0 &&
      `${summary.feedbackTextChanged} of ${summary.feedbackTotal} feedback items have changed text`,
    summary.resolved > 0 && `${plural(summary.resolved, 'issue')} no longer detected`,
    summary.introduced > 0 && `${plural(summary.introduced, 'new potential issue')}`,
    summary.stillPresent > 0 && `${summary.stillPresent} still present`,
  ].filter(Boolean)

  return (
    <div className="revision-summary">
      <span className="revision-label">
        Resubmission · changes since v{summary.fromVersion}
      </span>
      <span>{items.join(' · ')}</span>
    </div>
  )
}
