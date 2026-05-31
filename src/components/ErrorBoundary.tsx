import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearSave } from '../engine/save';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

// Catches any render/runtime error so the app shows a recovery screen
// instead of a blank white page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; in production this could report to a service.
    console.error('Tavern crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-shell center" style={{ paddingTop: '14vh' }}>
        <div style={{ fontSize: '3rem' }}>🐉</div>
        <h1 className="title-xl" style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)' }}>A Wild Error Appears</h1>
        <p className="subtitle" style={{ maxWidth: 520, margin: '12px auto 26px' }}>
          Something went sideways and the tale could not continue. Starting fresh will
          clear the current save and return you to the Tavern.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => { clearSave(); window.location.reload(); }}
        >
          Return to the Tavern
        </button>
      </div>
    );
  }
}
