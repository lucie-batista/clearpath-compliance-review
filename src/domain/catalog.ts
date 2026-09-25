import type { AssetType, FieldKey, Product } from './types'

export const PRODUCT_LABELS: Record<Product, string> = {
  personal_loan: 'Personal loan',
  credit_card: 'Credit card',
  mortgage_prequal: 'Mortgage prequalification',
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  affiliate_landing_page: 'Affiliate landing page',
  affiliate_email: 'Affiliate email',
  display_ad: 'Display ad',
  social_ad: 'Social ad',
  marketing_email: 'Marketing email',
}

/** Each asset type is an ordered template of labeled text fields. */
export const ASSET_TEMPLATES: Record<AssetType, FieldKey[]> = {
  affiliate_landing_page: ['headline', 'body', 'cta', 'disclosure'],
  affiliate_email: ['subject', 'body', 'cta', 'disclosure'],
  display_ad: ['headline', 'body', 'cta'],
  social_ad: ['post', 'cta'],
  marketing_email: ['subject', 'body', 'cta', 'disclosure'],
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  subject: 'Subject line',
  headline: 'Headline',
  post: 'Post text',
  body: 'Body',
  cta: 'Call to action',
  disclosure: 'Disclosure',
}
