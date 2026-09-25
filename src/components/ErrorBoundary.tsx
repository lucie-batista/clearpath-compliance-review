import { Component, type ReactNode } from 'react'
import { clearSavedState } from '../state/persistence'

interface State {
  failed: boolean
}

/** Shows a recoverable message instead of a blank page if rendering ever throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main>
        <div className="empty-state card">
          <h2>Something went wrong</h2>
          <p>This page couldn’t be displayed. Reloading usually fixes it. If not, reset the demo data.</p>
          <div className="button-row button-row-center">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              className="btn"
              onClick={() => {
                clearSavedState()
                window.location.assign('/review')
              }}
            >
              Reset demo data
            </button>
          </div>
        </div>
      </main>
    )
  }
}
