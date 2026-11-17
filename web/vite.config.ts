import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'crypto';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-sign-cloudinary-dev',
      configureServer(server) {
        server.middlewares.use('/api/sign-cloudinary', (req, res) => {
          const url = new URL(req.url || '', 'http://localhost');
          const folder = url.searchParams.get('folder') || 'castello_profiles';
          const timestamp = Math.floor(Date.now() / 1000);
          const secret = process.env.CLOUDINARY_API_SECRET || 'trBeUlTPCEXvI58JS7FAUD6eJj0';
          const apiKey = process.env.CLOUDINARY_API_KEY || '877397175965442';
          const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dtxa1leih';

          const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
          const signature = crypto.createHash('sha1').update(paramsToSign + secret).digest('hex');

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              signature,
              timestamp,
              api_key: apiKey,
              cloud_name: cloudName,
              folder,
            })
          );
        });
      },
    },
  ],
  server: {
    port: 5173,
  },
});
