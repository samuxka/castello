import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Building2,
  User,
  Users,
  MapPin,
  CheckCircle2,
  Circle,
  Trash2,
  X,
  Save,
  AlertCircle,
  AlertTriangle,
  Search,
  Filter,
  RotateCcw,
  Copy,
  Ban,
  ExternalLink,
  Bell,
  Layers,
  Package,
  Briefcase,
  CheckSquare,
  Sparkles,
  Link2,
  Download,
  Edit2,
  Eye,
  ShieldAlert,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import {
  AbsenceJustification,
  CalendarEvent,
  ConstructionSite,
  EmployeeProfile,
  EventCategory,
  EventPriority,
  EventRecurrence,
  EventStatus,
  SiteTask,
  Team,
} from '../types';
import {
  buildGoogleCalendarTemplateUrl,
  deleteCalendarEvent,
  generateIcsContent,
  getCalendarEvents,
  pushEventToGoogleCalendarApi,
  saveCalendarEvent,
  syncAllModulesWithCalendar,
  toggleCalendarEventCompleted,
} from '../lib/supabase';
import { customConfirm, customAlert } from '../context/DialogContext';

interface CalendarPageProps {
  companyId?: string;
  sites: ConstructionSite[];
  employees: EmployeeProfile[];
  teams?: Team[];
  tasks?: SiteTask[];
  justifications?: AbsenceJustification[];
  onOpenSite?: (siteId: string) => void;
  onDataChanged?: () => void;
  showNotice: (msg: string) => void;
}

type ViewMode = 'dia' | 'semana' | 'mes' | 'cronograma';

const STAGE_PRESETS = [
  'Início da obra',
  'Fundação',
  'Alvenaria',
  'Instalações elétricas e hidráulicas',
  'Reboco',
  'Pintura',
  'Acabamentos',
  'Conclusão e entrega',
];

const SUBTYPE_OPTIONS: Record<string, string[]> = {
  etapa_obra: STAGE_PRESETS,
  tarefa: ['Execução em Obra', 'Tarefa de Equipa', 'Tarefa Individual', 'Acabamento Técnico'],
  material: ['Entrega programada', 'Receção de equipamentos', 'Descarga de betão / agregados', 'Conferência de lote'],
  equipa: ['Alocação à obra', 'Férias aprovadas', 'Folga programada', 'Ausência justificada'],
  compromisso: [
    'Reunião com cliente',
    'Visita técnica',
    'Vistoria de obra',
    'Inspeção de segurança',
    'Avaliação de qualidade',
  ],
  personalizado: ['Evento corporativo', 'Marco interno', 'Treinamento', 'Outro'],
};

const MONTH_NAMES = [
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

const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const WEEKDAYS_FULL = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

function normalizeCategoryGroup(cat: EventCategory): 'etapa_obra' | 'tarefa' | 'material' | 'equipa' | 'compromisso' | 'personalizado' {
  switch (cat) {
    case 'etapa_obra':
    case 'obra':
      return 'etapa_obra';
    case 'tarefa':
      return 'tarefa';
    case 'material':
    case 'pagamento':
      return 'material';
    case 'equipa':
      return 'equipa';
    case 'compromisso':
    case 'reuniao':
    case 'inspecao':
      return 'compromisso';
    default:
      return 'personalizado';
  }
}

function getCategoryMeta(cat: EventCategory) {
  const group = normalizeCategoryGroup(cat);
  switch (group) {
    case 'etapa_obra':
      return {
        label: 'Etapa de Obra',
        color: '#3B82F6',
        bg: 'rgba(59, 130, 246, 0.14)',
        border: 'rgba(59, 130, 246, 0.38)',
      };
    case 'tarefa':
      return {
        label: 'Tarefa',
        color: '#8B5CF6',
        bg: 'rgba(139, 92, 246, 0.14)',
        border: 'rgba(139, 92, 246, 0.38)',
      };
    case 'material':
      return {
        label: 'Materiais',
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.14)',
        border: 'rgba(245, 158, 11, 0.38)',
      };
    case 'equipa':
      return {
        label: 'Equipa / RH',
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.14)',
        border: 'rgba(16, 185, 129, 0.38)',
      };
    case 'compromisso':
      return {
        label: 'Compromisso',
        color: '#EC4899',
        bg: 'rgba(236, 72, 153, 0.14)',
        border: 'rgba(236, 72, 153, 0.38)',
      };
    default:
      return {
        label: 'Personalizado',
        color: '#06B6D4',
        bg: 'rgba(6, 182, 212, 0.14)',
        border: 'rgba(6, 182, 212, 0.38)',
      };
  }
}

