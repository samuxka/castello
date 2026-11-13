-- ============================================================================
-- CASTELLO - SCHEMA DE CARRINHAS, FROTA, INVENTÁRIO, FINANCEIRO E MÓDULOS
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard/project/kkygvorgxehkadaqfqrx/sql)
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. TABELA DE CARRINHAS / VEÍCULOS (vehicles)
create table if not exists public.vehicles (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  license_plate text not null,
  brand text not null,
  model text not null,
  year integer,
  vehicle_type text not null default 'furgao',
  current_km integer not null default 0,
  assigned_driver_id text,
  assigned_driver_name text,
  assigned_site_id text,
  assigned_site_name text,
  next_inspection_date date,
  next_maintenance_km integer,
  insurance_expiry_date date,
  status text not null default 'em_servico',
  fuel_type text default 'Gasóleo (Diesel)',
  photo_url text,
  notes text,
  last_oil_change_date date,
  last_oil_change_km integer,
  next_oil_change_km integer,
  last_tire_change_date date,
  last_tire_change_km integer,
  next_tire_change_km integer,
  last_brakes_check_date date,
  next_brakes_check_km integer,
  created_at text default to_char(now(), 'YYYY-MM-DD'),
  updated_at text default to_char(now(), 'YYYY-MM-DD')
);

