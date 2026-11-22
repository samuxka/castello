import { useEffect, useRef, useState } from 'react';

/**
 * Atrasa a atualização de um valor (padrão 250ms) para evitar filtros e buscas
 * pesadas a cada tecla digitada (melhora INP e reduz re-renders).
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Executa buscas assíncronas com debounce (250–300ms), cancelando requisições
 * anteriores via AbortController e descartando respostas fora de ordem.
 */
export function useAbortableSearch<T>(
  query: string,
  fetcher: (q: string, signal: AbortSignal) => Promise<T>,
  delayMs = 250
) {
  const debouncedQuery = useDebounce(query, delayMs);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++seqRef.current;

    setLoading(true);
    fetcher(debouncedQuery, controller.signal)
      .then((result) => {
        if (requestId === seqRef.current && !controller.signal.aborted) {
          setData(result);
        }
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          console.warn('Erro na busca debounced:', err);
        }
      })
      .finally(() => {
        if (requestId === seqRef.current) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery, fetcher]);

  return { data, loading, debouncedQuery };
}
