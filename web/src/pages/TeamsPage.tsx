import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit2,
  LayoutGrid,
  List,
  Calendar,
  Filter,
  ArrowUpDown,
  Building2,
  Phone,
  UserCheck,
  X,
  CheckCircle2,
  Clock,
  BarChart2,
  ChevronRight,
  Archive,
  RotateCcw,
  ArrowRightLeft,
  Square,
  CheckSquare,
  Layers,
  RotateCw,
  AlertTriangle,
} from 'lucide-react';
import {
  Team,
  EmployeeProfile,
  ConstructionSite,
  SiteTask,
  TimeEntry,
} from '../types';
import {
  getTeams,
  saveTeam,
  deleteTeam,
  getAllCompanyTasks,
  toggleArchiveTeamWeb,
  validateTeamPayload,
} from '../lib/supabase';
import { TeamDetailPage, TeamDetailTab } from './TeamDetailPage';
import { customConfirm, customAlert } from '../context/DialogContext';
import {
  TEAM_SPECIALTIES_CATALOG,
  getTeamOperationalStatus,
  getOperationalStatusBadgeMeta,
  filterTasksForTeam,
  isTeamAvailableOnDate,
  computeOperationalAlerts,
} from '../components/teams/teamOperations';
import { TeamWeeklyPlanner } from '../components/teams/TeamWeeklyPlanner';
import { TeamOperationalAlerts } from '../components/teams/TeamOperationalAlerts';
import {
  TeamAllocationModal,
  AllocationModalMode,
} from '../components/teams/TeamAllocationModal';

interface TeamsPageProps {
  companyId?: string;
  employees: EmployeeProfile[];
  sites: ConstructionSite[];
  entries?: TimeEntry[];
  onOpenEmployee?: (emp: EmployeeProfile) => void;
  onOpenSite?: (site: ConstructionSite) => void;
  showNotice?: (msg: string) => void;
}

type StatusFilterOption =
  | 'todas'
  | 'em_obra'
  | 'disponiveis'
  | 'em_atividade'
  | 'arquivadas';

type SortByOption =
  | 'nome_asc'
  | 'nome_desc'
  | 'membros_desc'
  | 'membros_asc'
  | 'recente_criada'
  | 'recente_alocada';

type MemberCountFilterOption = 'todos' | '1_3' | '4_6' | '7_mais';

