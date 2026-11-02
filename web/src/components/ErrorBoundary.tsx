import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[300px] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-rose-400">Application Error</h2>
            <p className="mt-2 text-sm text-slate-300">
              {this.state.error?.message || 'An unexpected error occurred in this view.'}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
