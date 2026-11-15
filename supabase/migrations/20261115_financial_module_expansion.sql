-- ============================================================================
-- MIGRATION: Reformulação e Expansão do Módulo Financeiro do Castello
-- Ficheiro: supabase/migrations/20261115_financial_module_expansion.sql
-- ============================================================================

-- 1. Expansão de construction_sites para distinguir Valor Contratado (Receita)
--    do Orçamento Interno de Custos da Obra
ALTER TABLE IF EXISTS public.construction_sites
  ADD COLUMN IF NOT EXISTS contracted_value numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_budget numeric(14, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_forecast_cost numeric(14, 2) DEFAULT 0;

-- 2. Expansão de financial_transactions para suportar pagamentos parciais,
--    parcelas, método de pagamento, comprovantes, entidade, subcategoria e medições
ALTER TABLE IF EXISTS public.financial_transactions
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.construction_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_name text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS entity_name text,
  ADD COLUMN IF NOT EXISTS entity_type text CHECK (entity_type IN ('cliente', 'fornecedor', 'funcionario', 'subempreiteiro', 'outro')),
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'parcial', 'pago', 'cancelado')),
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS measurement_id uuid,
  ADD COLUMN IF NOT EXISTS source_module text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS is_committed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS installments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Índices de performance em financial_transactions (Postgres Best Practices)
CREATE INDEX IF NOT EXISTS idx_fin_transactions_company_due
  ON public.financial_transactions (company_id, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_fin_transactions_site_id
  ON public.financial_transactions (site_id)
  WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_transactions_status
  ON public.financial_transactions (company_id, status);

CREATE INDEX IF NOT EXISTS idx_fin_transactions_source
  ON public.financial_transactions (company_id, source_module, source_id)
  WHERE source_id IS NOT NULL;

-- 3. Tabela de Autos de Medição e Faturação de Obras (site_measurements)
CREATE TABLE IF NOT EXISTS public.site_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  site_name text,
  client_name text,
  measurement_number integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'normal' CHECK (kind IN ('normal', 'adiantamento', 'trabalho_adicional')),
  description text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  measured_value numeric(14, 2) NOT NULL DEFAULT 0,
  approved_value numeric(14, 2) NOT NULL DEFAULT 0,
  approval_date date,
  invoiced_value numeric(14, 2) NOT NULL DEFAULT 0,
  received_value numeric(14, 2) NOT NULL DEFAULT 0,
  retention_pct numeric(5, 2) NOT NULL DEFAULT 0,
  retention_value numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho' CHECK (
    status IN (
      'rascunho',
      'submetida',
      'aprovada',
      'parcialmente_aprovada',
      'faturada',
      'parcialmente_recebida',
      'recebida'
    )
  ),
  notes text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_record_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_measurements_company_site
  ON public.site_measurements (company_id, site_id, measurement_number);

-- 4. Row Level Security (RLS) para Isolamento de Dados por company_id
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_measurements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'financial_transactions'
      AND policyname = 'company_isolation_financial_transactions'
  ) THEN
    CREATE POLICY company_isolation_financial_transactions
      ON public.financial_transactions
      FOR ALL
      USING (company_id IS NOT NULL)
      WITH CHECK (company_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_measurements'
      AND policyname = 'company_isolation_site_measurements'
  ) THEN
    CREATE POLICY company_isolation_site_measurements
      ON public.site_measurements
      FOR ALL
      USING (company_id IS NOT NULL)
      WITH CHECK (company_id IS NOT NULL);
  END IF;
END $$;
