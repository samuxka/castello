import React, { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Users,
} from 'lucide-react';
import { Team, ConstructionSite, EmployeeProfile } from '../../types';
import { isTeamAvailableOnDate } from './teamOperations';

interface TeamWeeklyPlannerProps {
  teams: Team[];
  sites: ConstructionSite[];
  employees: EmployeeProfile[];
  selectedDateFilter: string;
  onSelectDateFilter: (date: string) => void;
  onSelectTeam: (team: Team) => void;
  onOpenAllocateModal: (team: Team, defaultDate?: string) => void;
}

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function getMondayOfWeek(refDateStr?: string): Date {
  const d = refDateStr ? new Date(refDateStr + 'T12:00:00') : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const TeamWeeklyPlanner: React.FC<TeamWeeklyPlannerProps> = ({
  teams,
  selectedDateFilter,
  onSelectDateFilter,
  onSelectTeam,
  onOpenAllocateModal,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getMondayOfWeek(selectedDateFilter || todayStr)
  );

  const activeTeams = useMemo(() => teams.filter((t) => !t.is_archived), [teams]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + idx);
      const iso = toIsoDate(d);
      return {
        iso,
        dayNum: d.getDate(),
        monthShort: d.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''),
        weekday: WEEKDAY_LABELS[idx],
        isToday: iso === todayStr,
      };
    });
  }, [weekStart, todayStr]);

  const navigateWeek = (offsetWeeks: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + offsetWeeks * 7);
    setWeekStart(next);
  };

  const goToCurrentWeek = () => {
    setWeekStart(getMondayOfWeek(todayStr));
    onSelectDateFilter('');
  };

  // Obtém informações de alocação e eventuais conflitos de uma equipa num dia específico
  const getDayAllocationsForTeam = (team: Team, dateIso: string) => {
    const matchingAllocs = (team.allocation_history || []).filter((a) => {
      if (a.status === 'cancelada' || a.status === 'concluida' || a.status === 'transferida') {
        return false;
      }
      const start = a.start_date;
      const end = a.end_date || a.start_date;
      return dateIso >= start && dateIso <= end;
    });

    // Se a equipa está alocada atualmente mas não tinha registo no allocation_history cobrindo hoje
    if (matchingAllocs.length === 0 && team.current_site_id) {
      const start = team.allocated_at ? team.allocated_at.slice(0, 10) : todayStr;
      const end = team.allocation_end_date || todayStr;
      if (dateIso >= start && dateIso <= end) {
        return [
          {
            id: `curr-${team.id}`,
            site_id: team.current_site_id,
            site_name: team.current_site_name || 'Obra Ativa',
            start_date: start,
            end_date: end,
            start_time: team.allocation_start_time || null,
            end_time: team.allocation_end_time || null,
            status: 'ativa' as const,
          },
        ];
      }
    }

    return matchingAllocs;
  };

  // Resumo da data consultada (ou hoje)
  const focusDate = selectedDateFilter || todayStr;
  const availableOnFocusDate = useMemo(
    () => activeTeams.filter((t) => isTeamAvailableOnDate(t, focusDate)),
    [activeTeams, focusDate]
  );
  const allocatedOnFocusDate = useMemo(
    () => activeTeams.filter((t) => !isTeamAvailableOnDate(t, focusDate)),
    [activeTeams, focusDate]
  );

  return (
    <div
      className="content-panel"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Cabeçalho do Planeamento Semanal */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--text-main)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Calendar size={18} color="var(--primary)" />
            Planeamento Semanal & Disponibilidade de Equipas
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Consulte alocações por período, identifique conflitos e programe equipas diretamente na grelha semanal
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label
              htmlFor="planner-date-picker"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}
            >
              Consultar Data:
            </label>
            <input
              id="planner-date-picker"
              type="date"
              value={selectedDateFilter}
              onChange={(e) => {
                const val = e.target.value;
                onSelectDateFilter(val);
                if (val) setWeekStart(getMondayOfWeek(val));
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: 12,
              }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => navigateWeek(-1)}
              className="btn-icon"
              style={{ padding: '6px 10px', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={goToCurrentWeek}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderLeft: '1px solid var(--border-color)',
                borderRight: '1px solid var(--border-color)',
                background: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Esta Semana
            </button>
            <button
              type="button"
              onClick={() => navigateWeek(1)}
              className="btn-icon"
              style={{ padding: '6px 10px', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
              aria-label="Próxima semana"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Resumo de Disponibilidade na Data Selecionada */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          padding: 12,
          borderRadius: 8,
          backgroundColor: 'var(--bg-card-subtle)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={18} color="#10B981" />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              Disponíveis em {focusDate.split('-').reverse().join('/')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
              {availableOnFocusDate.length} equipa(s){' '}
              {availableOnFocusDate.length > 0 && (
                <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
                  ({availableOnFocusDate.map((t) => t.name).join(', ')})
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Building2 size={18} color="var(--primary)" />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              Alocadas em {focusDate.split('-').reverse().join('/')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
              {allocatedOnFocusDate.length} equipa(s) em obra
            </div>
          </div>
        </div>
      </div>

      {/* Grelha Semanal de Equipas */}
      {activeTeams.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Nenhuma equipa operacional registada para apresentar no planeamento semanal.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              minWidth: 780,
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    width: 190,
                    color: 'var(--text-muted)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: 11,
                  }}
                >
                  Equipa / Líder
                </th>
                {weekDays.map((wd) => {
                  const isFocused = selectedDateFilter === wd.iso;
                  return (
                    <th
                      key={wd.iso}
                      onClick={() => onSelectDateFilter(isFocused ? '' : wd.iso)}
                      style={{
                        textAlign: 'center',
                        padding: '8px 6px',
                        cursor: 'pointer',
                        backgroundColor: isFocused
                          ? 'var(--primary-subtle)'
                          : wd.isToday
                          ? 'rgba(59, 130, 246, 0.06)'
                          : 'transparent',
                        borderBottom: wd.isToday ? '2px solid var(--primary)' : undefined,
                      }}
                      title="Clique para filtrar disponibilidade nesta data"
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>
                        {wd.weekday}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: wd.isToday || isFocused ? 'var(--primary)' : 'var(--text-main)',
                        }}
                      >
                        {wd.dayNum} {wd.monthShort}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeTeams.map((team) => (
                <tr key={team.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td
                    style={{ padding: '10px 12px', cursor: 'pointer' }}
                    onClick={() => onSelectTeam(team)}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13 }}>
                      {team.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <Users size={11} />
                      {team.leader_name} ({(team.member_ids?.length || 0) + (team.leader_id ? 1 : 0)})
                    </div>
                  </td>

                  {weekDays.map((wd) => {
                    const dayAllocs = getDayAllocationsForTeam(team, wd.iso);
                    const hasConflict = dayAllocs.length > 1;
                    return (
                      <td
                        key={wd.iso}
                        style={{
                          padding: 6,
                          verticalAlign: 'top',
                          backgroundColor:
                            selectedDateFilter === wd.iso ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                        }}
                      >
                        {dayAllocs.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => onOpenAllocateModal(team, wd.iso)}
                            style={{
                              width: '100%',
                              minHeight: 48,
                              borderRadius: 6,
                              border: '1px dashed var(--border-color)',
                              backgroundColor: 'transparent',
                              color: 'var(--text-muted)',
                              fontSize: 11,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 2,
                            }}
                            title={`Alocar ${team.name} em ${wd.iso.split('-').reverse().join('/')}`}
                          >
                            <span style={{ color: '#10B981', fontWeight: 700, fontSize: 10 }}>
                              Disponível
                            </span>
                            <Plus size={11} />
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {dayAllocs.map((alloc) => (
                              <div
                                key={alloc.id}
                                onClick={() => onSelectTeam(team)}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: 6,
                                  backgroundColor: hasConflict
                                    ? 'rgba(239, 68, 68, 0.14)'
                                    : 'var(--primary-subtle)',
                                  border: `1px solid ${
                                    hasConflict ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'
                                  }`,
                                  cursor: 'pointer',
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 11,
                                    color: hasConflict ? 'var(--danger)' : 'var(--primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: 115,
                                  }}
                                  title={alloc.site_name}
                                >
                                  {alloc.site_name}
                                </div>
                                {(alloc.start_time || alloc.end_time) && (
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: 'var(--text-muted)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      marginTop: 2,
                                    }}
                                  >
                                    <Clock size={9} />
                                    {alloc.start_time || ''}
                                    {alloc.end_time ? `–${alloc.end_time}` : ''}
                                  </div>
                                )}
                              </div>
                            ))}
                            {hasConflict && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: 'var(--danger)',
                                }}
                              >
                                <AlertTriangle size={10} /> Conflito
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
