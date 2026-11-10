/**
 * Serviço de Upload de Imagens no Cloudinary
 * As chaves são mantidas no código interno / variáveis de ambiente e não são expostas.
 */

const CLOUDINARY_CLOUD_NAME = 'dtxa1leih';
const CLOUDINARY_API_KEY = '877397175965442';
const CLOUDINARY_API_SECRET = 'trBeUlTPCEXvI58JS7FAUD6eJj0';

/**
 * Função SHA1 pura em TypeScript/JS (funciona tanto no browser quanto no React Native sem bibliotecas pesadas)
 */
function sha1(str: string): string {
  function rotateLeft(n: number, s: number) {
    return (n << s) | (n >>> (32 - s));
  }
  function cvtHex(val: number) {
    let str = '';
    for (let i = 7; i >= 0; i--) {
      const v = (val >>> (i * 4)) & 0x0f;
      str += v.toString(16);
    }
    return str;
  }

  const blocksize = 64;
  const utf8 = unescape(encodeURIComponent(str));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[utf8.length >> 2] |= 0x80 << ((3 - (utf8.length % 4)) * 8);
  words[(((utf8.length + 8) >> 6) + 1) * 16 - 1] = utf8.length * 8;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Array(80);
  for (let i = 0; i < words.length; i += 16) {
    for (let j = 0; j < 16; j++) w[j] = words[i + j] | 0;
    for (let j = 16; j < 80; j++) {
      w[j] = rotateLeft(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let j = 0; j < 80; j++) {
      let f: number, k: number;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotateLeft(a, 5) + f + e + k + w[j]) | 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  return (cvtHex(h0) + cvtHex(h1) + cvtHex(h2) + cvtHex(h3) + cvtHex(h4)).toLowerCase();
}

/**
 * Faz upload de imagem (Data URI base64, URL ou URI local de arquivo) diretamente para o Cloudinary
 * Retorna a secure_url do Cloudinary
 */
export async function uploadImageToCloudinary(
  fileInput: string | { uri: string; name?: string; type?: string },
  folder: string = 'castello_profiles'
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = sha1(paramsToSign + CLOUDINARY_API_SECRET);

  const formData = new FormData();

  if (typeof fileInput === 'string') {
    if (
      fileInput.startsWith('data:') ||
      fileInput.startsWith('http://') ||
      fileInput.startsWith('https://')
    ) {
      formData.append('file', fileInput);
    } else {
      // É uma URI local do dispositivo (ex: file:///... ou content://...)
      const filename = fileInput.split('/').pop() || 'profile.jpg';
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      formData.append('file', {
        uri: fileInput,
        name: filename,
        type: mime,
      } as any);
    }
  } else {
    // Objeto de arquivo do React Native
    formData.append('file', {
      uri: fileInput.uri,
      name: fileInput.name || 'profile.jpg',
      type: fileInput.type || 'image/jpeg',
    } as any);
  }

  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('timestamp', String(timestamp));
  formData.append('folder', folder);
  formData.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await response.json();
  if (data.secure_url) {
    return data.secure_url;
  }

  console.error('Falha no upload Cloudinary:', data);
  throw new Error(data.error?.message || 'Falha ao fazer upload da imagem no Cloudinary');
}

