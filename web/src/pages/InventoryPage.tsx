import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  Plus,
  Download,
  Edit2,
  Trash2,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Package,
  HardHat,
  X,
  Save,
  ArrowRightLeft,
  List,
  LayoutGrid,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { ConstructionSite, InventoryCategory, InventoryCondition, InventoryItem } from '../types';
import { deleteInventoryItem, getInventoryItems, saveInventoryItem } from '../lib/supabase';

interface InventoryPageProps {
  companyId?: string;
  sites: ConstructionSite[];
  showNotice: (msg: string) => void;
}

export function InventoryPage({ companyId, sites, showNotice }: InventoryPageProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros e busca
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'qty-desc' | 'qty-asc' | 'price-desc'>('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal de criação / edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('ferramentas');
  const [serialNumber, setSerialNumber] = useState('');
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [allocatedQuantity, setAllocatedQuantity] = useState(0);
  const [allocatedSiteId, setAllocatedSiteId] = useState('');
  const [condition, setCondition] = useState<InventoryCondition>('bom');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getInventoryItems(companyId);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [companyId]);

  const openNewItemModal = () => {
    setEditingItem(null);
    setName('');
    setCategory('ferramentas');
    setSerialNumber('');
    setTotalQuantity(1);
    setAllocatedQuantity(0);
    setAllocatedSiteId('');
    setCondition('bom');
    setUnitPrice('');
    setLocation('Armazém Central');
    setNotes('');
    setModalOpen(true);
  };

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setSerialNumber(item.serial_number || '');
    setTotalQuantity(item.total_quantity);
    setAllocatedQuantity(item.allocated_quantity);
    setAllocatedSiteId(item.allocated_site_id || '');
    setCondition(item.condition);
    setUnitPrice(item.unit_price ? String(item.unit_price) : '');
    setLocation(item.location || '');
    setNotes(item.notes || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o nome do item.');
      return;
    }

    setSaving(true);
    try {
      const selectedSite = sites.find((s) => s.id === allocatedSiteId);
      await saveInventoryItem(
        {
          id: editingItem?.id,
          name: name.trim(),
          category,
          serial_number: serialNumber.trim() || null,
          total_quantity: Number(totalQuantity) || 1,
          allocated_quantity: Number(allocatedQuantity) || 0,
          allocated_site_id: allocatedSiteId || null,
          allocated_site_name: selectedSite ? selectedSite.name : null,
          condition,
          unit_price: unitPrice ? parseFloat(unitPrice.replace(',', '.')) : null,
          location: location.trim() || null,
          notes: notes.trim() || null,
        },
        companyId
      );

      setModalOpen(false);
      await loadItems();
      showNotice(editingItem ? 'Item atualizado com sucesso!' : 'Novo item adicionado ao inventário!');
    } catch (err: any) {
      alert('Erro ao salvar item: ' + (err.message || 'Tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (window.confirm(`Tem certeza que deseja excluir "${item.name}" do inventário?`)) {
      await deleteInventoryItem(item.id, companyId);
      await loadItems();
      showNotice('Item removido do inventário.');
    }
  };

  // Filtros e ordenação
  const filteredAndSortedItems = items
    .filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(search.toLowerCase())) ||
        (item.location && item.location.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesCondition = conditionFilter === 'all' || item.condition === conditionFilter;
      const matchesSite = siteFilter === 'all' || item.allocated_site_id === siteFilter;

      return matchesSearch && matchesCategory && matchesCondition && matchesSite;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'qty-desc':
          return (b.total_quantity || 0) - (a.total_quantity || 0);
        case 'qty-asc':
          return (a.total_quantity || 0) - (b.total_quantity || 0);
        case 'price-desc':
          return (b.unit_price || 0) - (a.unit_price || 0);
        default:
          return 0;
      }
    });

  // KPIs
  const totalItemsCount = items.reduce((acc, i) => acc + (i.total_quantity || 0), 0);
  const allocatedItemsCount = items.reduce((acc, i) => acc + (i.allocated_quantity || 0), 0);
  const availableItemsCount = Math.max(0, totalItemsCount - allocatedItemsCount);
  const maintenanceItemsCount = items.filter((i) => i.condition === 'manutencao' || i.condition === 'danificado').length;

  const exportCSV = () => {
    const headers = ['Item', 'Categoria', 'N_Serie', 'Qtd_Total', 'Qtd_Em_Obra', 'Qtd_Disponivel', 'Obra_Alocada', 'Estado', 'Valor_Unit', 'Localizacao'];
    const rows = filteredAndSortedItems.map((i) => [
      `"${i.name}"`,
      i.category,
      `"${i.serial_number || ''}"`,
      i.total_quantity,
      i.allocated_quantity,
      i.available_quantity,
      `"${i.allocated_site_name || 'Armazém'}"`,
      i.condition,
      i.unit_price || 0,
      `"${i.location || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `inventario_castello_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryLabel = (cat: InventoryCategory) => {
    switch (cat) {
      case 'ferramentas':
        return 'Ferramentas Manuais / Elétricas';
      case 'maquinas_equipamentos':
        return 'Máquinas & Equipamentos';
      case 'materiais_consumiveis':
        return 'Materiais & Consumíveis';
      case 'seguranca_epis':
        return 'Segurança & EPIs';
      default:
        return 'Outros';
    }
  };

  const getConditionBadge = (cond: InventoryCondition) => {
    switch (cond) {
      case 'novo':
        return { label: 'Novo', bg: 'var(--success-subtle)', text: 'var(--success)', border: 'var(--success-border)' };
      case 'bom':
        return { label: 'Bom Estado', bg: 'var(--primary-subtle)', text: 'var(--primary)', border: 'var(--primary-border)' };
      case 'manutencao':
        return { label: 'Manutenção', bg: 'var(--warning-subtle)', text: 'var(--warning)', border: 'var(--warning-border)' };
      case 'danificado':
        return { label: 'Danificado', bg: 'var(--danger-subtle)', text: 'var(--danger)', border: 'var(--danger-border)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header da View */}
      <div className="view-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="view-title">Inventário de Ferramentas & Equipamentos</h1>
          <p className="view-description">
            Controle de máquinas, ferramentas em obras, materiais em estoque e estado de conservação
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={exportCSV}
            className="btn-flat-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Download size={15} /> Exportar CSV
          </button>
          <button
            onClick={openNewItemModal}
            className="btn-flat-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
          >
            <Plus size={16} /> Novo Item
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-row">
        <div className="kpi-box">
          <div className="kpi-label">Total de Itens</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            {totalItemsCount}
          </div>
          <div className="kpi-detail">{items.length} modelos / categorias</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Alocados em Obras</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            {allocatedItemsCount}
          </div>
          <div className="kpi-detail">Equipamentos em trabalho ativo</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Disponíveis no Armazém</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            {availableItemsCount}
          </div>
          <div className="kpi-detail">Prontos para alocação</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Em Manutenção / Danificados</div>
          <div
            className="kpi-value"
            style={{ color: maintenanceItemsCount > 0 ? 'var(--warning)' : 'var(--text-main)' }}
          >
            {maintenanceItemsCount}
          </div>
          <div className="kpi-detail">Requerem assistência ou reparo</div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div
        className="content-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12 }} />
            <input
              type="text"
              placeholder="Buscar por nome do item, nº de série ou localização..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={15} color="var(--text-muted)" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="all">Todas as Categorias</option>
              <option value="ferramentas">Ferramentas</option>
              <option value="maquinas_equipamentos">Máquinas & Equipamentos</option>
              <option value="materiais_consumiveis">Materiais & Consumíveis</option>
              <option value="seguranca_epis">Segurança & EPIs</option>
              <option value="outros">Outros</option>
            </select>
          </div>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: 13,
              outline: 'none',
            }}
          >
            <option value="all">Todos os Estados</option>
            <option value="novo">Novo</option>
            <option value="bom">Bom Estado</option>
            <option value="manutencao">Manutenção</option>
            <option value="danificado">Danificado</option>
          </select>

          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: 13,
              outline: 'none',
            }}
          >
            <option value="all">Todas as Obras</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Ordenação (Sort By) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpDown size={15} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="name-asc">Nome (A - Z)</option>
              <option value="name-desc">Nome (Z - A)</option>
              <option value="qty-desc">Quantidade (Maior)</option>
              <option value="qty-asc">Quantidade (Menor)</option>
              <option value="price-desc">Preço Unitário (€ Maior)</option>
            </select>
          </div>

          {/* Alternância de Visualização: Cards vs Lista */}
          <div
            style={{
              display: 'flex',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <List size={14} /> Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: viewMode === 'cards' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'cards' ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={14} /> Cards
            </button>
          </div>
        </div>
      </div>

      {/* Visualização de Inventário: Tabela vs Cards */}
      {viewMode === 'table' ? (
        <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
            <table className="flat-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Item / Equipamento</th>
                  <th>Categoria</th>
                  <th>Quantidades</th>
                  <th>Localização / Obra</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Carregando inventário...
                    </td>
                  </tr>
                ) : filteredAndSortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Nenhum item cadastrado no inventário com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedItems.map((item) => {
                    const badge = getConditionBadge(item.condition);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Boxes size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 14 }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {item.serial_number ? `S/N: ${item.serial_number}` : 'Sem nº série'}
                                {item.unit_price ? ` • € ${item.unit_price.toFixed(2)}/un` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-main)' }}>
                            {getCategoryLabel(item.category)}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                            Total: {item.total_quantity} un
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                            <span style={{ color: 'var(--primary)' }}>{item.allocated_quantity} em obra</span>
                            <span>•</span>
                            <span style={{ color: 'var(--success)' }}>{item.available_quantity} armazém</span>
                          </div>
                        </td>

                        <td>
                          {item.allocated_site_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                              <Building2 size={14} />
                              <span>{item.allocated_site_name}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {item.location || 'Armazém Central'}
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 6,
                              backgroundColor: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              textTransform: 'uppercase',
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => openEditItemModal(item)}
                              className="btn-flat-secondary"
                              style={{ padding: '6px 8px' }}
                              title="Editar item"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="btn-flat-secondary"
                              style={{ padding: '6px 8px', color: 'var(--danger)' }}
                              title="Excluir item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 16,
          }}
        >
          {loading ? (
            <div className="content-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
              Carregando inventário...
            </div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="content-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
              Nenhum item cadastrado no inventário com os filtros selecionados.
            </div>
          ) : (
            filteredAndSortedItems.map((item) => {
              const badge = getConditionBadge(item.condition);
              return (
                <div
                  key={item.id}
                  className="content-panel"
                  style={{
                    margin: 0,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    transition: 'border-color 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            backgroundColor: 'var(--primary-subtle)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Boxes size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                            {item.name}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {getCategoryLabel(item.category)}
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          backgroundColor: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`,
                          textTransform: 'uppercase',
                          flexShrink: 0,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, backgroundColor: 'var(--bg-card-subtle)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Qtd Total:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{item.total_quantity} un</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, backgroundColor: 'var(--bg-card-subtle)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Alocado em Obra:</span>
                        <strong style={{ color: 'var(--primary)' }}>{item.allocated_quantity} un</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, backgroundColor: 'var(--bg-card-subtle)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>No Armazém:</span>
                        <strong style={{ color: 'var(--success)' }}>{item.available_quantity} un</strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginTop: 4 }}>
                        <Building2 size={13} />
                        <span>
                          {item.allocated_site_name ? `Obra: ${item.allocated_site_name}` : (item.location || 'Armazém Central')}
                        </span>
                      </div>

                      {item.unit_price && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Valor Estimado: € {item.unit_price.toFixed(2)} / un
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 10,
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.serial_number ? `S/N: ${item.serial_number}` : ''}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => openEditItemModal(item)}
                        className="btn-flat-secondary"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        <Edit2 size={12} /> Editar
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="btn-flat-danger"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal de Adicionar / Editar Item */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 580,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Boxes size={20} color="var(--primary)" />
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {editingItem ? 'Editar Item do Inventário' : 'Novo Item no Inventário'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Nome do Item / Equipamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Martelo Demolidor Bosch 16kg, Andaime Fachadeiro..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ padding: '10px 12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="ferramentas">Ferramentas</option>
                    <option value="maquinas_equipamentos">Máquinas & Equipamentos</option>
                    <option value="materiais_consumiveis">Materiais & Consumíveis</option>
                    <option value="seguranca_epis">Segurança & EPIs</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Nº de Série / Patrimônio</label>
                  <input
                    type="text"
                    placeholder="Ex: SN-98421"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Quantidade Total *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(Number(e.target.value))}
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Em Obra (Alocado)</label>
                  <input
                    type="number"
                    min="0"
                    max={totalQuantity}
                    value={allocatedQuantity}
                    onChange={(e) => setAllocatedQuantity(Number(e.target.value))}
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Estado de Conservação</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as InventoryCondition)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="novo">Novo</option>
                    <option value="bom">Bom Estado</option>
                    <option value="manutencao">Manutenção</option>
                    <option value="danificado">Danificado</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Alocar na Obra</label>
                  <select
                    value={allocatedSiteId}
                    onChange={(e) => setAllocatedSiteId(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="">Nenhuma (Fica no Armazém Central)</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Valor Unitário (€ / R$)</label>
                  <input
                    type="text"
                    placeholder="Ex: 450.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Localização no Armazém / Estante</label>
                <input
                  type="text"
                  placeholder="Ex: Prateleira B3, Armário 02..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ padding: '10px 12px' }}
                />
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Observações</label>
                <textarea
                  rows={2}
                  placeholder="Notas adicionais sobre garantia, fornecedor ou manutenção..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ padding: '8px 12px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-flat-secondary"
                  style={{ padding: '10px 16px', fontSize: 13 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-flat-primary"
                  style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} />
                  {saving ? 'Salvando...' : 'Salvar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

