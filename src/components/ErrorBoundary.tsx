import React from 'react';
import './ErrorBoundary.css';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Qualcosa è andato storto</h2>
          <p className="error-boundary__message">{this.state.error?.message}</p>
          <button
            className="error-boundary__reload"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          >
            Ricarica
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
