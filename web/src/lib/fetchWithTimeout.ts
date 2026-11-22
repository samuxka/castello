/**
 * Utilitário resiliente de fetch com timeout explícito e retry com backoff
 * exponencial exclusivamente para operações idempotentes (GET / HEAD / OPTIONS).
 */
export interface FetchWithTimeoutOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

type SlowRequestObserver = (url: string, durationMs: number, status?: number) => void;
let slowRequestObserver: SlowRequestObserver | null = null;

export function registerSlowRequestObserver(observer: SlowRequestObserver | null): void {
  slowRequestObserver = observer;
}

function isIdempotentMethod(method?: string): boolean {
  const m = (method || 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxRetries = isIdempotentMethod(init.method) ? (options.retries ?? 1) : 0;
  const baseDelay = options.retryDelayMs ?? 350;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const externalSignal = init.signal;

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
      if (duration > 500 && slowRequestObserver) {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        slowRequestObserver(urlStr, Math.round(duration), response.status);
      }

      if (response.status >= 500 && attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }

      return response;
    } catch (err: any) {
      lastError = err;
      const isAbort = err?.name === 'AbortError';
      if (externalSignal?.aborted) {
        throw err;
      }
      if (attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }
      if (isAbort) {
        throw new Error(
          `Tempo limite esgotado (${Math.round(timeoutMs / 1000)}s) ao comunicar com o servidor. Verifique a ligação.`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha na requisição externa.');
}
