-- ============================================================================
-- MIGRAÇÃO DE SEGURANÇA CRÍTICA: AUTH REAL, RLS MULTI-TENANT E PORTAL ESCOPADO
-- Ficheiro: supabase/migrations/20261122_security_auth_rls_hardening.sql
-- Data: 22/11/2026
--
-- Resolve os achados da Auditoria de Segurança (C1-01, C1-02, C1-03, C2-01,
-- C2-02, C2-03, C3-01, C3-02, C4-01, C4-02):
--   1. Remove a RPC antiga sign_cloudinary_upload (continha segredo hardcoded e acesso anon)
--   2. Vincula companies a auth.users (owner_auth_id) + índices para RLS rápido
--   3. Cria funções auxiliares no schema privado (não exposto ao PostgREST)
--   4. Revoga acesso direto da role anon em todas as tabelas operacionais
--   5. Aplica RLS estrito por company_id + papel (admin/patrao vs funcionario)
--   6. Protege colunas sensíveis de profiles via trigger contra escalada de privilégio
--   7. Expõe RPC dedicada get_public_site_portal(p_share_code) para o Portal do Cliente
-- ============================================================================

-- 1. EXTENSÃO CRIPTOGRÁFICA E REMOÇÃO DA RPC INSEGURA DO CLOUDINARY
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
DROP FUNCTION IF EXISTS public.sign_cloudinary_upload(text);

-- 2. COLUNA DE VÍNCULO AUTH + ÍNDICES DE PERFORMANCE PARA RLS
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ALTER COLUMN access_code DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_companies_owner_auth_id
  ON public.companies (owner_auth_id);

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id
  ON public.profiles (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_company_active
  ON public.profiles (company_id, is_active);

-- 3. SCHEMA PRIVADO PARA FUNÇÕES AUXILIARES DE RLS (NÃO EXPOSTO NO POSTGREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Retorna o company_id do utilizador autenticado (dono da empresa ou colaborador ativo)
CREATE OR REPLACE FUNCTION private.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT c.id FROM public.companies c WHERE c.owner_auth_id = (SELECT auth.uid()) LIMIT 1),
    (SELECT p.company_id FROM public.profiles p WHERE p.auth_user_id = (SELECT auth.uid()) AND p.is_active = true LIMIT 1)
  );
$$;

-- Verifica se o utilizador autenticado é dono da empresa ou colaborador com papel 'patrao'
CREATE OR REPLACE FUNCTION private.is_company_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.owner_auth_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.auth_user_id = (SELECT auth.uid())
      AND p.role = 'patrao'
      AND p.is_active = true
  );
$$;

-- Retorna o ID do perfil de colaborador associado ao auth.uid()
CREATE OR REPLACE FUNCTION private.current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.auth_user_id = (SELECT auth.uid())
    AND p.is_active = true
  LIMIT 1;
$$;

-- Auxiliar para tabelas ligadas via site_id (compatível com site_id uuid ou text)
CREATE OR REPLACE FUNCTION private.is_site_in_company(p_site_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.construction_sites s
    WHERE s.id::text = p_site_id
      AND s.company_id = (SELECT private.current_company_id())
  );
$$;

CREATE OR REPLACE FUNCTION private.is_site_in_company(p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_site_in_company(p_site_id::text);
$$;

-- Auxiliar para tabelas ligadas via vehicle_id (ex: vehicle_inventory_items)
CREATE OR REPLACE FUNCTION private.is_vehicle_in_company(p_vehicle_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id::text = p_vehicle_id
      AND v.company_id = (SELECT private.current_company_id())
  );
$$;

REVOKE ALL ON FUNCTION private.current_company_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_company_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_employee_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_site_in_company(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_site_in_company(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_vehicle_in_company(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_company_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_site_in_company(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_site_in_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_vehicle_in_company(text) TO authenticated;

-- 4. TRIGGER CONTRA ESCALADA DE PRIVILÉGIO EM PROFILES (C2-02)
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

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_profile_sensitive_columns();

-- 5. REVOGAR ACESSO DIRETO DA ROLE ANON EM TODAS AS TABELAS OPERACIONAIS
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Limpa TODAS as políticas legadas permissivas em todas as tabelas do schema public
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 6. POLÍTICAS RLS ESTRITAS (TO authenticated + ISOLAMENTO POR company_id)

-- A. companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_select_own" ON public.companies
  FOR SELECT TO authenticated
  USING (id = (SELECT private.current_company_id()));

CREATE POLICY "companies_insert_own" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_auth_id = (SELECT auth.uid())
    AND name IS NOT NULL
    AND owner_email IS NOT NULL
  );

CREATE POLICY "companies_update_own" ON public.companies
  FOR UPDATE TO authenticated
  USING (owner_auth_id = (SELECT auth.uid()))
  WITH CHECK (owner_auth_id = (SELECT auth.uid()));

CREATE POLICY "companies_delete_blocked" ON public.companies
  FOR DELETE TO authenticated
  USING (false);

-- B. profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_tenant" ON public.profiles
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));

CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
    AND full_name IS NOT NULL
  );

CREATE POLICY "profiles_update_admin_or_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (
      (SELECT private.is_company_admin())
      OR auth_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id = (SELECT private.current_company_id())
  );

CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
  );

-- C. construction_sites
ALTER TABLE public.construction_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sites_select_tenant" ON public.construction_sites
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));

CREATE POLICY "sites_write_admin" ON public.construction_sites
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
  );

CREATE POLICY "sites_update_admin" ON public.construction_sites
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
  )
  WITH CHECK (company_id = (SELECT private.current_company_id()));

CREATE POLICY "sites_delete_admin" ON public.construction_sites
  FOR DELETE TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
  );

-- D. site_tasks
ALTER TABLE public.site_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_tasks_select_tenant" ON public.site_tasks
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    OR (SELECT private.is_site_in_company(site_id::text))
  );

CREATE POLICY "site_tasks_insert_admin" ON public.site_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = (SELECT private.current_company_id()) OR (SELECT private.is_site_in_company(site_id::text)))
    AND (SELECT private.is_company_admin())
  );

CREATE POLICY "site_tasks_update_tenant" ON public.site_tasks
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    OR (SELECT private.is_site_in_company(site_id::text))
  )
  WITH CHECK (
    (company_id = (SELECT private.current_company_id()) OR (SELECT private.is_site_in_company(site_id::text)))
    AND (
      (SELECT private.is_company_admin())
      OR status <> 'confirmada_chefe'
    )
  );

CREATE POLICY "site_tasks_delete_admin" ON public.site_tasks
  FOR DELETE TO authenticated
  USING (
    (company_id = (SELECT private.current_company_id()) OR (SELECT private.is_site_in_company(site_id::text)))
    AND (SELECT private.is_company_admin())
  );

-- E. site_daily_logs
ALTER TABLE public.site_daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_daily_logs_select_tenant" ON public.site_daily_logs
  FOR SELECT TO authenticated
  USING ((SELECT private.is_site_in_company(site_id::text)));

CREATE POLICY "site_daily_logs_insert_tenant" ON public.site_daily_logs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_site_in_company(site_id::text)));

CREATE POLICY "site_daily_logs_update_admin" ON public.site_daily_logs
  FOR UPDATE TO authenticated
  USING ((SELECT private.is_site_in_company(site_id::text)) AND (SELECT private.is_company_admin()))
  WITH CHECK ((SELECT private.is_site_in_company(site_id::text)));

CREATE POLICY "site_daily_logs_delete_admin" ON public.site_daily_logs
  FOR DELETE TO authenticated
  USING ((SELECT private.is_site_in_company(site_id::text)) AND (SELECT private.is_company_admin()));

-- F. time_entries (colaborador só insere ponto pendente próprio; só admin aprova/altera/apaga)
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time_entries_select_tenant" ON public.time_entries
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (
      (SELECT private.is_company_admin())
      OR employee_id = (SELECT private.current_employee_id())
    )
  );

CREATE POLICY "time_entries_insert_scoped" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT private.current_company_id())
    AND (
      (SELECT private.is_company_admin())
      OR (employee_id = (SELECT private.current_employee_id()) AND status = 'pendente')
    )
  );

CREATE POLICY "time_entries_update_admin" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
  )
  WITH CHECK (company_id = (SELECT private.current_company_id()));

CREATE POLICY "time_entries_delete_admin" ON public.time_entries
  FOR DELETE TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
  );

-- G. financial_transactions & site_measurements (ESTRITAMENTE ADMIN DA EMPRESA)
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial_admin_only" ON public.financial_transactions
  FOR ALL TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
  )
  WITH CHECK (
    company_id = (SELECT private.current_company_id())
    AND (SELECT private.is_company_admin())
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_measurements') THEN
    ALTER TABLE public.site_measurements ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "site_measurements_admin_only" ON public.site_measurements
      FOR ALL TO authenticated
      USING (
        company_id = (SELECT private.current_company_id())
        AND (SELECT private.is_company_admin())
      )
      WITH CHECK (
        company_id = (SELECT private.current_company_id())
        AND (SELECT private.is_company_admin())
      );
  END IF;
END $$;

-- H. site_work_sessions
ALTER TABLE public.site_work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_sessions_select_tenant" ON public.site_work_sessions
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));

