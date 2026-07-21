import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { reportError } from '../services/crashReporting';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level render-error safety net (Phase 1 critical fix).
 *
 * Before this existed, ANY uncaught render-time exception anywhere in the
 * component tree (bad AI response shape, a date-math edge case, a corrupt
 * localStorage/IndexedDB entry, etc.) blanked the entire app to a white
 * screen with no recovery path and no signal to us — only a user report.
 *
 * This is deliberately minimal: it doesn't try to recover app state (that
 * would risk re-throwing into the same broken state), it just gives the
 * person a way back in without a reinstall/clear-data, and a place to wire
 * in crash reporting (see the audit's Phase 2 item on adding Sentry/
 * equivalent — the console.error below is exactly where that call goes).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Phase 2: now actually sent to crash reporting (see
    // src/services/crashReporting.ts) — no-op until VITE_SENTRY_DSN is set.
    console.error('Unhandled render error caught by ErrorBoundary:', error, errorInfo);
    reportError(error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0D12] px-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="font-serif text-xl font-bold text-white">Something went wrong</h1>
            <p className="text-sm text-[#94949C] leading-relaxed">
              Himam ran into an unexpected error. Your saved progress hasn't been affected —
              reloading usually fixes this.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:opacity-95 text-white font-semibold py-2.5 px-5 rounded-lg text-sm transition-all shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Himam
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
