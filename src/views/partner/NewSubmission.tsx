import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ASSET_TEMPLATES, ASSET_TYPE_LABELS, FIELD_LABELS, PRODUCT_LABELS } from '../../domain/catalog'
import type { AssetType, FieldKey, Product } from '../../domain/types'
import { useActions, useAppState } from '../../state/store'

const PRODUCTS = Object.keys(PRODUCT_LABELS) as Product[]
const ASSET_TYPES = Object.keys(ASSET_TEMPLATES) as AssetType[]

const PLACEHOLDERS: Partial<Record<FieldKey, string>> = {
  subject: 'e.g. Consolidate your credit card debt',
  headline: 'e.g. Check your personal loan rate in minutes',
  post: 'The full text of the post',
  body: 'The main copy, exactly as it will appear',
  description: 'e.g. Fixed-rate personal loans from $2,000 to $40,000. Terms apply.',
  cta: 'e.g. Check my rate',
  disclosure: 'Required disclosures and fine print',
}

function todayISODate() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function NewSubmission() {
  const { partnerId } = useParams()
  const { partners } = useAppState()
  const actions = useActions()
  const navigate = useNavigate()
  const partner = partners.find((p) => p.id === partnerId)

  const [title, setTitle] = useState('')
  const [product, setProduct] = useState<Product | ''>('')
  const [assetType, setAssetType] = useState<AssetType | ''>('')
  const [texts, setTexts] = useState<Partial<Record<FieldKey, string>>>({})
  const [url, setUrl] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [attempted, setAttempted] = useState(false)

  if (!partner) {
    return (
      <div className="empty-state card">
        <h2>Partner not found</h2>
        <Link to="/review">Back to review queue</Link>
      </div>
    )
  }

  const template = assetType ? ASSET_TEMPLATES[assetType] : []
  const today = todayISODate()
  const errors = {
    title: !title.trim() && 'Give the submission a short name.',
    product: !product && 'Choose the product this marketing promotes.',
    assetType: !assetType && 'Choose the asset type.',
    fields: template.some((k) => !texts[k]?.trim()) && 'Fill in every field.',
    neededBy: neededBy && neededBy < today && 'The date can’t be in the past.',
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (e: string | false | '') => attempted && e && <span className="field-error">{e}</span>

  function submit() {
    setAttempted(true)
    if (!valid || !product || !assetType || !partner) return
    const id = actions.createSubmission(
      {
        title,
        product,
        assetType,
        partnerId: partner.id,
        // End of the chosen day, local time.
        neededBy: neededBy ? new Date(`${neededBy}T17:00:00`).toISOString() : undefined,
        destinationUrl: url,
        fields: template.map((key) => ({ key, text: texts[key] ?? '' })),
      },
      partner.contact,
    )
    navigate(`/partner/${partner.id}/${id}`)
  }

  return (
    <section className="page">
      <Link to={`/partner/${partner.id}`} className="back-link">
        ← Your submissions
      </Link>
      <header className="page-header">
        <h1>New submission</h1>
        <p className="page-summary">
          Submit marketing copy to ClearPath compliance for review. Enter the text exactly as it will appear.
        </p>
      </header>

      <form
        className="panel new-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="form-grid">
          <label className="field field-wide">
            Submission name
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Personal loan search ad: October"
            />
            {show(errors.title)}
          </label>
          <label className="field">
            Product
            <select value={product} onChange={(e) => setProduct(e.target.value as Product)}>
              <option value="">Choose a product</option>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABELS[p]}
                </option>
              ))}
            </select>
            {show(errors.product)}
          </label>
          <label className="field">
            Asset type
            <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)}>
              <option value="">Choose an asset type</option>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ASSET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            {show(errors.assetType)}
          </label>
          <label className="field">
            <span>
              Needed by <span className="subtle">(optional)</span>
            </span>
            <input type="date" min={today} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            {show(errors.neededBy)}
          </label>
          <label className="field">
            <span>
              Destination URL <span className="subtle">(optional)</span>
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Where this ad links to"
            />
          </label>
        </div>

        <div className="new-copy">
          <h2>Copy</h2>
          {template.length === 0 ? (
            <p className="muted">Choose an asset type to see the fields to fill in.</p>
          ) : (
            template.map((key) => (
              <label key={key} className="field">
                {FIELD_LABELS[key]}
                <textarea
                  rows={key === 'body' || key === 'post' ? 4 : 2}
                  value={texts[key] ?? ''}
                  placeholder={PLACEHOLDERS[key]}
                  onChange={(e) => setTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))
          )}
          {show(errors.fields)}
        </div>

        <div className="revise-footer">
          <button type="submit" className="btn btn-primary">
            Submit for review
          </button>
          <span className="subtle">Submitting as {partner.contact}, {partner.name}</span>
        </div>
      </form>
    </section>
  )
}
