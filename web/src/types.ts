export type SiteStatus = 'ativa' | 'pausada' | 'concluida';
export type EntryType = 'entrada' | 'almoco' | 'saida';
export type EntryStatus = 'pendente' | 'aprovado' | 'rejeitado';
export type TaskStatus = 'pendente' | 'concluida_funcionario' | 'confirmada_chefe';

export type ThemeColor = 'azul' | 'vermelho' | 'verde' | 'amarelo' | 'laranja';
export type ThemeMode = 'dark' | 'light';

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
  theme_color?: ThemeColor | null;
  theme_mode?: ThemeMode | null;
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
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  status: TaskStatus;
  completed_by_name?: string | null;
  completed_at?: string | null;
  completion_photos?: string[]; // Fotos enviadas pelo colaborador na conclusão
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  show_to_client?: boolean; // Se aprovada para aparecer no portal do cliente
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

// ============================================================================
// INVENTÁRIO DE MATERIAIS E FERRAMENTAS
// ============================================================================
export type InventoryCategory =
  | 'ferramentas'
  | 'maquinas_equipamentos'
  | 'materiais_consumiveis'
  | 'seguranca_epis'
  | 'outros';

export type InventoryCondition = 'novo' | 'bom' | 'manutencao' | 'danificado';

export interface InventoryItem {
  id: string;
  company_id?: string | null;
  name: string;
  category: InventoryCategory;
  serial_number?: string | null;
  total_quantity: number;
  allocated_quantity: number;
  available_quantity: number;
  allocated_site_id?: string | null;
  allocated_site_name?: string | null;
  condition: InventoryCondition;
  unit_price?: number | null;
  supplier?: string | null;
  location?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// GESTÃO DE CARRINHAS / FROTA
// ============================================================================
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
  license_plate: string; // Matrícula
  brand: string; // Marca
  model: string; // Modelo
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
  photo_url?: string | null; // Foto de Perfil da Carrinha
  notes?: string | null;
  // Campos de Manutenção Preventiva
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

export interface VehicleWeeklyAssignment {
  id: string;
  vehicle_id: string;
  company_id?: string | null;
  date: string; // YYYY-MM-DD
  day_of_week: string; // Segunda, Terça, Quarta...
  driver_id?: string | null;
  driver_name: string;
  driver_phone?: string | null;
  notes?: string;
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

export interface VehicleMaintenanceRecord {
  id: string;
  vehicle_id: string;
  company_id?: string | null;
  item_type: 'oleo' | 'pneus' | 'travoes' | 'revisao_geral' | 'ipo' | 'outro';
  title: string;
  description?: string;
  performed_at: string;
  performed_km: number;
  next_due_date?: string | null;
  next_due_km?: number | null;
  cost?: number | null;
  service_provider?: string | null;
  created_at: string;
}

// ============================================================================
// AGENDA E CALENDÁRIO DE COMPROMISSOS
// ============================================================================
export type EventCategory =
  | 'obra'
  | 'reuniao'
  | 'inspecao'
  | 'pagamento'
  | 'outro';

export interface CalendarEvent {
  id: string;
  company_id?: string | null;
  title: string;
  description?: string | null;
  event_date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM
  end_time?: string | null; // HH:MM
  category: EventCategory;
  site_id?: string | null;
  site_name?: string | null;
  assigned_employee_id?: string | null;
  assigned_employee_name?: string | null;
  location?: string | null;
  is_completed: boolean;
  created_at?: string;
}

// ============================================================================
// JUSTIFICATIVAS DE FALTA E NOTIFICAÇÕES DA EMPRESA
// ============================================================================
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
