-- ============================================================================
-- MIGRAÇÃO: ADICIONAR COLUNAS DE LOGO E TEMA À TABELA DE EMPRESAS (COMPANIES)
-- Data: 17/11/2026
-- ============================================================================

-- Adiciona a coluna para a URL da imagem de logotipo da firma (Cloudinary ou HTTPS)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS logo_url text;

-- Adiciona a coluna para a cor temática da firma ('azul', 'vermelho', 'verde', 'amarelo', 'laranja')
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS theme_color text DEFAULT 'azul';

-- Adiciona a coluna para o modo visual ('dark' ou 'light')
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'dark';

-- Notifica o PostgREST para recarregar o cache do esquema imediatamente
NOTIFY pgrst, 'reload schema';
