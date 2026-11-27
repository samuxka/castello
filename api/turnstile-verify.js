const ALLOWED_ACTIONS = new Set(['login', 'signup', 'password_reset']);

const DEFAULT_PRODUCTION_HOSTNAMES = [
  'www.erpcastle.com',
  'erpcastle.com',
  'castello-ponto.vercel.app',
];

const DEFAULT_DEV_HOSTNAMES = ['localhost', '127.0.0.1'];

const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.erpcastle.com',
  'https://erpcastle.com',
  'https://castello-ponto.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8081',
];

function isProductionDeployment() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === 'production';
  }
  return process.env.NODE_ENV === 'production';
}

function getAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]);
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  if (allowed.has(origin)) return true;
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) {
    return true;
  }
  return false;
}

/**
 * Returns the deployment-specific frontend hostname allowlist for Turnstile siteverify.
 * Never includes localhost or 127.0.0.1 in a production deployment.
 */
function getExpectedHostnames() {
  const isProd = isProductionDeployment();
  const configured = (process.env.TURNSTILE_HOSTNAMES || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  const rawList =
    configured.length > 0
      ? configured
      : isProd
      ? DEFAULT_PRODUCTION_HOSTNAMES
      : [...DEFAULT_PRODUCTION_HOSTNAMES, ...DEFAULT_DEV_HOSTNAMES];

  const hostnames = new Set(
    rawList.filter((h) => {
      if (isProd && (h === 'localhost' || h === '127.0.0.1')) {
        return false;
      }
      return true;
    })
  );

  // Allow current Vercel preview deployment hostname in non-production environments
  if (!isProd && process.env.VERCEL_URL) {
    hostnames.add(process.env.VERCEL_URL.trim().toLowerCase());
  }

  return hostnames;
}

function extractClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || '';
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, X-Requested-With'
  );
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const secret = (process.env.TURNSTILE_SECRET || '').trim();
  if (!secret) {
    console.error('[Turnstile] TURNSTILE_SECRET environment variable is not configured.');
    return res.status(500).json({
      ok: false,
      error: 'Configuração de verificação Turnstile ausente no servidor (TURNSTILE_SECRET).',
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const token =
    typeof body['cf-turnstile-response'] === 'string'
      ? body['cf-turnstile-response'].trim()
      : typeof body.token === 'string'
      ? body.token.trim()
      : '';
  const expectedAction = typeof body.action === 'string' ? body.action.trim() : '';
  const expectedHostnames = getExpectedHostnames();

  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > 2048 ||
    !ALLOWED_ACTIONS.has(expectedAction) ||
    expectedHostnames.size === 0
  ) {
    return res.status(403).json({
      ok: false,
      error: 'Verificação de segurança inválida ou ausente.',
    });
  }

  const clientIp = extractClientIp(req);
  const formParams = new URLSearchParams({
    secret,
    response: token,
  });
  if (clientIp) {
    formParams.set('remoteip', clientIp);
  }

  let result;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: formParams,
    });
    if (!r.ok) {
      throw new Error(`siteverify ${r.status}`);
    }
    result = await r.json();
  } catch {
    return res.status(403).json({
      ok: false,
      error: 'Não foi possível validar a verificação de segurança. Tente novamente.',
    });
  }

  const verifiedHostname =
    typeof result?.hostname === 'string' ? result.hostname.trim().toLowerCase() : '';

  if (
    !result ||
    result.success !== true ||
    result.action !== expectedAction ||
    !expectedHostnames.has(verifiedHostname)
  ) {
    return res.status(403).json({
      ok: false,
      error: 'A verificação de segurança expirou ou falhou. Tente novamente.',
    });
  }

  return res.status(200).json({
    ok: true,
    action: result.action,
    hostname: verifiedHostname,
  });
};
