# ClearPath Compliance Review: MVP Specification

## The problem

ClearPath Financial markets personal loans, credit cards, and mortgage prequalification products through typical channels, including affiliate partners. Its compliance marketing team reviews that material using Excel and email, and that process is holding back growth.

The goal is to **increase the compliance team's review throughput**.

## Product thesis

Excel and email are symptoms, not the root problem. Each review cycle is expensive:

- Reviewers read every asset from scratch, hunting for the same recurring issues.
- Feedback sent by email is detached from the content, so submitters misread it and the next version still needs changes.
- On resubmission, reviewers re-read the entire asset to find what changed.
- Past decisions and partner history are hard to find.
- Tracking and status-chasing take time away from reviewing.

This product gives reviewers one focused workspace. It surfaces potential issues, ties feedback to the exact text, and makes revisions quick to verify. **Each review cycle takes less time, and fewer cycles are needed per approved asset.**

Throughput is approved assets per reviewer-hour. The product targets the two levers that multiply:

| Metric | Why it matters |
|---|---|
| Median reviewer time per round | Pre-screened issues and diff-only re-review reduce reading |
| Revision rounds per approved asset | Precise, anchored feedback reduces misunderstanding |
| Time in queue | A result, not a lever: it should fall as capacity rises |

These are the metrics ClearPath would track to validate the product. The prototype does not claim measured improvements.

## Facts, assumptions, and decisions

**From the assignment**
- ClearPath sells personal loans, credit cards, and mortgage prequalification online.
- It markets through typical channels, including affiliate partners.
- Compliance review currently runs on Excel and email and is bottlenecking growth.

**Assumptions**
- Affiliate partners (and internal marketers) submit marketing material for review, and can use a web tool to do so.
- Marketing assets can be usefully reviewed as structured text (headline, body, call to action, disclosure). Visual assets are out of scope.
- The compliance team is the final approver. There is no additional legal or brand sign-off stage.
- One reviewer handles a submission at a time.
- Many review issues recur and can be detected by pattern.
- Submitters provide a "needed by" date. The assignment does not state this; we assume it because it makes prioritization possible.
- ClearPath is accountable for marketing its affiliates publish. This is a common convention in consumer finance, and it is why affiliate material is reviewed at all.

**Product decisions**
- **The reviewer is the primary user.** The product is designed around their repeated daily workflow.
- **Affiliate partners are the main secondary actor.** The assignment names affiliates explicitly. The partner experience is limited to what closes the feedback loop: see status, read feedback, revise, resubmit.
- **Automated checks are deterministic, not LLM-based.** They are explainable, consistent, fast, and auditable. Submitted marketing copy is also untrusted input: an LLM reviewer could be manipulated by instructions hidden in that copy, while rules cannot. Every check is presented as a *potential issue*. The reviewer makes every decision.
- **Priority comes from the needed-by date**, not a manual "urgent" flag, so priority can't inflate.
- **Local persistence, no backend.** The data layer is isolated, so a real API could replace it without reworking the UI.

## Users

- **Primary: the compliance marketing reviewer.** Needs to know what to work on next, understand a submission quickly, spot likely issues, give precise feedback, verify revisions, and record a defensible decision.
- **Secondary: the submitter.** Mainly affiliate partners, plus internal marketing. Needs to understand exactly what to fix and resubmit.
- **Tertiary: the compliance lead.** Served by queue-level counts only. There is no analytics dashboard in the MVP.

## Core workflow

```
Submission → Queue → Review → Potential issues surfaced → Reviewer feedback
  → Changes requested → Partner revises → Resubmission
  → Review of what changed → Approval → Recorded history
```

## Experiences

### 1. Review queue
- Tabs: **Needs review** (default, resubmissions included), **Waiting on partner**, **Approved**, **All**.
- Summary counts, e.g. awaiting review, waiting on partner, due within 48 hours.
- Each row shows title, partner, product, asset type, version, time waiting, needed-by date, and number of potential issues.
- Sorted by needed-by date, then by time waiting.

### 2. Review workspace
- Submission context: partner, product, asset type, version, needed-by date, and status.
- Asset content with potential issues highlighted in the text.
- **Potential issues panel.** Each issue shows the check that fired, the matched text, and why it was flagged. The reviewer either:
  - **Confirms** it, turning it into feedback for the partner, or
  - **Dismisses** it, which stays internal.
