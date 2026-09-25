import type { AiFinding, AiReview, Submission } from '../domain/types'
import { latestVersion } from '../domain/workflow'

export type AiReviewError = 'not_configured' | 'rate_limited' | 'busy' | 'declined' | 'invalid' | 'failed' | 'network'

export type AiReviewResult = { ok: true; review: AiReview } | { ok: false; error: AiReviewError; message?: string }

type ServerFinding = Omit<AiFinding, 'key'>

/** Asks the server for an AI second opinion on the latest version. The API key never reaches the browser. */
export async function requestAiReview(submission: Submission): Promise<AiReviewResult> {
  const version = latestVersion(submission)
  let res: Response
  try {
    res = await fetch('/api/ai-review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product: submission.product, assetType: submission.assetType, fields: version.fields }),
    })
  } catch {
    return { ok: false, error: 'network' }
  }

  const body = (await res.json().catch(() => null)) as
    | { findings?: ServerFinding[]; model?: string; error?: AiReviewError; message?: string }
    | null
  if (!res.ok || !body?.findings) {
    return { ok: false, error: body?.error ?? 'failed', message: body?.message }
  }

  // Same key scheme as rule findings (field + text + occurrence), so decisions attach reliably.
  const seen = new Map<string, number>()
  const findings: AiFinding[] = body.findings.map((f) => {
    const base = `ai|${f.field}|${f.quote.toLowerCase()}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return { ...f, key: `${base}|${n}` }
  })
  return {
    ok: true,
    review: { version: version.number, at: new Date().toISOString(), model: body.model ?? 'unknown', findings },
  }
}
