import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import {
  FinancialRecord,
} from '../types';
import {
  EXPENSE_CATEGORIES,
  SiteProfitabilitySummary,
  addMoney,
  formatEuro,
  getEffectivePaidAmount,
  getEffectiveRemainingAmount,
  roundCents,
  subMoney,
} from '../lib/financialCalculations';

interface FinancialOverviewChartsProps {
  records: FinancialRecord[];
  filteredRecordsInPeriod: FinancialRecord[];
  sitesProfitability: SiteProfitabilitySummary[];
  selectedSiteId: string;
  onSelectSite?: (siteId: string) => void;
}

const MONTH_SHORT_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const FinancialOverviewCharts: React.FC<FinancialOverviewChartsProps> = ({
  records,
  filteredRecordsInPeriod,
  sitesProfitability,
  selectedSiteId,
  onSelectSite,
}) => {
  const [monthsSpan, setMonthsSpan] = useState<6 | 12>(6);
  const [includeCommittedInCategory, setIncludeCommittedInCategory] = useState<boolean>(false);

  const siteScopedRecords = useMemo(() => {
    return selectedSiteId === 'todos'
      ? records.filter((r) => r.status !== 'cancelado')
      : records.filter((r) => r.site_id === selectedSiteId && r.status !== 'cancelado');
  }, [records, selectedSiteId]);

  // ==========================================================================
  // GRÁFICO 2: RECEITAS VS DESPESAS MENSAL (Todos os meses do intervalo representados)
  // ==========================================================================
  const monthlySeries = useMemo(() => {
    const now = new Date();
    const buckets: {
      key: string;
      label: string;
      receitas: number;
      despesas: number;
      saldoMes: number;
    }[] = [];

    for (let i = monthsSpan - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      buckets.push({
        key,
        label: `${MONTH_SHORT_PT[m]}/${String(y).slice(2)}`,
        receitas: 0,
        despesas: 0,
        saldoMes: 0,
      });
    }

    const bucketMap = new Map(buckets.map((b) => [b.key, b]));

    siteScopedRecords.forEach((r) => {
      const paidVal = getEffectivePaidAmount(r);
      if (paidVal <= 0) return;

      // Se tiver parcelas registradas, distribui cada parcela no respetivo mês de pagamento
      if (Array.isArray(r.installments) && r.installments.length > 0) {
        r.installments.forEach((inst) => {
          const mKey = (inst.payment_date || r.due_date || '').slice(0, 7);
          const b = bucketMap.get(mKey);
          if (!b) return;
          if (r.type === 'receita') {
            b.receitas = addMoney(b.receitas, inst.amount);
          } else {
            b.despesas = addMoney(b.despesas, inst.amount);
          }
        });
      } else {
        const refDate = (r.payment_date || r.due_date || '').slice(0, 7);
        const b = bucketMap.get(refDate);
        if (!b) return;
        if (r.type === 'receita') {
          b.receitas = addMoney(b.receitas, paidVal);
        } else {
          b.despesas = addMoney(b.despesas, paidVal);
        }
      }
    });

    buckets.forEach((b) => {
      b.saldoMes = subMoney(b.receitas, b.despesas);
    });

    const maxVal = Math.max(...buckets.map((b) => Math.max(b.receitas, b.despesas)), 500);
    return { buckets, maxVal };
  }, [siteScopedRecords, monthsSpan]);

  // ==========================================================================
  // GRÁFICO 3: DISTRIBUIÇÃO DE DESPESAS POR CATEGORIA (Período e Obra ativos)
  // ==========================================================================
  const categoryBreakdown = useMemo(() => {
    const expenses = filteredRecordsInPeriod.filter(
      (r) => r.type === 'despesa' && r.status !== 'cancelado'
    );

    const items = EXPENSE_CATEGORIES.map((cat) => {
      const catRecs = expenses.filter((r) => {
        if (cat.id === 'custo_materiais' && r.category === 'pagamento_fornecedor') return true;
        if (cat.id === 'outros_custos' && r.category === 'outros') return true;
        return r.category === cat.id;
      });

      const paid = roundCents(catRecs.reduce((acc, r) => addMoney(acc, getEffectivePaidAmount(r)), 0));
      const committed = roundCents(
        catRecs.reduce((acc, r) => addMoney(acc, getEffectiveRemainingAmount(r)), 0)
      );
      const value = includeCommittedInCategory ? addMoney(paid, committed) : paid;

      return {
        ...cat,
        paid,
        committed,
        value,
        count: catRecs.length,
      };
    }).filter((item) => item.value > 0 || item.committed > 0);

    items.sort((a, b) => b.value - a.value);

    const totalValue = roundCents(items.reduce((acc, i) => addMoney(acc, i.value), 0));

    return {
      items: items.map((i) => ({
        ...i,
        pct: totalValue > 0 ? roundCents((i.value / totalValue) * 100) : 0,
      })),
      totalValue,
    };
  }, [filteredRecordsInPeriod, includeCommittedInCategory]);

  // ==========================================================================
  // GRÁFICO 4: ORÇAMENTO VS CUSTO REALIZADO E COMPROMETIDO POR OBRA
  // ==========================================================================
  const targetSitesProfitability = useMemo(() => {
    if (selectedSiteId === 'todos') return sitesProfitability;
    return sitesProfitability.filter((sp) => sp.site.id === selectedSiteId);
  }, [sitesProfitability, selectedSiteId]);

  // ==========================================================================
  // GRÁFICO 5: EVOLUÇÃO DA RENTABILIDADE / MARGEM DAS OBRAS AO LONGO DO TEMPO
  // ==========================================================================
  const profitabilityEvolution = useMemo(() => {
    const now = new Date();
    const points: {
      key: string;
      label: string;
      cumRevenue: number;
      cumCost: number;
      cumResult: number;
      marginPct: number;
    }[] = [];

    let runningRev = 0;
    let runningCost = 0;

    // Calcula saldo acumulado anterior à janela de meses
    const firstMonthDate = new Date(now.getFullYear(), now.getMonth() - (monthsSpan - 1), 1);
    const firstMonthKey = `${firstMonthDate.getFullYear()}-${String(firstMonthDate.getMonth() + 1).padStart(2, '0')}`;

    siteScopedRecords.forEach((r) => {
      const paid = getEffectivePaidAmount(r);
      if (paid <= 0) return;
      const mKey = (r.payment_date || r.due_date || '').slice(0, 7);
      if (mKey && mKey < firstMonthKey) {
        if (r.type === 'receita') runningRev = addMoney(runningRev, paid);
        else runningCost = addMoney(runningCost, paid);
      }
    });

    for (let i = monthsSpan - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      siteScopedRecords.forEach((r) => {
        const paid = getEffectivePaidAmount(r);
        if (paid <= 0) return;
        const mKey = (r.payment_date || r.due_date || '').slice(0, 7);
        if (mKey === key) {
          if (r.type === 'receita') runningRev = addMoney(runningRev, paid);
          else runningCost = addMoney(runningCost, paid);
        }
      });

      const cumResult = subMoney(runningRev, runningCost);
      const marginPct = runningRev > 0 ? roundCents((cumResult / runningRev) * 100) : 0;

      points.push({
        key,
        label: `${MONTH_SHORT_PT[m]}/${String(y).slice(2)}`,
        cumRevenue: runningRev,
        cumCost: runningCost,
        cumResult,
        marginPct,
      });
    }

    return points;
  }, [siteScopedRecords, monthsSpan]);

  // SVG da Evolução da Rentabilidade
  const evoSvgWidth = 540;
  const evoSvgHeight = 175;
  const evoPadLeft = 44;
  const evoPadRight = 18;
  const evoPadTop = 18;
  const evoPadBottom = 28;
  const evoPlotW = evoSvgWidth - evoPadLeft - evoPadRight;
  const evoPlotH = evoSvgHeight - evoPadTop - evoPadBottom;

  const evoMinResult = Math.min(...profitabilityEvolution.map((p) => p.cumResult), 0);
  const evoMaxResult = Math.max(...profitabilityEvolution.map((p) => p.cumResult), 1000);
  const evoRange = Math.max(evoMaxResult - evoMinResult, 1000);

  const getEvoY = (val: number) => {
    const ratio = (val - evoMinResult) / evoRange;
    return evoPadTop + evoPlotH - ratio * evoPlotH;
  };

  const zeroLineY = getEvoY(0);

  const evoPolylinePoints = profitabilityEvolution
    .map((p, idx) => {
      const x =
        profitabilityEvolution.length > 1
          ? evoPadLeft + (idx / (profitabilityEvolution.length - 1)) * evoPlotW
          : evoPadLeft + evoPlotW / 2;
      const y = getEvoY(p.cumResult);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* LINHA 1: RECEITAS VS DESPESAS MENSAL + DISTRIBUIÇÃO DE DESPESAS POR CATEGORIA */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
        }}
      >
        {/* GRÁFICO 2: RECEITAS VS DESPESAS MENSAL */}
        <div
          className="content-panel"
          style={{
            margin: 0,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={17} color="var(--primary)" />
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Receitas vs. Despesas Mensal
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                  Comparativo mensal de entradas e saídas efetivadas (meses sem movimento incluídos)
                </p>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => setMonthsSpan(6)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: monthsSpan === 6 ? 'var(--primary)' : 'transparent',
                    color: monthsSpan === 6 ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  6 Meses
                </button>
                <button
                  type="button"
                  onClick={() => setMonthsSpan(12)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: monthsSpan === 12 ? 'var(--primary)' : 'transparent',
                    color: monthsSpan === 12 ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  12 Meses
                </button>
              </div>
            </div>

            {/* Legenda */}
            <div style={{ display: 'flex', gap: 16, fontSize: 11, fontWeight: 600, marginBottom: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#10B981' }} />
                Receitas Recebidas (€)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#EF4444' }} />
                Despesas Pagas (€)
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: 185,
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: 8,
              paddingTop: 18,
              gap: 6,
            }}
          >
            {monthlySeries.buckets.map((b) => {
              const hRec =
                b.receitas > 0
                  ? Math.max(Math.round((b.receitas / monthlySeries.maxVal) * 135), 6)
                  : 3;
              const hDesp =
                b.despesas > 0
                  ? Math.max(Math.round((b.despesas / monthlySeries.maxVal) * 135), 6)
                  : 3;

              return (
                <div
                  key={b.key}
                  title={`${b.label}\nReceitas: ${formatEuro(b.receitas, true)}\nDespesas: ${formatEuro(b.despesas, true)}\nSaldo do Mês: ${formatEuro(b.saldoMes, true)}`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      gap: monthsSpan === 12 ? 3 : 5,
                      height: 140,
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: monthsSpan === 12 ? 9 : 15,
                        height: hRec,
                        backgroundColor: b.receitas > 0 ? '#10B981' : 'var(--border-color)',
                        opacity: b.receitas > 0 ? 1 : 0.35,
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.25s ease',
                      }}
                    />
                    <div
                      style={{
                        width: monthsSpan === 12 ? 9 : 15,
                        height: hDesp,
                        backgroundColor: b.despesas > 0 ? '#EF4444' : 'var(--border-color)',
                        opacity: b.despesas > 0 ? 1 : 0.35,
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.25s ease',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: monthsSpan === 12 ? 9.5 : 11,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginTop: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* GRÁFICO 3: DISTRIBUIÇÃO DE DESPESAS POR CATEGORIA */}
        <div
          className="content-panel"
          style={{
            margin: 0,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieChart size={17} color="var(--primary)" />
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    Distribuição de Despesas por Categoria
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                  Total analisado: <strong>{formatEuro(categoryBreakdown.totalValue, true)}</strong>
                </p>
              </div>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeCommittedInCategory}
                  onChange={(e) => setIncludeCommittedInCategory(e.target.checked)}
                />
                Incluir comprometidos
              </label>
            </div>

            {/* Barra proporcional multi-segmento */}
            {categoryBreakdown.totalValue <= 0 ? (
              <div
                style={{
                  padding: '28px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 8,
                  marginTop: 12,
                }}
              >
                Sem despesas registadas para o período e obra selecionados.
              </div>
            ) : (
              <>
                <div
                  style={{
                    height: 18,
                    borderRadius: 6,
                    overflow: 'hidden',
                    display: 'flex',
                    backgroundColor: 'var(--bg-card-subtle)',
                    marginBottom: 14,
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {categoryBreakdown.items.map((cat) => (
                    <div
                      key={cat.id}
                      title={`${cat.label}: ${formatEuro(cat.value, true)} (${cat.pct.toFixed(1)}%)`}
                      style={{
                        width: `${Math.max(cat.pct, 1.5)}%`,
                        backgroundColor: cat.color,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 165,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {categoryBreakdown.items.map((cat) => (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        padding: '5px 8px',
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-card-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: cat.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cat.label}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          ({cat.count})
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {formatEuro(cat.value)}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: cat.color,
                            minWidth: 44,
                            textAlign: 'right',
                          }}
                        >
                          {cat.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* LINHA 2: ORÇAMENTO VS CUSTO POR OBRA + EVOLUÇÃO DA RENTABILIDADE */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
        }}
      >
        {/* GRÁFICO 4: ORÇAMENTO VS CUSTO REALIZADO E COMPROMETIDO POR OBRA */}
        <div className="content-panel" style={{ margin: 0, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={17} color="var(--primary)" />
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Orçamento vs. Custo Realizado e Comprometido
              </h3>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Controlo de consumo orçamental e identificação imediata de desvios por obra
          </p>

          <div style={{ display: 'flex', gap: 14, fontSize: 11, fontWeight: 600, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#2563EB' }} />
              Realizado (Pago)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#F59E0B' }} />
              Comprometido (A Pagar)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#EF4444' }} />
              Desvio (&gt;100% Orçamento)
            </span>
          </div>

          {targetSitesProfitability.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Nenhuma obra registada.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 210, overflowY: 'auto', paddingRight: 4 }}>
              {targetSitesProfitability.map((sp) => {
                const totalUsed = addMoney(sp.realizedCosts, sp.committedCosts);
                const refBudget = Math.max(sp.costBudget, 1);
                const realizedBarPct = Math.min(100, (sp.realizedCosts / refBudget) * 100);
                const committedBarPct = Math.min(
                  Math.max(0, 100 - realizedBarPct),
                  (sp.committedCosts / refBudget) * 100
                );
                const isOver = sp.budgetCommittedPct > 100;
                const isWarn = sp.budgetCommittedPct >= 80 && !isOver;

                return (
                  <div
                    key={sp.site.id}
                    onClick={() => onSelectSite && onSelectSite(sp.site.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: `1px solid ${
                        isOver
                          ? 'rgba(239, 68, 68, 0.45)'
                          : isWarn
                          ? 'rgba(245, 158, 11, 0.45)'
                          : 'var(--border-color)'
                      }`,
                      cursor: onSelectSite ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{sp.site.name}</span>
                        {isOver && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 4,
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#EF4444',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <AlertTriangle size={11} /> +{formatEuro(sp.budgetDeviation)} acima
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: isOver ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981',
                        }}
                      >
                        {sp.budgetCommittedPct.toFixed(1)}% do orçamento
                      </span>
                    </div>

                    <div
                      style={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: 'var(--border-color)',
                        overflow: 'hidden',
                        display: 'flex',
                        marginBottom: 6,
                      }}
                    >
                      <div
                        title={`Realizado: ${formatEuro(sp.realizedCosts, true)}`}
                        style={{
                          width: `${realizedBarPct}%`,
                          backgroundColor: isOver ? '#EF4444' : '#2563EB',
                        }}
                      />
                      <div
                        title={`Comprometido: ${formatEuro(sp.committedCosts, true)}`}
                        style={{
                          width: `${committedBarPct}%`,
                          backgroundColor: '#F59E0B',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap', gap: 6 }}>
                      <span>
                        Orçamento Custos: <strong style={{ color: 'var(--text-main)' }}>{formatEuro(sp.costBudget)}</strong>
                      </span>
                      <span>
                        Realizado: <strong style={{ color: '#2563EB' }}>{formatEuro(sp.realizedCosts)}</strong> • Comprometido:{' '}
                        <strong style={{ color: '#F59E0B' }}>{formatEuro(sp.committedCosts)}</strong> (Total: {formatEuro(totalUsed)})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GRÁFICO 5: EVOLUÇÃO DA RENTABILIDADE E RESULTADO ACUMULADO */}
        <div className="content-panel" style={{ margin: 0, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={17} color="var(--primary)" />
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Evolução da Rentabilidade das Obras
                </h3>
              </div>
              {profitabilityEvolution.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    backgroundColor:
                      profitabilityEvolution[profitabilityEvolution.length - 1].marginPct >= 0
                        ? 'rgba(16, 185, 129, 0.14)'
                        : 'rgba(239, 68, 68, 0.14)',
                    color:
                      profitabilityEvolution[profitabilityEvolution.length - 1].marginPct >= 0
                        ? '#10B981'
                        : '#EF4444',
                  }}
                >
                  Margem acumulada:{' '}
                  {profitabilityEvolution[profitabilityEvolution.length - 1].marginPct.toFixed(1)}%
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
              Curva de resultado acumulado (Receitas recebidas − Custos realizados) e margem percentual
            </p>
          </div>

          <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg
              viewBox={`0 0 ${evoSvgWidth} ${evoSvgHeight}`}
              style={{ width: '100%', height: 'auto', minHeight: 165, display: 'block' }}
            >
              {/* Linha Zero */}
              <line
                x1={evoPadLeft}
                y1={zeroLineY}
                x2={evoSvgWidth - evoPadRight}
                y2={zeroLineY}
                stroke="var(--border-color)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={evoPadLeft - 6}
                y={zeroLineY + 3}
                textAnchor="end"
                fontSize="9.5"
                fill="var(--text-muted)"
              >
                0 €
              </text>

              {/* Curva de Resultado */}
              {profitabilityEvolution.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={evoPolylinePoints}
                />
              )}

              {/* Pontos e Labels */}
              {profitabilityEvolution.map((p, idx) => {
                const x =
                  profitabilityEvolution.length > 1
                    ? evoPadLeft + (idx / (profitabilityEvolution.length - 1)) * evoPlotW
                    : evoPadLeft + evoPlotW / 2;
                const y = getEvoY(p.cumResult);
                const isPositive = p.cumResult >= 0;

                return (
                  <g key={p.key}>
                    <circle
                      cx={x}
                      cy={y}
                      r={4}
                      fill={isPositive ? '#10B981' : '#EF4444'}
                      stroke="var(--bg-card)"
                      strokeWidth="1.5"
                    >
                      <title>{`${p.label}\nResultado Acumulado: ${formatEuro(p.cumResult, true)}\nMargem: ${p.marginPct.toFixed(1)}%\nReceitas Acum.: ${formatEuro(p.cumRevenue)}\nCustos Acum.: ${formatEuro(p.cumCost)}`}</title>
                    </circle>
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill={isPositive ? '#10B981' : '#EF4444'}
                    >
                      {p.marginPct.toFixed(0)}%
                    </text>
                    <text
                      x={x}
                      y={evoSvgHeight - 8}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="600"
                      fill="var(--text-muted)"
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
