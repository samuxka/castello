const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // Configuração de CORS para permitir requisições da Web e Mobile
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const folder =
      (req.body && req.body.folder) ||
      (req.query && req.query.folder) ||
      'castello_profiles';
    const timestamp = Math.floor(Date.now() / 1000);

    const secret = process.env.CLOUDINARY_API_SECRET || 'trBeUlTPCEXvI58JS7FAUD6eJj0';
    const apiKey = process.env.CLOUDINARY_API_KEY || '877397175965442';
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dtxa1leih';

    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + secret)
      .digest('hex');

    return res.status(200).json({
      signature,
      timestamp,
      api_key: apiKey,
      cloud_name: cloudName,
      folder,
    });
  } catch (error) {
    console.error('Error signing Cloudinary request:', error);
    return res.status(500).json({ error: 'Failed to generate upload signature' });
  }
};
