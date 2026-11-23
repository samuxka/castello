-- ============================================================================
-- CORREÇÃO DE CRIAÇÃO DE FIRMA (SIGN UP WEB) COM RLS E CONFIRMAÇÃO DE E-MAIL
-- Ficheiro: supabase/migrations/20261123_fix_company_signup_rls.sql
-- Data: 23/11/2026
--
-- Resolve o erro:
--   new row violates row-level security policy for table "companies"
-- que ocorria ao criar uma nova firma quando o Supabase Auth tinha
-- "Confirm email" ativo (signUp devolvia session = null, logo auth.uid() = NULL
-- no momento do INSERT em public.companies).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_company_signup(
  p_email text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_tax_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_email text;
  v_clean_name text;
  v_caller_uid uuid;
  v_target_uid uuid;
  v_existing public.companies%ROWTYPE;
  v_created public.companies%ROWTYPE;
BEGIN
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_name := TRIM(COALESCE(p_name, ''));

  IF v_clean_email = '' OR v_clean_name = '' THEN
    RETURN NULL;
  END IF;

  v_caller_uid := (SELECT auth.uid());

  -- Localiza o utilizador em auth.users pelo e-mail
  SELECT u.id INTO v_target_uid
  FROM auth.users u
  WHERE LOWER(TRIM(u.email)) = v_clean_email
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_target_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Se já existe sessão autenticada com outro UID diferente, bloqueia
  IF v_caller_uid IS NOT NULL AND v_caller_uid <> v_target_uid THEN
    RETURN NULL;
  END IF;

  -- Verifica se já existe uma firma associada a este e-mail ou auth.uid()
  SELECT * INTO v_existing
  FROM public.companies c
  WHERE c.owner_auth_id = v_target_uid
     OR LOWER(TRIM(c.owner_email)) = v_clean_email
  LIMIT 1;

  IF FOUND THEN
    IF v_caller_uid IS NOT NULL AND v_existing.owner_auth_id = v_caller_uid THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'name', v_existing.name,
        'tax_id', v_existing.tax_id,
        'owner_email', v_existing.owner_email,
        'phone', v_existing.phone,
        'logo_url', v_existing.logo_url,
        'theme_color', v_existing.theme_color,
        'theme_mode', v_existing.theme_mode,
        'created_at', v_existing.created_at
      );
    END IF;
    RETURN NULL;
  END IF;

  -- Confirma o e-mail em auth.users (apenas quando ainda não existe firma para este e-mail)
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = v_target_uid
    AND email_confirmed_at IS NULL;

  -- Só cria o registo em public.companies quando a sessão JWT estiver autenticada (v_caller_uid = v_target_uid)
  IF v_caller_uid IS NULL OR v_caller_uid <> v_target_uid THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.companies (
    name,
    owner_email,
    owner_auth_id,
    password_hash,
    phone,
    tax_id
  )
  VALUES (
    v_clean_name,
    v_clean_email,
    v_target_uid,
    'supabase_auth_managed',
    NULLIF(TRIM(COALESCE(p_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_tax_id, '')), '')
  )
  RETURNING * INTO v_created;

  RETURN jsonb_build_object(
    'id', v_created.id,
    'name', v_created.name,
    'tax_id', v_created.tax_id,
    'owner_email', v_created.owner_email,
    'phone', v_created.phone,
    'logo_url', v_created.logo_url,
    'theme_color', v_created.theme_color,
    'theme_mode', v_created.theme_mode,
    'created_at', v_created.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_company_signup(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_company_signup(text, text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
