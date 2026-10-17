import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  error: Error | null;
  hasError: boolean;
};

let lastConsoleErrorAt = 0;

function throttledConsoleError(message: string, error: unknown): void {
  const now = Date.now();
  if (now - lastConsoleErrorAt < 2000) return;
  lastConsoleErrorAt = now;
  console.error(message, error);
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    throttledConsoleError(`[ccr][ui-error-boundary] ${info.componentStack?.slice(0, 400) ?? ""}`, error);
  }

  private handleReset = (): void => {
    this.setState({ error: null, hasError: false });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    const message = this.state.error?.message ?? String(this.state.error ?? "Unknown error");
    return (
      <div className="network-error-box m-2 rounded-md border px-3 py-3 text-[12px]">
        <div className="font-semibold">{this.props.fallbackTitle ?? "This panel failed to render"}</div>
        <div className="mt-1 break-words font-mono text-[11px] leading-4">{message.slice(0, 1200)}</div>
        <button
          className="network-control-button mt-2 rounded-md border px-3 py-1.5 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          onClick={this.handleReset}
          type="button"
        >
          重试
        </button>
      </div>
    );
  }
}