CREATE POLICY "work_sessions_insert_leader_or_admin" ON public.site_work_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT private.current_company_id())
    AND (
      (SELECT private.is_company_admin())
      OR leader_id::text = (SELECT private.current_employee_id())::text
    )
  );

CREATE POLICY "work_sessions_update_admin" ON public.site_work_sessions
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()))
  WITH CHECK (company_id = (SELECT private.current_company_id()));

CREATE POLICY "work_sessions_delete_admin" ON public.site_work_sessions
  FOR DELETE TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

-- I. site_documents
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_documents_select_tenant" ON public.site_documents
  FOR SELECT TO authenticated
  USING ((SELECT private.is_site_in_company(site_id::text)));

CREATE POLICY "site_documents_write_admin" ON public.site_documents
  FOR ALL TO authenticated
  USING ((SELECT private.is_site_in_company(site_id::text)) AND (SELECT private.is_company_admin()))
  WITH CHECK ((SELECT private.is_site_in_company(site_id::text)) AND (SELECT private.is_company_admin()));

-- J. site_accidents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_accidents') THEN
    ALTER TABLE public.site_accidents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "site_accidents_select_tenant" ON public.site_accidents
      FOR SELECT TO authenticated
      USING (company_id = (SELECT private.current_company_id())::text);
    CREATE POLICY "site_accidents_insert_tenant" ON public.site_accidents
      FOR INSERT TO authenticated
      WITH CHECK (company_id = (SELECT private.current_company_id())::text);
    CREATE POLICY "site_accidents_update_admin" ON public.site_accidents
      FOR UPDATE TO authenticated
      USING (company_id = (SELECT private.current_company_id())::text AND (SELECT private.is_company_admin()))
      WITH CHECK (company_id = (SELECT private.current_company_id())::text);
    CREATE POLICY "site_accidents_delete_admin" ON public.site_accidents
      FOR DELETE TO authenticated
      USING (company_id = (SELECT private.current_company_id())::text AND (SELECT private.is_company_admin()));
  END IF;
END $$;

-- K. teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select_tenant" ON public.teams
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));

CREATE POLICY "teams_insert_admin" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

CREATE POLICY "teams_update_admin_or_leader" ON public.teams
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (
      (SELECT private.is_company_admin())
      OR leader_id::text = (SELECT private.current_employee_id())::text
    )
  )
  WITH CHECK (company_id = (SELECT private.current_company_id()));

CREATE POLICY "teams_delete_admin" ON public.teams
  FOR DELETE TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

-- L. vehicles, vehicle_reports, vehicle_weekly_assignments, vehicle_inventory_items, vehicle_maintenance_records
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_select_tenant" ON public.vehicles
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));
CREATE POLICY "vehicles_insert_admin" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));
CREATE POLICY "vehicles_update_tenant" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT private.current_company_id()))
  WITH CHECK (company_id = (SELECT private.current_company_id()));
CREATE POLICY "vehicles_delete_admin" ON public.vehicles
  FOR DELETE TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_reports_select_tenant" ON public.vehicle_reports
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));
CREATE POLICY "vehicle_reports_insert_tenant" ON public.vehicle_reports
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT private.current_company_id()));
CREATE POLICY "vehicle_reports_delete_admin" ON public.vehicle_reports
  FOR DELETE TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

ALTER TABLE public.vehicle_weekly_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_assign_select_tenant" ON public.vehicle_weekly_assignments
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));
CREATE POLICY "vehicle_assign_write_admin" ON public.vehicle_weekly_assignments
  FOR ALL TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()))
  WITH CHECK (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

ALTER TABLE public.vehicle_inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_inv_tenant" ON public.vehicle_inventory_items
  FOR ALL TO authenticated
  USING ((SELECT private.is_vehicle_in_company(vehicle_id::text)))
  WITH CHECK ((SELECT private.is_vehicle_in_company(vehicle_id::text)));

ALTER TABLE public.vehicle_maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_maint_select_tenant" ON public.vehicle_maintenance_records
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));
CREATE POLICY "vehicle_maint_write_admin" ON public.vehicle_maintenance_records
  FOR ALL TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()))
  WITH CHECK (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

-- M. inventory_items, inventory_movements, calendar_events, absence_justifications, company_notifications
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_items_select_tenant" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));
CREATE POLICY "inventory_items_insert_admin" ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));
CREATE POLICY "inventory_items_update_tenant" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT private.current_company_id()))
  WITH CHECK (company_id = (SELECT private.current_company_id()));
