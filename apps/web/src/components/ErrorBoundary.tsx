import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Contains render-time crashes (e.g. a chart choking on data) to the component that threw. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  override render(): ReactNode {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children;
  }
}
