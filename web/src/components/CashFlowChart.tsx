import React, { useMemo, useState } from 'react';
import { FinancialRecord } from '../types';
import { TrendingUp } from 'lucide-react';
import {
  formatEuro,
  getEffectivePaidAmount,
  getEffectiveRemainingAmount,
  roundCents,
} from '../lib/financialCalculations';

interface CashFlowChartProps {
  records: FinancialRecord[];
  monthsCount?: number;
  selectedSiteName?: string | null;
}

export function CashFlowChart({
  records,
  monthsCount = 6,
  selectedSiteName,
}: CashFlowChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [includePendingForecast, setIncludePendingForecast] = useState<boolean>(false);

  const monthsData = useMemo(() => {
    const now = new Date();
    const activeRecords = records.filter((r) => r.status !== 'cancelado');

    // Calcula o saldo acumulado anterior à janela de meses exibida
    const firstMonthDate = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1), 1);
    const firstMonthKey = `${firstMonthDate.getFullYear()}-${String(firstMonthDate.getMonth() + 1).padStart(2, '0')}`;

    let runningBalance = 0;
    activeRecords.forEach((r) => {
      const refD = (r.payment_date || r.due_date || '').slice(0, 7);
      if (refD && refD < firstMonthKey) {
        const val = includePendingForecast
          ? r.amount
          : getEffectivePaidAmount(r);
        if (r.type === 'receita') runningBalance = roundCents(runningBalance + val);
        else runningBalance = roundCents(runningBalance - val);
      }
    });

    const list: {
      key: string;
      label: string;
      entradas: number;
      saidas: number;
      saldoMes: number;
      saldoAcumulado: number;
    }[] = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = d.toLocaleDateString('pt-PT', { month: 'short' });

      const monthRecords = activeRecords.filter((r) => {
        const refDate =
          !includePendingForecast && (r.status === 'pago' || r.status === 'parcial')
            ? r.payment_date || r.due_date
            : r.due_date;
        return refDate && refDate.startsWith(mStr);
      });

      const entradas = roundCents(
        monthRecords
          .filter((r) => r.type === 'receita')
          .reduce(
            (acc, r) =>
              acc +
              (includePendingForecast
                ? getEffectivePaidAmount(r) + getEffectiveRemainingAmount(r)
                : getEffectivePaidAmount(r)),
            0
          )
      );

      const saidas = roundCents(
        monthRecords
          .filter((r) => r.type === 'despesa')
          .reduce(
            (acc, r) =>
              acc +
              (includePendingForecast
                ? getEffectivePaidAmount(r) + getEffectiveRemainingAmount(r)
                : getEffectivePaidAmount(r)),
            0
          )
      );

      const saldoMes = roundCents(entradas - saidas);
      runningBalance = roundCents(runningBalance + saldoMes);

      list.push({
        key: mStr,
        label: `${mLabel.charAt(0).toUpperCase() + mLabel.slice(1).replace('.', '')}/${String(d.getFullYear()).slice(2)}`,
        entradas,
        saidas,
        saldoMes,
        saldoAcumulado: runningBalance,
      });
    }

    return list;
  }, [records, monthsCount, includePendingForecast]);

  const currentMonth = monthsData[monthsData.length - 1] || {
    entradas: 0,
    saidas: 0,
    saldoAcumulado: 0,
  };

  const { minVal, maxVal } = useMemo(() => {
    const allVals = monthsData.flatMap((m) => [
      m.entradas,
      m.saidas,
      m.saldoAcumulado,
    ]);
    const min = Math.min(0, ...allVals);
    const max = Math.max(1000, ...allVals);
    const pad = Math.max(200, (max - min) * 0.15);
    return {
      minVal: min < 0 ? min - pad * 0.5 : 0,
      maxVal: max + pad,
    };
  }, [monthsData]);

  const svgWidth = 680;
  const svgHeight = 195;
  const padLeft = 58;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 30;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const range = Math.max(maxVal - minVal, 1000);

  const getX = (idx: number) => {
    if (monthsData.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (monthsData.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / range;
    return padTop + plotH - ratio * plotH;
  };

  const entradasPolyline = monthsData
    .map((d, i) => `${getX(i).toFixed(1)},${getY(d.entradas).toFixed(1)}`)
    .join(' ');

  const saidasPolyline = monthsData
    .map((d, i) => `${getX(i).toFixed(1)},${getY(d.saidas).toFixed(1)}`)
    .join(' ');

  const saldoPolyline = monthsData
    .map((d, i) => `${getX(i).toFixed(1)},${getY(d.saldoAcumulado).toFixed(1)}`)
    .join(' ');

  const zeroY = getY(0);
  const saldoAreaPoints =
    monthsData.length > 1
      ? `${getX(0).toFixed(1)},${zeroY.toFixed(1)} ${saldoPolyline} ${getX(
          monthsData.length - 1
        ).toFixed(1)},${zeroY.toFixed(1)}`
      : '';

  const yTicks = [0, 0.33, 0.66, 1].map((t) => minVal + range * t);

  return (
    <div
      className="content-panel"
      style={{
        padding: '18px 20px',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="var(--primary)" />
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Fluxo de Caixa & Evolução do Saldo ({monthsCount} Meses)
            </h3>
            {selectedSiteName && (
              <span className="badge-flat primary" style={{ fontSize: 10 }}>
                {selectedSiteName}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Gráfico de linhas comparando entradas, saídas e evolução do saldo acumulado de tesouraria
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 6,
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
            }}
          >
            <input
              type="checkbox"
              checked={includePendingForecast}
              onChange={(e) => setIncludePendingForecast(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            Incluir previstos pendentes
          </label>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
              Entradas Mês Atual
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981' }}>
              +{formatEuro(currentMonth.entradas)}
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
              Saídas Mês Atual
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#EF4444' }}>
              -{formatEuro(currentMonth.saidas)}
            </span>
          </div>
        </div>
      </div>

      {/* SVG Line Chart Puro */}
      <div style={{ position: 'relative', marginTop: 4 }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: '100%', height: 'auto', maxHeight: 220, overflow: 'visible', display: 'block' }}
        >
          <defs>
            <linearGradient id="cashflowSaldoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grelha horizontal e valores do eixo Y */}
          {yTicks.map((val, i) => {
            const y = getY(val);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="var(--border-color)"
                  strokeDasharray="4 4"
                  opacity="0.55"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9.5"
                  fill="var(--text-muted)"
                >
                  {formatEuro(Math.round(val))}
                </text>
              </g>
            );
          })}

          {/* Área suave sob a linha do Saldo Acumulado */}
          {saldoAreaPoints && (
            <polygon points={saldoAreaPoints} fill="url(#cashflowSaldoGrad)" />
          )}

          {/* Linha de Entradas (Verde) */}
          {monthsData.length > 1 && (
            <polyline
              fill="none"
              stroke="#10B981"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={entradasPolyline}
            />
          )}

          {/* Linha de Saídas (Vermelho) */}
          {monthsData.length > 1 && (
            <polyline
              fill="none"
              stroke="#EF4444"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={saidasPolyline}
            />
          )}

          {/* Linha Principal de Evolução do Saldo de Caixa (Azul) */}
          {monthsData.length > 1 && (
            <polyline
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={saldoPolyline}
            />
          )}

          {/* Pontos interativos e rótulos do eixo X */}
          {monthsData.map((d, i) => {
            const x = getX(i);
            const yEnt = getY(d.entradas);
            const ySai = getY(d.saidas);
            const ySal = getY(d.saldoAcumulado);
            const isHovered = hoveredIdx === i;

            return (
              <g
                key={d.key}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Guia vertical no hover */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + plotH}
                    stroke="var(--primary)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                )}

                {/* Ponto Entradas */}
                <circle
                  cx={x}
                  cy={yEnt}
                  r={isHovered ? 4.5 : 3}
                  fill="#10B981"
                  stroke="var(--bg-card)"
                  strokeWidth="1.2"
                />

                {/* Ponto Saídas */}
                <circle
                  cx={x}
                  cy={ySai}
                  r={isHovered ? 4.5 : 3}
                  fill="#EF4444"
                  stroke="var(--bg-card)"
                  strokeWidth="1.2"
                />

                {/* Ponto Saldo Acumulado */}
                <circle
                  cx={x}
                  cy={ySal}
                  r={isHovered ? 5.5 : 3.8}
                  fill={d.saldoAcumulado >= 0 ? '#3B82F6' : '#EF4444'}
                  stroke="var(--bg-card)"
                  strokeWidth="1.5"
                />

                {/* Área invisível mais larga para facilitar o hover */}
                <rect
                  x={x - plotW / monthsData.length / 2}
                  y={padTop}
                  width={plotW / monthsData.length}
                  height={plotH + 22}
                  fill="transparent"
                />

                {/* Rótulo do Mês */}
                <text
                  x={x}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  fill={isHovered ? 'var(--primary)' : 'var(--text-muted)'}
                  fontSize="10"
                  fontWeight={isHovered ? '700' : '600'}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredIdx !== null && monthsData[hoveredIdx] && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 8,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11,
              boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              zIndex: 10,
            }}
          >
            <strong style={{ color: 'var(--text-main)', fontSize: 12 }}>
              {monthsData[hoveredIdx].label}
            </strong>
            <span style={{ color: '#10B981', fontWeight: 700 }}>
              Entradas: +{formatEuro(monthsData[hoveredIdx].entradas, true)}
            </span>
            <span style={{ color: '#EF4444', fontWeight: 700 }}>
              Saídas: -{formatEuro(monthsData[hoveredIdx].saidas, true)}
            </span>
            <span
              style={{
                color: monthsData[hoveredIdx].saldoAcumulado >= 0 ? '#3B82F6' : '#EF4444',
                fontWeight: 800,
                borderTop: '1px solid var(--border-color)',
                paddingTop: 3,
              }}
            >
              Saldo Acumulado: {formatEuro(monthsData[hoveredIdx].saldoAcumulado, true)}
            </span>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          flexWrap: 'wrap',
          fontSize: 11,
          color: 'var(--text-muted)',
          paddingTop: 6,
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: '#3B82F6' }} />
          <span>Evolução do Saldo de Caixa</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, borderBottom: '2px dashed #10B981' }} />
          <span>Entradas (Receitas & Medições)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 2, borderBottom: '2px dashed #EF4444' }} />
          <span>Saídas (Custos & Despesas)</span>
        </div>
      </div>
    </div>
  );
}
