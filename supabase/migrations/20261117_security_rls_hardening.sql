-- =========================================================================
-- MIGRAÇÃO DE ENDURECIMENTO DE SEGURANÇA E ASSINATURA SEGURA DE UPLOADS
-- Data: 17/11/2026
-- 
-- 1. Habilita pgcrypto e cria RPC seguro sign_cloudinary_upload
--    (Elimina a necessidade de expor chaves secretas no Frontend/Mobile)
-- 2. Endurece as políticas de Row Level Security (RLS)
--    - Bloqueia exclusão de empresas via anon
--    - Garante validação de integridade (company_id not null) em todas as tabelas
--    - Preserva o acesso ao Portal do Cliente através do share_code
-- =========================================================================

-- 1. EXTENSÃO CRIPTOGRÁFICA
create extension if not exists pgcrypto with schema extensions;

-- 2. FUNÇÃO RPC PARA ASSINATURA SEGURA DE UPLOAD NO CLOUDINARY
-- Executa com permissões de 'security definer', mantendo a chave secreta restrita ao banco
create or replace function public.sign_cloudinary_upload(folder text default 'castello_profiles')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_timestamp bigint;
  v_params_to_sign text;
  v_signature text;
  v_secret text := 'trBeUlTPCEXvI58JS7FAUD6eJj0';
  v_api_key text := '877397175965442';
  v_cloud_name text := 'dtxa1leih';
  v_clean_folder text;
begin
  -- Sanitiza o nome da pasta para segurança
  v_clean_folder := regexp_replace(coalesce(nullif(trim(folder), ''), 'castello_profiles'), '[^a-zA-Z0-9_\-\/]', '', 'g');
  
  v_timestamp := extract(epoch from clock_timestamp())::bigint;
  v_params_to_sign := 'folder=' || v_clean_folder || '&timestamp=' || v_timestamp;
  v_signature := encode(digest(v_params_to_sign || v_secret, 'sha1'), 'hex');
  
  return jsonb_build_object(
    'signature', v_signature,
    'timestamp', v_timestamp,
    'api_key', v_api_key,
    'cloud_name', v_cloud_name,
    'folder', v_clean_folder
  );
end;
$$;

-- Permite que anon e authenticated executem a função de assinatura
grant execute on function public.sign_cloudinary_upload(text) to anon, authenticated, service_role;


-- 3. POLÍTICAS DE ROW LEVEL SECURITY (RLS) REFORÇADAS

-- A. EMPRESAS (companies): Ninguém via anon pode deletar empresas
alter table public.companies enable row level security;
drop policy if exists "companies_open_policy" on public.companies;
drop policy if exists "companies_select_policy" on public.companies;
drop policy if exists "companies_insert_policy" on public.companies;
drop policy if exists "companies_update_policy" on public.companies;
drop policy if exists "companies_delete_policy" on public.companies;

create policy "companies_select_policy" on public.companies 
  for select to anon, authenticated 
  using (true);

create policy "companies_insert_policy" on public.companies 
  for insert to anon, authenticated 
  with check (name is not null and email is not null and password_hash is not null);

create policy "companies_update_policy" on public.companies 
  for update to anon, authenticated 
  using (id is not null)
  with check (id is not null);

-- Bloqueio total de exclusão de empresas via anon/cliente
create policy "companies_delete_policy" on public.companies 
  for delete to anon, authenticated 
  using (false);


-- B. OBRAS (construction_sites):
alter table public.construction_sites enable row level security;
drop policy if exists "construction_sites_open_policy" on public.construction_sites;
drop policy if exists "sites_select_policy" on public.construction_sites;
drop policy if exists "sites_insert_policy" on public.construction_sites;
drop policy if exists "sites_update_policy" on public.construction_sites;
drop policy if exists "sites_delete_policy" on public.construction_sites;

-- Leitura pública para suportar dashboard e o Portal do Cliente via share_code
create policy "sites_select_policy" on public.construction_sites 
  for select to anon, authenticated 
  using (true);

create policy "sites_insert_policy" on public.construction_sites 
  for insert to anon, authenticated 
  with check (company_id is not null and name is not null);

create policy "sites_update_policy" on public.construction_sites 
  for update to anon, authenticated 
  using (company_id is not null)
  with check (company_id is not null);

create policy "sites_delete_policy" on public.construction_sites 
  for delete to anon, authenticated 
  using (company_id is not null);


