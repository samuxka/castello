import {
  Team,
  EmployeeProfile,
  ConstructionSite,
  SiteTask,
  SiteWorkSession,
  TimeEntry,
  TeamOperationalStatus,
  TeamAllocationRecord,
} from '../../types';

export const TEAM_SPECIALTIES_CATALOG: string[] = [
  'Alvenaria',
  'Reboco',
  'Capoto',
  'Cofragem',
  'Pintura',
  'Eletricidade',
  'Canalização',
  'Carpintaria',
  'Pavimentação',
  'Acabamentos',
  'Outras',
];

export interface OperationalAlertItem {
  id: string;
  severity: 'danger' | 'warning' | 'info';
  category:
    | 'sem_lider'
    | 'alocacao_incompativel'
    | 'sem_tarefas'
    | 'conflito_horario'
    | 'colaborador_inativo'
    | 'prazo_ultrapassado';
  title: string;
  description: string;
  teamId: string;
  teamName: string;
  siteId?: string | null;
  employeeId?: string | null;
}

/**
 * Determina o estado operacional real da equipa (Secção 3.5):
 * - 'arquivada': equipa arquivada/inativa
 * - 'em_atividade': alocada a uma obra E com sessão de trabalho ativa hoje ou picagem de entrada em curso hoje
 * - 'alocada': associada a uma obra, mas sem sessão de trabalho confirmada em curso neste momento
 * - 'disponivel': sem alocação ativa
 */
export function getTeamOperationalStatus(params: {
  team: Team;
  sessions?: SiteWorkSession[];
  entries?: TimeEntry[];
  todayStr?: string;
}): TeamOperationalStatus {
  const { team, sessions = [], entries = [], todayStr = new Date().toISOString().slice(0, 10) } = params;

  if (team.is_archived) {
    return 'arquivada';
  }

  const isAllocated = Boolean(team.current_site_id || team.current_site_name);
  if (!isAllocated) {
    return 'disponivel';
  }

  // Verifica se há sessão de trabalho registada hoje para esta equipa na obra atual
  const hasTodaySession = sessions.some(
    (s) =>
      s.work_date === todayStr &&
      (s.team_id === team.id ||
        (s.site_id === team.current_site_id &&
          s.team_name?.trim().toLowerCase() === team.name?.trim().toLowerCase()))
  );

  // Verifica se membros/líder têm picagem de ponto aberta hoje na obra (ou no dia de hoje)
  const participantIds = new Set<string>([
    ...(team.leader_id ? [team.leader_id] : []),
    ...(team.member_ids || []),
  ]);
  const todayTeamEntries = entries.filter(
    (e) =>
      e.work_date === todayStr &&
      participantIds.has(e.employee_id) &&
      e.status !== 'rejeitado' &&
      (!team.current_site_id || !e.site_id || e.site_id === team.current_site_id)
  );
  const hasEntradaToday = todayTeamEntries.some((e) => e.entry_type === 'entrada');

  // Ou se a alocação foi iniciada hoje com hora de início registada dentro do horário atual
  const allocatedToday = Boolean(team.allocated_at && team.allocated_at.slice(0, 10) === todayStr);

  if (hasTodaySession || hasEntradaToday || (allocatedToday && Boolean(team.allocation_start_time))) {
    return 'em_atividade';
  }

  return 'alocada';
}

export function getOperationalStatusBadgeMeta(status: TeamOperationalStatus): {
  label: string;
  color: string;
  bg: string;
  border: string;
  dotColor: string;
} {
  switch (status) {
    case 'em_atividade':
      return {
        label: 'Em Atividade',
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.14)',
        border: 'rgba(16, 185, 129, 0.35)',
        dotColor: '#10B981',
      };
    case 'alocada':
      return {
        label: 'Alocada em Obra',
        color: '#3B82F6',
        bg: 'rgba(59, 130, 246, 0.14)',
        border: 'rgba(59, 130, 246, 0.35)',
        dotColor: '#3B82F6',
      };
    case 'arquivada':
      return {
        label: 'Inativa / Arquivada',
        color: '#94A3B8',
        bg: 'rgba(148, 163, 184, 0.14)',
        border: 'rgba(148, 163, 184, 0.3)',
        dotColor: '#94A3B8',
      };
    case 'disponivel':
    default:
      return {
        label: 'Disponível',
        color: '#F59E0B',
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.3)',
        dotColor: '#F59E0B',
      };
  }
}