CREATE POLICY "inventory_items_delete_admin" ON public.inventory_items
  FOR DELETE TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_movements_select_tenant" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));
CREATE POLICY "inventory_movements_insert_tenant" ON public.inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT private.current_company_id()));

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_events_select_tenant" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));
CREATE POLICY "calendar_events_write_admin" ON public.calendar_events
  FOR ALL TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()))
  WITH CHECK (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

ALTER TABLE public.absence_justifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "absence_select_scoped" ON public.absence_justifications
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT private.current_company_id())
    AND (
      (SELECT private.is_company_admin())
      OR employee_id::text = (SELECT private.current_employee_id())::text
    )
  );
CREATE POLICY "absence_insert_self" ON public.absence_justifications
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT private.current_company_id())
    AND (
      (SELECT private.is_company_admin())
      OR (employee_id::text = (SELECT private.current_employee_id())::text AND status = 'pendente')
    )
  );
CREATE POLICY "absence_update_admin" ON public.absence_justifications
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()))
  WITH CHECK (company_id = (SELECT private.current_company_id()));

ALTER TABLE public.company_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_notifs_select_tenant" ON public.company_notifications
  FOR SELECT TO authenticated
  USING (company_id = (SELECT private.current_company_id()));
CREATE POLICY "company_notifs_write_admin" ON public.company_notifications
  FOR ALL TO authenticated
  USING (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()))
  WITH CHECK (company_id = (SELECT private.current_company_id()) AND (SELECT private.is_company_admin()));

-- 7. RPC ESCOPADA PARA O PORTAL DO CLIENTE (ÚNICO PONTO DE ACESSO PÚBLICO VIA share_code)
--    Retorna SOMENTE dados públicos daquela obra específica — nunca finanças ou eventos de outras obras!
CREATE OR REPLACE FUNCTION public.get_public_site_portal(p_share_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_code text;
  v_site public.construction_sites%ROWTYPE;
  v_company jsonb;
  v_tasks jsonb;
  v_daily_logs jsonb;
  v_work_sessions jsonb;
  v_documents jsonb;
  v_accidents jsonb;
  v_milestones jsonb;
  v_paid_revenues numeric := 0;
BEGIN
  v_clean_code := UPPER(TRIM(COALESCE(p_share_code, '')));
  -- Bloqueia códigos vazios ou com wildcards
  IF LENGTH(v_clean_code) < 4 OR v_clean_code ~ '[%_]' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_site
  FROM public.construction_sites
  WHERE UPPER(share_code) = v_clean_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Apenas branding público da empresa (nunca password_hash, owner_email ou NIF)
  SELECT jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'phone', c.phone,
    'logo_url', c.logo_url,
    'theme_color', c.theme_color,
    'theme_mode', c.theme_mode
  ) INTO v_company
  FROM public.companies c
  WHERE c.id = v_site.company_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_tasks
  FROM public.site_tasks t
  WHERE t.site_id::text = v_site.id::text;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.log_date DESC), '[]'::jsonb)
  INTO v_daily_logs
  FROM public.site_daily_logs l
  WHERE l.site_id::text = v_site.id::text;

  SELECT COALESCE(jsonb_agg(to_jsonb(ws) ORDER BY ws.work_date DESC), '[]'::jsonb)
  INTO v_work_sessions
  FROM public.site_work_sessions ws
  WHERE ws.site_id::text = v_site.id::text;

  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.uploaded_at DESC), '[]'::jsonb)
  INTO v_documents
  FROM public.site_documents d
  WHERE d.site_id::text = v_site.id::text;

  SELECT COALESCE(jsonb_agg(to_jsonb(ev) ORDER BY ev.event_date ASC), '[]'::jsonb)
  INTO v_milestones
  FROM public.calendar_events ev
  WHERE ev.site_id::text = v_site.id::text
    AND ev.category = 'etapa_obra';

  -- Apenas o total consolidado de receitas pagas desta obra (sem vazar linhas de despesas/fornecedores)
  SELECT COALESCE(SUM(
    CASE
      WHEN (to_jsonb(ft)->>'type') IN ('receita', 'income')
           AND ((to_jsonb(ft)->>'status') = 'pago' OR (to_jsonb(ft)->>'paid') = 'true')
        THEN COALESCE((to_jsonb(ft)->>'amount')::numeric, 0)
      WHEN (to_jsonb(ft)->>'type') IN ('receita', 'income')
           AND (to_jsonb(ft)->>'status') = 'parcial'
        THEN COALESCE((to_jsonb(ft)->>'paid_amount')::numeric, 0)
      ELSE 0
    END
  ), 0)
  INTO v_paid_revenues
  FROM public.financial_transactions ft
  WHERE (to_jsonb(ft)->>'site_id') = v_site.id::text
    AND COALESCE(to_jsonb(ft)->>'status', 'pendente') <> 'cancelado';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_accidents') THEN
    EXECUTE
      'SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.accident_date DESC), ''[]''::jsonb) FROM public.site_accidents a WHERE a.site_id::text = $1'
      INTO v_accidents
      USING v_site.id::text;
  ELSE
    v_accidents := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'site', to_jsonb(v_site),
    'company', v_company,
    'tasks', v_tasks,
    'daily_logs', v_daily_logs,
    'work_sessions', v_work_sessions,
    'documents', v_documents,
    'accidents', v_accidents,
    'milestones', v_milestones,
    'paid_revenues_total', v_paid_revenues
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_site_portal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_portal(text) TO anon, authenticated;

