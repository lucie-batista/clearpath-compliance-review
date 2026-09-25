import { Link } from 'react-router'

export function NotFound({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  return (
    <div className="empty">
      <h2>Submission not found</h2>
      <p>It may have been removed, or the link is incorrect.</p>
      <Link to={backTo}>{backLabel}</Link>
    </div>
  )
}
