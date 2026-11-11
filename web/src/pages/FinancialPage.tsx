import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit2,
  FileSpreadsheet,
  Filter,
  Layers,
  PieChart,
  Plus,
  Printer,
  Search,
  Trash2,
  TrendingDown,
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

const CATEGORY_MAP: Record<FinancialCategory, { label: string; icon: any; color: string }> = {
  adiantamento_cliente: { label: 'Adiantamento de Cliente', icon: ArrowUpCircle, color: '#16a34a' },
  receita_medicao: { label: 'Medição de Obra', icon: ArrowUpCircle, color: '#2563eb' },
  pagamento_fornecedor: { label: 'Fornecedor', icon: Truck, color: '#d97706' },
  custo_materiais: { label: 'Materiais (Cimento, Aço...)', icon: Layers, color: '#dc2626' },
  custo_mao_de_obra: { label: 'Mão de Obra (Trabalhadores)', icon: Users, color: '#7c3aed' },
  custo_equipamentos: { label: 'Máquinas e Equipamentos', icon: Wrench, color: '#ea580c' },
  custo_subempreitadas: { label: 'Subempreiteiros', icon: Building2, color: '#0284c7' },
  outros: { label: 'Outros Custos', icon: DollarSign, color: '#64748b' },
};

export function FinancialPage({
  company,
  sites,
  records,
  onRefresh,
  showNotice,
}: FinancialPageProps) {
  // Filtros fáceis
  const [selectedSiteId, setSelectedSiteId] = useState<string>('todos');
  const [activeView, setActiveView] = useState<'extrato' | 'pendentes' | 'obras'>('extrato');
  const [filterType, setFilterType] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [search, setSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);

  const [formType, setFormType] = useState<FinancialType>('despesa');
  const [formCategory, setFormCategory] = useState<FinancialCategory>('custo_materiais');
  const [formTitle, setFormTitle] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formEntity, setFormEntity] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [formPaid, setFormPaid] = useState(false);
  const [formNotes, setFormNotes] = useState('');

  // Formatação em Euro amigável
  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  };

  const formatMoneyDetailed = (val: number) => {
    return val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  };

  // Filtragem dos registros
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedSiteId !== 'todos' && r.site_id !== selectedSiteId) return false;
      if (activeView === 'pendentes' && r.status !== 'pendente') return false;
      if (filterType !== 'todos' && r.type !== filterType) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchEntity = (r.entity_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchEntity) return false;
      }
      return true;
    });
  }, [records, selectedSiteId, activeView, filterType, search]);

  // CÁLCULOS GERAIS DIDÁTICOS
  const stats = useMemo(() => {
    const target = selectedSiteId === 'todos' ? records : records.filter((r) => r.site_id === selectedSiteId);

    // Entradas pagas (receitas já no caixa)
    const totalEntrou = target
      .filter((r) => r.type === 'receita' && r.status === 'pago')
      .reduce((s, r) => s + r.amount, 0);

    // Entradas a receber
    const totalAReceber = target
      .filter((r) => r.type === 'receita' && r.status === 'pendente')
      .reduce((s, r) => s + r.amount, 0);

    // Saídas pagas (gastos efetuados)
    const totalSaiu = target
      .filter((r) => r.type === 'despesa' && r.status === 'pago')
      .reduce((s, r) => s + r.amount, 0);

    // Saídas a pagar (contas pendentes)
    const totalAPagar = target
      .filter((r) => r.type === 'despesa' && r.status === 'pendente')
      .reduce((s, r) => s + r.amount, 0);

    // Saldo no bolso (Lucro líquido atual)
    const saldoLiquido = totalEntrou - totalSaiu;
    const margemPct = totalEntrou > 0 ? (saldoLiquido / totalEntrou) * 100 : 0;

    // Custos separados por categoria
    const materiais = target
      .filter((r) => r.category === 'custo_materiais' && r.status === 'pago')
      .reduce((s, r) => s + r.amount, 0);

    const maoDeObra = target
      .filter((r) => r.category === 'custo_mao_de_obra' && r.status === 'pago')
      .reduce((s, r) => s + r.amount, 0);

    const equipamentos = target
      .filter((r) => r.category === 'custo_equipamentos' && r.status === 'pago')
      .reduce((s, r) => s + r.amount, 0);

    const subempreiteiros = target
      .filter((r) => r.category === 'custo_subempreitadas' && r.status === 'pago')
      .reduce((s, r) => s + r.amount, 0);

    const outrosCustos = target
      .filter((r) => (r.category === 'outros' || r.category === 'pagamento_fornecedor') && r.status === 'pago')
      .reduce((s, r) => s + r.amount, 0);

    const somaCustos = materiais + maoDeObra + equipamentos + subempreiteiros + outrosCustos || 1;

    return {
      totalEntrou,
      totalAReceber,
      totalSaiu,
      totalAPagar,
      saldoLiquido,
      margemPct,
      materiais,
      maoDeObra,
      equipamentos,
      subempreiteiros,
      outrosCustos,
      somaCustos,
    };
  }, [records, selectedSiteId]);

  // DADOS PARA O GRÁFICO DE BARRAS MENSAL (ENTROU vs SAIU)
  const chartMonthly = useMemo(() => {
    const map: Record<string, { month: string; label: string; entrou: number; saiu: number }> = {};
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    records.forEach((r) => {
      const d = r.payment_date || r.due_date || '';
      if (!d) return;
      const key = d.slice(0, 7); // YYYY-MM
      if (!map[key]) {
        const [year, monthNum] = key.split('-');
        const idx = parseInt(monthNum, 10) - 1;
        map[key] = {
          month: key,
          label: `${monthsNames[idx] || monthNum}/${year?.slice(2)}`,
          entrou: 0,
          saiu: 0,
        };
      }
      if (r.type === 'receita' && r.status === 'pago') {
        map[key].entrou += r.amount;
      } else if (r.type === 'despesa' && r.status === 'pago') {
        map[key].saiu += r.amount;
      }
    });

    const list = Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
    const recent = list.slice(-5); // Últimos 5 meses

    // Achar o maior valor para calibrar a altura das barras (max 100%)
    const maxVal = Math.max(...recent.map((m) => Math.max(m.entrou, m.saiu)), 1000);

    return { items: recent, maxVal };
  }, [records]);

  // DADOS PARA O COMPARATIVO POR OBRA
  const sitesSummary = useMemo(() => {
    return sites.map((site) => {
      const siteRecs = records.filter((r) => r.site_id === site.id);
      const orcamento = Number(site.budget) || 0;

      const entrou = siteRecs
        .filter((r) => r.type === 'receita' && r.status === 'pago')
        .reduce((s, r) => s + r.amount, 0);

      const gastou = siteRecs
        .filter((r) => r.type === 'despesa' && r.status === 'pago')
        .reduce((s, r) => s + r.amount, 0);

      const aPagar = siteRecs
        .filter((r) => r.type === 'despesa' && r.status === 'pendente')
        .reduce((s, r) => s + r.amount, 0);

      const saldo = entrou - gastou;
      const percentualGasto = orcamento > 0 ? Math.min(Math.round((gastou / orcamento) * 100), 100) : 0;

      return {
        site,
        orcamento,
        entrou,
        gastou,
        aPagar,
        saldo,
        percentualGasto,
      };
    });
  }, [sites, records]);

  // ABRIR MODAL
  const handleOpenAdd = (type: FinancialType = 'despesa') => {
    setEditingRecord(null);
    setFormType(type);
    setFormCategory(type === 'receita' ? 'adiantamento_cliente' : 'custo_materiais');
    setFormTitle('');
    setFormSiteId(selectedSiteId !== 'todos' ? selectedSiteId : (sites[0]?.id || ''));
    setFormEntity('');
    setFormAmount('');
    setFormDueDate(new Date().toISOString().slice(0, 10));
    setFormPaid(false);
    setFormNotes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (rec: FinancialRecord) => {
    setEditingRecord(rec);
    setFormType(rec.type);
    setFormCategory(rec.category);
    setFormTitle(rec.title);
    setFormSiteId(rec.site_id || '');
    setFormEntity(rec.entity_name || '');
    setFormAmount(String(rec.amount));
    setFormDueDate(rec.due_date);
    setFormPaid(rec.status === 'pago');
    setFormNotes(rec.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Digite o que é este valor (ex: Compra de Cimento).');
      return;
    }
    const val = parseFloat(formAmount);
    if (!val || val <= 0) {
      alert('Digite um valor maior que zero.');
      return;
    }

    const matchedSite = sites.find((s) => s.id === formSiteId);
    const nowIso = new Date().toISOString().slice(0, 10);

    try {
      await saveFinancialRecord(
        {
          id: editingRecord ? editingRecord.id : undefined,
          type: formType,
          category: formCategory,
          title: formTitle.trim(),
          site_id: formSiteId || null,
          site_name: matchedSite ? matchedSite.name : null,
          entity_name: formEntity.trim() || null,
          amount: val,
          due_date: formDueDate,
          status: formPaid ? 'pago' : 'pendente',
          payment_date: formPaid ? nowIso : null,
          description: formNotes.trim() || null,
        },
        company.id
      );

      setModalOpen(false);
      onRefresh();
      showNotice(formType === 'receita' ? 'Receita registrada!' : 'Gasto registrado!');
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    }
  };

  const handleToggleStatus = async (rec: FinancialRecord) => {
    const nextStatus: FinancialStatus = rec.status === 'pago' ? 'pendente' : 'pago';
    await updateFinancialStatus(rec.id, nextStatus, undefined, company.id);
    onRefresh();
    showNotice(nextStatus === 'pago' ? 'Conta marcada como PAGA!' : 'Conta marcada como PENDENTE.');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja apagar este registro financeiro?')) {
      await deleteFinancialRecord(id, company.id);
      onRefresh();
      showNotice('Registro removido.');
    }
  };

  // EXPORTAÇÃO EXCEL / CSV SIMPLES
  const handleExportExcel = () => {
    let csv = '\uFEFFData;Tipo;O que é;Obra;Pessoa ou Fornecedor;Valor (€);Status\n';
    filteredRecords.forEach((r) => {
      csv += `${r.due_date};${r.type === 'receita' ? 'ENTRADA' : 'SAIDA'};"${r.title}";"${r.site_name || 'Geral'}";"${r.entity_name || ''}";${r.amount.toFixed(2)};${r.status === 'pago' ? 'PAGO' : 'PENDENTE'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro_obras_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showNotice('Planilha baixada com sucesso!');
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* CABEÇALHO CLARO E LIMPO */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: -0.5 }}>
            Controle de Dinheiro & Obras
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
            Acompanhe com facilidade o que entra, o que sai e o lucro das suas obras.
          </p>
        </div>

        {/* Botões Grandes de Ação */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-flat-secondary"
            onClick={handleExportExcel}
            title="Baixar planilha para Excel"
            style={{ fontSize: 13, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <FileSpreadsheet size={16} />
            Baixar Excel
          </button>

          <button
            type="button"
            className="btn-flat-secondary"
            onClick={() => window.print()}
            title="Imprimir ou Salvar em PDF"
            style={{ fontSize: 13, padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={16} />
            Imprimir / PDF
          </button>

          <button
            type="button"
            className="btn-flat-primary"
            onClick={() => handleOpenAdd('despesa')}
            style={{
              fontSize: 14,
              fontWeight: 700,
              padding: '10px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'var(--primary)',
            }}
          >
            <Plus size={18} />
            Novo Registro de Dinheiro
          </button>
        </div>
      </div>

      {/* SELETOR GRANDE DE OBRA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 18px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 10,
          border: '1px solid var(--border-color)',
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
          <Building2 size={18} color="var(--primary)" />
          <span>Mostrando valores de:</span>
        </div>

        <select
          value={selectedSiteId}
          onChange={(e) => setSelectedSiteId(e.target.value)}
          style={{
            fontSize: 14,
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: 6,
            border: '2px solid var(--primary)',
            backgroundColor: 'var(--bg-card-subtle)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            minWidth: 240,
          }}
        >
          <option value="todos">Todas as Obras (Visão Geral da Firma)</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              Obra: {s.name}
            </option>
          ))}
        </select>

        {selectedSiteId !== 'todos' && (
          <button
            className="btn-flat-secondary"
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={() => setSelectedSiteId('todos')}
          >
            Ver Todas
          </button>
        )}
      </div>

      {/* 4 GRANDES CARDS COLORIDOS E INTUITIVOS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {/* Card 1: Entrou */}
        <div
          style={{
            padding: '20px 18px',
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderTop: '5px solid #16a34a',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 700, fontSize: 13 }}>
            <ArrowUpCircle size={20} />
            <span>DINHEIRO QUE ENTROU</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 8 }}>
            {formatMoney(stats.totalEntrou)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {stats.totalAReceber > 0 ? (
              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                + {formatMoney(stats.totalAReceber)} a receber
              </span>
            ) : (
              'Recebimentos já recebidos'
            )}
          </div>
        </div>

        {/* Card 2: Saiu */}
        <div
          style={{
            padding: '20px 18px',
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderTop: '5px solid #dc2626',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontWeight: 700, fontSize: 13 }}>
            <ArrowDownCircle size={20} />
            <span>DINHEIRO QUE SAIU (PAGO)</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', marginTop: 8 }}>
            {formatMoney(stats.totalSaiu)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Gastos já pagos (materiais, mão de obra...)
          </div>
        </div>

        {/* Card 3: Lucro no Bolso */}
        <div
          style={{
            padding: '20px 18px',
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderTop: `5px solid ${stats.saldoLiquido >= 0 ? '#2563eb' : '#dc2626'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: stats.saldoLiquido >= 0 ? '#2563eb' : '#dc2626',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <TrendingUp size={20} />
            <span>SOBRA / LUCRO ATUAL</span>
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: stats.saldoLiquido >= 0 ? '#2563eb' : '#dc2626',
              marginTop: 8,
            }}
          >
            {formatMoney(stats.saldoLiquido)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {stats.saldoLiquido >= 0
              ? `Sobrou ${stats.margemPct.toFixed(0)}% do que foi recebido`
              : 'Gastos maiores que recebimentos'}
          </div>
        </div>

        {/* Card 4: Contas a Pagar */}
        <div
          style={{
            padding: '20px 18px',
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderTop: '5px solid #d97706',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706', fontWeight: 700, fontSize: 13 }}>
            <Clock size={20} />
            <span>CONTAS A PAGAR (PENDENTES)</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706', marginTop: 8 }}>
            {formatMoney(stats.totalAPagar)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Faturas e boletos que ainda faltam pagar
          </div>
        </div>
      </div>

      {/* SEÇÃO DE GRÁFICOS VISUAIS E DIDÁTICOS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          marginBottom: 32,
        }}
      >
        {/* GRÁFICO 1: ENTRADAS VS SAÍDAS POR MÊS */}
        <div
          style={{
            padding: '20px',
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
              Comparativo Mensal (O que Entrou x O que Saiu)
            </h3>
          </div>

          {/* Legenda simples */}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#16a34a' }} />
              <span>Entrou (Receitas)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#dc2626' }} />
              <span>Saiu (Gastos)</span>
            </div>
          </div>

          {/* Gráfico de Barras Visuais */}
          {chartMonthly.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum dado mensal registrado ainda.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
                height: 180,
                borderBottom: '2px solid var(--border-color)',
                paddingBottom: 8,
                paddingTop: 20,
                gap: 12,
              }}
            >
              {chartMonthly.items.map((item) => {
                const heightEntrou = Math.max(Math.round((item.entrou / chartMonthly.maxVal) * 130), 8);
                const heightSaiu = Math.max(Math.round((item.saiu / chartMonthly.maxVal) * 130), 8);

                return (
                  <div
                    key={item.month}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: 1,
                      maxWidth: 70,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                      {/* Barra Verde (Entrou) */}
                      <div
                        title={`Entrou: ${formatMoneyDetailed(item.entrou)}`}
                        style={{
                          width: 18,
                          height: `${heightEntrou}px`,
                          backgroundColor: '#16a34a',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease',
                        }}
                      />
                      {/* Barra Vermelha (Saiu) */}
                      <div
                        title={`Saiu: ${formatMoneyDetailed(item.saiu)}`}
                        style={{
                          width: 18,
                          height: `${heightSaiu}px`,
                          backgroundColor: '#dc2626',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, marginTop: 8, color: 'var(--text-muted)' }}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GRÁFICO 2: ONDE O DINHEIRO ESTÁ SENDO GASTO? */}
        <div
          style={{
            padding: '20px',
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 14 }}>
            Para onde está indo o dinheiro das obras?
          </h3>

          {/* Barra Visual Colorida Segmentada */}
          {stats.totalSaiu === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              Nenhum gasto pago registrado ainda para este filtro.
            </div>
          ) : (
            <div
              style={{
                height: 22,
                borderRadius: 6,
                overflow: 'hidden',
                display: 'flex',
                backgroundColor: 'var(--border-color)',
                marginBottom: 20,
              }}
            >
              {stats.materiais > 0 && (
                <div
                  style={{
                    width: `${(stats.materiais / stats.somaCustos) * 100}%`,
                    backgroundColor: '#dc2626',
                  }}
                  title={`Materiais: ${formatMoney(stats.materiais)}`}
                />
              )}
              {stats.maoDeObra > 0 && (
                <div
                  style={{
                    width: `${(stats.maoDeObra / stats.somaCustos) * 100}%`,
                    backgroundColor: '#7c3aed',
                  }}
                  title={`Mão de Obra: ${formatMoney(stats.maoDeObra)}`}
                />
              )}
              {stats.equipamentos > 0 && (
                <div
                  style={{
                    width: `${(stats.equipamentos / stats.somaCustos) * 100}%`,
                    backgroundColor: '#ea580c',
                  }}
                  title={`Equipamentos: ${formatMoney(stats.equipamentos)}`}
                />
              )}
              {stats.subempreiteiros > 0 && (
                <div
                  style={{
                    width: `${(stats.subempreiteiros / stats.somaCustos) * 100}%`,
                    backgroundColor: '#0284c7',
                  }}
                  title={`Subempreiteiros: ${formatMoney(stats.subempreiteiros)}`}
                />
              )}
              {stats.outrosCustos > 0 && (
                <div
                  style={{
                    width: `${(stats.outrosCustos / stats.somaCustos) * 100}%`,
                    backgroundColor: '#64748b',
                  }}
                  title={`Outros: ${formatMoney(stats.outrosCustos)}`}
                />
              )}
            </div>
          )}

          {/* Lista Explicativa com Valores e Porcentagens */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#dc2626' }} />
                <strong>Materiais de Construção:</strong>
              </span>
              <span>
                <strong>{formatMoney(stats.materiais)}</strong> (
                {Math.round((stats.materiais / stats.somaCustos) * 100)}%)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#7c3aed' }} />
                <strong>Mão de Obra / Salários:</strong>
              </span>
              <span>
                <strong>{formatMoney(stats.maoDeObra)}</strong> (
                {Math.round((stats.maoDeObra / stats.somaCustos) * 100)}%)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ea580c' }} />
                <strong>Máquinas e Equipamentos:</strong>
              </span>
              <span>
                <strong>{formatMoney(stats.equipamentos)}</strong> (
                {Math.round((stats.equipamentos / stats.somaCustos) * 100)}%)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#0284c7' }} />
                <strong>Subempreiteiras (Eletricidade, AVAC...):</strong>
              </span>
              <span>
                <strong>{formatMoney(stats.subempreiteiros)}</strong> (
                {Math.round((stats.subempreiteiros / stats.somaCustos) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ABAS SIMPLIFICADAS: EXTRATO / CONTAS PENDENTES / RESUMO DE OBRAS */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveView('extrato')}
          style={{
            fontSize: 14,
            fontWeight: 700,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeView === 'extrato' ? 'var(--primary)' : 'transparent',
            color: activeView === 'extrato' ? '#ffffff' : 'var(--text-muted)',
          }}
        >
          Extrato Completo ({records.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveView('pendentes')}
          style={{
            fontSize: 14,
            fontWeight: 700,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeView === 'pendentes' ? '#d97706' : 'transparent',
            color: activeView === 'pendentes' ? '#ffffff' : 'var(--text-muted)',
          }}
        >
          ⚠️ Contas a Pagar / Pendentes
        </button>

        <button
          type="button"
          onClick={() => setActiveView('obras')}
          style={{
            fontSize: 14,
            fontWeight: 700,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeView === 'obras' ? 'var(--primary)' : 'transparent',
            color: activeView === 'obras' ? '#ffffff' : 'var(--text-muted)',
          }}
        >
          🏗️ Gastos por Obra
        </button>
      </div>

      {/* VISÃO 1: RESUMO POR OBRA (TERMÔMETRO VISUAL) */}
      {activeView === 'obras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sitesSummary.map((item) => (
            <div
              key={item.site.id}
              style={{
                padding: '18px 20px',
                borderRadius: 10,
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                    {item.site.name}
                  </h4>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.site.address}</div>
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 13, fontWeight: 600 }}>
                  <span>
                    Entrou: <strong style={{ color: '#16a34a' }}>{formatMoney(item.entrou)}</strong>
                  </span>
                  <span>
                    Gastou: <strong style={{ color: '#dc2626' }}>{formatMoney(item.gastou)}</strong>
                  </span>
                  <span>
                    Lucro da Obra:{' '}
                    <strong style={{ color: item.saldo >= 0 ? '#16a34a' : '#dc2626' }}>
                      {formatMoney(item.saldo)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Barra de Progresso do Orçamento da Obra */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>Gasto até agora em relação ao orçamento:</span>
                  <strong>{item.percentualGasto}% utilizado</strong>
                </div>
                <div
                  style={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: 'var(--border-color)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${item.percentualGasto}%`,
                      backgroundColor:
                        item.percentualGasto > 85 ? '#dc2626' : item.percentualGasto > 65 ? '#d97706' : '#16a34a',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VISÃO 2 & 3: LISTA DE MOVIMENTAÇÕES (EXTRATO OU PENDENTES) */}
      {(activeView === 'extrato' || activeView === 'pendentes') && (
        <div
          style={{
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}
        >
          {/* Barra de Busca Simples */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Pesquisar por nome, cimento, fornecedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: 13,
                }}
              />
            </div>

            {/* Filtro Rápido (Entradas / Saídas) */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  backgroundColor: filterType === 'todos' ? 'var(--primary-subtle)' : undefined,
                  color: filterType === 'todos' ? 'var(--primary)' : undefined,
                }}
                onClick={() => setFilterType('todos')}
              >
                Tudo
              </button>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  backgroundColor: filterType === 'receita' ? '#f0fdf4' : undefined,
                  color: filterType === 'receita' ? '#16a34a' : undefined,
                }}
                onClick={() => setFilterType('receita')}
              >
                + Entradas
              </button>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  backgroundColor: filterType === 'despesa' ? '#fef2f2' : undefined,
                  color: filterType === 'despesa' ? '#dc2626' : undefined,
                }}
                onClick={() => setFilterType('despesa')}
              >
                - Saídas
              </button>
            </div>
          </div>

          {/* Lista de Registros em Linhas Espaçosas e Legíveis com Scroll Dedicado */}
          {filteredRecords.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              Nenhuma movimentação financeira encontrada.
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn-flat-primary"
                  onClick={() => handleOpenAdd('despesa')}
                  style={{ fontSize: 13, padding: '8px 16px' }}
                >
                  <Plus size={15} /> Registrar Primeiro Pagamento ou Recebimento
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '480px',
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'thin',
              }}
            >
              {filteredRecords.map((r) => {
                const isReceita = r.type === 'receita';
                const cat = CATEGORY_MAP[r.category] || CATEGORY_MAP.outros;

                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderBottom: '1px solid var(--border-color)',
                      gap: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Lado Esquerdo: Ícone Grande e Detalhes */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 240 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 8,
                          backgroundColor: isReceita ? '#f0fdf4' : '#fef2f2',
                          color: isReceita ? '#16a34a' : '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isReceita ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                      </div>

                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                          {r.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-muted)',
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginTop: 2,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                            {r.site_name || sites.find((s) => s.id === r.site_id)?.name || 'Geral'}
                          </span>
                          {r.entity_name && <span>• {r.entity_name}</span>}
                          <span>• Vencimento: {r.due_date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Valor e Botão de Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: isReceita ? '#16a34a' : '#dc2626',
                          }}
                        >
                          {isReceita ? '+' : '-'} {formatMoneyDetailed(r.amount)}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {cat.label}
                        </div>
                      </div>

                      {/* Botão de PAGO / PENDENTE */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(r)}
                        title="Clique para mudar status"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: 'none',
                          backgroundColor: r.status === 'pago' ? '#f0fdf4' : '#fffbeb',
                          color: r.status === 'pago' ? '#16a34a' : '#d97706',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {r.status === 'pago' ? (
                          <>
                            <Check size={14} /> PAGO
                          </>
                        ) : (
                          'PENDENTE'
                        )}
                      </button>

                      {/* Ações (Editar / Excluir) */}
                      <button
                        type="button"
                        className="btn-flat-secondary"
                        style={{ padding: '6px 8px' }}
                        onClick={() => handleOpenEdit(r)}
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        type="button"
                        className="btn-flat-secondary"
                        style={{ padding: '6px 8px', color: '#dc2626' }}
                        onClick={() => handleDelete(r.id)}
                        title="Apagar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL SIMPLIFICADO: REGISTRAR DINHEIRO */}
      {modalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 480 }}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                {editingRecord ? 'Editar Registro' : 'Registrar Dinheiro'}
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
              {/* Botões Grandes de Escolha: ENTRADA ou SAÍDA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('receita');
                    setFormCategory('receita_medicao');
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: formType === 'receita' ? '2px solid #16a34a' : '1px solid var(--border-color)',
                    backgroundColor: formType === 'receita' ? '#f0fdf4' : 'var(--bg-card-subtle)',
                    color: formType === 'receita' ? '#16a34a' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <ArrowUpCircle size={18} />
                  É UMA ENTRADA
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormType('despesa');
                    setFormCategory('custo_materiais');
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: formType === 'despesa' ? '2px solid #dc2626' : '1px solid var(--border-color)',
                    backgroundColor: formType === 'despesa' ? '#fef2f2' : 'var(--bg-card-subtle)',
                    color: formType === 'despesa' ? '#dc2626' : 'var(--text-muted)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <ArrowDownCircle size={18} />
                  É UMA SAÍDA (GASTO)
                </button>
              </div>

              {/* Campos Diretos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                <div className="flat-form-group">
                  <label>O que é esse valor? *</label>
                  <input
                    type="text"
                    required
                    placeholder={formType === 'receita' ? 'Ex: Pagamento da 1ª Medição' : 'Ex: Compra de Cimento'}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Valor em Dinheiro (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    style={{ fontSize: 16, fontWeight: 700 }}
                  />
                </div>

                <div className="flat-form-group">
                  <label>De qual Obra é esse valor?</label>
                  <select value={formSiteId} onChange={(e) => setFormSiteId(e.target.value)}>
                    <option value="">Geral da Empresa (Sem obra)</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label>Tipo de Custo / Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as FinancialCategory)}
                  >
                    {formType === 'receita' ? (
                      <>
                        <option value="adiantamento_cliente">Adiantamento de Cliente</option>
                        <option value="receita_medicao">Medição / Receita da Obra</option>
                        <option value="outros">Outro Recebimento</option>
                      </>
                    ) : (
                      <>
                        <option value="custo_materiais">Materiais (Betão, Aço, etc.)</option>
                        <option value="custo_mao_de_obra">Mão de Obra / Salários</option>
                        <option value="custo_equipamentos">Máquinas e Equipamentos</option>
                        <option value="custo_subempreitadas">Subempreiteiros</option>
                        <option value="pagamento_fornecedor">Pagamento a Fornecedor</option>
                        <option value="outros">Outro Gasto</option>
                      </>
                    )}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="flat-form-group">
                    <label>Data</label>
                    <input
                      type="date"
                      required
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                    />
                  </div>

                  <div className="flat-form-group">
                    <label>Nome da Pessoa / Fornecedor</label>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={formEntity}
                      onChange={(e) => setFormEntity(e.target.value)}
                    />
                  </div>
                </div>

                {/* Opção Simples: Já foi pago? */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formPaid}
                    onChange={(e) => setFormPaid(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {formType === 'receita' ? 'Já recebi esse dinheiro' : 'Esse valor já foi pago'}
                  </span>
                </label>
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
                  {editingRecord ? 'Salvar Mudanças' : 'Registrar Valor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