/**
 * Calcula as horas reais trabalhadas por um colaborador a partir dos registos de ponto (TimeEntry),
 * descontando pausas de almoço (1h padrão quando há picagem de almoço ou jornada > 5h com almoço registado).
 */
export function calculateEmployeeHoursFromEntries(params: {
  entries: TimeEntry[];
  employeeId: string;
  startDate?: string;
  endDate?: string;
  siteId?: string;
}): number {
  const { entries, employeeId, startDate, endDate, siteId } = params;
  const filtered = entries.filter((e) => {
    if (e.employee_id !== employeeId) return false;
    if (e.status === 'rejeitado') return false;
    if (startDate && e.work_date < startDate) return false;
    if (endDate && e.work_date > endDate) return false;
    if (siteId && e.site_id && e.site_id !== siteId) return false;
    return true;
  });

  const byDate = new Map<string, TimeEntry[]>();
  for (const entry of filtered) {
    const list = byDate.get(entry.work_date) || [];
    list.push(entry);
    byDate.set(entry.work_date, list);
  }

  let totalHours = 0;
  for (const [, dayEntries] of byDate.entries()) {
    const sorted = [...dayEntries].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    const entrada = sorted.find((e) => e.entry_type === 'entrada');
    const saida = [...sorted].reverse().find((e) => e.entry_type === 'saida');
    const hasAlmoco = sorted.some((e) => e.entry_type === 'almoco');

    if (entrada && saida) {
      const diffMs = new Date(saida.recorded_at).getTime() - new Date(entrada.recorded_at).getTime();
      let hrs = Math.max(0, diffMs / (1000 * 60 * 60));
      if (hasAlmoco && hrs > 4) {
        hrs = Math.max(0.5, hrs - 1);
      }
      totalHours += Math.min(16, hrs);
    } else if (entrada) {
      // Se só tem entrada registada num dia anterior, contabiliza meio turno ou 0 se hoje ainda em curso
      const isToday = entrada.work_date === new Date().toISOString().slice(0, 10);
      if (isToday) {
        const diffMs = Date.now() - new Date(entrada.recorded_at).getTime();
        const hrs = Math.max(0, Math.min(10, diffMs / (1000 * 60 * 60)));
        totalHours += hrs;
      }
    }
  }

  return Math.round(totalHours * 10) / 10;
}

/**
 * Calcula Horas de Sessão vs Horas-Homem reais de uma equipa num período (Secção 3.4).
 * NUNCA multiplica automaticamente a duração pelo número atual de membros da equipa.
 */
