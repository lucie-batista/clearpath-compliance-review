import { FIELD_LABELS } from '../domain/catalog'
import type { FieldDiff } from '../domain/revision'

/** Word-level changes per field. Unchanged fields are shown dimmed so edits stand out. */
export function DiffFields({ diffs }: { diffs: FieldDiff[] }) {
  return (
    <dl className="asset-fields">
      {diffs.map((d) => (
        <div key={d.key} className={`asset-field ${d.changed ? '' : 'asset-field-unchanged'}`}>
          <dt>
            {FIELD_LABELS[d.key]}
            <span className={d.changed ? 'field-flag field-flag-changed' : 'field-flag'}>
              {d.changed ? 'Changed' : 'No changes'}
            </span>
          </dt>
          <dd>
            {d.parts.map((p, i) =>
              p.change === 'added' ? (
                <ins key={i} className="diff-added">
                  {p.text}
                </ins>
              ) : p.change === 'removed' ? (
                <del key={i} className="diff-removed">
                  {p.text}
                </del>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