-- 2. TABELA DE REPORTS DA CARRINHA ENVIADOS PELOS FUNCIONÁRIOS (vehicle_reports)
create table if not exists public.vehicle_reports (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  vehicle_id text not null,
  vehicle_plate text,
  employee_id text not null,
  employee_name text not null,
  report_type text not null default 'anomalia',
  description text not null,
  current_km integer,
  photos jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. TABELA DE HISTÓRICO DE QUEM CONDUZIU (vehicle_weekly_assignments)
create table if not exists public.vehicle_weekly_assignments (
  id text primary key,
  vehicle_id text not null,
  company_id uuid references public.companies(id) on delete cascade,
  date text not null,
  day_of_week text not null,
  driver_id text,
  driver_name text not null,
  driver_phone text,
  notes text
);

-- 4. TABELA DE ITENS NO INVENTÁRIO DA CARRINHA (vehicle_inventory_items)
create table if not exists public.vehicle_inventory_items (
  id text primary key,
  vehicle_id text not null,
  item_id text not null,
  item_name text not null,
  category text not null,
  quantity integer not null default 1,
  condition text not null default 'bom',
  serial_number text,
  updated_at timestamptz not null default now()
);

-- 5. TABELA DE MANUTENÇÕES DA CARRINHA (vehicle_maintenance_records)
create table if not exists public.vehicle_maintenance_records (
  id text primary key,
  vehicle_id text not null,
  company_id uuid references public.companies(id) on delete cascade,
  item_type text not null default 'oleo',
  title text not null,
  description text,
  performed_at date not null default current_date,
  performed_km integer not null default 0,
  next_due_date date,
  next_due_km integer,
  cost numeric(10,2),
  service_provider text,
  created_at timestamptz not null default now()
);

-- 6. TABELA DE INVENTÁRIO GERAL DA EMPRESA (inventory_items)
create table if not exists public.inventory_items (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  category text not null default 'ferramentas',
  serial_number text,
  total_quantity integer not null default 1,
  allocated_quantity integer not null default 0,
  available_quantity integer not null default 1,
  allocated_site_id text,
  allocated_site_name text,
  condition text not null default 'bom',
  unit_price numeric(10,2),
  supplier text,
  location text,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. TABELA DE MOVIMENTAÇÕES DE ESTOQUE (inventory_movements)
create table if not exists public.inventory_movements (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  vehicle_id text not null,
  vehicle_plate text not null,
  item_id text not null,
  item_name text not null,
  employee_id text not null,
  employee_name text not null,
  movement_type text not null,
  quantity integer not null default 1,
  timestamp timestamptz not null default now(),
  notes text
);

-- 8. TABELA DE TRANSAÇÕES FINANCEIRAS (financial_transactions)
create table if not exists public.financial_transactions (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  site_id text,
  site_name text,
  type text not null check (type in ('receita', 'despesa')),
  category text not null default 'materiais',
  title text not null,
  description text,
  amount numeric(12,2) not null default 0,
  due_date date not null default current_date,
  payment_date date,
  status text not null default 'pendente' check (status in ('pago', 'pendente', 'cancelado')),
  payment_method text,
  entity_name text,
  invoice_number text,
  notes text,
  created_at timestamptz not null default now()
);

-- 9. TABELA DE EVENTOS DO CALENDÁRIO / AGENDA (calendar_events)
create table if not exists public.calendar_events (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  start_time text,
  end_time text,
  category text not null default 'obra',
  site_id text,
  site_name text,
  assigned_employee_id text,
  assigned_employee_name text,
  location text,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- 10. TABELA DE JUSTIFICATIVAS DE FALTA (absence_justifications)
create table if not exists public.absence_justifications (
  id text primary key,
  employee_id text not null,
  employee_name text,
  company_id uuid references public.companies(id) on delete cascade,
  date date not null,
  reason text not null,
  photos jsonb default '[]'::jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada')),
  created_at timestamptz not null default now()
);

-- 11. TABELA DE NOTIFICAÇÕES DA EMPRESA (company_notifications)
create table if not exists public.company_notifications (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  content text not null,
  author_name text,
  priority text default 'normal',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- POLÍTICAS DE ACESSO (RLS) E PERMISSÕES
-- ============================================================================
alter table public.vehicles enable row level security;
alter table public.vehicle_reports enable row level security;
alter table public.vehicle_weekly_assignments enable row level security;
alter table public.vehicle_inventory_items enable row level security;
alter table public.vehicle_maintenance_records enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.calendar_events enable row level security;
alter table public.absence_justifications enable row level security;
alter table public.company_notifications enable row level security;

drop policy if exists "vehicles_open_policy" on public.vehicles;
create policy "vehicles_open_policy" on public.vehicles for all to anon, authenticated using (true) with check (true);

drop policy if exists "vehicle_reports_open_policy" on public.vehicle_reports;
create policy "vehicle_reports_open_policy" on public.vehicle_reports for all to anon, authenticated using (true) with check (true);

drop policy if exists "vehicle_weekly_assignments_open_policy" on public.vehicle_weekly_assignments;
create policy "vehicle_weekly_assignments_open_policy" on public.vehicle_weekly_assignments for all to anon, authenticated using (true) with check (true);

drop policy if exists "vehicle_inventory_items_open_policy" on public.vehicle_inventory_items;
create policy "vehicle_inventory_items_open_policy" on public.vehicle_inventory_items for all to anon, authenticated using (true) with check (true);

drop policy if exists "vehicle_maintenance_records_open_policy" on public.vehicle_maintenance_records;
create policy "vehicle_maintenance_records_open_policy" on public.vehicle_maintenance_records for all to anon, authenticated using (true) with check (true);

drop policy if exists "inventory_items_open_policy" on public.inventory_items;
create policy "inventory_items_open_policy" on public.inventory_items for all to anon, authenticated using (true) with check (true);

drop policy if exists "inventory_movements_open_policy" on public.inventory_movements;
create policy "inventory_movements_open_policy" on public.inventory_movements for all to anon, authenticated using (true) with check (true);

drop policy if exists "financial_transactions_open_policy" on public.financial_transactions;
create policy "financial_transactions_open_policy" on public.financial_transactions for all to anon, authenticated using (true) with check (true);

drop policy if exists "calendar_events_open_policy" on public.calendar_events;
create policy "calendar_events_open_policy" on public.calendar_events for all to anon, authenticated using (true) with check (true);

drop policy if exists "absence_justifications_open_policy" on public.absence_justifications;
create policy "absence_justifications_open_policy" on public.absence_justifications for all to anon, authenticated using (true) with check (true);

drop policy if exists "company_notifications_open_policy" on public.company_notifications;
create policy "company_notifications_open_policy" on public.company_notifications for all to anon, authenticated using (true) with check (true);

-- Permissões completas
grant usage on schema public to anon, authenticated;
grant all on public.vehicles to anon, authenticated;
grant all on public.vehicle_reports to anon, authenticated;
grant all on public.vehicle_weekly_assignments to anon, authenticated;
grant all on public.vehicle_inventory_items to anon, authenticated;
grant all on public.vehicle_maintenance_records to anon, authenticated;
grant all on public.inventory_items to anon, authenticated;
grant all on public.inventory_movements to anon, authenticated;
grant all on public.financial_transactions to anon, authenticated;
grant all on public.calendar_events to anon, authenticated;
grant all on public.absence_justifications to anon, authenticated;
grant all on public.company_notifications to anon, authenticated;

-- Recarrega o cache do PostgREST imediatamente
notify pgrst, 'reload schema';

