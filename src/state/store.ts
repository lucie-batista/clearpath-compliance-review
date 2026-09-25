import { createContext, useContext, useMemo, type Dispatch } from 'react'
import { createSeed, REVIEWER_NAME } from '../data/seed'
import type { Finding } from '../domain/checks'
import type { AppState, AssetField, FieldKey, Visibility } from '../domain/types'
import type { Action } from '../domain/workflow'

export interface Store {
  state: AppState
  dispatch: Dispatch<Action>
}

export const StoreContext = createContext<Store | null>(null)

function useStoreContext(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}

export function useAppState(): AppState {
  return useStoreContext().state
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`
const now = () => new Date().toISOString()

/** UI-facing actions. Supplies IDs, timestamps, and the acting person so the reducer stays pure. */
export function useActions() {
  const { dispatch } = useStoreContext()
  return useMemo(
    () => ({
      reviewFinding: (
        submissionId: string,
        finding: Finding,
        decision: 'confirmed' | 'dismissed',
        commentBody?: string,
      ) =>
        dispatch({
          type: 'review_finding',
          submissionId,
          finding,
          decision,
          reviewer: REVIEWER_NAME,
          at: now(),
          comment: commentBody ? { id: newId('c'), body: commentBody } : undefined,
        }),
      clearFindingReview: (submissionId: string, findingKey: string) =>
        dispatch({ type: 'clear_finding_review', submissionId, findingKey }),
      addComment: (
        submissionId: string,
        comment: { field: FieldKey; quote?: string; body: string; visibility: Visibility },
      ) =>
        dispatch({
          type: 'add_comment',
          submissionId,
          comment: { ...comment, id: newId('c'), author: REVIEWER_NAME, at: now() },
        }),
      deleteComment: (submissionId: string, commentId: string) =>
        dispatch({ type: 'delete_comment', submissionId, commentId }),
      requestChanges: (submissionId: string, note?: string) =>
        dispatch({ type: 'request_changes', submissionId, actor: REVIEWER_NAME, at: now(), eventId: newId('e'), note }),
      approve: (submissionId: string, note?: string) =>
        dispatch({ type: 'approve', submissionId, actor: REVIEWER_NAME, at: now(), eventId: newId('e'), note }),
      resubmit: (submissionId: string, fields: AssetField[], actor: string) =>
        dispatch({ type: 'resubmit', submissionId, fields, actor, at: now(), eventId: newId('e') }),
      resetDemo: () => dispatch({ type: 'reset', state: createSeed() }),
    }),
    [dispatch],
  )
}
