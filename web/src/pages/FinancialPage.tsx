import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Percent,
  Plus,
  Printer,
  Search,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  Company,
  ConstructionSite,
  FinancialCategory,
  FinancialRecord,
  FinancialStatus,
  FinancialType,
} from '../types';
import {
  deleteFinancialRecord,
  saveFinancialRecord,
  updateFinancialStatus,
} from '../lib/supabase';

interface FinancialPageProps {
  company: Company;
  sites: ConstructionSite[];
  records: FinancialRecord[];
  onRefresh: () => void;
  showNotice: (msg: string) => void;
}

const CATEGORY_LABELS: Record<FinancialCategory, { label: string; icon: any; color: string }> = {
  adiantamento_cliente: { label: 'Adiantamento de Cliente', icon: ArrowUpRight, color: '#16a34a' },
  receita_medicao: { label: 'Medição / Receita', icon: ArrowUpRight, color: '#2563eb' },
  pagamento_fornecedor: { label: 'Pagamento Fornecedor', icon: Truck, color: '#d97706' },
  custo_materiais: { label: 'Custo de Materiais', icon: Layers, color: '#dc2626' },
  custo_mao_de_obra: { label: 'Custo de Mão de Obra', icon: Users, color: '#7c3aed' },
  custo_equipamentos: { label: 'Custo de Equipamentos', icon: Wrench, color: '#ea580c' },
  custo_subempreitadas: { label: 'Custo de Subempreitadas', icon: Building2, color: '#0284c7' },
  outros: { label: 'Outras Operações', icon: DollarSign, color: '#64748b' },
};

