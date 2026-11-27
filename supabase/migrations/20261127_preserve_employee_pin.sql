-- ============================================================================
-- PRESERVAR PIN NUMÉRICO DOS COLABORADORES E BLOQUEAR ALTERAÇÃO DE PIN
-- Ficheiro: supabase/migrations/20261127_preserve_employee_pin.sql
-- Data: 27/11/2026
--
-- 1. Impede que claim_legacy_employee_by_email() sobrescreva access_code com
--    'supabase_auth_managed' (mantém o PIN numérico visível para o patrão).
-- 2. Restaura automaticamente um PIN numérico de 6 dígitos para qualquer
--    colaborador que já esteja com access_code = 'supabase_auth_managed' e
--    sincroniza a respetiva senha criptografada em auth.users.
-- 3. Bloqueia alterações futuras ao campo access_code via trigger após criado.
-- ============================================================================

-- 1. Restaura PIN numérico de 6 dígitos para colaboradores que ficaram com 'supabase_auth_managed'
DO $$
DECLARE
  r record;
  v_new_pin text;
BEGIN
  FOR r IN
    SELECT id, email, auth_user_id
    FROM public.profiles
    WHERE access_code = 'supabase_auth_managed'
  LOOP
    v_new_pin := LPAD((FLOOR(100000 + RANDOM() * 900000))::int::text, 6, '0');

    UPDATE public.profiles
    SET access_code = v_new_pin
    WHERE id = r.id;

    -- Sincroniza a senha em auth.users para que o novo PIN funcione imediatamente no app mobile
    IF r.auth_user_id IS NOT NULL THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(v_new_pin, extensions.gen_salt('bf'))
      WHERE id = r.auth_user_id;
    ELSIF r.email IS NOT NULL THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(v_new_pin, extensions.gen_salt('bf'))
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(r.email));
    END IF;
  END LOOP;
END $$;

-- 2. Atualiza o trigger para manter o PIN (access_code) imutável após a criação
CREATE OR REPLACE FUNCTION private.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Impede que o PIN seja alterado depois de definido (exceto na reparação de 'supabase_auth_managed')
  IF OLD.access_code IS NOT NULL
     AND OLD.access_code <> ''
     AND OLD.access_code <> 'supabase_auth_managed'
     AND NEW.access_code IS DISTINCT FROM OLD.access_code
  THEN
    NEW.access_code := OLD.access_code;
  END IF;

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

-- 3. Atualiza claim_legacy_employee_by_email() para NÃO sobrescrever access_code
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

  PERFORM set_config('app.castello_internal_claim', '1', true);

  UPDATE public.profiles
  SET auth_user_id = v_uid
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
