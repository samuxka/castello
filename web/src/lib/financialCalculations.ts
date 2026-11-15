import {
  ConstructionSite,
  EmployeeProfile,
  FinancialCategory,
  FinancialRecord,
  FinancialType,
  InventoryItem,
  SiteFinancialConfig,
  SiteMeasurement,
  SiteWorkSession,
  TimeEntry,
  VehicleMaintenanceRecord,
} from '../types';

// ============================================================================
// PRECISÃO MONETÁRIA EM CÊNTIMOS & FORMATAÇÃO PT-PT (€)
// ============================================================================
export function roundCents(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

export function addMoney(a: number, b: number): number {
  return Math.round(a * 100 + b * 100) / 100;
}

export function subMoney(a: number, b: number): number {
  return Math.round(a * 100 - b * 100) / 100;
}

export function formatEuro(val: number, detailed = false): string {
  const num = Number.isFinite(val) ? val : 0;
  return num.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: detailed ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function formatDatePt(iso?: string | null): string {
  if (!iso) return '—';
  const clean = iso.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return clean;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ============================================================================
// CATEGORIAS DE RECEITAS VS DESPESAS (SEM CONFLITO COM FORNECEDOR)
// ============================================================================
export interface CategoryDefinition {
  id: FinancialCategory;
  label: string;
  shortLabel: string;
  type: FinancialType;
  color: string;
  subcategories: string[];
}

export const INCOME_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'adiantamento_cliente',
    label: 'Adiantamento de Cliente',
    shortLabel: 'Adiantamento',
    type: 'receita',
    color: '#10B981',
    subcategories: ['Sinal de adjudicação', 'Reforço de adiantamento', 'Caução inicial'],
  },
  {
    id: 'receita_medicao',
    label: 'Medição de Obra',
    shortLabel: 'Medição',
    type: 'receita',
    color: '#2563EB',
    subcategories: ['Auto de medição mensal', 'Liquidação final de empreitada', 'Libertação de retenção'],
  },
  {
    id: 'trabalhos_adicionais',
    label: 'Trabalhos Adicionais / Extras',
    shortLabel: 'Trabalhos Extras',
    type: 'receita',
    color: '#0D9488',
    subcategories: ['Aditamento contratual', 'Trabalhos a mais aprovados', 'Alteração de projeto'],
  },
  {
    id: 'outros_recebimentos',
    label: 'Outros Recebimentos',
    shortLabel: 'Outras Receitas',
    type: 'receita',
    color: '#6366F1',
    subcategories: ['Reembolso de seguro', 'Venda de sucata/sobras', 'Indemnização / Outros'],
  },
];

export const EXPENSE_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'custo_materiais',
    label: 'Materiais de construção',
    shortLabel: 'Materiais',
    type: 'despesa',
    color: '#EF4444',
    subcategories: ['Betão e argamassas', 'Aço e cofragem', 'Alvenaria e blocos', 'Revestimentos e tintas', 'Material elétrico e hidráulico'],
  },
  {
    id: 'custo_mao_de_obra',
    label: 'Mão de obra',
    shortLabel: 'Mão de Obra',
    type: 'despesa',
    color: '#8B5CF6',
    subcategories: ['Salários e vencimentos', 'Horas extras', 'Subsídio de alimentação', 'Encargos sociais (TSU)', 'Ajudas de custo'],
  },
  {
    id: 'custo_equipamentos',
    label: 'Máquinas e equipamentos',
    shortLabel: 'Equipamentos',
    type: 'despesa',
    color: '#F97316',
    subcategories: ['Aluguer de máquinas / gruas', 'Manutenção e reparações', 'Combustível de máquinas', 'Aquisição de ferramentas'],
  },
  {
    id: 'custo_subempreitadas',
    label: 'Subempreitadas',
    shortLabel: 'Subempreitadas',
    type: 'despesa',
    color: '#0284C7',
    subcategories: ['Eletricidade e ITED', 'Canalização e AVAC', 'Carpintaria e caixilharia', 'Impermeabilizações', 'Estrutura / Cofragem'],
  },
  {
    id: 'transporte_logistica',
    label: 'Transporte e logística',
    shortLabel: 'Transporte',
    type: 'despesa',
    color: '#EAB308',
    subcategories: ['Combustível da frota', 'Portagens e deslocações', 'Fretes e entregas em obra', 'Manutenção de carrinhas'],
  },
  {
    id: 'seguranca_epis',
    label: 'Segurança e EPIs',
    shortLabel: 'Segurança & EPIs',
    type: 'despesa',
    color: '#14B8A6',
    subcategories: ['Botas, capacetes e luvas', 'Sinalização de estaleiro', 'Redes e guarda-corpos', 'Medicina no trabalho'],
  },
  {
    id: 'gestao_residuos',
    label: 'Gestão de resíduos',
    shortLabel: 'Resíduos',
    type: 'despesa',
    color: '#84CC16',
    subcategories: ['Aluguer de contentores de entulho', 'Taxa de deposição em aterro', 'Remoção e limpeza final'],
  },
  {
    id: 'custos_administrativos',
    label: 'Custos administrativos',
    shortLabel: 'Administrativo',
    type: 'despesa',
    color: '#64748B',
    subcategories: ['Contabilidade e jurídico', 'Renda de escritório / armazém', 'Água, luz e telecomunicações', 'Software e licenças'],
  },
  {
    id: 'impostos_taxas',
    label: 'Impostos e taxas',
    shortLabel: 'Impostos & Taxas',
    type: 'despesa',
    color: '#EC4899',
    subcategories: ['IVA', 'IRC / Pagamento por conta', 'Licenças camarárias e alvarás', 'IUC e taxas fiscais'],
  },
  {
    id: 'seguros',
    label: 'Seguros',
    shortLabel: 'Seguros',
    type: 'despesa',
    color: '#3B82F6',
    subcategories: ['Seguro de acidentes de trabalho', 'Responsabilidade civil de obra', 'Seguro automóvel da frota'],
  },
  {
    id: 'outros_custos',
    label: 'Outros',
    shortLabel: 'Outros Custos',
    type: 'despesa',
    color: '#94A3B8',
    subcategories: ['Despesas gerais de estaleiro', 'Imprevistos operacionais', 'Outros custos diversos'],
  },
];

