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
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  status: TaskStatus;
  completed_by_name?: string | null;
  completed_at?: string | null;
  completion_photos?: string[]; // Fotos enviadas pelo colaborador
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  show_to_client?: boolean;
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

export interface AbsenceJustification {
  id: string;
  employee_id: string;
  employee_name?: string;
  company_id?: string | null;
  date: string; // YYYY-MM-DD
  reason: string; // Obrigatória
  photos: string[]; // 1 ou mais fotos
  status: 'pendente' | 'aprovada' | 'rejeitada';
  created_at: string;
}

export interface CompanyNotification {
  id: string;
  company_id?: string | null;
  title: string;
  content: string;
  created_at: string;
  author_name?: string;
  priority?: 'normal' | 'alta' | 'urgente';
  is_read?: boolean;
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

export type VehicleType =
  | 'furgao'
  | 'caixa_aberta'
  | 'pickup'
  | 'passageiros'
  | 'comercial_ligeiro';

export type VehicleStatus = 'em_servico' | 'em_manutencao' | 'parada';

export interface Vehicle {
  id: string;
  company_id?: string | null;
  license_plate: string;
  brand: string;
  model: string;
  year?: number | null;
  vehicle_type: VehicleType;
  current_km: number;
  assigned_driver_id?: string | null;
  assigned_driver_name?: string | null;
  assigned_site_id?: string | null;
  assigned_site_name?: string | null;
  next_inspection_date?: string | null;
  next_maintenance_km?: number | null;
  insurance_expiry_date?: string | null;
  status: VehicleStatus;
  fuel_type?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  last_oil_change_date?: string | null;
  last_oil_change_km?: number | null;
  next_oil_change_km?: number | null;
  last_tire_change_date?: string | null;
  last_tire_change_km?: number | null;
  next_tire_change_km?: number | null;
  last_brakes_check_date?: string | null;
  next_brakes_check_km?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type VehicleReportType = 'anomalia' | 'manutencao' | 'abastecimento' | 'limpeza' | 'km' | 'geral';

export interface VehicleReport {
  id: string;
  company_id?: string | null;
  vehicle_id: string;
  vehicle_plate?: string | null;
  employee_id: string;
  employee_name: string;
  report_type: VehicleReportType;
  description: string;
  current_km?: number | null;
  photos?: string[];
  created_at: string;
}

export interface InventoryItem {
  id: string;
  company_id?: string | null;
  name: string;
  category: string;
  serial_number?: string | null;
  total_quantity: number;
  allocated_quantity: number;
  available_quantity: number;
  allocated_site_id?: string | null;
  allocated_site_name?: string | null;
  condition: string;
  unit_price?: number | null;
  location?: string | null;
  notes?: string | null;
}

export interface VehicleInventoryItem {
  id: string;
  vehicle_id: string;
  item_id: string;
  item_name: string;
  category: string;
  quantity: number;
  condition: string;
  serial_number?: string | null;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  company_id?: string | null;
  vehicle_id: string;
  vehicle_plate: string;
  item_id: string;
  item_name: string;
  employee_id: string;
  employee_name: string;
  movement_type: 'carregar' | 'devolver';
  quantity: number;
  timestamp: string;
  notes?: string;
}
