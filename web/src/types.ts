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
  // Categorias de Receitas
  | 'adiantamento_cliente'
  | 'receita_medicao'
  | 'trabalhos_adicionais'
  | 'outros_recebimentos'
  // Categorias de Despesas (Natureza do Custo)
  | 'custo_materiais'
  | 'custo_mao_de_obra'
  | 'custo_equipamentos'
  | 'custo_subempreitadas'
  | 'transporte_logistica'
  | 'seguranca_epis'
  | 'gestao_residuos'
  | 'custos_administrativos'
  | 'impostos_taxas'
  | 'seguros'
  | 'outros_custos'
  // Mantidos por compatibilidade com registos anteriores
  | 'pagamento_fornecedor'
  | 'outros';

export type FinancialStatus = 'pendente' | 'parcial' | 'pago' | 'cancelado';

export type PaymentMethod =
  | 'transferencia'
  | 'multibanco'
  | 'cheque'
  | 'cartao'
  | 'numerario'
  | 'mbway'
  | 'outro';

export type FinancialEntityType = 'cliente' | 'fornecedor' | 'funcionario' | 'subempreiteiro' | 'estado' | 'outro';

export interface FinancialPaymentInstallment {
  id: string;
  amount: number; // Em Euro (€)
  payment_date: string; // YYYY-MM-DD
  payment_method?: PaymentMethod | string | null;
  reference?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface FinancialRecord {
  id: string;
  company_id?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  type: FinancialType;
  category: FinancialCategory;
  subcategory?: string | null;
  title: string;
  description?: string | null;
  entity_name?: string | null; // Fornecedor / Cliente / Funcionário
  entity_type?: FinancialEntityType | null;
  entity_id?: string | null;
  invoice_number?: string | null; // Referência ou número do documento
  payment_method?: PaymentMethod | string | null;
  amount: number; // Valor total original em Euro (€)
  paid_amount?: number; // Valor já liquidado (para pagamentos parciais)
  due_date: string; // YYYY-MM-DD
  payment_date?: string | null; // YYYY-MM-DD (Data efetiva do último pagamento/liquidação)
  status: FinancialStatus;
  receipt_url?: string | null; // Comprovante / anexo
  measurement_id?: string | null; // ID da medição associada (quando aplicável)
  source_module?: 'manual' | 'medicao' | 'mao_de_obra' | 'compra_material' | 'equipamento_manutencao' | null;
  source_id?: string | null;
  is_committed?: boolean; // Indica se é um custo comprometido (contrato/encomenda) ainda não liquidado
  installments?: FinancialPaymentInstallment[]; // Histórico de pagamentos parciais
  created_at?: string;
}

export type MeasurementStatus =
  | 'rascunho'
  | 'submetida'
  | 'aprovada'
  | 'parcialmente_aprovada'
  | 'faturada'
  | 'parcialmente_recebida'
  | 'recebida';

export type MeasurementKind = 'normal' | 'adiantamento' | 'trabalho_adicional';

export interface SiteMeasurement {
  id: string;
  company_id?: string | null;
  site_id: string;
  site_name?: string | null;
  client_name?: string | null;
  measurement_number: number; // Ex: 1, 2, 3...
  kind?: MeasurementKind;
  description: string; // Descrição dos trabalhos medidos
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  measured_value: number; // Valor medido (€)
  approved_value: number; // Valor aprovado (€)
  approval_date?: string | null; // YYYY-MM-DD
  invoiced_value: number; // Valor faturado (€)
  received_value: number; // Valor efetivamente recebido (€)
  retention_pct?: number; // % de retenção de garantia aplicável (ex: 5% ou 10%)
  retention_value: number; // Valor retido (€)
  status: MeasurementStatus;
  notes?: string | null;
  attachments?: string[]; // URLs de autos de medição / anexos
  linked_record_ids?: string[]; // IDs de lançamentos financeiros associados
  created_at?: string;
  updated_at?: string;
}

export interface SiteFinancialConfig {
  site_id: string;
  company_id?: string | null;
  contracted_value: number; // Valor contratado com o cliente (€)
  cost_budget: number; // Orçamento interno de custos (€)
  additional_forecast_cost?: number; // Custos futuros ainda previstos manualmente (€)
  social_charges_pct?: number; // Encargos sociais sobre mão de obra (%)
  updated_at?: string;
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
  budget: number; // Euro € (Orçamento de custos / valor base)
  contracted_value?: number | null; // Valor contratado com o cliente (€)
  cost_budget?: number | null; // Orçamento interno de custos (€)
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

export interface SiteWorkSession {
  id: string;
  company_id?: string | null;
  site_id: string;
  team_id?: string | null; // Identificador permanente da equipa
  team_name: string; // Ex: 'Equipa 1', 'Equipa de Estrutura'
  leader_id?: string | null;
  leader_name: string;
  workers_count: number;
  work_date: string; // YYYY-MM-DD
  hours_worked: number; // Duração da sessão (horas da equipa)
  man_hours?: number | null; // Horas-homem efetivamente apuradas no turno
  member_ids_snapshot?: string[]; // Snapshot dos membros presentes no turno
  description?: string | null;
  created_at?: string;
}

export type TeamSpecialty =
  | 'Alvenaria'
  | 'Reboco'
  | 'Capoto'
  | 'Cofragem'
  | 'Pintura'
  | 'Eletricidade'
  | 'Canalização'
  | 'Carpintaria'
  | 'Pavimentação'
  | 'Acabamentos'
  | 'Outras';

export type TeamOperationalStatus = 'disponivel' | 'alocada' | 'em_atividade' | 'arquivada';

export interface TeamAllocationRecord {
  id: string;
  team_id: string;
  team_name: string;
  site_id: string;
  site_name: string;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  start_time?: string | null; // HH:MM
  end_time?: string | null; // HH:MM
  status: 'planeada' | 'ativa' | 'concluida' | 'transferida' | 'cancelada';
  changed_by?: string | null;
  transfer_reason?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface TeamActivityEvent {
  id: string;
  team_id: string;
  type: 'composicao' | 'lider' | 'ocorrencia' | 'alocacao' | 'arquivamento' | 'tarefa' | 'sessao';
  title: string;
  description: string;
  site_id?: string | null;
  site_name?: string | null;
  author_name?: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  company_id?: string | null;
  name: string;
  leader_id?: string | null;
  leader_name: string;
  leader_phone?: string | null;
  member_ids: string[];
  member_names: string[];
  specialties?: string[]; // Especialidades da equipa (ex: ['Alvenaria', 'Reboco'])
  current_site_id?: string | null;
  current_site_name?: string | null;
  allocated_at?: string | null; // Data/Hora ISO do início da alocação na obra
  allocation_end_date?: string | null; // Data prevista de conclusão da alocação (YYYY-MM-DD)
  allocation_start_time?: string | null; // HH:MM registado (sem valores fictícios)
  allocation_end_time?: string | null; // HH:MM registado
  is_archived?: boolean; // Arquivamento preservando histórico
  archived_at?: string | null;
  member_joined_at?: Record<string, string>; // Data de entrada de cada membro (YYYY-MM-DD)
  member_specialties?: Record<string, string>; // Especialidade individual na equipa
  allocation_history?: TeamAllocationRecord[]; // Histórico estruturado de alocações
  activity_log?: TeamActivityEvent[]; // Registo de alterações na composição, líder e ocorrências
  notes?: string | null;
  created_at?: string;
}

export type AccidentSeverity = 'leve' | 'moderado' | 'grave' | 'critico';

export interface SiteAccident {
  id: string;
  company_id?: string | null;
  site_id: string;
  site_name?: string | null;
  title: string;
  accident_type: string;
  severity: AccidentSeverity;
  accident_date: string; // YYYY-MM-DD
  accident_time?: string | null; // HH:mm
  victim_name: string;
  victim_role?: string | null;
  description: string;
  first_aid_provided?: boolean;
  hospital_referral?: boolean;
  photos?: string[];
  reported_by_id: string;
  reported_by_name: string;
  status: 'registado' | 'investigado' | 'resolvido';
  created_at: string;
}

export interface SiteDocument {
  id: string;
  site_id: string;
  name: string;
  doc_type: string;
  file_url?: string | null;
  file_size?: string | null;
  uploaded_at: string;
  status: 'disponivel' | 'em_revisao' | 'arquivado';
}

export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';
export type TaskExecutionStatus = 'pendente' | 'em_execucao' | 'concluida';

export interface SiteTask {
  id: string;
  site_id: string;
  company_id?: string | null;
  title: string;
  description?: string | null;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  assigned_team_id?: string | null;
  assigned_team_name?: string | null;
  priority?: TaskPriority;
  start_date?: string | null; // YYYY-MM-DD
  progress?: number; // 0 a 100
  execution_status?: TaskExecutionStatus;
  planned_hours?: number | null; // Horas planeadas para comparação previsto vs realizado
  service_quantity?: number | null; // Quantidade física executada (ex: 120)
  service_unit?: string | null; // Unidade de medida (ex: 'm² de reboco', 'm² de capoto')
  before_photos?: string[]; // Fotografias ANTES da execução
  observations?: string | null; // Observações operacionais registadas
  status: TaskStatus;
  completed_by_name?: string | null;
  completed_at?: string | null;
  completion_photos?: string[]; // Fotos enviadas na conclusão (DEPOIS)
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
// AGENDA E CALENDÁRIO DE COMPROMISSOS (CENTRAL DE PLANEAMENTO)
// ============================================================================
export type EventCategory =
  | 'etapa_obra'
  | 'tarefa'
  | 'material'
  | 'equipa'
  | 'compromisso'
  | 'personalizado'
  // Categorias anteriores mantidas por compatibilidade:
  | 'obra'
  | 'reuniao'
  | 'inspecao'
  | 'pagamento'
  | 'outro';

export type EventPriority = 'baixa' | 'media' | 'alta' | 'urgente';
export type EventStatus = 'planeado' | 'em_andamento' | 'concluido' | 'cancelado' | 'atrasado';
export type EventRecurrence = 'nenhuma' | 'diaria' | 'semanal' | 'mensal';
export type EventSourceModule = 'manual' | 'obra' | 'tarefa' | 'ausencia' | 'material';

export interface CalendarEvent {
  id: string;
  company_id?: string | null;
  title: string;
  description?: string | null;
  event_date: string; // YYYY-MM-DD (Data de início)
  end_date?: string | null; // YYYY-MM-DD (Data de conclusão prevista)
  start_time?: string | null; // HH:MM
  end_time?: string | null; // HH:MM
  all_day?: boolean;
  category: EventCategory;
  event_subtype?: string | null; // Ex: fundacao, alvenaria, instalacoes, reboco, pintura, acabamentos, ferias, folga, reuniao_cliente, vistoria...
  site_id?: string | null;
  site_name?: string | null;
  assigned_employee_id?: string | null;
  assigned_employee_name?: string | null;
  assigned_team_id?: string | null;
  assigned_team_name?: string | null;
  supplier_name?: string | null; // Para entregas de materiais / receção de equipamentos
  location?: string | null;
  priority?: EventPriority;
  status?: EventStatus;
  progress?: number; // 0 a 100 (%)
  dependencies?: string[]; // IDs de atividades predecessoras no Gantt
  recurrence?: EventRecurrence;
  reminder_minutes?: number | null; // Ex: 60 (1h), 1440 (1 dia), 4320 (3 dias)
  visible_to_client?: boolean; // Visível no portal do cliente da obra
  source_module?: EventSourceModule; // Origem da sincronização
  source_id?: string | null; // ID do registo original (site_id, task_id, justification_id...)
  google_calendar_synced?: boolean;
  google_event_url?: string | null;
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