export function getCategoryDefinition(cat: FinancialCategory, recordType: FinancialType): CategoryDefinition {
  if (recordType === 'receita') {
    const found = INCOME_CATEGORIES.find((c) => c.id === cat);
    if (found) return found;
    return INCOME_CATEGORIES[3]; // Outros Recebimentos
  }

  // Normaliza categorias legadas de despesa
  if (cat === 'pagamento_fornecedor') {
    return EXPENSE_CATEGORIES[0]; // Materiais de construção (fornecedor é entidade, não categoria concorrente)
  }
  if (cat === 'outros') {
    return EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  }
  const found = EXPENSE_CATEGORIES.find((c) => c.id === cat);
  return found || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

// ============================================================================
// HELPERS DE VALORES REALIZADOS E PENDENTES (COM SUPORTE A PAGAMENTO PARCIAL)
// ============================================================================
export function getEffectivePaidAmount(r: FinancialRecord): number {
  if (r.status === 'cancelado') return 0;
  if (r.status === 'pago') return roundCents(r.amount);
  if (r.status === 'parcial' || (typeof r.paid_amount === 'number' && r.paid_amount > 0)) {
    return roundCents(Math.min(r.amount, Math.max(0, r.paid_amount || 0)));
  }
  return 0;
}

export function getEffectiveRemainingAmount(r: FinancialRecord): number {
  if (r.status === 'cancelado' || r.status === 'pago') return 0;
  const paid = getEffectivePaidAmount(r);
  return roundCents(Math.max(0, r.amount - paid));
}

// ============================================================================
// FILTROS DE PERÍODO E CÁLCULO DO PERÍODO ANTERIOR
// ============================================================================
export type PeriodPreset =
  | 'este_mes'
  | 'mes_anterior'
  | 'ultimos_3_meses'
  | 'ultimos_6_meses'
  | 'este_ano'
  | 'todo_periodo'
  | 'personalizado';

export interface DateRange {
  start: string | null; // YYYY-MM-DD
  end: string | null; // YYYY-MM-DD
  prevStart: string | null;
  prevEnd: string | null;
  label: string;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolvePeriodRange(
  preset: PeriodPreset,
  customStart?: string,
  customEnd?: string
): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (preset === 'este_mes') {
    const start = toIsoDate(new Date(y, m, 1));
    const end = toIsoDate(new Date(y, m + 1, 0));
    const prevStart = toIsoDate(new Date(y, m - 1, 1));
    const prevEnd = toIsoDate(new Date(y, m, 0));
    return { start, end, prevStart, prevEnd, label: 'Este mês' };
  }

  if (preset === 'mes_anterior') {
    const start = toIsoDate(new Date(y, m - 1, 1));
    const end = toIsoDate(new Date(y, m, 0));
    const prevStart = toIsoDate(new Date(y, m - 2, 1));
    const prevEnd = toIsoDate(new Date(y, m - 1, 0));
    return { start, end, prevStart, prevEnd, label: 'Mês anterior' };
  }

  if (preset === 'ultimos_3_meses') {
    const start = toIsoDate(new Date(y, m - 2, 1));
    const end = toIsoDate(new Date(y, m + 1, 0));
    const prevStart = toIsoDate(new Date(y, m - 5, 1));
    const prevEnd = toIsoDate(new Date(y, m - 2, 0));
    return { start, end, prevStart, prevEnd, label: 'Últimos 3 meses' };
  }

  if (preset === 'ultimos_6_meses') {
    const start = toIsoDate(new Date(y, m - 5, 1));
    const end = toIsoDate(new Date(y, m + 1, 0));
    const prevStart = toIsoDate(new Date(y, m - 11, 1));
    const prevEnd = toIsoDate(new Date(y, m - 5, 0));
    return { start, end, prevStart, prevEnd, label: 'Últimos 6 meses' };
  }

  if (preset === 'este_ano') {
    const start = `${y}-01-01`;
    const end = `${y}-12-31`;
    const prevStart = `${y - 1}-01-01`;
    const prevEnd = `${y - 1}-12-31`;
    return { start, end, prevStart, prevEnd, label: `Ano ${y}` };
  }

  if (preset === 'personalizado' && (customStart || customEnd)) {
    const s = customStart || '2000-01-01';
    const e = customEnd || '2099-12-31';
    return {
      start: s,
      end: e,
      prevStart: null,
      prevEnd: null,
      label: `${formatDatePt(s)} a ${formatDatePt(e)}`,
    };
  }

  return {
    start: null,
    end: null,
    prevStart: null,
    prevEnd: null,
    label: 'Todo o período',
  };
}

export function isRecordInDateRange(
  r: FinancialRecord,
  start: string | null,
  end: string | null,
  usePaymentDateWhenPaid = true
): boolean {
  const refDate =
    usePaymentDateWhenPaid && (r.status === 'pago' || r.status === 'parcial')
      ? r.payment_date || r.due_date
      : r.due_date;
  if (!refDate) return true;
  const d = refDate.slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

// ============================================================================
// INDICADORES DA ABA VISÃO GERAL (OS 6 CARDS SOLICITADOS)
// ============================================================================
export interface OverviewMetrics {
  totalReceived: number;
  receivedPrevPeriod: number;
  receivedVariationPct: number | null;
  totalPaid: number;
  paidPrevPeriod: number;
  paidVariationPct: number | null;
  cashBalance: number; // Saldo de caixa acumulado (não lucro)
  periodCashBalance: number;
  accountsReceivable: number;
  overdueReceivablesCount: number;
  overdueReceivablesAmount: number;
  accountsPayable: number;
  overduePayablesCount: number;
  overduePayablesAmount: number;
  forecastBalance: number; // Saldo atual + a receber previsto - a pagar previsto
  forecastHorizonLabel: string;
}

export function computeOverviewMetrics(
  records: FinancialRecord[],
  selectedSiteId: string,
  periodRange: DateRange
): OverviewMetrics {
  const todayStr = new Date().toISOString().slice(0, 10);
  const siteRecords =
    selectedSiteId === 'todos'
      ? records.filter((r) => r.status !== 'cancelado')
      : records.filter((r) => r.site_id === selectedSiteId && r.status !== 'cancelado');

  // Registros no período selecionado
  const inPeriod = siteRecords.filter((r) =>
    isRecordInDateRange(r, periodRange.start, periodRange.end, true)
  );

  // Registros no período anterior (para comparação percentual)
  const inPrevPeriod =
    periodRange.prevStart && periodRange.prevEnd
      ? siteRecords.filter((r) =>
          isRecordInDateRange(r, periodRange.prevStart, periodRange.prevEnd, true)
        )
      : [];

  const totalReceived = roundCents(
    inPeriod
      .filter((r) => r.type === 'receita')
      .reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0)
  );

  const receivedPrevPeriod = roundCents(
    inPrevPeriod
      .filter((r) => r.type === 'receita')
      .reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0)
  );

  const receivedVariationPct =
    periodRange.prevStart && receivedPrevPeriod > 0
      ? roundCents(((totalReceived - receivedPrevPeriod) / receivedPrevPeriod) * 100)
      : null;

  const totalPaid = roundCents(
    inPeriod
      .filter((r) => r.type === 'despesa')
      .reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0)
  );

  const paidPrevPeriod = roundCents(
    inPrevPeriod
      .filter((r) => r.type === 'despesa')
      .reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0)
  );

  const paidVariationPct =
    periodRange.prevStart && paidPrevPeriod > 0
      ? roundCents(((totalPaid - paidPrevPeriod) / paidPrevPeriod) * 100)
      : null;

  // Saldo de caixa global (ou da obra) considerando todo o histórico até ao fim do período selecionado
  const recordsUpToPeriodEnd = periodRange.end
    ? siteRecords.filter((r) => {
        const d = (r.payment_date || r.due_date || '').slice(0, 10);
        return !d || d <= periodRange.end!;
      })
    : siteRecords;

  const allTimeReceived = roundCents(
    recordsUpToPeriodEnd
      .filter((r) => r.type === 'receita')
      .reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0)
  );
  const allTimePaid = roundCents(
    recordsUpToPeriodEnd
      .filter((r) => r.type === 'despesa')
      .reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0)
  );

  const cashBalance = subMoney(allTimeReceived, allTimePaid);
  const periodCashBalance = subMoney(totalReceived, totalPaid);

  // Contas a Receber (pendentes ou parcialmente recebidas)
  const pendingReceivables = siteRecords.filter(
    (r) => r.type === 'receita' && getEffectiveRemainingAmount(r) > 0
  );
  const accountsReceivable = roundCents(
    pendingReceivables.reduce((acc, r) => addMoney(acc, getEffectiveRemainingAmount(r)), 0)
  );
  const overdueReceivables = pendingReceivables.filter((r) => r.due_date && r.due_date < todayStr);
  const overdueReceivablesCount = overdueReceivables.length;
  const overdueReceivablesAmount = roundCents(
    overdueReceivables.reduce((acc, r) => addMoney(acc, getEffectiveRemainingAmount(r)), 0)
  );

  // Contas a Pagar (pendentes ou parcialmente pagas)
  const pendingPayables = siteRecords.filter(
    (r) => r.type === 'despesa' && getEffectiveRemainingAmount(r) > 0
  );
  const accountsPayable = roundCents(
    pendingPayables.reduce((acc, r) => addMoney(acc, getEffectiveRemainingAmount(r)), 0)
  );
  const overduePayables = pendingPayables.filter((r) => r.due_date && r.due_date < todayStr);
  const overduePayablesCount = overduePayables.length;
  const overduePayablesAmount = roundCents(
    overduePayables.reduce((acc, r) => addMoney(acc, getEffectiveRemainingAmount(r)), 0)
  );

  // Saldo Previsto: Saldo Atual + Valores previstos a receber - Valores previstos a pagar
  const forecastBalance = subMoney(addMoney(cashBalance, accountsReceivable), accountsPayable);

  // Horizonte temporal da previsão baseado na maior data de vencimento pendente
  const allPendingDates = [...pendingReceivables, ...pendingPayables]
    .map((r) => r.due_date)
    .filter(Boolean)
    .sort();
  const maxDueDate = allPendingDates.length > 0 ? allPendingDates[allPendingDates.length - 1] : null;
  const forecastHorizonLabel = maxDueDate
    ? `Projeção até ${formatDatePt(maxDueDate)}`
    : 'Projeção de 30 dias (sem pendências futuras)';

  return {
    totalReceived,
    receivedPrevPeriod,
    receivedVariationPct,
    totalPaid,
    paidPrevPeriod,
    paidVariationPct,
    cashBalance,
    periodCashBalance,
    accountsReceivable,
    overdueReceivablesCount,
    overdueReceivablesAmount,
    accountsPayable,
    overduePayablesCount,
    overduePayablesAmount,
    forecastBalance,
    forecastHorizonLabel,
  };
}

