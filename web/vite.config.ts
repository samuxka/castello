import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'api-sign-cloudinary-dev',
        configureServer(server) {
          server.middlewares.use('/api/sign-cloudinary', (req, res) => {
            const secret = process.env.CLOUDINARY_API_SECRET || env.CLOUDINARY_API_SECRET;
            const apiKey = process.env.CLOUDINARY_API_KEY || env.CLOUDINARY_API_KEY;
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME;

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');

            if (!secret || !apiKey || !cloudName) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  error:
                    'Configure CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY e CLOUDINARY_CLOUD_NAME no .env local.',
                })
              );
              return;
            }

            const authHeader = req.headers.authorization || '';
            if (!authHeader.startsWith('Bearer ') || authHeader.length < 27) {
              res.statusCode = 401;
              res.end(JSON.stringify({ error: 'Autenticação obrigatória.' }));
              return;
            }

            const url = new URL(req.url || '', 'http://localhost');
            const folder = (url.searchParams.get('folder') || 'castello_profiles').trim();
            if (!ALLOWED_FOLDERS.has(folder)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Pasta de destino inválida.' }));
              return;
            }

            const timestamp = Math.floor(Date.now() / 1000);
            const paramsToSign = `allowed_formats=${ALLOWED_FORMATS}&folder=${folder}&timestamp=${timestamp}`;
            const signature = crypto
              .createHash('sha1')
              .update(paramsToSign + secret)
              .digest('hex');

            res.end(
              JSON.stringify({
                signature,
                timestamp,
                api_key: apiKey,
                cloud_name: cloudName,
                folder,
                allowed_formats: ALLOWED_FORMATS,
              })
            );
          });

          server.middlewares.use('/api/turnstile-verify', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');

            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
              return;
            }

            const secret = (process.env.TURNSTILE_SECRET || env.TURNSTILE_SECRET || '').trim();
            if (!secret) {
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  ok: false,
                  error: 'Configure TURNSTILE_SECRET no .env para validar o Cloudflare Turnstile.',
                })
              );
              return;
            }

            let rawBody = '';
            req.on('data', (chunk) => {
              rawBody += chunk;
            });
            req.on('end', async () => {
              try {
                const parsed = rawBody ? JSON.parse(rawBody) : {};
                const token =
                  typeof parsed['cf-turnstile-response'] === 'string'
                    ? parsed['cf-turnstile-response'].trim()
                    : typeof parsed.token === 'string'
                    ? parsed.token.trim()
                    : '';
                const expectedAction =
                  typeof parsed.action === 'string' ? parsed.action.trim() : '';
                const allowedActions = new Set(['login', 'signup', 'password_reset']);

                if (
                  !token ||
                  token.length > 2048 ||
                  !allowedActions.has(expectedAction)
                ) {
                  res.statusCode = 403;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: 'Verificação de segurança inválida ou ausente.',
                    })
                  );
                  return;
                }

                const configuredHostnames = (
                  process.env.TURNSTILE_HOSTNAMES ||
                  env.TURNSTILE_HOSTNAMES ||
                  'localhost,127.0.0.1,www.erpcastle.com,erpcastle.com,castello-ponto.vercel.app'
                )
                  .split(',')
                  .map((h: string) => h.trim().toLowerCase())
                  .filter(Boolean);
                const expectedHostnames = new Set(configuredHostnames);

                const r = await fetch(
                  'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    signal: AbortSignal.timeout(10_000),
                    body: new URLSearchParams({
                      secret,
                      response: token,
                    }),
                  }
                );
                if (!r.ok) {
                  throw new Error(`siteverify ${r.status}`);
                }
                const result: any = await r.json();
                const hostname =
                  typeof result?.hostname === 'string'
                    ? result.hostname.trim().toLowerCase()
                    : '';

                if (
                  !result?.success ||
                  result.action !== expectedAction ||
                  !expectedHostnames.has(hostname)
                ) {
                  res.statusCode = 403;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: 'A verificação de segurança expirou ou falhou. Tente novamente.',
                    })
                  );
                  return;
                }

                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    ok: true,
                    action: result.action,
                    hostname,
                  })
                );
              } catch {
                res.statusCode = 403;
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: 'Não foi possível validar a verificação de segurança.',
                  })
                );
              }
            });
          });
        },
      },
    ],
    server: {
      port: 5173,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-lucide': ['lucide-react'],
            'vendor-zod': ['zod'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
