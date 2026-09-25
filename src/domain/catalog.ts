import type { AssetType, EventType, FieldKey, Product, SubmissionStatus } from './types'

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  awaiting_review: 'Awaiting review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const EVENT_LABELS: Record<EventType, string> = {
  submitted: 'Submitted',
  resubmitted: 'Resubmitted',
  changes_requested: 'Requested changes',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const PRODUCT_LABELS: Record<Product, string> = {
  personal_loan: 'Personal loan',
  credit_card: 'Credit card',
  mortgage_prequal: 'Mortgage prequalification',
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  landing_page: 'Landing page',
  email: 'Email',
  search_ad: 'Search ad',
  social_post: 'Social post',
  display_ad: 'Display ad',
}

/** Each asset type is an ordered template of labeled text fields. */
export const ASSET_TEMPLATES: Record<AssetType, FieldKey[]> = {
  landing_page: ['headline', 'body', 'cta', 'disclosure'],
  email: ['subject', 'body', 'cta', 'disclosure'],
  search_ad: ['headline', 'description'],
  social_post: ['post', 'cta'],
  display_ad: ['headline', 'body', 'cta'],
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  subject: 'Subject line',
  headline: 'Headline',
  post: 'Post text',
  body: 'Body',
  description: 'Description',
  cta: 'Call to action',
  disclosure: 'Disclosure',
}