export function calculateTeamHoursMetrics(params: {
  team: Team;
  sessions: SiteWorkSession[];
  entries: TimeEntry[];
  startDate?: string;
  endDate?: string;
}): {
  sessionHours: number;
  manHours: number;
  sessionCount: number;
  hoursBySite: Array<{
    siteId: string;
    hours: number;
    manHours: number;
    sessionCount: number;
  }>;
} {
  const { team, sessions, entries, startDate, endDate } = params;

  const filteredSessions = sessions.filter((s) => {
    if (startDate && s.work_date < startDate) return false;
    if (endDate && s.work_date > endDate) return false;
    return true;
  });

  const participantIds = new Set<string>([
    ...(team.leader_id ? [team.leader_id] : []),
    ...(team.member_ids || []),
  ]);

  let totalSessionHours = 0;
  let totalManHours = 0;
  const siteMap = new Map<
    string,
    { siteId: string; hours: number; manHours: number; sessionCount: number }
  >();

  for (const sess of filteredSessions) {
    const sHours = Number(sess.hours_worked || 0);
    totalSessionHours += sHours;

    // 1. Verifica se existem picagens individuais reais na data/obra para os participantes do turno
    const snapshotIds =
      sess.member_ids_snapshot && sess.member_ids_snapshot.length > 0
        ? sess.member_ids_snapshot
        : Array.from(participantIds);

    let individualDayManHours = 0;
    for (const empId of snapshotIds) {
      individualDayManHours += calculateEmployeeHoursFromEntries({
        entries,
        employeeId: empId,
        startDate: sess.work_date,
        endDate: sess.work_date,
        siteId: sess.site_id,
      });
    }

    // 2. Se houver picagens individuais no dia, usa o valor apurado; caso contrário usa o man_hours gravado na sessão ou (hours_worked * workers_count da sessão na época)
    const sessManHours =
      individualDayManHours > 0
        ? individualDayManHours
        : typeof sess.man_hours === 'number' && sess.man_hours > 0
        ? sess.man_hours
        : sHours * Math.max(1, Number(sess.workers_count || 1));

    totalManHours += sessManHours;

    const currentSiteEntry = siteMap.get(sess.site_id) || {
      siteId: sess.site_id,
      hours: 0,
      manHours: 0,
      sessionCount: 0,
    };
    currentSiteEntry.hours += sHours;
    currentSiteEntry.manHours += sessManHours;
    currentSiteEntry.sessionCount += 1;
    siteMap.set(sess.site_id, currentSiteEntry);
  }

  // Se houver picagens individuais de membros na obra atual em datas sem sessão formal fechada, soma nas horas-homem
  const sessionDates = new Set(filteredSessions.map((s) => s.work_date));
  for (const empId of participantIds) {
    const empEntries = entries.filter(
      (e) =>
        e.employee_id === empId &&
        e.status !== 'rejeitado' &&
        !sessionDates.has(e.work_date) &&
        (!startDate || e.work_date >= startDate) &&
        (!endDate || e.work_date <= endDate)
    );
    const extraDates = new Set(empEntries.map((e) => e.work_date));
    for (const d of extraDates) {
      const hrs = calculateEmployeeHoursFromEntries({
        entries,
        employeeId: empId,
        startDate: d,
        endDate: d,
      });
      totalManHours += hrs;
    }
  }

  return {
    sessionHours: Math.round(totalSessionHours * 10) / 10,
    manHours: Math.round(totalManHours * 10) / 10,
    sessionCount: filteredSessions.length,
    hoursBySite: Array.from(siteMap.values())
      .map((item) => ({
        ...item,
        hours: Math.round(item.hours * 10) / 10,
        manHours: Math.round(item.manHours * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours),
  };
}

/**
 * Filtra as tarefas associadas a uma equipa (por assigned_team_id, assigned_team_name ou membros na obra da equipa)
 */
export function filterTasksForTeam(team: Team, allTasks: SiteTask[]): SiteTask[] {
  const participantIds = new Set<string>([
    ...(team.leader_id ? [team.leader_id] : []),
    ...(team.member_ids || []),
  ]);
  const participantNames = new Set<string>(
    [team.leader_name, ...(team.member_names || [])]
      .filter(Boolean)
      .map((n) => n.trim().toLowerCase())
  );
  const normTeamName = (team.name || '').trim().toLowerCase();

  return allTasks.filter((t) => {
    if (t.assigned_team_id && t.assigned_team_id === team.id) return true;
    if (t.assigned_team_name && t.assigned_team_name.trim().toLowerCase() === normTeamName) return true;
    if (t.assigned_to_id && participantIds.has(t.assigned_to_id)) return true;
    if (t.assigned_to_name && participantNames.has(t.assigned_to_name.trim().toLowerCase())) return true;
    return false;
  });
}

/**
 * Verifica se uma equipa está disponível numa determinada data (YYYY-MM-DD)
 */
export function isTeamAvailableOnDate(team: Team, targetDate: string): boolean {
  if (team.is_archived) return false;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Verifica alocações registadas no histórico/planeamento
  for (const alloc of team.allocation_history || []) {
    if (alloc.status === 'cancelada' || alloc.status === 'concluida' || alloc.status === 'transferida') {
      continue;
    }
    const start = alloc.start_date;
    const end = alloc.end_date || alloc.start_date;
    if (targetDate >= start && targetDate <= end) {
      return false;
    }
  }

  // Se está alocada atualmente sem histórico estruturado
  if (team.current_site_id) {
    const start = team.allocated_at ? team.allocated_at.slice(0, 10) : todayStr;
    const end = team.allocation_end_date || todayStr;
    if (targetDate >= start && targetDate <= end) {
      return false;
    }
  }

  return true;
}

/**
 * Calcula todos os alertas operacionais reais das equipas (Secção 1.6)
 */
export function computeOperationalAlerts(params: {
  teams: Team[];
  employees: EmployeeProfile[];
  sites: ConstructionSite[];
  tasks: SiteTask[];
}): OperationalAlertItem[] {
  const { teams, employees, sites, tasks } = params;
  const alerts: OperationalAlertItem[] = [];
  const empMap = new Map(employees.map((e) => [e.id, e]));
  const siteMap = new Map(sites.map((s) => [s.id, s]));
  const todayStr = new Date().toISOString().slice(0, 10);

  const activeTeams = teams.filter((t) => !t.is_archived);

  // Mapa para detetar colaboradores em múltiplas equipas ativas em obra simultaneamente
  const employeeActiveTeamsMap = new Map<string, Team[]>();

  for (const team of activeTeams) {
    const isAllocated = Boolean(team.current_site_id || team.current_site_name);

    // 1. Equipa sem líder definido
    const leaderEmp = team.leader_id ? empMap.get(team.leader_id) : undefined;
    if (!team.leader_id || (!leaderEmp && employees.length > 0)) {
      alerts.push({
        id: `alert-no-leader-${team.id}`,
        severity: 'danger',
        category: 'sem_lider',
        title: `Equipa sem líder definido: ${team.name}`,
        description: 'Designe um líder responsável para coordenar as sessões e tarefas da equipa.',
        teamId: team.id,
        teamName: team.name,
      });
    }

    // 2. Colaboradores inativos na equipa
    const inactiveNames: string[] = [];
    if (leaderEmp && !leaderEmp.is_active) {
      inactiveNames.push(`${leaderEmp.full_name} (Líder)`);
    }
    for (const mId of team.member_ids || []) {
      const emp = empMap.get(mId);
      if (emp && !emp.is_active) {
        inactiveNames.push(emp.full_name);
      }
    }
    if (inactiveNames.length > 0) {
      alerts.push({
        id: `alert-inactive-emp-${team.id}`,
        severity: 'warning',
        category: 'colaborador_inativo',
        title: `Colaborador(es) inativo(s) em ${team.name}`,
        description: `Integrantes com perfil inativo: ${inactiveNames.join(', ')}. Atualize a composição da equipa.`,
        teamId: team.id,
        teamName: team.name,
      });
    }

    // 3. Equipa alocada sem tarefas programadas
    if (isAllocated) {
      const teamTasks = filterTasksForTeam(team, tasks);
      const activeTasks = teamTasks.filter(
        (t) => t.status === 'pendente' || t.execution_status === 'em_execucao'
      );
      if (activeTasks.length === 0) {
        alerts.push({
          id: `alert-no-tasks-${team.id}`,
          severity: 'info',
          category: 'sem_tarefas',
          title: `${team.name} alocada sem tarefas programadas`,
          description: `Alocada em "${team.current_site_name || 'Obra'}", mas sem tarefas pendentes ou em execução atribuídas.`,
          teamId: team.id,
          teamName: team.name,
          siteId: team.current_site_id,
        });
      }

      // 4. Alocação ultrapassou a data prevista de conclusão
      const site = team.current_site_id ? siteMap.get(team.current_site_id) : undefined;
      const expectedEnd = team.allocation_end_date || site?.expected_end_date || null;
      if (expectedEnd && expectedEnd < todayStr) {
        alerts.push({
          id: `alert-overdue-alloc-${team.id}`,
          severity: 'danger',
          category: 'prazo_ultrapassado',
          title: `Alocação fora do prazo previsto: ${team.name}`,
          description: `A conclusão prevista na obra "${team.current_site_name || site?.name || 'Obra'}" era ${expectedEnd.split('-').reverse().join('/')}.`,
          teamId: team.id,
          teamName: team.name,
          siteId: team.current_site_id,
        });
      }

      // Regista participantes para verificação de alocações incompatíveis
      const pIds = new Set([
        ...(team.leader_id ? [team.leader_id] : []),
        ...(team.member_ids || []),
      ]);
      for (const pId of pIds) {
        const list = employeeActiveTeamsMap.get(pId) || [];
        list.push(team);
        employeeActiveTeamsMap.set(pId, list);
      }
    }

    // 5. Conflito de horários em alocações planeadas da própria equipa
    const activeAllocs: TeamAllocationRecord[] = (team.allocation_history || []).filter(
      (a) => a.status === 'ativa' || a.status === 'planeada'
    );
    for (let i = 0; i < activeAllocs.length; i++) {
      for (let j = i + 1; j < activeAllocs.length; j++) {
        const a1 = activeAllocs[i];
        const a2 = activeAllocs[j];
        const s1 = a1.start_date;
        const e1 = a1.end_date || a1.start_date;
        const s2 = a2.start_date;
        const e2 = a2.end_date || a2.start_date;
        const datesOverlap = s1 <= e2 && s2 <= e1;
        if (datesOverlap && a1.site_id !== a2.site_id) {
          const t1Start = a1.start_time || '00:00';
          const t1End = a1.end_time || '23:59';
          const t2Start = a2.start_time || '00:00';
          const t2End = a2.end_time || '23:59';
          if (t1Start <= t2End && t2Start <= t1End) {
            alerts.push({
              id: `alert-schedule-conflict-${team.id}-${a1.id}-${a2.id}`,
              severity: 'danger',
              category: 'conflito_horario',
              title: `Conflito de horários na equipa ${team.name}`,
              description: `Sobreposição entre "${a1.site_name}" (${s1.split('-').reverse().join('/')}) e "${a2.site_name}" (${s2.split('-').reverse().join('/')}).`,
              teamId: team.id,
              teamName: team.name,
            });
          }
        }
      }
    }
  }

  // 6. Colaborador associado a alocações incompatíveis em equipas distintas
  for (const [empId, allocTeams] of employeeActiveTeamsMap.entries()) {
    if (allocTeams.length > 1) {
      const empName = empMap.get(empId)?.full_name || 'Colaborador';
      const primaryTeam = allocTeams[0];
      const teamListStr = allocTeams
        .map((t) => `${t.name} (${t.current_site_name || 'Obra'})`)
        .join(' e ');
      alerts.push({
        id: `alert-incomp-emp-${empId}`,
        severity: 'danger',
        category: 'alocacao_incompativel',
        title: `Alocação simultânea incompatível: ${empName}`,
        description: `${empName} está alocado simultaneamente em: ${teamListStr}.`,
        teamId: primaryTeam.id,
        teamName: primaryTeam.name,
        employeeId: empId,
      });
    }
  }

  return alerts;
}