-- 8. RPCS PARA MIGRAÇÃO TRANSPARENTE DE CONTAS LEGADAS (ZERO LOCKOUT NO PRIMEIRO LOGIN)
--    Verifica credenciais legadas NO SERVIDOR (nunca expõe password_hash ao navegador)
CREATE OR REPLACE FUNCTION public.verify_legacy_company_credentials(p_email text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stored text;
  v_clean_email text;
  v_clean_pass text;
  v_expected_hash text;
BEGIN
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_pass := TRIM(COALESCE(p_password, ''));
  IF v_clean_email = '' OR v_clean_pass = '' THEN
    RETURN false;
  END IF;

  SELECT c.password_hash INTO v_stored
  FROM public.companies c
  WHERE LOWER(TRIM(c.owner_email)) = v_clean_email
    AND c.owner_auth_id IS NULL
    AND c.password_hash IS NOT NULL
    AND c.password_hash <> 'supabase_auth_managed'
  LIMIT 1;

  IF NOT FOUND OR v_stored IS NULL THEN
    RETURN false;
  END IF;

  v_expected_hash := 'sha256$' || encode(extensions.digest('castello_sec_salt_v1:' || v_clean_pass, 'sha256'), 'hex');
  RETURN (v_stored = v_expected_hash OR v_stored = v_clean_pass);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_legacy_company_credentials(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_legacy_company_credentials(text, text) TO anon, authenticated;

-- Vincula owner_auth_id após login/cadastro no Supabase Auth e limpa password_hash legado
CREATE OR REPLACE FUNCTION public.claim_legacy_company_by_email()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_email text;
  v_company public.companies%ROWTYPE;
BEGIN
  v_uid := (SELECT auth.uid());
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT LOWER(TRIM(email)) INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Vincula apenas se a firma ainda não tiver owner_auth_id e o email do auth.users coincidir
  UPDATE public.companies
  SET owner_auth_id = v_uid,
      password_hash = 'supabase_auth_managed'
  WHERE LOWER(TRIM(owner_email)) = v_email
    AND owner_auth_id IS NULL
  RETURNING * INTO v_company;

  IF NOT FOUND THEN
    SELECT * INTO v_company
    FROM public.companies
    WHERE owner_auth_id = v_uid
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_company.id,
    'name', v_company.name,
    'tax_id', v_company.tax_id,
    'owner_email', v_company.owner_email,
    'phone', v_company.phone,
    'logo_url', v_company.logo_url,
    'theme_color', v_company.theme_color,
    'theme_mode', v_company.theme_mode,
    'created_at', v_company.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_legacy_company_by_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_legacy_company_by_email() TO authenticated;

-- 9. RPCS PARA MIGRAÇÃO TRANSPARENTE DE COLABORADORES LEGADOS NO APP MOBILE
CREATE OR REPLACE FUNCTION public.verify_legacy_employee_credentials(p_email text, p_access_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_email text;
  v_clean_code text;
BEGIN
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_code := TRIM(COALESCE(p_access_code, ''));
  IF v_clean_email = '' OR v_clean_code = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE LOWER(TRIM(p.email)) = v_clean_email
      AND p.is_active = true
      AND p.auth_user_id IS NULL
      AND TRIM(COALESCE(p.access_code, '')) = v_clean_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_legacy_employee_credentials(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_legacy_employee_credentials(text, text) TO anon, authenticated;

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

-- 10. RECARREGAR SCHEMA DO POSTGREST
NOTIFY pgrst, 'reload schema';
