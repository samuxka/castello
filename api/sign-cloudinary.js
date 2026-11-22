const crypto = require('crypto');

const ALLOWED_FOLDERS = new Set([
  'castello_profiles',
  'castello_company',
  'castello_docs',
  'castello_sites',
  'castello_vehicles',
  'castello_vehicle_reports',
  'castello_receipts',
  'castello_tarefas',
  'castello_justifications',
]);

const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,pdf';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.erpcastle.com',
  'https://erpcastle.com',
  'https://castello-ponto.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:8081',
];

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
  // Permite preview deployments oficiais da Vercel do projeto se configurado
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) {
    return true;
  }
  return false;
}

async function verifySupabaseJwt(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.length < 20) return null;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_AUTH_CONFIG_MISSING');
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseKey,
    },
  });

  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? user : null;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Accept, X-Requested-With'
  );
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Valida credenciais obrigatórias no ambiente (fail-fast, sem fallback hardcoded)
    const secret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!secret || !apiKey || !cloudName) {
      console.error('Cloudinary environment variables are not configured.');
      return res.status(500).json({ error: 'Serviço de upload não configurado no servidor.' });
    }

    // 2. Exige autenticação JWT válida via Supabase Auth
    const authUser = await verifySupabaseJwt(req.headers.authorization);
    if (!authUser) {
      return res.status(401).json({ error: 'Autenticação obrigatória para assinar uploads.' });
    }

    // 3. Valida pasta contra allowlist estrita (impede injeção de parâmetros com &)
    const rawFolder =
      (req.body && typeof req.body.folder === 'string' && req.body.folder) ||
      (req.query && typeof req.query.folder === 'string' && req.query.folder) ||
      'castello_profiles';
    const cleanFolder = rawFolder.trim();

    if (!ALLOWED_FOLDERS.has(cleanFolder)) {
      return res.status(400).json({ error: 'Pasta de destino inválida ou não permitida.' });
    }

    // 4. Gera assinatura SHA-1 com parâmetros ordenados alfabeticamente + formatos permitidos
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `allowed_formats=${ALLOWED_FORMATS}&folder=${cleanFolder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + secret)
      .digest('hex');

    return res.status(200).json({
      signature,
      timestamp,
      api_key: apiKey,
      cloud_name: cloudName,
      folder: cleanFolder,
      allowed_formats: ALLOWED_FORMATS,
    });
  } catch (error) {
    console.error('Error signing Cloudinary request:', error.message || error);
    return res.status(500).json({ error: 'Failed to generate upload signature' });
  }
};
