/**
 * Utilitários defensivos de validação de URLs e uploads (prevenção de XSS via javascript:/data: e DoS).
 */

/**
 * Permite apenas URLs com protocolo https: (ou caminhos relativos locais seguros '/...')
 * Bloqueia estritamente javascript:, vbscript:, data: e protocol-relative '//...'.
 */
export function toSafeExternalUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Permite caminho relativo interno (ex: /logo.webp), mas bloqueia '//evil.com'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    // Permite http apenas em localhost durante desenvolvimento
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function validateUploadFile(
  file: File,
  options: { maxSizeMb: number; allowedMimeTypes: readonly string[] }
): { valid: true } | { valid: false; error: string } {
  const maxBytes = options.maxSizeMb * 1024 * 1024;
  if (file.size <= 0) {
    return { valid: false, error: 'O ficheiro selecionado está vazio.' };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `O ficheiro excede o limite máximo permitido de ${options.maxSizeMb} MB.`,
    };
  }
  if (!file.type || !options.allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato de ficheiro não permitido. Utilize apenas JPG, PNG, WebP ou PDF.',
    };
  }
  return { valid: true };
}
