import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { DueDate } from '../../components/DueDate'
import { StatusBadge } from '../../components/StatusBadge'
import { ASSET_TYPE_LABELS, PRODUCT_LABELS } from '../../domain/catalog'
import {
  QUEUE_SORTS,
  QUEUE_TABS,
  feedbackSent,
  filterSubmissions,
  lastEventAt,
  queueCounts,
  queueFor,
  unreviewedFindings,
  type QueueSort,
  type QueueTab,
} from '../../domain/queue'
import type { Partner, Product, Submission } from '../../domain/types'
import { currentFindings, latestVersion } from '../../domain/workflow'
import { timeAgo } from '../../lib/format'
import { useAppState } from '../../state/store'

interface Column {
  header: string
  cell: (s: Submission) => ReactNode
  className?: string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const EMPTY: Record<QueueTab, { title: string; body: string }> = {
  needs_review: { title: 'Queue clear', body: 'Nothing is awaiting review right now.' },
  waiting: { title: 'Nothing waiting on partners', body: 'Submissions with requested changes will appear here.' },
  approved: { title: 'No approvals yet', body: 'Approved submissions will appear here.' },
  all: { title: 'No submissions', body: 'Submissions from partners will appear here.' },
}

function isTab(value: string | null): value is QueueTab {
  return QUEUE_TABS.some((t) => t.id === value)
}

function isSort(value: string | null): value is QueueSort {
  return QUEUE_SORTS.some((s) => s.id === value)
}

const PRODUCTS = Object.keys(PRODUCT_LABELS) as Product[]

export function ReviewQueue() {
  const { submissions, partners } = useAppState()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: QueueTab = isTab(requested) ? requested : 'needs_review'
  const requestedSort = params.get('sort')
  const sort: QueueSort = isSort(requestedSort) ? requestedSort : 'urgent'
  const requestedProduct = params.get('product')
  // The search box owns its text so fast typing never drops characters; the URL mirrors it.
  const [search, setSearch] = useState(params.get('q') ?? '')
  const filters = {
    search,
    product: (PRODUCTS.includes(requestedProduct as Product) ? requestedProduct : '') as Product | '',
    partnerId: params.get('from') ?? '',
  }
  const filtering = Boolean(filters.search || filters.product || filters.partnerId)

  // Filters and sort live in the URL, so back/forward and refresh keep the reviewer's view.
  const setParam = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: key === 'q' },
    )

  const counts = queueCounts(submissions) // whole-team workload, unaffected by filters
  const matching = filterSubmissions(submissions, filters, partners)
  const tabCounts = queueCounts(matching)
  const rows = queueFor(matching, tab, sort)
  const partnerOf = (s: Submission) => partners.find((p) => p.id === s.partnerId)
  const columns = columnsFor(tab, partnerOf)

  return (
    <section className="page">
      <header className="page-header">
        <h1>Review queue</h1>
        <p className="page-summary">
          <strong>{counts.needs_review}</strong> awaiting review
          {counts.overdue > 0 && (
            <>
              {' · '}
              <strong className="due-overdue">{counts.overdue}</strong> overdue
            </>
          )}
          {counts.dueSoon > 0 && (
            <>
              {' · '}
              <strong className="due-soon">{counts.dueSoon}</strong> due within 2 days
            </>
          )}
          {' · '}
          <strong>{counts.waiting}</strong> waiting on partners
        </p>
      </header>

      <nav className="tabs" aria-label="Queue views">
        {QUEUE_TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${t.id === tab ? 'tab-active' : ''}`}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => setParam('tab', t.id === 'needs_review' ? '' : t.id)}
          >
            {t.label}
            <span className="tab-count">{tabCounts[t.id]}</span>
          </button>
        ))}
      </nav>

      <div className="queue-toolbar" role="search">
        <input
          type="search"
          className="queue-search"
          placeholder="Search titles, partners, or ad copy"
          aria-label="Search submissions"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setParam('q', e.target.value)
          }}
        />
        <select aria-label="Filter by product" value={filters.product} onChange={(e) => setParam('product', e.target.value)}>
          <option value="">All products</option>
          {PRODUCTS.map((p) => (
            <option key={p} value={p}>
              {PRODUCT_LABELS[p]}
            </option>
          ))}
        </select>
        <select aria-label="Filter by submitter" value={filters.partnerId} onChange={(e) => setParam('from', e.target.value)}>
          <option value="">All submitters</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="queue-sort">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'urgent' ? '' : e.target.value)}>
            {QUEUE_SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {filtering && (
          <button
            className="btn-link"
            onClick={() => {
              setSearch('')
              setParams((prev) => {
                const next = new URLSearchParams(prev)
                ;['q', 'product', 'from'].forEach((k) => next.delete(k))
                return next
              })
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state card">
          {filtering ? (
            <>
              <h2>No matching submissions</h2>
              <p>Nothing in “{QUEUE_TABS.find((t) => t.id === tab)?.label}” matches these filters.</p>
            </>
          ) : (
            <>
              <h2>{EMPTY[tab].title}</h2>
              <p>{EMPTY[tab].body}</p>
            </>
          )}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="queue-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className={c.className}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/review/${s.id}`)} className="clickable-row">
                  {columns.map((c) => (
                    <td key={c.header} className={c.className}>
                      {c.cell(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function columnsFor(tab: QueueTab, partnerOf: (s: Submission) => Partner | undefined): Column[] {
  const submission: Column = {
    header: 'Submission',
    cell: (s) => {
      const version = latestVersion(s).number
      return (
        <div className="cell-stack">
          <Link to={`/review/${s.id}`} className="row-title" onClick={(e) => e.stopPropagation()}>
            {s.title}
          </Link>
          {version > 1 && s.status === 'awaiting_review' && (
            <span className="pill pill-resubmitted">Resubmitted · v{version}</span>
          )}
        </div>
      )
    },
  }
  const partner: Column = {
    header: 'Submitted by',
    cell: (s) => {
      const p = partnerOf(s)
      return (
        <div className="cell-stack">
          <span>{p?.name ?? 'Unknown partner'}</span>
          <span className="subtle">{p?.kind === 'internal' ? 'Internal' : 'Affiliate'}</span>
        </div>
      )
    },
  }
  const asset: Column = {
    header: 'Product & asset',
    cell: (s) => (
      <div className="cell-stack">
        <span>{PRODUCT_LABELS[s.product]}</span>
        <span className="subtle">{ASSET_TYPE_LABELS[s.assetType]}</span>
      </div>
    ),
  }
  const neededBy: Column = { header: 'Needed by', cell: (s) => <DueDate iso={s.neededBy} /> }

  switch (tab) {
    case 'needs_review':
      return [
        submission,
        partner,
        asset,
        {
          header: 'Potential issues',
          cell: (s) => {
            const n = unreviewedFindings(s)
            if (n > 0) return <span className="issue-count">{plural(n, 'potential issue')}</span>
            return currentFindings(s).length > 0 ? (
              <span className="subtle">All issues reviewed</span>
            ) : (
              <span className="subtle">None detected</span>
            )
          },
        },
        { header: 'Received', cell: (s) => timeAgo(latestVersion(s).submittedAt) },
        neededBy,
      ]
    case 'waiting':
      return [
        submission,
        partner,
        asset,
        { header: 'Feedback sent', cell: (s) => plural(feedbackSent(s), 'item') },
        { header: 'Changes requested', cell: (s) => timeAgo(lastEventAt(s, 'changes_requested')) },
        neededBy,
      ]
    case 'approved':
      return [
        submission,
        partner,
        asset,
        { header: 'Review rounds', cell: (s) => plural(s.versions.length, 'round') },
        { header: 'Approved', cell: (s) => timeAgo(lastEventAt(s, 'approved')) },
      ]
    case 'all':
      return [
        submission,
        partner,
        asset,
        { header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
        { header: 'Last activity', cell: (s) => timeAgo(lastEventAt(s)) },
      ]
  }
}
