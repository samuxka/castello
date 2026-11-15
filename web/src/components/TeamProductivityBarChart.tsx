import React, { useState, useMemo } from 'react';
import { BarChart3, Filter, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { SiteTask, Team, ConstructionSite } from '../types';

interface TeamProductivityBarChartProps {
  tasks: SiteTask[];
  teams: Team[];
  sites: ConstructionSite[];
}

export function TeamProductivityBarChart({ tasks, teams, sites }: TeamProductivityBarChartProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<'semanal' | 'mensal'>('semanal');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filtra as tarefas pela equipa ou obra selecionada
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      let matchesSite = true;
      if (selectedSiteId !== 'all') {
        matchesSite = t.site_id === selectedSiteId;
      }

      let matchesTeam = true;
      if (selectedTeamId !== 'all') {
        const team = teams.find((tm) => tm.id === selectedTeamId);
        if (team) {
          const normLeader = (team.leader_name || '').trim().toLowerCase();
          const normMembers = (team.member_names || []).map((m) => (m || '').trim().toLowerCase());

          const assignedName = (t.assigned_to_name || '').trim().toLowerCase();
          const completedName = (t.completed_by_name || '').trim().toLowerCase();
          const confirmedName = (t.confirmed_by_name || '').trim().toLowerCase();

          const matchesLeader =
            (t.assigned_to_id && t.assigned_to_id === team.leader_id) ||
            (assignedName && (assignedName === normLeader || normLeader.includes(assignedName) || assignedName.includes(normLeader))) ||
            (completedName && (completedName === normLeader || normLeader.includes(completedName) || completedName.includes(normLeader))) ||
            (confirmedName && (confirmedName === normLeader || normLeader.includes(confirmedName) || confirmedName.includes(normLeader)));

          const matchesMember =
            (t.assigned_to_id && team.member_ids?.includes(t.assigned_to_id)) ||
            normMembers.some((m) => m && (m === assignedName || m === completedName || m === confirmedName));

          const matchesSiteAllocation = team.current_site_id && team.current_site_id === t.site_id;

          matchesTeam = Boolean(matchesLeader || matchesMember || matchesSiteAllocation);
        }
      }

      return matchesSite && matchesTeam;
    });
  }, [tasks, teams, selectedSiteId, selectedTeamId]);

  // Agrupa as tarefas nos períodos (últimas 6 semanas ou últimos 6 meses)
  const periodsData = useMemo(() => {
    const pointsCount = 6;
    const now = new Date();
    const result: {
      key: string;
      label: string;
      subLabel: string;
      previstas: number;
      concluidas: number;
      isBelow: boolean;
      startDate: Date;
      endDate: Date;
    }[] = [];

    for (let i = pointsCount - 1; i >= 0; i--) {
      let startDate: Date;
      let endDate: Date;
      let label: string;
      let subLabel = '';

      if (timeframe === 'semanal') {
        // Semanas de 7 dias terminando no período atual
        const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7, 23, 59, 59);
        const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i + 1) * 7 + 1, 0, 0, 0);
        startDate = startDay;
        endDate = endDay;

        const sDayNum = startDay.getDate();
        const eDayNum = endDay.getDate();
        const eMonthName = endDay.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');
        label = `Sem ${pointsCount - i}`;
        subLabel = `${sDayNum}-${eDayNum} ${eMonthName}`;
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const mName = startDate.toLocaleDateString('pt-PT', { month: 'short' });
        label = mName.charAt(0).toUpperCase() + mName.slice(1).replace('.', '');
        subLabel = `${startDate.getFullYear()}`;
      }

      const startIso = startDate.toISOString().slice(0, 10);
      const endIso = endDate.toISOString().slice(0, 10);

      // 1. Tarefas previstas: cuja data de entrega ou data de criação cai neste período
      const previstas = filteredTasks.filter((t) => {
        const targetDate = t.due_date || (t.created_at ? t.created_at.slice(0, 10) : '');
        if (!targetDate) return false;
        return targetDate >= startIso && targetDate <= endIso;
      }).length;

      // 2. Tarefas concluídas: tarefas com estado de conclusão no período
      const concluidas = filteredTasks.filter((t) => {
        const isDone = t.status === 'confirmada_chefe' || t.status === 'concluida_funcionario';
        if (!isDone) return false;
        const doneDate = (t.completed_at || t.confirmed_at || t.created_at || '').slice(0, 10);
        return doneDate >= startIso && doneDate <= endIso;
      }).length;

      result.push({
        key: `${i}-${label}`,
        label,
        subLabel,
        previstas,
        concluidas,
        isBelow: concluidas < previstas,
        startDate,
        endDate,
      });
    }

    return result;
  }, [filteredTasks, timeframe]);

  // Totais do período analisado
  const totalPrevistas = periodsData.reduce((acc, p) => acc + p.previstas, 0);
  const totalConcluidas = periodsData.reduce((acc, p) => acc + p.concluidas, 0);
  const completionRate = totalPrevistas > 0 ? Math.round((totalConcluidas / totalPrevistas) * 100) : 100;

  // Altura máxima para escala do gráfico de barras
  const maxVal = Math.max(4, ...periodsData.map((p) => Math.max(p.previstas, p.concluidas))) * 1.25;

  const width = 500;
  const height = 180;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 26;

  const chartInnerWidth = width - paddingLeft - paddingRight;
  const chartInnerHeight = height - paddingTop - paddingBottom;

  const groupWidth = chartInnerWidth / periodsData.length;
  const barWidth = Math.max(6, Math.min(14, (groupWidth - 14) / 2));

  return (
    <div
      className="content-panel"
      style={{
        margin: 0,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 12,
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* Topo do Card & Filtros */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <BarChart3 size={16} color="var(--primary)" />
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Produtividade: Tarefas Previstas vs. Concluídas
            </h3>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Relação de entregas programadas versus tarefas concluídas
          </p>
        </div>

        {/* Filtros: Obra, Equipa e Alternador Semanal/Mensal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Seletor de Obra */}
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              fontSize: 11,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Todas as Obras ({sites.length})</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Seletor de Equipa */}
          {teams.length > 0 && (
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: 11,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">Todas as Equipas</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          )}

          {/* Alternador Semanal / Mensal */}
          <div
            style={{
              display: 'inline-flex',
              padding: 2,
              borderRadius: 6,
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => setTimeframe('semanal')}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: timeframe === 'semanal' ? 'var(--primary)' : 'transparent',
                color: timeframe === 'semanal' ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              Semanal
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('mensal')}
              style={{
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: timeframe === 'mensal' ? 'var(--primary)' : 'transparent',
                color: timeframe === 'mensal' ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              Mensal
            </button>
          </div>
        </div>
      </div>

      {/* Legenda e Metas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#94A3B8' }} />
            <span style={{ color: 'var(--text-main)', fontSize: 11 }}>Previstas:</span>
            <strong style={{ color: 'var(--text-main)', fontSize: 11 }}>{totalPrevistas}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-main)', fontSize: 11 }}>Concluídas:</span>
            <strong style={{ color: 'var(--primary)', fontSize: 11 }}>{totalConcluidas}</strong>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: completionRate >= 100 ? 'var(--success)' : 'var(--warning)' }}>
          Taxa de Cumprimento: {completionRate}%
        </div>
      </div>

      {/* GRÁFICO SVG BARRAS AGRUPADAS */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Linhas de Grade Horizontais */}
          {[0, 0.5, 1].map((ratio) => {
            const val = Math.round(maxVal * ratio);
            const y = paddingTop + chartInnerHeight - ratio * chartInnerHeight;
            return (
              <g key={ratio}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--border-color)"
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--text-muted)"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Barras Agrupadas por Período */}
          {periodsData.map((item, idx) => {
            const groupX = paddingLeft + idx * groupWidth;
            const centerX = groupX + groupWidth / 2;

            // Alturas
            const hPrevistas = (item.previstas / maxVal) * chartInnerHeight;
            const hConcluidas = (item.concluidas / maxVal) * chartInnerHeight;

            const yPrevistas = paddingTop + chartInnerHeight - hPrevistas;
            const yConcluidas = paddingTop + chartInnerHeight - hConcluidas;

            const xPrevistas = centerX - barWidth - 1.5;
            const xConcluidas = centerX + 1.5;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.key}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Destaque de Fundo no Hover */}
                {isHovered && (
                  <rect
                    x={groupX + 2}
                    y={paddingTop}
                    width={groupWidth - 4}
                    height={chartInnerHeight}
                    fill="var(--primary-subtle)"
                    opacity="0.4"
                    rx="4"
                  />
                )}

                {/* Barra 1: Previstas */}
                {item.previstas > 0 ? (
                  <rect
                    x={xPrevistas}
                    y={yPrevistas}
                    width={barWidth}
                    height={Math.max(2, hPrevistas)}
                    fill="#94A3B8"
                    rx="2"
                    opacity={isHovered ? 1 : 0.85}
                  />
                ) : (
                  <line
                    x1={xPrevistas}
                    y1={paddingTop + chartInnerHeight - 1}
                    x2={xPrevistas + barWidth}
                    y2={paddingTop + chartInnerHeight - 1}
                    stroke="#94A3B8"
                    strokeWidth="1.5"
                  />
                )}

                {/* Barra 2: Concluídas */}
                {item.concluidas > 0 ? (
                  <rect
                    x={xConcluidas}
                    y={yConcluidas}
                    width={barWidth}
                    height={Math.max(2, hConcluidas)}
                    fill={item.isBelow ? '#EF4444' : 'var(--primary)'}
                    rx="2"
                    opacity={isHovered ? 1 : 0.9}
                  />
                ) : (
                  <line
                    x1={xConcluidas}
                    y1={paddingTop + chartInnerHeight - 1}
                    x2={xConcluidas + barWidth}
                    y2={paddingTop + chartInnerHeight - 1}
                    stroke="var(--border-color)"
                    strokeWidth="1.5"
                  />
                )}

                {/* Rótulo do Eixo X */}
                <text
                  x={centerX}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill={isHovered ? 'var(--primary)' : 'var(--text-muted)'}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip Detalhado */}
        {hoveredIdx !== null && periodsData[hoveredIdx] && (
          <div
            style={{
              position: 'absolute',
              left: `${((paddingLeft + hoveredIdx * groupWidth + groupWidth / 2) / width) * 100}%`,
              top: '10px',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '6px 10px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: 125,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: 3, marginBottom: 3 }}>
              {periodsData[hoveredIdx].label} ({periodsData[hoveredIdx].subLabel})
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, gap: 8 }}>
              <span style={{ color: '#94A3B8' }}>Previstas:</span>
              <strong style={{ color: 'var(--text-main)' }}>{periodsData[hoveredIdx].previstas}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, gap: 8 }}>
              <span style={{ color: 'var(--primary)' }}>Concluídas:</span>
              <strong style={{ color: 'var(--primary)' }}>{periodsData[hoveredIdx].concluidas}</strong>
            </div>
            {periodsData[hoveredIdx].previstas > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, gap: 8, marginTop: 3, paddingTop: 3, borderTop: '1px solid var(--border-color)' }}>
                <span style={{ color: periodsData[hoveredIdx].isBelow ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                  {periodsData[hoveredIdx].isBelow ? 'Abaixo da meta' : 'Meta atingida'}
                </span>
                <strong>
                  {Math.round((periodsData[hoveredIdx].concluidas / periodsData[hoveredIdx].previstas) * 100)}%
                </strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
