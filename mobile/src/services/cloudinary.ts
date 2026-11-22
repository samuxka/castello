import { supabase } from '../lib/supabase';

interface CloudinarySignResponse {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
  allowed_formats?: string;
}

const SIGN_API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://castello-ponto.vercel.app';

/**
 * Obtém parâmetros e assinatura criptográfica segura gerados no backend serverless,
 * enviando o JWT da sessão autenticada do colaborador no Supabase Auth.
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
    throw new Error('Sessão inválida. Inicie sessão novamente para enviar imagens.');
  }

  const res = await fetch(
    `${SIGN_API_BASE}/api/sign-cloudinary?folder=${encodeURIComponent(folder)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (res.status === 401) {
    throw new Error('Autenticação obrigatória para enviar imagens.');
  }
  if (!res.ok) {
    throw new Error('Falha ao gerar credencial segura para envio de imagem.');
  }

  const data = await res.json();
  if (data.signature && data.timestamp && data.api_key && data.cloud_name) {
    return data as CloudinarySignResponse;
  }

  throw new Error('Resposta inválida do servidor de upload.');
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
  if (params.allowed_formats) {
    formData.append('allowed_formats', params.allowed_formats);
  }
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
