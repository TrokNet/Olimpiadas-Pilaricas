import { Component } from 'react';
import type { ReactNode } from 'react';

export default class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert" className="page-content" style={{ minHeight: '60vh', display: 'grid', alignContent: 'center', justifyItems: 'start', gap: 16 }}>
      <h1 style={{ fontSize: 30 }}>No se pudo cargar esta vista</h1>
      <p>Actualiza la página para cargar la versión más reciente.</p>
      <button className="button coral" onClick={() => window.location.reload()}>Actualizar página</button>
      <a href="/#inicio">Volver al inicio</a>
    </main>;
  }
}
