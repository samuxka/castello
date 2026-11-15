import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  Building2,
  Clock,
  Calendar,
  Phone,
  Shield,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  CheckSquare,
  Search,
  Filter,
  ArrowUpDown,
  Camera,
  Eye,
  Archive,
  RotateCcw,
  ExternalLink,
  X,
  Activity,
  Award,
  Layers,
} from 'lucide-react';
import {
  Team,
  EmployeeProfile,
  ConstructionSite,
  SiteWorkSession,
  SiteTask,
  TimeEntry,
  TaskPriority,
  TaskExecutionStatus,
} from '../types';
import {
  getTeamWorkSessions,
  getAllCompanyTasks,
  saveTeam,
  saveSiteWorkSession,
  createSiteTask,
  updateSiteTaskDetails,
  updateTaskStatus,
  deleteTask,
  toggleArchiveTeamWeb,
  transferCollaboratorBetweenTeamsWeb,
  logTeamActivityWeb,
} from '../lib/supabase';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { customConfirm, customAlert } from '../context/DialogContext';
import {
  TEAM_SPECIALTIES_CATALOG,
  getTeamOperationalStatus,
  getOperationalStatusBadgeMeta,
  calculateEmployeeHoursFromEntries,
  calculateTeamHoursMetrics,
  filterTasksForTeam,
} from '../components/teams/teamOperations';
import { TeamAllocationModal, AllocationModalMode } from '../components/teams/TeamAllocationModal';

export type TeamDetailTab = 'visao_geral' | 'colaboradores' | 'tarefas' | 'desempenho' | 'historico';

interface TeamDetailPageProps {
  team: Team;
  allTeams?: Team[];
  employees: EmployeeProfile[];
  sites: ConstructionSite[];
  entries?: TimeEntry[];
  companyId?: string;
  initialTab?: TeamDetailTab;
  onBack: () => void;
  onTeamUpdated: (updated: Team) => void;
  onEditTeamRequest?: (team: Team) => void;
  onOpenEmployee?: (emp: EmployeeProfile) => void;
  onOpenSite?: (site: ConstructionSite) => void;
  showNotice?: (msg: string) => void;
}

type PeriodFilter = '7d' | '30d' | 'mes' | '3m' | 'custom' | 'tudo';

function getPeriodRange(
  period: PeriodFilter,
  customStart: string,
  customEnd: string
): { startDate?: string; endDate?: string; label: string } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (period === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { startDate: d.toISOString().slice(0, 10), endDate: todayStr, label: 'Últimos 7 dias' };
  }
  if (period === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return { startDate: d.toISOString().slice(0, 10), endDate: todayStr, label: 'Últimos 30 dias' };
  }
  if (period === 'mes') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    return { startDate: first, endDate: todayStr, label: 'Este mês' };
  }
  if (period === '3m') {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return { startDate: d.toISOString().slice(0, 10), endDate: todayStr, label: 'Últimos 3 meses' };
  }
  if (period === 'custom') {
    return {
      startDate: customStart || undefined,
      endDate: customEnd || undefined,
      label: 'Intervalo personalizado',
    };
  }
  return { startDate: undefined, endDate: undefined, label: 'Todo o período' };
}

