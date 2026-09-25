export type Product = 'personal_loan' | 'credit_card' | 'mortgage_prequal'

/** The format of the asset. Who submitted it is captured separately by the partner. */
export type AssetType = 'landing_page' | 'email' | 'search_ad' | 'social_post' | 'display_ad'

export type FieldKey = 'subject' | 'headline' | 'post' | 'body' | 'description' | 'cta' | 'disclosure'

export interface AssetField {
  key: FieldKey
  text: string
}

export interface Partner {
  id: string
  name: string
  kind: 'affiliate' | 'internal'
  /** The person who submits on the partner's behalf in this demo. */
  contact: string
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

export type AiCategory =
  | 'implied_claim'
  | 'missing_disclosure'
  | 'misleading_framing'
  | 'embedded_instructions'
  | 'other'

/** A potential issue suggested by the AI second opinion. Advisory only; the reviewer decides. */
export interface AiFinding {
  key: string
  field: FieldKey
  /** Verbatim text from the field (the server drops anything that isn't). */
  quote: string
  category: AiCategory
  title: string
  explanation: string
  suggestedFeedback: string
}

export interface AiReview {
  version: number
  at: string
  model: string
  findings: AiFinding[]
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
  /** AI second-opinion results, one per version it was run on. */
  aiReviews?: AiReview[]
}

export interface AppState {
  partners: Partner[]
  submissions: Submission[]
}
