export type EntryType = 'entrada' | 'almoco' | 'saida';
export type EntryStatus = 'pendente' | 'aprovado' | 'rejeitado';
export type SiteStatus = 'ativa' | 'pausada' | 'concluida';
export type TaskStatus = 'pendente' | 'concluida_funcionario' | 'confirmada_chefe';

export interface Company {
  id: string;
  name: string;
  tax_id?: string | null;
  owner_email: string;
  password_hash: string;
  phone?: string | null;
}

export interface ConstructionSite {
  id: string;
  company_id?: string | null;
  name: string;
  share_code: string;
  address: string;
  manager_name: string | null;
  manager_id?: string | null;
  status: SiteStatus;
  budget?: number;
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
  auth_user_id?: string | null;
  full_name: string;
  email: string;
  access_code: string;
  role: 'funcionario' | 'patrao';
  job_title: string;
  phone: string | null;
  hourly_rate: number; // Euro €
  monthly_target_hours: number;
  avatar_url?: string | null;
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

export interface TimeEntry {
  id: number;
  company_id?: string | null;
  employee_id: string;
  site_id: string | null;
  entry_type: EntryType;
  status: EntryStatus;
  recorded_at: string;
  work_date: string;
  notes?: string | null;
}

export interface DailyWorkSummary {
  date: string;
  entries: TimeEntry[];
  entradaTime: string | null;
  almocoTime: string | null;
  saidaTime: string | null;
  workedMinutes: number;
  workedFormatted: string;
  isComplete: boolean;
  hasPending: boolean;
}
