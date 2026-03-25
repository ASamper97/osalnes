import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', maxWidth: 600 }}>
          <h2 style={{ color: '#c0392b', marginBottom: '0.5rem' }}>Error inesperado</h2>
          <p style={{ marginBottom: '1rem', color: '#636e72' }}>
            Se ha producido un error en esta seccion. El resto del CMS sigue operativo.
          </p>
          <pre style={{
            background: '#fdf0ed',
            border: '1px solid #f5c6cb',
            borderRadius: 6,
            padding: '0.75rem',
            fontSize: '0.8rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#1a5276',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
