import React, { useState, useMemo } from 'react';
import { PieChart, AlertCircle, PlayCircle, PauseCircle, CheckCircle, Filter } from 'lucide-react';
import { ConstructionSite } from '../types';

interface SiteStatusDonutChartProps {
  sites: ConstructionSite[];
  onSelectSite?: (site: ConstructionSite) => void;
}

export function SiteStatusDonutChart({ sites, onSelectSite }: SiteStatusDonutChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'todos' | 'trimestre' | 'ano'>('todos');

  // Filtra as obras pelo período
  const filteredSites = useMemo(() => {
    const now = new Date();
    if (periodFilter === 'trimestre') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return sites.filter((s) => !s.created_at || new Date(s.created_at) >= threeMonthsAgo);
    }
    if (periodFilter === 'ano') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return sites.filter((s) => !s.created_at || new Date(s.created_at) >= yearStart);
    }
    return sites;
  }, [sites, periodFilter]);

  // Regra de prioridade para classificar cada obra em exatamente UMA categoria:
  // 1. Atrasadas (se a data de fim expirou e não está concluída)
  // 2. Concluídas (status === 'concluida')
  // 3. Pausadas (status === 'pausada')
  // 4. Em andamento (status === 'ativa' ou padrão)
  const categorized = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const groups: Record<'em_andamento' | 'atrasadas' | 'concluidas' | 'pausadas', ConstructionSite[]> = {
      atrasadas: [],
      em_andamento: [],
      concluidas: [],
      pausadas: [],
    };

    filteredSites.forEach((site) => {
      // 1. Prioridade para atrasadas: se tiver data de término que já expirou e não está concluída
      const isOverdue = Boolean(site.expected_end_date && site.expected_end_date < today && site.status !== 'concluida');

      if (isOverdue) {
        groups.atrasadas.push(site);
      } else if (site.status === 'concluida') {
        groups.concluidas.push(site);
      } else if (site.status === 'pausada') {
        groups.pausadas.push(site);
      } else {
        groups.em_andamento.push(site);
      }
    });

    const total = filteredSites.length;
    const slices = [
      {
        id: 'em_andamento',
        label: 'Em Andamento',
        count: groups.em_andamento.length,
        pct: total > 0 ? Math.round((groups.em_andamento.length / total) * 100) : 0,
        color: '#2563EB',
        icon: PlayCircle,
        sites: groups.em_andamento,
      },
      {
        id: 'atrasadas',
        label: 'Atrasadas',
        count: groups.atrasadas.length,
        pct: total > 0 ? Math.round((groups.atrasadas.length / total) * 100) : 0,
        color: '#EF4444',
        icon: AlertCircle,
        sites: groups.atrasadas,
      },
      {
        id: 'concluidas',
        label: 'Concluídas',
        count: groups.concluidas.length,
        pct: total > 0 ? Math.round((groups.concluidas.length / total) * 100) : 0,
        color: '#10B981',
        icon: CheckCircle,
        sites: groups.concluidas,
      },
      {
        id: 'pausadas',
        label: 'Pausadas',
        count: groups.pausadas.length,
        pct: total > 0 ? Math.round((groups.pausadas.length / total) * 100) : 0,
        color: '#F59E0B',
        icon: PauseCircle,
        sites: groups.pausadas,
      },
    ];

    return { groups, total, slices };
  }, [filteredSites]);

  // Cálculo dos arcos do Donut SVG
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const arcs = categorized.slices.map((slice) => {
    const strokeDasharray = `${(slice.pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += (slice.pct / 100) * circumference;
    return {
      ...slice,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeSlice = selectedCategory
    ? categorized.slices.find((s) => s.id === selectedCategory)
    : null;

  return (
    <div
      className="content-panel"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 16,
        background: 'var(--bg-card)',
      }}
    >
      {/* Topo & Filtro */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieChart size={18} color="var(--primary)" />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Distribuição das Obras por Estado
            </h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
            Visão proporcional do estado operacional das empreitadas
          </p>
        </div>

        {/* Filtro de Período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="var(--text-muted)" />
          <select
            value={periodFilter}
            onChange={(e: any) => setPeriodFilter(e.target.value)}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              fontSize: 11,
              fontWeight: 600,
              outline: 'none',
            }}
          >
            <option value="todos">Todo o Histórico</option>
            <option value="trimestre">Últimos 3 Meses</option>
            <option value="ano">Este Ano</option>
          </select>
        </div>
      </div>

      {/* Donut e Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: 20 }}>
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Círculo de Fundo */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="var(--bg-card-subtle)"
              strokeWidth={strokeWidth}
            />

            {/* Fatias das Categorias */}
            {categorized.total > 0 &&
              arcs.map((arc) => (
                <circle
                  key={arc.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={arc.color}
                  strokeWidth={selectedCategory === arc.id ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={arc.strokeDasharray}
                  strokeDashoffset={arc.strokeDashoffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-width 0.2s, opacity 0.2s',
                    opacity: selectedCategory && selectedCategory !== arc.id ? 0.35 : 1,
                  }}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === arc.id ? null : arc.id)
                  }
                />
              ))}
          </svg>

          {/* Centro do Donut: Total de Obras */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>
              {categorized.total}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
              {categorized.total === 1 ? 'Obra' : 'Obras'}
            </span>
          </div>
        </div>

        {/* Lista de Categorias / Legenda Interativa */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160 }}>
          {categorized.slices.map((slice) => {
            const Icon = slice.icon;
            const isSelected = selectedCategory === slice.id;

            return (
              <div
                key={slice.id}
                onClick={() => setSelectedCategory(isSelected ? null : slice.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 6,
                  backgroundColor: isSelected ? 'var(--bg-card-subtle)' : 'transparent',
                  border: isSelected ? `1px solid ${slice.color}` : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: slice.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: isSelected ? 800 : 600, color: 'var(--text-main)' }}>
                    {slice.label}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>
                    {slice.count}
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 34, textAlign: 'right' }}>
                    {slice.pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista detalhada das obras da categoria selecionada */}
      {activeSlice && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: 'var(--bg-card-subtle)',
            border: `1px solid ${activeSlice.color}`,
            marginTop: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: activeSlice.color }}>
              Obras {activeSlice.label} ({activeSlice.count})
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>

          {activeSlice.sites.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Nenhuma obra nesta condição.
            </span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {activeSlice.sites.map((s) => (
                <span
                  key={s.id}
                  onClick={() => onSelectSite && onSelectSite(s)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 4,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    cursor: onSelectSite ? 'pointer' : 'default',
                  }}
                  title={onSelectSite ? 'Clique para abrir os detalhes desta obra' : undefined}
                >
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
