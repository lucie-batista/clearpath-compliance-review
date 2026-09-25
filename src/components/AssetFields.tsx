import type { ReactNode } from 'react'
import { FIELD_LABELS } from '../domain/catalog'
import type { AssetField, FieldKey } from '../domain/types'

export interface Highlight {
  id: string
  field: FieldKey
  start: number
  end: number
  tone: 'open' | 'confirmed' | 'dismissed'
  label: string
}

interface Props {
  fields: AssetField[]
  highlights?: Highlight[]
  activeId?: string | null
  onSelect?: (id: string) => void
}

export function AssetFields({ fields, highlights = [], activeId, onSelect }: Props) {
  return (
    <dl className="asset-fields">
      {fields.map((field) => (
        <div key={field.key} className="asset-field">
          <dt>{FIELD_LABELS[field.key]}</dt>
          <dd>
            {renderText(
              field.text,
              highlights.filter((h) => h.field === field.key),
              activeId,
              onSelect,
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function renderText(
  text: string,
  highlights: Highlight[],
  activeId: string | null | undefined,
  onSelect: ((id: string) => void) | undefined,
): ReactNode[] {
  const parts: ReactNode[] = []
  let cursor = 0
  for (const h of [...highlights].sort((a, b) => a.start - b.start)) {
    if (h.start < cursor) continue // overlapping match: keep the first one
    if (h.start > cursor) parts.push(text.slice(cursor, h.start))
    parts.push(
      <mark
        key={h.id}
        className={`hl hl-${h.tone} ${h.id === activeId ? 'hl-active' : ''}`}
        title={h.label}
        role={onSelect ? 'button' : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onClick={onSelect ? () => onSelect(h.id) : undefined}
        onKeyDown={
          onSelect
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(h.id)
                }
              }
            : undefined
        }
      >
        {text.slice(h.start, h.end)}
      </mark>,
    )
    cursor = h.end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}
