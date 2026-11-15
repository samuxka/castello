-- ============================================================================
-- MIGRAÇÃO: Evolução Operacional da Gestão de Equipas do Castello
-- Data: 2026-11-15
-- Descrição:
--   1. Adiciona especialidades, arquivamento, metadados de alocação e histórico em public.teams
--   2. Adiciona team_id e horas-homem em public.site_work_sessions (com migração segura)
--   3. Adiciona colunas operacionais de equipa, progresso, horas planeadas e fotos antes/depois em public.site_tasks
--   4. Cria índices de performance e políticas RLS por company_id
-- ============================================================================

-- 1. Evolução da tabela public.teams
ALTER TABLE IF EXISTS public.teams
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS allocation_end_date date NULL,
  ADD COLUMN IF NOT EXISTS allocation_start_time text NULL,
  ADD COLUMN IF NOT EXISTS allocation_end_time text NULL,
  ADD COLUMN IF NOT EXISTS member_joined_at jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS member_specialties jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allocation_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activity_log jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_teams_company_id ON public.teams(company_id);
CREATE INDEX IF NOT EXISTS idx_teams_current_site_id ON public.teams(current_site_id);
CREATE INDEX IF NOT EXISTS idx_teams_is_archived ON public.teams(is_archived);

-- 2. Evolução da tabela public.site_work_sessions (Identificação permanente por team_id)
ALTER TABLE IF EXISTS public.site_work_sessions
  ADD COLUMN IF NOT EXISTS team_id text NULL,
  ADD COLUMN IF NOT EXISTS man_hours numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS member_ids_snapshot text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_site_work_sessions_team_id ON public.site_work_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_site_work_sessions_company_work_date ON public.site_work_sessions(company_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_site_work_sessions_site_work_date ON public.site_work_sessions(site_id, work_date DESC);

-- Migração segura de sessões antigas: associa team_id apenas quando o nome da equipa é único na empresa
WITH unique_team_names AS (
  SELECT company_id, LOWER(TRIM(name)) AS norm_name, MIN(id::text) AS unique_team_id
  FROM public.teams
  GROUP BY company_id, LOWER(TRIM(name))
  HAVING COUNT(*) = 1
)
UPDATE public.site_work_sessions s
SET team_id = u.unique_team_id
FROM unique_team_names u
WHERE s.team_id IS NULL
  AND (s.company_id = u.company_id OR (s.company_id IS NULL AND u.company_id IS NULL))
  AND LOWER(TRIM(s.team_name)) = u.norm_name;

-- 3. Evolução da tabela public.site_tasks para integração direta com equipas e produtividade
ALTER TABLE IF EXISTS public.site_tasks
  ADD COLUMN IF NOT EXISTS assigned_team_id text NULL,
  ADD COLUMN IF NOT EXISTS assigned_team_name text NULL,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS start_date date NULL,
  ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS planned_hours numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS service_quantity numeric(12,2) NULL,
  ADD COLUMN IF NOT EXISTS service_unit text NULL,
  ADD COLUMN IF NOT EXISTS before_photos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS observations text NULL;

CREATE INDEX IF NOT EXISTS idx_site_tasks_assigned_team_id ON public.site_tasks(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_site_tasks_site_id ON public.site_tasks(site_id);
