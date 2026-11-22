import {
  Company,
  FinancialRecord,
  SiteMeasurement,
} from '../types';
import {
  EXPENSE_CATEGORIES,
  formatDatePt,
  formatEuro,
  getCategoryDefinition,
  getEffectivePaidAmount,
  getEffectiveRemainingAmount,
  roundCents,
  SiteProfitabilitySummary,
} from './financialCalculations';

export type FinancialReportType =
  | 'extrato'
  | 'receitas_despesas'
  | 'contas_pendentes'
  | 'rentabilidade_obras'
  | 'custos_categoria'
  | 'medicoes';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportContext {
  company: Company;
  periodLabel: string;
  siteFilterLabel: string;
  records: FinancialRecord[];
  sitesProfitability: SiteProfitabilitySummary[];
  measurements: SiteMeasurement[];
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function neutralizeSpreadsheetFormula(raw: string): string {
  // Evita CSV/Excel Formula Injection (DDE) para células iniciadas por =, +, -, @, TAB ou CR,
  // preservando números negativos puros (ex: -120.50 ou -120,50).
  if (/^[\t\r=@+]/.test(raw)) {
    return `'${raw}`;
  }
  if (raw.startsWith('-') && !/^-\d+([.,]\d+)?%?$/.test(raw.trim())) {
    return `'${raw}`;
  }
  return raw;
}

function escapeCsvCell(val: string | number): string {
  const s = typeof val === 'number' ? String(val) : neutralizeSpreadsheetFormula(String(val ?? ''));
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildReportTable(
  reportType: FinancialReportType,
  ctx: ReportContext
): {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
} {
  const { records, sitesProfitability, measurements } = ctx;

  if (reportType === 'extrato') {
    const headers = [
      'Data Vencimento',
      'Data Pagamento',
      'Tipo',
      'Descrição',
      'Categoria',
      'Subcategoria',
      'Obra',
      'Entidade (Cliente/Fornecedor/Colaborador)',
      'Documento / Ref.',
      'Valor Original (€)',
      'Valor Liquidado (€)',
      'Saldo Restante (€)',
      'Estado',
    ];
    const rows = records.map((r) => {
      const cat = getCategoryDefinition(r.category, r.type);
      const paid = getEffectivePaidAmount(r);
      const rem = getEffectiveRemainingAmount(r);
      const statusLabel =
        r.status === 'pago'
          ? 'Pago / Recebido'
          : r.status === 'parcial'
          ? 'Parcialmente Pago'
          : r.status === 'cancelado'
          ? 'Cancelado'
          : 'Pendente';
      return [
        formatDatePt(r.due_date),
        formatDatePt(r.payment_date),
        r.type === 'receita' ? 'Receita' : 'Despesa',
        r.title,
        cat.label,
        r.subcategory || '—',
        r.site_name || 'Geral da Empresa',
        r.entity_name || '—',
        r.invoice_number || '—',
        roundCents(r.amount),
        paid,
        rem,
        statusLabel,
      ];
    });
    return {
      title: 'Extrato Financeiro Detalhado',
      subtitle: 'Histórico completo de entradas, saídas e liquidações',
      headers,
      rows,
    };
  }

  if (reportType === 'receitas_despesas') {
    const byMonth = new Map<
      string,
      {
        month: string;
        receitasPagas: number;
        receitasPendentes: number;
        despesasPagas: number;
        despesasPendentes: number;
      }
    >();

    records
      .filter((r) => r.status !== 'cancelado')
      .forEach((r) => {
        const refD = (r.payment_date || r.due_date || '').slice(0, 7);
        if (!refD) return;
        const curr = byMonth.get(refD) || {
          month: refD,
          receitasPagas: 0,
          receitasPendentes: 0,
          despesasPagas: 0,
          despesasPendentes: 0,
        };
        const paid = getEffectivePaidAmount(r);
        const rem = getEffectiveRemainingAmount(r);
        if (r.type === 'receita') {
          curr.receitasPagas = roundCents(curr.receitasPagas + paid);
          curr.receitasPendentes = roundCents(curr.receitasPendentes + rem);
        } else {
          curr.despesasPagas = roundCents(curr.despesasPagas + paid);
          curr.despesasPendentes = roundCents(curr.despesasPendentes + rem);
        }
        byMonth.set(refD, curr);
      });

    const sorted = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
    const headers = [
      'Competência (Mês)',
      'Receitas Recebidas (€)',
      'Receitas a Receber (€)',
      'Despesas Pagas (€)',
      'Despesas a Pagar (€)',
      'Saldo de Caixa Realizado (€)',
      'Saldo Projetado do Mês (€)',
    ];
    const rows = sorted.map((m) => {
      const saldoReal = roundCents(m.receitasPagas - m.despesasPagas);
      const saldoProj = roundCents(
        m.receitasPagas + m.receitasPendentes - (m.despesasPagas + m.despesasPendentes)
      );
      return [
        m.month,
        m.receitasPagas,
        m.receitasPendentes,
        m.despesasPagas,
        m.despesasPendentes,
        saldoReal,
        saldoProj,
      ];
    });
    return {
      title: 'Relatório Comparativo de Receitas e Despesas',
      subtitle: 'Evolução mensal de fluxos realizados e previstos',
      headers,
      rows,
    };
  }

  if (reportType === 'contas_pendentes') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const pending = records.filter(
      (r) => r.status !== 'cancelado' && getEffectiveRemainingAmount(r) > 0
    );
    const headers = [
      'Vencimento',
      'Situação',
      'Natureza',
      'Descrição',
      'Entidade',
      'Obra Associada',
      'Valor Original (€)',
      'Já Liquidado (€)',
      'Saldo em Aberto (€)',
    ];
    const rows = pending.map((r) => {
      const rem = getEffectiveRemainingAmount(r);
      const paid = getEffectivePaidAmount(r);
      const isOverdue = r.due_date && r.due_date < todayStr;
      return [
        formatDatePt(r.due_date),
        isOverdue ? 'VENCIDA / EM ATRASO' : 'Dentro do Prazo',
        r.type === 'receita' ? 'Conta a Receber' : 'Conta a Pagar',
        r.title,
        r.entity_name || '—',
        r.site_name || 'Geral da Empresa',
        roundCents(r.amount),
        paid,
        rem,
      ];
    });
    return {
      title: 'Relatório de Contas a Pagar e a Receber Pendentes',
      subtitle: 'Obrigações financeiras e recebimentos em aberto',
      headers,
      rows,
    };
  }

  if (reportType === 'rentabilidade_obras') {
    const headers = [
      'Obra',
      'Valor Contratado (€)',
      'Orçamento de Custos (€)',
      'Receitas Recebidas (€)',
      'Receitas Pendentes (€)',
      'Custos Realizados (€)',
      'Custos Comprometidos (€)',
      'Custos Previstos Restantes (€)',
      'Custo Total Estimado (€)',
      'Saldo de Caixa da Obra (€)',
      'Resultado Previsto (€)',
      'Margem Prevista (%)',
      'Orçamento Consumido (%)',
      'Situação Financeira',
    ];
    const healthLabelMap: Record<SiteProfitabilitySummary['financialHealth'], string> = {
      saudavel: 'Saudável (<80%)',
      atencao: 'Atenção (80-89%)',
      risco_elevado: 'Risco Elevado (90-99%)',
      atingido: 'Orçamento Atingido (100%)',
      ultrapassado: 'Orçamento Ultrapassado (>100%)',
    };
    const rows = sitesProfitability.map((sp) => [
      sp.site.name,
      sp.contractedValue,
      sp.costBudget,
      sp.receivedRevenue,
      sp.pendingRevenue,
      sp.realizedCosts,
      sp.committedCosts,
      sp.additionalForecastCosts,
      sp.estimatedTotalCost,
      sp.cashBalance,
      sp.forecastResult,
      `${sp.forecastMarginPct.toFixed(1)}%`,
      `${sp.budgetConsumedPct.toFixed(1)}%`,
      healthLabelMap[sp.financialHealth],
    ]);
    return {
      title: 'Relatório de Rentabilidade e Orçamento por Obra',
      subtitle: 'Análise de margem prevista, custos realizados, comprometidos e desvios',
      headers,
      rows,
    };
  }

  if (reportType === 'custos_categoria') {
    const expenses = records.filter((r) => r.type === 'despesa' && r.status !== 'cancelado');
    const totalPaidAll = expenses.reduce((s, r) => s + getEffectivePaidAmount(r), 0) || 1;

    const headers = [
      'Categoria de Custo',
      'Custos Pagos / Realizados (€)',
      'Custos Comprometidos / Pendentes (€)',
      'Custo Total da Categoria (€)',
      'Participação nos Custos Pagos (%)',
      'Qtd. Lançamentos',
    ];

    const rows = EXPENSE_CATEGORIES.map((cat) => {
      const catRecs = expenses.filter((r) => {
        if (cat.id === 'custo_materiais' && r.category === 'pagamento_fornecedor') return true;
        if (cat.id === 'outros_custos' && r.category === 'outros') return true;
        return r.category === cat.id;
      });
      const paid = roundCents(catRecs.reduce((s, r) => s + getEffectivePaidAmount(r), 0));
      const pending = roundCents(catRecs.reduce((s, r) => s + getEffectiveRemainingAmount(r), 0));
      const total = roundCents(paid + pending);
      const pct = roundCents((paid / totalPaidAll) * 100);
      return [cat.label, paid, pending, total, `${pct.toFixed(1)}%`, catRecs.length];
    });

    return {
      title: 'Relatório de Custos por Categoria',
      subtitle: 'Distribuição dos gastos da empresa e obras por natureza de despesa',
      headers,
      rows,
    };
  }

  // medicoes
  const headers = [
    'Nº Medição',
    'Obra',
    'Tipo',
    'Descrição dos Trabalhos',
    'Período de Execução',
    'Valor Medido (€)',
    'Valor Aprovado (€)',
    'Data Aprovação',
    'Retenção (€)',
    'Valor Faturado (€)',
    'Valor Recebido (€)',
    'Estado',
  ];
  const rows = measurements.map((m) => [
    `#${m.measurement_number}`,
    m.site_name || 'Obra',
    m.kind === 'adiantamento'
      ? 'Adiantamento'
      : m.kind === 'trabalho_adicional'
      ? 'Trabalho Adicional'
      : 'Medição Normal',
    m.description,
    `${formatDatePt(m.period_start)} a ${formatDatePt(m.period_end)}`,
    roundCents(m.measured_value),
    roundCents(m.approved_value),
    formatDatePt(m.approval_date),
    roundCents(m.retention_value),
    roundCents(m.invoiced_value),
    roundCents(m.received_value),
    m.status.replace('_', ' ').toUpperCase(),
  ]);

  return {
    title: 'Relatório de Medições e Faturação de Obras',
    subtitle: 'Autos de medição, valores aprovados, retenções e recebimentos',
    headers,
    rows,
  };
}

export function exportFinancialReport(
  reportType: FinancialReportType,
  format: ExportFormat,
  ctx: ReportContext
): void {
  const { title, subtitle, headers, rows } = buildReportTable(reportType, ctx);
  const generatedAt = new Date().toLocaleString('pt-PT');
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filenameBase = `castello_${reportType}_${dateSlug}`;

  if (format === 'csv') {
    const metaLines = [
      `${escapeCsvCell('Empresa:')};${escapeCsvCell(ctx.company.name)}`,
      `${escapeCsvCell('NIF:')};${escapeCsvCell(ctx.company.tax_id || 'N/D')}`,
      `${escapeCsvCell('Relatório:')};${escapeCsvCell(title)}`,
      `${escapeCsvCell('Período:')};${escapeCsvCell(ctx.periodLabel)}`,
      `${escapeCsvCell('Filtro de Obra:')};${escapeCsvCell(ctx.siteFilterLabel)}`,
      `${escapeCsvCell('Gerado em:')};${escapeCsvCell(generatedAt)}`,
      '',
    ];
    const headerLine = headers.map(escapeCsvCell).join(';');
    const bodyLines = rows.map((row) =>
      row
        .map((cell) =>
          typeof cell === 'number' ? cell.toFixed(2).replace('.', ',') : escapeCsvCell(cell)
        )
        .join(';')
    );
    const csvContent = '\uFEFF' + [...metaLines, headerLine, ...bodyLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (format === 'xlsx') {
    // Gera ficheiro SpreadsheetML XML nativo do Microsoft Excel (.xls / .xlsx compatível com formatação de colunas, moeda e cabeçalho corporativo)
    const xmlRows: string[] = [];

    const addMetaRow = (label: string, value: string) => {
      xmlRows.push(
        `<Row><Cell ss:StyleID="sMetaLabel"><Data ss:Type="String">${escapeXml(label)}</Data></Cell><Cell ss:StyleID="sMetaValue"><Data ss:Type="String">${escapeXml(value)}</Data></Cell></Row>`
      );
    };

    addMetaRow('Empresa:', `${ctx.company.name}${ctx.company.tax_id ? ` (NIF: ${ctx.company.tax_id})` : ''}`);
    addMetaRow('Relatório:', `${title} — ${subtitle}`);
    addMetaRow('Período / Obra:', `${ctx.periodLabel} | ${ctx.siteFilterLabel}`);
    addMetaRow('Data de Geração:', generatedAt);
    xmlRows.push('<Row></Row>');

    // Cabeçalho da Tabela
    const headerCells = headers
      .map(
        (h) =>
          `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`
      )
      .join('');
    xmlRows.push(`<Row ss:Height="24">${headerCells}</Row>`);

    // Linhas de Dados
    rows.forEach((r) => {
      const cells = r
        .map((cell) => {
          if (typeof cell === 'number') {
            return `<Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${cell.toFixed(2)}</Data></Cell>`;
          }
          return `<Cell ss:StyleID="sCell"><Data ss:Type="String">${escapeXml(String(cell))}</Data></Cell>`;
        })
        .join('');
      xmlRows.push(`<Row ss:Height="20">${cells}</Row>`);
    });

    const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="sMetaLabel">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E40AF"/>
  </Style>
  <Style ss:ID="sMetaValue">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#334155"/>
  </Style>
  <Style ss:ID="sHeader">
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="sCell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="sCurrency">
   <NumberFormat ss:Format="#,##0.00\ &quot;€&quot;"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(title.slice(0, 28))}">
  <Table>
   ${headers.map(() => '<Column ss:AutoFitWidth="1" ss:Width="135"/>').join('\n   ')}
   ${xmlRows.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([workbookXml], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Formato PDF (Janela de impressão formatada com cabeçalho corporativo da empresa)
  const printWindow = window.open('', '_blank', 'width=1080,height=800');
  if (!printWindow) {
    window.print();
    return;
  }

  const tableHeadersHtml = headers.map((h) => `<th>${escapeXml(h)}</th>`).join('');
  const tableRowsHtml =
    rows.length === 0
      ? `<tr><td colspan="${headers.length}" style="text-align:center;padding:24px;">Sem registos para os filtros selecionados.</td></tr>`
      : rows
          .map(
            (r) =>
              `<tr>${r
                .map((c) =>
                  typeof c === 'number'
                    ? `<td style="text-align:right;font-weight:600;">${formatEuro(c, true)}</td>`
                    : `<td>${escapeXml(String(c))}</td>`
                )
                .join('')}</tr>`
          )
          .join('');

  printWindow.document.write(`<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)} — ${escapeXml(ctx.company.name)}</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 28px; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 14px; margin-bottom: 18px; }
    .company-name { font-size: 20px; font-weight: 800; color: #1e3a8a; margin: 0; }
    .report-title { font-size: 16px; font-weight: 700; margin: 4px 0 2px; }
    .meta { font-size: 11px; color: #475569; text-align: right; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background-color: #1e3a8a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }
    td { padding: 7px 10px; border-bottom: 1px solid #cbd5e1; font-size: 11px; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="company-name">${escapeXml(ctx.company.name)}</p>
      <p class="report-title">${escapeXml(title)}</p>
      <div style="color:#64748b;font-size:11px;">${escapeXml(subtitle)}</div>
    </div>
    <div class="meta">
      <div><strong>NIF:</strong> ${escapeXml(ctx.company.tax_id || 'Não definido')}</div>
      <div><strong>Período:</strong> ${escapeXml(ctx.periodLabel)}</div>
      <div><strong>Âmbito:</strong> ${escapeXml(ctx.siteFilterLabel)}</div>
      <div><strong>Emitido em:</strong> ${escapeXml(generatedAt)}</div>
    </div>
  </div>
  <table>
    <thead><tr>${tableHeadersHtml}</tr></thead>
    <tbody>${tableRowsHtml}</tbody>
  </table>
  <div class="footer">
    <span>Castello — Sistema de Gestão de Obras e Construção Civil</span>
    <span>Valores expressos em Euros (€) • Localização pt-PT</span>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 250); };
  </script>
</body>
</html>`);
  printWindow.document.close();
}
