import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Simple error boundary that catches render/effect exceptions in its subtree
 * and renders a fallback UI so a crash inside one feature (e.g. Jarvis) can't
 * blank out the whole app. Logs to console so we can still diagnose in DevTools.
 */
type Props = {
  children: ReactNode;
  /** Human-readable label used in the fallback and console log (e.g. "Jarvis"). */
  label?: string;
  /** Optional fallback renderer. Receives the error + a reset callback. */
  fallback?: (err: Error, reset: () => void) => ReactNode;
  /** If true, render nothing on crash instead of the default banner. */
  silent?: boolean;
  /**
   * Changing this discards a caught error. Pass the current route so a crash on
   * one page doesn't leave every later page stuck on the fallback — React keeps
   * a tripped boundary tripped forever otherwise, and for a boundary this high
   * in the tree that reads as a permanently blank app until a full reload.
   */
  resetKey?: string | number;
};

type State = { error: Error | null; resetKey?: string | number };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null;
    return { error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this loud in the console so we can still debug from DevTools.
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.silent) return null;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    return (
      <div className="fixed bottom-4 right-4 z-[60] max-w-xs rounded-lg border border-destructive/40 bg-card p-3 text-xs shadow-lg">
        <div className="mb-1 font-semibold text-destructive">
          {this.props.label || "Something"} hit an error
        </div>
        <div className="mb-2 text-muted-foreground">
          The rest of the app should still work. Refresh if this keeps happening.
        </div>
        <button
          onClick={this.reset}
          className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
        >
          Dismiss
        </button>
      </div>
    );
  }
}