export function FinancialPage({
  company,
  sites,
  records,
  onRefresh,
  showNotice,
}: FinancialPageProps) {
  // Filtros
  const [selectedSiteId, setSelectedSiteId] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState<'geral' | 'pagar' | 'receber' | 'rentabilidade' | 'fluxo'>('geral');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal de Adição / Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    type: FinancialType;
    category: FinancialCategory;
    title: string;
    site_id: string;
    entity_name: string;
    invoice_number: string;
    amount: string;
    due_date: string;
    payment_date: string;
    status: FinancialStatus;
    description: string;
  }>({
    type: 'despesa',
    category: 'custo_materiais',
    title: '',
    site_id: '',
    entity_name: '',
    invoice_number: '',
    amount: '',
    due_date: new Date().toISOString().slice(0, 10),
    payment_date: '',
    status: 'pendente',
    description: '',
  });

  // Filtra registros
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedSiteId !== 'todos' && r.site_id !== selectedSiteId) return false;

      if (activeTab === 'pagar') {
        if (r.type !== 'despesa' || r.status !== 'pendente') return false;
      } else if (activeTab === 'receber') {
        if (r.type !== 'receita' || r.status !== 'pendente') return false;
      }

      if (categoryFilter !== 'todas' && r.category !== categoryFilter) return false;

      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(lower);
        const matchEntity = (r.entity_name || '').toLowerCase().includes(lower);
        const matchInvoice = (r.invoice_number || '').toLowerCase().includes(lower);
        if (!matchTitle && !matchEntity && !matchInvoice) return false;
      }

      return true;
    });
  }, [records, selectedSiteId, activeTab, categoryFilter, searchTerm]);

  // CÁLCULO DOS INDICADORES FINANCEIROS
  const stats = useMemo(() => {
    // Escopo de obras para valor contratado e custo previsto
    const targetSites = selectedSiteId === 'todos' ? sites : sites.filter((s) => s.id === selectedSiteId);
    const targetRecords = selectedSiteId === 'todos' ? records : records.filter((r) => r.site_id === selectedSiteId);

    // 1. Valor Contratado (Orçamento das Obras)
    const valorContratado = targetSites.reduce((sum, s) => sum + (Number(s.budget) || 0), 0);

    // 2. Valor Recebido (Receitas já pagas/liquidadas)
    const valorRecebido = targetRecords
      .filter((r) => r.type === 'receita' && r.status === 'pago')
      .reduce((sum, r) => sum + r.amount, 0);

    // 3. Contas a Receber (Receitas pendentes)
    const contasAReceber = targetRecords
      .filter((r) => r.type === 'receita' && r.status === 'pendente')
      .reduce((sum, r) => sum + r.amount, 0);

    // 4. Custo Previsto (Estimado como ~80% do valor contratado ou soma de orçamentos)
    const custoPrevisto = valorContratado > 0 ? valorContratado * 0.78 : 0;

    // 5. Custo Realizado (Despesas já pagas)
    const custoRealizado = targetRecords
      .filter((r) => r.type === 'despesa' && r.status === 'pago')
      .reduce((sum, r) => sum + r.amount, 0);

    // 6. Compromissos ainda não pagos (Contas a Pagar pendentes)
    const compromissosNaoPagos = targetRecords
      .filter((r) => r.type === 'despesa' && r.status === 'pendente')
      .reduce((sum, r) => sum + r.amount, 0);

    // 7. Margens
    const margemPrevistaValor = valorContratado - custoPrevisto;
    const margemPrevistaPct = valorContratado > 0 ? (margemPrevistaValor / valorContratado) * 100 : 0;

    const margemRealizadaValor = valorRecebido - custoRealizado;
    const margemRealizadaPct = valorRecebido > 0 ? (margemRealizadaValor / valorRecebido) * 100 : 0;

    // Subcustos por categoria
    const custosMateriais = targetRecords
      .filter((r) => r.category === 'custo_materiais' && r.status === 'pago')
      .reduce((sum, r) => sum + r.amount, 0);

    const custosMaoDeObra = targetRecords
      .filter((r) => r.category === 'custo_mao_de_obra' && r.status === 'pago')
      .reduce((sum, r) => sum + r.amount, 0);

    const custosEquipamentos = targetRecords
      .filter((r) => r.category === 'custo_equipamentos' && r.status === 'pago')
      .reduce((sum, r) => sum + r.amount, 0);

    const custosSubempreitadas = targetRecords
      .filter((r) => r.category === 'custo_subempreitadas' && r.status === 'pago')
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      valorContratado,
      valorRecebido,
      contasAReceber,
      custoPrevisto,
      custoRealizado,
      compromissosNaoPagos,
      margemPrevistaValor,
      margemPrevistaPct,
      margemRealizadaValor,
      margemRealizadaPct,
      custosMateriais,
      custosMaoDeObra,
      custosEquipamentos,
      custosSubempreitadas,
    };
  }, [sites, records, selectedSiteId]);

  // CÁLCULO DE RENTABILIDADE POR OBRA
  const rentabilidadePorObra = useMemo(() => {
    return sites.map((site) => {
      const siteRecords = records.filter((r) => r.site_id === site.id);

      const recebido = siteRecords
        .filter((r) => r.type === 'receita' && r.status === 'pago')
        .reduce((sum, r) => sum + r.amount, 0);

      const aReceber = siteRecords
        .filter((r) => r.type === 'receita' && r.status === 'pendente')
        .reduce((sum, r) => sum + r.amount, 0);

      const realizado = siteRecords
        .filter((r) => r.type === 'despesa' && r.status === 'pago')
        .reduce((sum, r) => sum + r.amount, 0);

      const compromissos = siteRecords
        .filter((r) => r.type === 'despesa' && r.status === 'pendente')
        .reduce((sum, r) => sum + r.amount, 0);

      const lucroAtual = recebido - realizado;
      const margemAtual = recebido > 0 ? ((lucroAtual / recebido) * 100) : 0;
      const budget = Number(site.budget) || 0;
      const margemPrevista = budget > 0 ? 22 : 0; // Margem padrão estimada

      return {
        site,
        valorContratado: budget,
        valorRecebido: recebido,
        contasAReceber: aReceber,
        custoRealizado: realizado,
        compromissosNaoPagos: compromissos,
        lucroAtual,
        margemAtual,
        margemPrevista,
      };
    });
  }, [sites, records]);

  // FLUXO DE CAIXA MENSAL
  const fluxoMensal = useMemo(() => {
    const monthsMap: Record<string, { month: string; receitas: number; despesas: number }> = {};

    records.forEach((r) => {
      const dateStr = r.payment_date || r.due_date || r.created_at || '';
      const m = dateStr.slice(0, 7) || 'Outros';
      if (!monthsMap[m]) {
        monthsMap[m] = { month: m, receitas: 0, despesas: 0 };
      }
      if (r.type === 'receita' && r.status === 'pago') {
        monthsMap[m].receitas += r.amount;
      } else if (r.type === 'despesa' && r.status === 'pago') {
        monthsMap[m].despesas += r.amount;
      }
    });

    return Object.values(monthsMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [records]);

  // Formatação de valores em Euro
  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  };

  // Abrir Modal para Novo Registro
  const handleOpenNew = (defaultType: FinancialType = 'despesa') => {
    setEditingId(null);
    setForm({
      type: defaultType,
      category: defaultType === 'receita' ? 'adiantamento_cliente' : 'custo_materiais',
      title: '',
      site_id: selectedSiteId !== 'todos' ? selectedSiteId : (sites[0]?.id || ''),
      entity_name: '',
      invoice_number: '',
      amount: '',
      due_date: new Date().toISOString().slice(0, 10),
      payment_date: '',
      status: 'pendente',
      description: '',
    });
    setModalOpen(true);
  };

  // Abrir Modal para Edição
  const handleOpenEdit = (record: FinancialRecord) => {
    setEditingId(record.id);
    setForm({
      type: record.type,
      category: record.category,
      title: record.title,
      site_id: record.site_id || '',
      entity_name: record.entity_name || '',
      invoice_number: record.invoice_number || '',
      amount: String(record.amount),
      due_date: record.due_date,
      payment_date: record.payment_date || '',
      status: record.status,
      description: record.description || '',
    });
    setModalOpen(true);
  };

  // Salvar Registro
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert('Informe o título / descrição do lançamento.');
      return;
    }
    const val = parseFloat(form.amount);
    if (!val || val <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    const selectedSite = sites.find((s) => s.id === form.site_id);

    try {
      await saveFinancialRecord(
        {
          id: editingId || undefined,
          type: form.type,
          category: form.category,
          title: form.title.trim(),
          site_id: form.site_id || null,
          site_name: selectedSite ? selectedSite.name : null,
          entity_name: form.entity_name.trim() || null,
          invoice_number: form.invoice_number.trim() || null,
          amount: val,
          due_date: form.due_date,
          payment_date: form.status === 'pago' ? (form.payment_date || new Date().toISOString().slice(0, 10)) : null,
          status: form.status,
          description: form.description.trim() || null,
        },
        company.id
      );

      setModalOpen(false);
      onRefresh();
      showNotice(editingId ? 'Lançamento atualizado.' : 'Novo lançamento financeiro registrado.');
    } catch (err: any) {
      alert('Erro ao salvar registro: ' + (err.message || 'Tente novamente.'));
    }
  };

  // Alternar Status (Marcar Pago / Pendente)
  const handleToggleStatus = async (record: FinancialRecord) => {
    const nextStatus: FinancialStatus = record.status === 'pago' ? 'pendente' : 'pago';
    await updateFinancialStatus(record.id, nextStatus, undefined, company.id);
    onRefresh();
    showNotice(nextStatus === 'pago' ? 'Marcado como Liquidado / Pago.' : 'Marcado como Pendente.');
  };

  // Excluir
  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente remover este lançamento financeiro?')) {
      await deleteFinancialRecord(id, company.id);
      onRefresh();
      showNotice('Lançamento removido.');
    }
  };

  // EXPORTAÇÃO CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Data Vencimento',
      'Data Pagamento',
      'Tipo',
      'Categoria',
      'Título',
      'Obra',
      'Entidade / Fornecedor / Cliente',
      'Nº Fatura',
      'Valor (€)',
      'Status',
    ];

    const rows = filteredRecords.map((r) => [
      r.id,
      r.due_date,
      r.payment_date || '',
      r.type.toUpperCase(),
      CATEGORY_LABELS[r.category]?.label || r.category,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${(r.site_name || sites.find((s) => s.id === r.site_id)?.name || 'Geral').replace(/"/g, '""')}"`,
      `"${(r.entity_name || '').replace(/"/g, '""')}"`,
      `"${(r.invoice_number || '').replace(/"/g, '""')}"`,
      r.amount.toFixed(2),
      r.status.toUpperCase(),
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `castello_financeiro_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotice('Exportação CSV gerada com sucesso.');
  };

  // EXPORTAÇÃO EXCEL
  const handleExportExcel = () => {
    // Gera HTML compatível com MS Excel
    const siteLabel = selectedSiteId === 'todos' ? 'Todas as Obras' : (sites.find((s) => s.id === selectedSiteId)?.name || '');
    let tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          th { background-color: #2563EB; color: #FFFFFF; font-weight: bold; border: 1px solid #CCCCCC; padding: 6px; }
          td { border: 1px solid #DDDDDD; padding: 5px; }
          .money { mso-number-format:"\\0022€\\0022\\ #\\,##0\\.00"; text-align: right; }
          .header-box { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header-box">CASTELLO - Relatório de Gestão Financeira (${company.name})</div>
        <div>Filtro: ${siteLabel} | Data: ${new Date().toLocaleDateString('pt-PT')}</div>
        <br/>
        <table border="1">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Pagamento</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Título / Descrição</th>
              <th>Obra</th>
              <th>Cliente / Fornecedor</th>
              <th>Nº Fatura</th>
              <th>Valor (€)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRecords
              .map(
                (r) => `
              <tr>
                <td>${r.due_date}</td>
                <td>${r.payment_date || '-'}</td>
                <td>${r.type === 'receita' ? 'RECEITA' : 'DESPESA'}</td>
                <td>${CATEGORY_LABELS[r.category]?.label || r.category}</td>
                <td>${r.title}</td>
                <td>${r.site_name || sites.find((s) => s.id === r.site_id)?.name || 'Geral'}</td>
                <td>${r.entity_name || '-'}</td>
                <td>${r.invoice_number || '-'}</td>
                <td class="money">${r.amount.toFixed(2)}</td>
                <td>${r.status === 'pago' ? 'LIQUIDADO' : 'PENDENTE'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `castello_financeiro_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotice('Exportação Excel gerada com sucesso.');
  };

  // IMPRIMIR / PDF
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div style={{ width: '100%' }}>
      {/* CABEÇALHO */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Gestão Financeira de Obras</h1>
          <p className="view-description">
            Controle de receitas, despesas, contas a pagar/receber, fornecedores e rentabilidade por empreitada.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn-flat-secondary"
            onClick={handleExportCSV}
            title="Exportar dados para CSV"
            style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} />
            CSV
          </button>
          <button
            className="btn-flat-secondary"
            onClick={handleExportExcel}
            title="Exportar para Microsoft Excel"
            style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <FileSpreadsheet size={15} />
            Excel
          </button>
          <button
            className="btn-flat-secondary"
            onClick={handlePrintPDF}
            title="Imprimir relatório executivo em PDF"
            style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} />
            PDF / Imprimir
          </button>
          <button
            className="btn-flat-primary"
            onClick={() => handleOpenNew('despesa')}
            style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* BARRA DE FILTRO POR OBRA E BUSCA */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          marginBottom: 20,
          padding: '12px 16px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <Building2 size={16} color="var(--primary)" />
            <span>Obra:</span>
          </div>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              fontSize: 13,
              fontWeight: 500,
              minWidth: 200,
            }}
          >
            <option value="todos">Todas as Obras da Firma</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            <Filter size={15} color="var(--text-muted)" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: 13,
              }}
            >
              <option value="todas">Todas as Categorias</option>
              <option value="adiantamento_cliente">Adiantamentos de Clientes</option>
              <option value="receita_medicao">Medições / Faturas</option>
              <option value="custo_materiais">Custos de Materiais</option>
              <option value="custo_mao_de_obra">Custos de Mão de Obra</option>
              <option value="custo_equipamentos">Custos de Equipamentos</option>
              <option value="custo_subempreitadas">Custos de Subempreitadas</option>
              <option value="pagamento_fornecedor">Pagamentos a Fornecedores</option>
              <option value="outros">Outros</option>
            </select>
          </div>
        </div>

        <div style={{ minWidth: 220, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar lançamento, fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* GRID DE INDICADORES PRINCIPAIS (KPIS) */}
      <div className="kpi-row" style={{ marginBottom: 24 }}>
        {/* 1. Valor Contratado */}
        <div className="kpi-box">
          <div className="kpi-label">Valor Contratado (Obras)</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            {formatMoney(stats.valorContratado)}
          </div>
          <div className="kpi-foot">
            {selectedSiteId === 'todos' ? `${sites.length} obras cadastradas` : 'Valor orçado da empreitada'}
          </div>
        </div>

        {/* 2. Valor Recebido */}
        <div className="kpi-box">
          <div className="kpi-label">Valor Recebido (Liquidado)</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            {formatMoney(stats.valorRecebido)}
          </div>
          <div className="kpi-foot" style={{ color: 'var(--warning)' }}>
            + {formatMoney(stats.contasAReceber)} a receber
          </div>
        </div>

        {/* 3. Custo Realizado */}
        <div className="kpi-box">
          <div className="kpi-label">Custo Realizado (Pago)</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>
            {formatMoney(stats.custoRealizado)}
          </div>
          <div className="kpi-foot">
            Previsto Total: {formatMoney(stats.custoPrevisto)}
          </div>
        </div>

        {/* 4. Compromissos a Pagar */}
        <div className="kpi-box">
          <div className="kpi-label">Compromissos Não Pagos</div>
          <div className="kpi-value" style={{ color: 'var(--warning)' }}>
            {formatMoney(stats.compromissosNaoPagos)}
          </div>
          <div className="kpi-foot">
            Contas a pagar pendentes
          </div>
        </div>

        {/* 5. Margem Realizada */}
        <div className="kpi-box">
          <div className="kpi-label">Margem Realizada</div>
          <div
            className="kpi-value"
            style={{ color: stats.margemRealizadaValor >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {stats.margemRealizadaPct.toFixed(1)}%
          </div>
          <div className="kpi-foot">
            Saldo Líquido: {formatMoney(stats.margemRealizadaValor)}
          </div>
        </div>

        {/* 6. Margem Prevista */}
        <div className="kpi-box">
          <div className="kpi-label">Margem Prevista (Contrato)</div>
          <div className="kpi-value" style={{ color: 'var(--text-main)' }}>
            {stats.margemPrevistaPct.toFixed(1)}%
          </div>
          <div className="kpi-foot">
            Resultado Alvo: {formatMoney(stats.margemPrevistaValor)}
          </div>
        </div>
      </div>

      {/* DISCRIMINAÇÃO DE CUSTOS DE OBRA */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #dc2626',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOS DE MATERIAIS</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{formatMoney(stats.custosMateriais)}</div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #7c3aed',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOS DE MÃO DE OBRA</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{formatMoney(stats.custosMaoDeObra)}</div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #ea580c',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOS DE EQUIPAMENTOS</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{formatMoney(stats.custosEquipamentos)}</div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            borderLeft: '4px solid #0284c7',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOS SUBEMPREITADAS</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{formatMoney(stats.custosSubempreitadas)}</div>
        </div>
      </div>

      {/* ABAS OPERACIONAIS */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          gap: 4,
          marginBottom: 20,
          overflowX: 'auto',
        }}
      >
        <button
          className={`nav-item ${activeTab === 'geral' ? 'active' : ''}`}
          style={{ padding: '8px 16px', borderRadius: '6px 6px 0 0', width: 'auto' }}
          onClick={() => setActiveTab('geral')}
        >
          Todos os Lançamentos ({filteredRecords.length})
        </button>

        <button
          className={`nav-item ${activeTab === 'pagar' ? 'active' : ''}`}
          style={{ padding: '8px 16px', borderRadius: '6px 6px 0 0', width: 'auto' }}
          onClick={() => setActiveTab('pagar')}
        >
          Contas a Pagar
        </button>

        <button
          className={`nav-item ${activeTab === 'receber' ? 'active' : ''}`}
          style={{ padding: '8px 16px', borderRadius: '6px 6px 0 0', width: 'auto' }}
          onClick={() => setActiveTab('receber')}
        >
          Contas a Receber
        </button>

        <button
          className={`nav-item ${activeTab === 'rentabilidade' ? 'active' : ''}`}
          style={{ padding: '8px 16px', borderRadius: '6px 6px 0 0', width: 'auto' }}
          onClick={() => setActiveTab('rentabilidade')}
        >
          Rentabilidade por Obra
        </button>

        <button
          className={`nav-item ${activeTab === 'fluxo' ? 'active' : ''}`}
          style={{ padding: '8px 16px', borderRadius: '6px 6px 0 0', width: 'auto' }}
          onClick={() => setActiveTab('fluxo')}
        >
          Fluxo de Caixa
        </button>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}

      {/* 1. ABA DE RENTABILIDADE POR OBRA */}
      {activeTab === 'rentabilidade' && (
        <div className="panel-box">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <h2 className="panel-title" style={{ fontSize: 16 }}>
              Demonstrativo de Rentabilidade por Obra
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="flat-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Obra / Localização</th>
                  <th>Cliente</th>
                  <th style={{ textAlign: 'right' }}>Valor Contratado</th>
                  <th style={{ textAlign: 'right' }}>Recebido</th>
                  <th style={{ textAlign: 'right' }}>Custo Realizado</th>
                  <th style={{ textAlign: 'right' }}>Compromissos a Pagar</th>
                  <th style={{ textAlign: 'right' }}>Resultado Atual</th>
                  <th style={{ textAlign: 'right' }}>Margem Atual</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rentabilidadePorObra.map((item) => (
                  <tr key={item.site.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.site.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.site.address}</div>
                    </td>
                    <td>{item.site.client_name || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.valorContratado)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                      {formatMoney(item.valorRecebido)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)' }}>
                      {formatMoney(item.custoRealizado)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--warning)' }}>
                      {formatMoney(item.compromissosNaoPagos)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: item.lucroAtual >= 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {formatMoney(item.lucroAtual)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {item.margemAtual.toFixed(1)}%
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                          backgroundColor:
                            item.site.status === 'ativa'
                              ? 'var(--success-subtle)'
                              : item.site.status === 'pausada'
                              ? 'var(--warning-subtle)'
                              : 'var(--bg-card-subtle)',
                          color:
                            item.site.status === 'ativa'
                              ? 'var(--success)'
                              : item.site.status === 'pausada'
                              ? 'var(--warning)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {item.site.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. ABA FLUXO DE CAIXA */}
      {activeTab === 'fluxo' && (
        <div className="panel-box">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <h2 className="panel-title" style={{ fontSize: 16 }}>
              Demonstrativo Mensal de Fluxo de Caixa (Realizado)
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fluxoMensal.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhum movimento realizado encontrado para o período.
              </div>
            ) : (
              fluxoMensal.map((f) => {
                const saldo = f.receitas - f.despesas;
                const totalMovimento = f.receitas + f.despesas;
                const recPct = totalMovimento > 0 ? (f.receitas / totalMovimento) * 100 : 50;

                return (
                  <div
                    key={f.month}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Mês: {f.month}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13, fontWeight: 600 }}>
                        <span style={{ color: 'var(--success)' }}>Receitas: +{formatMoney(f.receitas)}</span>
                        <span style={{ color: 'var(--danger)' }}>Despesas: -{formatMoney(f.despesas)}</span>
                        <span
                          style={{
                            color: saldo >= 0 ? 'var(--success)' : 'var(--danger)',
                            borderLeft: '1px solid var(--border-color)',
                            paddingLeft: 12,
                          }}
                        >
                          Saldo Líquido: {formatMoney(saldo)}
                        </span>
                      </div>
                    </div>

                    {/* Barra comparativa de volume */}
                    <div
                      style={{
                        height: 10,
                        width: '100%',
                        backgroundColor: '#dc2626',
                        borderRadius: 5,
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div style={{ width: `${recPct}%`, backgroundColor: '#16a34a', height: '100%' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. ABA TABELA DE LANÇAMENTOS (GERAL / CONTAS A PAGAR / CONTAS A RECEBER) */}
      {(activeTab === 'geral' || activeTab === 'pagar' || activeTab === 'receber') && (
        <div className="panel-box">
          <div className="panel-header" style={{ marginBottom: 16 }}>
            <h2 className="panel-title" style={{ fontSize: 16 }}>
              {activeTab === 'pagar'
                ? 'Contas a Pagar (Pendentes)'
                : activeTab === 'receber'
                ? 'Contas a Receber (Pendentes)'
                : 'Lançamentos Financeiros'}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Mostrando {filteredRecords.length} lançamentos
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum lançamento encontrado para os filtros selecionados.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="flat-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo / Categoria</th>
                    <th>Título / Descrição</th>
                    <th>Obra</th>
                    <th>Cliente / Fornecedor</th>
                    <th>Fatura</th>
                    <th style={{ textAlign: 'right' }}>Valor (€)</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => {
                    const catInfo = CATEGORY_LABELS[r.category] || CATEGORY_LABELS.outros;
                    const IconComp = catInfo.icon;
                    const isReceita = r.type === 'receita';

                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                          <div>{r.due_date}</div>
                          {r.payment_date && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              Pago: {r.payment_date}
                            </div>
                          )}
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontWeight: 600,
                              backgroundColor: `${catInfo.color}15`,
                              color: catInfo.color,
                            }}
                          >
                            <IconComp size={13} />
                            {catInfo.label}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
                          {r.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.description}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {r.site_name || sites.find((s) => s.id === r.site_id)?.name || (
                            <span style={{ color: 'var(--text-muted)' }}>Geral</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>{r.entity_name || '-'}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.invoice_number || '-'}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isReceita ? 'var(--success)' : 'var(--danger)',
                            fontSize: 13,
                          }}
                        >
                          {isReceita ? '+' : '-'} {formatMoney(r.amount)}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(r)}
                            title="Clique para alternar status"
                            style={{
                              border: 'none',
                              background: r.status === 'pago' ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                              color: r.status === 'pago' ? 'var(--success)' : 'var(--warning)',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '4px 8px',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          >
                            {r.status === 'pago' ? 'LIQUIDADO' : 'PENDENTE'}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn-flat-secondary"
                              style={{ padding: '4px 6px' }}
                              onClick={() => handleOpenEdit(r)}
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-flat-secondary"
                              style={{ padding: '4px 6px', color: 'var(--danger)' }}
                              onClick={() => handleDelete(r.id)}
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {modalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 540 }}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                {editingId ? 'Editar Lançamento Financeiro' : 'Novo Lançamento Financeiro'}
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{ padding: 4 }}
                onClick={() => setModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="flat-form-grid" style={{ marginBottom: 20 }}>
                {/* Tipo de Movimento */}
                <div className="flat-form-group">
                  <label>Tipo de Transação *</label>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const t = e.target.value as FinancialType;
                      setForm({
                        ...form,
                        type: t,
                        category: t === 'receita' ? 'receita_medicao' : 'custo_materiais',
                      });
                    }}
                  >
                    <option value="despesa">Despesa (Saída / Custo)</option>
                    <option value="receita">Receita (Entrada / Faturamento)</option>
                  </select>
                </div>

                {/* Categoria */}
                <div className="flat-form-group">
                  <label>Categoria de Obra *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as FinancialCategory })}
                  >
                    {form.type === 'receita' ? (
                      <>
                        <option value="adiantamento_cliente">Adiantamento de Cliente</option>
                        <option value="receita_medicao">Medição / Receita Contratual</option>
                        <option value="outros">Outras Receitas</option>
                      </>
                    ) : (
                      <>
                        <option value="custo_materiais">Custo de Materiais (Betão, Aço, etc.)</option>
                        <option value="custo_mao_de_obra">Custo de Mão de Obra / Salários</option>
                        <option value="custo_equipamentos">Custo de Equipamentos / Máquinas</option>
                        <option value="custo_subempreitadas">Custo de Subempreitadas</option>
                        <option value="pagamento_fornecedor">Pagamento a Fornecedores</option>
                        <option value="outros">Outras Despesas</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Obra Associada */}
                <div className="flat-form-group full">
                  <label>Obra Associada</label>
                  <select
                    value={form.site_id}
                    onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                  >
                    <option value="">Geral da Empresa (Sem obra específica)</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.address})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Título */}
                <div className="flat-form-group full">
                  <label>Título / Descrição Curta *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fornecimento de Betão Pronto B25 - Laje 1"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                {/* Fornecedor / Cliente */}
                <div className="flat-form-group">
                  <label>{form.type === 'receita' ? 'Cliente / Pagador' : 'Fornecedor / Beneficiário'}</label>
                  <input
                    type="text"
                    placeholder={form.type === 'receita' ? 'Ex: Família Moreira' : 'Ex: Cimpor Betões'}
                    value={form.entity_name}
                    onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                  />
                </div>

                {/* Nº da Fatura */}
                <div className="flat-form-group">
                  <label>Nº Fatura / Recibo</label>
                  <input
                    type="text"
                    placeholder="Ex: FAT-2026/891"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                  />
                </div>

                {/* Valor */}
                <div className="flat-form-group">
                  <label>Valor em Euro (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>

                {/* Data de Vencimento */}
                <div className="flat-form-group">
                  <label>Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>

                {/* Status */}
                <div className="flat-form-group">
                  <label>Status de Liquidação</label>
                  <select
                    value={form.status}
                    onChange={(e) => {
                      const st = e.target.value as FinancialStatus;
                      setForm({
                        ...form,
                        status: st,
                        payment_date: st === 'pago' ? (form.payment_date || new Date().toISOString().slice(0, 10)) : '',
                      });
                    }}
                  >
                    <option value="pendente">Pendente (A Pagar / A Receber)</option>
                    <option value="pago">Liquidado (Pago / Recebido)</option>
                  </select>
                </div>

                {/* Data de Pagamento se liquidado */}
                {form.status === 'pago' && (
                  <div className="flat-form-group">
                    <label>Data Efetiva de Pagamento</label>
                    <input
                      type="date"
                      value={form.payment_date}
                      onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                    />
                  </div>
                )}

                {/* Observações */}
                <div className="flat-form-group full">
                  <label>Observações Adicionais</label>
                  <textarea
                    rows={2}
                    placeholder="Detalhes sobre medição, condições de entrega ou forma de pagamento..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="flat-modal-actions">
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary">
                  {editingId ? 'Gravar Alterações' : 'Criar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