function getPriorityMeta(priority?: EventPriority) {
  switch (priority) {
    case 'urgente':
      return { label: 'Urgente', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
    case 'alta':
      return { label: 'Alta', color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)' };
    case 'baixa':
      return { label: 'Baixa', color: '#64748B', bg: 'rgba(100, 116, 139, 0.15)' };
    default:
      return { label: 'Média', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
  }
}

function getStatusMeta(status?: EventStatus, isBlocked?: boolean) {
  if (isBlocked) {
    return { label: 'Bloqueado / Crítico', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.16)' };
  }
  switch (status) {
    case 'concluido':
      return { label: 'Concluído', color: '#10B981', bg: 'rgba(16, 185, 129, 0.16)' };
    case 'em_andamento':
      return { label: 'Em andamento', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.16)' };
    case 'atrasado':
      return { label: 'Atrasado', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.16)' };
    case 'cancelado':
      return { label: 'Cancelado', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.14)' };
    default:
      return { label: 'Planeado', color: '#64748B', bg: 'rgba(100, 116, 139, 0.16)' };
  }
}

function formatDatePt(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(startStr: string, endStr: string): number {
  const s = new Date(startStr + 'T12:00:00').getTime();
  const e = new Date(endStr + 'T12:00:00').getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

function isDateWithinEvent(dateStr: string, evt: CalendarEvent): boolean {
  const start = evt.event_date;
  const end = evt.end_date && evt.end_date >= start ? evt.end_date : start;
  return dateStr >= start && dateStr <= end;
}

export function CalendarPage({
  companyId,
  sites,
  employees,
  teams = [],
  tasks = [],
  justifications = [],
  onOpenSite,
  onDataChanged,
  showNotice,
}: CalendarPageProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Visualização e Período
  const [viewMode, setViewMode] = useState<ViewMode>('mes');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => new Date().toISOString().slice(0, 10));

  // Filtros combináveis e Pesquisa
  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [showFiltersBar, setShowFiltersBar] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth > 768 : true
  );

  // Drag & Drop state
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [dragOverDateStr, setDragOverDateStr] = useState<string | null>(null);

  // Painéis e Modais
  const [selectedEventDetail, setSelectedEventDetail] = useState<CalendarEvent | null>(null);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [gcalSettingsOpen, setGcalSettingsOpen] = useState(false);
  const [stageGeneratorModalOpen, setStageGeneratorModalOpen] = useState(false);
  const [stageGenSiteId, setStageGenSiteId] = useState<string>('');
  const [selectedPresetStages, setSelectedPresetStages] = useState<string[]>(STAGE_PRESETS);

  // Configurações Google Calendar (persistidas por empresa)
  const gcalStorageKey = `castello_gcal_config_${companyId || 'default'}`;
  const [gcalConfig, setGcalConfig] = useState<{
    autoSyncOnSave: boolean;
    autoOpenGcalTab: boolean;
    googleAccessToken: string;
    managerEmail: string;
    defaultReminderMinutes: number;
  }>(() => {
    try {
      const saved = localStorage.getItem(gcalStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      autoSyncOnSave: true,
      autoOpenGcalTab: true,
      googleAccessToken: '',
      managerEmail: '',
      defaultReminderMinutes: 60,
    };
  });

  const saveGcalConfig = (next: typeof gcalConfig) => {
    setGcalConfig(next);
    try {
      localStorage.setItem(gcalStorageKey, JSON.stringify(next));
    } catch {}
  };

  // Modal de Criar / Editar Evento
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<EventCategory>('etapa_obra');
  const [formSubtype, setFormSubtype] = useState('Fundação');
  const [formCustomSubtype, setFormCustomSubtype] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formTeamId, setFormTeamId] = useState('');
  const [formSupplierName, setFormSupplierName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStartDate, setFormStartDate] = useState(selectedDateStr);
  const [formEndDate, setFormEndDate] = useState(selectedDateStr);
  const [formStartTime, setFormStartTime] = useState('08:30');
  const [formEndTime, setFormEndTime] = useState('17:30');
  const [formAllDay, setFormAllDay] = useState(false);
  const [formPriority, setFormPriority] = useState<EventPriority>('media');
  const [formStatus, setFormStatus] = useState<EventStatus>('planeado');
  const [formProgress, setFormProgress] = useState<number>(0);
  const [formDependencies, setFormDependencies] = useState<string[]>([]);
  const [formRecurrence, setFormRecurrence] = useState<EventRecurrence>('nenhuma');
  const [formReminderMinutes, setFormReminderMinutes] = useState<number>(60);
  const [formVisibleToClient, setFormVisibleToClient] = useState<boolean>(false);
  const [formSyncGoogle, setFormSyncGoogle] = useState<boolean>(true);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadAndSyncEvents = async () => {
    setLoading(true);
    try {
      const synced = await syncAllModulesWithCalendar({
        companyId,
        sites,
        tasks,
        justifications,
        teams,
      });
      setEvents(synced);
    } catch (err) {
      console.warn('Erro ao carregar calendário:', err);
      const fallback = await getCalendarEvents(companyId);
      setEvents(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAndSyncEvents();
  }, [companyId, sites.length, tasks.length, justifications.length, teams.length]);

  // ==========================================================================
  // DETEÇÃO DE CONFLITOS DE DISPONIBILIDADE E DEPENDÊNCIAS BLOQUEADAS
  // ==========================================================================
  const { conflictMap, blockedByDepMap } = useMemo(() => {
    const conflicts = new Map<string, string[]>();
    const blocked = new Map<string, string[]>();
    const eventById = new Map(events.map((e) => [e.id, e]));

    // 1. Verifica dependências não concluídas no Gantt
    for (const evt of events) {
      if (evt.status === 'concluido' || evt.status === 'cancelado') continue;
      if (evt.dependencies && evt.dependencies.length > 0) {
        const blockingTitles: string[] = [];
        for (const depId of evt.dependencies) {
          const depEvt = eventById.get(depId);
          if (depEvt && !depEvt.is_completed && depEvt.status !== 'concluido') {
            if (depEvt.status === 'atrasado' || (depEvt.end_date || depEvt.event_date) >= evt.event_date) {
              blockingTitles.push(depEvt.title);
            }
          }
        }
        if (blockingTitles.length > 0) {
          blocked.set(evt.id, blockingTitles);
        }
      }
    }

    // 2. Verifica conflitos de funcionários/equipas atribuídos a atividades simultâneas ou em férias/ausência
    const activeEvents = events.filter((e) => e.status !== 'cancelado');
    for (let i = 0; i < activeEvents.length; i++) {
      for (let j = i + 1; j < activeEvents.length; j++) {
        const a = activeEvents[i];
        const b = activeEvents[j];

        // Verifica se partilham o mesmo funcionário ou equipa
        const sameEmployee =
          Boolean(a.assigned_employee_id && b.assigned_employee_id && a.assigned_employee_id === b.assigned_employee_id) ||
          Boolean(
            !a.assigned_employee_id &&
              !b.assigned_employee_id &&
              a.assigned_employee_name &&
              b.assigned_employee_name &&
              a.assigned_employee_name.toLowerCase() === b.assigned_employee_name.toLowerCase()
          );

        const sameTeam = Boolean(a.assigned_team_id && b.assigned_team_id && a.assigned_team_id === b.assigned_team_id);

        if (!sameEmployee && !sameTeam) continue;

        // Verifica sobreposição de datas
        const aStart = a.event_date;
        const aEnd = a.end_date || a.event_date;
        const bStart = b.event_date;
        const bEnd = b.end_date || b.event_date;

        const datesOverlap = aStart <= bEnd && bStart <= aEnd;
        if (!datesOverlap) continue;

        // Se um deles é férias/folga/ausência e o outro é tarefa/compromisso/obra
        const aIsAbsence =
          normalizeCategoryGroup(a.category) === 'equipa' &&
          (a.event_subtype?.toLowerCase().includes('ausência') ||
            a.event_subtype?.toLowerCase().includes('ausencia') ||
            a.event_subtype?.toLowerCase().includes('férias') ||
            a.event_subtype?.toLowerCase().includes('ferias') ||
            a.event_subtype?.toLowerCase().includes('folga'));

        const bIsAbsence =
          normalizeCategoryGroup(b.category) === 'equipa' &&
          (b.event_subtype?.toLowerCase().includes('ausência') ||
            b.event_subtype?.toLowerCase().includes('ausencia') ||
            b.event_subtype?.toLowerCase().includes('férias') ||
            b.event_subtype?.toLowerCase().includes('ferias') ||
            b.event_subtype?.toLowerCase().includes('folga'));

        let timesOverlap = false;
        if (aIsAbsence || bIsAbsence) {
          timesOverlap = true;
        } else if (!a.all_day && !b.all_day && a.start_time && b.start_time) {
          const aSt = a.start_time;
          const aEt = a.end_time || '18:00';
          const bSt = b.start_time;
          const bEt = b.end_time || '18:00';
          timesOverlap = aSt < bEt && bSt < aEt;
        }

        if (timesOverlap) {
          const personLabel = a.assigned_employee_name || a.assigned_team_name || 'Responsável';
          const listA = conflicts.get(a.id) || [];
          listA.push(`Conflito de horário de ${personLabel} com "${b.title}"`);
          conflicts.set(a.id, listA);

          const listB = conflicts.get(b.id) || [];
          listB.push(`Conflito de horário de ${personLabel} com "${a.title}"`);
          conflicts.set(b.id, listB);
        }
      }
    }

    return { conflictMap: conflicts, blockedByDepMap: blocked };
  }, [events]);

  // ==========================================================================
  // FILTRAGEM COMBINÁVEL (FUNCIONA EM TODAS AS VISUALIZAÇÕES + GANTT)
  // ==========================================================================
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((evt) => {
      if (q) {
        const matchTitle = evt.title.toLowerCase().includes(q);
        const matchDesc = (evt.description || '').toLowerCase().includes(q);
        const matchSite = (evt.site_name || '').toLowerCase().includes(q);
        const matchResp = (evt.assigned_employee_name || '').toLowerCase().includes(q);
        const matchSupplier = (evt.supplier_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSite && !matchResp && !matchSupplier) return false;
      }

      if (siteFilter !== 'all' && evt.site_id !== siteFilter) return false;

      if (employeeFilter !== 'all') {
        const emp = employees.find((e) => e.id === employeeFilter);
        const matchId = evt.assigned_employee_id === employeeFilter;
        const matchName = emp && evt.assigned_employee_name?.toLowerCase() === emp.full_name.toLowerCase();
        if (!matchId && !matchName) return false;
      }

      if (teamFilter !== 'all') {
        const tm = teams.find((t) => t.id === teamFilter);
        const matchTeamId = evt.assigned_team_id === teamFilter;
        const matchTeamName = tm && evt.assigned_team_name?.toLowerCase() === tm.name.toLowerCase();
        const matchTeamMember = tm && evt.assigned_employee_id && (tm.leader_id === evt.assigned_employee_id || tm.member_ids?.includes(evt.assigned_employee_id));
        if (!matchTeamId && !matchTeamName && !matchTeamMember) return false;
      }

      if (categoryFilter !== 'all') {
        if (normalizeCategoryGroup(evt.category) !== categoryFilter) return false;
      }

      if (statusFilter !== 'all') {
        if ((evt.status || 'planeado') !== statusFilter) return false;
      }

      if (priorityFilter !== 'all') {
        if ((evt.priority || 'media') !== priorityFilter) return false;
      }

      const evtStart = evt.event_date;
      const evtEnd = evt.end_date || evt.event_date;
      if (dateRangeStart && evtEnd < dateRangeStart) return false;
      if (dateRangeEnd && evtStart > dateRangeEnd) return false;

      return true;
    });
  }, [
    events,
    searchQuery,
    siteFilter,
    employeeFilter,
    teamFilter,
    categoryFilter,
    statusFilter,
    priorityFilter,
    dateRangeStart,
    dateRangeEnd,
    employees,
    teams,
  ]);

  const hasActiveFilters = Boolean(
    searchQuery ||
      siteFilter !== 'all' ||
      employeeFilter !== 'all' ||
      teamFilter !== 'all' ||
      categoryFilter !== 'all' ||
      statusFilter !== 'all' ||
      priorityFilter !== 'all' ||
      dateRangeStart ||
      dateRangeEnd
  );

  const clearAllFilters = () => {
    setSearchQuery('');
    setSiteFilter('all');
    setEmployeeFilter('all');
    setTeamFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDateRangeStart('');
    setDateRangeEnd('');
  };

  // ==========================================================================
  // CÁLCULO DE PERÍODO E NAVEGAÇÃO (DIA, SEMANA, MÊS, CRONOGRAMA)
  // ==========================================================================
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Dias da semana atual (Segunda a Domingo)
  const currentWeekDays = useMemo(() => {
    const base = new Date(selectedDateStr + 'T12:00:00');
    const dayOfWeek = (base.getDay() + 6) % 7; // Seg=0 ... Dom=6
    const monday = new Date(base);
    monday.setDate(base.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        dateObj: d,
        dateStr: d.toISOString().slice(0, 10),
        dayNum: d.getDate(),
        dayNameShort: WEEKDAYS_SHORT[i],
        dayNameFull: WEEKDAYS_FULL[i],
      };
    });
  }, [selectedDateStr]);

  const handleNavigatePeriod = (dir: -1 | 1) => {
    if (viewMode === 'dia') {
      const nextStr = addDaysStr(selectedDateStr, dir);
      setSelectedDateStr(nextStr);
      setCurrentDate(new Date(nextStr + 'T12:00:00'));
    } else if (viewMode === 'semana') {
      const nextStr = addDaysStr(selectedDateStr, dir * 7);
      setSelectedDateStr(nextStr);
      setCurrentDate(new Date(nextStr + 'T12:00:00'));
    } else {
      const nextMonthDate = new Date(year, month + dir, 1);
      setCurrentDate(nextMonthDate);
      setSelectedDateStr(nextMonthDate.toISOString().slice(0, 10));
    }
  };

  const goToToday = () => {
    const now = new Date();
    const str = now.toISOString().slice(0, 10);
    setCurrentDate(now);
    setSelectedDateStr(str);
  };

  const periodLabel = useMemo(() => {
    if (viewMode === 'dia') {
      const d = new Date(selectedDateStr + 'T12:00:00');
      const wd = WEEKDAYS_FULL[(d.getDay() + 6) % 7];
      return `${wd}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
    }
    if (viewMode === 'semana') {
      const first = currentWeekDays[0];
      const last = currentWeekDays[6];
      return `${formatDatePt(first.dateStr)} — ${formatDatePt(last.dateStr)}`;
    }
    return `${MONTH_NAMES[month]} de ${year}`;
  }, [viewMode, selectedDateStr, currentWeekDays, month, year]);

  // ==========================================================================
  // INDICADORES DINÂMICOS (CARDS DE RESUMO) E CENTRAL DE ALERTAS
  // ==========================================================================
  const kpiMetrics = useMemo(() => {
    const in7DaysStr = addDaysStr(todayStr, 7);
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

    let periodStart = monthStart;
    let periodEnd = monthEnd;
    if (viewMode === 'dia') {
      periodStart = selectedDateStr;
      periodEnd = selectedDateStr;
    } else if (viewMode === 'semana') {
      periodStart = currentWeekDays[0].dateStr;
      periodEnd = currentWeekDays[6].dateStr;
    }

    const scheduledInPeriod = filteredEvents.filter((e) => {
      if (e.status === 'cancelado') return false;
      const eStart = e.event_date;
      const eEnd = e.end_date || e.event_date;
      return eStart <= periodEnd && eEnd >= periodStart;
    });

    const upcoming7Days = filteredEvents.filter((e) => {
      if (e.is_completed || e.status === 'concluido' || e.status === 'cancelado') return false;
      const due = e.end_date || e.event_date;
      return due >= todayStr && due <= in7DaysStr;
    });

    const overdueEvents = filteredEvents.filter((e) => {
      if (e.is_completed || e.status === 'concluido' || e.status === 'cancelado') return false;
      const due = e.end_date || e.event_date;
      return due < todayStr || e.status === 'atrasado';
    });

    const activeSitesIdsWithEvents = new Set(
      filteredEvents
        .filter((e) => e.site_id && e.status !== 'cancelado')
        .map((e) => e.site_id as string)
    );
    const activeSitesCount = sites.filter(
      (s) => s.status === 'ativa' && (activeSitesIdsWithEvents.has(s.id) || s.start_date)
    ).length;

    return {
      scheduledCount: scheduledInPeriod.length,
      upcomingCount: upcoming7Days.length,
      overdueCount: overdueEvents.length,
      activeSitesCount,
      upcomingList: upcoming7Days,
      overdueList: overdueEvents,
    };
  }, [filteredEvents, todayStr, year, month, viewMode, selectedDateStr, currentWeekDays, sites]);

  // Lista consolidada de Alertas Inteligentes (Sem duplicação)
  const systemAlerts = useMemo(() => {
    const list: {
      id: string;
      type: 'atraso' | 'prazo' | 'material' | 'inspecao' | 'conflito';
      title: string;
      subtitle: string;
      severity: 'danger' | 'warning' | 'info';
      event: CalendarEvent;
    }[] = [];

    for (const evt of events) {
      if (evt.status === 'cancelado') continue;
      const due = evt.end_date || evt.event_date;

      // 1. Conflitos de disponibilidade
      const cReasons = conflictMap.get(evt.id);
      if (cReasons && cReasons.length > 0) {
        list.push({
          id: `alert-conflict-${evt.id}`,
          type: 'conflito',
          title: `Conflito de Disponibilidade: ${evt.title}`,
          subtitle: cReasons[0],
          severity: 'danger',
          event: evt,
        });
      }

      if (evt.is_completed || evt.status === 'concluido') continue;

      // 2. Etapas e Tarefas Atrasadas
      if (due < todayStr) {
        list.push({
          id: `alert-overdue-${evt.id}`,
          type: 'atraso',
          title: `Atividade Atrasada: ${evt.title}`,
          subtitle: `Prazo expirou em ${formatDatePt(due)} • ${evt.site_name || 'Geral'}`,
          severity: 'danger',
          event: evt,
        });
      } else if (due <= addDaysStr(todayStr, 7)) {
        // 3. Entregas de materiais previstas
        if (normalizeCategoryGroup(evt.category) === 'material') {
          list.push({
            id: `alert-mat-${evt.id}`,
            type: 'material',
            title: `Entrega de Material Prevista: ${evt.title}`,
            subtitle: `Chegada em ${formatDatePt(due)} ${evt.supplier_name ? `• Fornecedor: ${evt.supplier_name}` : ''}`,
            severity: 'warning',
            event: evt,
          });
        } else if (normalizeCategoryGroup(evt.category) === 'compromisso') {
          // 4. Inspeções e reuniões agendadas
          list.push({
            id: `alert-insp-${evt.id}`,
            type: 'inspecao',
            title: `${evt.event_subtype || 'Compromisso'}: ${evt.title}`,
            subtitle: `Data: ${formatDatePt(evt.event_date)} ${evt.start_time ? `às ${evt.start_time}` : ''}`,
            severity: 'info',
            event: evt,
          });
        } else {
          // 5. Tarefas e etapas próximas do prazo
          list.push({
            id: `alert-soon-${evt.id}`,
            type: 'prazo',
            title: `Prazo Próximo: ${evt.title}`,
            subtitle: `Vence em ${formatDatePt(due)} • ${evt.site_name || 'Geral'}`,
            severity: 'warning',
            event: evt,
          });
        }
      }
    }

    return list;
  }, [events, conflictMap, todayStr]);

  // ==========================================================================
  // AÇÕES DE EVENTOS (CRIAR, EDITAR, DUPLICAR, REAGENDAR, CANCELAR, EXCLUIR)
  // ==========================================================================
  const openNewEventModal = (defaultDate?: string, defaultCategory?: EventCategory) => {
    const dStr = defaultDate || selectedDateStr;
    const cat = defaultCategory || 'etapa_obra';
    setEditingEvent(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory(cat);
    setFormSubtype(SUBTYPE_OPTIONS[normalizeCategoryGroup(cat)]?.[0] || '');
    setFormCustomSubtype('');
    setFormSiteId(siteFilter !== 'all' ? siteFilter : sites[0]?.id || '');
    setFormEmployeeId('');
    setFormTeamId('');
    setFormSupplierName('');
    setFormLocation('');
    setFormStartDate(dStr);
    setFormEndDate(dStr);
    setFormStartTime('08:30');
    setFormEndTime('17:30');
    setFormAllDay(cat === 'etapa_obra');
    setFormPriority('media');
    setFormStatus('planeado');
    setFormProgress(0);
    setFormDependencies([]);
    setFormRecurrence('nenhuma');
    setFormReminderMinutes(gcalConfig.defaultReminderMinutes);
    setFormVisibleToClient(cat === 'etapa_obra');
    setFormSyncGoogle(gcalConfig.autoSyncOnSave);
    setModalOpen(true);
  };

  const openEditEventModal = (evt: CalendarEvent) => {
    const normCat = normalizeCategoryGroup(evt.category);
    const presets = SUBTYPE_OPTIONS[normCat] || [];
    const isPreset = evt.event_subtype && presets.includes(evt.event_subtype);

    setEditingEvent(evt);
    setFormTitle(evt.title);
    setFormDescription(evt.description || '');
    setFormCategory(normCat);
    setFormSubtype(isPreset ? evt.event_subtype! : presets[0] || '');
    setFormCustomSubtype(!isPreset && evt.event_subtype ? evt.event_subtype : '');
    setFormSiteId(evt.site_id || '');
    setFormEmployeeId(evt.assigned_employee_id || '');
    setFormTeamId(evt.assigned_team_id || '');
    setFormSupplierName(evt.supplier_name || '');
    setFormLocation(evt.location || '');
    setFormStartDate(evt.event_date);
    setFormEndDate(evt.end_date || evt.event_date);
    setFormStartTime(evt.start_time || '08:30');
    setFormEndTime(evt.end_time || '17:30');
    setFormAllDay(Boolean(evt.all_day));
    setFormPriority(evt.priority || 'media');
    setFormStatus(evt.status || (evt.is_completed ? 'concluido' : 'planeado'));
    setFormProgress(typeof evt.progress === 'number' ? evt.progress : evt.is_completed ? 100 : 0);
    setFormDependencies(evt.dependencies || []);
    setFormRecurrence(evt.recurrence || 'nenhuma');
    setFormReminderMinutes(evt.reminder_minutes ?? 60);
    setFormVisibleToClient(Boolean(evt.visible_to_client));
    setFormSyncGoogle(false);
    setSelectedEventDetail(null);
    setModalOpen(true);
  };

  const handleDuplicateEvent = async (evt: CalendarEvent) => {
    const nextDay = addDaysStr(evt.event_date, 1);
    const duration = diffDays(evt.event_date, evt.end_date || evt.event_date);
    const nextEnd = addDaysStr(nextDay, Math.max(0, duration));

    const duplicated = await saveCalendarEvent(
      {
        ...evt,
        id: undefined,
        title: `${evt.title} (Cópia)`,
        event_date: nextDay,
        end_date: nextEnd,
        status: 'planeado',
        progress: 0,
        is_completed: false,
        source_module: 'manual',
        source_id: null,
      },
      companyId
    );
    await loadAndSyncEvents();
    setSelectedEventDetail(duplicated);
    showNotice('Evento duplicado com sucesso!');
  };

  const handleCancelEventStatus = async (evt: CalendarEvent) => {
    const confirmed = await customConfirm({
      title: 'Cancelar Atividade',
      message: `Deseja alterar o estado do evento "${evt.title}" para Cancelado?`,
      type: 'warning',
      confirmText: 'Cancelar Evento',
      cancelText: 'Voltar',
    });
    if (!confirmed) return;

    const updated = await saveCalendarEvent(
      {
        ...evt,
        status: 'cancelado',
        is_completed: false,
      },
      companyId
    );
    await loadAndSyncEvents();
    setSelectedEventDetail(updated);
    showNotice('Evento marcado como cancelado.');
  };

  const handleDeleteEvent = async (evt: CalendarEvent) => {
    const confirmed = await customConfirm({
      title: 'Eliminar Evento do Calendário',
      message: `Tem a certeza que deseja eliminar permanentemente "${evt.title}"?`,
      type: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    await deleteCalendarEvent(evt.id, companyId);
    setSelectedEventDetail(null);
    await loadAndSyncEvents();
    if (onDataChanged) onDataChanged();
    showNotice('Evento removido do calendário.');
  };

  const handleToggleCompleted = async (evt: CalendarEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await toggleCalendarEventCompleted(evt.id, companyId);
    await loadAndSyncEvents();
    if (onDataChanged) onDataChanged();
    showNotice(evt.is_completed ? 'Atividade reaberta.' : 'Atividade marcada como concluída!');
  };

  const handleQuickProgressChange = async (evt: CalendarEvent, newProgress: number) => {
    const clamped = Math.min(100, Math.max(0, newProgress));
    const isDone = clamped === 100;
    const nextStatus: EventStatus = isDone
      ? 'concluido'
      : clamped > 0
      ? 'em_andamento'
      : 'planeado';

    const updated = await saveCalendarEvent(
      {
        ...evt,
        progress: clamped,
        status: nextStatus,
        is_completed: isDone,
      },
      companyId
    );
    await loadAndSyncEvents();
    if (selectedEventDetail?.id === evt.id) {
      setSelectedEventDetail(updated);
    }
    if (onDataChanged) onDataChanged();
  };

  const handleSyncSingleEventWithGoogle = async (evt: CalendarEvent) => {
    if (gcalConfig.googleAccessToken) {
      const apiLink = await pushEventToGoogleCalendarApi(evt, gcalConfig.googleAccessToken);
      if (apiLink) {
        const updated = await saveCalendarEvent(
          { ...evt, google_calendar_synced: true, google_event_url: apiLink },
          companyId,
          true
        );
        await loadAndSyncEvents();
        setSelectedEventDetail(updated);
        showNotice('Evento criado diretamente no Google Calendar via API!');
        return;
      }
    }

    const templateUrl = buildGoogleCalendarTemplateUrl(evt);
    window.open(templateUrl, '_blank', 'noopener,noreferrer');
    const updated = await saveCalendarEvent(
      { ...evt, google_calendar_synced: true, google_event_url: templateUrl },
      companyId,
      true
    );
    await loadAndSyncEvents();
    if (selectedEventDetail?.id === evt.id) {
      setSelectedEventDetail(updated);
    }
    showNotice('Evento enviado para o Google Calendar do gestor!');
  };

  const handleExportIcs = () => {
    const ics = generateIcsContent(filteredEvents);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `castello-calendario-${todayStr}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Ficheiro .ICS exportado para Google Calendar / Outlook!');
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      customAlert({
        title: 'Campo Obrigatório',
        message: 'Por favor, informe o título do evento.',
        type: 'warning',
      });
      return;
    }

    if (!formStartDate) {
      customAlert({
        title: 'Data Obrigatória',
        message: 'Selecione a data de início do evento.',
        type: 'warning',
      });
      return;
    }

    if (formEndDate && formEndDate < formStartDate) {
      customAlert({
        title: 'Datas Inconsistentes',
        message: 'A data de conclusão não pode ser anterior à data de início.',
        type: 'error',
      });
      return;
    }

    if (!formAllDay && formStartDate === (formEndDate || formStartDate) && formStartTime && formEndTime && formEndTime <= formStartTime) {
      customAlert({
        title: 'Horário Inconsistente',
        message: 'A hora de conclusão deve ser posterior à hora de início no mesmo dia.',
        type: 'error',
      });
      return;
    }

    setSaving(true);
    try {
      const selectedSite = sites.find((s) => s.id === formSiteId);
      const selectedEmp = employees.find((emp) => emp.id === formEmployeeId);
      const selectedTeam = teams.find((t) => t.id === formTeamId);
      const finalSubtype = formCustomSubtype.trim() || formSubtype || null;
      const isCompleted = formStatus === 'concluido' || formProgress === 100;

      const savedEvt = await saveCalendarEvent(
        {
          id: editingEvent?.id,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          category: formCategory,
          event_subtype: finalSubtype,
          site_id: formSiteId || null,
          site_name: selectedSite ? selectedSite.name : null,
          assigned_employee_id: formEmployeeId || (selectedTeam?.leader_id ?? null),
          assigned_employee_name: selectedEmp
            ? selectedEmp.full_name
            : selectedTeam
            ? selectedTeam.leader_name
            : null,
          assigned_team_id: formTeamId || null,
          assigned_team_name: selectedTeam ? selectedTeam.name : null,
          supplier_name: formCategory === 'material' ? formSupplierName.trim() || null : null,
          location: formLocation.trim() || selectedSite?.address || null,
          event_date: formStartDate,
          end_date: formEndDate || formStartDate,
          start_time: formAllDay ? null : formStartTime,
          end_time: formAllDay ? null : formEndTime,
          all_day: formAllDay,
          priority: formPriority,
          status: isCompleted ? 'concluido' : formStatus,
          progress: isCompleted ? 100 : formProgress,
          dependencies: formDependencies,
          recurrence: formRecurrence,
          reminder_minutes: formReminderMinutes,
          visible_to_client: formVisibleToClient,
          source_module: editingEvent?.source_module || 'manual',
          source_id: editingEvent?.source_id || null,
          is_completed: isCompleted,
        },
        companyId
      );

      // Se a sincronização automática com o Google Calendar estiver marcada
      if (formSyncGoogle) {
        if (gcalConfig.googleAccessToken) {
          const apiLink = await pushEventToGoogleCalendarApi(savedEvt, gcalConfig.googleAccessToken);
          if (apiLink) {
            await saveCalendarEvent(
              { ...savedEvt, google_calendar_synced: true, google_event_url: apiLink },
              companyId,
              true
            );
          }
        } else if (gcalConfig.autoOpenGcalTab) {
          const gcalUrl = buildGoogleCalendarTemplateUrl(savedEvt);
          window.open(gcalUrl, '_blank', 'noopener,noreferrer');
          await saveCalendarEvent(
            { ...savedEvt, google_calendar_synced: true, google_event_url: gcalUrl },
            companyId,
            true
          );
        }
      }

      setModalOpen(false);
      await loadAndSyncEvents();
      if (onDataChanged) onDataChanged();
      showNotice(
        editingEvent
          ? 'Evento atualizado com sucesso!'
          : formSyncGoogle
          ? 'Evento registado e sincronizado com o Google Calendar!'
          : 'Evento agendado com sucesso!'
      );
    } catch (err: any) {
      customAlert({
        title: 'Erro ao Guardar Evento',
        message: err.message || 'Não foi possível guardar o evento.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // DRAG & DROP PARA REAGENDAR EVENTOS
  // ==========================================================================
  const handleDropOnDate = async (targetDateStr: string) => {
    setDragOverDateStr(null);
    if (!draggedEventId) return;
    const evt = events.find((e) => e.id === draggedEventId);
    setDraggedEventId(null);
    if (!evt || evt.event_date === targetDateStr) return;

    const duration = Math.max(0, diffDays(evt.event_date, evt.end_date || evt.event_date));
    const newEndDate = addDaysStr(targetDateStr, duration);

    await saveCalendarEvent(
      {
        ...evt,
        event_date: targetDateStr,
        end_date: newEndDate,
      },
      companyId
    );
    await loadAndSyncEvents();
    if (onDataChanged) onDataChanged();
    showNotice(`"${evt.title}" reagendado para ${formatDatePt(targetDateStr)}.`);
  };

  // ==========================================================================
  // GERADOR AUTOMÁTICO DE ETAPAS DE OBRA (PARA O CRONOGRAMA / GANTT)
  // ==========================================================================
  const handleGenerateSiteStages = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSite = sites.find((s) => s.id === stageGenSiteId);
    if (!targetSite) {
      customAlert({ title: 'Selecione uma Obra', message: 'Escolha a obra para gerar as etapas.', type: 'warning' });
      return;
    }
    if (selectedPresetStages.length === 0) {
      customAlert({ title: 'Selecione Etapas', message: 'Marque pelo menos uma etapa construtiva.', type: 'warning' });
      return;
    }

    const baseStart = targetSite.start_date || todayStr;
    const totalEnd = targetSite.expected_end_date && targetSite.expected_end_date > baseStart
      ? targetSite.expected_end_date
      : addDaysStr(baseStart, selectedPresetStages.length * 14);

    const totalDays = Math.max(selectedPresetStages.length * 5, diffDays(baseStart, totalEnd));
    const daysPerStage = Math.max(3, Math.floor(totalDays / selectedPresetStages.length));

    let prevStageId: string | null = null;
    for (let i = 0; i < selectedPresetStages.length; i++) {
      const stageName = selectedPresetStages[i];
      const stStart = addDaysStr(baseStart, i * daysPerStage);
      const stEnd = i === selectedPresetStages.length - 1 ? totalEnd : addDaysStr(stStart, daysPerStage - 1);
      const detId = `stage-${targetSite.id}-${i + 1}-${stageName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      await saveCalendarEvent(
        {
          id: detId,
          company_id: companyId || null,
          title: `${stageName} — ${targetSite.name}`,
          description: `Etapa construtiva (${i + 1}/${selectedPresetStages.length}): ${stageName} na obra ${targetSite.name}.`,
          event_date: stStart,
          end_date: stEnd,
          all_day: true,
          category: 'etapa_obra',
          event_subtype: stageName,
          site_id: targetSite.id,
          site_name: targetSite.name,
          assigned_employee_id: targetSite.manager_id || null,
          assigned_employee_name: targetSite.manager_name || 'Equipa de Engenharia',
          location: targetSite.address,
          priority: i === 0 || i === selectedPresetStages.length - 1 ? 'urgente' : 'alta',
          status: stEnd < todayStr ? 'concluido' : stStart <= todayStr ? 'em_andamento' : 'planeado',
          progress: stEnd < todayStr ? 100 : stStart <= todayStr ? 45 : 0,
          dependencies: prevStageId ? [prevStageId] : [],
          visible_to_client: true,
          source_module: 'manual',
          is_completed: stEnd < todayStr,
        },
        companyId,
        true
      );
      prevStageId = detId;
    }

    setStageGeneratorModalOpen(false);
    await loadAndSyncEvents();
    showNotice(`${selectedPresetStages.length} etapas adicionadas ao cronograma de ${targetSite.name}!`);
  };

  // ==========================================================================
  // DADOS AUXILIARES PARA AS 4 VISUALIZAÇÕES
  // ==========================================================================
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOffset = (firstDayOfMonth.getDay() + 6) % 7; // Seg=0 ... Dom=6

  const selectedDayEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => isDateWithinEvent(selectedDateStr, e))
      .sort((a, b) => {
        if (a.all_day && !b.all_day) return -1;
        if (!a.all_day && b.all_day) return 1;
        return (a.start_time || '00:00').localeCompare(b.start_time || '00:00');
      });
  }, [filteredEvents, selectedDateStr]);

  // Escala de tempo do Gantt
  const ganttData = useMemo(() => {
    const ganttEvents = filteredEvents
      .filter((e) => e.status !== 'cancelado')
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    if (ganttEvents.length === 0) {
      const start = addDaysStr(todayStr, -7);
      const end = addDaysStr(todayStr, 35);
      return { items: [], minDate: start, maxDate: end, totalDays: 42, columns: [] as string[] };
    }

    let minDate = ganttEvents[0].event_date;
    let maxDate = ganttEvents[0].end_date || ganttEvents[0].event_date;

    for (const ev of ganttEvents) {
      if (ev.event_date < minDate) minDate = ev.event_date;
      const eEnd = ev.end_date || ev.event_date;
      if (eEnd > maxDate) maxDate = eEnd;
    }

    minDate = addDaysStr(minDate, -3);
    maxDate = addDaysStr(maxDate, 7);
    const totalDays = Math.min(180, Math.max(21, diffDays(minDate, maxDate) + 1));
    const columns = Array.from({ length: totalDays }, (_, i) => addDaysStr(minDate, i));

    return { items: ganttEvents, minDate, maxDate, totalDays, columns };
  }, [filteredEvents, todayStr]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ==================================================================== */}
      {/* 1. CABEÇALHO PRINCIPAL DO CALENDÁRIO                                 */}
      {/* ==================================================================== */}
      <div
        className="view-header"
        style={{
          marginBottom: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 className="view-title" style={{ margin: 0 }}>
            Calendário
          </h1>
          <p className="view-description" style={{ margin: '4px 0 0' }}>
            Planeamento e acompanhamento das atividades
          </p>
        </div>

        <div className="calendar-header-actions">
          {/* Alternância entre visualizações: Dia, Semana, Mês e Cronograma */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
              overflowX: 'auto',
              maxWidth: '100%',
            }}
          >
            {(
              [
                { id: 'dia', label: 'Dia' },
                { id: 'semana', label: 'Semana' },
                { id: 'mes', label: 'Mês' },
                { id: 'cronograma', label: 'Cronograma' },
              ] as { id: ViewMode; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === tab.id ? 'var(--primary)' : 'transparent',
                  color: viewMode === tab.id ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Botão Alertas Inteligentes */}
          <button
            type="button"
            onClick={() => setAlertsPanelOpen(!alertsPanelOpen)}
            className="btn-flat-secondary"
            style={{
              padding: '7px 12px',
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
              borderColor: systemAlerts.some((a) => a.severity === 'danger') ? 'var(--danger)' : undefined,
            }}
            title="Central de Alertas e Conflitos"
          >
            <Bell size={15} color={systemAlerts.length > 0 ? 'var(--warning)' : 'var(--text-muted)'} />
            <span>Alertas</span>
            {systemAlerts.length > 0 && (
              <span
                style={{
                  backgroundColor: systemAlerts.some((a) => a.severity === 'danger') ? '#EF4444' : '#F59E0B',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: 10,
                }}
              >
                {systemAlerts.length}
              </span>
            )}
          </button>

          {/* Botão Google Calendar & Exportação */}
          <button
            type="button"
            onClick={() => setGcalSettingsOpen(true)}
            className="btn-flat-secondary"
            style={{ padding: '7px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Configurar Integração com Google Calendar"
          >
            <CalendarIcon size={15} color="var(--primary)" />
            <span>Google Calendar</span>
          </button>

          {/* Botão Novo Evento */}
          <button
            type="button"
            onClick={() => openNewEventModal()}
            className="btn-flat-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, padding: '8px 16px' }}
          >
            <Plus size={16} /> Novo evento
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. CARDS DE RESUMO DINÂMICOS                                         */}
      {/* ==================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
        }}
      >
        {/* Card 1: Eventos programados */}
        <div className="content-panel" style={{ padding: '16px 18px', margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Eventos programados</span>
            <CalendarIcon size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)' }}>
            {kpiMetrics.scheduledCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Atividades registadas no período selecionado
          </div>
        </div>

        {/* Card 2: Prazos próximos */}
        <div
          className="content-panel"
          style={{ padding: '16px 18px', margin: 0, cursor: 'pointer' }}
          onClick={() => {
            setDateRangeStart(todayStr);
            setDateRangeEnd(addDaysStr(todayStr, 7));
          }}
          title="Clique para filtrar atividades dos próximos 7 dias"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Prazos próximos</span>
            <Clock size={16} color="#F59E0B" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#F59E0B' }}>
            {kpiMetrics.upcomingCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Com vencimento nos próximos 7 dias
          </div>
        </div>

        {/* Card 3: Atividades atrasadas */}
        <div
          className="content-panel"
          style={{ padding: '16px 18px', margin: 0, cursor: 'pointer' }}
          onClick={() => setStatusFilter(statusFilter === 'atrasado' ? 'all' : 'atrasado')}
          title="Clique para filtrar atividades atrasadas"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Atividades atrasadas</span>
            <AlertTriangle size={16} color="#EF4444" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: kpiMetrics.overdueCount > 0 ? '#EF4444' : 'var(--success)' }}>
            {kpiMetrics.overdueCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Tarefas e etapas fora do prazo previsto
          </div>
        </div>

        {/* Card 4: Obras em andamento */}
        <div className="content-panel" style={{ padding: '16px 18px', margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Obras em andamento</span>
            <Building2 size={16} color="#10B981" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#10B981' }}>
            {kpiMetrics.activeSitesCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Empreitadas ativas com cronograma ativo
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* PAINEL EXPANSÍVEL DE ALERTAS E CONFLITOS                             */}
      {/* ==================================================================== */}
      {alertsPanelOpen && (
        <div
          className="content-panel"
          style={{
            margin: 0,
            padding: '16px 20px',
            borderLeft: '4px solid var(--warning)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} color="var(--warning)" />
              <strong style={{ fontSize: 14, color: 'var(--text-main)' }}>
                Central de Alertas Operacionais ({systemAlerts.length})
              </strong>
            </div>
            <button
              type="button"
              className="btn-flat-secondary"
              style={{ padding: '4px 8px', fontSize: 11 }}
              onClick={() => setAlertsPanelOpen(false)}
            >
              Fechar
            </button>
          </div>

          {systemAlerts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
              Nenhum alerta pendente ou conflito de disponibilidade detetado.
            </div>
          ) : (
            <div
              className="custom-scroll"
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 10,
              }}
            >
              {systemAlerts.map((al) => (
                <div
                  key={al.id}
                  onClick={() => setSelectedEventDetail(al.event)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: `1px solid ${
                      al.severity === 'danger'
                        ? 'rgba(239, 68, 68, 0.4)'
                        : al.severity === 'warning'
                        ? 'rgba(245, 158, 11, 0.4)'
                        : 'var(--border-color)'
                    }`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <AlertCircle
                    size={16}
                    color={al.severity === 'danger' ? '#EF4444' : al.severity === 'warning' ? '#F59E0B' : '#3B82F6'}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{al.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{al.subtitle}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. BARRA DE NAVEGAÇÃO DE PERÍODO + PESQUISA E FILTROS COMBINÁVEIS     */}
      {/* ==================================================================== */}
      <div
        className="content-panel"
        style={{
          margin: 0,
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Linha Superior: Navegação de Data + Hoje + Pesquisa Rápida */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => handleNavigatePeriod(-1)}
                className="btn-flat-secondary"
                style={{ padding: '6px 10px' }}
                title="Período Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="btn-flat-secondary"
                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => handleNavigatePeriod(1)}
                className="btn-flat-secondary"
                style={{ padding: '6px 10px' }}
                title="Próximo Período"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {periodLabel}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
            {/* Campo de Pesquisa */}
            <div className="calendar-search-box">
              <Search
                size={14}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Pesquisar título, descrição, obra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: 7,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              />
            </div>

            {viewMode === 'cronograma' && (
              <button
                type="button"
                onClick={() => {
                  setStageGenSiteId(siteFilter !== 'all' ? siteFilter : sites[0]?.id || '');
                  setStageGeneratorModalOpen(true);
                }}
                className="btn-flat-secondary"
                style={{ padding: '7px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <Layers size={14} color="var(--primary)" /> + Configurar Etapas da Obra
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFiltersBar(!showFiltersBar)}
              className="btn-flat-secondary"
              style={{ padding: '7px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Filter size={14} />
              <span>Filtros</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="btn-flat-danger"
                style={{ padding: '7px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <RotateCcw size={13} /> Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Linha Inferior: Filtros Combináveis */}
        {showFiltersBar && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 10,
              paddingTop: 12,
              borderTop: '1px solid var(--border-color)',
            }}
          >
            {/* Filtro por Obra */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                OBRA
              </label>
              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="all">Todas as Obras</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Funcionário */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                FUNCIONÁRIO
              </label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="all">Todos os Funcionários</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Equipa */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                EQUIPA
              </label>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="all">Todas as Equipas</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Tipo de Evento */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                TIPO DE EVENTO
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="all">Todos os Tipos</option>
                <option value="etapa_obra">Etapas de Obras</option>
                <option value="tarefa">Tarefas</option>
                <option value="material">Materiais & Entregas</option>
                <option value="equipa">Equipas, Férias & RH</option>
                <option value="compromisso">Compromissos & Vistorias</option>
                <option value="personalizado">Eventos Personalizados</option>
              </select>
            </div>

            {/* Filtro por Estado */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                ESTADO
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="all">Todos os Estados</option>
                <option value="planeado">Planeado</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {/* Filtro por Prioridade */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                PRIORIDADE
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="all">Todas as Prioridades</option>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            {/* Intervalo de Datas */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                DE (DATA)
              </label>
              <input
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                ATÉ (DATA)
              </label>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 4. ÁREA PRINCIPAL DE VISUALIZAÇÃO                                    */}
      {/* ==================================================================== */}
      {loading ? (
        <div className="content-panel" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          A carregar e sincronizar cronograma da empresa...
        </div>
      ) : (
        <>
          {/* ================================================================ */}
          {/* VISUALIZAÇÃO 1: MENSAL (GRELHA + PAINEL DO DIA SELECIONADO)      */}
          {/* ================================================================ */}
          {viewMode === 'mes' && (
            <div className="calendar-month-layout">
              {/* Grelha Mensal */}
              <div className="content-panel calendar-month-panel" style={{ margin: 0, minWidth: 0, overflow: 'hidden' }}>
                <div
                  className="calendar-month-grid"
                  style={{
                    marginBottom: 8,
                  }}
                >
                  {WEEKDAYS_SHORT.map((wd) => (
                    <div
                      key={wd}
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        padding: '4px 0',
                        minWidth: 0,
                      }}
                    >
                      {wd}
                    </div>
                  ))}
                </div>

                <div className="calendar-month-grid">
                  {/* Células vazias antes do dia 1 */}
                  {Array.from({ length: startingDayOffset }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="calendar-month-cell"
                      style={{
                        minWidth: 0,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        border: '1px dashed var(--border-color)',
                        opacity: 0.35,
                      }}
                    />
                  ))}

                  {/* Dias do mês */}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                    const dayEvts = filteredEvents.filter((e) => isDateWithinEvent(dateStr, e));
                    const isSelected = dateStr === selectedDateStr;
                    const isToday = dateStr === todayStr;
                    const isDragTarget = dragOverDateStr === dateStr;

                    return (
                      <div
                        key={dateStr}
                        className="calendar-month-cell"
                        onClick={() => setSelectedDateStr(dateStr)}
                        onDoubleClick={() => openNewEventModal(dateStr)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverDateStr !== dateStr) setDragOverDateStr(dateStr);
                        }}
                        onDragLeave={() => {
                          if (dragOverDateStr === dateStr) setDragOverDateStr(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropOnDate(dateStr);
                        }}
                        style={{
                          minWidth: 0,
                          overflow: 'hidden',
                          borderRadius: 8,
                          backgroundColor: isDragTarget
                            ? 'var(--primary-subtle)'
                            : isSelected
                            ? 'var(--primary-subtle)'
                            : 'var(--bg-card-subtle)',
                          border: isDragTarget
                            ? '2px dashed var(--primary)'
                            : isSelected
                            ? '2px solid var(--primary)'
                            : isToday
                            ? '1px solid var(--primary)'
                            : '1px solid var(--border-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              flexShrink: 0,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: isToday || isSelected ? 800 : 600,
                              backgroundColor: isToday ? 'var(--primary)' : 'transparent',
                              color: isToday ? '#fff' : isSelected ? 'var(--primary)' : 'var(--text-main)',
                            }}
                          >
                            {dayNum}
                          </span>
                          {dayEvts.length > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                              {dayEvts.length}
                            </span>
                          )}
                        </div>

                        {/* Eventos em Texto (Desktop) */}
                        <div
                          className="calendar-event-pill-desktop"
                          style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, minWidth: 0, width: '100%' }}
                        >
                          {dayEvts.slice(0, 3).map((ev) => {
                            const catMeta = getCategoryMeta(ev.category);
                            const hasConflict = conflictMap.has(ev.id);
                            return (
                              <div
                                key={ev.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedEventId(ev.id);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDateStr(dateStr);
                                  setSelectedEventDetail(ev);
                                }}
                                title={`${ev.title} (${catMeta.label})${ev.site_name ? ` • ${ev.site_name}` : ''}`}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '2px 5px',
                                  borderRadius: 4,
                                  backgroundColor: catMeta.bg,
                                  color: catMeta.color,
                                  borderLeft: `3px solid ${hasConflict ? '#EF4444' : catMeta.color}`,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  minWidth: 0,
                                  maxWidth: '100%',
                                  textDecoration:
                                    ev.is_completed || ev.status === 'cancelado' ? 'line-through' : 'none',
                                  opacity: ev.is_completed || ev.status === 'cancelado' ? 0.6 : 1,
                                }}
                              >
                                {ev.start_time && !ev.all_day ? `${ev.start_time} ` : ''}
                                {ev.title}
                              </div>
                            );
                          })}
                          {dayEvts.length > 3 && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--primary)',
                                paddingLeft: 4,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              +{dayEvts.length - 3} eventos
                            </div>
                          )}
                        </div>

                        {/* Indicadores Compactos por Cor (Mobile) */}
                        {dayEvts.length > 0 && (
                          <div className="calendar-event-dots-mobile">
                            {dayEvts.slice(0, 4).map((ev) => {
                              const catMeta = getCategoryMeta(ev.category);
                              return (
                                <span
                                  key={ev.id}
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    backgroundColor: catMeta.color,
                                    display: 'inline-block',
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Painel Lateral do Dia Selecionado */}
              <div className="content-panel" style={{ padding: 18, margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: 12,
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                      Agenda do Dia
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0' }}>
                      {formatDatePt(selectedDateStr)}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => openNewEventModal(selectedDateStr)}
                    className="btn-flat-primary"
                    style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                    <CalendarIcon size={32} style={{ opacity: 0.25, marginBottom: 8 }} />
                    <p style={{ fontSize: 13, margin: 0 }}>Nenhuma atividade programada para esta data.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedDayEvents.map((ev) => {
                      const catMeta = getCategoryMeta(ev.category);
                      const stMeta = getStatusMeta(ev.status, blockedByDepMap.has(ev.id));
                      const prioMeta = getPriorityMeta(ev.priority);
                      const hasConflict = conflictMap.has(ev.id);

                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEventDetail(ev)}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: `1px solid ${hasConflict ? '#EF4444' : 'var(--border-color)'}`,
                            borderLeft: `4px solid ${catMeta.color}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: catMeta.bg,
                                  color: catMeta.color,
                                }}
                              >
                                {ev.event_subtype || catMeta.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: stMeta.bg,
                                  color: stMeta.color,
                                }}
                              >
                                {stMeta.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  backgroundColor: prioMeta.bg,
                                  color: prioMeta.color,
                                }}
                              >
                                {prioMeta.label}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleToggleCompleted(ev, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              title={ev.is_completed ? 'Reabrir' : 'Concluir'}
                            >
                              {ev.is_completed ? (
                                <CheckCircle2 size={18} color="var(--success)" />
                              ) : (
                                <Circle size={18} color="var(--text-muted)" />
                              )}
                            </button>
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              textDecoration: ev.is_completed ? 'line-through' : 'none',
                            }}
                          >
                            {ev.title}
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} />
                              {ev.all_day || !ev.start_time
                                ? 'Dia inteiro'
                                : `${ev.start_time}${ev.end_time ? ` - ${ev.end_time}` : ''}`}
                            </span>
                            {ev.site_name && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Building2 size={12} /> {ev.site_name}
                              </span>
                            )}
                            {(ev.assigned_employee_name || ev.assigned_team_name) && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <User size={12} /> {ev.assigned_employee_name || ev.assigned_team_name}
                              </span>
                            )}
                          </div>

                          {hasConflict && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertTriangle size={12} /> {conflictMap.get(ev.id)?.[0]}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* VISUALIZAÇÃO 2: SEMANAL (7 DIAS POR HORÁRIO + SOBREPOSIÇÕES)     */}
          {/* ================================================================ */}
          {viewMode === 'semana' && (
            <div className="content-panel" style={{ padding: 16, margin: 0, overflowX: 'auto' }}>
              <div style={{ minWidth: 860 }}>
                {/* Cabeçalho dos 7 dias da semana */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '68px repeat(7, minmax(0, 1fr))',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center' }}>
                    HORA
                  </div>
                  {currentWeekDays.map((wd) => {
                    const isToday = wd.dateStr === todayStr;
                    const isSelected = wd.dateStr === selectedDateStr;
                    return (
                      <div
                        key={wd.dateStr}
                        onClick={() => setSelectedDateStr(wd.dateStr)}
                        style={{
                          textAlign: 'center',
                          cursor: 'pointer',
                          padding: '6px 4px',
                          borderRadius: 8,
                          minWidth: 0,
                          backgroundColor: isSelected ? 'var(--primary-subtle)' : 'transparent',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {wd.dayNameShort.toUpperCase()}
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: isToday ? 'var(--primary)' : 'var(--text-main)',
                            marginTop: 2,
                          }}
                        >
                          {wd.dayNum}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Faixa de Eventos Dia Inteiro / Etapas Multi-dia */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '68px repeat(7, minmax(0, 1fr))',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '8px 0',
                    gap: 4,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center' }}>
                    DIA INTEIRO
                  </div>
                  {currentWeekDays.map((wd) => {
                    const allDayEvts = filteredEvents.filter(
                      (e) => isDateWithinEvent(wd.dateStr, e) && (e.all_day || !e.start_time)
                    );
                    return (
                      <div
                        key={`allday-${wd.dateStr}`}
                        style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 3px', minHeight: 28, minWidth: 0, overflow: 'hidden' }}
                      >
                        {allDayEvts.map((ev) => {
                          const catMeta = getCategoryMeta(ev.category);
                          return (
                            <div
                              key={ev.id}
                              onClick={() => setSelectedEventDetail(ev)}
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '3px 6px',
                                borderRadius: 4,
                                backgroundColor: catMeta.bg,
                                color: catMeta.color,
                                borderLeft: `3px solid ${catMeta.color}`,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                              }}
                            >
                              {ev.title}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Grelha Horária (07:00 às 20:00) */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {Array.from({ length: 14 }, (_, i) => i + 7).map((hour) => {
                    const hourPrefix = String(hour).padStart(2, '0');
                    return (
                      <div
                        key={hour}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '68px repeat(7, minmax(0, 1fr))',
                          minHeight: 54,
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            padding: '6px 8px 0 0',
                            borderRight: '1px solid var(--border-color)',
                          }}
                        >
                          {hourPrefix}:00
                        </div>

                        {currentWeekDays.map((wd) => {
                          const slotEvts = filteredEvents.filter((e) => {
                            if (!isDateWithinEvent(wd.dateStr, e)) return false;
                            if (e.all_day || !e.start_time) return false;
                            const stHour = parseInt(e.start_time.split(':')[0], 10);
                            return stHour === hour;
                          });

                          const hasOverlap = slotEvts.length > 1;

                          return (
                            <div
                              key={`${wd.dateStr}-${hour}`}
                              onDoubleClick={() => {
                                setFormStartTime(`${hourPrefix}:00`);
                                setFormEndTime(`${String(hour + 1).padStart(2, '0')}:00`);
                                openNewEventModal(wd.dateStr);
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDropOnDate(wd.dateStr)}
                              style={{
                                borderRight: '1px solid var(--border-color)',
                                padding: 3,
                                display: 'flex',
                                gap: 3,
                                minWidth: 0,
                                overflow: 'hidden',
                                backgroundColor: hasOverlap ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                              }}
                            >
                              {slotEvts.map((ev) => {
                                const catMeta = getCategoryMeta(ev.category);
                                const startH = parseInt((ev.start_time || '08:00').split(':')[0], 10);
                                const endH = parseInt((ev.end_time || `${startH + 1}:00`).split(':')[0], 10);
                                const durationHours = Math.max(1, endH - startH);

                                return (
                                  <div
                                    key={ev.id}
                                    draggable
                                    onDragStart={() => setDraggedEventId(ev.id)}
                                    onClick={() => setSelectedEventDetail(ev)}
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      padding: '4px 6px',
                                      borderRadius: 5,
                                      backgroundColor: catMeta.bg,
                                      color: catMeta.color,
                                      border: `1px solid ${hasOverlap || conflictMap.has(ev.id) ? '#EF4444' : catMeta.border}`,
                                      borderLeft: `3px solid ${catMeta.color}`,
                                      cursor: 'pointer',
                                      fontSize: 10,
                                    }}
                                  >
                                    <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {ev.title}
                                    </div>
                                    <div style={{ fontSize: 9, opacity: 0.9 }}>
                                      {ev.start_time} - {ev.end_time || `${startH + 1}:00`} ({durationHours}h)
                                    </div>
                                    {ev.site_name && (
                                      <div style={{ fontSize: 9, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {ev.site_name}
                                      </div>
                                    )}
                                    {hasOverlap && (
                                      <div style={{ fontSize: 9, fontWeight: 800, color: '#EF4444', marginTop: 2 }}>
                                        Sobreposição
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* VISUALIZAÇÃO 3: DIÁRIA (ORDEM CRONOLÓGICA DETALHADA)             */}
          {/* ================================================================ */}
          {viewMode === 'dia' && (
            <div className="content-panel" style={{ padding: 20, margin: 0 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Programação Cronológica — {formatDatePt(selectedDateStr)}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {selectedDayEvents.length} atividade(s) registada(s) para este dia
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openNewEventModal(selectedDateStr)}
                  className="btn-flat-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                >
                  <Plus size={14} /> Novo Evento neste Dia
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                  <CalendarIcon size={36} style={{ opacity: 0.25, marginBottom: 10 }} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum compromisso agendado para {formatDatePt(selectedDateStr)}.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedDayEvents.map((ev) => {
                    const catMeta = getCategoryMeta(ev.category);
                    const prioMeta = getPriorityMeta(ev.priority);
                    const stMeta = getStatusMeta(ev.status, blockedByDepMap.has(ev.id));
                    const hasConflict = conflictMap.has(ev.id);

                    return (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEventDetail(ev)}
                        style={{
                          padding: '14px 18px',
                          borderRadius: 10,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: `1px solid ${hasConflict ? '#EF4444' : 'var(--border-color)'}`,
                          borderLeft: `5px solid ${catMeta.color}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 14,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                          {/* Bloco de Horário */}
                          <div
                            style={{
                              minWidth: 96,
                              padding: '8px 10px',
                              borderRadius: 8,
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)' }}>
                              {ev.all_day || !ev.start_time ? 'DIA INTEIRO' : ev.start_time}
                            </div>
                            {!ev.all_day && ev.end_time && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                até {ev.end_time}
                              </div>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  backgroundColor: catMeta.bg,
                                  color: catMeta.color,
                                }}
                              >
                                {ev.event_subtype || catMeta.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  backgroundColor: prioMeta.bg,
                                  color: prioMeta.color,
                                }}
                              >
                                Prioridade {prioMeta.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  backgroundColor: stMeta.bg,
                                  color: stMeta.color,
                                }}
                              >
                                {stMeta.label}
                              </span>
                            </div>

                            <h4
                              style={{
                                fontSize: 15,
                                fontWeight: 800,
                                color: 'var(--text-main)',
                                margin: '0 0 4px',
                                textDecoration: ev.is_completed ? 'line-through' : 'none',
                              }}
                            >
                              {ev.title}
                            </h4>

                            {ev.description && (
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
                                {ev.description}
                              </p>
                            )}

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
                              {ev.site_name && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Building2 size={13} color="var(--primary)" /> <strong>Obra:</strong> {ev.site_name}
                                </span>
                              )}
                              {(ev.assigned_employee_name || ev.assigned_team_name) && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <User size={13} color="var(--primary)" /> <strong>Responsável:</strong>{' '}
                                  {ev.assigned_employee_name || ev.assigned_team_name}
                                </span>
                              )}
                              {ev.supplier_name && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Package size={13} color="#F59E0B" /> <strong>Fornecedor:</strong> {ev.supplier_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ações Rápidas na Linha Diária */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggleCompleted(ev)}
                            className={ev.is_completed ? 'btn-flat-secondary' : 'btn-flat-success'}
                            style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <CheckCircle2 size={13} />
                            {ev.is_completed ? 'Concluído' : 'Concluir'}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditEventModal(ev)}
                            className="btn-flat-secondary"
                            style={{ padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Edit2 size={13} /> Editar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* VISUALIZAÇÃO 4: CRONOGRAMA (GRÁFICO DE GANTT)                    */}
          {/* ================================================================ */}
          {viewMode === 'cronograma' && (
            <div className="content-panel" style={{ padding: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Legenda de Estados do Gantt */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Cronograma de Etapas e Obras (Gantt)
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Acompanhamento de etapas, progresso físico, prazos e dependências entre atividades
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 11 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#10B981' }} /> Concluído
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#3B82F6' }} /> Em andamento
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#F59E0B' }} /> Atrasado
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#64748B' }} /> Planeado
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#EF4444' }} /> Bloqueado / Crítico
                  </span>
                </div>
              </div>

              {ganttData.items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                  <Layers size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhuma etapa ou atividade registada para os filtros atuais.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStageGenSiteId(sites[0]?.id || '');
                      setStageGeneratorModalOpen(true);
                    }}
                    className="btn-flat-primary"
                    style={{ marginTop: 10, fontSize: 12 }}
                  >
                    + Gerar Etapas Construtivas da Obra
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 980 }}>
                    {/* Cabeçalho do Gantt */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '280px 140px 130px 90px 1fr',
                        borderBottom: '2px solid var(--border-color)',
                        paddingBottom: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        gap: 8,
                      }}
                    >
                      <div>Atividade / Etapa & Obra</div>
                      <div>Início → Conclusão</div>
                      <div>Responsável</div>
                      <div>Progresso</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 6px' }}>
                        <span>{formatDatePt(ganttData.minDate)}</span>
                        <span style={{ color: 'var(--primary)' }}>Hoje ({formatDatePt(todayStr)})</span>
                        <span>{formatDatePt(ganttData.maxDate)}</span>
                      </div>
                    </div>

                    {/* Linhas de Etapas no Gantt */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {ganttData.items.map((item) => {
                        const isBlocked = blockedByDepMap.has(item.id) || (item.priority === 'urgente' && item.status === 'atrasado');
                        const stMeta = getStatusMeta(item.status, isBlocked);
                        const startOffset = Math.max(0, diffDays(ganttData.minDate, item.event_date));
                        const endStr = item.end_date && item.end_date >= item.event_date ? item.end_date : item.event_date;
                        const durationDays = Math.max(1, diffDays(item.event_date, endStr) + 1);

                        const leftPct = Math.min(96, Math.max(0, (startOffset / ganttData.totalDays) * 100));
                        const widthPct = Math.min(100 - leftPct, Math.max(3, (durationDays / ganttData.totalDays) * 100));

                        const todayOffset = diffDays(ganttData.minDate, todayStr);
                        const todayPct = Math.min(100, Math.max(0, (todayOffset / ganttData.totalDays) * 100));

                        const progressNum = typeof item.progress === 'number' ? item.progress : item.is_completed ? 100 : 0;

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedEventDetail(item)}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '280px 140px 130px 90px 1fr',
                              alignItems: 'center',
                              gap: 8,
                              padding: '10px 4px',
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                            }}
                          >
                            {/* Coluna 1: Atividade + Obra + Dependências */}
                            <div style={{ minWidth: 0, paddingRight: 8 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'var(--text-main)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {item.title}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 10, color: 'var(--text-muted)' }}>
                                {item.site_name && <span>{item.site_name}</span>}
                                {item.dependencies && item.dependencies.length > 0 && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      color: blockedByDepMap.has(item.id) ? '#EF4444' : 'var(--primary)',
                                      fontWeight: 700,
                                    }}
                                    title={`Depende de ${item.dependencies.length} atividade(s) anterior(es)`}
                                  >
                                    <Link2 size={10} /> {item.dependencies.length} dep.
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Coluna 2: Datas */}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              <div>{formatDatePt(item.event_date)}</div>
                              <div style={{ fontSize: 10 }}>até {formatDatePt(endStr)}</div>
                            </div>

                            {/* Coluna 3: Responsável */}
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-main)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.assigned_employee_name || item.assigned_team_name || 'Geral'}
                            </div>

                            {/* Coluna 4: Progresso e Estado */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700 }}>
                                <span style={{ color: stMeta.color }}>{progressNum}%</span>
                                <span style={{ color: stMeta.color }}>{stMeta.label.split(' ')[0]}</span>
                              </div>
                              <div
                                style={{
                                  height: 5,
                                  borderRadius: 3,
                                  backgroundColor: 'var(--bg-card-subtle)',
                                  overflow: 'hidden',
                                  marginTop: 3,
                                }}
                              >
                                <div
                                  style={{
                                    width: `${progressNum}%`,
                                    height: '100%',
                                    backgroundColor: stMeta.color,
                                  }}
                                />
                              </div>
                            </div>

                            {/* Coluna 5: Barra Visual do Gantt */}
                            <div
                              style={{
                                position: 'relative',
                                height: 28,
                                backgroundColor: 'var(--bg-card-subtle)',
                                borderRadius: 6,
                                border: '1px solid var(--border-color)',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Linha Vertical do Dia de Hoje */}
                              {todayPct >= 0 && todayPct <= 100 && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: `${todayPct}%`,
                                    top: 0,
                                    bottom: 0,
                                    width: 2,
                                    backgroundColor: 'var(--primary)',
                                    opacity: 0.5,
                                    zIndex: 1,
                                  }}
                                />
                              )}

                              {/* Barra da Etapa */}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  top: 4,
                                  bottom: 4,
                                  borderRadius: 4,
                                  backgroundColor: stMeta.bg,
                                  border: `1px solid ${stMeta.color}`,
                                  overflow: 'hidden',
                                  display: 'flex',
                                  alignItems: 'center',
                                  zIndex: 2,
                                }}
                              >
                                <div
                                  style={{
                                    width: `${progressNum}%`,
                                    height: '100%',
                                    backgroundColor: stMeta.color,
                                    opacity: 0.45,
                                  }}
                                />
                                <span
                                  style={{
                                    position: 'absolute',
                                    left: 6,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    color: 'var(--text-main)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {durationDays}d ({progressNum}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ==================================================================== */}
      {/* MODAL DE DETALHES COMPLETOS DO EVENTO                                */}
      {/* ==================================================================== */}
      {selectedEventDetail && (
        <div className="flat-modal-backdrop" onClick={() => setSelectedEventDetail(null)}>
          <div
            className="flat-modal-box"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const ev = selectedEventDetail;
              const catMeta = getCategoryMeta(ev.category);
              const stMeta = getStatusMeta(ev.status, blockedByDepMap.has(ev.id));
              const prioMeta = getPriorityMeta(ev.priority);
              const conflicts = conflictMap.get(ev.id) || [];
              const blockingDeps = blockedByDepMap.get(ev.id) || [];

              return (
                <>
                  <div className="flat-modal-header" style={{ borderBottom: `2px solid ${catMeta.color}` }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: catMeta.bg,
                            color: catMeta.color,
                          }}
                        >
                          {ev.event_subtype || catMeta.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: stMeta.bg,
                            color: stMeta.color,
                          }}
                        >
                          {stMeta.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: prioMeta.bg,
                            color: prioMeta.color,
                          }}
                        >
                          Prioridade {prioMeta.label}
                        </span>
                      </div>
                      <h3 className="flat-modal-title" style={{ fontSize: 18 }}>
                        {ev.title}
                      </h3>
                    </div>

                    <button className="btn-flat-secondary" onClick={() => setSelectedEventDetail(null)}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 0' }}>
                    {conflicts.length > 0 && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid #EF4444',
                          color: '#EF4444',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {conflicts.map((c, idx) => (
                          <div key={idx}>• {c}</div>
                        ))}
                      </div>
                    )}

                    {blockingDeps.length > 0 && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid #F59E0B',
                          color: '#F59E0B',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Atividade dependente de etapas ainda não concluídas: {blockingDeps.join(', ')}
                      </div>
                    )}

                    {ev.description && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          fontSize: 13,
                          color: 'var(--text-main)',
                          lineHeight: 1.5,
                        }}
                      >
                        {ev.description}
                      </div>
                    )}

                    <div className="responsive-form-grid-2" style={{ fontSize: 12 }}>
                      <div className="content-panel" style={{ padding: 10, margin: 0 }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>PERÍODO</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                          {formatDatePt(ev.event_date)}
                          {ev.end_date && ev.end_date !== ev.event_date ? ` até ${formatDatePt(ev.end_date)}` : ''}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                          {ev.all_day || !ev.start_time
                            ? 'Dia inteiro'
                            : `${ev.start_time}${ev.end_time ? ` às ${ev.end_time}` : ''}`}
                        </div>
                      </div>

                      <div className="content-panel" style={{ padding: 10, margin: 0 }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>OBRA ASSOCIADA</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                          {ev.site_name || 'Geral / Escritório'}
                        </div>
                        {ev.location && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{ev.location}</div>
                        )}
                      </div>

                      <div className="content-panel" style={{ padding: 10, margin: 0 }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>RESPONSÁVEL / EQUIPA</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                          {ev.assigned_employee_name || ev.assigned_team_name || 'Não atribuído'}
                        </div>
                        {ev.supplier_name && (
                          <div style={{ color: '#F59E0B', fontSize: 11, marginTop: 2 }}>
                            Fornecedor: {ev.supplier_name}
                          </div>
                        )}
                      </div>

                      <div className="content-panel" style={{ padding: 10, margin: 0 }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>
                          VISIBILIDADE & RECORRÊNCIA
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                          {ev.visible_to_client ? 'Visível no Portal do Cliente' : 'Apenas Interno (Equipa)'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                          Recorrência: {ev.recurrence || 'nenhuma'}
                        </div>
                      </div>
                    </div>

                    {/* Controlo Rápido de Progresso */}
                    <div className="content-panel" style={{ padding: 12, margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                          PERCENTAGEM DE EXECUÇÃO / PROGRESSO
                        </span>
                        <strong style={{ fontSize: 13, color: 'var(--primary)' }}>{ev.progress ?? 0}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={ev.progress ?? 0}
                        onChange={(e) => handleQuickProgressChange(ev, Number(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                      />
                    </div>

                    {/* Botões de Integração com Obra/Tarefa Original e Google Calendar */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {ev.site_id && onOpenSite && (
                        <button
                          type="button"
                          onClick={() => {
                            const sid = ev.site_id!;
                            setSelectedEventDetail(null);
                            onOpenSite(sid);
                          }}
                          className="btn-flat-secondary"
                          style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <ExternalLink size={14} color="var(--primary)" />
                          {ev.source_module === 'tarefa' ? 'Abrir Tarefa / Obra Original' : 'Abrir Página da Obra'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSyncSingleEventWithGoogle(ev)}
                        className="btn-flat-secondary"
                        style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <CalendarIcon size={14} color="#10B981" />
                        {ev.google_calendar_synced ? 'Atualizar no Google Calendar' : 'Enviar para Google Calendar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateEvent(ev)}
                        className="btn-flat-secondary"
                        style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Copy size={14} /> Duplicar
                      </button>

                      {ev.status !== 'cancelado' && (
                        <button
                          type="button"
                          onClick={() => handleCancelEventStatus(ev)}
                          className="btn-flat-secondary"
                          style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Ban size={14} color="#F59E0B" /> Cancelar Evento
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flat-modal-actions" style={{ justifyContent: 'space-between' }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(ev)}
                      className="btn-flat-danger"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Trash2 size={14} /> Eliminar
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => openEditEventModal(ev)}
                        className="btn-flat-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Edit2 size={14} /> Editar / Reagendar
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL DE CRIAÇÃO E EDIÇÃO COMPLETA DE EVENTO                         */}
      {/* ==================================================================== */}
      {modalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="flat-modal-box"
            style={{ maxWidth: 680, maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                {editingEvent ? 'Editar / Reagendar Evento' : 'Novo Evento no Calendário'}
              </h3>
              <button className="btn-flat-secondary" onClick={() => setModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveForm}>
              <div className="flat-form-grid">
                {/* Título */}
                <div className="flat-form-group full">
                  <label>Título do Evento *</label>
                  <input
                    required
                    placeholder="Ex: Betonagem da Laje Piso 1, Vistoria Técnica, Entrega de Aço..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                {/* Tipo de Evento */}
                <div className="flat-form-group">
                  <label>Tipo de Evento *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as EventCategory;
                      setFormCategory(nextCat);
                      const presets = SUBTYPE_OPTIONS[normalizeCategoryGroup(nextCat)] || [];
                      setFormSubtype(presets[0] || '');
                      if (nextCat === 'etapa_obra') setFormVisibleToClient(true);
                    }}
                  >
                    <option value="etapa_obra">Etapa de Obra</option>
                    <option value="tarefa">Tarefa Operacional</option>
                    <option value="material">Materiais / Entrega</option>
                    <option value="equipa">Equipa / Férias / Folga</option>
                    <option value="compromisso">Compromisso / Vistoria / Reunião</option>
                    <option value="personalizado">Evento Personalizado</option>
                  </select>
                </div>

                {/* Subtipo / Etapa */}
                <div className="flat-form-group">
                  <label>Etapa / Subcategoria</label>
                  <select
                    value={formSubtype}
                    onChange={(e) => setFormSubtype(e.target.value)}
                  >
                    {(SUBTYPE_OPTIONS[normalizeCategoryGroup(formCategory)] || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                    <option value="">Personalizada (digitar abaixo)</option>
                  </select>
                </div>

                {formSubtype === '' && (
                  <div className="flat-form-group full">
                    <label>Nome da Etapa / Categoria Personalizada</label>
                    <input
                      placeholder="Ex: Impermeabilização de Cobertura, Montagem de Grua..."
                      value={formCustomSubtype}
                      onChange={(e) => setFormCustomSubtype(e.target.value)}
                    />
                  </div>
                )}

                {/* Obra Associada */}
                <div className="flat-form-group">
                  <label>Obra Associada</label>
                  <select value={formSiteId} onChange={(e) => setFormSiteId(e.target.value)}>
                    <option value="">Geral / Sem obra específica</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Equipa */}
                <div className="flat-form-group">
                  <label>Equipa Responsável</label>
                  <select value={formTeamId} onChange={(e) => setFormTeamId(e.target.value)}>
                    <option value="">Nenhuma equipa selecionada</option>
                    {teams.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name} (Líder: {tm.leader_name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Funcionário Responsável */}
                <div className="flat-form-group">
                  <label>Funcionário Responsável</label>
                  <select value={formEmployeeId} onChange={(e) => setFormEmployeeId(e.target.value)}>
                    <option value="">Nenhum funcionário específico</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.job_title})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fornecedor (se tipo == material) ou Localização */}
                {normalizeCategoryGroup(formCategory) === 'material' ? (
                  <div className="flat-form-group">
                    <label>Fornecedor / Transportadora</label>
                    <input
                      placeholder="Ex: Cimpor, Leroy Merlin, Betão Liz..."
                      value={formSupplierName}
                      onChange={(e) => setFormSupplierName(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="flat-form-group">
                    <label>Localização</label>
                    <input
                      placeholder="Endereço ou sala de reunião..."
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                    />
                  </div>
                )}

                {/* Opção Dia Inteiro */}
                <div className="flat-form-group full" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <input
                    id="chk-all-day"
                    type="checkbox"
                    checked={formAllDay}
                    onChange={(e) => setFormAllDay(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <label htmlFor="chk-all-day" style={{ margin: 0, cursor: 'pointer', fontWeight: 700 }}>
                    Evento de Dia Inteiro
                  </label>
                </div>

                {/* Datas e Horas */}
                <div className="flat-form-group">
                  <label>Data de Início *</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (formEndDate < e.target.value) setFormEndDate(e.target.value);
                    }}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Data de Conclusão *</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                  />
                </div>

                {!formAllDay && (
                  <>
                    <div className="flat-form-group">
                      <label>Hora de Início</label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                      />
                    </div>

                    <div className="flat-form-group">
                      <label>Hora de Conclusão</label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Prioridade e Estado */}
                <div className="flat-form-group">
                  <label>Prioridade</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as EventPriority)}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label>Estado</label>
                  <select
                    value={formStatus}
                    onChange={(e) => {
                      const nextSt = e.target.value as EventStatus;
                      setFormStatus(nextSt);
                      if (nextSt === 'concluido') setFormProgress(100);
                    }}
                  >
                    <option value="planeado">Planeado</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluido">Concluído</option>
                    <option value="atrasado">Atrasado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                {/* Recorrência e Lembretes */}
                <div className="flat-form-group">
                  <label>Recorrência</label>
                  <select
                    value={formRecurrence}
                    onChange={(e) => setFormRecurrence(e.target.value as EventRecurrence)}
                  >
                    <option value="nenhuma">Nenhuma (Evento único)</option>
                    <option value="diaria">Diária</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label>Configuração de Lembrete (Antecedência)</label>
                  <select
                    value={formReminderMinutes}
                    onChange={(e) => setFormReminderMinutes(Number(e.target.value))}
                  >
                    <option value={0}>Sem lembrete</option>
                    <option value={60}>1 hora antes</option>
                    <option value={1440}>1 dia antes (24h)</option>
                    <option value={4320}>3 dias antes (72h)</option>
                  </select>
                </div>

                {/* Progresso (%) */}
                <div className="flat-form-group full">
                  <label>Percentagem de Progresso ({formProgress}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={formProgress}
                    onChange={(e) => setFormProgress(Number(e.target.value))}
                  />
                </div>

                {/* Dependências no Cronograma (Gantt) */}
                {formSiteId && (
                  <div className="flat-form-group full">
                    <label>Dependências (Atividades que devem terminar antes desta)</label>
                    <div
                      style={{
                        maxHeight: 95,
                        overflowY: 'auto',
                        padding: 8,
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {events
                        .filter((ev) => ev.site_id === formSiteId && ev.id !== editingEvent?.id)
                        .map((ev) => {
                          const checked = formDependencies.includes(ev.id);
                          return (
                            <label
                              key={ev.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', margin: 0 }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormDependencies([...formDependencies, ev.id]);
                                  } else {
                                    setFormDependencies(formDependencies.filter((id) => id !== ev.id));
                                  }
                                }}
                              />
                              <span>
                                {ev.title} ({formatDatePt(ev.event_date)})
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Descrição */}
                <div className="flat-form-group full">
                  <label>Descrição e Observações</label>
                  <textarea
                    rows={2}
                    placeholder="Detalhes técnicos, instruções para a equipa, documentos necessários..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                {/* Visibilidade no Portal do Cliente & Sincronização Google Calendar */}
                <div className="flat-form-group full" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={formVisibleToClient}
                      onChange={(e) => setFormVisibleToClient(e.target.checked)}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                      Autorizar visualização deste marco no Portal do Cliente da obra
                    </span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={formSyncGoogle}
                      onChange={(e) => setFormSyncGoogle(e.target.checked)}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                      Criar / notificar automaticamente no Google Calendar do gestor ao guardar
                    </span>
                  </label>
                </div>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={saving}>
                  <Save size={15} />
                  {saving ? 'A guardar...' : editingEvent ? 'Guardar Alterações' : 'Criar Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL DE CONFIGURAÇÃO DO GOOGLE CALENDAR                             */}
      {/* ==================================================================== */}
      {gcalSettingsOpen && (
        <div className="flat-modal-backdrop" onClick={() => setGcalSettingsOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Integração com Google Calendar</h3>
              <button className="btn-flat-secondary" onClick={() => setGcalSettingsOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                Ao criar um evento no Castello, o sistema sincroniza automaticamente com o Google Calendar para enviar notificações e lembretes ao gestor no computador e telemóvel.
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={gcalConfig.autoSyncOnSave}
                  onChange={(e) => saveGcalConfig({ ...gcalConfig, autoSyncOnSave: e.target.checked })}
                />
                Sincronizar automaticamente novos eventos com o Google Calendar
              </label>

              <div className="flat-form-group">
                <label>Antecedência Padrão de Lembrete no Google Calendar</label>
                <select
                  value={gcalConfig.defaultReminderMinutes}
                  onChange={(e) => saveGcalConfig({ ...gcalConfig, defaultReminderMinutes: Number(e.target.value) })}
                >
                  <option value={60}>1 hora antes</option>
                  <option value={1440}>1 dia antes</option>
                  <option value={4320}>3 dias antes</option>
                </select>
              </div>

              <div className="flat-form-group">
                <label>Token OAuth da API Google Calendar (Opcional para envio silencioso em background)</label>
                <input
                  type="password"
                  placeholder="ya29.a0AfH6SM..."
                  value={gcalConfig.googleAccessToken}
                  onChange={(e) => saveGcalConfig({ ...gcalConfig, googleAccessToken: e.target.value })}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Sem token OAuth, o Castello abre o criador rápido oficial do Google Calendar pré-preenchido ou exporta o ficheiro .ICS.
                </span>
              </div>

              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleExportIcs}
                  className="btn-flat-secondary"
                  style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} /> Exportar Calendário (.ICS)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGcalSettingsOpen(false);
                    showNotice('Preferências do Google Calendar guardadas!');
                  }}
                  className="btn-flat-primary"
                >
                  Concluído
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL DE GERAÇÃO RÁPIDA DE ETAPAS CONSTRUTIVAS DA OBRA               */}
      {/* ==================================================================== */}
      {stageGeneratorModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setStageGeneratorModalOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Configurar Etapas do Cronograma</h3>
              <button className="btn-flat-secondary" onClick={() => setStageGeneratorModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleGenerateSiteStages} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flat-form-group">
                <label>Selecione a Obra *</label>
                <select
                  required
                  value={stageGenSiteId}
                  onChange={(e) => setStageGenSiteId(e.target.value)}
                >
                  <option value="">Escolha uma obra...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flat-form-group">
                <label>Etapas Construtivas a Incluir no Cronograma (Gantt)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {STAGE_PRESETS.map((st) => {
                    const checked = selectedPresetStages.includes(st);
                    return (
                      <label
                        key={st}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', margin: 0 }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPresetStages([...selectedPresetStages, st]);
                            } else {
                              setSelectedPresetStages(selectedPresetStages.filter((x) => x !== st));
                            }
                          }}
                        />
                        <span>{st}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setStageGeneratorModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary">
                  Gerar Etapas no Cronograma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