// ============================================================================
// RENTABILIDADE E CONTROLE DE ORÇAMENTO POR OBRA
// ============================================================================
export interface SiteProfitabilitySummary {
  site: ConstructionSite;
  contractedValue: number; // Valor contratado com o cliente (€)
  costBudget: number; // Orçamento interno de custos (€)
  receivedRevenue: number; // Receitas efetivamente recebidas (€)
  pendingRevenue: number; // Receitas pendentes / faturadas por receber (€)
  approvedMeasurementsTotal: number; // Total aprovado em autos de medição (€)
  expectedTotalRevenue: number; // Receita contratual ajustada prevista (€)
  realizedCosts: number; // Custos realizados / pagos (€)
  committedCosts: number; // Custos comprometidos (contratos/faturas pendentes de pagamento) (€)
  additionalForecastCosts: number; // Custos ainda previstos para conclusão (€)
  estimatedTotalCost: number; // Custo total estimado = realizados + comprometidos + futuros sem duplicidade (€)
  cashBalance: number; // Saldo financeiro da obra = Recebimentos efetivos - Pagamentos efetivos (€)
  realizedResult: number; // Resultado realizado até o momento
  forecastResult: number; // Resultado previsto = Receita prevista - Custo total estimado (€)
  forecastMarginPct: number; // Margem prevista = (Resultado previsto / Receita prevista) * 100
  budgetConsumedPct: number; // % do orçamento de custos consumido (NÃO limitado a 100%)
  budgetCommittedPct: number; // % do orçamento considerando realizados + comprometidos
  budgetDeviation: number; // Desvio de orçamento (Custo total estimado - Orçamento de custos)
  financialHealth: 'saudavel' | 'atencao' | 'risco_elevado' | 'atingido' | 'ultrapassado';
}

