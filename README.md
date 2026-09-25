# ClearPath Compliance Review

**Live demo:** https://clearpath-compliance-review.vercel.app

A review workspace for ClearPath Financial's compliance marketing team. It surfaces potential issues in marketing copy, turns them into precise feedback for the partner, and makes each resubmission quick to verify. **Each review round takes less time, and fewer rounds are needed to approve an asset.**

> The demo runs on seeded data in your browser. Use **Viewing as** in the header to switch between the compliance reviewer and an affiliate partner. **Reset demo data** restores the starting state.

---

## The problem

The assignment:

> - ClearPath Financial (fictional company) is a national consumer finance company that offers personal loans, credit cards, and mortgage prequalification products to consumers online.
> - The company markets these products through typical marketing channels, including affiliate partners.
> - The compliance marketing team’s review process which is currently done via Excel and email at the company is currently bottlenecking growth
> - You are tasked with building a product that increases throughput of the compliance marketing team.
> - Feel free to make reasonable assumptions, we will discuss them when you present the project.

The goal: **increase the compliance team's throughput.**

## Product thesis

Excel and email are symptoms, not the root problem. The real cost is in each review cycle:

- **Reviewers reread every asset from scratch**, hunting for the same recurring issues.
- **Feedback lives in email, detached from the copy.** Partners guess what to change, so the next version often needs another round.
- **On resubmission, reviewers reread the whole asset** to work out what changed, and dig through old emails to remember what they asked for.
- **Tracking and status-chasing** take time away from reviewing.

Throughput is approved assets per reviewer-hour. This product targets the two levers that multiply: **time per review round** and **rounds per approved asset**.

## Who it's for

- **Primary: the compliance reviewer.** Everything is designed around their repeated, daily workflow: what to review next, understanding an asset quickly, deciding, and verifying revisions. A compliance lead uses the same screens; the queue's workload summary (overdue, due soon, waiting on partners) gives them a quick read on the team's backlog.
- **Secondary: submitters.** These are mainly **affiliate partners** and ClearPath's own marketing team. The partner side is deliberately small: see what needs fixing, fix it, resubmit.

## Core workflow

```
Partner submits → Queue → Review (potential issues surfaced) → Feedback
  → Changes requested → Partner revises → Resubmission
  → Review only what changed → Approve (or reject) → Recorded history
```

## What's in the product

### Review queue
- Tabs for **Needs review**, **Waiting on partner**, **Approved**, and **All**, each with the columns that matter for that view.
- A workload summary, e.g. "8 awaiting review · 1 overdue · 3 due within 2 days".
- **Priority is derived from the needed-by date** ("Overdue by 1 day", "Due tomorrow"), not from a manual "urgent" flag that everyone would set.
- Search across titles, partners, and ad copy. Filter by product or submitter, and sort by urgency, age, or number of potential issues.

### Review workspace
- **Potential issues are highlighted inline** in the ad copy. Each one explains why it was flagged.
- **One click to confirm** an issue, which adds ready-to-send guidance to a feedback draft. Or **dismiss** it. Both can be undone.
- A **feedback draft** that collects everything before anything is sent. Each item is marked **For partner** or **Internal**; internal notes never leave the compliance team.
- **Partner history**: prior submissions, how many needed changes, and issue types confirmed before.
- **Decisions with safeguards.** Request changes needs at least one item for the partner. Approving with unreviewed issues asks for confirmation. Rejecting needs a reason. All decisions can be undone until something happens next.
- **Next in queue** after every decision.
- An **activity timeline** recording who did what, and when.

### Revision review (the "don't reread everything" part)
- A one-line summary of what changed, e.g. "4 edits in 3 fields · 2 issues no longer detected · 1 new potential issue".
- **Changes since the last version**: added text highlighted, removed text struck through.
- Potential issues grouped as **New in v2**, **Still there from v1**, and **Fixed since v1**.
- **Your feedback on v1**, checked against the new text: each item is marked "Text changed" or "Text unchanged", and the reviewer ticks off what was addressed.
- **Decisions carry forward.** If the reviewer dismissed a flag on v1 and that exact text is unchanged, it isn't asked again. Confirmed issues are never carried over silently; if the text is still there, it comes back for review.

### Partner view
- A list of their submissions, with anything needing action first.
- **Each change request sits directly above the field it applies to**, with the exact words quoted. Partners tick requests off as they go, and can compare against the original.
- Clear status for every state: in review, changes requested, approved ("publish this exact version"), or not approved (with the reason).
- A **submission form** with structured fields per asset type, so submissions arrive complete.

