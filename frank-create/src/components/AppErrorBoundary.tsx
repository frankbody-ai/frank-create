import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Last line of defence: a transient backend fault (e.g. the edge runtime
 * answering 503 SERVICE_DEGRADED while a container cycles) must never leave
 * the user staring at a blank page.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[studio] render failed", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const degraded = /503|SERVICE_DEGRADED|Failed to fetch|NetworkError/i.test(error.message ?? "");

    return (
      <div className="boot-error" role="alert">
        <h1>{degraded ? "The studio backend is warming up" : "Something went wrong"}</h1>
        <p>
          {degraded
            ? "The backend briefly returned a service-degraded response. Nothing was lost — reload to reconnect."
            : error.message || "An unexpected error stopped the studio from rendering."}
        </p>
        <div className="boot-error-actions">
          <button type="button" onClick={() => window.location.reload()}>
            Reload the studio
          </button>
          <a href="#/health">Run diagnostics</a>
        </div>
      </div>
    );
  }
}