export function TeamDetailPage({
  team,
  allTeams = [],
  employees,
  sites,
  entries = [],
  companyId,
  initialTab = 'visao_geral',
  onBack,
  onTeamUpdated,
  onEditTeamRequest,
  onOpenEmployee,
  onOpenSite,
  showNotice,
}: TeamDetailPageProps) {
  const [activeTab, setActiveTab] = useState<TeamDetailTab>(initialTab);
  const [sessions, setSessions] = useState<SiteWorkSession[]>([]);
  const [allTasks, setAllTasks] = useState<SiteTask[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtro de período (Partilhado entre Visão Geral, Colaboradores e Desempenho)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Modal de Alocação / Transferência / Fecho
  const [allocModalOpen, setAllocModalOpen] = useState(false);
  const [allocModalMode, setAllocModalMode] = useState<AllocationModalMode>('allocate');

  // Modais da Aba Colaboradores
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [selectedNewMemberId, setSelectedNewMemberId] = useState('');
  const [selectedNewMemberSpec, setSelectedNewMemberSpec] = useState('');
  const [changeLeaderModalOpen, setChangeLeaderModalOpen] = useState(false);
  const [newLeaderId, setNewLeaderId] = useState(team.leader_id || '');
  const [transferMemberModal, setTransferMemberModal] = useState<EmployeeProfile | null>(null);
  const [targetTransferTeamId, setTargetTransferTeamId] = useState('');
  const [transferMemberReason, setTransferMemberReason] = useState('');
  const [savingMemberAction, setSavingMemberAction] = useState(false);

  // Modais e Filtros da Aba Tarefas
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'todas' | 'pendente' | 'em_execucao' | 'concluida' | 'atrasada'>('todas');
  const [taskSiteFilter, setTaskSiteFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');
  const [taskSortBy, setTaskSortBy] = useState<'prazo' | 'prioridade' | 'progresso' | 'recentes'>('prazo');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SiteTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskSiteId, setTaskSiteId] = useState(team.current_site_id || sites[0]?.id || '');
  const [taskAssignedId, setTaskAssignedId] = useState(team.leader_id || '');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('media');
  const [taskStartDate, setTaskStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskExecStatus, setTaskExecStatus] = useState<TaskExecutionStatus>('pendente');
  const [taskPlannedHours, setTaskPlannedHours] = useState('');
  const [taskServiceQty, setTaskServiceQty] = useState('');
  const [taskServiceUnit, setTaskServiceUnit] = useState('m² de reboco');
  const [taskObservations, setTaskObservations] = useState('');
  const [taskBeforePhotos, setTaskBeforePhotos] = useState<string[]>([]);
  const [taskAfterPhotos, setTaskAfterPhotos] = useState<string[]>([]);
  const [uploadingTaskPhoto, setUploadingTaskPhoto] = useState<'before' | 'after' | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Modais e Filtros da Aba Histórico
  const [histDateFrom, setHistDateFrom] = useState('');
  const [histDateTo, setHistDateTo] = useState('');
  const [histSiteFilter, setHistSiteFilter] = useState('all');
  const [histTypeFilter, setHistTypeFilter] = useState<'todos' | 'alocacao' | 'sessao' | 'tarefa' | 'composicao' | 'lider' | 'ocorrencia'>('todos');

  const [occurrenceModalOpen, setOccurrenceModalOpen] = useState(false);
  const [occTitle, setOccTitle] = useState('');
  const [occDescription, setOccDescription] = useState('');
  const [occSiteId, setOccSiteId] = useState(team.current_site_id || '');
  const [savingOccurrence, setSavingOccurrence] = useState(false);

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessSiteId, setSessSiteId] = useState(team.current_site_id || sites[0]?.id || '');
  const [sessDate, setSessDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessHours, setSessHours] = useState('8');
  const [sessWorkersCount, setSessWorkersCount] = useState(
    String((team.member_ids?.length || 0) + (team.leader_id ? 1 : 0))
  );
  const [sessDescription, setSessDescription] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Carrega sessões diretamente por team_id (Secção 3.1 e 3.2) e tarefas em lote
  const loadOperationalData = async () => {
    setLoadingData(true);
    setLoadError(null);
    try {
      const siteIds = sites.map((s) => s.id);
      const [sessResult, tasksResult] = await Promise.all([
        getTeamWorkSessions({
          team,
          allTeams,
          companyId,
          siteIds,
          page: 1,
          pageSize: 300,
        }),
        getAllCompanyTasks(companyId, siteIds),
      ]);
      setSessions(sessResult.sessions);
      setAllTasks(tasksResult);
    } catch (err: unknown) {
      console.error('Erro ao carregar dados operacionais da equipa:', err);
      setLoadError('Não foi possível carregar parte dos dados operacionais da equipa.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadOperationalData();
  }, [team.id, companyId, sites.length]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const periodRange = useMemo(
    () => getPeriodRange(periodFilter, customStartDate, customEndDate),
    [periodFilter, customStartDate, customEndDate]
  );

  // Estado operacional (Secção 3.5)
  const operationalStatus = useMemo(
    () => getTeamOperationalStatus({ team, sessions, entries, todayStr }),
    [team, sessions, entries, todayStr]
  );
  const statusMeta = useMemo(
    () => getOperationalStatusBadgeMeta(operationalStatus),
    [operationalStatus]
  );

  // Líder e integrantes (garantindo que o líder nunca é duplicado nos integrantes comuns)
  const leaderEmployee = useMemo(() => {
    if (team.leader_id) {
      const byId = employees.find((e) => e.id === team.leader_id);
      if (byId) return byId;
    }
    return employees.find(
      (e) => e.full_name?.trim().toLowerCase() === team.leader_name?.trim().toLowerCase()
    );
  }, [employees, team.leader_id, team.leader_name]);

  const memberEmployees = useMemo(() => {
    const seen = new Set<string>();
    if (team.leader_id) seen.add(team.leader_id);
    const list: EmployeeProfile[] = [];

    (team.member_ids || []).forEach((id, index) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      const match = employees.find((e) => e.id === id);
      if (match) {
        list.push(match);
      } else {
        const fallbackName = (team.member_names || [])[index] || `Integrante ${index + 1}`;
        list.push({
          id,
          full_name: fallbackName,
          job_title: 'Colaborador de Obra',
          email: '',
          access_code: '',
          role: 'funcionario',
          phone: null,
          hourly_rate: 0,
          monthly_target_hours: 176,
          is_active: true,
        });
      }
    });
    return list;
  }, [employees, team.leader_id, team.member_ids, team.member_names]);

  const allTeamCollaborators = useMemo(() => {
    const arr: EmployeeProfile[] = [];
    if (leaderEmployee) arr.push(leaderEmployee);
    arr.push(...memberEmployees);
    return arr;
  }, [leaderEmployee, memberEmployees]);

  const totalMembersCount = (leaderEmployee || team.leader_id ? 1 : 0) + memberEmployees.length;

  // Tarefas da Equipa (Secção 2.3)
  const teamTasks = useMemo(() => filterTasksForTeam(team, allTasks), [team, allTasks]);

  const classifyTaskState = (t: SiteTask): 'pendente' | 'em_execucao' | 'concluida' | 'atrasada' => {
    const isDone =
      t.status === 'concluida_funcionario' ||
      t.status === 'confirmada_chefe' ||
      t.execution_status === 'concluida';
    if (isDone) return 'concluida';
    if (t.due_date && t.due_date < todayStr) return 'atrasada';
    if (t.execution_status === 'em_execucao' || (t.progress || 0) > 0) return 'em_execucao';
    return 'pendente';
  };

  const taskStats = useMemo(() => {
    let pendentes = 0;
    let emExecucao = 0;
    let concluidas = 0;
    let atrasadas = 0;
    let concluidasNoPrazo = 0;
    let concluidasComPrazo = 0;

    for (const t of teamTasks) {
      const st = classifyTaskState(t);
      if (st === 'concluida') {
        concluidas++;
        if (t.due_date) {
          concluidasComPrazo++;
          const completedDate = (t.completed_at || t.confirmed_at || todayStr).slice(0, 10);
          if (completedDate <= t.due_date) {
            concluidasNoPrazo++;
          }
        }
      } else if (st === 'atrasada') {
        atrasadas++;
      } else if (st === 'em_execucao') {
        emExecucao++;
      } else {
        pendentes++;
      }
    }

    const onTimeRate =
      concluidasComPrazo > 0
        ? Math.round((concluidasNoPrazo / concluidasComPrazo) * 100)
        : concluidas > 0
        ? 100
        : null;

    return { pendentes, emExecucao, concluidas, atrasadas, onTimeRate };
  }, [teamTasks, todayStr]);

  // Métricas de Horas de Sessão e Horas-Homem no período selecionado (Secção 3.4)
  const hoursMetrics = useMemo(
    () =>
      calculateTeamHoursMetrics({
        team,
        sessions,
        entries,
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
      }),
    [team, sessions, entries, periodRange]
  );

  const distinctSitesServed = useMemo(() => {
    const sIds = new Set<string>();
    if (team.current_site_id) sIds.add(team.current_site_id);
    sessions.forEach((s) => {
      if (s.site_id) sIds.add(s.site_id);
    });
    (team.allocation_history || []).forEach((a) => {
      if (a.site_id) sIds.add(a.site_id);
    });
    return sIds.size;
  }, [team, sessions]);

  // Obra atual e progresso real das tarefas atribuídas à equipa nessa obra (Secção 2.1)
  const currentSite = useMemo(
    () => (team.current_site_id ? sites.find((s) => s.id === team.current_site_id) || null : null),
    [sites, team.current_site_id]
  );

  const currentSiteTasksProgress = useMemo(() => {
    if (!team.current_site_id) return { count: 0, completed: 0, pct: 0 };
    const siteTasks = teamTasks.filter((t) => t.site_id === team.current_site_id);
    if (siteTasks.length === 0) return { count: 0, completed: 0, pct: 0 };
    let sumProgress = 0;
    let completed = 0;
    for (const t of siteTasks) {
      const isDone =
        t.status === 'concluida_funcionario' ||
        t.status === 'confirmada_chefe' ||
        t.execution_status === 'concluida';
      if (isDone) {
        completed++;
        sumProgress += 100;
      } else {
        sumProgress += Math.min(99, Math.max(0, Number(t.progress || 0)));
      }
    }
    return {
      count: siteTasks.length,
      completed,
      pct: Math.round(sumProgress / siteTasks.length),
    };
  }, [team.current_site_id, teamTasks]);

  // ============================================================================
  // AÇÕES DE GESTÃO DE COLABORADORES NA EQUIPA (Secção 2.2)
  // ============================================================================
  const handleAddMemberToTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNewMemberId) return;
    if (selectedNewMemberId === team.leader_id) {
      await customAlert({
        title: 'Colaborador já é Líder',
        message: 'Este colaborador já é o líder responsável da equipa e não pode ser duplicado como membro comum.',
        type: 'warning',
      });
      return;
    }
    if ((team.member_ids || []).includes(selectedNewMemberId)) {
      await customAlert({
        title: 'Colaborador já Integrado',
        message: 'Este colaborador já faz parte da equipa.',
        type: 'warning',
      });
      return;
    }
    const emp = employees.find((x) => x.id === selectedNewMemberId);
    if (!emp) return;

    setSavingMemberAction(true);
    try {
      const updated = await saveTeam(
        {
          ...team,
          member_ids: [...(team.member_ids || []), emp.id],
          member_names: [...(team.member_names || []), emp.full_name],
          member_joined_at: {
            ...(team.member_joined_at || {}),
            [emp.id]: todayStr,
          },
          member_specialties: selectedNewMemberSpec
            ? { ...(team.member_specialties || {}), [emp.id]: selectedNewMemberSpec }
            : team.member_specialties,
        },
        companyId,
        { employees }
      );
      onTeamUpdated(updated);
      setAddMemberModalOpen(false);
      setSelectedNewMemberId('');
      setSelectedNewMemberSpec('');
      showNotice?.(`${emp.full_name} adicionado à equipa ${team.name}!`);
    } catch (err: unknown) {
      await customAlert({
        title: 'Erro ao Adicionar Colaborador',
        message: err instanceof Error ? err.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingMemberAction(false);
    }
  };

  const handleRemoveMemberFromTeam = async (member: EmployeeProfile) => {
    const confirmed = await customConfirm({
      title: 'Remover Colaborador da Equipa',
      message: `Deseja remover "${member.full_name}" da equipa "${team.name}"? O histórico de sessões e atividades anteriores será integralmente preservado.`,
      type: 'warning',
      confirmText: 'Remover da Equipa',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    try {
      const idx = (team.member_ids || []).indexOf(member.id);
      const nextIds = (team.member_ids || []).filter((id) => id !== member.id);
      const nextNames = (team.member_names || []).filter((_, i) => i !== idx);
      const updated = await saveTeam(
        {
          ...team,
          member_ids: nextIds,
          member_names: nextNames,
        },
        companyId,
        { employees, skipValidationError: true }
      );
      onTeamUpdated(updated);
      showNotice?.(`${member.full_name} removido da equipa.`);
    } catch (err: unknown) {
      await customAlert({
        title: 'Erro ao Remover',
        message: err instanceof Error ? err.message : 'Tente novamente.',
        type: 'error',
      });
    }
  };

  const handleChangeTeamLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaderId) return;
    const emp = employees.find((x) => x.id === newLeaderId);
    if (!emp) return;

    setSavingMemberAction(true);
    try {
      // Se o novo líder estava como membro comum, remove-o de member_ids para não duplicar
      const filteredMemberIds: string[] = [];
      const filteredMemberNames: string[] = [];
      (team.member_ids || []).forEach((id, i) => {
        if (id !== emp.id) {
          filteredMemberIds.push(id);
          filteredMemberNames.push((team.member_names || [])[i] || 'Colaborador');
        }
      });

      // Opcionalmente mantém o líder anterior como integrante se existia e era válido
      if (team.leader_id && team.leader_id !== emp.id && !filteredMemberIds.includes(team.leader_id)) {
        const prevLeaderEmp = employees.find((x) => x.id === team.leader_id);
        if (prevLeaderEmp && prevLeaderEmp.is_active) {
          filteredMemberIds.push(prevLeaderEmp.id);
          filteredMemberNames.push(prevLeaderEmp.full_name);
        }
      }

      const updated = await saveTeam(
        {
          ...team,
          leader_id: emp.id,
          leader_name: emp.full_name,
          leader_phone: emp.phone || null,
          member_ids: filteredMemberIds,
          member_names: filteredMemberNames,
        },
        companyId,
        { employees }
      );
      onTeamUpdated(updated);
      setChangeLeaderModalOpen(false);
      showNotice?.(`Líder da equipa alterado para ${emp.full_name}.`);
    } catch (err: unknown) {
      await customAlert({
        title: 'Erro ao Alterar Líder',
        message: err instanceof Error ? err.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingMemberAction(false);
    }
  };

  const handleTransferMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferMemberModal || !targetTransferTeamId) return;
    const targetTeam = allTeams.find((t) => t.id === targetTransferTeamId);
    if (!targetTeam) return;

    setSavingMemberAction(true);
    try {
      const { updatedSource } = await transferCollaboratorBetweenTeamsWeb({
        sourceTeam: team,
        targetTeam,
        employee: transferMemberModal,
        reason: transferMemberReason.trim() || undefined,
        companyId,
      });
      onTeamUpdated(updatedSource);
      setTransferMemberModal(null);
      setTargetTransferTeamId('');
      setTransferMemberReason('');
      showNotice?.(`${transferMemberModal.full_name} transferido para a equipa "${targetTeam.name}".`);
    } catch (err: unknown) {
      await customAlert({
        title: 'Erro na Transferência',
        message: err instanceof Error ? err.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingMemberAction(false);
    }
  };

  const handleUpdateMemberSpecialty = async (empId: string, specialty: string) => {
    try {
      const updated = await saveTeam(
        {
          ...team,
          member_specialties: {
            ...(team.member_specialties || {}),
            [empId]: specialty,
          },
        },
        companyId,
        { skipValidationError: true }
      );
      onTeamUpdated(updated);
      showNotice?.('Especialidade do colaborador atualizada.');
    } catch (err) {
      console.warn('Erro ao atualizar especialidade do colaborador:', err);
    }
  };

  // ============================================================================
  // AÇÕES DA ABA TAREFAS (Secção 2.3)
  // ============================================================================
  const openCreateTaskModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskSiteId(team.current_site_id || sites[0]?.id || '');
    setTaskAssignedId(team.leader_id || allTeamCollaborators[0]?.id || '');
    setTaskPriority('media');
    setTaskStartDate(todayStr);
    setTaskDueDate('');
    setTaskProgress(0);
    setTaskExecStatus('pendente');
    setTaskPlannedHours('');
    setTaskServiceQty('');
    setTaskServiceUnit(team.specialties?.[0] ? `m² de ${team.specialties[0].toLowerCase()}` : 'm² de reboco');
    setTaskObservations('');
    setTaskBeforePhotos([]);
    setTaskAfterPhotos([]);
    setTaskModalOpen(true);
  };

  const openEditTaskModal = (task: SiteTask) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setTaskSiteId(task.site_id);
    setTaskAssignedId(task.assigned_to_id || team.leader_id || '');
    setTaskPriority(task.priority || 'media');
    setTaskStartDate(task.start_date || (task.created_at ? task.created_at.slice(0, 10) : todayStr));
    setTaskDueDate(task.due_date || '');
    setTaskProgress(typeof task.progress === 'number' ? task.progress : 0);
    setTaskExecStatus(task.execution_status || 'pendente');
    setTaskPlannedHours(typeof task.planned_hours === 'number' ? String(task.planned_hours) : '');
    setTaskServiceQty(typeof task.service_quantity === 'number' ? String(task.service_quantity) : '');
    setTaskServiceUnit(task.service_unit || 'm² de reboco');
    setTaskObservations(task.observations || '');
    setTaskBeforePhotos(task.before_photos || []);
    setTaskAfterPhotos(task.completion_photos || []);
    setTaskModalOpen(true);
  };

  const handleUploadTaskPhoto = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'before' | 'after'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTaskPhoto(kind);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const url = await uploadImageToCloudinary(base64);
          if (kind === 'before') {
            setTaskBeforePhotos((prev) => [...prev, url]);
          } else {
            setTaskAfterPhotos((prev) => [...prev, url]);
          }
        } catch (err) {
          console.error('Erro no upload da foto:', err);
          await customAlert({
            title: 'Erro no Upload',
            message: 'Não foi possível enviar a fotografia.',
            type: 'error',
          });
        } finally {
          setUploadingTaskPhoto(null);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingTaskPhoto(null);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskSiteId) {
      await customAlert({
        title: 'Campos Obrigatórios',
        message: 'Informe o título da tarefa e a obra associada.',
        type: 'warning',
      });
      return;
    }

    const assignedEmp = employees.find((emp) => emp.id === taskAssignedId);
    const assignedName = assignedEmp ? assignedEmp.full_name : team.leader_name;
    const parsedPlannedHours = taskPlannedHours ? parseFloat(taskPlannedHours.replace(',', '.')) : null;
    const parsedServiceQty = taskServiceQty ? parseFloat(taskServiceQty.replace(',', '.')) : null;

    setSavingTask(true);
    try {
      if (editingTask) {
        const updated = await updateSiteTaskDetails(
          editingTask,
          {
            title: taskTitle.trim(),
            description: taskDescription.trim() || null,
            site_id: taskSiteId,
            assigned_to_id: taskAssignedId || null,
            assigned_to_name: assignedName,
            assigned_team_id: team.id,
            assigned_team_name: team.name,
            priority: taskPriority,
            start_date: taskStartDate || null,
            due_date: taskDueDate || null,
            progress: taskProgress,
            execution_status: taskExecStatus,
            planned_hours: parsedPlannedHours && !isNaN(parsedPlannedHours) ? parsedPlannedHours : null,
            service_quantity: parsedServiceQty && !isNaN(parsedServiceQty) ? parsedServiceQty : null,
            service_unit: parsedServiceQty ? taskServiceUnit.trim() || null : null,
            observations: taskObservations.trim() || null,
            before_photos: taskBeforePhotos,
            completion_photos: taskAfterPhotos,
          },
          companyId
        );
        setAllTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        showNotice?.('Tarefa atualizada com sucesso!');
      } else {
        const created = await createSiteTask(
          taskSiteId,
          taskTitle.trim(),
          taskDescription.trim() || undefined,
          assignedName,
          taskDueDate || undefined,
          companyId,
          taskAssignedId || undefined,
          {
            assigned_team_id: team.id,
            assigned_team_name: team.name,
            priority: taskPriority,
            start_date: taskStartDate || null,
            progress: taskProgress,
            execution_status: taskExecStatus,
            planned_hours: parsedPlannedHours && !isNaN(parsedPlannedHours) ? parsedPlannedHours : null,
            service_quantity: parsedServiceQty && !isNaN(parsedServiceQty) ? parsedServiceQty : null,
            service_unit: parsedServiceQty ? taskServiceUnit.trim() || null : null,
            observations: taskObservations.trim() || null,
            before_photos: taskBeforePhotos,
            completion_photos: taskAfterPhotos,
          }
        );
        setAllTasks((prev) => [created, ...prev]);
        showNotice?.('Nova tarefa atribuída à equipa!');
      }
      setTaskModalOpen(false);
    } catch (err: unknown) {
      await customAlert({
        title: 'Erro ao Guardar Tarefa',
        message: err instanceof Error ? err.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingTask(false);
    }
  };

  const handleQuickProgressUpdate = async (task: SiteTask, nextProgress: number) => {
    const clamped = Math.max(0, Math.min(100, nextProgress));
    const nextExec: TaskExecutionStatus =
      clamped >= 100 ? 'concluida' : clamped > 0 ? 'em_execucao' : 'pendente';
    try {
      const updated = await updateSiteTaskDetails(
        task,
        {
          progress: clamped,
          execution_status: nextExec,
          assigned_team_id: task.assigned_team_id || team.id,
          assigned_team_name: task.assigned_team_name || team.name,
        },
        companyId
      );
      setAllTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showNotice?.(`Progresso da tarefa "${task.title}" atualizado para ${clamped}%.`);
    } catch (err) {
      console.warn('Erro ao atualizar progresso:', err);
    }
  };

  const handleCompleteTask = async (task: SiteTask) => {
    try {
      await updateTaskStatus(
        task.id,
        'confirmada_chefe',
        team.leader_name || 'Administração',
        task.completion_photos
      );
      const updated = await updateSiteTaskDetails(
        task,
        {
          status: 'confirmada_chefe',
          progress: 100,
          execution_status: 'concluida',
          confirmed_by_name: team.leader_name || 'Administração',
          confirmed_at: new Date().toISOString(),
        },
        companyId
      );
      setAllTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showNotice?.(`Tarefa "${task.title}" concluída!`);
    } catch (err) {
      console.warn('Erro ao concluir tarefa:', err);
    }
  };

  const handleDeleteTask = async (task: SiteTask) => {
    const ok = await customConfirm({
      title: 'Eliminar Tarefa',
      message: `Deseja eliminar a tarefa "${task.title}"?`,
      type: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    await deleteTask(task.id);
    setAllTasks((prev) => prev.filter((t) => t.id !== task.id));
    showNotice?.('Tarefa eliminada.');
  };

  const filteredTasks = useMemo(() => {
    const priorityWeight: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
    return teamTasks
      .filter((t) => {
        if (
          taskSearch.trim() &&
          !t.title.toLowerCase().includes(taskSearch.toLowerCase()) &&
          !(t.description || '').toLowerCase().includes(taskSearch.toLowerCase()) &&
          !(t.assigned_to_name || '').toLowerCase().includes(taskSearch.toLowerCase())
        ) {
          return false;
        }
        if (taskStatusFilter !== 'todas' && classifyTaskState(t) !== taskStatusFilter) {
          return false;
        }
        if (taskSiteFilter !== 'all' && t.site_id !== taskSiteFilter) {
          return false;
        }
        if (taskPriorityFilter !== 'all' && (t.priority || 'media') !== taskPriorityFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (taskSortBy === 'prioridade') {
          return (priorityWeight[b.priority || 'media'] || 2) - (priorityWeight[a.priority || 'media'] || 2);
        }
        if (taskSortBy === 'progresso') {
          return (b.progress || 0) - (a.progress || 0);
        }
        if (taskSortBy === 'prazo') {
          const da = a.due_date || '9999-12-31';
          const db = b.due_date || '9999-12-31';
          return da.localeCompare(db);
        }
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
  }, [teamTasks, taskSearch, taskStatusFilter, taskSiteFilter, taskPriorityFilter, taskSortBy, todayStr]);

  // ============================================================================
  // DADOS DOS GRÁFICOS DA ABA DESEMPENHO (Secção 2.4)
  // ============================================================================
  // Agrupamento semanal (últimas 6 semanas dentro ou até o fim do período)
  const weeklyPerformanceSeries = useMemo(() => {
    const endRef = periodRange.endDate ? new Date(periodRange.endDate + 'T12:00:00') : new Date();
    const weeks: Array<{
      label: string;
      startIso: string;
      endIso: string;
      sessionHours: number;
      manHours: number;
      tasksCompleted: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const wEnd = new Date(endRef);
      wEnd.setDate(endRef.getDate() - i * 7);
      const wStart = new Date(wEnd);
      wStart.setDate(wEnd.getDate() - 6);
      const startIso = wStart.toISOString().slice(0, 10);
      const endIso = wEnd.toISOString().slice(0, 10);
      const label = `${wStart.getDate().toString().padStart(2, '0')}/${(wStart.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;

      const weekSessions = sessions.filter(
        (s) => s.work_date >= startIso && s.work_date <= endIso
      );
      const sessionHours = Math.round(
        weekSessions.reduce((acc, s) => acc + Number(s.hours_worked || 0), 0) * 10
      ) / 10;
      const manHours = Math.round(
        weekSessions.reduce(
          (acc, s) =>
            acc +
            (typeof s.man_hours === 'number' && s.man_hours > 0
              ? s.man_hours
              : Number(s.hours_worked || 0) * Math.max(1, Number(s.workers_count || 1))),
          0
        ) * 10
      ) / 10;

      const tasksCompleted = teamTasks.filter((t) => {
        const isDone =
          t.status === 'concluida_funcionario' ||
          t.status === 'confirmada_chefe' ||
          t.execution_status === 'concluida';
        if (!isDone) return false;
        const doneDate = (t.completed_at || t.confirmed_at || t.due_date || t.created_at || '').slice(0, 10);
        return doneDate >= startIso && doneDate <= endIso;
      }).length;

      weeks.push({ label, startIso, endIso, sessionHours, manHours, tasksCompleted });
    }
    return weeks;
  }, [sessions, teamTasks, periodRange.endDate]);

  // Gráfico 4: Horas Previstas vs Realizadas por obra (apenas quando existem tarefas com planned_hours)
  const plannedVsRealizedBySite = useMemo(() => {
    const tasksWithPlan = teamTasks.filter(
      (t) => typeof t.planned_hours === 'number' && t.planned_hours > 0
    );
    if (tasksWithPlan.length === 0) return [];

    const bySite = new Map<string, { siteName: string; planned: number; realized: number }>();
    for (const t of tasksWithPlan) {
      const site = sites.find((s) => s.id === t.site_id);
      const entry = bySite.get(t.site_id) || {
        siteName: site?.name || 'Obra',
        planned: 0,
        realized: 0,
      };
      entry.planned += Number(t.planned_hours || 0);
      bySite.set(t.site_id, entry);
    }

    for (const [sId, entry] of bySite.entries()) {
      const siteSessions = sessions.filter((s) => s.site_id === sId);
      entry.realized =
        Math.round(siteSessions.reduce((acc, s) => acc + Number(s.hours_worked || 0), 0) * 10) / 10;
    }

    return Array.from(bySite.values());
  }, [teamTasks, sessions, sites]);

  // Produtividade física real por unidade de serviço (m² de reboco, m² de capoto, etc.)
  const serviceProductivityMetrics = useMemo(() => {
    const tasksWithQty = teamTasks.filter(
      (t) => typeof t.service_quantity === 'number' && t.service_quantity > 0 && t.service_unit
    );
    if (tasksWithQty.length === 0) return [];

    const byUnit = new Map<
      string,
      { unit: string; totalQuantity: number; completedQuantity: number; taskCount: number }
    >();

    for (const t of tasksWithQty) {
      const unitKey = (t.service_unit || 'unid.').trim();
      const item = byUnit.get(unitKey) || {
        unit: unitKey,
        totalQuantity: 0,
        completedQuantity: 0,
        taskCount: 0,
      };
      const qty = Number(t.service_quantity || 0);
      const pct = classifyTaskState(t) === 'concluida' ? 1 : (t.progress || 0) / 100;
      item.totalQuantity += qty;
      item.completedQuantity += Math.round(qty * pct * 10) / 10;
      item.taskCount += 1;
      byUnit.set(unitKey, item);
    }

    return Array.from(byUnit.values());
  }, [teamTasks]);

  // ============================================================================
  // AÇÕES E LINHA TEMPORAL DA ABA HISTÓRICO (Secção 2.5)
  // ============================================================================
  const handleSaveOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occTitle.trim() || !occDescription.trim()) return;
    setSavingOccurrence(true);
    try {
      const targetSite = sites.find((s) => s.id === occSiteId);
      const updated = await logTeamActivityWeb({
        team,
        type: 'ocorrencia',
        title: occTitle.trim(),
        description: occDescription.trim(),
        siteId: targetSite?.id || null,
        siteName: targetSite?.name || null,
        companyId,
      });
      onTeamUpdated(updated);
      setOccurrenceModalOpen(false);
      setOccTitle('');
      setOccDescription('');
      showNotice?.('Ocorrência registada no histórico da equipa.');
    } catch (err: unknown) {
      await customAlert({
        title: 'Erro ao Registar Ocorrência',
        message: err instanceof Error ? err.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingOccurrence(false);
    }
  };

  const handleSaveManualSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessSiteId || !sessDate) return;
    const hrs = parseFloat(sessHours.replace(',', '.')) || 0;
    const workers = Math.max(1, parseInt(sessWorkersCount, 10) || 1);
    if (hrs <= 0) return;

    setSavingSession(true);
    try {
      const created = await saveSiteWorkSession({
        company_id: companyId || team.company_id || null,
        site_id: sessSiteId,
        team_id: team.id,
        team_name: team.name,
        leader_id: team.leader_id || null,
        leader_name: team.leader_name,
        workers_count: workers,
        work_date: sessDate,
        hours_worked: hrs,
        man_hours: Math.round(hrs * workers * 10) / 10,
        member_ids_snapshot: [
          ...(team.leader_id ? [team.leader_id] : []),
          ...(team.member_ids || []),
        ],
        description: sessDescription.trim() || null,
      });
      setSessions((prev) => [created, ...prev]);
      setSessionModalOpen(false);
      setSessDescription('');
      showNotice?.('Sessão de trabalho registada com sucesso!');
    } catch (err: unknown) {
      await customAlert({
        title: 'Erro ao Registar Sessão',
        message: err instanceof Error ? err.message : 'Tente novamente.',
        type: 'error',
      });
    } finally {
      setSavingSession(false);
    }
  };

  // Histórico de Alocações estruturado
  const filteredAllocationsHistory = useMemo(() => {
    const raw = [...(team.allocation_history || [])];
    // Se a equipa está alocada atualmente e não há registo correspondente, exibe a alocação ativa
    if (team.current_site_id && !raw.some((r) => r.status === 'ativa')) {
      raw.unshift({
        id: `active-${team.id}`,
        team_id: team.id,
        team_name: team.name,
        site_id: team.current_site_id,
        site_name: team.current_site_name || 'Obra Ativa',
        start_date: team.allocated_at ? team.allocated_at.slice(0, 10) : todayStr,
        end_date: team.allocation_end_date || null,
        start_time: team.allocation_start_time || null,
        end_time: team.allocation_end_time || null,
        status: 'ativa',
        changed_by: 'Administração / Líder',
        created_at: team.allocated_at || todayStr,
      });
    }

    return raw.filter((rec) => {
      if (histSiteFilter !== 'all' && rec.site_id !== histSiteFilter) return false;
      if (histDateFrom && rec.start_date < histDateFrom) return false;
      if (histDateTo && rec.start_date > histDateTo) return false;
      return true;
    });
  }, [team, histSiteFilter, histDateFrom, histDateTo, todayStr]);

  // Linha Temporal Unificada de Atividades (Sessões, Tarefas Concluídas, Composição, Líder, Ocorrências)
  const unifiedTimelineEvents = useMemo(() => {
    const items: Array<{
      id: string;
      dateIso: string;
      timestamp: string;
      type: 'sessao' | 'tarefa' | 'composicao' | 'lider' | 'ocorrencia' | 'alocacao' | 'arquivamento';
      title: string;
      description: string;
      siteId?: string | null;
      siteName?: string | null;
      author?: string | null;
      badgeText: string;
    }> = [];

    // 1. Sessões de trabalho
    for (const s of sessions) {
      const site = sites.find((st) => st.id === s.site_id);
      const mh =
        typeof s.man_hours === 'number' && s.man_hours > 0
          ? s.man_hours
          : Math.round(Number(s.hours_worked || 0) * Math.max(1, Number(s.workers_count || 1)) * 10) / 10;
      items.push({
        id: `tl-sess-${s.id}`,
        dateIso: s.work_date,
        timestamp: s.created_at || `${s.work_date}T17:00:00`,
        type: 'sessao',
        title: `Sessão de Trabalho — ${site?.name || 'Obra'}`,
        description: `${Number(s.hours_worked || 0).toFixed(1)}h de sessão • ${mh.toFixed(1)}h-homem (${s.workers_count || 1} colab.)${s.description ? ` • ${s.description}` : ''}`,
        siteId: s.site_id,
        siteName: site?.name || null,
        author: s.leader_name,
        badgeText: 'Sessão de Trabalho',
      });
    }

    // 2. Tarefas concluídas
    for (const t of teamTasks) {
      if (classifyTaskState(t) !== 'concluida') continue;
      const doneIso = (t.completed_at || t.confirmed_at || t.due_date || t.created_at || todayStr).slice(0, 10);
      const site = sites.find((st) => st.id === t.site_id);
      items.push({
        id: `tl-task-${t.id}`,
        dateIso: doneIso,
        timestamp: t.completed_at || t.confirmed_at || `${doneIso}T18:00:00`,
        type: 'tarefa',
        title: `Tarefa Concluída: ${t.title}`,
        description: [
          site ? `Obra: ${site.name}` : null,
          t.assigned_to_name ? `Execução: ${t.assigned_to_name}` : null,
          t.service_quantity && t.service_unit ? `Produção: ${t.service_quantity} ${t.service_unit}` : null,
        ]
          .filter(Boolean)
          .join(' • '),
        siteId: t.site_id,
        siteName: site?.name || null,
        author: t.completed_by_name || t.assigned_to_name || team.leader_name,
        badgeText: 'Tarefa Concluída',
      });
    }

    // 3. Eventos registados no activity_log da equipa (composição, líder, ocorrências, alocações)
    for (const act of team.activity_log || []) {
      const dateIso = (act.created_at || todayStr).slice(0, 10);
      const badgeMap: Record<string, string> = {
        composicao: 'Composição',
        lider: 'Mudança de Líder',
        ocorrencia: 'Ocorrência',
        alocacao: 'Alocação',
        arquivamento: 'Estado da Equipa',
      };
      items.push({
        id: `tl-act-${act.id}`,
        dateIso,
        timestamp: act.created_at || `${dateIso}T12:00:00`,
        type: act.type,
        title: act.title,
        description: act.description,
        siteId: act.site_id || null,
        siteName: act.site_name || null,
        author: act.author_name || 'Administração',
        badgeText: badgeMap[act.type] || 'Evento',
      });
    }

    return items
      .filter((item) => {
        if (histTypeFilter !== 'todos' && item.type !== histTypeFilter) return false;
        if (histSiteFilter !== 'all' && item.siteId !== histSiteFilter) return false;
        if (histDateFrom && item.dateIso < histDateFrom) return false;
        if (histDateTo && item.dateIso > histDateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sessions, teamTasks, team.activity_log, sites, histTypeFilter, histSiteFilter, histDateFrom, histDateTo, todayStr]);

  const handleToggleArchive = async () => {
    const nextArchive = !team.is_archived;
    const ok = await customConfirm({
      title: nextArchive ? 'Arquivar Equipa' : 'Restaurar Equipa',
      message: nextArchive
        ? `Deseja arquivar a equipa "${team.name}"? Todos os históricos, sessões e tarefas serão preservados, e novas alocações ficarão bloqueadas enquanto estiver arquivada.`
        : `Deseja restaurar a equipa "${team.name}" para que volte a estar operacional?`,
      type: nextArchive ? 'warning' : 'confirm',
      confirmText: nextArchive ? 'Arquivar Equipa' : 'Restaurar Equipa',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    const updated = await toggleArchiveTeamWeb(team, nextArchive, companyId);
    onTeamUpdated(updated);
    showNotice?.(nextArchive ? 'Equipa arquivada com sucesso.' : 'Equipa restaurada e ativa.');
  };

  return (
    <div style={{ maxWidth: 1220, margin: '0 auto', width: '100%', paddingBottom: 60 }}>
      {/* ================================================================== */}
      {/* CABEÇALHO DA EQUIPA E AÇÕES RÁPIDAS                                */}
      {/* ================================================================== */}
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={onBack}
          className="btn-flat-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 14,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          Voltar à Gestão de Equipas
        </button>

        <div
          className="content-panel"
          style={{
            padding: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                backgroundColor: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 800,
                border: '1px solid var(--border-color)',
                flexShrink: 0,
              }}
            >
              <Users size={28} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {team.name}
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: statusMeta.bg,
                    color: statusMeta.color,
                    border: `1px solid ${statusMeta.border}`,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: statusMeta.dotColor,
                    }}
                  />
                  {statusMeta.label}
                </span>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Líder responsável: <strong style={{ color: 'var(--text-main)' }}>{team.leader_name}</strong> •{' '}
                {totalMembersCount} elemento(s) ({memberEmployees.length} integrante{memberEmployees.length === 1 ? '' : 's'})
                {team.current_site_name ? (
                  <>
                    {' '}
                    • Obra: <strong style={{ color: 'var(--primary)' }}>{team.current_site_name}</strong>
                  </>
                ) : null}
              </div>

              {team.specialties && team.specialties.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {team.specialties.map((spec) => (
                    <span key={spec} className="badge-flat primary" style={{ fontSize: 10 }}>
                      {spec}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação Rápida do Cabeçalho */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {onEditTeamRequest && (
              <button
                type="button"
                onClick={() => onEditTeamRequest(team)}
                className="btn-flat-secondary"
                style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Edit2 size={14} /> Editar Equipa
              </button>
            )}

            {!team.is_archived && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('tarefas');
                    openCreateTaskModal();
                  }}
                  className="btn-flat-secondary"
                  style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Atribuir Tarefa
                </button>

                {team.current_site_id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setAllocModalMode('transfer');
                        setAllocModalOpen(true);
                      }}
                      className="btn-flat-primary"
                      style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <ArrowRightLeft size={14} /> Transferir Obra
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAllocModalMode('finish');
                        setAllocModalOpen(true);
                      }}
                      className="btn-flat-secondary"
                      style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}
                    >
                      Terminar Alocação
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAllocModalMode('allocate');
                      setAllocModalOpen(true);
                    }}
                    className="btn-flat-primary"
                    style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Building2 size={14} /> Alocar a Obra
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleToggleArchive}
              className="btn-flat-secondary"
              style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {team.is_archived ? <RotateCcw size={14} /> : <Archive size={14} />}
              {team.is_archived ? 'Restaurar' : 'Arquivar'}
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div
          className="content-panel"
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderLeft: '4px solid var(--danger)',
            color: 'var(--danger)',
            fontSize: 13,
          }}
        >
          {loadError}
        </div>
      )}

      {/* ================================================================== */}
      {/* BARRA DE 5 ABAS DE NAVEGAÇÃO (Secção 2)                            */}
      {/* ================================================================== */}
      <div
        className="responsive-tabs-bar"
        role="tablist"
        aria-label="Secções de detalhes da equipa"
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border-color)',
          marginBottom: 22,
          overflowX: 'auto',
        }}
      >
        {(
          [
            { id: 'visao_geral', label: '1. Visão Geral', icon: Layers },
            { id: 'colaboradores', label: `2. Colaboradores (${totalMembersCount})`, icon: Users },
            { id: 'tarefas', label: `3. Tarefas (${teamTasks.length})`, icon: CheckSquare },
            { id: 'desempenho', label: '4. Desempenho', icon: TrendingUp },
            { id: 'historico', label: `5. Histórico (${sessions.length + (team.allocation_history?.length || 0)})`, icon: Calendar },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '11px 16px',
                fontSize: 13,
                fontWeight: 700,
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ================================================================== */}
      {/* ABA 1: VISÃO GERAL (Secção 2.1)                                    */}
      {/* ================================================================== */}
      {activeTab === 'visao_geral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Indicadores Principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            <div className="content-panel" style={{ padding: 16, borderLeft: '4px solid var(--primary)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Membros Integrados
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginTop: 6 }}>
                {totalMembersCount}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Líder: {team.leader_name}
              </div>
            </div>

            <div className="content-panel" style={{ padding: 16, borderLeft: '4px solid #10B981' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Horas no Período ({periodRange.label})
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981', marginTop: 6 }}>
                {hoursMetrics.sessionHours.toFixed(1)}h{' '}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                  ({hoursMetrics.manHours.toFixed(1)} h-homem)
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {hoursMetrics.sessionCount} sessão(ões) de trabalho
              </div>
            </div>

            <div className="content-panel" style={{ padding: 16, borderLeft: '4px solid #3B82F6' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Estado das Tarefas
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 6 }}>
                {taskStats.concluidas} concluídas
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {taskStats.emExecucao} em execução • {taskStats.pendentes} pendentes
                {taskStats.atrasadas > 0 ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 700 }}> • {taskStats.atrasadas} atrasada(s)</span>
                ) : null}
              </div>
            </div>

            <div className="content-panel" style={{ padding: 16, borderLeft: '4px solid #F59E0B' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Obra Atual / Alocação
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  marginTop: 8,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {team.current_site_name || 'Sem Alocação Ativa'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {team.allocated_at ? (
                  <>
                    Início: {new Date(team.allocated_at).toLocaleDateString('pt-PT')}
                    {team.allocation_start_time ? ` às ${team.allocation_start_time}` : ''}
                  </>
                ) : (
                  'Equipa disponível para alocação'
                )}
              </div>
            </div>
          </div>

          {/* Acompanhamento da Obra Atual + Resumo da Equipa */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 18 }}>
            {/* Card Acompanhamento da Obra */}
            <div className="content-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 size={18} color="var(--primary)" />
                    Acompanhamento da Obra Atual
                  </h3>
                  {currentSite && onOpenSite && (
                    <button
                      type="button"
                      onClick={() => onOpenSite(currentSite)}
                      className="btn-flat-secondary"
                      style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      Consultar Obra <ExternalLink size={12} />
                    </button>
                  )}
                </div>

                {!team.current_site_id ? (
                  <div
                    style={{
                      padding: '28px 16px',
                      borderRadius: 10,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px dashed var(--border-color)',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                    }}
                  >
                    Esta equipa não possui alocação ativa no momento.
                    {!team.is_archived && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setAllocModalMode('allocate');
                            setAllocModalOpen(true);
                          }}
                          className="btn-flat-primary"
                          style={{ padding: '7px 14px', fontSize: 12 }}
                        >
                          Alocar a uma Obra
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 15, color: 'var(--text-main)' }}>
                          {currentSite?.name || team.current_site_name}
                        </strong>
                        <span className="badge-flat success" style={{ fontSize: 10 }}>
                          {(currentSite?.status || 'ativa').toUpperCase()}
                        </span>
                      </div>

                      {currentSite?.address && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {currentSite.address}
                        </div>
                      )}

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 10,
                          marginTop: 12,
                          paddingTop: 10,
                          borderTop: '1px solid var(--border-color)',
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>
                            Início da Alocação
                          </span>
                          <strong style={{ color: 'var(--text-main)' }}>
                            {team.allocated_at
                              ? new Date(team.allocated_at).toLocaleDateString('pt-PT')
                              : 'Registada'}
                            {team.allocation_start_time ? ` (${team.allocation_start_time})` : ''}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11 }}>
                            Conclusão Prevista
                          </span>
                          <strong style={{ color: 'var(--text-main)' }}>
                            {team.allocation_end_date
                              ? team.allocation_end_date.split('-').reverse().join('/')
                              : currentSite?.expected_end_date
                              ? currentSite.expected_end_date.split('-').reverse().join('/')
                              : 'Não definida'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Progresso real das tarefas atribuídas à equipa na obra */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                          Progresso das Tarefas da Equipa na Obra ({currentSiteTasksProgress.completed}/{currentSiteTasksProgress.count})
                        </span>
                        <strong style={{ color: 'var(--primary)' }}>{currentSiteTasksProgress.pct}%</strong>
                      </div>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 6,
                          backgroundColor: 'var(--border-color)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${currentSiteTasksProgress.pct}%`,
                            backgroundColor: 'var(--primary)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ações Rápidas da Visão Geral */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('colaboradores');
                    setAddMemberModalOpen(true);
                  }}
                  className="btn-flat-secondary"
                  style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <UserPlus size={13} /> Adicionar Colaborador
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('tarefas');
                    openCreateTaskModal();
                  }}
                  className="btn-flat-secondary"
                  style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Plus size={13} /> Atribuir Tarefa
                </button>
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(true)}
                  className="btn-flat-secondary"
                  style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Clock size={13} /> Registar Sessão
                </button>
              </div>
            </div>

            {/* Card Informações Principais & Especialidades */}
            <div className="content-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="var(--primary)" />
                Ficha Operacional da Equipa
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Líder Responsável</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {team.leader_name}
                  </div>
                  {(team.leader_phone || leaderEmployee?.phone) && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {team.leader_phone || leaderEmployee?.phone}
                    </div>
                  )}
                </div>

                <div style={{ padding: 10, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estado Operacional</div>
                  <div style={{ fontWeight: 700, color: statusMeta.color, marginTop: 2 }}>
                    {statusMeta.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {distinctSitesServed} obra(s) atendida(s)
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Especialidades Técnicas
                </div>
                {team.specialties && team.specialties.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {team.specialties.map((spec) => (
                      <span key={spec} className="badge-flat primary" style={{ fontSize: 11, padding: '4px 10px' }}>
                        {spec}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nenhuma especialidade registada. Edite a equipa para definir especialidades (Alvenaria, Capoto, Reboco, etc.).
                  </div>
                )}
              </div>

              {team.notes && (
                <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Notas & Diretrizes
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-main)', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {team.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 2: COLABORADORES (Secção 2.2)                                  */}
      {/* ================================================================== */}
      {activeTab === 'colaboradores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Barra de Controle e Ações da Composição */}
          <div
            className="content-panel"
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                Período de Apuramento de Horas:
              </span>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="mes">Este mês</option>
                <option value="3m">Últimos 3 meses</option>
                <option value="tudo">Todo o período</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setNewLeaderId(team.leader_id || '');
                  setChangeLeaderModalOpen(true);
                }}
                className="btn-flat-secondary"
                style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Shield size={14} /> Alterar Líder
              </button>
              <button
                type="button"
                onClick={() => setAddMemberModalOpen(true)}
                className="btn-flat-primary"
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <UserPlus size={14} /> Adicionar Colaborador
              </button>
            </div>
          </div>

          {/* Cartão do Líder Responsável */}
          <div className="content-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="var(--primary)" />
                <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Líder Responsável
                </h3>
              </div>
            </div>

            {leaderEmployee ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {leaderEmployee.avatar_url ? (
                    <img
                      src={leaderEmployee.avatar_url}
                      alt={leaderEmployee.full_name}
                      style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 800,
                      }}
                    >
                      {leaderEmployee.full_name.charAt(0)}
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 15, color: 'var(--text-main)' }}>
                        {leaderEmployee.full_name}
                      </strong>
                      <span className="badge-flat primary" style={{ fontSize: 10 }}>
                        Líder / Encarregado
                      </span>
                      <span
                        className={`badge-flat ${leaderEmployee.is_active ? 'success' : 'danger'}`}
                        style={{ fontSize: 10 }}
                      >
                        {leaderEmployee.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Cargo: <strong>{leaderEmployee.job_title || 'Encarregado'}</strong> • Entrada na equipa:{' '}
                      {team.member_joined_at?.[leaderEmployee.id]
                        ? team.member_joined_at[leaderEmployee.id].split('-').reverse().join('/')
                        : team.created_at
                        ? team.created_at.slice(0, 10).split('-').reverse().join('/')
                        : '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Horas no período</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#10B981' }}>
                      {calculateEmployeeHoursFromEntries({
                        entries,
                        employeeId: leaderEmployee.id,
                        startDate: periodRange.startDate,
                        endDate: periodRange.endDate,
                      }).toFixed(1)}
                      h
                    </div>
                  </div>

                  {onOpenEmployee && (
                    <button
                      type="button"
                      onClick={() => onOpenEmployee(leaderEmployee)}
                      className="btn-flat-secondary"
                      style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700 }}
                    >
                      Abrir Perfil
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, color: 'var(--danger)', fontSize: 13 }}>
                Nenhum líder válido encontrado. Clique em "Alterar Líder" para definir o responsável.
              </div>
            )}
          </div>

          {/* Lista de Integrantes */}
          <div className="content-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 14px' }}>
              Integrantes da Equipa ({memberEmployees.length})
            </h3>

            {memberEmployees.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  textAlign: 'center',
                  borderRadius: 10,
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                }}
              >
                Nenhum integrante adicional associado. Clique em "Adicionar Colaborador" para compor a equipa.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 14 }}>
                {memberEmployees.map((member) => {
                  const memberHours = calculateEmployeeHoursFromEntries({
                    entries,
                    employeeId: member.id,
                    startDate: periodRange.startDate,
                    endDate: periodRange.endDate,
                  });
                  const joinedAt =
                    team.member_joined_at?.[member.id] ||
                    (team.created_at ? team.created_at.slice(0, 10) : null);
                  const memberSpec = team.member_specialties?.[member.id] || '';

                  return (
                    <div
                      key={member.id}
                      style={{
                        padding: 16,
                        borderRadius: 10,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.full_name}
                              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 16,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {member.full_name.charAt(0)}
                            </div>
                          )}

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                              {member.full_name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {member.job_title || 'Colaborador'}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`badge-flat ${member.is_active ? 'success' : 'danger'}`}
                          style={{ fontSize: 10 }}
                        >
                          {member.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                          fontSize: 12,
                          padding: '8px 10px',
                          borderRadius: 6,
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
                            Horas no período
                          </span>
                          <strong style={{ color: '#10B981' }}>{memberHours.toFixed(1)}h</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
                            Entrada na equipa
                          </span>
                          <strong style={{ color: 'var(--text-main)' }}>
                            {joinedAt ? joinedAt.split('-').reverse().join('/') : '—'}
                          </strong>
                        </div>
                        <div style={{ gridColumn: '1 / -1', marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                            Especialidade na Equipa
                          </span>
                          <select
                            value={memberSpec}
                            onChange={(e) => handleUpdateMemberSpecialty(member.id, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card-subtle)',
                              color: 'var(--text-main)',
                              fontSize: 11,
                            }}
                          >
                            <option value="">Geral / Polivalente</option>
                            {TEAM_SPECIALTIES_CATALOG.map((sp) => (
                              <option key={sp} value={sp}>
                                {sp}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {onOpenEmployee ? (
                          <button
                            type="button"
                            onClick={() => onOpenEmployee(member)}
                            className="btn-flat-secondary"
                            style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700 }}
                          >
                            Ver Perfil
                          </button>
                        ) : (
                          <span />
                        )}

                        <div style={{ display: 'flex', gap: 6 }}>
                          {allTeams.filter((t) => t.id !== team.id && !t.is_archived).length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const otherTeams = allTeams.filter((t) => t.id !== team.id && !t.is_archived);
                                setTargetTransferTeamId(otherTeams[0]?.id || '');
                                setTransferMemberReason('');
                                setTransferMemberModal(member);
                              }}
                              className="btn-flat-secondary"
                              style={{ padding: '5px 9px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Transferir para outra equipa"
                            >
                              <ArrowRightLeft size={12} /> Transferir
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberFromTeam(member)}
                            className="btn-flat-danger"
                            style={{ padding: '5px 9px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Remover da equipa"
                          >
                            <UserMinus size={12} /> Remover
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

      {/* ================================================================== */}
      {/* ABA 3: TAREFAS DA EQUIPA (Secção 2.3)                              */}
      {/* ================================================================== */}
      {activeTab === 'tarefas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Barra de Pesquisa, Filtros e Botão Nova Tarefa */}
          <div
            className="content-panel"
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  placeholder="Pesquisar tarefa ou responsável..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    color: 'var(--text-main)',
                    fontSize: 12,
                  }}
                />
              </div>

              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value as typeof taskStatusFilter)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="todas">Todos os Estados</option>
                <option value="pendente">Pendente</option>
                <option value="em_execucao">Em Execução</option>
                <option value="concluida">Concluída</option>
                <option value="atrasada">Atrasada</option>
              </select>

              <select
                value={taskSiteFilter}
                onChange={(e) => setTaskSiteFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
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

              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="all">Todas Prioridades</option>
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>

              <select
                value={taskSortBy}
                onChange={(e) => setTaskSortBy(e.target.value as typeof taskSortBy)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="prazo">Ordenar por Prazo</option>
                <option value="prioridade">Ordenar por Prioridade</option>
                <option value="progresso">Ordenar por Progresso</option>
                <option value="recentes">Mais Recentes</option>
              </select>
            </div>

            <button
              type="button"
              onClick={openCreateTaskModal}
              className="btn-flat-primary"
              style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> Criar Tarefa
            </button>
          </div>

          {/* Lista de Tarefas */}
          {filteredTasks.length === 0 ? (
            <div className="content-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckSquare size={28} color="var(--primary)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                Nenhuma tarefa encontrada para esta equipa
              </div>
              <p style={{ fontSize: 13, margin: '6px 0 14px' }}>
                Crie e distribua tarefas para acompanhar prazos, progresso e registo fotográfico antes/depois.
              </p>
              <button type="button" onClick={openCreateTaskModal} className="btn-flat-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                + Criar Primeira Tarefa
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredTasks.map((task) => {
                const state = classifyTaskState(task);
                const site = sites.find((s) => s.id === task.site_id);
                const stateBadge =
                  state === 'concluida'
                    ? { label: 'Concluída', cls: 'success' }
                    : state === 'atrasada'
                    ? { label: 'Atrasada', cls: 'danger' }
                    : state === 'em_execucao'
                    ? { label: 'Em Execução', cls: 'primary' }
                    : { label: 'Pendente', cls: 'warning' };

                const prioBadge =
                  task.priority === 'urgente' || task.priority === 'alta'
                    ? 'danger'
                    : task.priority === 'baixa'
                    ? 'success'
                    : 'primary';

                return (
                  <div
                    key={task.id}
                    className="content-panel"
                    style={{
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      borderLeft: `4px solid ${
                        state === 'concluida'
                          ? '#10B981'
                          : state === 'atrasada'
                          ? 'var(--danger)'
                          : state === 'em_execucao'
                          ? 'var(--primary)'
                          : '#F59E0B'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                            {task.title}
                          </h4>
                          <span className={`badge-flat ${stateBadge.cls}`} style={{ fontSize: 10 }}>
                            {stateBadge.label}
                          </span>
                          <span className={`badge-flat ${prioBadge}`} style={{ fontSize: 10 }}>
                            Prioridade: {(task.priority || 'media').toUpperCase()}
                          </span>
                        </div>

                        {task.description && (
                          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                            {task.description}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {state !== 'concluida' && (
                          <button
                            type="button"
                            onClick={() => handleCompleteTask(task)}
                            className="btn-flat-primary"
                            style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <CheckCircle2 size={13} /> Concluir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditTaskModal(task)}
                          className="btn-flat-secondary"
                          style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Edit2 size={12} /> Editar / Fotos
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task)}
                          className="btn-flat-danger"
                          style={{ padding: '5px 8px', fontSize: 11 }}
                          title="Eliminar tarefa"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        backgroundColor: 'var(--bg-card-subtle)',
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Obra Associada</span>
                        <strong style={{ color: 'var(--text-main)' }}>{site?.name || 'Obra'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Responsável</span>
                        <strong style={{ color: 'var(--text-main)' }}>{task.assigned_to_name || team.leader_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Início / Prazo</span>
                        <strong style={{ color: state === 'atrasada' ? 'var(--danger)' : 'var(--text-main)' }}>
                          {task.start_date ? task.start_date.split('-').reverse().join('/') : '—'} →{' '}
                          {task.due_date ? task.due_date.split('-').reverse().join('/') : 'Sem prazo'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>Progresso</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ color: 'var(--primary)' }}>{task.progress || 0}%</strong>
                          {state !== 'concluida' && (
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={10}
                              value={task.progress || 0}
                              onChange={(e) => handleQuickProgressUpdate(task, Number(e.target.value))}
                              style={{ width: 80, cursor: 'pointer' }}
                              title="Ajustar progresso da tarefa"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {(task.observations ||
                      (task.before_photos && task.before_photos.length > 0) ||
                      (task.completion_photos && task.completion_photos.length > 0)) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                        {task.observations && (
                          <div style={{ color: 'var(--text-muted)' }}>
                            <strong>Observações:</strong> {task.observations}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {task.before_photos && task.before_photos.length > 0 && (
                            <div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                                Fotos Antes ({task.before_photos.length})
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {task.before_photos.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt="Antes"
                                    onClick={() => setPreviewImage(url)}
                                    style={{ width: 46, height: 46, borderRadius: 6, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {task.completion_photos && task.completion_photos.length > 0 && (
                            <div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                                Fotos Depois ({task.completion_photos.length})
                              </span>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {task.completion_photos.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt="Depois"
                                    onClick={() => setPreviewImage(url)}
                                    style={{ width: 46, height: 46, borderRadius: 6, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 4: DESEMPENHO (Secção 2.4)                                     */}
      {/* ================================================================== */}
      {activeTab === 'desempenho' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Filtro de Período de Desempenho */}
          <div
            className="content-panel"
            style={{
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={17} color="var(--primary)" />
              Análise de Desempenho & Esforço Operacional
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {(
                [
                  { id: '7d', label: 'Últimos 7 dias' },
                  { id: '30d', label: 'Últimos 30 dias' },
                  { id: 'mes', label: 'Este mês' },
                  { id: '3m', label: 'Últimos 3 meses' },
                  { id: 'custom', label: 'Personalizado' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodFilter(p.id)}
                  className={periodFilter === p.id ? 'btn-flat-primary' : 'btn-flat-secondary'}
                  style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700 }}
                >
                  {p.label}
                </button>
              ))}

              {periodFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-main)' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>até</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-main)' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 6 KPIs de Desempenho */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div className="content-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Horas de Sessão
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
                {hoursMetrics.sessionHours.toFixed(1)}h
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Duração das sessões da equipa
              </div>
            </div>

            <div className="content-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Horas-Homem Acumuladas
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981', marginTop: 4 }}>
                {hoursMetrics.manHours.toFixed(1)}h
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Soma efetiva dos colaboradores
              </div>
            </div>

            <div className="content-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Tarefas Concluídas
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                {taskStats.concluidas}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Entregas confirmadas
              </div>
            </div>

            <div className="content-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Tarefas Atrasadas
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: taskStats.atrasadas > 0 ? 'var(--danger)' : 'var(--text-main)',
                  marginTop: 4,
                }}
              >
                {taskStats.atrasadas}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Prazo ultrapassado sem fecho
              </div>
            </div>

            <div className="content-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Cumprimento de Prazos
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>
                {taskStats.onTimeRate !== null ? `${taskStats.onTimeRate}%` : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {taskStats.onTimeRate !== null ? 'Concluídas dentro do prazo' : 'Sem tarefas com prazo concluídas'}
              </div>
            </div>

            <div className="content-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Obras Atendidas
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                {distinctSitesServed}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Canteiros com atuação
              </div>
            </div>
          </div>

          {/* Grelha de Gráficos 1 e 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 18 }}>
            {/* Gráfico 1: Horas Trabalhadas por Semana (Barras) */}
            <div className="content-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Gráfico 1 — Horas Trabalhadas por Semana
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 16px' }}>
                Comparativo entre Horas de Sessão da equipa e Horas-Homem totais por semana
              </p>

              {(() => {
                const maxVal = Math.max(
                  10,
                  ...weeklyPerformanceSeries.map((w) => Math.max(w.sessionHours, w.manHours))
                );
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div
                      style={{
                        height: 170,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${weeklyPerformanceSeries.length}, 1fr)`,
                        alignItems: 'end',
                        gap: 10,
                        paddingTop: 18,
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      {weeklyPerformanceSeries.map((w) => {
                        const hSessPct = Math.round((w.sessionHours / maxVal) * 100);
                        const hManPct = Math.round((w.manHours / maxVal) * 100);
                        return (
                          <div
                            key={w.startIso}
                            style={{
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                              {w.sessionHours > 0 ? `${w.sessionHours}h` : ''}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '80%', width: '100%', justifyContent: 'center' }}>
                              <div
                                title={`Horas de Sessão: ${w.sessionHours}h`}
                                style={{
                                  width: 14,
                                  height: `${Math.max(4, hSessPct)}%`,
                                  backgroundColor: 'var(--primary)',
                                  borderRadius: '4px 4px 0 0',
                                }}
                              />
                              <div
                                title={`Horas-Homem: ${w.manHours}h`}
                                style={{
                                  width: 14,
                                  height: `${Math.max(4, hManPct)}%`,
                                  backgroundColor: '#10B981',
                                  borderRadius: '4px 4px 0 0',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${weeklyPerformanceSeries.length}, 1fr)`,
                        textAlign: 'center',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {weeklyPerformanceSeries.map((w) => (
                        <span key={w.startIso}>Sem. {w.label}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--primary)' }} />
                        Horas de Sessão
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#10B981' }} />
                        Horas-Homem
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Gráfico 2: Tarefas Concluídas por Semana (Linhas) */}
            <div className="content-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Gráfico 2 — Tarefas Concluídas por Semana
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 16px' }}>
                Evolução semanal das entregas concluídas pela equipa
              </p>

              {(() => {
                const maxTasks = Math.max(4, ...weeklyPerformanceSeries.map((w) => w.tasksCompleted));
                const chartW = 420;
                const chartH = 145;
                const padX = 28;
                const padY = 20;
                const points = weeklyPerformanceSeries.map((w, idx) => {
                  const x =
                    padX +
                    (idx / Math.max(1, weeklyPerformanceSeries.length - 1)) * (chartW - padX * 2);
                  const y =
                    chartH -
                    padY -
                    (w.tasksCompleted / maxTasks) * (chartH - padY * 2);
                  return { x, y, val: w.tasksCompleted, label: w.label };
                });
                const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <svg
                      viewBox={`0 0 ${chartW} ${chartH}`}
                      style={{ width: '100%', height: 170, overflow: 'visible' }}
                    >
                      {[0, 0.5, 1].map((r, i) => {
                        const y = chartH - padY - r * (chartH - padY * 2);
                        return (
                          <line
                            key={i}
                            x1={padX}
                            y1={y}
                            x2={chartW - padX}
                            y2={y}
                            stroke="var(--border-color)"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                        );
                      })}
                      <polyline
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="2.5"
                        points={polylinePoints}
                      />
                      {points.map((p, idx) => (
                        <g key={idx}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={4.5}
                            fill="var(--primary)"
                            stroke="var(--bg-card)"
                            strokeWidth="2"
                          />
                          <text
                            x={p.x}
                            y={p.y - 9}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="700"
                            fill="var(--text-main)"
                          >
                            {p.val}
                          </text>
                        </g>
                      ))}
                    </svg>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${weeklyPerformanceSeries.length}, 1fr)`,
                        textAlign: 'center',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {weeklyPerformanceSeries.map((w) => (
                        <span key={w.startIso}>Sem. {w.label}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Grelha de Gráficos 3 e 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 18 }}>
            {/* Gráfico 3: Distribuição de Horas por Obra */}
            <div className="content-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Gráfico 3 — Distribuição de Horas por Obra
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 16px' }}>
                Proporção de horas de sessão e horas-homem dedicadas a cada empreitada no período
              </p>

              {hoursMetrics.hoursBySite.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Sem sessões de trabalho registadas no período selecionado.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {hoursMetrics.hoursBySite.map((item) => {
                    const site = sites.find((s) => s.id === item.siteId);
                    const pct =
                      hoursMetrics.sessionHours > 0
                        ? Math.round((item.hours / hoursMetrics.sessionHours) * 100)
                        : 0;
                    return (
                      <div key={item.siteId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <strong style={{ color: 'var(--text-main)' }}>
                            {site?.name || `Obra ${item.siteId.slice(0, 6)}`}
                          </strong>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            <strong style={{ color: 'var(--primary)' }}>{item.hours.toFixed(1)}h</strong> sessão •{' '}
                            <strong style={{ color: '#10B981' }}>{item.manHours.toFixed(1)}h-homem</strong> ({pct}% •{' '}
                            {item.sessionCount} turno{item.sessionCount === 1 ? '' : 's'})
                          </span>
                        </div>
                        <div style={{ height: 8, backgroundColor: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              backgroundColor: 'var(--primary)',
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gráfico 4: Horas Previstas vs. Realizadas */}
            <div className="content-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Gráfico 4 — Horas Previstas vs. Realizadas
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 16px' }}>
                Comparação entre as horas planeadas nas tarefas e as horas de sessão realizadas
              </p>

              {plannedVsRealizedBySite.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  Nenhuma tarefa da equipa possui "Horas Previstas" configuradas ainda. Ao criar ou editar uma tarefa na aba Tarefas, preencha o campo de horas planeadas para visualizar o comparativo previsto vs. realizado.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {plannedVsRealizedBySite.map((row, idx) => {
                    const maxRow = Math.max(1, row.planned, row.realized);
                    const pPct = Math.round((row.planned / maxRow) * 100);
                    const rPct = Math.round((row.realized / maxRow) * 100);
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <strong style={{ color: 'var(--text-main)' }}>{row.siteName}</strong>
                          <span style={{ color: 'var(--text-muted)' }}>
                            Previsto: <strong>{row.planned.toFixed(1)}h</strong> • Realizado:{' '}
                            <strong style={{ color: row.realized > row.planned ? 'var(--danger)' : '#10B981' }}>
                              {row.realized.toFixed(1)}h
                            </strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ height: 6, backgroundColor: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pPct}%`, height: '100%', backgroundColor: '#64748B' }} />
                          </div>
                          <div style={{ height: 6, backgroundColor: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${rPct}%`,
                                height: '100%',
                                backgroundColor: row.realized > row.planned ? '#F59E0B' : '#10B981',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Produtividade por Quantidade Física de Serviço Realizado (Secção 2.4) */}
          <div className="content-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Award size={18} color="var(--primary)" />
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Produtividade por Quantidade de Serviço Realizado
              </h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
              Medição objetiva de produção física (ex: m² de reboco, m² de capoto, m² de alvenaria). Mais horas trabalhadas não significam automaticamente maior produtividade.
            </p>

            {serviceProductivityMetrics.length === 0 ? (
              <div
                style={{
                  padding: 18,
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-card-subtle)',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                Sem medições de quantidade de serviço nas tarefas atuais. Para medir o rendimento físico da equipa (ex.: m²/hora), informe a quantidade e a unidade (m² de reboco, m² de capoto, etc.) ao criar ou editar tarefas.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {serviceProductivityMetrics.map((m) => {
                  const ratePerHour =
                    hoursMetrics.sessionHours > 0
                      ? (m.completedQuantity / hoursMetrics.sessionHours).toFixed(2)
                      : null;
                  return (
                    <div
                      key={m.unit}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {m.unit}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                        {m.completedQuantity} / {m.totalQuantity}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 4 }}>
                        {ratePerHour ? `Rendimento médio: ${ratePerHour} ${m.unit}/h` : `${m.taskCount} tarefa(s) associada(s)`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 5: HISTÓRICO (Secção 2.5)                                      */}
      {/* ================================================================== */}
      {activeTab === 'historico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Filtros do Histórico e Botões de Registo */}
          <div
            className="content-panel"
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Filter size={14} color="var(--text-muted)" />
              <select
                value={histTypeFilter}
                onChange={(e) => setHistTypeFilter(e.target.value as typeof histTypeFilter)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
              >
                <option value="todos">Todos os Tipos de Evento</option>
                <option value="sessao">Sessões de Trabalho</option>
                <option value="tarefa">Tarefas Concluídas</option>
                <option value="alocacao">Alocações e Transferências</option>
                <option value="composicao">Alterações na Composição</option>
                <option value="lider">Mudanças de Líder</option>
                <option value="ocorrencia">Ocorrências Registadas</option>
              </select>

              <select
                value={histSiteFilter}
                onChange={(e) => setHistSiteFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
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

              <input
                type="date"
                value={histDateFrom}
                onChange={(e) => setHistDateFrom(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
                title="Data inicial"
              />
              <input
                type="date"
                value={histDateTo}
                onChange={(e) => setHistDateTo(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 12,
                }}
                title="Data final"
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSessionModalOpen(true)}
                className="btn-flat-secondary"
                style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Clock size={13} /> + Sessão de Trabalho
              </button>
              <button
                type="button"
                onClick={() => setOccurrenceModalOpen(true)}
                className="btn-flat-primary"
                style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <AlertCircle size={13} /> + Registar Ocorrência
              </button>
            </div>
          </div>

          {/* Categoria 1: Histórico de Alocações */}
          <div className="content-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 12px' }}>
              1. Histórico de Alocações em Obras ({filteredAllocationsHistory.length})
            </h3>

            {filteredAllocationsHistory.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Nenhum registo de alocação encontrado para os filtros aplicados.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="flat-table" style={{ width: '100%', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Obra</th>
                      <th>Data de Início</th>
                      <th>Data de Fim</th>
                      <th>Duração</th>
                      <th>Estado</th>
                      <th>Responsável</th>
                      <th>Motivo / Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllocationsHistory.map((alloc) => {
                      const dStart = new Date(alloc.start_date + 'T12:00:00');
                      const dEnd = alloc.end_date ? new Date(alloc.end_date + 'T12:00:00') : new Date();
                      const daysDiff = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                      return (
                        <tr key={alloc.id}>
                          <td>
                            <strong style={{ color: 'var(--text-main)' }}>{alloc.site_name}</strong>
                          </td>
                          <td>
                            {alloc.start_date.split('-').reverse().join('/')}
                            {alloc.start_time ? ` (${alloc.start_time})` : ''}
                          </td>
                          <td>
                            {alloc.end_date ? alloc.end_date.split('-').reverse().join('/') : 'Em curso'}
                          </td>
                          <td>{daysDiff} dia(s)</td>
                          <td>
                            <span
                              className={`badge-flat ${
                                alloc.status === 'ativa'
                                  ? 'success'
                                  : alloc.status === 'planeada'
                                  ? 'primary'
                                  : 'warning'
                              }`}
                              style={{ fontSize: 10 }}
                            >
                              {alloc.status.toUpperCase()}
                            </span>
                          </td>
                          <td>{alloc.changed_by || 'Administração'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {alloc.transfer_reason || alloc.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Categoria 2: Linha Temporal de Atividades */}
          <div className="content-panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 14px' }}>
              2. Histórico de Atividades (Linha Temporal Cronológica)
            </h3>

            {loadingData ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                A carregar linha temporal de atividades...
              </div>
            ) : unifiedTimelineEvents.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Nenhuma atividade registada para os filtros selecionados.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {unifiedTimelineEvents.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${
                        ev.type === 'ocorrencia'
                          ? 'var(--danger)'
                          : ev.type === 'sessao' || ev.type === 'tarefa'
                          ? '#10B981'
                          : 'var(--primary)'
                      }`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="badge-flat primary" style={{ fontSize: 10 }}>
                          {ev.badgeText}
                        </span>
                        <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{ev.title}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {ev.description}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {ev.dateIso.split('-').reverse().join('/')}
                      </div>
                      {ev.author && <div>por {ev.author}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAIS DE OPERAÇÃO DA PÁGINA DE DETALHES                           */}
      {/* ================================================================== */}
      <TeamAllocationModal
        isOpen={allocModalOpen}
        mode={allocModalMode}
        team={team}
        sites={sites}
        employees={employees}
        companyId={companyId}
        onClose={() => setAllocModalOpen(false)}
        onSuccess={(updated, msg) => {
          onTeamUpdated(updated);
          loadOperationalData();
          showNotice?.(msg);
        }}
      />

      {/* Modal: Adicionar Colaborador */}
      {addMemberModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setAddMemberModalOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Adicionar Colaborador — {team.name}</h3>
              <button type="button" onClick={() => setAddMemberModalOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddMemberToTeam} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Colaborador Ativo *</label>
                <select
                  required
                  value={selectedNewMemberId}
                  onChange={(e) => setSelectedNewMemberId(e.target.value)}
                  style={{ padding: '9px 12px' }}
                >
                  <option value="">Selecione um colaborador...</option>
                  {employees
                    .filter(
                      (emp) =>
                        emp.is_active &&
                        emp.id !== team.leader_id &&
                        !(team.member_ids || []).includes(emp.id)
                    )
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.job_title || 'Colaborador'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Especialidade na Equipa (opcional)</label>
                <select
                  value={selectedNewMemberSpec}
                  onChange={(e) => setSelectedNewMemberSpec(e.target.value)}
                  style={{ padding: '9px 12px' }}
                >
                  <option value="">Geral / Polivalente</option>
                  {TEAM_SPECIALTIES_CATALOG.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setAddMemberModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingMemberAction}>
                  {savingMemberAction ? 'A guardar...' : 'Adicionar à Equipa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Alterar Líder Responsável */}
      {changeLeaderModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setChangeLeaderModalOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Alterar Líder Responsável — {team.name}</h3>
              <button type="button" onClick={() => setChangeLeaderModalOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleChangeTeamLeader} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Novo Líder / Encarregado *</label>
                <select
                  required
                  value={newLeaderId}
                  onChange={(e) => setNewLeaderId(e.target.value)}
                  style={{ padding: '9px 12px' }}
                >
                  <option value="">Selecione o líder...</option>
                  {employees
                    .filter((emp) => emp.is_active)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.job_title || 'Colaborador'})
                      </option>
                    ))}
                </select>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Se o novo líder já era integrante comum, será promovido sem duplicação na lista.
                </span>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setChangeLeaderModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingMemberAction}>
                  Confirmar Novo Líder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transferir Colaborador entre Equipas */}
      {transferMemberModal && (
        <div className="flat-modal-backdrop" onClick={() => setTransferMemberModal(null)}>
          <div className="flat-modal-box" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Transferir {transferMemberModal.full_name}</h3>
              <button type="button" onClick={() => setTransferMemberModal(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleTransferMemberSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Equipa de Destino *</label>
                <select
                  required
                  value={targetTransferTeamId}
                  onChange={(e) => setTargetTransferTeamId(e.target.value)}
                  style={{ padding: '9px 12px' }}
                >
                  {allTeams
                    .filter((t) => t.id !== team.id && !t.is_archived)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Líder: {t.leader_name})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Motivo da Transferência (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Reforço de especialidade..."
                  value={transferMemberReason}
                  onChange={(e) => setTransferMemberReason(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>
              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setTransferMemberModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingMemberAction}>
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criar / Editar Tarefa da Equipa */}
      {taskModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setTaskModalOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 620, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                {editingTask ? 'Editar Tarefa da Equipa' : 'Nova Tarefa para a Equipa'}
              </h3>
              <button type="button" onClick={() => setTaskModalOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Título da Tarefa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Execução de reboco exterior fachada norte"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div className="responsive-form-grid-2">
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Obra Associada *</label>
                  <select
                    required
                    value={taskSiteId}
                    onChange={(e) => setTaskSiteId(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Responsável na Equipa *</label>
                  <select
                    value={taskAssignedId}
                    onChange={(e) => setTaskAssignedId(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  >
                    {allTeamCollaborators.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} {emp.id === team.leader_id ? '(Líder)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="responsive-form-grid-3">
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Prioridade</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    style={{ padding: '8px 12px' }}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Data de Início</label>
                  <input
                    type="date"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Prazo Limite</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div className="responsive-form-grid-3">
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Estado de Execução</label>
                  <select
                    value={taskExecStatus}
                    onChange={(e) => setTaskExecStatus(e.target.value as TaskExecutionStatus)}
                    style={{ padding: '8px 12px' }}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="em_execucao">Em Execução</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Progresso ({taskProgress}%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={taskProgress}
                    onChange={(e) => setTaskProgress(Math.max(0, Math.min(100, Number(e.target.value))))}
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Horas Previstas (opcional)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Ex: 16"
                    value={taskPlannedHours}
                    onChange={(e) => setTaskPlannedHours(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div className="responsive-form-grid-2">
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Quantidade de Serviço (opcional)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 85"
                    value={taskServiceQty}
                    onChange={(e) => setTaskServiceQty(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Unidade de Medida</label>
                  <input
                    type="text"
                    placeholder="Ex: m² de reboco, m² de capoto..."
                    value={taskServiceUnit}
                    onChange={(e) => setTaskServiceUnit(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Descrição Técnica</label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  style={{ padding: '8px 12px', resize: 'none' }}
                />
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Observações de Execução</label>
                <input
                  type="text"
                  placeholder="Registe notas sobre o andamento..."
                  value={taskObservations}
                  onChange={(e) => setTaskObservations(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>

              {/* Fotografias Antes e Depois */}
              <div className="responsive-form-grid-2">
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Fotografias ANTES ({taskBeforePhotos.length})</label>
                  <label
                    className="btn-flat-secondary"
                    style={{ padding: '7px 10px', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Camera size={13} />
                    {uploadingTaskPhoto === 'before' ? 'A enviar...' : 'Anexar Foto Antes'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={uploadingTaskPhoto !== null}
                      onChange={(e) => handleUploadTaskPhoto(e, 'before')}
                    />
                  </label>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Fotografias DEPOIS ({taskAfterPhotos.length})</label>
                  <label
                    className="btn-flat-secondary"
                    style={{ padding: '7px 10px', fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Camera size={13} />
                    {uploadingTaskPhoto === 'after' ? 'A enviar...' : 'Anexar Foto Depois'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={uploadingTaskPhoto !== null}
                      onChange={(e) => handleUploadTaskPhoto(e, 'after')}
                    />
                  </label>
                </div>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setTaskModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingTask}>
                  {savingTask ? 'A guardar...' : editingTask ? 'Guardar Tarefa' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registar Ocorrência */}
      {occurrenceModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setOccurrenceModalOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Registar Ocorrência Operacional</h3>
              <button type="button" onClick={() => setOccurrenceModalOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveOccurrence} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Título da Ocorrência *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Atraso na receção de material, interrupção meteorológica..."
                  value={occTitle}
                  onChange={(e) => setOccTitle(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Obra Relacionada (opcional)</label>
                <select value={occSiteId} onChange={(e) => setOccSiteId(e.target.value)} style={{ padding: '8px 12px' }}>
                  <option value="">Geral da Equipa</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Descrição Detalhada *</label>
                <textarea
                  rows={3}
                  required
                  value={occDescription}
                  onChange={(e) => setOccDescription(e.target.value)}
                  style={{ padding: '8px 12px', resize: 'none' }}
                />
              </div>
              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setOccurrenceModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingOccurrence}>
                  Guardar Ocorrência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registar Sessão de Trabalho */}
      {sessionModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setSessionModalOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Registar Sessão de Trabalho — {team.name}</h3>
              <button type="button" onClick={() => setSessionModalOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveManualSession} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Obra *</label>
                <select required value={sessSiteId} onChange={(e) => setSessSiteId(e.target.value)} style={{ padding: '8px 12px' }}>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="responsive-form-grid-3">
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Data *</label>
                  <input type="date" required value={sessDate} onChange={(e) => setSessDate(e.target.value)} style={{ padding: '8px 12px' }} />
                </div>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Horas de Sessão *</label>
                  <input type="number" step="0.5" min="0.5" max="24" required value={sessHours} onChange={(e) => setSessHours(e.target.value)} style={{ padding: '8px 12px' }} />
                </div>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Nº Colaboradores *</label>
                  <input type="number" min="1" max="50" required value={sessWorkersCount} onChange={(e) => setSessWorkersCount(e.target.value)} style={{ padding: '8px 12px' }} />
                </div>
              </div>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Resumo do Turno</label>
                <textarea rows={2} value={sessDescription} onChange={(e) => setSessDescription(e.target.value)} style={{ padding: '8px 12px', resize: 'none' }} />
              </div>
              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setSessionModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" disabled={savingSession}>
                  Guardar Sessão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Imagem */}
      {previewImage && (
        <div className="flat-modal-backdrop" onClick={() => setPreviewImage(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '85vh', position: 'relative' }}>
            <img src={previewImage} alt="Visualização" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 10 }} />
          </div>
        </div>
      )}
    </div>
  );
}
