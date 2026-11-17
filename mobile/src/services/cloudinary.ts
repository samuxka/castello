import { supabase } from '../lib/supabase';

interface CloudinarySignResponse {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
}

/**
 * Obtém parâmetros e assinatura criptográfica segura gerados no backend/banco de dados,
 * garantindo que nenhuma chave secreta (API Secret) seja exposta no aplicativo móvel.
 */
async function getSecureUploadParams(folder: string): Promise<CloudinarySignResponse> {
  // 1. Supabase RPC seguro (sem expor segredos no APK)
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('sign_cloudinary_upload', {
        folder,
      });
      if (!error && data?.signature && data?.timestamp) {
        return data as CloudinarySignResponse;
      }
      if (error) {
        console.warn('Supabase RPC sign_cloudinary_upload não disponível:', error.message);
      }
    } catch (err) {
      console.warn('Erro ao chamar sign_cloudinary_upload via RPC:', err);
    }
  }

  // 2. Fallback via API serverless da web
  try {
    const res = await fetch(`https://castello-ponto.vercel.app/api/sign-cloudinary?folder=${encodeURIComponent(folder)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.signature && data.timestamp && data.api_key && data.cloud_name) {
        return data as CloudinarySignResponse;
      }
    }
  } catch (err) {
    console.warn('Endpoint /api/sign-cloudinary remoto indisponível:', err);
  }

  throw new Error('Falha ao gerar credencial segura para envio de imagem.');
}

/**
 * Faz upload de imagem (Data URI base64, URL ou URI local de arquivo) diretamente para o Cloudinary
 * usando assinatura segura gerada pelo backend.
 * Retorna a secure_url do Cloudinary.
 */
export async function uploadImageToCloudinary(
  fileInput: string | { uri: string; name?: string; type?: string },
  folder: string = 'castello_profiles'
): Promise<string> {
  const params = await getSecureUploadParams(folder);

  const formData = new FormData();

  if (typeof fileInput === 'string') {
    if (
      fileInput.startsWith('data:') ||
      fileInput.startsWith('http://') ||
      fileInput.startsWith('https://')
    ) {
      formData.append('file', fileInput);
    } else {
      // URI local do dispositivo (ex: file:///... ou content://...)
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

  formData.append('api_key', params.api_key);
  formData.append('timestamp', String(params.timestamp));
  formData.append('folder', params.folder);
  formData.append('signature', params.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${params.cloud_name}/image/upload`,
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
