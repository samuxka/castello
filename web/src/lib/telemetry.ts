import { registerSlowRequestObserver } from './fetchWithTimeout';

export interface WebVitalsSnapshot {
  device: 'mobile' | 'desktop';
  route: string;
  ttfbMs: number | null;
  lcpMs: number | null;
  cls: number;
  inpMs: number | null;
  slowRequests: Array<{
    url: string;
    durationMs: number;
    status?: number;
    timestamp: string;
  }>;
}

const snapshot: WebVitalsSnapshot = {
  device: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'mobile' : 'desktop',
  route: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
  ttfbMs: null,
  lcpMs: null,
  cls: 0,
  inpMs: null,
  slowRequests: [],
};

function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.split('?')[0];
  }
}

let initialized = false;

/**
 * Inicializa observabilidade leve e nativa (Web Vitals: LCP, INP, CLS, TTFB +
 * rastreio de requisições > 500ms) sem bloquear a thread principal nem adicionar dependências pagas.
 */
export function initPerformanceTelemetry(): void {
  if (initialized || typeof window === 'undefined' || typeof performance === 'undefined') {
    return;
  }
  initialized = true;

  // Expõe snapshot para inspeção rápida no DevTools (window.__CASTELLO_PERF__)
  (window as any).__CASTELLO_PERF__ = snapshot;

  // 1. TTFB via Navigation Timing API
  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0 && navEntries[0].responseStart > 0) {
      snapshot.ttfbMs = Math.round(navEntries[0].responseStart);
    }
  } catch {}

  // 2. LCP, CLS e INP via PerformanceObserver nativo
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          snapshot.lcpMs = Math.round(last.startTime);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput && typeof entry.value === 'number') {
            snapshot.cls = Number((snapshot.cls + entry.value).toFixed(4));
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {}

    try {
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.interactionId && typeof entry.duration === 'number') {
            snapshot.inpMs =
              snapshot.inpMs === null
                ? Math.round(entry.duration)
                : Math.max(snapshot.inpMs, Math.round(entry.duration));
          }
        }
      });
      inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);
    } catch {}
  }

  // 3. Rastreio de requisições lentas (> 500ms) no fetchWithTimeout
  registerSlowRequestObserver((url, durationMs, status) => {
    const entry = {
      url: sanitizeUrl(url),
      durationMs,
      status,
      timestamp: new Date().toISOString(),
    };
    snapshot.slowRequests.push(entry);
    if (snapshot.slowRequests.length > 50) {
      snapshot.slowRequests.shift();
    }
    if (import.meta.env.DEV) {
      console.warn(`[Perf >500ms] ${entry.durationMs}ms ${entry.url} (status: ${entry.status ?? 'err'})`);
    }
  });
}

export function getWebVitalsSnapshot(): WebVitalsSnapshot {
  return {
    ...snapshot,
    route: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
    slowRequests: [...snapshot.slowRequests],
  };
}
