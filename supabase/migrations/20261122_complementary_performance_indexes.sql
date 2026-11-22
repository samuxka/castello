-- ============================================================================
-- MIGRAÇÃO COMPLEMENTAR DE ÍNDICES E LIMPEZA DE DUPLICADOS (POSTGRESQL)
-- Ficheiro: supabase/migrations/20261122_complementary_performance_indexes.sql
-- ============================================================================

-- 1. Índices compostos para consultas em lote (.in / company_id + data DESC)
CREATE INDEX IF NOT EXISTS idx_vehicle_maint_vehicle_performed
  ON public.vehicle_maintenance_records (vehicle_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_teams_company_name
  ON public.teams (company_id, name);

CREATE INDEX IF NOT EXISTS idx_absence_justif_company_date
  ON public.absence_justifications (company_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_reports_vehicle_created
  ON public.vehicle_reports (vehicle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_vehicle_ts
  ON public.inventory_movements (vehicle_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_site_documents_site_uploaded
  ON public.site_documents (site_id, uploaded_at DESC);

-- 2. Remoção de índices duplicados identificados na auditoria
DROP INDEX IF EXISTS public.idx_financial_transactions_company_due;
DROP INDEX IF EXISTS public.idx_construction_sites_share_code;

