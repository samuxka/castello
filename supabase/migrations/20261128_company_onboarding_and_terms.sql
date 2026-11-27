-- ============================================================================
-- MIGRAÇÃO: PERSISTÊNCIA DO QUESTIONÁRIO MULTI-STEP (ONBOARDING) E ACEITE
--           DOS TERMOS DE USO E POLÍTICA DE PRIVACIDADE NA TABELA COMPANIES
-- Ficheiro: supabase/migrations/20261128_company_onboarding_and_terms.sql
-- Data: 28/11/2026
-- ============================================================================

-- 1. Respostas do formulário multi-step de perfil da firma
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS years_active text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS active_sites_count text,
  ADD COLUMN IF NOT EXISTS primary_goal text;

-- 2. Registo auditável de conclusão do onboarding e aceite de Termos e Privacidade
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- 3. Marca firmas legadas criadas antes de 27/11/2026 como já ativas para não bloquear logins antigos
UPDATE public.companies
SET
  onboarding_completed = true,
  onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, now()),
  terms_accepted = true,
  terms_accepted_at = COALESCE(terms_accepted_at, created_at, now()),
  privacy_accepted = true,
  privacy_accepted_at = COALESCE(privacy_accepted_at, created_at, now())
WHERE created_at < '2026-11-27T00:00:00Z'::timestamptz
  AND onboarding_completed IS NOT TRUE;

-- 4. Recarrega o schema cache do PostgREST imediatamente
NOTIFY pgrst, 'reload schema';
