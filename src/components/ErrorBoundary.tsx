import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <h2 className="text-lg font-semibold text-foreground">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.error?.message || 'ไม่สามารถโหลดหน้านี้ได้'}
            </p>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
            >
              ลองใหม่
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
