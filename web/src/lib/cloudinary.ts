import { supabase } from './supabase';
import { fetchWithTimeout } from './fetchWithTimeout';

interface CloudinarySignResponse {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
  allowed_formats?: string;
}

/**
 * Obtém parâmetros e assinatura criptográfica segura gerados no backend serverless,
 * enviando o JWT do usuário autenticado via Supabase Auth.
 */
async function getSecureUploadParams(folder: string): Promise<CloudinarySignResponse> {
  let accessToken: string | null = null;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data?.session?.access_token || null;
    } catch {
      accessToken = null;
    }
  }

  if (!accessToken) {
    throw new Error('Sessão expirada ou inválida. Faça login novamente para enviar ficheiros.');
  }

  const res = await fetchWithTimeout(
    `/api/sign-cloudinary?folder=${encodeURIComponent(folder)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    { timeoutMs: 8000, retries: 1 }
  );

  if (res.status === 401) {
    throw new Error('Autenticação obrigatória para enviar ficheiros. Inicie sessão novamente.');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || 'Falha ao gerar credencial segura para envio de imagem.');
  }

  const data = await res.json();
  if (data.signature && data.timestamp && data.api_key && data.cloud_name) {
    return data as CloudinarySignResponse;
  }

  throw new Error('Resposta inválida do servidor de assinatura de upload.');
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
  if (params.allowed_formats) {
    formData.append('allowed_formats', params.allowed_formats);
  }
  formData.append('signature', params.signature);

  const response = await fetchWithTimeout(
    `https://api.cloudinary.com/v1_1/${params.cloud_name}/image/upload`,
    {
      method: 'POST',
      body: formData,
    },
    { timeoutMs: 25000, retries: 0 }
  );

  const data = await response.json();
  if (data.secure_url) {
    return optimizeCloudinaryUrl(data.secure_url, 1200);
  }

  console.error('Falha no upload Cloudinary:', data);
  throw new Error(data.error?.message || 'Falha ao enviar imagem para o Cloudinary');
}