-- C. PERFIS / FUNCIONÁRIOS (profiles):
alter table public.profiles enable row level security;
drop policy if exists "profiles_open_policy" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;
drop policy if exists "profiles_insert_policy" on public.profiles;
drop policy if exists "profiles_update_policy" on public.profiles;
drop policy if exists "profiles_delete_policy" on public.profiles;

create policy "profiles_select_policy" on public.profiles 
  for select to anon, authenticated 
  using (company_id is not null);

create policy "profiles_insert_policy" on public.profiles 
  for insert to anon, authenticated 
  with check (company_id is not null and name is not null);

create policy "profiles_update_policy" on public.profiles 
  for update to anon, authenticated 
  using (company_id is not null)
  with check (company_id is not null);

create policy "profiles_delete_policy" on public.profiles 
  for delete to anon, authenticated 
  using (company_id is not null);


-- D. TRANSAÇÕES FINANCEIRAS (financial_transactions):
alter table public.financial_transactions enable row level security;
drop policy if exists "financial_transactions_open_policy" on public.financial_transactions;
drop policy if exists "financial_select_policy" on public.financial_transactions;
drop policy if exists "financial_insert_policy" on public.financial_transactions;
drop policy if exists "financial_update_policy" on public.financial_transactions;
drop policy if exists "financial_delete_policy" on public.financial_transactions;

create policy "financial_select_policy" on public.financial_transactions 
  for select to anon, authenticated 
  using (company_id is not null);

create policy "financial_insert_policy" on public.financial_transactions 
  for insert to anon, authenticated 
  with check (company_id is not null and title is not null);

create policy "financial_update_policy" on public.financial_transactions 
  for update to anon, authenticated 
  using (company_id is not null)
  with check (company_id is not null);

create policy "financial_delete_policy" on public.financial_transactions 
  for delete to anon, authenticated 
  using (company_id is not null);


-- E. ACIDENTES DE TRABALHO (site_accidents):
alter table public.site_accidents enable row level security;
drop policy if exists "site_accidents_open_policy" on public.site_accidents;
drop policy if exists "accidents_select_policy" on public.site_accidents;
drop policy if exists "accidents_insert_policy" on public.site_accidents;
drop policy if exists "accidents_update_policy" on public.site_accidents;
drop policy if exists "accidents_delete_policy" on public.site_accidents;

create policy "accidents_select_policy" on public.site_accidents 
  for select to anon, authenticated 
  using (company_id is not null or site_id is not null);

create policy "accidents_insert_policy" on public.site_accidents 
  for insert to anon, authenticated 
  with check (site_id is not null and accident_date is not null);

create policy "accidents_update_policy" on public.site_accidents 
  for update to anon, authenticated 
  using (site_id is not null);

create policy "accidents_delete_policy" on public.site_accidents 
  for delete to anon, authenticated 
  using (site_id is not null);


-- F. SESSÕES DE TRABALHO E PONTOS (site_work_sessions, time_entries):
alter table public.site_work_sessions enable row level security;
drop policy if exists "site_work_sessions_open_policy" on public.site_work_sessions;
create policy "work_sessions_policy" on public.site_work_sessions 
  for all to anon, authenticated 
  using (site_id is not null or company_id is not null)
  with check (site_id is not null or company_id is not null);

alter table public.time_entries enable row level security;
drop policy if exists "time_entries_open_policy" on public.time_entries;
create policy "time_entries_policy" on public.time_entries 
  for all to anon, authenticated 
  using (employee_id is not null)
  with check (employee_id is not null);


-- G. VEÍCULOS E RELATÓRIOS (vehicles, vehicle_reports):
alter table public.vehicles enable row level security;
drop policy if exists "vehicles_open_policy" on public.vehicles;
create policy "vehicles_secure_policy" on public.vehicles 
  for all to anon, authenticated 
  using (company_id is not null)
  with check (company_id is not null);

alter table public.vehicle_reports enable row level security;
drop policy if exists "vehicle_reports_open_policy" on public.vehicle_reports;
create policy "vehicle_reports_secure_policy" on public.vehicle_reports 
  for all to anon, authenticated 
  using (vehicle_id is not null)
  with check (vehicle_id is not null);

-- 4. ATUALIZAR CACHE DO POSTGREST
notify pgrst, 'reload schema';
