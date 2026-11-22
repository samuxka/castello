import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { DialogProvider } from './context/DialogContext';
import { initPerformanceTelemetry } from './lib/telemetry';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </React.StrictMode>
);

// Inicializa telemetria de Web Vitals e requisições >500ms fora do caminho crítico de renderização
if (typeof window !== 'undefined') {
  const schedule = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 0));
  schedule(() => initPerformanceTelemetry());
}

