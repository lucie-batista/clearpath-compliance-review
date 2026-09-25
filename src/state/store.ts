import { createContext, useContext, useMemo, type Dispatch } from 'react'
import { createSeed, REVIEWER_NAME } from '../data/seed'
import type { Finding } from '../domain/checks'
import type { AiReview, AppState, AssetField, FieldKey, Visibility } from '../domain/types'
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
        // Rule-based and AI findings both reduce to: which text, in which field, under which key.
        finding: Pick<Finding, 'key' | 'field' | 'text'>,
        decision: 'confirmed' | 'dismissed',
        commentBody?: string,
      ) =>
        dispatch({
          type: 'review_finding',
          submissionId,
          finding: { key: finding.key, field: finding.field, text: finding.text },
          decision,
          reviewer: REVIEWER_NAME,
          at: now(),
          comment: commentBody ? { id: newId('c'), body: commentBody } : undefined,
        }),
      setAiReview: (submissionId: string, review: AiReview) =>
        dispatch({ type: 'set_ai_review', submissionId, review }),
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
      setCommentResolved: (submissionId: string, commentId: string, resolved: boolean) =>
        dispatch({ type: 'set_comment_resolved', submissionId, commentId, resolved }),
      editComment: (submissionId: string, commentId: string, body: string) =>
        dispatch({ type: 'edit_comment', submissionId, commentId, body }),
      // Decisions return their event ID so the confirmation can offer Undo.
      requestChanges: (submissionId: string, note?: string) => {
        const eventId = newId('e')
        dispatch({ type: 'request_changes', submissionId, actor: REVIEWER_NAME, at: now(), eventId, note })
        return eventId
      },
      approve: (submissionId: string, note?: string) => {
        const eventId = newId('e')
        dispatch({ type: 'approve', submissionId, actor: REVIEWER_NAME, at: now(), eventId, note })
        return eventId
      },
      reject: (submissionId: string, note: string) => {
        const eventId = newId('e')
        dispatch({ type: 'reject', submissionId, actor: REVIEWER_NAME, at: now(), eventId, note })
        return eventId
      },
      undoDecision: (submissionId: string, eventId: string) =>
        dispatch({ type: 'undo_decision', submissionId, eventId }),
      resubmit: (submissionId: string, fields: AssetField[], actor: string) =>
        dispatch({ type: 'resubmit', submissionId, fields, actor, at: now(), eventId: newId('e') }),
      /** Returns the new submission's ID so the caller can navigate to it. */
      createSubmission: (
        submission: Omit<Extract<Action, { type: 'create_submission' }>['submission'], 'id'>,
        actor: string,
      ) => {
        const id = newId('s')
        dispatch({ type: 'create_submission', submission: { ...submission, id }, actor, at: now(), eventId: newId('e') })
        return id
      },
      resetDemo: () => dispatch({ type: 'reset', state: createSeed() }),
    }),
    [dispatch],
  )
}
