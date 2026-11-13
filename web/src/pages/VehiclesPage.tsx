import React, { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Plus,
  Download,
  Edit2,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  User,
  Building2,
  Gauge,
  Shield,
  X,
  Save,
  Wrench,
  List,
  LayoutGrid,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { ConstructionSite, EmployeeProfile, Vehicle, VehicleStatus, VehicleType } from '../types';
import { deleteVehicle, getVehicles, saveVehicle } from '../lib/supabase';

interface VehiclesPageProps {
  companyId?: string;
  sites: ConstructionSite[];
  employees: EmployeeProfile[];
  onSelectVehicle?: (v: Vehicle) => void;
  showNotice: (msg: string) => void;
}

export function VehiclesPage({ companyId, sites, employees, onSelectVehicle, showNotice }: VehiclesPageProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros e busca
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'plate-asc' | 'brand-asc' | 'km-desc' | 'km-asc' | 'year-desc'>('plate-asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form states
  const [licensePlate, setLicensePlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('furgao');
  const [currentKm, setCurrentKm] = useState<number>(0);
  const [assignedDriverId, setAssignedDriverId] = useState('');
  const [assignedSiteId, setAssignedSiteId] = useState('');
  const [nextInspectionDate, setNextInspectionDate] = useState('');
  const [nextMaintenanceKm, setNextMaintenanceKm] = useState<string>('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [status, setStatus] = useState<VehicleStatus>('em_servico');
  const [fuelType, setFuelType] = useState('Gasóleo (Diesel)');
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const data = await getVehicles(companyId);
      setVehicles(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, [companyId]);

  const openNewVehicleModal = () => {
    setEditingVehicle(null);
    setLicensePlate('');
    setBrand('');
    setModel('');
    setYear(String(new Date().getFullYear()));
    setVehicleType('furgao');
    setCurrentKm(0);
    setAssignedDriverId('');
    setAssignedSiteId('');
    setNextInspectionDate('');
    setNextMaintenanceKm('');
    setInsuranceExpiryDate('');
    setStatus('em_servico');
    setFuelType('Gasóleo (Diesel)');
    setPhotoUrl('');
    setNotes('');
    setModalOpen(true);
  };

  const openEditVehicleModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setLicensePlate(v.license_plate);
    setBrand(v.brand);
    setModel(v.model);
    setYear(v.year ? String(v.year) : '');
    setVehicleType(v.vehicle_type);
    setCurrentKm(v.current_km);
    setAssignedDriverId(v.assigned_driver_id || '');
    setAssignedSiteId(v.assigned_site_id || '');
    setNextInspectionDate(v.next_inspection_date || '');
    setNextMaintenanceKm(v.next_maintenance_km ? String(v.next_maintenance_km) : '');
    setInsuranceExpiryDate(v.insurance_expiry_date || '');
    setStatus(v.status);
    setFuelType(v.fuel_type || 'Gasóleo (Diesel)');
    setPhotoUrl(v.photo_url || '');
    setNotes(v.notes || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licensePlate.trim() || !brand.trim() || !model.trim()) {
      alert('Preencha os campos obrigatórios (Matrícula, Marca e Modelo).');
      return;
    }

    setSaving(true);
    try {
      const driver = employees.find((emp) => emp.id === assignedDriverId);
      const site = sites.find((s) => s.id === assignedSiteId);

      await saveVehicle(
        {
          id: editingVehicle?.id,
          license_plate: licensePlate.trim().toUpperCase(),
          brand: brand.trim(),
          model: model.trim(),
          year: year ? Number(year) : null,
          vehicle_type: vehicleType,
          current_km: Number(currentKm) || 0,
          assigned_driver_id: assignedDriverId || null,
          assigned_driver_name: driver ? driver.full_name : null,
          assigned_site_id: assignedSiteId || null,
          assigned_site_name: site ? site.name : null,
          next_inspection_date: nextInspectionDate || null,
          next_maintenance_km: nextMaintenanceKm ? Number(nextMaintenanceKm) : null,
          insurance_expiry_date: insuranceExpiryDate || null,
          status,
          fuel_type: fuelType,
          photo_url: photoUrl.trim() || null,
          notes: notes.trim() || null,
        },
        companyId
      );

      setModalOpen(false);
      await loadVehicles();
      showNotice(editingVehicle ? 'Carrinha atualizada com sucesso!' : 'Nova carrinha cadastrada na frota!');
    } catch (err: any) {
      alert('Erro ao salvar carrinha: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Vehicle) => {
    if (window.confirm(`Tem certeza que deseja remover a carrinha ${v.brand} ${v.model} (${v.license_plate}) da frota?`)) {
      await deleteVehicle(v.id, companyId);
      await loadVehicles();
      showNotice('Carrinha removida da frota.');
    }
  };

  // Filtros e ordenação
  const filteredAndSortedVehicles = vehicles
    .filter((v) => {
      const matchesSearch =
        v.license_plate.toLowerCase().includes(search.toLowerCase()) ||
        v.brand.toLowerCase().includes(search.toLowerCase()) ||
        v.model.toLowerCase().includes(search.toLowerCase()) ||
        (v.assigned_driver_name && v.assigned_driver_name.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchesType = typeFilter === 'all' || v.vehicle_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'plate-asc':
          return a.license_plate.localeCompare(b.license_plate);
        case 'brand-asc':
          return a.brand.localeCompare(b.brand);
        case 'km-desc':
          return (b.current_km || 0) - (a.current_km || 0);
        case 'km-asc':
          return (a.current_km || 0) - (b.current_km || 0);
        case 'year-desc':
          return (Number(b.year) || 0) - (Number(a.year) || 0);
        default:
          return 0;
      }
    });

  // KPIs
  const totalVehicles = vehicles.length;
  const inServiceVehicles = vehicles.filter((v) => v.status === 'em_servico').length;
  const maintenanceVehicles = vehicles.filter((v) => v.status === 'em_manutencao').length;

  // Verifica inspeções próximas (nos próximos 30 dias)
  const now = new Date();
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const urgentInspectionVehicles = vehicles.filter((v) => {
    if (!v.next_inspection_date) return false;
    const inspDate = new Date(v.next_inspection_date);
    return inspDate <= thirtyDaysAhead;
  }).length;

  const exportCSV = () => {
    const headers = ['Matricula', 'Marca', 'Modelo', 'Ano', 'Tipo', 'KM_Atual', 'Motorista', 'Obra_Atribuida', 'Status', 'Proxima_Inspecao', 'Vencimento_Seguro'];
    const rows = filteredAndSortedVehicles.map((v) => [
      `"${v.license_plate}"`,
      `"${v.brand}"`,
      `"${v.model}"`,
      v.year || '',
      v.vehicle_type,
      v.current_km,
      `"${v.assigned_driver_name || 'Nenhum'}"`,
      `"${v.assigned_site_name || 'Geral'}"`,
      v.status,
      v.next_inspection_date || '',
      v.insurance_expiry_date || '',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `carrinhas_castello_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getVehicleTypeLabel = (type: VehicleType) => {
    switch (type) {
      case 'furgao':
        return 'Furgão Fechado';
      case 'caixa_aberta':
        return 'Caixa Aberta';
      case 'pickup':
        return 'Pick-up / Caixa Longa';
      case 'passageiros':
        return 'Carrinha Mista (5-7 Lugares)';
      case 'comercial_ligeiro':
        return 'Ligeiro Comercial';
    }
  };

  const getStatusBadge = (st: VehicleStatus) => {
    switch (st) {
      case 'em_servico':
        return { label: 'Em Serviço', bg: 'var(--success-subtle)', text: 'var(--success)', border: 'var(--success-border)' };
      case 'em_manutencao':
        return { label: 'Na Oficina', bg: 'var(--warning-subtle)', text: 'var(--warning)', border: 'var(--warning-border)' };
      case 'parada':
        return { label: 'Parada / Reserva', bg: 'var(--primary-subtle)', text: 'var(--text-muted)', border: 'var(--border-color)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="view-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="view-title">Gestão de Carrinhas & Frota</h1>
          <p className="view-description">
            Acompanhamento de veículos de apoio às obras, motoristas alocados, quilometragem e inspeções periódicas
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
            onClick={openNewVehicleModal}
            className="btn-flat-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
          >
            <Plus size={16} /> Nova Carrinha
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-row">
        <div className="kpi-box">
          <div className="kpi-label">Frota Total</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            {totalVehicles}
          </div>
          <div className="kpi-detail">Carrinhas registadas</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Em Serviço Ativo</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            {inServiceVehicles}
          </div>
          <div className="kpi-detail">Circulando entre obras</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Na Oficina / Revisão</div>
          <div
            className="kpi-value"
            style={{ color: maintenanceVehicles > 0 ? 'var(--warning)' : 'var(--text-main)' }}
          >
            {maintenanceVehicles}
          </div>
          <div className="kpi-detail">Em manutenção preventiva ou reparo</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Inspeções Próximas (30d)</div>
          <div
            className="kpi-value"
            style={{ color: urgentInspectionVehicles > 0 ? 'var(--danger)' : 'var(--success)' }}
          >
            {urgentInspectionVehicles}
          </div>
          <div className="kpi-detail">Atenção a prazos obrigatórios</div>
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
              placeholder="Buscar por matrícula (ex: AA-00-BB), marca, modelo ou motorista..."
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
          {/* Filtro por Tipo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={15} color="var(--text-muted)" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
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
              <option value="all">Todos os Tipos de Carrinha</option>
              <option value="furgao">Furgão Fechado</option>
              <option value="caixa_aberta">Caixa Aberta</option>
              <option value="pickup">Pick-up</option>
              <option value="passageiros">Mista (Passageiros)</option>
              <option value="comercial_ligeiro">Ligeiro Comercial</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            <option value="all">Todos os Status</option>
            <option value="em_servico">Em Serviço</option>
            <option value="em_manutencao">Na Oficina</option>
            <option value="parada">Parada / Reserva</option>
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
              <option value="plate-asc">Matrícula (A - Z)</option>
              <option value="brand-asc">Marca / Modelo (A - Z)</option>
              <option value="km-desc">KM Atual (Maior)</option>
              <option value="km-asc">KM Atual (Menor)</option>
              <option value="year-desc">Ano (Mais Recente)</option>
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

      {/* Visualização de Frota: Tabela vs Cards */}
      {viewMode === 'table' ? (
        <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
            <table className="flat-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Carrinha / Matrícula</th>
                  <th>Tipo & Combustível</th>
                  <th>Condutor Atribuído</th>
                  <th>Obra Alocada</th>
                  <th>KM Atual</th>
                  <th>Prazos & Inspeção</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Carregando frota de carrinhas...
                    </td>
                  </tr>
                ) : filteredAndSortedVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Nenhuma carrinha cadastrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedVehicles.map((v) => {
                    const badge = getStatusBadge(v.status);
                    let isUrgentInspection = false;
                    if (v.next_inspection_date) {
                      const inspDate = new Date(v.next_inspection_date);
                      isUrgentInspection = inspDate <= thirtyDaysAhead;
                    }

                    return (
                      <tr key={v.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {v.photo_url ? (
                              <img
                                src={v.photo_url}
                                alt={v.license_plate}
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 8,
                                  objectFit: 'cover',
                                  border: '1px solid var(--border-color)',
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 8,
                                  backgroundColor: 'var(--primary-subtle)',
                                  color: 'var(--primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <Truck size={18} />
                              </div>
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    fontFamily: 'monospace',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    backgroundColor: 'var(--bg-card-subtle)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-main)',
                                  }}
                                >
                                  {v.license_plate}
                                </span>
                              </div>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13, marginTop: 2 }}>
                                {v.brand} {v.model} {v.year ? `(${v.year})` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                            {getVehicleTypeLabel(v.vehicle_type)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {v.fuel_type || 'Gasóleo'}
                          </div>
                        </td>

                        <td>
                          {v.assigned_driver_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-main)' }}>
                              <User size={14} color="var(--primary)" />
                              <span>{v.assigned_driver_name}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sem motorista fixo</span>
                          )}
                        </td>

                        <td>
                          {v.assigned_site_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                              <Building2 size={14} />
                              <span>{v.assigned_site_name}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sede / Apoio Geral</span>
                          )}
                        </td>

                        <td>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                            {v.current_km.toLocaleString('pt-PT')} km
                          </div>
                          {v.next_maintenance_km && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Revisão aos {v.next_maintenance_km.toLocaleString('pt-PT')} km
                            </div>
                          )}
                        </td>

                        <td>
                          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span
                              style={{
                                fontWeight: isUrgentInspection ? 700 : 500,
                                color: isUrgentInspection ? 'var(--danger)' : 'var(--text-main)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {isUrgentInspection && <AlertTriangle size={12} />}
                              Insp: {v.next_inspection_date ? new Date(v.next_inspection_date).toLocaleDateString('pt-PT') : 'Não def.'}
                            </span>
                            {v.insurance_expiry_date && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Seguro: {new Date(v.insurance_expiry_date).toLocaleDateString('pt-PT')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor:
                                  v.status === 'em_servico'
                                    ? '#10B981'
                                    : v.status === 'em_manutencao'
                                    ? '#F59E0B'
                                    : '#64748B',
                                boxShadow:
                                  v.status === 'em_servico'
                                    ? '0 0 6px rgba(16, 185, 129, 0.55)'
                                    : v.status === 'em_manutencao'
                                    ? '0 0 6px rgba(245, 158, 11, 0.55)'
                                    : 'none',
                                display: 'inline-block',
                                flexShrink: 0,
                              }}
                              title={badge.label}
                            />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>
                              {badge.label}
                            </span>
                          </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <button
                              onClick={() => onSelectVehicle ? onSelectVehicle(v) : openEditVehicleModal(v)}
                              className="btn-flat-primary"
                              style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              title="Abrir página completa com Inventário, Relatórios e Manutenção"
                            >
                              <Wrench size={13} /> Detalhes & Inventário
                            </button>
                            <button
                              onClick={() => openEditVehicleModal(v)}
                              className="btn-flat-secondary"
                              style={{ padding: '6px 8px' }}
                              title="Editar carrinha"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(v)}
                              className="btn-flat-secondary"
                              style={{ padding: '6px 8px', color: 'var(--danger)' }}
                              title="Excluir carrinha"
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
              Carregando frota de carrinhas...
            </div>
          ) : filteredAndSortedVehicles.length === 0 ? (
            <div className="content-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
              Nenhuma carrinha cadastrada com os filtros selecionados.
            </div>
          ) : (
            filteredAndSortedVehicles.map((v) => {
              const badge = getStatusBadge(v.status);
              let isUrgentInspection = false;
              if (v.next_inspection_date) {
                const inspDate = new Date(v.next_inspection_date);
                isUrgentInspection = inspDate <= thirtyDaysAhead;
              }

              return (
                <div
                  key={v.id}
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
                        {v.photo_url ? (
                          <img
                            src={v.photo_url}
                            alt={v.license_plate}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              objectFit: 'cover',
                              border: '1px solid var(--border-color)',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
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
                            <Truck size={18} />
                          </div>
                        )}
                        <div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: 'var(--bg-card-subtle)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)',
                            }}
                          >
                            {v.license_plate}
                          </span>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)', marginTop: 2 }}>
                            {v.brand} {v.model}
                          </div>
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
                        <span style={{ color: 'var(--text-muted)' }}>Tipo & Ano:</span>
                        <strong style={{ color: 'var(--text-main)' }}>
                          {getVehicleTypeLabel(v.vehicle_type)} {v.year ? `(${v.year})` : ''}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, backgroundColor: 'var(--bg-card-subtle)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Quilometragem:</span>
                        <strong style={{ color: 'var(--primary)' }}>{v.current_km.toLocaleString('pt-PT')} km</strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', marginTop: 2 }}>
                        <User size={13} color="var(--primary)" />
                        <span>{v.assigned_driver_name ? `Motorista: ${v.assigned_driver_name}` : 'Sem motorista fixo'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                        <Building2 size={13} />
                        <span>{v.assigned_site_name ? `Obra: ${v.assigned_site_name}` : 'Sede / Apoio Geral'}</span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 8px',
                          borderRadius: 6,
                          backgroundColor: isUrgentInspection ? 'var(--danger-subtle)' : 'var(--bg-card-subtle)',
                          border: isUrgentInspection ? '1px solid var(--danger-border)' : '1px solid var(--border-color)',
                          color: isUrgentInspection ? 'var(--danger)' : 'var(--text-muted)',
                          marginTop: 4,
                        }}
                      >
                        <Calendar size={13} />
                        <span style={{ fontWeight: isUrgentInspection ? 700 : 500 }}>
                          Insp: {v.next_inspection_date ? new Date(v.next_inspection_date).toLocaleDateString('pt-PT') : 'Não def.'}
                        </span>
                      </div>
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
                      {v.fuel_type || 'Gasóleo'}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => onSelectVehicle ? onSelectVehicle(v) : openEditVehicleModal(v)}
                        className="btn-flat-primary"
                        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700 }}
                      >
                        Abrir Página
                      </button>
                      <button
                        onClick={() => openEditVehicleModal(v)}
                        className="btn-flat-secondary"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(v)}
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

      {/* Modal de Adicionar / Editar Carrinha */}
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
              maxWidth: 600,
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
                <Truck size={20} color="var(--primary)" />
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {editingVehicle ? 'Editar Carrinha da Frota' : 'Cadastrar Nova Carrinha'}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.5fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Matrícula / Placa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 45-AB-89"
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    style={{ padding: '10px 12px', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Renault, Ford, Toyota"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Master, Transit, Hilux"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Tipo de Carrinha</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="furgao">Furgão Fechado</option>
                    <option value="caixa_aberta">Caixa Aberta</option>
                    <option value="pickup">Pick-up / Caixa Longa</option>
                    <option value="passageiros">Mista (Passageiros)</option>
                    <option value="comercial_ligeiro">Ligeiro Comercial</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Ano de Fabrico</label>
                  <input
                    type="number"
                    placeholder="Ex: 2022"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>KM Atual *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={currentKm}
                    onChange={(e) => setCurrentKm(Number(e.target.value))}
                    style={{ padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Motorista / Condutor Habitual</label>
                  <select
                    value={assignedDriverId}
                    onChange={(e) => setAssignedDriverId(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="">Nenhum (Sem condutor fixo)</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.job_title})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Obra Atual Atribuída</label>
                  <select
                    value={assignedSiteId}
                    onChange={(e) => setAssignedSiteId(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="">Apoio Geral / Sede da Firma</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Próxima Inspeção Periódica</label>
                  <input
                    type="date"
                    value={nextInspectionDate}
                    onChange={(e) => setNextInspectionDate(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Revisão aos (KM)</label>
                  <input
                    type="number"
                    placeholder="Ex: 120000"
                    value={nextMaintenanceKm}
                    onChange={(e) => setNextMaintenanceKm(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Vencimento do Seguro</label>
                  <input
                    type="date"
                    value={insuranceExpiryDate}
                    onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Combustível</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="Gasóleo (Diesel)">Gasóleo (Diesel)</option>
                    <option value="Gasolina">Gasolina</option>
                    <option value="Elétrico">Elétrico</option>
                    <option value="Híbrido">Híbrido</option>
                    <option value="GPL">GPL</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Estado / Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="em_servico">Em Serviço Ativo</option>
                    <option value="em_manutencao">Na Oficina / Revisão</option>
                    <option value="parada">Parada / Em Reserva</option>
                  </select>
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Foto de Perfil da Carrinha (URL da Imagem)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Prévia Carrinha"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        objectFit: 'cover',
                        border: '1px solid var(--border-color)',
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                  <input
                    type="url"
                    placeholder="https://... (URL da foto da carrinha)"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Observações / Histórico de Reparos</label>
                <textarea
                  rows={2}
                  placeholder="Informações sobre pneus, trocas recentes, avarias ou número da apólice..."
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
                  {saving ? 'Salvando...' : 'Salvar Carrinha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

