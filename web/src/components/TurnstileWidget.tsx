import React, { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY, TurnstileAction } from '../lib/turnstile';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          action?: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'flexible' | 'compact';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  action: TurnstileAction;
  onTokenChange: (token: string) => void;
  resetSignal?: number;
  theme?: 'light' | 'dark' | 'auto';
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-api-script';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function ensureTurnstileScriptLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const checkInterval = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(checkInterval);
          resolve();
        }
      }, 80);
      existing.addEventListener('load', () => {
        window.clearInterval(checkInterval);
        resolve();
      });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  action,
  onTokenChange,
  resetSignal = 0,
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  useEffect(() => {
    let mounted = true;

    ensureTurnstileScriptLoaded().then(() => {
      if (!mounted || !containerRef.current || !window.turnstile) return;

      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }

      onTokenChangeRef.current('');
      containerRef.current.innerHTML = '';

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        theme,
        size: 'flexible',
        callback: (token: string) => {
          if (mounted) {
            onTokenChangeRef.current(token);
          }
        },
        'expired-callback': () => {
          if (mounted) {
            onTokenChangeRef.current('');
          }
        },
        'error-callback': () => {
          if (mounted) {
            onTokenChangeRef.current('');
          }
        },
      });
    });

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [action, theme]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      try {
        onTokenChangeRef.current('');
        window.turnstile.reset(widgetIdRef.current);
      } catch {}
    }
  }, [resetSignal]);

  return (
    <div
      style={{
        width: '100%',
        minHeight: '65px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '8px 0 12px',
      }}
    >
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
};