export function computeSiteProfitability(
  site: ConstructionSite,
  allRecords: FinancialRecord[],
  measurements: SiteMeasurement[],
  configs: Record<string, SiteFinancialConfig>
): SiteProfitabilitySummary {
  const siteRecs = allRecords.filter((r) => r.site_id === site.id && r.status !== 'cancelado');
  const siteMeas = measurements.filter((m) => m.site_id === site.id);
  const cfg = configs[site.id];

  // Distinção rigorosa entre Valor Contratado com o Cliente e Orçamento Interno de Custos
  const baseSiteBudget = roundCents(Number(site.budget) || 0);
  const costBudget = roundCents(
    cfg?.cost_budget && cfg.cost_budget > 0
      ? cfg.cost_budget
      : site.cost_budget && site.cost_budget > 0
      ? site.cost_budget
      : baseSiteBudget
  );

  // Trabalhos adicionais aprovados nas medições somam ao valor contratual ajustado
  const approvedExtras = roundCents(
    siteMeas
      .filter((m) => m.kind === 'trabalho_adicional' && m.status !== 'rascunho')
      .reduce((acc, m) => addMoney(acc, m.approved_value || 0), 0)
  );

  const rawContracted = roundCents(
    cfg?.contracted_value && cfg.contracted_value > 0
      ? cfg.contracted_value
      : site.contracted_value && site.contracted_value > 0
      ? site.contracted_value
      : baseSiteBudget
  );

  const contractedValue = addMoney(rawContracted, approvedExtras);

  // Receitas recebidas e pendentes da obra
  const incomeRecs = siteRecs.filter((r) => r.type === 'receita');
  const receivedRevenue = roundCents(
    incomeRecs.reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0)
  );
  const pendingRevenueFromRecords = roundCents(
    incomeRecs.reduce((acc, r) => addMoney(acc, getEffectiveRemainingAmount(r)), 0)
  );

  const approvedMeasurementsTotal = roundCents(
    siteMeas
      .filter((m) => m.status !== 'rascunho')
      .reduce((acc, m) => addMoney(acc, m.approved_value || 0), 0)
  );

  // Receita prevista ajustada: o maior entre o valor contratado ajustado e o total já contratado/lançado
  const totalLaunchedRevenue = addMoney(receivedRevenue, pendingRevenueFromRecords);
  const expectedTotalRevenue = roundCents(
    Math.max(contractedValue, totalLaunchedRevenue, approvedMeasurementsTotal)
  );

  // Receita pendente a receber considerando o contrato e lançamentos em aberto
  const pendingRevenue = roundCents(
    Math.max(pendingRevenueFromRecords, subMoney(expectedTotalRevenue, receivedRevenue))
  );

  // Custos: somente registos do tipo 'despesa' (nunca mistura receitas na categoria 'outros')
  const expenseRecs = siteRecs.filter((r) => r.type === 'despesa');
  const realizedCosts = roundCents(
    expenseRecs.reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0)
  );

  // Custos comprometidos: parcelas/contas de despesa já lançadas como pendentes ou parciais
  const committedCosts = roundCents(
    expenseRecs.reduce((acc, r) => addMoney(acc, getEffectiveRemainingAmount(r)), 0)
  );

  // Custos futuros ainda previstos (sem duplicar o que já foi realizado ou comprometido)
  const alreadyAccountedCosts = addMoney(realizedCosts, committedCosts);
  const manualAdditionalForecast = roundCents(Number(cfg?.additional_forecast_cost || 0));
  const remainingFromBudget = roundCents(Math.max(0, subMoney(costBudget, alreadyAccountedCosts)));
  const additionalForecastCosts =
    manualAdditionalForecast > 0 ? manualAdditionalForecast : remainingFromBudget;

  // Custo total estimado = custos realizados + custos comprometidos + custos ainda previstos
  const estimatedTotalCost = addMoney(alreadyAccountedCosts, additionalForecastCosts);

  // Saldo financeiro da obra (Caixa da obra) = Recebimentos efetivos - Pagamentos efetivos
  const cashBalance = subMoney(receivedRevenue, realizedCosts);

  // Resultado realizado e Resultado previsto
  const realizedResult = subMoney(receivedRevenue, realizedCosts);
  const forecastResult = subMoney(expectedTotalRevenue, estimatedTotalCost);

  // Margem prevista = (Resultado previsto / Receita prevista) * 100
  const forecastMarginPct =
    expectedTotalRevenue > 0 ? roundCents((forecastResult / expectedTotalRevenue) * 100) : 0;

  // Percentual do orçamento consumido (NÃO limitado a 100% — ex: 125% se ultrapassou)
  const budgetConsumedPct =
    costBudget > 0 ? roundCents((realizedCosts / costBudget) * 100) : 0;
  const budgetCommittedPct =
    costBudget > 0 ? roundCents((alreadyAccountedCosts / costBudget) * 100) : 0;

  const budgetDeviation = subMoney(alreadyAccountedCosts, costBudget);

  let financialHealth: SiteProfitabilitySummary['financialHealth'] = 'saudavel';
  const refPct = Math.max(budgetConsumedPct, budgetCommittedPct);
  if (refPct > 100) {
    financialHealth = 'ultrapassado';
  } else if (refPct >= 100) {
    financialHealth = 'atingido';
  } else if (refPct >= 90) {
    financialHealth = 'risco_elevado';
  } else if (refPct >= 80) {
    financialHealth = 'atencao';
  }

  return {
    site,
    contractedValue,
    costBudget,
    receivedRevenue,
    pendingRevenue,
    approvedMeasurementsTotal,
    expectedTotalRevenue,
    realizedCosts,
    committedCosts,
    additionalForecastCosts,
    estimatedTotalCost,
    cashBalance,
    realizedResult,
    forecastResult,
    forecastMarginPct,
    budgetConsumedPct,
    budgetCommittedPct,
    budgetDeviation,
    financialHealth,
  };
}

