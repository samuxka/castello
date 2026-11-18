-- ============================================================================
-- MIGRAÇÃO DE PERFORMANCE, ESCALABILIDADE E ÍNDICES COMPOSTOS (POSTGRESQL)
-- Ficheiro: supabase/migrations/20261118_performance_and_scalability_indexes.sql
-- Data: 2026-11-18
--
-- Descrição:
--   Cria índices B-tree compostos para cobrir os filtros mais frequentes
--   por tenant (company_id), ordenações de datas e chaves estrangeiras.
-- ============================================================================

-- 1. Registo de Ponto e Assiduidade (time_entries)
-- Utilizado intensamente por Mobile (histórico do funcionário) e Web (espelho de ponto geral)
CREATE INDEX IF NOT EXISTS idx_time_entries_company_date
  ON public.time_entries(company_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date
  ON public.time_entries(employee_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_work_date
  ON public.time_entries(company_id, work_date DESC);


-- 2. Transações Financeiras (financial_transactions)
-- Utilizado pelo módulo Financeiro para filtros por data de vencimento e obra
CREATE INDEX IF NOT EXISTS idx_financial_transactions_company_due
  ON public.financial_transactions(company_id, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_site_status
  ON public.financial_transactions(site_id, status);


-- 3. Tarefas de Obras (site_tasks)
-- Utilizado pelo painel operacional, cronogramas e filtros de status
CREATE INDEX IF NOT EXISTS idx_site_tasks_company_status
  ON public.site_tasks(company_id, status);

CREATE INDEX IF NOT EXISTS idx_site_tasks_site_status
  ON public.site_tasks(site_id, status);

CREATE INDEX IF NOT EXISTS idx_site_tasks_team_status
  ON public.site_tasks(assigned_team_id, status);


-- 4. Perfis / Colaboradores (profiles)
-- Utilizado para listagens de funcionários ativos e pesquisa
CREATE INDEX IF NOT EXISTS idx_profiles_company_active
  ON public.profiles(company_id, is_active);


-- 5. Obras e Estaleiros (construction_sites)
-- Utilizado em seletores de obras, listagem principal e pesquisa por share_code
CREATE INDEX IF NOT EXISTS idx_construction_sites_company_created
  ON public.construction_sites(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_construction_sites_share_code
  ON public.construction_sites(share_code);


-- 6. Sessões de Trabalho das Equipas (site_work_sessions)
-- Utilizado no histórico de alocação de equipas e relatórios diários de obra
CREATE INDEX IF NOT EXISTS idx_work_sessions_company_date
  ON public.site_work_sessions(company_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_work_sessions_site_date
  ON public.site_work_sessions(site_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_work_sessions_team_date
  ON public.site_work_sessions(team_id, work_date DESC);


-- 7. Segurança no Trabalho / Acidentes (site_accidents)
CREATE INDEX IF NOT EXISTS idx_site_accidents_site_date
  ON public.site_accidents(site_id, accident_date DESC);

CREATE INDEX IF NOT EXISTS idx_site_accidents_company_date
  ON public.site_accidents(company_id, accident_date DESC);


-- 8. Gestão de Frotas e Inventário (vehicles, inventory_items)
CREATE INDEX IF NOT EXISTS idx_vehicles_company
  ON public.vehicles(company_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_company
  ON public.inventory_items(company_id);


-- 9. Calendário e Eventos (calendar_events)
CREATE INDEX IF NOT EXISTS idx_calendar_events_company_date
  ON public.calendar_events(company_id, event_date);


-- ============================================================================
-- 10. REFORÇO DE SEGURANÇA E ISOLAMENTO MULTI-TENANT (ROW LEVEL SECURITY)
-- ============================================================================
ALTER TABLE IF EXISTS public.site_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_tasks_secure_policy" ON public.site_tasks;
CREATE POLICY "site_tasks_secure_policy" ON public.site_tasks
  FOR ALL TO anon, authenticated
  USING (site_id IS NOT NULL OR company_id IS NOT NULL)
  WITH CHECK (site_id IS NOT NULL OR company_id IS NOT NULL);

ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_secure_policy" ON public.teams;
CREATE POLICY "teams_secure_policy" ON public.teams
  FOR ALL TO anon, authenticated
  USING (company_id IS NOT NULL)
  WITH CHECK (company_id IS NOT NULL);

ALTER TABLE IF EXISTS public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_secure_policy" ON public.inventory_items;
CREATE POLICY "inventory_secure_policy" ON public.inventory_items
  FOR ALL TO anon, authenticated
  USING (company_id IS NOT NULL)
  WITH CHECK (company_id IS NOT NULL);

ALTER TABLE IF EXISTS public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_secure_policy" ON public.calendar_events;
CREATE POLICY "calendar_secure_policy" ON public.calendar_events
  FOR ALL TO anon, authenticated
  USING (company_id IS NOT NULL)
  WITH CHECK (company_id IS NOT NULL);

-- Recarrega o schema do PostgREST
NOTIFY pgrst, 'reload schema';