export function TeamsPage({
  companyId,
  employees,
  sites,
  entries = [],
  onOpenEmployee,
  onOpenSite,
  showNotice,
}: TeamsPageProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [companyTasks, setCompanyTasks] = useState<SiteTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamForDetail, setSelectedTeamForDetail] = useState<Team | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<TeamDetailTab>('visao_geral');

  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'planner'>('cards');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );

  // Filtros e ordenação (Secção 1.2)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('todas');
  const [siteFilter, setSiteFilter] = useState<string>('todas');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('todas');
  const [availabilityDateFilter, setAvailabilityDateFilter] = useState<string>('');
  const [memberCountFilter, setMemberCountFilter] = useState<MemberCountFilterOption>('todos');
  const [sortBy, setSortBy] = useState<SortByOption>('nome_asc');

  // Modal de Alocação / Transferência / Término Rápido
  const [allocModalOpen, setAllocModalOpen] = useState(false);
  const [allocModalMode, setAllocModalMode] = useState<AllocationModalMode>('allocate');
  const [allocModalTeam, setAllocModalTeam] = useState<Team | null>(null);
  const [allocModalDefaultDate, setAllocModalDefaultDate] = useState<string | undefined>(undefined);

  // Modal de Criação / Edição de Equipa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<{ id: string; name: string }[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);

  const memberInputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadTeamsData = async () => {
    setLoading(true);
    try {
      const siteIds = sites.map((s) => s.id);
      const [teamsData, tasksData] = await Promise.all([
        getTeams(companyId),
        getAllCompanyTasks(companyId, siteIds),
      ]);
      setTeams(teamsData);
      setCompanyTasks(tasksData);
    } catch (err) {
      console.error('Erro ao carregar equipas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamsData();
  }, [companyId, sites.length]);

  // Fechar dropdown de sugestões de membros ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(event.target as Node) &&
        memberInputRef.current &&
        !memberInputRef.current.contains(event.target as Node)
      ) {
        setShowMemberSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSafeCloseModal = async () => {
    if (isFormDirty && !saving) {
      const discard = await customConfirm({
        title: 'Descartar Alterações',
        message: 'Existem dados preenchidos não guardados. Deseja fechar o formulário mesmo assim?',
        type: 'warning',
        confirmText: 'Descartar',
        cancelText: 'Continuar a Editar',
      });
      if (!discard) return;
    }
    setIsModalOpen(false);
    setIsFormDirty(false);
  };

  // Fechar o diálogo ao pressionar a tecla Escape (ESC)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isModalOpen) {
        handleSafeCloseModal();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isFormDirty, saving]);

  const getTeamTotalPeople = (team: Team): number => {
    const ids = new Set<string>();
    if (team.leader_id) ids.add(team.leader_id);
    (team.member_ids || []).forEach((id) => {
      if (id) ids.add(id);
    });
    if (ids.size > 0) return ids.size;
    return (team.leader_name ? 1 : 0) + (team.member_names?.length || 0);
  };

  const openCreateModal = () => {
    const activeEmployees = employees.filter((e) => e.is_active !== false);
    setEditingTeam(null);
    setName('');
    setLeaderId(activeEmployees[0]?.id || employees[0]?.id || '');
    setSelectedMembers([]);
    setSelectedSpecialties([]);
    setCustomSpecialtyInput('');
    setMemberSearchQuery('');
    setShowMemberSuggestions(false);
    setNotes('');
    setIsFormDirty(false);
    setIsModalOpen(true);
  };

  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setLeaderId(team.leader_id || '');
    setSelectedSpecialties(team.specialties || []);
    setCustomSpecialtyInput('');

    // Montar lista de membros atuais (garantindo que o líder não aparece duplicado nos membros)
    const currentMembers: { id: string; name: string }[] = [];
    if (team.member_ids && team.member_ids.length > 0) {
      team.member_ids.forEach((id, idx) => {
        if (id === team.leader_id) return;
        const emp = employees.find((e) => e.id === id);
        currentMembers.push({
          id,
          name: emp ? emp.full_name : team.member_names?.[idx] || 'Membro',
        });
      });
    } else if (team.member_names && team.member_names.length > 0) {
      team.member_names.forEach((mName) => {
        const emp = employees.find((e) => e.full_name.toLowerCase() === mName.toLowerCase());
        if (emp && emp.id === team.leader_id) return;
        currentMembers.push({
          id: emp ? emp.id : `legacy-${mName}`,
          name: mName,
        });
      });
    }
    setSelectedMembers(currentMembers);
    setMemberSearchQuery('');
    setShowMemberSuggestions(false);
    setNotes(team.notes || '');
    setIsFormDirty(false);
    setIsModalOpen(true);
  };

  const handleLeaderChange = (newLeaderId: string) => {
    setLeaderId(newLeaderId);
    // Se o novo líder estava na lista de integrantes comuns, remove para evitar duplicação (Secção 3.3)
    setSelectedMembers((prev) => prev.filter((m) => m.id !== newLeaderId));
    setIsFormDirty(true);
  };

  const handleAddMember = (emp: EmployeeProfile) => {
    if (emp.id === leaderId) {
      customAlert({
        title: 'Já é Líder da Equipa',
        message: `${emp.full_name} já está selecionado como líder desta equipa e não precisa de ser adicionado como membro comum.`,
        type: 'warning',
      });
      return;
    }
    if (selectedMembers.some((m) => m.id === emp.id)) return;
    setSelectedMembers([...selectedMembers, { id: emp.id, name: emp.full_name }]);
    setMemberSearchQuery('');
    setShowMemberSuggestions(false);
    setIsFormDirty(true);
    if (memberInputRef.current) memberInputRef.current.focus();
  };

  const handleRemoveMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== memberId));
    setIsFormDirty(true);
  };

  const toggleSpecialty = (spec: string) => {
    setIsFormDirty(true);
    setSelectedSpecialties((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const handleAddCustomSpecialty = () => {
    const trimmed = customSpecialtyInput.trim();
    if (!trimmed) return;
    if (!selectedSpecialties.includes(trimmed)) {
      setSelectedSpecialties((prev) => [...prev, trimmed]);
      setIsFormDirty(true);
    }
    setCustomSpecialtyInput('');
  };

  // Sugestões de colaboradores filtradas (excluindo o líder atual e já selecionados)
  const filteredEmployeeSuggestions = useMemo(() => {
    if (!memberSearchQuery.trim()) return [];
    const query = memberSearchQuery.toLowerCase().trim();
    return employees.filter(
      (emp) =>
        emp.id !== leaderId &&
        emp.full_name.toLowerCase().includes(query) &&
        !selectedMembers.some((m) => m.id === emp.id)
    );
  }, [employees, memberSearchQuery, selectedMembers, leaderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      customAlert({
        title: 'Campo Obrigatório',
        message: 'Por favor introduza o nome da equipa.',
        type: 'warning',
      });
      return;
    }

    const cleanMembers = selectedMembers.filter((m) => m.id !== leaderId);
    const leaderEmp = employees.find((e) => e.id === leaderId);

    const payload: Partial<Team> = {
      id: editingTeam ? editingTeam.id : undefined,
      company_id: companyId || null,
      name: name.trim(),
      leader_id: leaderId || null,
      leader_name: leaderEmp ? leaderEmp.full_name : editingTeam?.leader_name || 'Sem Líder',
      leader_phone: leaderEmp ? leaderEmp.phone || null : null,
      member_ids: cleanMembers.map((m) => m.id),
      member_names: cleanMembers.map((m) => m.name),
      specialties: selectedSpecialties,
      notes: notes.trim() || null,
      current_site_id: editingTeam?.current_site_id || null,
      current_site_name: editingTeam?.current_site_name || null,
      allocated_at: editingTeam?.allocated_at || null,
      allocation_end_date: editingTeam?.allocation_end_date || null,
      allocation_start_time: editingTeam?.allocation_start_time || null,
      allocation_end_time: editingTeam?.allocation_end_time || null,
      is_archived: editingTeam?.is_archived || false,
      archived_at: editingTeam?.archived_at || null,
      member_joined_at: editingTeam?.member_joined_at || {},
      member_specialties: editingTeam?.member_specialties || {},
      allocation_history: editingTeam?.allocation_history || [],
      activity_log: editingTeam?.activity_log || [],
    };

    // Validação completa de colaboradores e conflitos (Secção 3.3)
    const validation = validateTeamPayload({
      team: payload,
      employees,
      allTeams: teams,
    });

    if (!validation.valid) {
      await customAlert({
        title: 'Validação da Equipa',
        message: validation.errors.join('\n'),
        type: 'error',
      });
      return;
    }

    if (validation.warnings.length > 0) {
      const proceed = await customConfirm({
        title: 'Atenção: Conflitos Detetados',
        message: `${validation.warnings.join('\n\n')}\n\nDeseja guardar a equipa mesmo assim?`,
        type: 'warning',
        confirmText: 'Guardar Mesmo Assim',
        cancelText: 'Rever Integrantes',
      });
      if (!proceed) return;
    }

    setSaving(true);
    try {
      await saveTeam(payload, companyId, { employees });
      await loadTeamsData();
      setIsFormDirty(false);
      setIsModalOpen(false);
      if (showNotice) {
        showNotice(editingTeam ? 'Equipa atualizada com sucesso!' : 'Nova equipa criada com sucesso!');
      }
    } catch (err: any) {
      customAlert({
        title: 'Erro ao Gravar',
        message: 'Erro ao guardar equipa: ' + (err.message || 'Tente novamente.'),
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Arquivar / Restaurar equipa (Secção 3.6)
  const handleToggleArchive = async (team: Team) => {
    const targetArchive = !team.is_archived;
    const confirmed = await customConfirm({
      title: targetArchive ? 'Arquivar Equipa' : 'Restaurar Equipa',
      message: targetArchive
        ? `Deseja arquivar a equipa "${team.name}"?\n\nO histórico de obras, sessões, tarefas e horas será totalmente preservado, mas a equipa ficará inativa para novas alocações.`
        : `Deseja restaurar a equipa "${team.name}" para que volte a ficar ativa e disponível para alocações?`,
      type: targetArchive ? 'warning' : 'info',
      confirmText: targetArchive ? 'Arquivar Equipa' : 'Restaurar Equipa',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;

    try {
      const updated = await toggleArchiveTeamWeb(team, targetArchive, companyId);
      setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (showNotice) {
        showNotice(
          targetArchive
            ? `Equipa "${team.name}" arquivada com sucesso.`
            : `Equipa "${team.name}" restaurada com sucesso.`
        );
      }
    } catch (err: any) {
      customAlert({
        title: 'Erro na Operação',
        message: err.message || 'Não foi possível alterar o estado de arquivo da equipa.',
        type: 'error',
      });
    }
  };

  // Eliminação definitiva (apenas quando arquivada e solicitada explicitamente)
  const handlePermanentDelete = async (team: Team) => {
    const confirmed = await customConfirm({
      title: 'Eliminar Definitivamente',
      message: `Tem a certeza que deseja eliminar permanentemente o registo da equipa "${team.name}"? Recomendamos manter a equipa arquivada para preservar o histórico.`,
      type: 'danger',
      confirmText: 'Eliminar Definitivamente',
      cancelText: 'Manter Arquivada',
    });
    if (!confirmed) return;
    try {
      await deleteTeam(team.id, companyId);
      await loadTeamsData();
      if (showNotice) showNotice('Equipa eliminada permanentemente.');
    } catch (err: any) {
      customAlert({
        title: 'Erro ao Eliminar',
        message: 'Erro ao eliminar equipa: ' + (err.message || 'Tente novamente.'),
        type: 'error',
      });
    }
  };

  const openQuickAllocationModal = (
    team: Team,
    mode: AllocationModalMode,
    defaultDate?: string
  ) => {
    if (team.is_archived) {
      customAlert({
        title: 'Equipa Arquivada',
        message: 'Restaure a equipa antes de efetuar uma nova alocação.',
        type: 'warning',
      });
      return;
    }
    setAllocModalTeam(team);
    setAllocModalMode(mode);
    setAllocModalDefaultDate(defaultDate);
    setAllocModalOpen(true);
  };

  // Opções dinâmicas de especialidades existentes + catálogo
  const allAvailableSpecialties = useMemo(() => {
    const set = new Set<string>(TEAM_SPECIALTIES_CATALOG);
    teams.forEach((t) => (t.specialties || []).forEach((s) => set.add(s)));
    return Array.from(set);
  }, [teams]);

  // Tarefas agrupadas por equipa para contadores rápidos nos cartões (Secção 1.4)
  const teamTasksSummaryMap = useMemo(() => {
    const map = new Map<
      string,
      { pendingCount: number; inExecutionCount: number; completedCount: number; totalCount: number }
    >();
    teams.forEach((team) => {
      const tTasks = filterTasksForTeam(team, companyTasks);
      let pendingCount = 0;
      let inExecutionCount = 0;
      let completedCount = 0;
      tTasks.forEach((task) => {
        if (
          task.status === 'concluida_funcionario' ||
          task.status === 'confirmada_chefe' ||
          task.execution_status === 'concluida'
        ) {
          completedCount++;
        } else if (task.execution_status === 'em_execucao') {
          inExecutionCount++;
        } else {
          pendingCount++;
        }
      });
      map.set(team.id, {
        pendingCount,
        inExecutionCount,
        completedCount,
        totalCount: tTasks.length,
      });
    });
    return map;
  }, [teams, companyTasks]);

  // Alertas operacionais reais (Secção 1.6)
  const operationalAlerts = useMemo(
    () =>
      computeOperationalAlerts({
        teams,
        employees,
        sites,
        tasks: companyTasks,
      }),
    [teams, employees, sites, companyTasks]
  );

  // Filtragem e Ordenação completas (Secção 1.2)
  const filteredAndSortedTeams = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const result = teams.filter((t) => {
      // Por defeito, oculta arquivadas exceto quando o filtro 'arquivadas' está selecionado
      if (statusFilter === 'arquivadas') {
        if (!t.is_archived) return false;
      } else {
        if (t.is_archived) return false;
      }

      const opStatus = getTeamOperationalStatus({
        team: t,
        entries,
      });

      if (statusFilter === 'em_obra') {
        if (opStatus !== 'alocada' && opStatus !== 'em_atividade') return false;
      } else if (statusFilter === 'disponiveis') {
        if (opStatus !== 'disponivel') return false;
      } else if (statusFilter === 'em_atividade') {
        if (opStatus !== 'em_atividade') return false;
      }

      // Filtro por Obra associada
      if (siteFilter !== 'todas') {
        const selectedSiteObj = sites.find((s) => s.id === siteFilter);
        const matchesId = t.current_site_id === siteFilter;
        const matchesName =
          selectedSiteObj &&
          t.current_site_name?.trim().toLowerCase() === selectedSiteObj.name.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // Filtro por Especialidade
      if (specialtyFilter !== 'todas') {
        const specs = t.specialties || [];
        if (!specs.some((s) => s.toLowerCase() === specialtyFilter.toLowerCase())) {
          return false;
        }
      }

      // Filtro por Disponibilidade numa data
      if (availabilityDateFilter) {
        if (!isTeamAvailableOnDate(t, availabilityDateFilter)) {
          return false;
        }
      }

      // Filtro por Quantidade de membros
      if (memberCountFilter !== 'todos') {
        const count = getTeamTotalPeople(t);
        if (memberCountFilter === '1_3' && (count < 1 || count > 3)) return false;
        if (memberCountFilter === '4_6' && (count < 4 || count > 6)) return false;
        if (memberCountFilter === '7_mais' && count < 7) return false;
      }

      // Pesquisa textual
      if (q) {
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesLeader = (t.leader_name || '').toLowerCase().includes(q);
        const matchesMembers = (t.member_names || []).some((m) => m.toLowerCase().includes(q));
        const matchesSite = (t.current_site_name || '').toLowerCase().includes(q);
        const matchesSpec = (t.specialties || []).some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesLeader && !matchesMembers && !matchesSite && !matchesSpec) {
          return false;
        }
      }

      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'nome_desc') {
        return b.name.localeCompare(a.name, 'pt-PT');
      }
      if (sortBy === 'membros_desc') {
        return getTeamTotalPeople(b) - getTeamTotalPeople(a);
      }
      if (sortBy === 'membros_asc') {
        return getTeamTotalPeople(a) - getTeamTotalPeople(b);
      }
      if (sortBy === 'recente_criada') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortBy === 'recente_alocada') {
        const tA = a.allocated_at ? new Date(a.allocated_at).getTime() : 0;
        const tB = b.allocated_at ? new Date(b.allocated_at).getTime() : 0;
        return tB - tA;
      }
      return a.name.localeCompare(b.name, 'pt-PT');
    });

    return result;
  }, [
    teams,
    entries,
    sites,
    searchTerm,
    statusFilter,
    siteFilter,
    specialtyFilter,
    availabilityDateFilter,
    memberCountFilter,
    sortBy,
  ]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    statusFilter !== 'todas' ||
    siteFilter !== 'todas' ||
    specialtyFilter !== 'todas' ||
    Boolean(availabilityDateFilter) ||
    memberCountFilter !== 'todos' ||
    sortBy !== 'nome_asc';

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('todas');
    setSiteFilter('todas');
    setSpecialtyFilter('todas');
    setAvailabilityDateFilter('');
    setMemberCountFilter('todos');
    setSortBy('nome_asc');
  };

  // KPIs Gerais (Secção 1.1) — calculados sobre as equipas ativas
  const activeNonArchivedTeams = useMemo(() => teams.filter((t) => !t.is_archived), [teams]);
  const archivedTeamsCount = useMemo(() => teams.filter((t) => t.is_archived).length, [teams]);

  const totalTeamsKpi = activeNonArchivedTeams.length;
  const allocatedTeamsKpi = useMemo(
    () =>
      activeNonArchivedTeams.filter((t) => Boolean(t.current_site_id || t.current_site_name))
        .length,
    [activeNonArchivedTeams]
  );
  const inActivityTeamsKpi = useMemo(
    () =>
      activeNonArchivedTeams.filter(
        (t) => getTeamOperationalStatus({ team: t, entries }) === 'em_atividade'
      ).length,
    [activeNonArchivedTeams, entries]
  );
  const availableTeamsKpi = useMemo(
    () =>
      activeNonArchivedTeams.filter((t) => !t.current_site_id && !t.current_site_name).length,
    [activeNonArchivedTeams]
  );
  const uniqueCollaboratorsKpi = useMemo(() => {
    const uniqueEmpIds = new Set<string>();
    activeNonArchivedTeams.forEach((t) => {
      if (t.leader_id) uniqueEmpIds.add(t.leader_id);
      t.member_ids?.forEach((id) => {
        if (id) uniqueEmpIds.add(id);
      });
    });
    return uniqueEmpIds.size;
  }, [activeNonArchivedTeams]);

  // Se uma equipa foi selecionada para ver detalhes, renderiza TeamDetailPage
  if (selectedTeamForDetail) {
    return (
      <>
        <TeamDetailPage
          team={selectedTeamForDetail}
          allTeams={teams}
          employees={employees}
          sites={sites}
          entries={entries}
          companyId={companyId}
          initialTab={detailInitialTab}
          onBack={() => {
            setSelectedTeamForDetail(null);
            setDetailInitialTab('visao_geral');
            loadTeamsData();
          }}
          onTeamUpdated={(updated) => {
            setSelectedTeamForDetail(updated);
            setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          }}
          onEditTeamRequest={(teamToEdit) => {
            openEditModal(teamToEdit);
          }}
          onOpenEmployee={onOpenEmployee}
          onOpenSite={onOpenSite}
          showNotice={showNotice}
        />

        {/* Permite editar a equipa a partir da página de detalhes sem sair dela */}
        {isModalOpen && renderTeamFormModal()}
      </>
    );
  }

  function renderTeamFormModal() {
    return (
      <div
        className="flat-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-dialog-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleSafeCloseModal();
        }}
      >
        <div
          className="flat-modal-box"
          style={{ maxWidth: 600, width: '100%', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flat-modal-header">
            <h3
              id="team-dialog-title"
              className="flat-modal-title"
              style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}
            >
              <Users size={18} color="var(--primary)" />
              {editingTeam ? 'Editar Equipa' : 'Criar Nova Equipa'}
            </h3>
            <button
              type="button"
              onClick={handleSafeCloseModal}
              className="btn-icon"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              aria-label="Fechar diálogo"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Nome da Equipa */}
            <div className="flat-form-group">
              <label style={{ fontSize: 12, fontWeight: 700 }}>Nome da Equipa *</label>
              <input
                type="text"
                required
                placeholder="Ex: Equipa 1, Equipa de Alvenaria, Equipa Elétrica..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setIsFormDirty(true);
                }}
                style={{ padding: '9px 12px' }}
              />
            </div>

            {/* Líder da Equipa */}
            <div className="flat-form-group">
              <label style={{ fontSize: 12, fontWeight: 700 }}>Líder da Equipa *</label>
              <select
                value={leaderId}
                onChange={(e) => handleLeaderChange(e.target.value)}
                style={{ padding: '9px 12px' }}
                required
              >
                <option value="">Selecione o líder responsável...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id} disabled={emp.is_active === false}>
                    {emp.full_name} ({emp.job_title || 'Colaborador'}){' '}
                    {emp.phone ? `• ${emp.phone}` : ''}
                    {emp.is_active === false ? ' [INATIVO]' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                O líder coordena a equipa e regista turnos e alocações em obra. O líder é contabilizado automaticamente e não é duplicado nos membros comuns.
              </span>
            </div>

            {/* Especialidades da Equipa (Secção 1.3) */}
            <div className="flat-form-group">
              <label style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={13} color="var(--primary)" />
                Especialidades da Equipa ({selectedSpecialties.length})
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {allAvailableSpecialties.map((spec) => {
                  const active = selectedSpecialties.includes(spec);
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => toggleSpecialty(spec)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: active
                          ? '1px solid var(--primary)'
                          : '1px solid var(--border-color)',
                        backgroundColor: active
                          ? 'var(--primary-subtle)'
                          : 'var(--bg-card-subtle)',
                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {active ? `✓ ${spec}` : spec}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  placeholder="Outra especialidade personalizada..."
                  value={customSpecialtyInput}
                  onChange={(e) => setCustomSpecialtyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSpecialty();
                    }
                  }}
                  style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomSpecialty}
                  className="btn-flat-secondary"
                  style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700 }}
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {/* Integrantes com Autocomplete Dinâmico */}
            <div className="flat-form-group" style={{ position: 'relative' }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Integrantes Adicionais ({selectedMembers.length})
              </label>

              {/* Pills dos membros já adicionados */}
              {selectedMembers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {selectedMembers.map((member) => {
                    const empObj = employees.find((e) => e.id === member.id);
                    const isInactive = empObj && empObj.is_active === false;
                    return (
                      <span
                        key={member.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: 6,
                          backgroundColor: isInactive
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'var(--primary-subtle)',
                          border: `1px solid ${
                            isInactive ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'
                          }`,
                          color: isInactive ? 'var(--danger)' : 'var(--text-main)',
                        }}
                      >
                        {member.name}
                        {isInactive && <span style={{ fontSize: 9 }}>(Inativo)</span>}
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--danger)',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Remover da equipa"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Caixa de Digitação com Auto-completar dinâmico */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  ref={memberInputRef}
                  type="text"
                  placeholder="Digite o nome do colaborador para adicionar..."
                  value={memberSearchQuery}
                  onChange={(e) => {
                    setMemberSearchQuery(e.target.value);
                    setShowMemberSuggestions(true);
                  }}
                  onFocus={() => {
                    if (memberSearchQuery.trim()) setShowMemberSuggestions(true);
                  }}
                  style={{ padding: '9px 12px 9px 32px', width: '100%' }}
                />
              </div>

              {/* Caixa de Sugestões */}
              {showMemberSuggestions && filteredEmployeeSuggestions.length > 0 && (
                <div
                  ref={suggestionsBoxRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    maxHeight: 190,
                    overflowY: 'auto',
                    zIndex: 100,
                  }}
                >
                  {filteredEmployeeSuggestions.map((emp) => {
                    const otherActiveTeam = teams.find(
                      (t) =>
                        !t.is_archived &&
                        t.id !== editingTeam?.id &&
                        Boolean(t.current_site_id || t.current_site_name) &&
                        (t.leader_id === emp.id || (t.member_ids || []).includes(emp.id))
                    );

                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          if (emp.is_active === false) {
                            customAlert({
                              title: 'Colaborador Inativo',
                              message: `${emp.full_name} está com o perfil inativo e não pode ser adicionado.`,
                              type: 'warning',
                            });
                            return;
                          }
                          handleAddMember(emp);
                        }}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: emp.is_active === false ? 'not-allowed' : 'pointer',
                          opacity: emp.is_active === false ? 0.55 : 1,
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background-color 0.1s',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = 'var(--primary-subtle)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = 'transparent')
                        }
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {emp.avatar_url ? (
                            <img
                              src={emp.avatar_url}
                              alt={emp.full_name}
                              style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              {emp.full_name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                              {emp.full_name}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {emp.job_title || 'Colaborador'}
                              {otherActiveTeam
                                ? ` • Em obra (${otherActiveTeam.name})`
                                : ''}
                            </div>
                          </div>
                        </div>

                        <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>
                          {emp.is_active === false ? 'Inativo' : '+ Adicionar'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Comece a digitar e clique no colaborador ativo para incluí-lo na equipa.
              </span>
            </div>

            {/* Observações */}
            <div className="flat-form-group">
              <label style={{ fontSize: 12, fontWeight: 700 }}>Notas / Observações</label>
              <textarea
                rows={2}
                placeholder="Informações operacionais, viatura atribuída ou observações..."
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setIsFormDirty(true);
                }}
                style={{ padding: '8px 12px', resize: 'none' }}
              />
            </div>

            {/* Ações do Dialog */}
            <div className="flat-modal-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={handleSafeCloseModal}
                className="btn-flat-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-flat-primary"
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {saving ? (
                  'A guardar...'
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    {editingTeam ? 'Guardar Alterações' : 'Criar Equipa'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ================================================================== */}
      {/* CABEÇALHO & BOTÕES DE AÇÃO                                         */}
      {/* ================================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--text-main)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Users size={26} color="var(--primary)" />
            Gestão de Equipas
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Centro operacional de equipas: especialidades, planeamento semanal, alocações em obra, tarefas e desempenho
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() =>
              setViewMode((prev) => (prev === 'planner' ? 'cards' : 'planner'))
            }
            className={viewMode === 'planner' ? 'btn-flat-primary' : 'btn-flat-secondary'}
            style={{
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <Calendar size={15} />
            {viewMode === 'planner' ? 'Voltar às Equipas' : 'Planeamento Semanal'}
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="btn-flat-primary"
            style={{
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={16} />
            Criar Nova Equipa
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 1.1 INDICADORES GERAIS (4 CARTÕES KPI)                             */}
      {/* ================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
        }}
      >
        {/* 1. Total de Equipas */}
        <div
          className="content-panel"
          style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'var(--primary-subtle)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Total de Equipas
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>
                {totalTeamsKpi}
              </span>
              {archivedTeamsCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  (+{archivedTeamsCount} arquiv.)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Equipas em Obra */}
        <div
          className="content-panel"
          style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'var(--success-subtle)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Equipas em Obra
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>
                {allocatedTeamsKpi}
              </span>
              {inActivityTeamsKpi > 0 && (
                <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                  • {inActivityTeamsKpi} em atividade
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Equipas Disponíveis */}
        <div
          className="content-panel"
          style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'rgba(245, 158, 11, 0.14)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Equipas Disponíveis
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B', marginTop: 2 }}>
              {availableTeamsKpi}
            </div>
          </div>
        </div>

        {/* 4. Colaboradores Integrados */}
        <div
          className="content-panel"
          style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          >
            <UserCheck size={22} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Colaboradores Integrados
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {uniqueCollaboratorsKpi}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 1.6 ALERTAS OPERACIONAIS EM TEMPO REAL                             */}
      {/* ================================================================== */}
      <TeamOperationalAlerts
        alerts={operationalAlerts}
        onNavigateToTeam={(teamId, targetTab) => {
          const found = teams.find((t) => t.id === teamId);
          if (found) {
            setDetailInitialTab(targetTab || 'visao_geral');
            setSelectedTeamForDetail(found);
          }
        }}
      />

      {/* ================================================================== */}
      {/* 1.2 BARRA DE PESQUISA, FILTROS COMBINADOS E ORDENAÇÃO              */}
      {/* ================================================================== */}
      <div
        className="content-panel"
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {/* Caixa de Pesquisa */}
          <div style={{ position: 'relative', minWidth: 0, flex: '1 1 240px', maxWidth: 420 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Pesquisar por equipa, líder, membro, obra ou especialidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="btn-flat-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <RotateCw size={12} />
                Limpar Filtros
              </button>
            )}

            {/* Toggle Cards / Lista / Planeamento */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                borderLeft: '1px solid var(--border-color)',
                paddingLeft: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`btn-icon ${viewMode === 'cards' ? 'active' : ''}`}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  backgroundColor: viewMode === 'cards' ? 'var(--primary-subtle)' : 'transparent',
                  color: viewMode === 'cards' ? 'var(--primary)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                title="Visualização em Cartões"
              >
                <LayoutGrid size={15} />
                Cards
              </button>

              {!isMobile && (
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    backgroundColor: viewMode === 'list' ? 'var(--primary-subtle)' : 'transparent',
                    color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  title="Visualização em Lista"
                >
                  <List size={15} />
                  Lista
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewMode('planner')}
                className={`btn-icon ${viewMode === 'planner' ? 'active' : ''}`}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  backgroundColor:
                    viewMode === 'planner' ? 'var(--primary-subtle)' : 'transparent',
                  color: viewMode === 'planner' ? 'var(--primary)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                }}
                title="Planeamento Semanal"
              >
                <Calendar size={15} />
                Semana
              </button>
            </div>
          </div>
        </div>

        {/* Linha de Filtros Avançados e Ordenação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Filtro Estado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Filter size={13} color="var(--text-muted)" />
            <select
              aria-label="Filtrar por estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
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
              <option value="todas">Estado: Todas Ativas</option>
              <option value="em_obra">Em Obra (Alocadas)</option>
              <option value="em_atividade">Em Atividade Hoje</option>
              <option value="disponiveis">Disponíveis</option>
              <option value="arquivadas">Arquivadas ({archivedTeamsCount})</option>
            </select>
          </div>

          {/* Filtro Obra Associada */}
          <select
            aria-label="Filtrar por obra associada"
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              fontSize: 12,
              fontWeight: 600,
              maxWidth: 200,
            }}
          >
            <option value="todas">Obra: Todas</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Filtro Especialidade */}
          <select
            aria-label="Filtrar por especialidade"
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
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
            <option value="todas">Especialidade: Todas</option>
            {allAvailableSpecialties.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>

          {/* Filtro Quantidade de Membros */}
          <select
            aria-label="Filtrar por quantidade de membros"
            value={memberCountFilter}
            onChange={(e) => setMemberCountFilter(e.target.value as MemberCountFilterOption)}
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
            <option value="todos">Integrantes: Todos</option>
            <option value="1_3">1 a 3 integrantes</option>
            <option value="4_6">4 a 6 integrantes</option>
            <option value="7_mais">7 ou mais integrantes</option>
          </select>

          {/* Filtro Disponibilidade numa data */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              Livre em:
            </span>
            <input
              type="date"
              aria-label="Disponibilidade na data"
              value={availabilityDateFilter}
              onChange={(e) => setAvailabilityDateFilter(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-main)',
                fontSize: 12,
                outline: 'none',
              }}
            />
            {availabilityDateFilter && (
              <button
                type="button"
                onClick={() => setAvailabilityDateFilter('')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 11,
                }}
                title="Limpar data"
              >
                ✕
              </button>
            )}
          </div>

          {/* Ordenação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
            <ArrowUpDown size={13} color="var(--text-muted)" />
            <select
              aria-label="Ordenar equipas"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortByOption)}
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
              <option value="nome_asc">Ordenar: Nome (A–Z)</option>
              <option value="nome_desc">Ordenar: Nome (Z–A)</option>
              <option value="membros_desc">Maior Qtd. de Membros</option>
              <option value="membros_asc">Menor Qtd. de Membros</option>
              <option value="recente_criada">Mais Recentemente Criada</option>
              <option value="recente_alocada">Mais Recentemente Alocada</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 1.5 PLANEAMENTO SEMANAL                                            */}
      {/* ================================================================== */}
      {viewMode === 'planner' && (
        <TeamWeeklyPlanner
          teams={teams}
          sites={sites}
          employees={employees}
          selectedDateFilter={availabilityDateFilter}
          onSelectDateFilter={(d) => setAvailabilityDateFilter(d)}
          onSelectTeam={(team) => {
            setDetailInitialTab('visao_geral');
            setSelectedTeamForDetail(team);
          }}
          onOpenAllocateModal={(team, defaultDate) =>
            openQuickAllocationModal(team, 'allocate', defaultDate)
          }
        />
      )}

      {/* ================================================================== */}
      {/* CONTEÚDO PRINCIPAL: CARDS OU TABELA                                */}
      {/* ================================================================== */}
      {viewMode !== 'planner' &&
        (loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            A carregar equipas...
          </div>
        ) : filteredAndSortedTeams.length === 0 ? (
          <div
            className="content-panel"
            style={{
              padding: '50px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                backgroundColor: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={26} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Nenhuma equipa encontrada
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 440 }}>
              {hasActiveFilters
                ? 'Não foram encontradas equipas correspondentes aos filtros aplicados.'
                : 'Ainda não cadastrou nenhuma equipa na sua empresa. Crie a primeira para organizar os seus colaboradores.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="btn-flat-secondary"
                  style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700 }}
                >
                  Limpar Filtros
                </button>
              )}
              <button
                type="button"
                onClick={openCreateModal}
                className="btn-flat-primary"
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                <Plus size={15} /> Criar Nova Equipa
              </button>
            </div>
          </div>
        ) : viewMode === 'cards' || isMobile ? (
          /* 1.4 VISUALIZAÇÃO EM GRELHA (CARTÕES MELHORADOS) */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))',
              gap: 16,
            }}
          >
            {filteredAndSortedTeams.map((team) => {
              const isAllocated = Boolean(team.current_site_id || team.current_site_name);
              const opStatus = getTeamOperationalStatus({ team, entries });
              const badgeMeta = getOperationalStatusBadgeMeta(opStatus);
              const leaderEmp = employees.find((e) => e.id === team.leader_id);
              const totalIntegrantes = getTeamTotalPeople(team);
              const taskSummary = teamTasksSummaryMap.get(team.id) || {
                pendingCount: 0,
                inExecutionCount: 0,
                completedCount: 0,
                totalCount: 0,
              };

              // Formatação real da data/hora de alocação (NUNCA inventar '08:00' se não registado)
              const allocDateFormatted = team.allocated_at
                ? new Date(team.allocated_at).toLocaleDateString('pt-PT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : null;
              const allocTimeFormatted =
                team.allocation_start_time ||
                (team.allocated_at && !team.allocated_at.endsWith('T00:00:00.000Z')
                  ? new Date(team.allocated_at).toLocaleTimeString('pt-PT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null);

              return (
                <div
                  key={team.id}
                  className="content-panel"
                  onClick={() => {
                    setDetailInitialTab('visao_geral');
                    setSelectedTeamForDetail(team);
                  }}
                  style={{
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
                    position: 'relative',
                    cursor: 'pointer',
                    opacity: team.is_archived ? 0.8 : 1,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Topo do Card: Nome, Estado Operacional e Ações de Edição/Arquivo */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 17,
                            fontWeight: 800,
                            color: 'var(--text-main)',
                            margin: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {team.name}
                        </h3>

                        {/* Badge de Estado Operacional (Secção 3.5) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              backgroundColor: badgeMeta.bg,
                              color: badgeMeta.color,
                              border: `1px solid ${badgeMeta.border}`,
                            }}
                          >
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                backgroundColor: badgeMeta.dotColor,
                              }}
                            />
                            {badgeMeta.label}
                          </span>

                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-muted)',
                              backgroundColor: 'var(--bg-card-subtle)',
                              padding: '2px 7px',
                              borderRadius: 6,
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            {totalIntegrantes}{' '}
                            {totalIntegrantes === 1 ? 'integrante' : 'integrantes'}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{ display: 'flex', gap: 6, flexShrink: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => openEditModal(team)}
                          className="btn-flat-secondary"
                          style={{ padding: '6px 8px' }}
                          title="Editar Equipa"
                          aria-label={`Editar ${team.name}`}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(team)}
                          className={team.is_archived ? 'btn-flat-primary' : 'btn-flat-secondary'}
                          style={{ padding: '6px 8px' }}
                          title={team.is_archived ? 'Restaurar Equipa' : 'Arquivar Equipa'}
                          aria-label={team.is_archived ? `Restaurar ${team.name}` : `Arquivar ${team.name}`}
                        >
                          {team.is_archived ? <RotateCcw size={13} /> : <Archive size={13} />}
                        </button>
                        {team.is_archived && (
                          <button
                            type="button"
                            onClick={() => handlePermanentDelete(team)}
                            className="btn-flat-danger"
                            style={{ padding: '6px 8px' }}
                            title="Eliminar Permanentemente"
                            aria-label={`Eliminar ${team.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Especialidades da Equipa (Secção 1.3) */}
                    {team.specialties && team.specialties.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {team.specialties.map((spec) => (
                          <span
                            key={spec}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 999,
                              backgroundColor: 'var(--primary-subtle)',
                              color: 'var(--primary)',
                            }}
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Informações do Líder */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        {leaderEmp?.avatar_url ? (
                          <img
                            src={leaderEmp.avatar_url}
                            alt={team.leader_name}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '1px solid var(--primary)',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              backgroundColor: 'var(--primary-subtle)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {(team.leader_name || 'L').charAt(0)}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>{team.leader_name || 'Sem líder'}</span>
                            <span
                              className="badge-flat primary"
                              style={{ fontSize: 9, padding: '1px 6px' }}
                            >
                              Líder
                            </span>
                          </div>
                          {team.leader_phone && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 1,
                              }}
                            >
                              <Phone size={11} /> {team.leader_phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Obra Atual e Data/Hora Real de Alocação */}
                    {isAllocated ? (
                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: 8,
                          backgroundColor: 'var(--success-subtle)',
                          border: '1px solid rgba(16, 185, 129, 0.28)',
                          fontSize: 12,
                          color: 'var(--success)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                          <Building2 size={14} />
                          <span style={{ color: 'var(--text-main)' }}>
                            {team.current_site_name || 'Obra Alocada'}
                          </span>
                        </div>
                        {(allocDateFormatted || allocTimeFormatted) && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 11,
                              color: 'var(--text-muted)',
                            }}
                          >
                            <Clock size={12} />
                            <span>
                              Início:{' '}
                              <strong>
                                {allocDateFormatted || 'Data registada'}
                                {allocTimeFormatted ? ` às ${allocTimeFormatted}` : ''}
                              </strong>
                              {team.allocation_end_date
                                ? ` • Até ${team.allocation_end_date
                                    .split('-')
                                    .reverse()
                                    .join('/')}`
                                : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px dashed var(--border-color)',
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Building2 size={14} />
                        <span>Sem alocação ativa em obra</span>
                      </div>
                    )}

                    {/* Indicadores de Tarefas Pendentes e em Execução */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '7px 10px',
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        fontSize: 11,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                        }}
                      >
                        <CheckSquare size={13} color="var(--primary)" />
                        Tarefas:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                          {taskSummary.pendingCount} pendente(s)
                        </span>
                        <span style={{ color: 'var(--border-color)' }}>•</span>
                        <span style={{ color: '#3B82F6', fontWeight: 700 }}>
                          {taskSummary.inExecutionCount} em execução
                        </span>
                      </div>
                    </div>

                    {/* Integrantes da Equipa */}
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          marginBottom: 5,
                        }}
                      >
                        Membros ({team.member_names?.length || 0})
                      </div>
                      {team.member_names && team.member_names.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {team.member_names.slice(0, 5).map((mName, mIdx) => (
                            <span
                              key={mIdx}
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 6,
                                backgroundColor: 'var(--bg-card-subtle)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-main)',
                              }}
                            >
                              {mName}
                            </span>
                          ))}
                          {team.member_names.length > 5 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 6,
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                              }}
                            >
                              +{team.member_names.length - 5}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Apenas o líder associado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações Rápidas no Rodapé do Cartão (Secção 1.4) */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: 12,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!team.is_archived && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {!isAllocated ? (
                          <button
                            type="button"
                            onClick={() => openQuickAllocationModal(team, 'allocate')}
                            className="btn-flat-primary"
                            style={{
                              flex: 1,
                              padding: '7px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                            }}
                          >
                            <Building2 size={13} />
                            Alocar a Obra
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openQuickAllocationModal(team, 'transfer')}
                              className="btn-flat-secondary"
                              style={{
                                flex: 1,
                                padding: '7px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                              }}
                              title="Transferir para outra obra"
                            >
                              <ArrowRightLeft size={12} />
                              Transferir
                            </button>
                            <button
                              type="button"
                              onClick={() => openQuickAllocationModal(team, 'finish')}
                              className="btn-flat-secondary"
                              style={{
                                flex: 1,
                                padding: '7px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                color: 'var(--danger)',
                              }}
                              title="Terminar alocação atual"
                            >
                              <Square size={12} />
                              Terminar
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDetailInitialTab('visao_geral');
                        setSelectedTeamForDetail(team);
                      }}
                      className="btn-flat-secondary"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderRadius: 8,
                      }}
                    >
                      <BarChart2 size={14} />
                      Ver Detalhes & Operação
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* VISUALIZAÇÃO EM LISTA / TABELA */
          <div className="content-panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table
              className="flat-table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    textAlign: 'left',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Equipa & Especialidades</th>
                  <th style={{ padding: '12px 16px' }}>Líder Responsável</th>
                  <th style={{ padding: '12px 16px' }}>Integrantes</th>
                  <th style={{ padding: '12px 16px' }}>Obra Atual</th>
                  <th style={{ padding: '12px 16px' }}>Tarefas</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTeams.map((team) => {
                  const isAllocated = Boolean(team.current_site_id || team.current_site_name);
                  const opStatus = getTeamOperationalStatus({ team, entries });
                  const badgeMeta = getOperationalStatusBadgeMeta(opStatus);
                  const leaderEmp = employees.find((e) => e.id === team.leader_id);
                  const totalIntegrantes = getTeamTotalPeople(team);
                  const taskSummary = teamTasksSummaryMap.get(team.id) || {
                    pendingCount: 0,
                    inExecutionCount: 0,
                    completedCount: 0,
                    totalCount: 0,
                  };

                  return (
                    <tr
                      key={team.id}
                      onClick={() => {
                        setDetailInitialTab('visao_geral');
                        setSelectedTeamForDetail(team);
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: 14 }}>
                          {team.name}
                        </strong>
                        {team.specialties && team.specialties.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {team.specialties.map((s) => (
                              <span
                                key={s}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 999,
                                  backgroundColor: 'var(--primary-subtle)',
                                  color: 'var(--primary)',
                                }}
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {leaderEmp?.avatar_url ? (
                            <img
                              src={leaderEmp.avatar_url}
                              alt={team.leader_name}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              {(team.leader_name || 'L').charAt(0)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              {team.leader_name}
                            </div>
                            {team.leader_phone && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {team.leader_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {totalIntegrantes}
                        </span>{' '}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          (1 líder + {team.member_names?.length || 0})
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {team.current_site_name ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Building2 size={14} color="var(--primary)" />
                              <strong style={{ color: 'var(--text-main)' }}>
                                {team.current_site_name}
                              </strong>
                            </div>
                            {team.allocated_at && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                Desde {new Date(team.allocated_at).toLocaleDateString('pt-PT')}
                                {team.allocation_start_time
                                  ? ` às ${team.allocation_start_time}`
                                  : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            Sem Obra Alocada
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', fontSize: 11 }}>
                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                          {taskSummary.pendingCount} pend.
                        </span>{' '}
                        •{' '}
                        <span style={{ color: '#3B82F6', fontWeight: 700 }}>
                          {taskSummary.inExecutionCount} exec.
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                            backgroundColor: badgeMeta.bg,
                            color: badgeMeta.color,
                            border: `1px solid ${badgeMeta.border}`,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: badgeMeta.dotColor,
                            }}
                          />
                          {badgeMeta.label}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!team.is_archived && !isAllocated && (
                            <button
                              type="button"
                              onClick={() => openQuickAllocationModal(team, 'allocate')}
                              className="btn-flat-primary"
                              style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700 }}
                              title="Alocar a uma Obra"
                            >
                              Alocar
                            </button>
                          )}
                          {!team.is_archived && isAllocated && (
                            <>
                              <button
                                type="button"
                                onClick={() => openQuickAllocationModal(team, 'transfer')}
                                className="btn-flat-secondary"
                                style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700 }}
                                title="Transferir de Obra"
                              >
                                Transferir
                              </button>
                              <button
                                type="button"
                                onClick={() => openQuickAllocationModal(team, 'finish')}
                                className="btn-flat-secondary"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: 'var(--danger)',
                                }}
                                title="Terminar Alocação"
                              >
                                Terminar
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDetailInitialTab('visao_geral');
                              setSelectedTeamForDetail(team);
                            }}
                            className="btn-flat-secondary"
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <BarChart2 size={13} />
                            Detalhes
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(team)}
                            className="btn-flat-secondary"
                            style={{ padding: '6px 8px' }}
                            title="Editar Equipa"
                            aria-label={`Editar ${team.name}`}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(team)}
                            className={team.is_archived ? 'btn-flat-primary' : 'btn-flat-secondary'}
                            style={{ padding: '6px 8px' }}
                            title={team.is_archived ? 'Restaurar Equipa' : 'Arquivar Equipa'}
                            aria-label={team.is_archived ? `Restaurar ${team.name}` : `Arquivar ${team.name}`}
                          >
                            {team.is_archived ? <RotateCcw size={13} /> : <Archive size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {/* ================================================================== */}
      {/* DIALOG DE CRIAÇÃO / EDIÇÃO DE EQUIPA                               */}
      {/* ================================================================== */}
      {isModalOpen && renderTeamFormModal()}

      {/* ================================================================== */}
      {/* DIALOG DE ALOCAÇÃO / TRANSFERÊNCIA / TÉRMINO RÁPIDO                */}
      {/* ================================================================== */}
      <TeamAllocationModal
        isOpen={allocModalOpen}
        mode={allocModalMode}
        team={allocModalTeam}
        sites={sites}
        employees={employees}
        companyId={companyId}
        defaultDate={allocModalDefaultDate}
        onClose={() => {
          setAllocModalOpen(false);
          setAllocModalTeam(null);
        }}
        onSuccess={(updatedTeam, msg) => {
          setTeams((prev) => prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t)));
          setAllocModalOpen(false);
          setAllocModalTeam(null);
          if (showNotice) showNotice(msg);
        }}
      />
    </div>
  );
}