// ============================================================================
// ALERTAS FINANCEIROS AUTOMÁTICOS BASEADOS EM REGRAS REAIS
// ============================================================================
export interface FinancialAlertItem {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  category:
    | 'conta_vencida'
    | 'vencimento_proximo'
    | 'orcamento_ultrapassado'
    | 'orcamento_proximo'
    | 'saldo_negativo'
    | 'despesa_extraordinaria';
  title: string;
  description: string;
  amount?: number;
  recordId?: string;
  siteId?: string;
  targetTab: 'visao_geral' | 'movimentacoes' | 'contas' | 'rentabilidade' | 'medicoes';
}

export function generateFinancialAlerts(
  records: FinancialRecord[],
  sitesProfitability: SiteProfitabilitySummary[],
  overview: OverviewMetrics
): FinancialAlertItem[] {
  const alerts: FinancialAlertItem[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const in7DaysStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const activeRecords = records.filter((r) => r.status !== 'cancelado');

  // 1. Contas vencidas (A pagar e A receber)
  activeRecords.forEach((r) => {
    const rem = getEffectiveRemainingAmount(r);
    if (rem > 0 && r.due_date && r.due_date < todayStr) {
      const isPayable = r.type === 'despesa';
      alerts.push({
        id: `overdue-${r.id}`,
        severity: 'danger',
        category: 'conta_vencida',
        title: `${isPayable ? 'Pagamento em atraso' : 'Recebimento em atraso'}: ${r.title}`,
        description: `Venceu em ${formatDatePt(r.due_date)} • Restante: ${formatEuro(rem, true)}${r.site_name ? ` • Obra: ${r.site_name}` : ''}`,
        amount: rem,
        recordId: r.id,
        siteId: r.site_id || undefined,
        targetTab: 'contas',
      });
    }
  });

  // 2. Contas próximas do vencimento (próximos 7 dias)
  activeRecords.forEach((r) => {
    const rem = getEffectiveRemainingAmount(r);
    if (rem > 0 && r.due_date && r.due_date >= todayStr && r.due_date <= in7DaysStr) {
      const isPayable = r.type === 'despesa';
      alerts.push({
        id: `upcoming-${r.id}`,
        severity: 'warning',
        category: 'vencimento_proximo',
        title: `${isPayable ? 'Conta a vencer em breve' : 'Recebimento previsto'}: ${r.title}`,
        description: `Vencimento em ${formatDatePt(r.due_date)} • Valor: ${formatEuro(rem, true)}${r.site_name ? ` • Obra: ${r.site_name}` : ''}`,
        amount: rem,
        recordId: r.id,
        siteId: r.site_id || undefined,
        targetTab: 'contas',
      });
    }
  });

  // 3. Obras que ultrapassaram o orçamento ou estão próximas (80% / 90% / 100%+)
  sitesProfitability.forEach((sp) => {
    if (sp.costBudget <= 0) return;
    const pct = Math.max(sp.budgetConsumedPct, sp.budgetCommittedPct);
    if (pct > 100) {
      alerts.push({
        id: `budget-over-${sp.site.id}`,
        severity: 'danger',
        category: 'orcamento_ultrapassado',
        title: `Orçamento ultrapassado (${pct.toFixed(1)}%): ${sp.site.name}`,
        description: `Orçamento: ${formatEuro(sp.costBudget)} • Realizado + Comprometido: ${formatEuro(addMoney(sp.realizedCosts, sp.committedCosts))}`,
        amount: sp.budgetDeviation,
        siteId: sp.site.id,
        targetTab: 'rentabilidade',
      });
    } else if (pct >= 80) {
      alerts.push({
        id: `budget-warn-${sp.site.id}`,
        severity: 'warning',
        category: 'orcamento_proximo',
        title: `${pct >= 90 ? 'Risco elevado de orçamento' : 'Atenção ao orçamento'} (${pct.toFixed(1)}%): ${sp.site.name}`,
        description: `Já consumiu/comprometeu ${formatEuro(addMoney(sp.realizedCosts, sp.committedCosts))} de ${formatEuro(sp.costBudget)}`,
        siteId: sp.site.id,
        targetTab: 'rentabilidade',
      });
    }
  });

  // 4. Previsão de saldo negativo
  if (overview.forecastBalance < 0) {
    alerts.push({
      id: 'forecast-negative',
      severity: 'danger',
      category: 'saldo_negativo',
      title: 'Previsão de Saldo de Caixa Negativo',
      description: `O saldo projetado após liquidar contas a pagar e a receber é de ${formatEuro(overview.forecastBalance, true)}.`,
      amount: Math.abs(overview.forecastBalance),
      targetTab: 'contas',
    });
  }

  // 5. Despesas extraordinariamente elevadas (acima de 2,5x a média das despesas, quando houver >= 4 despesas)
  const expenses = activeRecords.filter((r) => r.type === 'despesa' && r.amount > 0);
  if (expenses.length >= 4) {
    const avgExpense =
      expenses.reduce((acc, r) => acc + r.amount, 0) / expenses.length;
    const threshold = Math.max(2500, avgExpense * 2.5);
    expenses
      .filter((r) => r.amount >= threshold)
      .slice(0, 3)
      .forEach((r) => {
        alerts.push({
          id: `outlier-${r.id}`,
          severity: 'info',
          category: 'despesa_extraordinaria',
          title: `Despesa elevada detetada: ${r.title}`,
          description: `Valor de ${formatEuro(r.amount, true)} é significativamente superior à média de despesas (${formatEuro(avgExpense)}).`,
          amount: r.amount,
          recordId: r.id,
          siteId: r.site_id || undefined,
          targetTab: 'movimentacoes',
        });
      });
  }

  return alerts;
}

// ============================================================================
// INTEGRAÇÃO COM OUTROS MÓDULOS (PONTO/MÃO DE OBRA, MATERIAIS, EQUIPAMENTOS)
// ============================================================================
export interface UnaccountedLaborCostItem {
  key: string;
  siteId: string;
  siteName: string;
  employeeId?: string;
  employeeName: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  hourlyRate: number;
  socialChargesPct: number;
  calculatedCost: number;
  periodStart: string;
  periodEnd: string;
  sourceType: 'ponto_validado' | 'sessao_equipa';
}

export function calculateUnaccountedLaborCosts(params: {
  entries: TimeEntry[];
  workSessions: SiteWorkSession[];
  employees: EmployeeProfile[];
  sites: ConstructionSite[];
  existingRecords: FinancialRecord[];
  socialChargesPct?: number;
}): UnaccountedLaborCostItem[] {
  const { entries, workSessions, employees, sites, existingRecords, socialChargesPct = 23.75 } = params;
  const results: UnaccountedLaborCostItem[] = [];

  // Evita duplicidade verificando chaves já lançadas no financeiro (source_module = 'mao_de_obra')
  const syncedIds = new Set(
    existingRecords
      .filter((r) => r.status !== 'cancelado' && (r.source_module === 'mao_de_obra' || r.category === 'custo_mao_de_obra'))
      .map((r) => r.source_id || '')
      .filter(Boolean)
  );

  // 1. Cálculo a partir de picagens de ponto validadas ('aprovado') agrupadas por colaborador + obra + mês
  const approvedEntries = entries.filter((e) => e.status === 'aprovado' && e.site_id);
  const byDayEmpSite = new Map<string, TimeEntry[]>();

  approvedEntries.forEach((e) => {
    const k = `${e.employee_id}__${e.site_id}__${e.work_date}`;
    const list = byDayEmpSite.get(k) || [];
    list.push(e);
    byDayEmpSite.set(k, list);
  });

  const byMonthEmpSite = new Map<
    string,
    {
      employeeId: string;
      siteId: string;
      monthKey: string;
      regularHours: number;
      overtimeHours: number;
      minDate: string;
      maxDate: string;
    }
  >();

  byDayEmpSite.forEach((dayEntries, key) => {
    const [employeeId, siteId, workDate] = key.split('__');
    const monthKey = workDate.slice(0, 7);
    const groupKey = `labor-ponto-${employeeId}-${siteId}-${monthKey}`;
    if (syncedIds.has(groupKey)) return;

    const sorted = [...dayEntries].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    const firstIn = sorted.find((x) => x.entry_type === 'entrada');
    const lastOut = [...sorted].reverse().find((x) => x.entry_type === 'saida');
    const hasLunch = sorted.some((x) => x.entry_type === 'almoco');

    let dayHours = 8;
    if (firstIn && lastOut) {
      const diffH =
        (new Date(lastOut.recorded_at).getTime() - new Date(firstIn.recorded_at).getTime()) /
        3600000;
      if (diffH > 0 && diffH <= 16) {
        dayHours = Math.max(1, diffH - (hasLunch && diffH > 5 ? 1 : 0));
      }
    }

    const regH = Math.min(8, dayHours);
    const overH = Math.max(0, dayHours - 8);

    const existing = byMonthEmpSite.get(groupKey) || {
      employeeId,
      siteId,
      monthKey,
      regularHours: 0,
      overtimeHours: 0,
      minDate: workDate,
      maxDate: workDate,
    };
    existing.regularHours = roundCents(existing.regularHours + regH);
    existing.overtimeHours = roundCents(existing.overtimeHours + overH);
    if (workDate < existing.minDate) existing.minDate = workDate;
    if (workDate > existing.maxDate) existing.maxDate = workDate;
    byMonthEmpSite.set(groupKey, existing);
  });

  byMonthEmpSite.forEach((grp, groupKey) => {
    const emp = employees.find((e) => e.id === grp.employeeId);
    const site = sites.find((s) => s.id === grp.siteId);
    if (!emp || !site) return;

    const rate = Number(emp.hourly_rate) || 12;
    const basePay = grp.regularHours * rate + grp.overtimeHours * rate * 1.5;
    const withCharges = roundCents(basePay * (1 + socialChargesPct / 100));

    if (withCharges > 0) {
      results.push({
        key: groupKey,
        siteId: site.id,
        siteName: site.name,
        employeeId: emp.id,
        employeeName: emp.full_name,
        regularHours: grp.regularHours,
        overtimeHours: grp.overtimeHours,
        totalHours: roundCents(grp.regularHours + grp.overtimeHours),
        hourlyRate: rate,
        socialChargesPct,
        calculatedCost: withCharges,
        periodStart: grp.minDate,
        periodEnd: grp.maxDate,
        sourceType: 'ponto_validado',
      });
    }
  });

  // 2. Sessões de equipas em obra ainda não convertidas em custo financeiro
  workSessions.forEach((ws) => {
    const wsKey = `labor-session-${ws.id}`;
    if (syncedIds.has(wsKey)) return;
    const site = sites.find((s) => s.id === ws.site_id);
    if (!site || ws.hours_worked <= 0) return;

    const leader = employees.find((e) => e.id === ws.leader_id);
    const avgRate = Number(leader?.hourly_rate) || 14;
    const totalWorkerHours = roundCents(ws.hours_worked * Math.max(1, ws.workers_count || 1));
    const baseCost = totalWorkerHours * avgRate;
    const totalCost = roundCents(baseCost * (1 + socialChargesPct / 100));

    results.push({
      key: wsKey,
      siteId: site.id,
      siteName: site.name,
      employeeId: ws.leader_id || undefined,
      employeeName: `${ws.team_name} (${ws.workers_count} trab.)`,
      regularHours: totalWorkerHours,
      overtimeHours: 0,
      totalHours: totalWorkerHours,
      hourlyRate: avgRate,
      socialChargesPct,
      calculatedCost: totalCost,
      periodStart: ws.work_date,
      periodEnd: ws.work_date,
      sourceType: 'sessao_equipa',
    });
  });

  return results;
}

export interface UnaccountedMaterialOrEquipmentItem {
  key: string;
  sourceModule: 'compra_material' | 'equipamento_manutencao';
  sourceId: string;
  title: string;
  category: FinancialCategory;
  subcategory: string;
  siteId: string | null;
  siteName: string | null;
  entityName: string | null;
  amount: number;
  date: string;
}

export function findUnaccountedMaterialsAndEquipment(params: {
  inventoryItems: InventoryItem[];
  maintenanceRecords: VehicleMaintenanceRecord[];
  sites: ConstructionSite[];
  existingRecords: FinancialRecord[];
}): UnaccountedMaterialOrEquipmentItem[] {
  const { inventoryItems, maintenanceRecords, sites, existingRecords } = params;
  const list: UnaccountedMaterialOrEquipmentItem[] = [];

  const syncedSourceIds = new Set(
    existingRecords
      .filter((r) => r.status !== 'cancelado' && r.source_id)
      .map((r) => r.source_id!)
  );

  // Materiais/equipamentos com valor unitário alocados a obra e ainda sem lançamento financeiro correspondente
  inventoryItems.forEach((item) => {
    const sourceKey = `inv-cost-${item.id}`;
    if (syncedSourceIds.has(sourceKey)) return;
    const unitPrice = Number(item.unit_price || 0);
    const qty = Number(item.allocated_quantity || item.total_quantity || 0);
    if (unitPrice <= 0 || qty <= 0) return;

    const totalVal = roundCents(unitPrice * qty);
    const isEquip = item.category === 'maquinas_equipamentos' || item.category === 'ferramentas';
    const isEpi = item.category === 'seguranca_epis';

    list.push({
      key: sourceKey,
      sourceModule: 'compra_material',
      sourceId: sourceKey,
      title: `Aquisição / Alocação: ${item.name} (${qty} un.)`,
      category: isEpi ? 'seguranca_epis' : isEquip ? 'custo_equipamentos' : 'custo_materiais',
      subcategory: isEquip ? 'Aquisição de ferramentas' : 'Betão e argamassas',
      siteId: item.allocated_site_id || null,
      siteName: item.allocated_site_name || null,
      entityName: item.supplier || null,
      amount: totalVal,
      date: item.updated_at || item.created_at || new Date().toISOString().slice(0, 10),
    });
  });

  // Manutenções de viaturas/equipamentos com custo registado e ainda não refletidas no financeiro
  maintenanceRecords.forEach((m) => {
    const sourceKey = `veh-maint-${m.id}`;
    if (syncedSourceIds.has(sourceKey)) return;
    const cost = roundCents(Number(m.cost || 0));
    if (cost <= 0) return;

    const firstSite = sites[0];
    list.push({
      key: sourceKey,
      sourceModule: 'equipamento_manutencao',
      sourceId: sourceKey,
      title: `Manutenção de Frota/Equipamento: ${m.title}`,
      category: 'transporte_logistica',
      subcategory: 'Manutenção de carrinhas',
      siteId: firstSite?.id || null,
      siteName: firstSite?.name || null,
      entityName: m.service_provider || 'Oficina Mecânica',
      amount: cost,
      date: m.performed_at || new Date().toISOString().slice(0, 10),
    });
  });

  return list;
}
