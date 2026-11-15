import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpDown,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  DollarSign,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import {
  Company,
  ConstructionSite,
  EmployeeProfile,
  FinancialCategory,
  FinancialEntityType,
  FinancialRecord,
  FinancialStatus,
  FinancialType,
  InventoryItem,
  MeasurementKind,
  MeasurementStatus,
  PaymentMethod,
  SiteFinancialConfig,
  SiteMeasurement,
  SiteWorkSession,
  TimeEntry,
  VehicleMaintenanceRecord,
} from '../types';
import {
  deleteFinancialRecord,
  deleteSiteMeasurement,
  getInventoryItems,
  getSiteFinancialConfigs,
  getSiteMeasurements,
  getSiteWorkSessions,
  getVehicleMaintenanceRecords,
  getVehicles,
  registerPartialPayment,
  saveFinancialRecord,
  saveSite,
  saveSiteFinancialConfig,
  saveSiteMeasurement,
  updateFinancialStatus,
} from '../lib/supabase';
import {
  EXPENSE_CATEGORIES,
  FinancialAlertItem,
  INCOME_CATEGORIES,
  PeriodPreset,
  UnaccountedLaborCostItem,
  UnaccountedMaterialOrEquipmentItem,
  addMoney,
  calculateUnaccountedLaborCosts,
  computeOverviewMetrics,
  computeSiteProfitability,
  findUnaccountedMaterialsAndEquipment,
  formatDatePt,
  formatEuro,
  generateFinancialAlerts,
  getCategoryDefinition,
  getEffectivePaidAmount,
  getEffectiveRemainingAmount,
  isRecordInDateRange,
  resolvePeriodRange,
  roundCents,
  subMoney,
} from '../lib/financialCalculations';
import {
  ExportFormat,
  FinancialReportType,
  exportFinancialReport,
} from '../lib/financialReports';
import { CashFlowChart } from '../components/CashFlowChart';
import { FinancialOverviewCharts } from '../components/FinancialOverviewCharts';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { customAlert, customConfirm } from '../context/DialogContext';

export interface FinancialPageProps {
  company: Company;
  sites: ConstructionSite[];
  records: FinancialRecord[];
  employees?: EmployeeProfile[];
  entries?: TimeEntry[];
  onRefresh: () => void;
  showNotice: (msg: string) => void;
  onOpenSite?: (site: ConstructionSite) => void;
}

type FinancialTab = 'visao_geral' | 'movimentacoes' | 'contas' | 'rentabilidade' | 'medicoes';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia: 'Transferência Bancária',
  mbway: 'MB Way',
  multibanco: 'Referência Multibanco',
  cartao: 'Cartão de Débito / Crédito',
  cheque: 'Cheque Bancário',
  numerario: 'Numerário (Caixa)',
  outro: 'Outro Método / Débito Direto',
};

const MEASUREMENT_STATUS_MAP: Record<
  MeasurementStatus,
  { label: string; color: string; bg: string }
> = {
  rascunho: { label: 'Rascunho', color: '#64748B', bg: 'rgba(100,116,139,0.14)' },
  submetida: { label: 'Submetida ao Cliente', color: '#2563EB', bg: 'rgba(37,99,235,0.14)' },
  aprovada: { label: 'Aprovada', color: '#0D9488', bg: 'rgba(13,148,136,0.14)' },
  parcialmente_aprovada: {
    label: 'Parcialmente Aprovada',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.14)',
  },
  faturada: { label: 'Faturada', color: '#7C3AED', bg: 'rgba(124,58,237,0.14)' },
  parcialmente_recebida: {
    label: 'Parcialmente Recebida',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.14)',
  },
  recebida: { label: 'Recebida Integralmente', color: '#10B981', bg: 'rgba(16,185,129,0.14)' },
};

const WEEKDAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function FinancialPage({
  company,
  sites,
  records,
  employees = [],
  entries = [],
  onRefresh,
  showNotice,
  onOpenSite,
}: FinancialPageProps) {
  // ==========================================================================
  // NAVEGAÇÃO PRINCIPAL (5 ABAS) E FILTROS GLOBAIS
  // ==========================================================================
  const [activeTab, setActiveTab] = useState<FinancialTab>('visao_geral');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('todos');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('todo_periodo');
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Dados complementares carregados de outros módulos
  const [measurements, setMeasurements] = useState<SiteMeasurement[]>([]);
  const [siteConfigs, setSiteConfigs] = useState<Record<string, SiteFinancialConfig>>(() =>
    getSiteFinancialConfigs(company.id)
  );
  const [workSessions, setWorkSessions] = useState<SiteWorkSession[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<VehicleMaintenanceRecord[]>([]);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const loadAuxiliaryFinancialData = async () => {
    try {
      const [meas, inv, vehs] = await Promise.all([
        getSiteMeasurements(company.id),
        getInventoryItems(company.id),
        getVehicles(company.id),
      ]);
      setMeasurements(meas);
      setInventoryItems(inv);
      setSiteConfigs(getSiteFinancialConfigs(company.id));

      const sessLists = await Promise.all(sites.map((s) => getSiteWorkSessions(s.id)));
      setWorkSessions(sessLists.flat());

      const maintLists = await Promise.all(vehs.map((v) => getVehicleMaintenanceRecords(v.id)));
      setMaintenanceRecords(maintLists.flat());
    } catch (err) {
      console.warn('Aviso ao carregar dados auxiliares financeiros:', err);
    }
  };

  useEffect(() => {
    loadAuxiliaryFinancialData();
  }, [company.id, sites.length, records.length]);

  // Intervalo de datas ativo
  const periodRange = useMemo(
    () => resolvePeriodRange(periodPreset, customStartDate, customEndDate),
    [periodPreset, customStartDate, customEndDate]
  );

  // ==========================================================================
  // CÁLCULOS PRINCIPAIS E ALERTAS
  // ==========================================================================
  const overviewMetrics = useMemo(
    () => computeOverviewMetrics(records, selectedSiteId, periodRange),
    [records, selectedSiteId, periodRange]
  );

  const sitesProfitability = useMemo(
    () =>
      sites.map((site) =>
        computeSiteProfitability(site, records, measurements, siteConfigs)
      ),
    [sites, records, measurements, siteConfigs]
  );

  const scopedRecordsInPeriod = useMemo(() => {
    return records.filter((r) => {
      if (r.status === 'cancelado') return false;
      if (selectedSiteId !== 'todos' && r.site_id !== selectedSiteId) return false;
      return isRecordInDateRange(r, periodRange.start, periodRange.end, true);
    });
  }, [records, selectedSiteId, periodRange]);

  const financialAlerts = useMemo(
    () =>
      generateFinancialAlerts(
        selectedSiteId === 'todos'
          ? records
          : records.filter((r) => r.site_id === selectedSiteId),
        selectedSiteId === 'todos'
          ? sitesProfitability
          : sitesProfitability.filter((sp) => sp.site.id === selectedSiteId),
        overviewMetrics
      ),
    [records, selectedSiteId, sitesProfitability, overviewMetrics]
  );

  // Custos operacionais pendentes de sincronização (Mão de Obra, Materiais, Equipamentos)
  const unaccountedLabor = useMemo(
    () =>
      calculateUnaccountedLaborCosts({
        entries,
        workSessions,
        employees,
        sites,
        existingRecords: records,
        socialChargesPct: 23.75,
      }),
    [entries, workSessions, employees, sites, records]
  );

  const unaccountedMatEquip = useMemo(
    () =>
      findUnaccountedMaterialsAndEquipment({
        inventoryItems,
        maintenanceRecords,
        sites,
        existingRecords: records,
      }),
    [inventoryItems, maintenanceRecords, sites, records]
  );

  const totalPendingOperationalSync = unaccountedLabor.length + unaccountedMatEquip.length;

  // ==========================================================================
  // FILTROS E ORDENAÇÃO DA ABA 2 — MOVIMENTAÇÕES
  // ==========================================================================
  const [movSearch, setMovSearch] = useState('');
  const [movTypeFilter, setMovTypeFilter] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [movCategoryFilter, setMovCategoryFilter] = useState<string>('todas');
  const [movStatusFilter, setMovStatusFilter] = useState<'todos' | FinancialStatus>('todos');
  const [movEntityFilter, setMovEntityFilter] = useState<string>('');
  const [movMinAmount, setMovMinAmount] = useState<string>('');
  const [movMaxAmount, setMovMaxAmount] = useState<string>('');
  const [movSortBy, setMovSortBy] = useState<
    'due_desc' | 'due_asc' | 'amount_desc' | 'amount_asc' | 'paid_desc'
  >('due_desc');
  const [movPage, setMovPage] = useState(1);
  const MOV_PAGE_SIZE = 15;

  const clearMovFilters = () => {
    setMovSearch('');
    setMovTypeFilter('todos');
    setMovCategoryFilter('todas');
    setMovStatusFilter('todos');
    setMovEntityFilter('');
    setMovMinAmount('');
    setMovMaxAmount('');
    setMovSortBy('due_desc');
    setMovPage(1);
  };

  const filteredMovements = useMemo(() => {
    const minVal = movMinAmount !== '' ? parseFloat(movMinAmount) : null;
    const maxVal = movMaxAmount !== '' ? parseFloat(movMaxAmount) : null;
    const q = movSearch.trim().toLowerCase();
    const eq = movEntityFilter.trim().toLowerCase();

    const list = records.filter((r) => {
      if (selectedSiteId !== 'todos' && r.site_id !== selectedSiteId) return false;
      if (!isRecordInDateRange(r, periodRange.start, periodRange.end, false)) return false;
      if (movTypeFilter !== 'todos' && r.type !== movTypeFilter) return false;
      if (movCategoryFilter !== 'todas') {
        const def = getCategoryDefinition(r.category, r.type);
        if (r.category !== movCategoryFilter && def.id !== movCategoryFilter) return false;
      }
      if (movStatusFilter !== 'todos' && r.status !== movStatusFilter) return false;
      if (eq && !(r.entity_name || '').toLowerCase().includes(eq)) return false;
      if (minVal !== null && !isNaN(minVal) && r.amount < minVal) return false;
      if (maxVal !== null && !isNaN(maxVal) && r.amount > maxVal) return false;

      if (q) {
        const hay = [
          r.title,
          r.description || '',
          r.entity_name || '',
          r.site_name || '',
          r.subcategory || '',
          r.invoice_number || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (movSortBy === 'due_desc') return (b.due_date || '').localeCompare(a.due_date || '');
      if (movSortBy === 'due_asc') return (a.due_date || '').localeCompare(b.due_date || '');
      if (movSortBy === 'amount_desc') return b.amount - a.amount;
      if (movSortBy === 'amount_asc') return a.amount - b.amount;
      if (movSortBy === 'paid_desc') {
        return (b.payment_date || b.due_date || '').localeCompare(
          a.payment_date || a.due_date || ''
        );
      }
      return 0;
    });

    return list;
  }, [
    records,
    selectedSiteId,
    periodRange,
    movTypeFilter,
    movCategoryFilter,
    movStatusFilter,
    movEntityFilter,
    movMinAmount,
    movMaxAmount,
    movSearch,
    movSortBy,
  ]);

  const totalMovPages = Math.max(1, Math.ceil(filteredMovements.length / MOV_PAGE_SIZE));
  const paginatedMovements = useMemo(() => {
    const safePage = Math.min(movPage, totalMovPages);
    const start = (safePage - 1) * MOV_PAGE_SIZE;
    return filteredMovements.slice(start, start + MOV_PAGE_SIZE);
  }, [filteredMovements, movPage, totalMovPages]);

  // ==========================================================================
  // ESTADOS DA ABA 3 — CONTAS A PAGAR, A RECEBER E AGENDA FINANCEIRA
  // ==========================================================================
  const [accountsSubView, setAccountsSubView] = useState<'pagar' | 'receber' | 'agenda'>('pagar');
  const [agendaMonthDate, setAgendaMonthDate] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );

  const accountsSummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const in7Str = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const in30Str = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const base =
      selectedSiteId === 'todos'
        ? records.filter((r) => r.status !== 'cancelado')
        : records.filter((r) => r.site_id === selectedSiteId && r.status !== 'cancelado');

    const payables = base.filter(
      (r) => r.type === 'despesa' && getEffectiveRemainingAmount(r) > 0
    );
    const receivables = base.filter(
      (r) => r.type === 'receita' && getEffectiveRemainingAmount(r) > 0
    );

    const sumRem = (arr: FinancialRecord[]) =>
      roundCents(arr.reduce((s, r) => addMoney(s, getEffectiveRemainingAmount(r)), 0));

    const payablesOverdue = payables.filter((r) => r.due_date && r.due_date < todayStr);
    const payablesToday = payables.filter((r) => r.due_date === todayStr);
    const payablesNext7 = payables.filter(
      (r) => r.due_date && r.due_date >= todayStr && r.due_date <= in7Str
    );
    const payablesNext30 = payables.filter(
      (r) => r.due_date && r.due_date >= todayStr && r.due_date <= in30Str
    );

    const receivablesOverdue = receivables.filter((r) => r.due_date && r.due_date < todayStr);
    const receivablesUpcoming = receivables.filter((r) => !r.due_date || r.due_date >= todayStr);

    const lateClientsSet = new Set(
      receivablesOverdue.map((r) => r.entity_name || r.site_name || 'Cliente não especificado')
    );

    return {
      payables,
      payablesTotal: sumRem(payables),
      payablesOverdueTotal: sumRem(payablesOverdue),
      payablesOverdueCount: payablesOverdue.length,
      payablesTodayTotal: sumRem(payablesToday),
      payablesTodayCount: payablesToday.length,
      payablesNext7Total: sumRem(payablesNext7),
      payablesNext30Total: sumRem(payablesNext30),
      receivables,
      receivablesTotal: sumRem(receivables),
      receivablesOverdueTotal: sumRem(receivablesOverdue),
      receivablesOverdueCount: receivablesOverdue.length,
      receivablesUpcomingTotal: sumRem(receivablesUpcoming),
      lateClients: Array.from(lateClientsSet),
    };
  }, [records, selectedSiteId]);

  // ==========================================================================
  // ESTADOS DA ABA 4 — RENTABILIDADE DAS OBRAS
  // ==========================================================================
  const [profitSortBy, setProfitSortBy] = useState<
    'mais_rentaveis' | 'menos_rentaveis' | 'maiores_desvios'
  >('mais_rentaveis');

  const sortedProfitability = useMemo(() => {
    const list =
      selectedSiteId === 'todos'
        ? [...sitesProfitability]
        : sitesProfitability.filter((sp) => sp.site.id === selectedSiteId);

    list.sort((a, b) => {
      if (profitSortBy === 'mais_rentaveis') return b.forecastResult - a.forecastResult;
      if (profitSortBy === 'menos_rentaveis') return a.forecastResult - b.forecastResult;
      if (profitSortBy === 'maiores_desvios') return b.budgetCommittedPct - a.budgetCommittedPct;
      return 0;
    });
    return list;
  }, [sitesProfitability, selectedSiteId, profitSortBy]);

  // ==========================================================================
  // MODAL 1: CRIAR / EDITAR MOVIMENTAÇÃO FINANCEIRA
  // ==========================================================================
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [savingRecord, setSavingRecord] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [formType, setFormType] = useState<FinancialType>('despesa');
  const [formCategory, setFormCategory] = useState<FinancialCategory>('custo_materiais');
  const [formSubcategory, setFormSubcategory] = useState<string>('');
  const [formTitle, setFormTitle] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formEntityType, setFormEntityType] = useState<FinancialEntityType>('fornecedor');
  const [formEntity, setFormEntity] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formPaidAmount, setFormPaidAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [formPaymentDate, setFormPaymentDate] = useState('');
  const [formStatus, setFormStatus] = useState<FinancialStatus>('pendente');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formMeasurementId, setFormMeasurementId] = useState('');
  const [formReceiptUrl, setFormReceiptUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const activeCategoryChoices = useMemo(
    () => (formType === 'receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    [formType]
  );

  const selectedCategoryDef = useMemo(
    () => getCategoryDefinition(formCategory, formType),
    [formCategory, formType]
  );

  const handleOpenAdd = (type: FinancialType = 'despesa', presetSiteId?: string) => {
    const defaultCat = type === 'receita' ? 'receita_medicao' : 'custo_materiais';
    const catDef = getCategoryDefinition(defaultCat, type);
    const todayIso = new Date().toISOString().slice(0, 10);

    setEditingRecord(null);
    setFormType(type);
    setFormCategory(defaultCat);
    setFormSubcategory(catDef.subcategories[0] || '');
    setFormTitle('');
    setFormSiteId(
      presetSiteId !== undefined
        ? presetSiteId
        : selectedSiteId !== 'todos'
        ? selectedSiteId
        : ''
    );
    setFormEntityType(type === 'receita' ? 'cliente' : 'fornecedor');
    setFormEntity('');
    setFormAmount('');
    setFormPaidAmount('0');
    setFormDueDate(todayIso);
    setFormPaymentDate(todayIso);
    setFormStatus('pendente');
    setFormPaymentMethod('transferencia');
    setFormInvoiceNumber('');
    setFormMeasurementId('');
    setFormReceiptUrl('');
    setFormNotes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (rec: FinancialRecord) => {
    const catDef = getCategoryDefinition(rec.category, rec.type);
    setEditingRecord(rec);
    setFormType(rec.type);
    setFormCategory(catDef.id);
    setFormSubcategory(rec.subcategory || catDef.subcategories[0] || '');
    setFormTitle(rec.title);
    setFormSiteId(rec.site_id || '');
    setFormEntityType(
      rec.entity_type || (rec.type === 'receita' ? 'cliente' : 'fornecedor')
    );
    setFormEntity(rec.entity_name || '');
    setFormAmount(String(rec.amount));
    setFormPaidAmount(String(getEffectivePaidAmount(rec)));
    setFormDueDate(rec.due_date || new Date().toISOString().slice(0, 10));
    // Preserva a data original de pagamento!
    setFormPaymentDate(
      rec.payment_date || rec.due_date || new Date().toISOString().slice(0, 10)
    );
    setFormStatus(rec.status);
    setFormPaymentMethod((rec.payment_method as PaymentMethod) || 'transferencia');
    setFormInvoiceNumber(rec.invoice_number || '');
    setFormMeasurementId(rec.measurement_id || '');
    setFormReceiptUrl(rec.receipt_url || '');
    setFormNotes(rec.description || '');
    setModalOpen(true);
  };

  const handleReceiptFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccessUrl: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const url = await uploadImageToCloudinary(base64, 'castello_receipts');
          onSuccessUrl(url);
          showNotice('Comprovativo anexado com sucesso!');
        } catch {
          onSuccessUrl(base64);
          showNotice('Comprovativo anexado localmente!');
        } finally {
          setUploadingReceipt(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingReceipt(false);
      await customAlert({
        title: 'Erro no Upload',
        message: 'Não foi possível processar o ficheiro selecionado.',
        type: 'error',
      });
    }
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      await customAlert({
        title: 'Descrição Obrigatória',
        message: 'Por favor, informe a descrição desta movimentação financeira.',
        type: 'warning',
      });
      return;
    }
    const val = roundCents(parseFloat(formAmount));
    if (!val || val <= 0) {
      await customAlert({
        title: 'Valor Inválido',
        message: 'Por favor, introduza um valor monetário superior a 0,00 €.',
        type: 'warning',
      });
      return;
    }

    let resolvedPaidAmount = 0;
    if (formStatus === 'pago') {
      resolvedPaidAmount = val;
    } else if (formStatus === 'parcial') {
      resolvedPaidAmount = roundCents(parseFloat(formPaidAmount) || 0);
      if (resolvedPaidAmount <= 0 || resolvedPaidAmount >= val) {
        await customAlert({
          title: 'Valor Parcial Inválido',
          message:
            'No estado Parcial, o valor pago/recebido deve ser maior que 0,00 € e menor que o valor total do lançamento.',
          type: 'warning',
        });
        return;
      }
    }

    const matchedSite = sites.find((s) => s.id === formSiteId);
    const todayIso = new Date().toISOString().slice(0, 10);

    // Preserva a data original de pagamento ao editar se o utilizador não a alterou
    const effectivePaymentDate =
      formStatus === 'pago' || formStatus === 'parcial'
        ? formPaymentDate || editingRecord?.payment_date || todayIso
        : null;

    setSavingRecord(true);
    try {
      await saveFinancialRecord(
        {
          id: editingRecord ? editingRecord.id : undefined,
          type: formType,
          category: formCategory,
          subcategory: formSubcategory.trim() || null,
          title: formTitle.trim(),
          site_id: formSiteId || null,
          site_name: matchedSite ? matchedSite.name : null,
          entity_type: formEntityType,
          entity_name: formEntity.trim() || null,
          invoice_number: formInvoiceNumber.trim() || null,
          payment_method: formPaymentMethod,
          amount: val,
          paid_amount: resolvedPaidAmount,
          due_date: formDueDate,
          status: formStatus,
          payment_date: effectivePaymentDate,
          receipt_url: formReceiptUrl || null,
          measurement_id: formMeasurementId || null,
          description: formNotes.trim() || null,
          installments: editingRecord?.installments || [],
        },
        company.id
      );

      setModalOpen(false);
      await loadAuxiliaryFinancialData();
      onRefresh();
      showNotice(
        editingRecord
          ? 'Movimentação financeira atualizada com sucesso!'
          : formType === 'receita'
          ? 'Receita registada com sucesso!'
          : 'Despesa registada com sucesso!'
      );
    } catch (err: any) {
      await customAlert({
        title: 'Erro ao Guardar',
        message: 'Não foi possível guardar o registo: ' + (err.message || 'Tente novamente.'),
        type: 'error',
      });
    } finally {
      setSavingRecord(false);
    }
  };

  const handleToggleStatus = async (rec: FinancialRecord) => {
    const nextStatus: FinancialStatus = rec.status === 'pago' ? 'pendente' : 'pago';
    const actionLabel =
      nextStatus === 'pago'
        ? rec.type === 'receita'
          ? 'marcar como RECEBIDA integralmente'
          : 'marcar como PAGA integralmente'
        : 'reverter para PENDENTE';

    const confirmed = await customConfirm({
      title: nextStatus === 'pago' ? 'Confirmar Liquidação Total' : 'Reverter para Pendente',
      message: `Deseja ${actionLabel} o lançamento "${rec.title}" no valor de ${formatEuro(rec.amount, true)}?`,
      type: nextStatus === 'pago' ? 'confirm' : 'warning',
      confirmText: nextStatus === 'pago' ? 'Confirmar Liquidação' : 'Reverter Estado',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    setBusyActionId(rec.id);
    try {
      await updateFinancialStatus(
        rec.id,
        nextStatus,
        nextStatus === 'pago'
          ? rec.payment_date || new Date().toISOString().slice(0, 10)
          : undefined,
        company.id
      );
      await loadAuxiliaryFinancialData();
      onRefresh();
      showNotice(
        nextStatus === 'pago'
          ? 'Lançamento liquidado com sucesso!'
          : 'Lançamento revertido para pendente.'
      );
    } catch (err: any) {
      await customAlert({
        title: 'Erro ao Atualizar Estado',
        message: err.message || 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeleteRecord = async (rec: FinancialRecord) => {
    const confirmed = await customConfirm({
      title: 'Eliminar Movimentação Financeira',
      message: `Tem a certeza que deseja eliminar permanentemente "${rec.title}" (${formatEuro(rec.amount, true)})?`,
      type: 'danger',
      confirmText: 'Eliminar Registo',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    setBusyActionId(rec.id);
    try {
      await deleteFinancialRecord(rec.id, company.id);
      await loadAuxiliaryFinancialData();
      onRefresh();
      showNotice('Movimentação financeira eliminada.');
    } catch (err: any) {
      await customAlert({
        title: 'Erro ao Eliminar',
        message: err.message || 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  // ==========================================================================
  // MODAL 2: PAGAMENTO PARCIAL & HISTÓRICO DE PARCELAS
  // ==========================================================================
  const [partialModalRecord, setPartialModalRecord] = useState<FinancialRecord | null>(null);
  const [instAmount, setInstAmount] = useState('');
  const [instDate, setInstDate] = useState(new Date().toISOString().slice(0, 10));
  const [instMethod, setInstMethod] = useState<PaymentMethod>('transferencia');
  const [instRef, setInstRef] = useState('');
  const [instReceipt, setInstReceipt] = useState('');
  const [instNotes, setInstNotes] = useState('');
  const [savingPartial, setSavingPartial] = useState(false);

  const handleOpenPartialModal = (rec: FinancialRecord) => {
    const rem = getEffectiveRemainingAmount(rec);
    setPartialModalRecord(rec);
    setInstAmount(rem > 0 ? String(rem) : '');
    setInstDate(new Date().toISOString().slice(0, 10));
    setInstMethod((rec.payment_method as PaymentMethod) || 'transferencia');
    setInstRef('');
    setInstReceipt('');
    setInstNotes('');
  };

  const handleSavePartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialModalRecord) return;
    const val = roundCents(parseFloat(instAmount));
    const rem = getEffectiveRemainingAmount(partialModalRecord);
    if (!val || val <= 0 || val > rem + 0.01) {
      await customAlert({
        title: 'Valor Inválido',
        message: `Introduza um valor entre 0,01 € e o saldo restante de ${formatEuro(rem, true)}.`,
        type: 'warning',
      });
      return;
    }

    setSavingPartial(true);
    try {
      const updated = await registerPartialPayment({
        recordId: partialModalRecord.id,
        installmentAmount: val,
        paymentDate: instDate,
        paymentMethod: instMethod,
        reference: instRef.trim() || null,
        receiptUrl: instReceipt || null,
        notes: instNotes.trim() || null,
        companyId: company.id,
      });
      setPartialModalRecord(updated);
      await loadAuxiliaryFinancialData();
      onRefresh();
      showNotice(
        updated.status === 'pago'
          ? 'Última parcela registada! Conta liquidada na totalidade.'
          : `Parcela de ${formatEuro(val, true)} registada com sucesso!`
      );
      if (updated.status === 'pago') {
        setPartialModalRecord(null);
      } else {
        setInstAmount(String(getEffectiveRemainingAmount(updated)));
        setInstRef('');
        setInstNotes('');
      }
    } catch (err: any) {
      await customAlert({
        title: 'Erro ao Registar Parcela',
        message: err.message || 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingPartial(false);
    }
  };

  // ==========================================================================
  // MODAL 3: CONFIGURAÇÃO DE VALOR CONTRATADO VS ORÇAMENTO DE CUSTOS DA OBRA
  // ==========================================================================
  const [configSiteModal, setConfigSiteModal] = useState<ConstructionSite | null>(null);
  const [cfgContracted, setCfgContracted] = useState('');
  const [cfgCostBudget, setCfgCostBudget] = useState('');
  const [cfgAdditionalForecast, setCfgAdditionalForecast] = useState('');
  const [savingConfigSite, setSavingConfigSite] = useState(false);

  const handleOpenSiteConfig = (site: ConstructionSite) => {
    const summary = sitesProfitability.find((s) => s.site.id === site.id);
    const existingCfg = siteConfigs[site.id];
    setConfigSiteModal(site);
    setCfgContracted(
      String(
        existingCfg?.contracted_value ??
          site.contracted_value ??
          summary?.contractedValue ??
          site.budget ??
          0
      )
    );
    setCfgCostBudget(
      String(
        existingCfg?.cost_budget ??
          site.cost_budget ??
          summary?.costBudget ??
          site.budget ??
          0
      )
    );
    setCfgAdditionalForecast(String(existingCfg?.additional_forecast_cost ?? 0));
  };

  const handleSaveSiteConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configSiteModal) return;
    const contracted = roundCents(parseFloat(cfgContracted) || 0);
    const costBudget = roundCents(parseFloat(cfgCostBudget) || 0);
    const addForecast = roundCents(parseFloat(cfgAdditionalForecast) || 0);

    setSavingConfigSite(true);
    try {
      saveSiteFinancialConfig(
        {
          site_id: configSiteModal.id,
          contracted_value: contracted,
          cost_budget: costBudget,
          additional_forecast_cost: addForecast,
          social_charges_pct: 23.75,
          updated_at: new Date().toISOString().slice(0, 10),
        },
        company.id
      );

      // Atualiza também o orçamento base na obra caso tenha mudado
      try {
        await saveSite(
          {
            ...configSiteModal,
            budget: contracted > 0 ? contracted : costBudget,
          },
          company.id,
          true
        );
      } catch {}

      setSiteConfigs(getSiteFinancialConfigs(company.id));
      setConfigSiteModal(null);
      onRefresh();
      showNotice(`Parâmetros financeiros da obra "${configSiteModal.name}" atualizados!`);
    } catch (err: any) {
      await customAlert({
        title: 'Erro ao Guardar Parâmetros',
        message: err.message || 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingConfigSite(false);
    }
  };

  // ==========================================================================
  // MODAL 4: MEDIÇÕES DE OBRAS (AUTOS DE MEDIÇÃO)
  // ==========================================================================
  const [measModalOpen, setMeasModalOpen] = useState(false);
  const [editingMeas, setEditingMeas] = useState<SiteMeasurement | null>(null);
  const [savingMeas, setSavingMeas] = useState(false);

  const [mSiteId, setMSiteId] = useState('');
  const [mNumber, setMNumber] = useState('1');
  const [mKind, setMKind] = useState<MeasurementKind>('normal');
  const [mDescription, setMDescription] = useState('');
  const [mPeriodStart, setMPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [mPeriodEnd, setMPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [mMeasuredVal, setMMeasuredVal] = useState('');
  const [mApprovedVal, setMApprovedVal] = useState('');
  const [mApprovalDate, setMApprovalDate] = useState('');
  const [mRetentionPct, setMRetentionPct] = useState('5');
  const [mInvoicedVal, setMInvoicedVal] = useState('');
  const [mStatus, setMStatus] = useState<MeasurementStatus>('submetida');
  const [mNotes, setMNotes] = useState('');
  const [mAttachments, setMAttachments] = useState<string[]>([]);

  const handleOpenNewMeasurement = () => {
    const defaultSite =
      selectedSiteId !== 'todos'
        ? sites.find((s) => s.id === selectedSiteId) || sites[0]
        : sites[0];
    const sId = defaultSite?.id || '';
    const existingForSite = measurements.filter((m) => m.site_id === sId);
    const nextNum =
      existingForSite.length > 0
        ? Math.max(...existingForSite.map((m) => m.measurement_number || 0)) + 1
        : 1;
    const today = new Date().toISOString().slice(0, 10);

    setEditingMeas(null);
    setMSiteId(sId);
    setMNumber(String(nextNum));
    setMKind('normal');
    setMDescription(`Auto de Medição #${nextNum} — Execução Mensal`);
    setMPeriodStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
    setMPeriodEnd(today);
    setMMeasuredVal('');
    setMApprovedVal('');
    setMApprovalDate(today);
    setMRetentionPct('5');
    setMInvoicedVal('');
    setMStatus('submetida');
    setMNotes('');
    setMAttachments([]);
    setMeasModalOpen(true);
  };

  const handleOpenEditMeasurement = (m: SiteMeasurement) => {
    setEditingMeas(m);
    setMSiteId(m.site_id);
    setMNumber(String(m.measurement_number));
    setMKind(m.kind || 'normal');
    setMDescription(m.description);
    setMPeriodStart(m.period_start);
    setMPeriodEnd(m.period_end);
    setMMeasuredVal(String(m.measured_value));
    setMApprovedVal(String(m.approved_value));
    setMApprovalDate(m.approval_date || '');
    setMRetentionPct(String(m.retention_pct || 0));
    setMInvoicedVal(String(m.invoiced_value || 0));
    setMStatus(m.status);
    setMNotes(m.notes || '');
    setMAttachments(Array.isArray(m.attachments) ? m.attachments : []);
    setMeasModalOpen(true);
  };

  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mSiteId) {
      await customAlert({
        title: 'Selecione a Obra',
        message: 'É necessário associar a medição a uma obra.',
        type: 'warning',
      });
      return;
    }
    const measured = roundCents(parseFloat(mMeasuredVal) || 0);
    if (measured <= 0) {
      await customAlert({
        title: 'Valor Medido Inválido',
        message: 'Informe um valor medido superior a 0,00 €.',
        type: 'warning',
      });
      return;
    }
    const approved =
      mApprovedVal !== '' ? roundCents(parseFloat(mApprovedVal) || 0) : measured;
    const retPct = Math.max(0, Math.min(100, parseFloat(mRetentionPct) || 0));
    const retVal = roundCents((approved * retPct) / 100);
    const invoiced =
      mInvoicedVal !== ''
        ? roundCents(parseFloat(mInvoicedVal) || 0)
        : roundCents(Math.max(0, approved - retVal));

    const siteObj = sites.find((s) => s.id === mSiteId);

    setSavingMeas(true);
    try {
      await saveSiteMeasurement(
        {
          id: editingMeas?.id,
          company_id: company.id,
          site_id: mSiteId,
          site_name: siteObj?.name || null,
          client_name: siteObj?.client_name || null,
          measurement_number: parseInt(mNumber, 10) || 1,
          kind: mKind,
          description: mDescription.trim(),
          period_start: mPeriodStart,
          period_end: mPeriodEnd,
          measured_value: measured,
          approved_value: approved,
          approval_date: mApprovalDate || null,
          retention_pct: retPct,
          retention_value: retVal,
          invoiced_value: invoiced,
          received_value: editingMeas?.received_value || 0,
          status: mStatus,
          notes: mNotes.trim() || null,
          attachments: mAttachments,
          linked_record_ids: editingMeas?.linked_record_ids || [],
        },
        company.id
      );

      await loadAuxiliaryFinancialData();
      setMeasModalOpen(false);
      showNotice(
        editingMeas ? 'Auto de medição atualizado!' : 'Auto de medição registado com sucesso!'
      );
    } catch (err: any) {
      await customAlert({
        title: 'Erro ao Guardar Medição',
        message: err.message || 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingMeas(false);
    }
  };

  const handleGenerateReceivableFromMeasurement = async (m: SiteMeasurement) => {
    // Verifica se já existe lançamento financeiro vinculado a esta medição para evitar duplicidade
    const existingLinked = records.filter(
      (r) => r.measurement_id === m.id && r.status !== 'cancelado'
    );
    const alreadyLaunchedAmount = roundCents(
      existingLinked.reduce((s, r) => addMoney(s, r.amount), 0)
    );
    const netApproved = roundCents(Math.max(0, m.approved_value - m.retention_value));
    const remainingToLaunch = subMoney(netApproved, alreadyLaunchedAmount);

    if (remainingToLaunch <= 0.01) {
      await customAlert({
        title: 'Medição Já Lançada no Financeiro',
        message: `Esta medição já possui lançamento(s) de receita associado(s) totalizando ${formatEuro(alreadyLaunchedAmount, true)}. Para registar um pagamento, utilize a aba Contas a Receber ou Movimentações.`,
        type: 'info',
      });
      return;
    }

    const confirmed = await customConfirm({
      title: 'Gerar Recebimento Financeiro da Medição',
      message: `Deseja gerar uma Conta a Receber no valor líquido aprovado de ${formatEuro(remainingToLaunch, true)} (Aprovado: ${formatEuro(m.approved_value)} − Retenção: ${formatEuro(m.retention_value)}) para a obra "${m.site_name || 'Obra'}"?`,
      type: 'confirm',
      confirmText: 'Gerar Conta a Receber',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    try {
      const cat: FinancialCategory =
        m.kind === 'adiantamento'
          ? 'adiantamento_cliente'
          : m.kind === 'trabalho_adicional'
          ? 'trabalhos_adicionais'
          : 'receita_medicao';

      const createdRec = await saveFinancialRecord(
        {
          type: 'receita',
          category: cat,
          subcategory:
            m.kind === 'adiantamento'
              ? 'Sinal de adjudicação'
              : m.kind === 'trabalho_adicional'
              ? 'Trabalhos a mais aprovados'
              : 'Auto de medição mensal',
          title: `Medição #${m.measurement_number} — ${m.description}`,
          site_id: m.site_id,
          site_name: m.site_name || null,
          entity_type: 'cliente',
          entity_name: m.client_name || 'Cliente da Obra',
          amount: remainingToLaunch,
          paid_amount: 0,
          due_date: m.approval_date || new Date().toISOString().slice(0, 10),
          status: 'pendente',
          measurement_id: m.id,
          source_module: 'medicao',
          source_id: m.id,
          description: `Gerado a partir do Auto de Medição #${m.measurement_number} (${formatDatePt(m.period_start)} a ${formatDatePt(m.period_end)}).`,
        },
        company.id
      );

      await saveSiteMeasurement(
        {
          ...m,
          invoiced_value: netApproved,
          status: m.status === 'rascunho' || m.status === 'aprovada' ? 'faturada' : m.status,
          linked_record_ids: [...(m.linked_record_ids || []), createdRec.id],
        },
        company.id
      );

      await loadAuxiliaryFinancialData();
      onRefresh();
      showNotice('Recebimento financeiro associado à medição criado com sucesso!');
    } catch (err: any) {
      await customAlert({
        title: 'Erro ao Gerar Recebimento',
        message: err.message || 'Tente novamente.',
        type: 'error',
      });
    }
  };

  const handleDeleteMeasurement = async (m: SiteMeasurement) => {
    const confirmed = await customConfirm({
      title: 'Eliminar Auto de Medição',
      message: `Deseja eliminar o Auto de Medição #${m.measurement_number} (${m.description})?`,
      type: 'danger',
      confirmText: 'Eliminar Medição',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    await deleteSiteMeasurement(m.id, company.id);
    await loadAuxiliaryFinancialData();
    showNotice('Auto de medição eliminado.');
  };

  // ==========================================================================
  // MODAL 5: SINCRONIZAÇÃO DE CUSTOS OPERACIONAIS (MÃO DE OBRA, MATERIAIS, FROTA)
  // ==========================================================================
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncingOperational, setSyncingOperational] = useState(false);

  const handleSyncSingleLaborItem = async (item: UnaccountedLaborCostItem) => {
    setSyncingOperational(true);
    try {
      await saveFinancialRecord(
        {
          type: 'despesa',
          category: 'custo_mao_de_obra',
          subcategory:
            item.overtimeHours > 0
              ? 'Salários, horas extras e TSU'
              : 'Salários e vencimentos',
          title: `Mão de Obra: ${item.employeeName} (${item.totalHours}h)`,
          site_id: item.siteId,
          site_name: item.siteName,
          entity_type: 'funcionario',
          entity_name: item.employeeName,
          entity_id: item.employeeId || null,
          amount: item.calculatedCost,
          paid_amount: item.calculatedCost,
          due_date: item.periodEnd,
          payment_date: item.periodEnd,
          status: 'pago',
          source_module: 'mao_de_obra',
          source_id: item.key,
          description: `Cálculo automático de horas: ${item.regularHours}h normais + ${item.overtimeHours}h extras a ${formatEuro(item.hourlyRate, true)}/h + ${item.socialChargesPct}% encargos (${formatDatePt(item.periodStart)} a ${formatDatePt(item.periodEnd)}).`,
        },
        company.id
      );
      await loadAuxiliaryFinancialData();
      onRefresh();
      showNotice(`Custo de mão de obra (${item.employeeName}) imputado à obra ${item.siteName}!`);
    } finally {
      setSyncingOperational(false);
    }
  };

  const handleSyncSingleMatEquipItem = async (item: UnaccountedMaterialOrEquipmentItem) => {
    setSyncingOperational(true);
    try {
      await saveFinancialRecord(
        {
          type: 'despesa',
          category: item.category,
          subcategory: item.subcategory,
          title: item.title,
          site_id: item.siteId,
          site_name: item.siteName,
          entity_type: 'fornecedor',
          entity_name: item.entityName || 'Fornecedor / Oficina',
          amount: item.amount,
          paid_amount: item.amount,
          due_date: item.date.slice(0, 10),
          payment_date: item.date.slice(0, 10),
          status: 'pago',
          source_module: item.sourceModule,
          source_id: item.sourceId,
          description: `Sincronizado automaticamente a partir do módulo de ${
            item.sourceModule === 'compra_material' ? 'Armazém/Materiais' : 'Frota/Equipamentos'
          }.`,
        },
        company.id
      );
      await loadAuxiliaryFinancialData();
      onRefresh();
      showNotice(`Custo "${item.title}" lançado no módulo financeiro!`);
    } finally {
      setSyncingOperational(false);
    }
  };

  const handleSyncAllOperationalCosts = async () => {
    if (totalPendingOperationalSync === 0) return;
    const confirmed = await customConfirm({
      title: 'Sincronizar Todos os Custos Operacionais',
      message: `Deseja converter automaticamente os ${totalPendingOperationalSync} registo(s) operacionais (horas de ponto/equipas, materiais alocados e manutenções) em despesas financeiras sem duplicidade?`,
      type: 'confirm',
      confirmText: `Sincronizar Todos (${totalPendingOperationalSync})`,
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    setSyncingOperational(true);
    try {
      for (const l of unaccountedLabor) {
        await handleSyncSingleLaborItem(l);
      }
      for (const m of unaccountedMatEquip) {
        await handleSyncSingleMatEquipItem(m);
      }
      setSyncModalOpen(false);
      showNotice('Todos os custos operacionais foram integrados ao financeiro!');
    } finally {
      setSyncingOperational(false);
    }
  };

  // ==========================================================================
  // MODAL 6: EXPORTAÇÃO DE RELATÓRIOS (6 RELATÓRIOS x 3 FORMATOS)
  // ==========================================================================
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<FinancialReportType>('extrato');
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('xlsx');

  const handleTriggerReportExport = () => {
    const selectedSiteObj = sites.find((s) => s.id === selectedSiteId);
    exportFinancialReport(selectedReportType, selectedExportFormat, {
      company,
      periodLabel: periodRange.label,
      siteFilterLabel: selectedSiteObj
        ? `Obra: ${selectedSiteObj.name}`
        : 'Todas as Obras (Consolidado da Empresa)',
      records:
        selectedReportType === 'extrato' ? filteredMovements : scopedRecordsInPeriod,
      sitesProfitability: sortedProfitability,
      measurements:
        selectedSiteId === 'todos'
          ? measurements
          : measurements.filter((m) => m.site_id === selectedSiteId),
    });
    setReportModalOpen(false);
    showNotice(
      `Relatório exportado em formato ${selectedExportFormat.toUpperCase()} com sucesso!`
    );
  };

  // ==========================================================================
  // DADOS DA AGENDA FINANCEIRA (CALENDÁRIO MENSAL DE VENCIMENTOS)
  // ==========================================================================
  const agendaCalendarCells = useMemo(() => {
    const y = agendaMonthDate.getFullYear();
    const m = agendaMonthDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Seg = 0
    const daysInMonth = lastDay.getDate();

    const cells: {
      dateStr: string | null;
      dayNum: number | null;
      incomes: number;
      expenses: number;
      records: FinancialRecord[];
    }[] = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNum: null, incomes: 0, expenses: 0, records: [] });
    }

    const baseRecs =
      selectedSiteId === 'todos'
        ? records.filter((r) => r.status !== 'cancelado')
        : records.filter((r) => r.site_id === selectedSiteId && r.status !== 'cancelado');

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayRecs = baseRecs.filter((r) => (r.due_date || '').slice(0, 10) === dateStr);
      const incomes = roundCents(
        dayRecs
          .filter((r) => r.type === 'receita')
          .reduce((s, r) => addMoney(s, getEffectiveRemainingAmount(r) || r.amount), 0)
      );
      const expenses = roundCents(
        dayRecs
          .filter((r) => r.type === 'despesa')
          .reduce((s, r) => addMoney(s, getEffectiveRemainingAmount(r) || r.amount), 0)
      );
      cells.push({ dateStr, dayNum: d, incomes, expenses, records: dayRecs });
    }

    return cells;
  }, [agendaMonthDate, records, selectedSiteId]);

  const selectedDayRecords = useMemo(() => {
    return records.filter(
      (r) =>
        r.status !== 'cancelado' &&
        (selectedSiteId === 'todos' || r.site_id === selectedSiteId) &&
        (r.due_date || '').slice(0, 10) === selectedAgendaDay
    );
  }, [records, selectedSiteId, selectedAgendaDay]);

  return (
    <div style={{ width: '100%', maxWidth: 1320, margin: '0 auto' }}>
      {/* ==================================================================== */}
      {/* CABEÇALHO CORPORATIVO + AÇÕES RÁPIDAS                                */}
      {/* ==================================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: -0.5,
              margin: 0,
            }}
          >
            Centro de Gestão Financeira & Controlo de Obras
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
            Controlo de tesouraria, orçamento por obra, contas a pagar/receber, autos de medição e rentabilidade em tempo real.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Botão de Integração Operacional (Mão de Obra / Materiais / Equipamentos) */}
          <button
            type="button"
            className="btn-flat-secondary"
            onClick={() => setSyncModalOpen(true)}
            style={{
              fontSize: 12.5,
              padding: '9px 13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
            }}
            title="Sincronizar custos de horas de ponto, equipas, materiais e frota"
          >
            <RefreshCw size={15} />
            <span>Custos Operacionais</span>
            {totalPendingOperationalSync > 0 && (
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 999,
                  backgroundColor: '#F59E0B',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {totalPendingOperationalSync}
              </span>
            )}
          </button>

          {/* Botão de Exportação de Relatórios (CSV, XLSX, PDF) */}
          <button
            type="button"
            className="btn-flat-secondary"
            onClick={() => setReportModalOpen(true)}
            style={{
              fontSize: 12.5,
              padding: '9px 13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Relatórios & Exportação</span>
          </button>

          {/* Botões de Nova Receita / Nova Despesa */}
          <button
            type="button"
            className="btn-flat-secondary"
            onClick={() => handleOpenAdd('receita')}
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              padding: '9px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'rgba(16,185,129,0.45)',
              color: '#10B981',
            }}
          >
            <ArrowUpCircle size={16} />
            Nova Receita
          </button>

          <button
            type="button"
            className="btn-flat-primary"
            onClick={() => handleOpenAdd('despesa')}
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: '9px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={16} />
            Nova Despesa
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* BARRA GLOBAL DE FILTRO DE OBRA E PERÍODO                             */}
      {/* ==================================================================== */}
      <div
        className="content-panel"
        style={{
          padding: '12px 16px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Seletor de Obra */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
            <Building2 size={16} color="var(--primary)" />
            <span>Âmbito:</span>
          </div>
          <select
            value={selectedSiteId}
            onChange={(e) => {
              setSelectedSiteId(e.target.value);
              setMovPage(1);
            }}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: '7px 12px',
              borderRadius: 7,
              border: '1.5px solid var(--primary)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              minWidth: 250,
            }}
          >
            <option value="todos">Todas as Obras & Custos Gerais da Empresa</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                Obra: {s.name} ({s.status.toUpperCase()})
              </option>
            ))}
          </select>

          {selectedSiteId !== 'todos' && (
            <button
              type="button"
              className="btn-flat-secondary"
              style={{ fontSize: 11, padding: '5px 10px' }}
              onClick={() => setSelectedSiteId('todos')}
            >
              Ver Empresa Completa
            </button>
          )}
        </div>

        {/* Seletor de Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
            <Calendar size={14} color="var(--primary)" />
            <span>Período:</span>
          </div>
          <select
            value={periodPreset}
            onChange={(e) => {
              setPeriodPreset(e.target.value as PeriodPreset);
              setMovPage(1);
            }}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              padding: '7px 10px',
              borderRadius: 7,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
            }}
          >
            <option value="todo_periodo">Todo o período</option>
            <option value="este_mes">Este mês</option>
            <option value="mes_anterior">Mês anterior</option>
            <option value="ultimos_3_meses">Últimos 3 meses</option>
            <option value="ultimos_6_meses">Últimos 6 meses</option>
            <option value="este_ano">Este ano</option>
            <option value="personalizado">Intervalo personalizado</option>
          </select>

          {periodPreset === 'personalizado' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  fontSize: 12,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>até</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  fontSize: 12,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* NAVEGAÇÃO ENTRE AS 5 ABAS PRINCIPAIS                                 */}
      {/* ==================================================================== */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border-color)',
          marginBottom: 22,
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {[
          { id: 'visao_geral', label: '1. Visão Geral', icon: Wallet },
          {
            id: 'movimentacoes',
            label: `2. Movimentações (${filteredMovements.length})`,
            icon: Layers,
          },
          {
            id: 'contas',
            label: `3. Contas a Pagar & Receber (${
              accountsSummary.payables.length + accountsSummary.receivables.length
            })`,
            icon: Clock,
          },
          {
            id: 'rentabilidade',
            label: `4. Rentabilidade & Orçamento (${sites.length})`,
            icon: TrendingUp,
          },
          {
            id: 'medicoes',
            label: `5. Medições de Obra (${measurements.length})`,
            icon: ClipboardCheck,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as FinancialTab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'var(--primary-subtle)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* ABA 1 — VISÃO GERAL                                                  */}
      {/* ==================================================================== */}
      {activeTab === 'visao_geral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* OS 6 CARDS DE INDICADORES SOLICITADOS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            {/* Card 1: Total Recebido */}
            <div
              className="content-panel"
              style={{
                margin: 0,
                padding: '16px 16px',
                borderTop: '4px solid #10B981',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', textTransform: 'uppercase' }}>
                  Total Recebido
                </span>
                <ArrowUpCircle size={17} color="#10B981" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 6 }}>
                {formatEuro(overviewMetrics.totalReceived, true)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {overviewMetrics.receivedVariationPct !== null ? (
                  <span
                    style={{
                      color: overviewMetrics.receivedVariationPct >= 0 ? '#10B981' : '#EF4444',
                      fontWeight: 700,
                    }}
                  >
                    {overviewMetrics.receivedVariationPct >= 0 ? '+' : ''}
                    {overviewMetrics.receivedVariationPct.toFixed(1)}% vs período anterior
                  </span>
                ) : (
                  `Recebimentos efetivos (${periodRange.label})`
                )}
              </div>
            </div>

            {/* Card 2: Total Pago */}
            <div
              className="content-panel"
              style={{
                margin: 0,
                padding: '16px 16px',
                borderTop: '4px solid #EF4444',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase' }}>
                  Total Pago
                </span>
                <ArrowDownCircle size={17} color="#EF4444" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 6 }}>
                {formatEuro(overviewMetrics.totalPaid, true)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {overviewMetrics.paidVariationPct !== null ? (
                  <span
                    style={{
                      color: overviewMetrics.paidVariationPct <= 0 ? '#10B981' : '#EF4444',
                      fontWeight: 700,
                    }}
                  >
                    {overviewMetrics.paidVariationPct >= 0 ? '+' : ''}
                    {overviewMetrics.paidVariationPct.toFixed(1)}% vs período anterior
                  </span>
                ) : (
                  `Despesas efetivamente pagas (${periodRange.label})`
                )}
              </div>
            </div>

            {/* Card 3: Saldo de Caixa (Não confundir com lucro) */}
            <div
              className="content-panel"
              style={{
                margin: 0,
                padding: '16px 16px',
                borderTop: `4px solid ${overviewMetrics.cashBalance >= 0 ? '#2563EB' : '#EF4444'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: overviewMetrics.cashBalance >= 0 ? '#2563EB' : '#EF4444',
                    textTransform: 'uppercase',
                  }}
                >
                  Saldo de Caixa
                </span>
                <Wallet size={17} color={overviewMetrics.cashBalance >= 0 ? '#2563EB' : '#EF4444'} />
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: overviewMetrics.cashBalance >= 0 ? '#2563EB' : '#EF4444',
                  marginTop: 6,
                }}
              >
                {formatEuro(overviewMetrics.cashBalance, true)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {overviewMetrics.cashBalance >= 0
                  ? 'Disponibilidade líquida de caixa (Entradas − Saídas)'
                  : 'Atenção: Saídas pagas superam entradas em caixa'}
              </div>
            </div>

            {/* Card 4: Contas a Receber */}
            <div
              className="content-panel"
              style={{
                margin: 0,
                padding: '16px 16px',
                borderTop: '4px solid #0D9488',
                cursor: 'pointer',
              }}
              onClick={() => {
                setAccountsSubView('receber');
                setActiveTab('contas');
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0D9488', textTransform: 'uppercase' }}>
                  Contas a Receber
                </span>
                <TrendingUp size={17} color="#0D9488" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 6 }}>
                {formatEuro(overviewMetrics.accountsReceivable, true)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {overviewMetrics.overdueReceivablesCount > 0 ? (
                  <span style={{ color: '#EF4444', fontWeight: 700 }}>
                    {overviewMetrics.overdueReceivablesCount} recebimento(s) em atraso (
                    {formatEuro(overviewMetrics.overdueReceivablesAmount)})
                  </span>
                ) : (
                  'Sem faturas/medições vencidas'
                )}
              </div>
            </div>

            {/* Card 5: Contas a Pagar */}
            <div
              className="content-panel"
              style={{
                margin: 0,
                padding: '16px 16px',
                borderTop: '4px solid #F59E0B',
                cursor: 'pointer',
              }}
              onClick={() => {
                setAccountsSubView('pagar');
                setActiveTab('contas');
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase' }}>
                  Contas a Pagar
                </span>
                <Clock size={17} color="#F59E0B" />
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 6 }}>
                {formatEuro(overviewMetrics.accountsPayable, true)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {overviewMetrics.overduePayablesCount > 0 ? (
                  <span style={{ color: '#EF4444', fontWeight: 700 }}>
                    {overviewMetrics.overduePayablesCount} conta(s) vencida(s) (
                    {formatEuro(overviewMetrics.overduePayablesAmount)})
                  </span>
                ) : (
                  'Obrigações em dia'
                )}
              </div>
            </div>

            {/* Card 6: Saldo Previsto */}
            <div
              className="content-panel"
              style={{
                margin: 0,
                padding: '16px 16px',
                borderTop: `4px solid ${overviewMetrics.forecastBalance >= 0 ? '#7C3AED' : '#EF4444'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: overviewMetrics.forecastBalance >= 0 ? '#7C3AED' : '#EF4444',
                    textTransform: 'uppercase',
                  }}
                >
                  Saldo Previsto
                </span>
                <DollarSign size={17} color={overviewMetrics.forecastBalance >= 0 ? '#7C3AED' : '#EF4444'} />
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: overviewMetrics.forecastBalance >= 0 ? 'var(--text-main)' : '#EF4444',
                  marginTop: 6,
                }}
              >
                {formatEuro(overviewMetrics.forecastBalance, true)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {overviewMetrics.forecastHorizonLabel}
              </div>
            </div>
          </div>

          {/* SEÇÃO DE ALERTAS FINANCEIROS AUTOMÁTICOS */}
          {financialAlerts.length > 0 && (
            <div
              className="content-panel"
              style={{
                margin: 0,
                padding: '16px 18px',
                borderLeft: '4px solid #F59E0B',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={18} color="#F59E0B" />
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Alertas Financeiros & Desvios Detetados ({financialAlerts.length})
                  </h3>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Clique num alerta para inspecionar o registo ou a obra correspondente
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                  gap: 10,
                }}
              >
                {financialAlerts.slice(0, 6).map((alertItem: FinancialAlertItem) => {
                  const borderCol =
                    alertItem.severity === 'danger'
                      ? 'rgba(239,68,68,0.4)'
                      : alertItem.severity === 'warning'
                      ? 'rgba(245,158,11,0.4)'
                      : 'rgba(37,99,235,0.4)';
                  const iconCol =
                    alertItem.severity === 'danger'
                      ? '#EF4444'
                      : alertItem.severity === 'warning'
                      ? '#F59E0B'
                      : '#2563EB';

                  return (
                    <div
                      key={alertItem.id}
                      onClick={() => {
                        if (alertItem.siteId && alertItem.targetTab === 'rentabilidade') {
                          setSelectedSiteId(alertItem.siteId);
                        }
                        setActiveTab(alertItem.targetTab);
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: `1px solid ${borderCol}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <AlertTriangle size={16} color={iconCol} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)' }}>
                          {alertItem.title}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {alertItem.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GRÁFICO 1: FLUXO DE CAIXA INTEGRADO AO FILTRO DE OBRA */}
          <CashFlowChart
            records={
              selectedSiteId === 'todos'
                ? records
                : records.filter((r) => r.site_id === selectedSiteId)
            }
            selectedSiteName={
              selectedSiteId === 'todos'
                ? null
                : sites.find((s) => s.id === selectedSiteId)?.name || null
            }
          />

          {/* GRÁFICOS 2, 3, 4 e 5 DA VISÃO GERAL */}
          <FinancialOverviewCharts
            records={records}
            filteredRecordsInPeriod={scopedRecordsInPeriod}
            sitesProfitability={sitesProfitability}
            selectedSiteId={selectedSiteId}
            onSelectSite={(siteId) => {
              setSelectedSiteId(siteId);
              setActiveTab('rentabilidade');
            }}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 2 — MOVIMENTAÇÕES (EXTRATO DETALHADO + FILTROS AVANÇADOS)        */}
      {/* ==================================================================== */}
      {activeTab === 'movimentacoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Painel de Filtros Avançados Combináveis */}
          <div className="content-panel" style={{ margin: 0, padding: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10,
                alignItems: 'end',
              }}
            >
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Pesquisa Livre
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 9 }} />
                  <input
                    type="text"
                    placeholder="Descrição, nº doc, subcategoria..."
                    value={movSearch}
                    onChange={(e) => {
                      setMovSearch(e.target.value);
                      setMovPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 30px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      color: 'var(--text-main)',
                      fontSize: 12.5,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Tipo
                </label>
                <select
                  value={movTypeFilter}
                  onChange={(e) => {
                    setMovTypeFilter(e.target.value as any);
                    setMovPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    color: 'var(--text-main)',
                    fontSize: 12.5,
                  }}
                >
                  <option value="todos">Receitas e Despesas</option>
                  <option value="receita">Apenas Receitas (Entradas)</option>
                  <option value="despesa">Apenas Despesas (Saídas)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Categoria
                </label>
                <select
                  value={movCategoryFilter}
                  onChange={(e) => {
                    setMovCategoryFilter(e.target.value);
                    setMovPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    color: 'var(--text-main)',
                    fontSize: 12.5,
                  }}
                >
                  <option value="todas">Todas as Categorias</option>
                  <optgroup label="Receitas (Entradas)">
                    {INCOME_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Despesas (Custos)">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Estado
                </label>
                <select
                  value={movStatusFilter}
                  onChange={(e) => {
                    setMovStatusFilter(e.target.value as any);
                    setMovPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    color: 'var(--text-main)',
                    fontSize: 12.5,
                  }}
                >
                  <option value="todos">Todos os Estados</option>
                  <option value="pago">Pago / Recebido</option>
                  <option value="parcial">Parcialmente Liquidado</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Fornecedor / Cliente / Pessoa
                </label>
                <input
                  type="text"
                  placeholder="Filtrar entidade..."
                  value={movEntityFilter}
                  onChange={(e) => {
                    setMovEntityFilter(e.target.value);
                    setMovPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    color: 'var(--text-main)',
                    fontSize: 12.5,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Intervalo de Valor (€)
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number"
                    placeholder="Mín €"
                    value={movMinAmount}
                    onChange={(e) => {
                      setMovMinAmount(e.target.value);
                      setMovPage(1);
                    }}
                    style={{
                      width: '50%',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      color: 'var(--text-main)',
                      fontSize: 12,
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Máx €"
                    value={movMaxAmount}
                    onChange={(e) => {
                      setMovMaxAmount(e.target.value);
                      setMovPage(1);
                    }}
                    style={{
                      width: '50%',
                      padding: '7px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      color: 'var(--text-main)',
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Ordenação Explícita
                </label>
                <select
                  value={movSortBy}
                  onChange={(e) => setMovSortBy(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    color: 'var(--text-main)',
                    fontSize: 12.5,
                  }}
                >
                  <option value="due_desc">Vencimento (Mais recente)</option>
                  <option value="due_asc">Vencimento (Mais antigo)</option>
                  <option value="paid_desc">Data Pagamento (Recente)</option>
                  <option value="amount_desc">Valor (Maior → Menor)</option>
                  <option value="amount_asc">Valor (Menor → Maior)</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                A exibir <strong>{paginatedMovements.length}</strong> de{' '}
                <strong>{filteredMovements.length}</strong> movimentações encontradas
              </span>

              <button
                type="button"
                className="btn-flat-secondary"
                onClick={clearMovFilters}
                style={{ fontSize: 11.5, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <RotateCcw size={13} />
                Limpar Filtros
              </button>
            </div>
          </div>

          {/* Tabela Responsiva de Movimentações */}
          <div className="content-panel" style={{ margin: 0 }}>
            <div className="flat-table-wrap">
              <table className="flat-table">
                <thead>
                  <tr>
                    <th>Vencimento / Liquidação</th>
                    <th>Descrição & Observações</th>
                    <th>Categoria / Subcategoria</th>
                    <th>Obra & Entidade</th>
                    <th style={{ textAlign: 'right' }}>Valor (€)</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                        Nenhuma movimentação encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedMovements.map((rec) => {
                      const catDef = getCategoryDefinition(rec.category, rec.type);
                      const paidAmt = getEffectivePaidAmount(rec);
                      const remAmt = getEffectiveRemainingAmount(rec);
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const isOverdue = remAmt > 0 && rec.due_date && rec.due_date < todayStr;
                      const isBusy = busyActionId === rec.id;

                      return (
                        <tr key={rec.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: isOverdue ? '#EF4444' : 'var(--text-main)' }}>
                              Venc: {formatDatePt(rec.due_date)}
                            </div>
                            {rec.payment_date && (
                              <div style={{ fontSize: 11, color: '#10B981', marginTop: 2 }}>
                                Pago: {formatDatePt(rec.payment_date)}
                              </div>
                            )}
                            {rec.invoice_number && (
                              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                Doc: {rec.invoice_number}
                              </div>
                            )}
                          </td>

                          <td style={{ maxWidth: 280 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13 }}>
                              {rec.title}
                            </div>
                            {rec.description && (
                              <div
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-muted)',
                                  marginTop: 2,
                                  whiteSpace: 'normal',
                                }}
                              >
                                {rec.description}
                              </div>
                            )}
                            {rec.receipt_url && (
                              <a
                                href={rec.receipt_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: 'var(--primary)',
                                  marginTop: 4,
                                  textDecoration: 'none',
                                }}
                              >
                                <FileText size={12} /> Ver Comprovativo
                              </a>
                            )}
                          </td>

                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                backgroundColor: `${catDef.color}18`,
                                color: catDef.color,
                              }}
                            >
                              {catDef.label}
                            </span>
                            {rec.subcategory && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                                {rec.subcategory}
                              </div>
                            )}
                          </td>

                          <td>
                            <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-main)' }}>
                              {rec.site_name || 'Custos / Receitas Gerais'}
                            </div>
                            {rec.entity_name && (
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                {rec.entity_name}
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 14,
                                color: rec.type === 'receita' ? '#10B981' : '#EF4444',
                              }}
                            >
                              {rec.type === 'receita' ? '+' : '-'} {formatEuro(rec.amount, true)}
                            </div>
                            {rec.status === 'parcial' && (
                              <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>
                                Liquidado: {formatEuro(paidAmt, true)} • Falta: {formatEuro(remAmt, true)}
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`badge-flat ${
                                rec.status === 'pago'
                                  ? 'success'
                                  : rec.status === 'parcial'
                                  ? 'warning'
                                  : isOverdue
                                  ? 'danger'
                                  : 'primary'
                              }`}
                              style={{ fontSize: 10.5, fontWeight: 700 }}
                            >
                              {rec.status === 'pago'
                                ? rec.type === 'receita'
                                  ? 'RECEBIDO'
                                  : 'PAGO'
                                : rec.status === 'parcial'
                                ? 'PARCIAL'
                                : isOverdue
                                ? 'VENCIDO'
                                : 'PENDENTE'}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 5, justifyContent: 'flex-end' }}>
                              {rec.status !== 'pago' && rec.status !== 'cancelado' && (
                                <button
                                  type="button"
                                  className="btn-flat-secondary"
                                  style={{ padding: '5px 8px', fontSize: 11, fontWeight: 700, color: '#2563EB' }}
                                  onClick={() => handleOpenPartialModal(rec)}
                                  title="Registar pagamento parcial ou ver parcelas"
                                >
                                  Parcelar
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isBusy}
                                className={rec.status === 'pago' ? 'btn-flat-secondary' : 'btn-flat-success'}
                                style={{ padding: '5px 8px', fontSize: 11 }}
                                onClick={() => handleToggleStatus(rec)}
                                title={
                                  rec.status === 'pago'
                                    ? 'Reverter para pendente'
                                    : 'Liquidar valor total'
                                }
                              >
                                <Check size={13} />
                              </button>

                              <button
                                type="button"
                                className="btn-flat-secondary"
                                style={{ padding: '5px 8px' }}
                                onClick={() => handleOpenEdit(rec)}
                                title="Editar registo"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                className="btn-flat-danger"
                                style={{ padding: '5px 8px' }}
                                onClick={() => handleDeleteRecord(rec)}
                                title="Eliminar registo"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalMovPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Página {movPage} de {totalMovPages}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-flat-secondary"
                    disabled={movPage <= 1}
                    onClick={() => setMovPage((p) => Math.max(1, p - 1))}
                    style={{ padding: '5px 10px', fontSize: 12 }}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <button
                    type="button"
                    className="btn-flat-secondary"
                    disabled={movPage >= totalMovPages}
                    onClick={() => setMovPage((p) => Math.min(totalMovPages, p + 1))}
                    style={{ padding: '5px 10px', fontSize: 12 }}
                  >
                    Seguinte <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 3 — CONTAS A PAGAR, A RECEBER, PARCIAIS E AGENDA FINANCEIRA      */}
      {/* ==================================================================== */}
      {activeTab === 'contas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Seletor de Sub-visão da Aba Contas */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setAccountsSubView('pagar')}
              className={accountsSubView === 'pagar' ? 'btn-flat-primary' : 'btn-flat-secondary'}
              style={{ padding: '9px 16px', fontSize: 13, fontWeight: 700 }}
            >
              Contas a Pagar ({accountsSummary.payables.length})
            </button>
            <button
              type="button"
              onClick={() => setAccountsSubView('receber')}
              className={accountsSubView === 'receber' ? 'btn-flat-primary' : 'btn-flat-secondary'}
              style={{ padding: '9px 16px', fontSize: 13, fontWeight: 700 }}
            >
              Contas a Receber ({accountsSummary.receivables.length})
            </button>
            <button
              type="button"
              onClick={() => setAccountsSubView('agenda')}
              className={accountsSubView === 'agenda' ? 'btn-flat-primary' : 'btn-flat-secondary'}
              style={{ padding: '9px 16px', fontSize: 13, fontWeight: 700 }}
            >
              Agenda Financeira de Vencimentos
            </button>
          </div>

          {/* SUB-VISÃO 1: CONTAS A PAGAR */}
          {accountsSubView === 'pagar' && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: 12,
                }}
              >
                <div className="kpi-box" style={{ borderTop: '3px solid #F59E0B' }}>
                  <div className="kpi-label">Total Pendente a Pagar</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>
                    {formatEuro(accountsSummary.payablesTotal, true)}
                  </div>
                  <div className="kpi-detail">{accountsSummary.payables.length} obrigações abertas</div>
                </div>

                <div className="kpi-box" style={{ borderTop: '3px solid #EF4444' }}>
                  <div className="kpi-label">Total Vencido (Em Atraso)</div>
                  <div className="kpi-value" style={{ fontSize: 20, color: '#EF4444' }}>
                    {formatEuro(accountsSummary.payablesOverdueTotal, true)}
                  </div>
                  <div className="kpi-detail">{accountsSummary.payablesOverdueCount} conta(s) vencida(s)</div>
                </div>

                <div className="kpi-box" style={{ borderTop: '3px solid #2563EB' }}>
                  <div className="kpi-label">Vencimentos de Hoje</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>
                    {formatEuro(accountsSummary.payablesTodayTotal, true)}
                  </div>
                  <div className="kpi-detail">{accountsSummary.payablesTodayCount} conta(s) hoje</div>
                </div>

                <div className="kpi-box" style={{ borderTop: '3px solid #8B5CF6' }}>
                  <div className="kpi-label">Próximos 7 Dias</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>
                    {formatEuro(accountsSummary.payablesNext7Total, true)}
                  </div>
                  <div className="kpi-detail">Horizonte semanal</div>
                </div>

                <div className="kpi-box" style={{ borderTop: '3px solid #64748B' }}>
                  <div className="kpi-label">Próximos 30 Dias</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>
                    {formatEuro(accountsSummary.payablesNext30Total, true)}
                  </div>
                  <div className="kpi-detail">Horizonte mensal</div>
                </div>
              </div>

              <div className="content-panel" style={{ margin: 0 }}>
                <div className="flat-table-wrap">
                  <table className="flat-table">
                    <thead>
                      <tr>
                        <th>Vencimento</th>
                        <th>Fornecedor / Beneficiário</th>
                        <th>Descrição & Obra</th>
                        <th style={{ textAlign: 'right' }}>Valor Original</th>
                        <th style={{ textAlign: 'right' }}>Já Pago</th>
                        <th style={{ textAlign: 'right' }}>Saldo Restante</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountsSummary.payables.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                            Não existem contas a pagar pendentes para o filtro selecionado.
                          </td>
                        </tr>
                      ) : (
                        accountsSummary.payables.map((rec) => {
                          const paid = getEffectivePaidAmount(rec);
                          const rem = getEffectiveRemainingAmount(rec);
                          const todayStr = new Date().toISOString().slice(0, 10);
                          const isOverdue = rec.due_date && rec.due_date < todayStr;
                          return (
                            <tr key={rec.id}>
                              <td>
                                <span style={{ fontWeight: 700, color: isOverdue ? '#EF4444' : 'var(--text-main)' }}>
                                  {formatDatePt(rec.due_date)}
                                </span>
                                {isOverdue && (
                                  <div style={{ fontSize: 10, fontWeight: 800, color: '#EF4444' }}>
                                    EM ATRASO
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>{rec.entity_name || 'Fornecedor Geral'}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{rec.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {rec.site_name || 'Geral da Empresa'}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>{formatEuro(rec.amount, true)}</td>
                              <td style={{ textAlign: 'right', color: '#10B981', fontWeight: 600 }}>
                                {formatEuro(paid, true)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: '#EF4444' }}>
                                {formatEuro(rem, true)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn-flat-secondary"
                                    style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 700 }}
                                    onClick={() => handleOpenPartialModal(rec)}
                                  >
                                    Pagamento Parcial
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-flat-success"
                                    style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 700 }}
                                    onClick={() => handleToggleStatus(rec)}
                                  >
                                    Liquidar Total
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* SUB-VISÃO 2: CONTAS A RECEBER */}
          {accountsSubView === 'receber' && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: 12,
                }}
              >
                <div className="kpi-box" style={{ borderTop: '3px solid #10B981' }}>
                  <div className="kpi-label">Total a Receber</div>
                  <div className="kpi-value" style={{ fontSize: 20, color: '#10B981' }}>
                    {formatEuro(accountsSummary.receivablesTotal, true)}
                  </div>
                  <div className="kpi-detail">{accountsSummary.receivables.length} título(s) em aberto</div>
                </div>

                <div className="kpi-box" style={{ borderTop: '3px solid #EF4444' }}>
                  <div className="kpi-label">Valores Vencidos</div>
                  <div className="kpi-value" style={{ fontSize: 20, color: '#EF4444' }}>
                    {formatEuro(accountsSummary.receivablesOverdueTotal, true)}
                  </div>
                  <div className="kpi-detail">{accountsSummary.receivablesOverdueCount} recebimento(s) atrasado(s)</div>
                </div>

                <div className="kpi-box" style={{ borderTop: '3px solid #2563EB' }}>
                  <div className="kpi-label">Recebimentos Previstos (No Prazo)</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>
                    {formatEuro(accountsSummary.receivablesUpcomingTotal, true)}
                  </div>
                  <div className="kpi-detail">Dentro do vencimento acordado</div>
                </div>

                <div className="kpi-box" style={{ borderTop: '3px solid #F59E0B' }}>
                  <div className="kpi-label">Clientes com Pagamento em Atraso</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>
                    {accountsSummary.lateClients.length}
                  </div>
                  <div className="kpi-detail">
                    {accountsSummary.lateClients.length > 0
                      ? accountsSummary.lateClients.slice(0, 2).join(', ')
                      : 'Nenhum cliente em mora'}
                  </div>
                </div>
              </div>

              <div className="content-panel" style={{ margin: 0 }}>
                <div className="flat-table-wrap">
                  <table className="flat-table">
                    <thead>
                      <tr>
                        <th>Previsão / Vencimento</th>
                        <th>Cliente</th>
                        <th>Descrição & Obra</th>
                        <th style={{ textAlign: 'right' }}>Valor Original</th>
                        <th style={{ textAlign: 'right' }}>Já Recebido</th>
                        <th style={{ textAlign: 'right' }}>Falta Receber</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountsSummary.receivables.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                            Não existem contas a receber pendentes para o filtro selecionado.
                          </td>
                        </tr>
                      ) : (
                        accountsSummary.receivables.map((rec) => {
                          const paid = getEffectivePaidAmount(rec);
                          const rem = getEffectiveRemainingAmount(rec);
                          const todayStr = new Date().toISOString().slice(0, 10);
                          const isOverdue = rec.due_date && rec.due_date < todayStr;
                          return (
                            <tr key={rec.id}>
                              <td>
                                <span style={{ fontWeight: 700, color: isOverdue ? '#EF4444' : 'var(--text-main)' }}>
                                  {formatDatePt(rec.due_date)}
                                </span>
                                {isOverdue && (
                                  <div style={{ fontSize: 10, fontWeight: 800, color: '#EF4444' }}>
                                    CLIENTE EM ATRASO
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>{rec.entity_name || 'Cliente da Obra'}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{rec.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {rec.site_name || 'Receita Geral'}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>{formatEuro(rec.amount, true)}</td>
                              <td style={{ textAlign: 'right', color: '#10B981', fontWeight: 600 }}>
                                {formatEuro(paid, true)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: '#2563EB' }}>
                                {formatEuro(rem, true)}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="btn-flat-secondary"
                                    style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 700 }}
                                    onClick={() => handleOpenPartialModal(rec)}
                                  >
                                    Recebimento Parcial
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-flat-success"
                                    style={{ padding: '5px 10px', fontSize: 11.5, fontWeight: 700 }}
                                    onClick={() => handleToggleStatus(rec)}
                                  >
                                    Confirmar Total
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* SUB-VISÃO 3: AGENDA FINANCEIRA DE VENCIMENTOS */}
          {accountsSubView === 'agenda' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.6fr) minmax(300px, 1fr)',
                gap: 18,
                alignItems: 'start',
              }}
            >
              <div className="content-panel" style={{ margin: 0, padding: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                    {MONTHS_PT[agendaMonthDate.getMonth()]} de {agendaMonthDate.getFullYear()}
                  </h3>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn-flat-secondary"
                      style={{ padding: '5px 10px' }}
                      onClick={() =>
                        setAgendaMonthDate(
                          new Date(agendaMonthDate.getFullYear(), agendaMonthDate.getMonth() - 1, 1)
                        )
                      }
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-flat-secondary"
                      style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700 }}
                      onClick={() => {
                        const now = new Date();
                        setAgendaMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
                        setSelectedAgendaDay(now.toISOString().slice(0, 10));
                      }}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      className="btn-flat-secondary"
                      style={{ padding: '5px 10px' }}
                      onClick={() =>
                        setAgendaMonthDate(
                          new Date(agendaMonthDate.getFullYear(), agendaMonthDate.getMonth() + 1, 1)
                        )
                      }
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  {WEEKDAYS_PT.map((w) => (
                    <div
                      key={w}
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        padding: '4px 0',
                      }}
                    >
                      {w}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                    gap: 6,
                  }}
                >
                  {agendaCalendarCells.map((cell, idx) => {
                    if (!cell.dateStr) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          style={{
                            minHeight: 68,
                            borderRadius: 6,
                            backgroundColor: 'transparent',
                          }}
                        />
                      );
                    }
                    const isSelected = cell.dateStr === selectedAgendaDay;
                    const isToday = cell.dateStr === new Date().toISOString().slice(0, 10);

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => setSelectedAgendaDay(cell.dateStr!)}
                        style={{
                          minHeight: 68,
                          padding: 6,
                          borderRadius: 8,
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? 'var(--primary-subtle)'
                            : 'var(--bg-card-subtle)',
                          border: isSelected
                            ? '2px solid var(--primary)'
                            : isToday
                            ? '1.5px solid #2563EB'
                            : '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minWidth: 0,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: isSelected || isToday ? 800 : 600,
                              color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                            }}
                          >
                            {cell.dayNum}
                          </span>
                          {cell.records.length > 0 && (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: '1px 4px',
                                borderRadius: 4,
                                backgroundColor: 'var(--border-color)',
                              }}
                            >
                              {cell.records.length}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {cell.incomes > 0 && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#10B981',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              +{formatEuro(cell.incomes)}
                            </div>
                          )}
                          {cell.expenses > 0 && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#EF4444',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              -{formatEuro(cell.expenses)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Painel Lateral da Data Selecionada */}
              <div className="content-panel" style={{ margin: 0, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                      Vencimentos Programados
                    </span>
                    <h4 style={{ fontSize: 16, fontWeight: 800, margin: '2px 0 0' }}>
                      {formatDatePt(selectedAgendaDay)}
                    </h4>
                  </div>
                  <button
                    type="button"
                    className="btn-flat-primary"
                    style={{ padding: '6px 10px', fontSize: 11.5 }}
                    onClick={() => {
                      handleOpenAdd('despesa');
                      setFormDueDate(selectedAgendaDay);
                    }}
                  >
                    + Agendar
                  </button>
                </div>

                {selectedDayRecords.length === 0 ? (
                  <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                    Nenhum pagamento ou recebimento com vencimento nesta data.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedDayRecords.map((r) => {
                      const rem = getEffectiveRemainingAmount(r);
                      return (
                        <div
                          key={r.id}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            borderLeft: `4px solid ${r.type === 'receita' ? '#10B981' : '#EF4444'}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: 13,
                                color: r.type === 'receita' ? '#10B981' : '#EF4444',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {r.type === 'receita' ? '+' : '-'} {formatEuro(r.amount, true)}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                            {r.site_name || 'Geral'} {r.entity_name ? `• ${r.entity_name}` : ''}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: rem > 0 ? '#F59E0B' : '#10B981' }}>
                              {rem > 0 ? `Em aberto: ${formatEuro(rem, true)}` : 'Liquidado'}
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {rem > 0 && (
                                <button
                                  type="button"
                                  className="btn-flat-secondary"
                                  style={{ padding: '3px 8px', fontSize: 11 }}
                                  onClick={() => handleOpenPartialModal(r)}
                                >
                                  Parcelar
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-flat-secondary"
                                style={{ padding: '3px 8px', fontSize: 11 }}
                                onClick={() => handleOpenEdit(r)}
                              >
                                Abrir
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 4 — RENTABILIDADE DAS OBRAS & CONTROLO DE ORÇAMENTO              */}
      {/* ==================================================================== */}
      {activeTab === 'rentabilidade' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Barra de Ordenação da Comparação entre Obras */}
          <div
            className="content-panel"
            style={{
              margin: 0,
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
                Rentabilidade, Margem Prevista & Controlo Orçamental por Obra
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Distinção rigorosa entre Valor Contratado com o Cliente (Receita) e Orçamento Interno de Custos
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowUpDown size={15} color="var(--text-muted)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Ordenar por:</span>
              <select
                value={profitSortBy}
                onChange={(e) => setProfitSortBy(e.target.value as any)}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                }}
              >
                <option value="mais_rentaveis">Obras Mais Rentáveis (Maior Resultado Previsto)</option>
                <option value="menos_rentaveis">Obras Menos Rentáveis (Menor Resultado Previsto)</option>
                <option value="maiores_desvios">Maiores Desvios de Orçamento (% Consumido)</option>
              </select>
            </div>
          </div>

          {/* Cards Detalhados por Obra */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sortedProfitability.map((sp) => {
              const healthBadge = {
                saudavel: { label: 'Orçamento Saudável (<80%)', color: '#10B981', bg: 'rgba(16,185,129,0.14)' },
                atencao: { label: 'Atenção: 80% do Orçamento', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)' },
                risco_elevado: { label: 'Risco Elevado: ≥90% do Orçamento', color: '#EA580C', bg: 'rgba(234,88,12,0.16)' },
                atingido: { label: 'Orçamento Atingido (100%)', color: '#DC2626', bg: 'rgba(220,38,38,0.16)' },
                ultrapassado: {
                  label: `Orçamento Ultrapassado (${sp.budgetCommittedPct.toFixed(1)}%)`,
                  color: '#EF4444',
                  bg: 'rgba(239,68,68,0.2)',
                },
              }[sp.financialHealth];

              // A barra visual preenche até 100%, mas o número exibe o valor real (ex: 125%)
              const visualBarWidth = Math.min(100, Math.max(0, sp.budgetCommittedPct));

              return (
                <div
                  key={sp.site.id}
                  className="content-panel"
                  style={{
                    margin: 0,
                    padding: 20,
                    borderLeft: `5px solid ${healthBadge.color}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                          {sp.site.name}
                        </h4>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 800,
                            backgroundColor: healthBadge.bg,
                            color: healthBadge.color,
                          }}
                        >
                          {healthBadge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        Cliente: <strong>{sp.site.client_name || 'Não definido'}</strong> • Estado:{' '}
                        <strong>{sp.site.status.toUpperCase()}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-flat-secondary"
                        style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => handleOpenSiteConfig(sp.site)}
                      >
                        <Settings2 size={14} />
                        Configurar Contrato & Orçamento
                      </button>
                      {onOpenSite && (
                        <button
                          type="button"
                          className="btn-flat-primary"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => onOpenSite(sp.site)}
                        >
                          Abrir Ficha da Obra →
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra de Consumo do Orçamento de Custos (Sem limitar a percentagem real a 100%) */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                      <span>
                        Consumo do Orçamento de Custos (Pago: {sp.budgetConsumedPct.toFixed(1)}% | Com Comprometidos:{' '}
                        <strong style={{ color: healthBadge.color }}>{sp.budgetCommittedPct.toFixed(1)}%</strong>)
                      </span>
                      <span>
                        {formatEuro(addMoney(sp.realizedCosts, sp.committedCosts))} de {formatEuro(sp.costBudget)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${visualBarWidth}%`,
                          height: '100%',
                          backgroundColor: healthBadge.color,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Grelha dos 10 Indicadores Financeiros da Obra */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                      gap: 10,
                    }}
                  >
                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                        1. VALOR CONTRATADO (CLIENTE)
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>
                        {formatEuro(sp.contractedValue, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                        2. ORÇAMENTO INTERNO CUSTOS
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>
                        {formatEuro(sp.costBudget, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: '#10B981', fontWeight: 700 }}>
                        3. RECEITAS RECEBIDAS
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#10B981', marginTop: 3 }}>
                        {formatEuro(sp.receivedRevenue, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: '#0D9488', fontWeight: 700 }}>
                        4. RECEITAS PENDENTES
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0D9488', marginTop: 3 }}>
                        {formatEuro(sp.pendingRevenue, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: '#EF4444', fontWeight: 700 }}>
                        5. CUSTOS REALIZADOS (PAGOS)
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#EF4444', marginTop: 3 }}>
                        {formatEuro(sp.realizedCosts, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: '#F59E0B', fontWeight: 700 }}>
                        6. CUSTOS COMPROMETIDOS
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#F59E0B', marginTop: 3 }}>
                        {formatEuro(sp.committedCosts, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                        7. CUSTOS AINDA PREVISTOS
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 3 }}>
                        {formatEuro(sp.additionalForecastCosts, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: '#2563EB', fontWeight: 700 }}>
                        8. SALDO DE CAIXA DA OBRA
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: sp.cashBalance >= 0 ? '#2563EB' : '#EF4444',
                          marginTop: 3,
                        }}
                      >
                        {formatEuro(sp.cashBalance, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                        9. RESULTADO PREVISTO FINAL
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: sp.forecastResult >= 0 ? '#10B981' : '#EF4444',
                          marginTop: 3,
                        }}
                      >
                        {formatEuro(sp.forecastResult, true)}
                      </div>
                    </div>

                    <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                        10. MARGEM PREVISTA (%)
                      </div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: sp.forecastMarginPct >= 0 ? '#10B981' : '#EF4444',
                          marginTop: 3,
                        }}
                      >
                        {sp.forecastMarginPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 5 — MEDIÇÕES E FATURAÇÃO DE OBRAS                                */}
      {/* ==================================================================== */}
      {activeTab === 'medicoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            className="content-panel"
            style={{
              margin: 0,
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                Autos de Medição, Adiantamentos e Trabalhos Adicionais
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Acompanhe os valores medidos em obra, aprovações do cliente, retenções de garantia e conversão direta em recebimentos.
              </p>
            </div>
            <button
              type="button"
              className="btn-flat-primary"
              onClick={handleOpenNewMeasurement}
              style={{ padding: '9px 16px', fontSize: 13, fontWeight: 700 }}
            >
              <Plus size={16} />
              Novo Auto de Medição
            </button>
          </div>

          <div className="content-panel" style={{ margin: 0 }}>
            <div className="flat-table-wrap">
              <table className="flat-table">
                <thead>
                  <tr>
                    <th>Nº / Tipo</th>
                    <th>Obra & Período</th>
                    <th>Descrição</th>
                    <th style={{ textAlign: 'right' }}>Medido (€)</th>
                    <th style={{ textAlign: 'right' }}>Aprovado (€)</th>
                    <th style={{ textAlign: 'right' }}>Retenção (€)</th>
                    <th style={{ textAlign: 'right' }}>Recebido (€)</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.filter(
                    (m) => selectedSiteId === 'todos' || m.site_id === selectedSiteId
                  ).length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                        Nenhum auto de medição registado para o filtro atual. Clique em "Novo Auto de Medição" para começar.
                      </td>
                    </tr>
                  ) : (
                    measurements
                      .filter((m) => selectedSiteId === 'todos' || m.site_id === selectedSiteId)
                      .map((m) => {
                        const st = MEASUREMENT_STATUS_MAP[m.status] || MEASUREMENT_STATUS_MAP.rascunho;
                        return (
                          <tr key={m.id}>
                            <td>
                              <div style={{ fontWeight: 800, color: 'var(--primary)' }}>
                                Medição #{m.measurement_number}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {m.kind === 'adiantamento'
                                  ? 'Adiantamento'
                                  : m.kind === 'trabalho_adicional'
                                  ? 'Trabalho Adicional'
                                  : 'Medição Normal'}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{m.site_name || 'Obra'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {formatDatePt(m.period_start)} a {formatDatePt(m.period_end)}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{m.description}</div>
                              {m.attachments && m.attachments.length > 0 && (
                                <a
                                  href={m.attachments[0]}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}
                                >
                                  Ver Auto Anexo ({m.attachments.length})
                                </a>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatEuro(m.measured_value, true)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>
                              {formatEuro(m.approved_value, true)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#F59E0B' }}>
                              {formatEuro(m.retention_value, true)} ({m.retention_pct}%)
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#10B981' }}>
                              {formatEuro(m.received_value, true)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  backgroundColor: st.bg,
                                  color: st.color,
                                }}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: 5 }}>
                                <button
                                  type="button"
                                  className="btn-flat-secondary"
                                  style={{ padding: '5px 8px', fontSize: 11, fontWeight: 700, color: '#10B981' }}
                                  onClick={() => handleGenerateReceivableFromMeasurement(m)}
                                  title="Gerar Conta a Receber associada a esta medição"
                                >
                                  + Gerar Recebimento
                                </button>
                                <button
                                  type="button"
                                  className="btn-flat-secondary"
                                  style={{ padding: '5px 8px' }}
                                  onClick={() => handleOpenEditMeasurement(m)}
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-flat-danger"
                                  style={{ padding: '5px 8px' }}
                                  onClick={() => handleDeleteMeasurement(m)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CRIAR / EDITAR MOVIMENTAÇÃO FINANCEIRA COMPLETA             */}
      {/* ==================================================================== */}
      {modalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="flat-modal-box"
            style={{ maxWidth: 680, width: '96%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                {editingRecord ? 'Editar Movimentação Financeira' : 'Nova Movimentação Financeira'}
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveRecord}>
              {/* Alternância Receita vs Despesa */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('despesa');
                    setFormCategory('custo_materiais');
                    setFormSubcategory(EXPENSE_CATEGORIES[0].subcategories[0]);
                    setFormEntityType('fornecedor');
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 13,
                    border: formType === 'despesa' ? '2px solid #EF4444' : '1px solid var(--border-color)',
                    backgroundColor: formType === 'despesa' ? 'rgba(239,68,68,0.14)' : 'var(--bg-card-subtle)',
                    color: formType === 'despesa' ? '#EF4444' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  SAÍDA / DESPESA (€)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('receita');
                    setFormCategory('receita_medicao');
                    setFormSubcategory(INCOME_CATEGORIES[1].subcategories[0]);
                    setFormEntityType('cliente');
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 13,
                    border: formType === 'receita' ? '2px solid #10B981' : '1px solid var(--border-color)',
                    backgroundColor: formType === 'receita' ? 'rgba(16,185,129,0.14)' : 'var(--bg-card-subtle)',
                    color: formType === 'receita' ? '#10B981' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  ENTRADA / RECEITA (€)
                </button>
              </div>

              <div className="flat-form-grid">
                <div className="flat-form-group full">
                  <label>Descrição Principal *</label>
                  <input
                    required
                    placeholder={
                      formType === 'receita'
                        ? 'Ex: Recebimento do Auto de Medição #2'
                        : 'Ex: Compra de 60 sacos de Cimento + Aço A500'
                    }
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Categoria *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as FinancialCategory;
                      setFormCategory(nextCat);
                      const def = getCategoryDefinition(nextCat, formType);
                      setFormSubcategory(def.subcategories[0] || '');
                    }}
                  >
                    {activeCategoryChoices.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label>Subcategoria</label>
                  <input
                    list="fin-subcat-list"
                    placeholder="Selecione ou digite..."
                    value={formSubcategory}
                    onChange={(e) => setFormSubcategory(e.target.value)}
                  />
                  <datalist id="fin-subcat-list">
                    {selectedCategoryDef.subcategories.map((sub) => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                </div>

                <div className="flat-form-group">
                  <label>Obra Associada (ou Geral da Empresa)</label>
                  <select value={formSiteId} onChange={(e) => setFormSiteId(e.target.value)}>
                    <option value="">Geral da Empresa (Escritório / Frota / Impostos)</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        Obra: {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label>
                    {formType === 'receita'
                      ? 'Cliente / Entidade Pagadora'
                      : 'Fornecedor / Subempreiteiro / Funcionário'}
                  </label>
                  <input
                    placeholder={
                      formType === 'receita' ? 'Nome do cliente...' : 'Ex: Leroy Merlin, Cimpor, João Silva...'
                    }
                    value={formEntity}
                    onChange={(e) => setFormEntity(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Valor Total (€) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Estado do Lançamento *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as FinancialStatus)}
                  >
                    <option value="pendente">
                      Pendente ({formType === 'receita' ? 'A Receber' : 'A Pagar'})
                    </option>
                    <option value="parcial">Parcialmente Liquidado</option>
                    <option value="pago">
                      {formType === 'receita' ? 'Recebido Integralmente' : 'Pago Integralmente'}
                    </option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                {formStatus === 'parcial' && (
                  <div className="flat-form-group">
                    <label>Valor Já Liquidado (€) *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formPaidAmount}
                      onChange={(e) => setFormPaidAmount(e.target.value)}
                    />
                  </div>
                )}

                <div className="flat-form-group">
                  <label>Data de Vencimento *</label>
                  <input
                    required
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                  />
                </div>

                {(formStatus === 'pago' || formStatus === 'parcial') && (
                  <div className="flat-form-group">
                    <label>Data Efetiva de Pagamento/Recebimento *</label>
                    <input
                      required
                      type="date"
                      value={formPaymentDate}
                      onChange={(e) => setFormPaymentDate(e.target.value)}
                    />
                  </div>
                )}

                <div className="flat-form-group">
                  <label>Método de Pagamento</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as PaymentMethod)}
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label>Nº Fatura / Recibo / Referência</label>
                  <input
                    placeholder="Ex: FT 2026/00142"
                    value={formInvoiceNumber}
                    onChange={(e) => setFormInvoiceNumber(e.target.value)}
                  />
                </div>

                {/* Upload de Comprovativo / Fatura */}
                <div className="flat-form-group full">
                  <label>Comprovativo / Fatura Digitalizada (Upload)</label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px dashed var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formReceiptUrl ? (
                        <a
                          href={formReceiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--primary)', fontWeight: 700 }}
                        >
                          Comprovativo carregado (Clique para visualizar)
                        </a>
                      ) : (
                        'Anexe recibo, fatura ou comprovativo bancário (Imagem ou PDF)'
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <label
                        className="btn-flat-secondary"
                        style={{
                          padding: '5px 10px',
                          fontSize: 11.5,
                          cursor: uploadingReceipt ? 'wait' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Upload size={13} />
                        {uploadingReceipt ? 'A carregar...' : 'Fazer Upload'}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          style={{ display: 'none' }}
                          disabled={uploadingReceipt}
                          onChange={(e) =>
                            handleReceiptFileUpload(e, (url) => setFormReceiptUrl(url))
                          }
                        />
                      </label>
                      {formReceiptUrl && (
                        <button
                          type="button"
                          className="btn-flat-danger"
                          style={{ padding: '5px 8px', fontSize: 11 }}
                          onClick={() => setFormReceiptUrl('')}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Campo de Observações (formNotes conectado ao formulário!) */}
                <div className="flat-form-group full">
                  <label>Observações Detalhadas</label>
                  <textarea
                    rows={2}
                    placeholder="Condições de pagamento, detalhes da entrega, notas fiscais ou observações internas..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      color: 'var(--text-main)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div className="flat-modal-footer">
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingRecord}>
                  {savingRecord
                    ? 'A guardar...'
                    : editingRecord
                    ? 'Guardar Alterações'
                    : 'Registar Movimentação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: PAGAMENTO PARCIAL & HISTÓRICO DE PARCELAS                   */}
      {/* ==================================================================== */}
      {partialModalRecord && (
        <div className="flat-modal-backdrop" onClick={() => setPartialModalRecord(null)}>
          <div
            className="flat-modal-box"
            style={{ maxWidth: 560, width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                Liquidação Parcial & Histórico de Parcelas
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setPartialModalRecord(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>
                  VALOR ORIGINAL
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                  {formatEuro(partialModalRecord.amount, true)}
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                <div style={{ fontSize: 10.5, color: '#10B981', fontWeight: 700 }}>
                  VALOR JÁ PAGO
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#10B981', marginTop: 2 }}>
                  {formatEuro(getEffectivePaidAmount(partialModalRecord), true)}
                </div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                <div style={{ fontSize: 10.5, color: '#EF4444', fontWeight: 700 }}>
                  VALOR RESTANTE
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#EF4444', marginTop: 2 }}>
                  {formatEuro(getEffectiveRemainingAmount(partialModalRecord), true)}
                </div>
              </div>
            </div>

            {/* Histórico de Parcelas Anteriores */}
            {Array.isArray(partialModalRecord.installments) &&
              partialModalRecord.installments.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Histórico de Parcelas Liquidadas ({partialModalRecord.installments.length})
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 130,
                      overflowY: 'auto',
                    }}
                  >
                    {partialModalRecord.installments.map((inst, i) => (
                      <div
                        key={inst.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          padding: '6px 10px',
                          borderRadius: 6,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <span>
                          <strong>#{i + 1}</strong> • {formatDatePt(inst.payment_date)}{' '}
                          {inst.reference ? `(${inst.reference})` : ''}
                        </span>
                        <strong style={{ color: '#10B981' }}>
                          {formatEuro(inst.amount, true)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {getEffectiveRemainingAmount(partialModalRecord) > 0 && (
              <form onSubmit={handleSavePartialPayment}>
                <div className="flat-form-grid">
                  <div className="flat-form-group">
                    <label>Valor desta Parcela (€) *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getEffectiveRemainingAmount(partialModalRecord)}
                      value={instAmount}
                      onChange={(e) => setInstAmount(e.target.value)}
                    />
                  </div>
                  <div className="flat-form-group">
                    <label>Data do Pagamento *</label>
                    <input
                      required
                      type="date"
                      value={instDate}
                      onChange={(e) => setInstDate(e.target.value)}
                    />
                  </div>
                  <div className="flat-form-group">
                    <label>Método</label>
                    <select
                      value={instMethod}
                      onChange={(e) => setInstMethod(e.target.value as PaymentMethod)}
                    >
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flat-form-group">
                    <label>Referência / Comprovativo</label>
                    <input
                      placeholder="Ex: TRF-9981"
                      value={instRef}
                      onChange={(e) => setInstRef(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flat-modal-footer">
                  <button
                    type="button"
                    className="btn-flat-secondary"
                    onClick={() => setPartialModalRecord(null)}
                  >
                    Fechar
                  </button>
                  <button type="submit" className="btn-flat-primary" disabled={savingPartial}>
                    {savingPartial ? 'A registar...' : 'Confirmar Parcela'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: CONFIGURAÇÃO DE CONTRATO VS ORÇAMENTO INTERNO DA OBRA       */}
      {/* ==================================================================== */}
      {configSiteModal && (
        <div className="flat-modal-backdrop" onClick={() => setConfigSiteModal(null)}>
          <div
            className="flat-modal-box"
            style={{ maxWidth: 520, width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                Parâmetros Financeiros — {configSiteModal.name}
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setConfigSiteModal(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSiteConfig}>
              <div className="flat-form-grid">
                <div className="flat-form-group full">
                  <label>Valor Contratado com o Cliente (Receita Contratual €) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={cfgContracted}
                    onChange={(e) => setCfgContracted(e.target.value)}
                  />
                  <small style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Preço global de venda acordado no contrato de empreitada com o dono da obra.
                  </small>
                </div>

                <div className="flat-form-group full">
                  <label>Orçamento Interno de Custos da Obra (€) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={cfgCostBudget}
                    onChange={(e) => setCfgCostBudget(e.target.value)}
                  />
                  <small style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Teto planeado de gastos diretos (materiais, mão de obra, subempreitadas e equipamentos).
                  </small>
                </div>

                <div className="flat-form-group full">
                  <label>Custos Adicionais Ainda Previstos até à Conclusão (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cfgAdditionalForecast}
                    onChange={(e) => setCfgAdditionalForecast(e.target.value)}
                  />
                  <small style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Deixe 0,00 € para usar automaticamente o saldo remanescente do orçamento interno.
                  </small>
                </div>
              </div>

              <div className="flat-modal-footer">
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setConfigSiteModal(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingConfigSite}>
                  {savingConfigSite ? 'A guardar...' : 'Guardar Configuração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: CRIAR / EDITAR AUTO DE MEDIÇÃO                              */}
      {/* ==================================================================== */}
      {measModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setMeasModalOpen(false)}>
          <div
            className="flat-modal-box"
            style={{ maxWidth: 640, width: '96%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                {editingMeas ? 'Editar Auto de Medição' : 'Novo Auto de Medição de Obra'}
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setMeasModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMeasurement}>
              <div className="flat-form-grid">
                <div className="flat-form-group">
                  <label>Obra *</label>
                  <select required value={mSiteId} onChange={(e) => setMSiteId(e.target.value)}>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label>Nº da Medição & Tipo *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="number"
                      min="1"
                      style={{ width: 80 }}
                      value={mNumber}
                      onChange={(e) => setMNumber(e.target.value)}
                    />
                    <select
                      style={{ flex: 1 }}
                      value={mKind}
                      onChange={(e) => setMKind(e.target.value as MeasurementKind)}
                    >
                      <option value="normal">Medição Normal</option>
                      <option value="adiantamento">Adiantamento Contratual</option>
                      <option value="trabalho_adicional">Trabalho Adicional / Extra</option>
                    </select>
                  </div>
                </div>

                <div className="flat-form-group full">
                  <label>Descrição dos Trabalhos Medidos *</label>
                  <input
                    required
                    value={mDescription}
                    onChange={(e) => setMDescription(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Início do Período Executado</label>
                  <input
                    type="date"
                    value={mPeriodStart}
                    onChange={(e) => setMPeriodStart(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Fim do Período Executado</label>
                  <input
                    type="date"
                    value={mPeriodEnd}
                    onChange={(e) => setMPeriodEnd(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Valor Medido (€) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={mMeasuredVal}
                    onChange={(e) => {
                      setMMeasuredVal(e.target.value);
                      if (!mApprovedVal) setMApprovedVal(e.target.value);
                    }}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Valor Aprovado pelo Cliente (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={mApprovedVal}
                    onChange={(e) => setMApprovedVal(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Retenção de Garantia (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={mRetentionPct}
                    onChange={(e) => setMRetentionPct(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Estado da Medição *</label>
                  <select
                    value={mStatus}
                    onChange={(e) => setMStatus(e.target.value as MeasurementStatus)}
                  >
                    {Object.entries(MEASUREMENT_STATUS_MAP).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group full">
                  <label>Anexo do Auto de Medição Assinado (Upload)</label>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {mAttachments.length > 0
                        ? `${mAttachments.length} ficheiro(s) anexado(s)`
                        : 'Nenhum auto anexado'}
                    </span>
                    <label className="btn-flat-secondary" style={{ padding: '5px 10px', fontSize: 11.5, cursor: 'pointer' }}>
                      <Upload size={13} /> Carregar Auto
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        style={{ display: 'none' }}
                        onChange={(e) =>
                          handleReceiptFileUpload(e, (url) =>
                            setMAttachments((prev) => [...prev, url])
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flat-modal-footer">
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setMeasModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingMeas}>
                  {savingMeas ? 'A guardar...' : 'Guardar Auto de Medição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: SINCRONIZAÇÃO DE CUSTOS OPERACIONAIS (PONTO/MATERIAIS/FROTA)*/}
      {/* ==================================================================== */}
      {syncModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setSyncModalOpen(false)}>
          <div
            className="flat-modal-box"
            style={{ maxWidth: 680, width: '96%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                Integração de Custos Operacionais (Mão de Obra, Materiais & Frota)
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setSyncModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 0 }}>
              Estes custos foram apurados automaticamente a partir dos pontos validados/sessões de equipa em obra, materiais alocados e manutenções de viaturas que ainda não possuem lançamento financeiro.
            </p>

            {totalPendingOperationalSync === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Todos os custos operacionais de mão de obra, materiais e equipamentos já estão sincronizados no financeiro sem duplicidade!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto', marginBottom: 16 }}>
                {unaccountedLabor.map((l) => (
                  <div
                    key={l.key}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        Mão de Obra: {l.employeeName} → Obra {l.siteName}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {l.regularHours}h normais + {l.overtimeHours}h extras • Taxa: {formatEuro(l.hourlyRate, true)}/h (+{l.socialChargesPct}% TSU)
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ color: '#EF4444' }}>{formatEuro(l.calculatedCost, true)}</strong>
                      <button
                        type="button"
                        className="btn-flat-primary"
                        style={{ padding: '5px 10px', fontSize: 11.5 }}
                        disabled={syncingOperational}
                        onClick={() => handleSyncSingleLaborItem(l)}
                      >
                        Imputar Custo
                      </button>
                    </div>
                  </div>
                ))}

                {unaccountedMatEquip.map((m) => (
                  <div
                    key={m.key}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {m.siteName ? `Obra: ${m.siteName}` : 'Frota / Geral'} • Data: {formatDatePt(m.date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ color: '#EF4444' }}>{formatEuro(m.amount, true)}</strong>
                      <button
                        type="button"
                        className="btn-flat-primary"
                        style={{ padding: '5px 10px', fontSize: 11.5 }}
                        disabled={syncingOperational}
                        onClick={() => handleSyncSingleMatEquipItem(m)}
                      >
                        Imputar Custo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flat-modal-footer">
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setSyncModalOpen(false)}
              >
                Fechar
              </button>
              {totalPendingOperationalSync > 0 && (
                <button
                  type="button"
                  className="btn-flat-primary"
                  disabled={syncingOperational}
                  onClick={handleSyncAllOperationalCosts}
                >
                  Sincronizar Todos ({totalPendingOperationalSync})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: CENTRAL DE EXPORTAÇÃO DE RELATÓRIOS (CSV, XLSX, PDF)        */}
      {/* ==================================================================== */}
      {reportModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setReportModalOpen(false)}>
          <div
            className="flat-modal-box"
            style={{ maxWidth: 520, width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Exportar Relatórios Financeiros</h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setReportModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flat-form-grid">
              <div className="flat-form-group full">
                <label>Tipo de Relatório *</label>
                <select
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value as FinancialReportType)}
                >
                  <option value="extrato">1. Extrato Financeiro Detalhado</option>
                  <option value="receitas_despesas">2. Relatório Mensal de Receitas vs Despesas</option>
                  <option value="contas_pendentes">3. Relatório de Contas Pendentes (A Pagar e A Receber)</option>
                  <option value="rentabilidade_obras">4. Relatório de Rentabilidade e Orçamento por Obra</option>
                  <option value="custos_categoria">5. Relatório de Custos por Categoria</option>
                  <option value="medicoes">6. Relatório de Medições e Faturação de Obras</option>
                </select>
              </div>

              <div className="flat-form-group full">
                <label>Formato de Exportação *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(
                    [
                      { id: 'xlsx', label: 'Excel (.xlsx)' },
                      { id: 'pdf', label: 'Documento PDF' },
                      { id: 'csv', label: 'Folha CSV (.csv)' },
                    ] as { id: ExportFormat; label: string }[]
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setSelectedExportFormat(fmt.id)}
                      style={{
                        padding: '10px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 12.5,
                        border:
                          selectedExportFormat === fmt.id
                            ? '2px solid var(--primary)'
                            : '1px solid var(--border-color)',
                        backgroundColor:
                          selectedExportFormat === fmt.id
                            ? 'var(--primary-subtle)'
                            : 'var(--bg-card-subtle)',
                        color:
                          selectedExportFormat === fmt.id ? 'var(--primary)' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flat-modal-footer">
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setReportModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-flat-primary"
                onClick={handleTriggerReportExport}
              >
                <Download size={15} /> Gerar & Transferir Relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
