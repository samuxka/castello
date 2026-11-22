-- ============================================================================
-- CORREÇÃO DE LOGIN DE COLABORADORES E MIGRAÇÃO DE CONTAS LEGADAS
-- Ficheiro: supabase/migrations/20261122_fix_employee_auth_claim.sql
-- Data: 22/11/2026
--
-- Corrige 2 bloqueios críticos no login (Mobile e Web):
--   1. O trigger trg_guard_profile_sensitive_columns bloqueava o UPDATE feito
--      por claim_legacy_employee_by_email() ao vincular auth_user_id pela 1ª vez.
--   2. Quando "Confirm email" está ativo no Supabase Auth, o signUp() automático
--      de contas legadas criava o utilizador sem sessão (email_confirmed_at NULL).
-- ============================================================================

-- 1. Atualiza o trigger de proteção em profiles para permitir o vínculo inicial
--    exclusivamente quando invocado pela RPC segura claim_legacy_employee_by_email()
CREATE OR REPLACE FUNCTION private.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Permite vínculo inicial seguro feito pela RPC SECURITY DEFINER claim_legacy_employee_by_email()
  IF current_setting('app.castello_internal_claim', true) = '1'
     AND OLD.auth_user_id IS NULL
     AND NEW.auth_user_id = (SELECT auth.uid())
     AND NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.hourly_rate IS NOT DISTINCT FROM OLD.hourly_rate
     AND NEW.monthly_target_hours IS NOT DISTINCT FROM OLD.monthly_target_hours
     AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
  THEN
    RETURN NEW;
  END IF;

  IF NOT (SELECT private.is_company_admin()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
       OR NEW.monthly_target_hours IS DISTINCT FROM OLD.monthly_target_hours
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
    THEN
      RAISE EXCEPTION 'Permissão negada: apenas administradores podem alterar papel, taxa horária ou vínculo da empresa.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. RPC segura para confirmar o e-mail de colaborador migrado após validar e-mail + PIN
--    (resolve falha "Email not confirmed" quando o Supabase Auth exige confirmação)
CREATE OR REPLACE FUNCTION public.confirm_migrated_employee_email(p_email text, p_access_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_email text;
  v_clean_code text;
  v_valid boolean;
BEGIN
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_code := TRIM(COALESCE(p_access_code, ''));
  IF v_clean_email = '' OR v_clean_code = '' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE LOWER(TRIM(p.email)) = v_clean_email
      AND p.is_active = true
      AND p.auth_user_id IS NULL
      AND TRIM(COALESCE(p.access_code, '')) = v_clean_code
  ) INTO v_valid;

  IF NOT v_valid THEN
    RETURN false;
  END IF;

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE LOWER(TRIM(email)) = v_clean_email
    AND email_confirmed_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_migrated_employee_email(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_migrated_employee_email(text, text) TO anon, authenticated;

-- 3. RPC segura equivalente para firmas legadas no Web (resolve "Email not confirmed")
CREATE OR REPLACE FUNCTION public.confirm_migrated_company_email(p_email text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_email text;
  v_valid boolean;
BEGIN
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  IF v_clean_email = '' THEN
    RETURN false;
  END IF;

  SELECT public.verify_legacy_company_credentials(p_email, p_password) INTO v_valid;
  IF NOT COALESCE(v_valid, false) THEN
    RETURN false;
  END IF;

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE LOWER(TRIM(email)) = v_clean_email
    AND email_confirmed_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_migrated_company_email(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_migrated_company_email(text, text) TO anon, authenticated;

-- 4. Atualiza claim_legacy_employee_by_email() para usar a flag interna transacional
--    e devolver diretamente o perfil vinculado (sem expor access_code)
DROP FUNCTION IF EXISTS public.claim_legacy_employee_by_email();
CREATE OR REPLACE FUNCTION public.claim_legacy_employee_by_email()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_email text;
  v_profile public.profiles%ROWTYPE;
BEGIN
  v_uid := (SELECT auth.uid());
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT LOWER(TRIM(email)) INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Sinaliza ao trigger que este UPDATE é o vínculo oficial e seguro da conta
  PERFORM set_config('app.castello_internal_claim', '1', true);

  UPDATE public.profiles
  SET auth_user_id = v_uid,
      access_code = 'supabase_auth_managed'
  WHERE LOWER(TRIM(email)) = v_email
    AND is_active = true
    AND auth_user_id IS NULL;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE auth_user_id = v_uid
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_profile) - 'access_code';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_legacy_employee_by_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_legacy_employee_by_email() TO authenticated;

NOTIFY pgrst, 'reload schema';
