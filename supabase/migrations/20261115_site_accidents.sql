-- ============================================================================
-- MIGRAÇÃO: Registo de Segurança e Acidentes na Obra (Castello SST)
-- Data: 2026-11-15
-- Descrição:
--   Cria a tabela public.site_accidents para registo e rastreio de acidentes
--   de trabalho no mobile e web, com suporte a severidade, socorro, fotos e RLS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.site_accidents (
  id text PRIMARY KEY,
  company_id text NULL,
  site_id text NOT NULL,
  site_name text NULL,
  title text NOT NULL,
  accident_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('leve', 'moderado', 'grave', 'critico')),
  accident_date date NOT NULL DEFAULT CURRENT_DATE,
  accident_time text NULL,
  victim_name text NOT NULL,
  victim_role text NULL,
  description text NOT NULL,
  first_aid_provided boolean DEFAULT false,
  hospital_referral boolean DEFAULT false,
  photos text[] DEFAULT '{}',
  reported_by_id text NOT NULL,
  reported_by_name text NOT NULL,
  status text NOT NULL DEFAULT 'registado' CHECK (status IN ('registado', 'investigado', 'resolvido')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_accidents_company_id ON public.site_accidents(company_id);
CREATE INDEX IF NOT EXISTS idx_site_accidents_site_id ON public.site_accidents(site_id);
CREATE INDEX IF NOT EXISTS idx_site_accidents_date ON public.site_accidents(accident_date DESC);
CREATE INDEX IF NOT EXISTS idx_site_accidents_severity ON public.site_accidents(severity);

-- RLS
ALTER TABLE public.site_accidents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'site_accidents' AND policyname = 'site_accidents_all_company'
  ) THEN
    CREATE POLICY site_accidents_all_company ON public.site_accidents
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
