export type SiteStatus = 'ativa' | 'pausada' | 'concluida';
export type EntryType = 'entrada' | 'almoco' | 'saida';
export type EntryStatus = 'pendente' | 'aprovado' | 'rejeitado';
export type TaskStatus = 'pendente' | 'concluida_funcionario' | 'confirmada_chefe';

export interface Company {
  id: string;
  name: string;
  tax_id?: string | null;
  owner_email: string;
  password_hash: string;
  phone?: string | null;
  logo_url?: string | null;
  currency?: string;
  address?: string | null;
  created_at?: string;
}

export type FinancialType = 'receita' | 'despesa';

export type FinancialCategory =
  | 'adiantamento_cliente'
  | 'receita_medicao'
  | 'pagamento_fornecedor'
  | 'custo_materiais'
  | 'custo_mao_de_obra'
  | 'custo_equipamentos'
  | 'custo_subempreitadas'
  | 'outros';

export type FinancialStatus = 'pendente' | 'pago' | 'cancelado';

export interface FinancialRecord {
  id: string;
  company_id?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  type: FinancialType;
  category: FinancialCategory;
  title: string;
  description?: string | null;
  entity_name?: string | null; // Fornecedor / Cliente
  invoice_number?: string | null;
  amount: number; // Em Euro (€)
  due_date: string; // YYYY-MM-DD
  payment_date?: string | null; // YYYY-MM-DD
  status: FinancialStatus;
  created_at?: string;
}

export interface ConstructionSite {
  id: string;
  company_id?: string | null;
  name: string;
  share_code: string; // Código único da obra (ex: CST-7A8B)
  address: string;
  manager_name: string | null;
  manager_id?: string | null;
  status: SiteStatus;
  budget: number; // Euro €
  description: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  start_date: string | null;
  expected_end_date?: string | null;
  created_at?: string;
}

export interface EmployeeProfile {
  id: string;
  company_id?: string | null;
  full_name: string;
  email: string;
  access_code: string;
  role: 'funcionario' | 'patrao';
  job_title: string;
  phone: string | null;
  hourly_rate: number; // Euro € / hora
  monthly_target_hours: number;
  avatar_url?: string | null;
  admission_date?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface SiteTask {
  id: string;
  site_id: string;
  company_id?: string | null;
  title: string;
  description?: string | null;
  assigned_to_name?: string | null;
  status: TaskStatus;
  completed_by_name?: string | null;
  completed_at?: string | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  due_date?: string | null;
  created_at?: string;
}

export interface SiteDailyLog {
  id: string;
  site_id: string;
  log_date: string;
  summary: string;
  weather?: string | null;
  workers_count?: number;
  notes?: string | null;
  created_at?: string;
}

export interface TimeEntry {
  id: number;
  company_id?: string | null;
  employee_id: string;
  site_id: string | null;
  entry_type: EntryType;
  status: EntryStatus;
  validated_at?: string | null;
  validation_notes?: string | null;
  recorded_at: string;
  work_date: string;
  notes?: string | null;
}