- **Feedback.** Comments are tied to specific content and marked **Shared with partner** or **Internal note**.
- **Partner context.** Prior submissions, how many needed changes, and previously flagged issue types.
- **Decisions:**
  - **Request changes** requires at least one shared feedback item.
  - **Approve** warns if potential issues haven't been reviewed.
- **History.** A timeline of submissions, decisions, and resubmissions.
- After a decision, **Next in queue** moves straight to the next item.

### 3. Revision review
Revision review happens in the same workspace, for version 2 onward:
- A summary of what changed, e.g. "4 edits in 2 fields · 2 of 3 feedback items affected · 1 potential issue still detected".
- An inline diff against the previous version, with a toggle to show the clean text.
- Previous feedback marked **Text changed** or **Text unchanged**. The reviewer, not the system, decides whether it was resolved.
- Automated checks re-run and grouped as *no longer detected*, *still detected*, or *new*.

### 4. Partner view
- **My submissions:** a list with statuses, where "changes requested" means action needed.
- **Submission detail:** the asset with **shared feedback only**. Internal notes and dismissed checks are never shown. The partner revises the content and resubmits. A resubmission with no changes is blocked.

## Asset model

Every asset is an ordered list of labeled text fields plus a destination URL. The asset type describes the format; who submitted it (affiliate partner or internal team) is captured separately. Each asset type is a template of field labels:

| Asset type | Fields |
|---|---|
| Landing page | Headline, Body, Call to action, Disclosure |
| Email | Subject line, Body, Call to action, Disclosure |
| Search ad | Headline, Description |
| Social post | Post text, Call to action |
| Display ad | Headline, Body, Call to action |

Display ads are largely visual in practice. The MVP reviews their text only.

## Automated checks

These are an **illustrative ClearPath policy checklist**, not a complete or legally authoritative rules engine:

1. **Approval certainty:** e.g. "guaranteed approval", "everyone qualifies".
2. **No credit check claims.**
3. **Prequalification wording:** "pre-approved" or "approved" used for the mortgage prequalification product.
4. **Rate claim without APR:** a rate or payment amount appears, but APR is not mentioned anywhere in the asset. This rule is contextual, not a simple keyword match.
5. **Unsupported superlatives:** e.g. "lowest rate", "best", "#1".
6. **Absolute risk or cost claims:** e.g. "risk-free", "no fees".

Results use cautious language: *Potential issue*, *Review recommended*. When nothing is detected, the product says so and notes that reviewer judgment is still required. The product never labels an asset "compliant". Approval is always a reviewer decision.

## Data model

- **Partner:** name, and whether affiliate or internal.
- **Submission:** title, product, asset type, partner, submitter, needed-by date, status (`awaiting review`, `changes requested`, `approved`, `rejected`), and versions.
- **Version:** number, fields, and submission time. Potential issues are computed from the content, never stored.
- **Issue review:** the reviewer's confirm or dismiss decision on a detected issue.
- **Comment:** the content it is anchored to, text, visibility (shared or internal), author, time, and resolved state.
- **Event:** the history entry for each submission, decision, and resubmission.

## Real vs simulated

- **Real:** automated checks, all reviewer and partner actions, the diff, feedback tracking across versions, status transitions, history, and persistence (in the browser).
- **Seeded:** partners and submissions across products, asset types, and statuses, with dates relative to today.
- **Simulated:** identity. A "Viewing as" switch toggles between reviewer and partner. Notifications are not simulated: feedback appears in the partner view, and nothing claims an email was sent.

## Out of scope

- Affiliate onboarding, account management, and contracts
- Authentication, permissions, and role management
- Notifications and SLA configuration
- Analytics dashboards
- Assignment and routing logic
- Real integrations and production backend
- LLM infrastructure, computer vision, and document processing
- A complete regulatory rules engine
- Real-time collaboration and multi-stage approval

## Future directions

- **Approved-copy library.** Detect when a submission reuses previously approved language, removing whole reviews.
- **Partner pre-flight checks.** Show partners potential issues before they submit, preventing rounds entirely.
- **LLM-assisted review.** An advisory layer for implied or contextual claims that rules miss, with guardrails against prompt injection from submitted content.
- **Rule configuration.** Compliance maintains the policy checklist itself, tuned by per-rule dismissal rates.
- **Published-content monitoring.** Verify affiliates run the approved version.
- **Email ingestion** for partners who won't adopt a portal, and **image text extraction** for visual assets.
- **Throughput dashboard** built on the metrics above.
- **Multi-stage approval, assignment, and audit export.**
