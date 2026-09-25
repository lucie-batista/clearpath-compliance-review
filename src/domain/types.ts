export type Product = 'personal_loan' | 'credit_card' | 'mortgage_prequal'

export type AssetType =
  | 'affiliate_landing_page'
  | 'affiliate_email'
  | 'display_ad'
  | 'social_ad'
  | 'marketing_email'

export type FieldKey = 'subject' | 'headline' | 'post' | 'body' | 'cta' | 'disclosure'

export interface AssetField {
  key: FieldKey
  text: string
}

export interface Partner {
  id: string
  name: string
  kind: 'affiliate' | 'internal'
}

export interface Version {
  number: number
  fields: AssetField[]
  destinationUrl?: string
  submittedAt: string
  submittedBy: string
}

export type SubmissionStatus = 'awaiting_review' | 'changes_requested' | 'approved' | 'rejected'

/** The reviewer's decision on one automatically detected potential issue. */
export interface FindingReview {
  findingKey: string
  version: number
  decision: 'confirmed' | 'dismissed'
  note?: string
  reviewer: string
  at: string
}

export type Visibility = 'shared' | 'internal'

export interface Comment {
  id: string
  version: number
  field: FieldKey
  /** Exact text the comment refers to, used to re-locate it in later versions. */
  quote?: string
  body: string
  visibility: Visibility
  author: string
  at: string
  /** Set when the comment was created by confirming an automated finding. */
  findingKey?: string
  resolved: boolean
}

export type EventType = 'submitted' | 'resubmitted' | 'changes_requested' | 'approved' | 'rejected'

export interface HistoryEvent {
  id: string
  type: EventType
  actor: string
  at: string
  version: number
  note?: string
}

export interface Submission {
  id: string
  title: string
  product: Product
  assetType: AssetType
  partnerId: string
  /** Assumption: submitters provide a needed-by date. Not stated in the assignment. */
  neededBy?: string
  status: SubmissionStatus
  versions: Version[]
  findingReviews: FindingReview[]
  comments: Comment[]
  events: HistoryEvent[]
}

export interface AppState {
  partners: Partner[]
  submissions: Submission[]
}
