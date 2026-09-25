import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { ScrollToTop } from './components/ScrollToTop'
import { useActions, useAppState } from './state/store'
import { PartnerSubmission } from './views/partner/PartnerSubmission'
import { PartnerSubmissions } from './views/partner/PartnerSubmissions'
import { ReviewQueue } from './views/reviewer/ReviewQueue'
import { ReviewWorkspace } from './views/reviewer/ReviewWorkspace'

function ViewingAs() {
  const { partners } = useAppState()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = pathname.startsWith('/partner/') ? pathname.split('/')[2] : 'reviewer'

  return (
    <label className="viewing-as">
      <span>Viewing as</span>
      <select
        value={current}
        onChange={(e) => navigate(e.target.value === 'reviewer' ? '/review' : `/partner/${e.target.value}`)}
      >
        <option value="reviewer">Compliance reviewer</option>
        {partners
          .filter((p) => p.kind === 'affiliate')
          .map((p) => (
            <option key={p.id} value={p.id}>
              Partner: {p.name}
            </option>
          ))}
      </select>
    </label>
  )
}

export default function App() {
  const actions = useActions()
  const navigate = useNavigate()

  return (
    <>
      <header className="app-header">
        <Link to="/review" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">ClearPath</span>
          <span className="brand-product">Compliance Review</span>
        </Link>
        <div className="header-controls">
          <ViewingAs />
          <button
            className="btn btn-ghost-inverse"
            onClick={() => {
              actions.resetDemo()
              navigate('/review')
            }}
          >
            Reset demo data
          </button>
        </div>
      </header>
      <ScrollToTop />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/review" replace />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/review/:submissionId" element={<ReviewWorkspace />} />
          <Route path="/partner/:partnerId" element={<PartnerSubmissions />} />
          <Route path="/partner/:partnerId/:submissionId" element={<PartnerSubmission />} />
          <Route path="*" element={<Navigate to="/review" replace />} />
        </Routes>
      </main>
    </>
  )
}