## Facts, assumptions, and decisions

**From the assignment**
- ClearPath sells personal loans, credit cards, and mortgage prequalification online.
- It markets through typical channels, including affiliate partners.
- Compliance review runs on Excel and email and is bottlenecking growth.

**Assumptions**
- Affiliates and internal marketers submit material for review and can use a web tool to do so.
- Marketing assets can be usefully reviewed as structured text: headline, body, call to action, disclosure. Visual review is out of scope.
- Compliance is the final approver; there's no separate legal or brand sign-off stage.
- One reviewer handles a submission at a time.
- Many review issues are recurring phrasings, like “guaranteed approval” or a rate quoted without an APR, that simple text checks can flag for the reviewer. The reviewer still reads the asset; the checks point them to likely problems first.
- Submitters provide a needed-by date.
- ClearPath is accountable for marketing its affiliates publish. This is a common convention in consumer finance, and it's why affiliate material is reviewed at all.

**Product decisions**
- **Rule-based checks, not an LLM.** The six checks are deterministic, explainable, consistent, and auditable, and every flag says exactly why it fired. Submitted copy is also *untrusted input*: an LLM reviewer can be manipulated by instructions hidden in an ad, and rules can't. The checks are an **illustrative ClearPath policy checklist**, not a complete or legally authoritative rule set. The product never calls anything "compliant"; approval is always a reviewer's decision.
- **Reviewers stay in control.** Every automated result is a *potential* issue. Earlier feedback is labelled "Text changed" or "Text unchanged", never "resolved", because only a person can judge whether a change actually addresses the request.
- **Feedback is batched.** Confirmed issues collect in a draft and are sent together, so the partner gets one complete list rather than a stream of messages.
- **Affiliates are a first-class, but minimal, part of the product.** The partner side exists to close the feedback loop and cut rounds. It isn't a separate partner portal.
- **Asset type describes the format** (landing page, email, search ad, social post, display ad). Who submitted it is captured separately.
- **No backend.** State lives in the browser, and the data layer is isolated behind a single reducer, so a real API could replace it without touching the UI.

## What we deliberately didn't build

- Authentication, roles, and permissions (the "Viewing as" switch stands in for identity)
- Notifications, SLA configuration, and assignment or routing
- Analytics dashboards
- Affiliate onboarding, contracts, and account management
- Image, video, or document review
- A complete regulatory rules engine
- Multi-stage approval and real-time collaboration

## How we'd measure success

These are metrics ClearPath would track to validate the product. The prototype makes no claims of measured improvement.

| Metric | What it tells you |
|---|---|
| **Median reviewer time per round** | Whether inline issues and diff-only re-review reduce reading |
| **Revision rounds per approved asset** | Whether precise, anchored feedback reduces back-and-forth |
| **Time in queue** | A result, not a lever: it should fall as reviewer capacity rises |
| **Dismissal rate per check** | Which rules create noise and need tuning |

## Next steps

1. **Approved-copy library.** Detect when a submission reuses language that's already approved, removing whole reviews. Likely the biggest throughput win, especially for affiliates reusing ClearPath messaging.
2. **Partner pre-flight checks.** Show partners potential issues before they submit, preventing rounds entirely, with care not to teach them to work around the rules.
3. **LLM-assisted review** as an advisory second layer for implied or contextual claims the rules miss, with guardrails against prompt injection from submitted content.
4. **Rule configuration by the compliance team,** tuned using per-rule dismissal rates.
5. **Published-content monitoring** to confirm affiliates run the approved version.
6. **Email ingestion** for partners who won't adopt a portal, and **image text extraction** for visual assets.
7. **Team features:** assignment, a lead dashboard built on the metrics above, and audit export.

---

## Running locally

Requires Node 22.22 or later (see `.nvmrc`).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (Vitest)
npm run build    # type-check and production build
npm run lint
```

## Project structure

```
src/
  domain/         Pure TypeScript: types, the six checks, the workflow reducer,
                  queue logic, revision diffing. All state changes go through here.
  data/seed.ts    Seeded partners and submissions, with dates relative to today
  state/          React context over the reducer, persisted to localStorage
  views/          Reviewer (queue, workspace) and partner screens
  components/     Shared UI: asset rendering, highlights, diff, status badges
docs/mvp-spec.md  The original MVP specification
```

Built with React, TypeScript, and Vite. It uses React Router for routing and `diff` for word-level comparisons, and is deployed on Vercel. The domain logic is covered by unit tests: the checks, workflow rules, revision comparison, queue filtering, and seed data integrity.
