import { Button } from '@/components/ui/Button';
import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook Sentry/monitoring here.
    console.error('UI error boundary:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-slate-500">The error has been logged. Please reload — your data is safe.</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
