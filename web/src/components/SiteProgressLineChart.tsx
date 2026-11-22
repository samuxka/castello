import React, { useState, useMemo } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, Calendar, Filter, ChevronDown } from 'lucide-react';
import { ConstructionSite, SiteTask } from '../types';

interface SiteProgressLineChartProps {
  sites: ConstructionSite[];
  tasks: SiteTask[];
}

function SiteProgressLineChartBase({ sites, tasks }: SiteProgressLineChartProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    planned: number;
    actual: number;
    x: number;
    yActual: number;
    yPlanned: number;
  } | null>(null);

  // Lista de obras para o seletor
  const activeSites = useMemo(() => {
    return sites.filter((s) => s.status !== 'concluida');
  }, [sites]);

  // Calcula os pontos da curva MENSAL (últimos 6 meses) com base nos dados reais de cada obra
  const chartData = useMemo(() => {
    const pointsCount = 6;
    const now = new Date();
    const dataPoints: {
      key: string;
      label: string;
      planned: number;
      actual: number;
      isBelow: boolean;
      date: Date;
    }[] = [];

    // Obras a considerar
    const targetSites = selectedSiteId === 'all'
      ? sites
      : sites.filter((s) => s.id === selectedSiteId);

    // Tarefas da obra ou de todas as obras
    const targetTasks = selectedSiteId === 'all'
      ? tasks
      : tasks.filter((t) => t.site_id === selectedSiteId);

    const totalTasksCount = targetTasks.length;

    // Gerar os 6 meses (do mais antigo para o atual)
    for (let i = pointsCount - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthEndIso = monthEnd.toISOString();

      const mName = monthDate.toLocaleDateString('pt-PT', { month: 'short' });
      const label = mName.charAt(0).toUpperCase() + mName.slice(1).replace('.', '');

      let plannedPct = 0;
      let actualPct = 0;

      if (targetSites.length > 0) {
        // CÁLCULO PLANEADO: cronograma contratual de início e término previsto
        let sumPlanned = 0;
        targetSites.forEach((site) => {
          const start = site.start_date ? new Date(site.start_date + 'T00:00:00') : new Date('2026-06-01');
          const end = site.expected_end_date
            ? new Date(site.expected_end_date + 'T23:59:59')
            : new Date(start.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 meses padrão

          if (monthEnd.getTime() < start.getTime()) {
            sumPlanned += 0;
          } else if (monthEnd.getTime() >= end.getTime()) {
            sumPlanned += 100;
          } else {
            const totalDuration = end.getTime() - start.getTime();
            const elapsed = monthEnd.getTime() - start.getTime();
            const pct = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 50;
            sumPlanned += Math.min(100, Math.max(0, Math.round(pct)));
          }
        });
        plannedPct = Math.round(sumPlanned / targetSites.length);

        // CÁLCULO EXECUTADO: tarefas concluídas até o final deste mês
        if (totalTasksCount > 0) {
          const completedUpToMonth = targetTasks.filter((t) => {
            const isDone = t.status === 'confirmada_chefe' || t.status === 'concluida_funcionario';
            if (!isDone) return false;
            const completionTime = t.completed_at || t.confirmed_at || t.created_at;
            if (!completionTime) return true;
            return completionTime <= monthEndIso;
          }).length;

          actualPct = Math.min(100, Math.round((completedUpToMonth / totalTasksCount) * 100));
        } else {
          // Se a obra ainda não cadastrou tarefas individuais, baseia-se no estado real da obra
          let sumStatusPct = 0;
          targetSites.forEach((s) => {
            if (s.status === 'concluida') {
              sumStatusPct += 100;
            } else if (s.status === 'pausada') {
              sumStatusPct += 20;
            } else if (monthEnd.getTime() >= (s.start_date ? new Date(s.start_date).getTime() : 0)) {
              sumStatusPct += 35;
            }
          });
          actualPct = Math.round(sumStatusPct / targetSites.length);
        }
      }

      dataPoints.push({
        key: `${i}-${label}`,
        label,
        planned: plannedPct,
        actual: actualPct,
        isBelow: actualPct < plannedPct,
        date: monthDate,
      });
    }

    return dataPoints;
  }, [sites, tasks, selectedSiteId]);

  // Estatística geral: desvio atual (último mês)
  const latestPoint = chartData[chartData.length - 1];
  const isCurrentlyDelayed = latestPoint ? latestPoint.actual < latestPoint.planned : false;
  const deviation = latestPoint ? latestPoint.actual - latestPoint.planned : 0;

  // Dimensões do SVG
  const width = 640;
  const height = 190;
  const paddingLeft = 38;
  const paddingRight = 20;
  const paddingTop = 16;
  const paddingBottom = 26;

  const chartInnerWidth = width - paddingLeft - paddingRight;
  const chartInnerHeight = height - paddingTop - paddingBottom;

  // Mapeia percentual (0 a 100) para coordenada Y
  const getY = (val: number) => {
    return paddingTop + chartInnerHeight - (val / 100) * chartInnerHeight;
  };

  // Mapeia índice do mês para coordenada X
  const getX = (idx: number) => {
    if (chartData.length <= 1) return paddingLeft + chartInnerWidth / 2;
    return paddingLeft + (idx / (chartData.length - 1)) * chartInnerWidth;
  };

  // Caminhos SVG com linhas mais finas e elegantes
  const plannedPathD = chartData.reduce((acc, pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.planned);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const actualPathD = chartData.reduce((acc, pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.actual);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Área preenchida sob a curva real
  const actualAreaD = `${actualPathD} L ${getX(chartData.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

  return (
    <div
      className="content-panel"
      style={{
        margin: 0,
        padding: '18px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* CABEÇALHO DO GRÁFICO */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <TrendingUp size={16} color="var(--primary)" />
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Evolução das Obras: Planeado vs. Executado
            </h2>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Comparativo da percentagem prevista no cronograma vs. avanço real das tarefas (Visão Mensal)
          </p>
        </div>

        {/* Filtro por Obra */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="select-flat"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 26px 4px 10px',
                borderRadius: 6,
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="all">Todas as Obras ({sites.length})</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--text-muted)',
              }}
            />
          </div>

          {/* Tag de Alerta ou Sucesso */}
          {latestPoint && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 12,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: isCurrentlyDelayed ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                color: isCurrentlyDelayed ? '#EF4444' : '#10B981',
                border: `1px solid ${isCurrentlyDelayed ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
              }}
            >
              {isCurrentlyDelayed ? (
                <>
                  <AlertTriangle size={11} /> Em Atraso ({deviation}%)
                </>
              ) : (
                <>
                  <CheckCircle2 size={11} /> No Prazo ({deviation >= 0 ? `+${deviation}%` : '0%'})
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* LEGENDA E INDICADORES DO GRÁFICO */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Série Executado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 2, backgroundColor: 'var(--primary)', borderRadius: 1 }} />
            <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: 11 }}>Executado:</span>
            <strong style={{ color: 'var(--primary)', fontSize: 11 }}>{latestPoint?.actual || 0}%</strong>
          </div>

          {/* Série Planeado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 2, borderTop: '2px dashed #94A3B8' }} />
            <span style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: 11 }}>Planeado:</span>
            <strong style={{ color: '#94A3B8', fontSize: 11 }}>{latestPoint?.planned || 0}%</strong>
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Últimos 6 Meses
        </div>
      </div>

      {/* ÁREA GRÁFICA SVG */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <defs>
            <linearGradient id="execGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Linhas de Grade Horizontais e Eixo Y */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = getY(pct);
            return (
              <g key={pct}>
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
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Área sombreada do executado */}
          <path d={actualAreaD} fill="url(#execGradient)" />

          {/* Linha Planeada (Tracejada Cinza mais fina: 1.25px) */}
          <path
            d={plannedPathD}
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1.25"
            strokeDasharray="5 3"
            strokeLinecap="round"
          />

          {/* Linha Executada (Sólida mais fina: 1.75px) */}
          <path
            d={actualPathD}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pontos Interativos e Rótulos do Eixo X */}
          {chartData.map((pt, idx) => {
            const x = getX(idx);
            const yActual = getY(pt.actual);
            const yPlanned = getY(pt.planned);

            return (
              <g key={pt.key}>
                {/* Rótulo do Eixo X com fonte menor (9px) */}
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="var(--text-muted)"
                >
                  {pt.label}
                </text>

                {/* Ponto Planeado sutil */}
                <circle
                  cx={x}
                  cy={yPlanned}
                  r="2.5"
                  fill="var(--bg-card)"
                  stroke="#94A3B8"
                  strokeWidth="1.2"
                />

                {/* Ponto Executado sutil */}
                <circle
                  cx={x}
                  cy={yActual}
                  r={hoveredPoint?.label === pt.label ? 4.5 : 3}
                  fill={pt.isBelow ? '#EF4444' : 'var(--primary)'}
                  stroke="var(--bg-card)"
                  strokeWidth="1.5"
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                  onMouseEnter={() =>
                    setHoveredPoint({
                      label: pt.label,
                      planned: pt.planned,
                      actual: pt.actual,
                      x,
                      yActual,
                      yPlanned,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip Flutuante */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(Math.min(hoveredPoint.yActual, hoveredPoint.yPlanned) / height) * 100}%`,
              transform: 'translate(-50%, -115%)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '6px 10px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 30,
              minWidth: 130,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: 3, marginBottom: 3 }}>
              Mês: {hoveredPoint.label}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, gap: 8 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Executado:</span>
              <strong style={{ color: 'var(--text-main)' }}>{hoveredPoint.actual}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, gap: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Planeado:</span>
              <strong style={{ color: 'var(--text-muted)' }}>{hoveredPoint.planned}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, gap: 8, marginTop: 3, paddingTop: 3, borderTop: '1px solid var(--border-color)' }}>
              <span style={{ color: hoveredPoint.actual >= hoveredPoint.planned ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                Desvio:
              </span>
              <strong style={{ color: hoveredPoint.actual >= hoveredPoint.planned ? 'var(--success)' : 'var(--danger)' }}>
                {hoveredPoint.actual >= hoveredPoint.planned ? `+${hoveredPoint.actual - hoveredPoint.planned}%` : `${hoveredPoint.actual - hoveredPoint.planned}%`}
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const SiteProgressLineChart = React.memo(SiteProgressLineChartBase);
