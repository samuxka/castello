export const TURNSTILE_SITE_KEY = (
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAGWWJrNqgEFiZQQ9'
).trim();

export type TurnstileAction = 'login' | 'signup' | 'password_reset';

export async function verifyTurnstileToken(
  token: string,
  action: TurnstileAction
): Promise<void> {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    throw new Error('Conclua a verificação de segurança Cloudflare Turnstile antes de continuar.');
  }

  const response = await fetch('/api/turnstile-verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      'cf-turnstile-response': cleanToken,
      action,
    }),
  });

  let payload: { ok?: boolean; error?: string } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error || 'Falha na verificação de segurança Turnstile. Tente novamente.'
    );
  }
}
