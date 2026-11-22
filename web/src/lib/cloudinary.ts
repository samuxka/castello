import { supabase } from './supabase';

interface CloudinarySignResponse {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
}

/**
 * Obtém parâmetros e assinatura criptográfica segura gerados no backend/banco de dados,
 * garantindo que nenhuma chave secreta (API Secret) seja exposta no navegador.
 */
async function getSecureUploadParams(folder: string): Promise<CloudinarySignResponse> {
  // 1. Tentar endpoint serverless Vercel / Vite dev server
  try {
    const res = await fetch(`/api/sign-cloudinary?folder=${encodeURIComponent(folder)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.signature && data.timestamp && data.api_key && data.cloud_name) {
        return data as CloudinarySignResponse;
      }
    }
  } catch (err) {
    console.warn('Endpoint /api/sign-cloudinary indisponível, tentando Supabase RPC...', err);
  }

  // 2. Fallback seguro: Função RPC no Supabase (segurança no banco de dados)
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
      console.warn('Erro ao chamar sign_cloudinary_upload no Supabase:', err);
    }
  }

  throw new Error('Falha ao gerar credencial segura para envio de imagem.');
}

/**
 * Aplica transformações automáticas do Cloudinary (f_auto,q_auto) para servir
 * WebP/AVIF comprimido e redimensionado sem alterar a URL original se não for Cloudinary.
 */
export function optimizeCloudinaryUrl(url: string, maxWidth?: number): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url;
  }
  if (url.includes('/image/upload/f_auto')) {
    return url;
  }
  const transforms = maxWidth ? `f_auto,q_auto,w_${maxWidth},c_limit` : 'f_auto,q_auto';
  return url.replace('/image/upload/', `/image/upload/${transforms}/`);
}

/**
 * Realiza upload seguro de imagem para o Cloudinary através de parâmetros assinados no servidor.
 */
export async function uploadImageToCloudinary(
  fileBase64OrUri: string,
  folder: string = 'castello_profiles'
): Promise<string> {
  const params = await getSecureUploadParams(folder);

  const formData = new FormData();
  formData.append('file', fileBase64OrUri);
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
    return optimizeCloudinaryUrl(data.secure_url, 1200);
  }

  console.error('Falha no upload Cloudinary:', data);
  throw new Error(data.error?.message || 'Falha ao enviar imagem para o Cloudinary');
}
