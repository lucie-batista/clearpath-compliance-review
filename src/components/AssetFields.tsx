import { FIELD_LABELS } from '../domain/catalog'
import type { AssetField } from '../domain/types'

export function AssetFields({ fields }: { fields: AssetField[] }) {
  return (
    <dl className="asset-fields">
      {fields.map((field) => (
        <div key={field.key}>
          <dt>{FIELD_LABELS[field.key]}</dt>
          <dd>{field.text}</dd>
        </div>
      ))}
    </dl>
  )
}
