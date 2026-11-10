-- ============================================================================
-- CASTELLO - SUPABASE SCHEMA ATUALIZADO
-- ============================================================================
-- 1. Remoção de site_id de profiles (funcionários não ficam presos a uma obra)
-- 2. Tabela de tarefas da obra (site_tasks) com fluxo: pendente -> concluida_funcionario -> confirmada_chefe
-- 3. Código único da obra (share_code) para link público do cliente
-- 4. Diário de bordo da obra (site_daily_logs) para o cliente ver o que foi feito no dia

create extension if not exists "pgcrypto";

-- 1. TABELA DE EMPRESAS / FIRMAS (companies)
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  owner_email text not null unique,
  password_hash text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- 2. TABELA DE OBRAS (construction_sites)
create table if not exists public.construction_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  share_code text unique default upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
  address text not null,
  manager_name text,
  manager_id uuid, -- Referência ao funcionário encarregado
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'concluida')),
  budget numeric(12, 2) default 0.00,
  description text,
  client_name text,
  client_phone text,
  start_date date default current_date,
  expected_end_date date,
  created_at timestamptz not null default now()
);

do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name='construction_sites' and column_name='share_code') then
    alter table public.construction_sites add column share_code text unique default upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='construction_sites' and column_name='manager_id') then
    alter table public.construction_sites add column manager_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='construction_sites' and column_name='client_name') then
    alter table public.construction_sites add column client_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='construction_sites' and column_name='client_phone') then
    alter table public.construction_sites add column client_phone text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='construction_sites' and column_name='expected_end_date') then
    alter table public.construction_sites add column expected_end_date date;
  end if;
end $$;

-- 3. TABELA DE PERFIS DE FUNCIONÁRIOS (profiles)
-- Observação: site_id descontinuado. Todas as obras são acessíveis a todos os funcionários da firma.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  access_code text not null default '123456',
  role text not null default 'funcionario' check (role in ('funcionario', 'patrao')),
  job_title text not null default 'Técnico de Obra',
  phone text,
  hourly_rate numeric(10, 2) not null default 18.50,
  monthly_target_hours integer not null default 176,
  avatar_url text,
  admission_date date default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='admission_date') then
    alter table public.profiles add column admission_date date default current_date;
  end if;
end $$;

-- 4. TABELA DE TAREFAS DA OBRA (site_tasks)
-- Fluxo:
-- 1. 'pendente' (criada pelo chefe)
-- 2. 'concluida_funcionario' (o funcionário clica em Concluir Tarefa)
-- 3. 'confirmada_chefe' (o chefe ou encarregado confirma que foi bem executada)
create table if not exists public.site_tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.construction_sites(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text,
  assigned_to_name text,
  status text not null default 'pendente' check (status in ('pendente', 'concluida_funcionario', 'confirmada_chefe')),
  completed_by_name text,
  completed_at timestamptz,
  confirmed_by_name text,
  confirmed_at timestamptz,
  due_date date,
  created_at timestamptz not null default now()
);

-- 5. TABELA DE DIÁRIO DE BORDO DA OBRA (site_daily_logs)
-- Registros do que foi feito no dia para visualização do cliente e gestão
create table if not exists public.site_daily_logs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.construction_sites(id) on delete cascade,
  log_date date not null default current_date,
  summary text not null,
  weather text,
  workers_count integer default 1,
  notes text,
  created_at timestamptz not null default now()
);

-- 6. TABELA DE REGISTROS DE PONTO (time_entries)
create table if not exists public.time_entries (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid references public.construction_sites(id) on delete set null,
  entry_type text not null check (entry_type in ('entrada', 'almoco', 'saida')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  validated_at timestamptz,
  validation_notes text,
  recorded_at timestamptz not null default now(),
  work_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- 7. ÍNDICES DE BUSCA RÁPIDA
create index if not exists idx_sites_share_code on public.construction_sites (share_code);
create index if not exists idx_tasks_site on public.site_tasks (site_id);
create index if not exists idx_daily_logs_site on public.site_daily_logs (site_id, log_date desc);
create index if not exists idx_time_entries_employee on public.time_entries (employee_id, work_date desc);

-- 8. POLÍTICAS RLS IDEMPOTENTES
alter table public.companies enable row level security;
alter table public.construction_sites enable row level security;
alter table public.profiles enable row level security;
alter table public.site_tasks enable row level security;
alter table public.site_daily_logs enable row level security;
alter table public.time_entries enable row level security;

drop policy if exists "companies_open_policy" on public.companies;
create policy "companies_open_policy" on public.companies for all to anon, authenticated using (true) with check (true);

drop policy if exists "sites_open_policy" on public.construction_sites;
create policy "sites_open_policy" on public.construction_sites for all to anon, authenticated using (true) with check (true);

drop policy if exists "profiles_open_policy" on public.profiles;
create policy "profiles_open_policy" on public.profiles for all to anon, authenticated using (true) with check (true);

drop policy if exists "site_tasks_open_policy" on public.site_tasks;
create policy "site_tasks_open_policy" on public.site_tasks for all to anon, authenticated using (true) with check (true);

drop policy if exists "site_daily_logs_open_policy" on public.site_daily_logs;
create policy "site_daily_logs_open_policy" on public.site_daily_logs for all to anon, authenticated using (true) with check (true);

drop policy if exists "time_entries_open_policy" on public.time_entries;
create policy "time_entries_open_policy" on public.time_entries for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant all on public.companies to anon, authenticated;
grant all on public.construction_sites to anon, authenticated;
grant all on public.profiles to anon, authenticated;
grant all on public.site_tasks to anon, authenticated;
grant all on public.site_daily_logs to anon, authenticated;
grant all on public.time_entries to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

notify pgrst, 'reload schema';
