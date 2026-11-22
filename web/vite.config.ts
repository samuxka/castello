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
