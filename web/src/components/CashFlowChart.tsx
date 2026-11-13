import React, { useState } from 'react';
import { FinancialRecord } from '../types';
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react';

interface CashFlowChartProps {
  records: FinancialRecord[];
}

export function CashFlowChart({ records }: CashFlowChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Gera os últimos 6 meses (ex: Junho a Novembro)
  const now = new Date();
  const monthsData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mLabel = d.toLocaleDateString('pt-PT', { month: 'short' });

    // Soma entradas e saídas deste mês
    const monthRecords = records.filter((r) => r.due_date && r.due_date.startsWith(mStr));
    const entradas = monthRecords
      .filter((r) => r.type === 'receita')
      .reduce((acc, r) => acc + (r.amount || 0), 0);
    const saidas = monthRecords
      .filter((r) => r.type === 'despesa')
      .reduce((acc, r) => acc + (r.amount || 0), 0);

    monthsData.push({
      key: mStr,
      label: mLabel.charAt(0).toUpperCase() + mLabel.slice(1).replace('.', ''),
      entradas,
      saidas,
      saldo: entradas - saidas,
    });
  }

  // Totais do mês atual
  const currentMonth = monthsData[monthsData.length - 1];
  const maxVal = Math.max(
    1000,
    ...monthsData.map((m) => Math.max(m.entradas, m.saidas))
  ) * 1.25;

  const height = 135;
  const width = 420;

  return (
    <div
      className="content-panel"
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={18} color="var(--primary)" />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Fluxo de Caixa (Últimos 6 Meses)
            </h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Comparativo de Dinheiro que Entrou (Receitas) vs Dinheiro que Saiu (Despesas)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Entradas Este Mês</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
              +€ {currentMonth.entradas.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saídas Este Mês</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>
              -€ {currentMonth.saidas.toLocaleString('pt-PT', { minimumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ position: 'relative', marginTop: 4 }}>
        <svg viewBox={`0 0 ${width} ${height + 25}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          {/* Linhas de grade horizontais */}
          {[0.25, 0.5, 0.75, 1].map((pct, i) => (
            <line
              key={i}
              x1="0"
              y1={height - height * pct}
              x2={width}
              y2={height - height * pct}
              stroke="var(--border-color)"
              strokeDasharray="4 4"
              opacity="0.6"
            />
          ))}

          {/* Barras duplas por mês */}
          {monthsData.map((d, i) => {
            const step = width / monthsData.length;
            const barW = 16;
            const groupX = i * step + (step - barW * 2 - 4) / 2;

            const hEntrada = (d.entradas / maxVal) * height;
            const yEntrada = height - hEntrada;

            const hSaida = (d.saidas / maxVal) * height;
            const ySaida = height - hSaida;

            const isHovered = hoveredIdx === i;

            return (
              <g
                key={d.key}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Barra Entrada (Verde / Sucesso) */}
                <rect
                  x={groupX}
                  y={yEntrada}
                  width={barW}
                  height={Math.max(2, hEntrada)}
                  rx={4}
                  fill={isHovered ? 'var(--primary)' : 'var(--success)'}
                  opacity={isHovered ? 1 : 0.85}
                  style={{ transition: 'all 0.2s' }}
                />

                {/* Barra Saída (Vermelho / Perigo) */}
                <rect
                  x={groupX + barW + 4}
                  y={ySaida}
                  width={barW}
                  height={Math.max(2, hSaida)}
                  rx={4}
                  fill="var(--danger)"
                  opacity={isHovered ? 1 : 0.7}
                  style={{ transition: 'all 0.2s' }}
                />

                {/* Rótulo do Mês */}
                <text
                  x={groupX + barW + 2}
                  y={height + 16}
                  textAnchor="middle"
                  fill={isHovered ? 'var(--primary)' : 'var(--text-muted)'}
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredIdx !== null && (
          <div
            style={{
              position: 'absolute',
              top: -10,
              right: 10,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
              display: 'flex',
              gap: 12,
            }}
          >
            <div>
              <strong>{monthsData[hoveredIdx].label}:</strong>
            </div>
            <div style={{ color: 'var(--success)' }}>
              +€ {monthsData[hoveredIdx].entradas.toLocaleString('pt-PT')}
            </div>
            <div style={{ color: 'var(--danger)' }}>
              -€ {monthsData[hoveredIdx].saidas.toLocaleString('pt-PT')}
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--text-muted)', paddingTop: 4, borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--success)' }} />
          <span>Entradas (Receitas & Medições)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--danger)' }} />
          <span>Saídas (Materiais, Mão de Obra, Despesas)</span>
        </div>
      </div>
    </div>
  );
}

