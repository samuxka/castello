import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Truck,
  Calendar,
  Wrench,
  Package,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Building2,
  Gauge,
  Shield,
  Plus,
  ArrowRightLeft,
  RotateCcw,
  Check,
  X,
  Camera,
  Euro,
  Download,
  Edit2,
  Trash2,
  Fuel,
  Info,
} from 'lucide-react';
import {
  ConstructionSite,
  EmployeeProfile,
  InventoryItem,
  InventoryMovement,
  Vehicle,
  VehicleInventoryItem,
  VehicleMaintenanceRecord,
  VehicleReport,
  VehicleStatus,
  VehicleType,
  VehicleWeeklyAssignment,
} from '../types';
import {
  addVehicleMaintenanceRecord,
  getInventoryItems,
  getInventoryMovements,
  getVehicleInventory,
  getVehicleMaintenanceRecords,
  getVehicleReports,
  getVehicleWeeklyAssignments,
  loadItemToVehicle,
  returnItemFromVehicle,
  saveVehicle,
  saveVehicleWeeklyAssignment,
  deleteVehicleWeeklyAssignment,
} from '../lib/supabase';

interface VehicleDetailPageProps {
  vehicle: Vehicle;
  sites: ConstructionSite[];
  employees: EmployeeProfile[];
  companyId?: string;
  onBack: () => void;
  onVehicleUpdated: (v: Vehicle) => void;
  showNotice: (msg: string) => void;
}

export function VehicleDetailPage({
  vehicle: initialVehicle,
  sites,
  employees,
  companyId,
  onBack,
  onVehicleUpdated,
  showNotice,
}: VehicleDetailPageProps) {
  const [vehicle, setVehicle] = useState<Vehicle>(initialVehicle);
  const [activeTab, setActiveTab] = useState<'geral' | 'inventario' | 'manutencao'>('geral');
  const [loading, setLoading] = useState(false);

  // Dados das abas
  const [inventory, setInventory] = useState<VehicleInventoryItem[]>([]);
  const [centralStock, setCentralStock] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [reports, setReports] = useState<VehicleReport[]>([]);
  const [assignments, setAssignments] = useState<VehicleWeeklyAssignment[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<VehicleMaintenanceRecord[]>([]);

  // Modais
  const [loadStockModalOpen, setLoadStockModalOpen] = useState(false);
  const [returnStockModalOpen, setReturnStockModalOpen] = useState(false);
  const [selectedStockItemId, setSelectedStockItemId] = useState('');
  const [selectedVehicleItemId, setSelectedVehicleItemId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('1');
  const [transferOperatorName, setTransferOperatorName] = useState('Patrão / Gerência');

  const [addMaintenanceModalOpen, setAddMaintenanceModalOpen] = useState(false);
  const [maintType, setMaintType] = useState<VehicleMaintenanceRecord['item_type']>('oleo');
  const [maintTitle, setMaintTitle] = useState('Troca de Óleo e Filtros');
  const [maintKm, setMaintKm] = useState(String(vehicle.current_km));
  const [maintDate, setMaintDate] = useState(new Date().toISOString().slice(0, 10));
  const [maintNextKm, setMaintNextKm] = useState(String((vehicle.current_km || 0) + 15000));
  const [maintCost, setMaintCost] = useState('');
  const [maintProvider, setMaintProvider] = useState('');
  const [maintNotes, setMaintNotes] = useState('');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignDayOfWeek, setAssignDayOfWeek] = useState('Segunda-feira');
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  // Modais de Foto e Motorista Principal
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState(vehicle.photo_url || '');
  const [savingPhoto, setSavingPhoto] = useState(false);

  const [changeDriverModalOpen, setChangeDriverModalOpen] = useState(false);
  const [newDriverId, setNewDriverId] = useState(vehicle.assigned_driver_id || '');
  const [savingDriver, setSavingDriver] = useState(false);

  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPhoto(true);
    try {
      const updated = await saveVehicle(
        {
          ...vehicle,
          photo_url: newPhotoUrl.trim() || null,
        },
        companyId
      );
      setVehicle(updated);
      onVehicleUpdated(updated);
      setPhotoModalOpen(false);
      showNotice('Foto de perfil da carrinha atualizada com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar foto da carrinha.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDriver(true);
    try {
      const driver = employees.find((emp) => emp.id === newDriverId);
      const updated = await saveVehicle(
        {
          ...vehicle,
          assigned_driver_id: driver?.id || null,
          assigned_driver_name: driver?.full_name || null,
        },
        companyId
      );
      setVehicle(updated);
      onVehicleUpdated(updated);
      setChangeDriverModalOpen(false);
      showNotice(
        driver
          ? `Motorista ${driver.full_name} atribuído com sucesso!`
          : 'Motorista principal removido da carrinha.'
      );
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar motorista principal.');
    } finally {
      setSavingDriver(false);
    }
  };

  const handleDeleteAssignment = async (assignId: string) => {
    if (!confirm('Deseja remover este registo de utilização?')) return;
    try {
      await deleteVehicleWeeklyAssignment(vehicle.id, assignId);
      setAssignments((prev) => prev.filter((a) => a.id !== assignId));
      showNotice('Registo de utilização removido com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Falha ao remover registo.');
    }
  };

  // Carrega todos os dados da carrinha
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [invData, stockData, movData, repData, assignData, maintData] = await Promise.all([
        getVehicleInventory(vehicle.id),
        getInventoryItems(companyId),
        getInventoryMovements(vehicle.id),
        getVehicleReports(vehicle.id),
        getVehicleWeeklyAssignments(vehicle.id),
        getVehicleMaintenanceRecords(vehicle.id),
      ]);
      setInventory(invData);
      setCentralStock(stockData);
      setMovements(movData);
      setReports(repData);
      setAssignments(assignData);
      setMaintenanceRecords(maintData);
    } catch (err) {
      console.warn('Erro ao carregar dados detalhados da carrinha:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [vehicle.id]);

  // Carregar item do estoque central para a carrinha
  const handleLoadItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(transferQuantity, 10);
    if (!selectedStockItemId || isNaN(qty) || qty <= 0) {
      alert('Selecione um item e informe uma quantidade válida.');
      return;
    }

    try {
      await loadItemToVehicle(
        vehicle.id,
        vehicle.license_plate,
        selectedStockItemId,
        qty,
        transferOperatorName.trim() || 'Patrão / Gerência',
        'admin',
        companyId
      );
      setLoadStockModalOpen(false);
      setSelectedStockItemId('');
      setTransferQuantity('1');
      await loadAllData();
      showNotice(`Item carregado na carrinha ${vehicle.license_plate} com sucesso!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar item na carrinha.');
    }
  };

  // Devolver item da carrinha para o estoque central
  const handleReturnItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(transferQuantity, 10);
    if (!selectedVehicleItemId || isNaN(qty) || qty <= 0) {
      alert('Selecione um item e informe uma quantidade válida.');
      return;
    }

    try {
      await returnItemFromVehicle(
        vehicle.id,
        vehicle.license_plate,
        selectedVehicleItemId,
        qty,
        transferOperatorName.trim() || 'Patrão / Gerência',
        'admin',
        companyId
      );
      setReturnStockModalOpen(false);
      setSelectedVehicleItemId('');
      setTransferQuantity('1');
      await loadAllData();
      showNotice(`Item devolvido ao estoque central com sucesso!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao devolver item para o estoque.');
    }
  };

  // Registar manutenção
  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    const kmNum = parseInt(maintKm, 10) || vehicle.current_km;
    const nextKmNum = maintNextKm ? parseInt(maintNextKm, 10) : null;
    const costNum = maintCost ? parseFloat(maintCost.replace(',', '.')) : null;

    try {
      await addVehicleMaintenanceRecord({
        vehicle_id: vehicle.id,
        company_id: companyId || null,
        item_type: maintType,
        title: maintTitle.trim(),
        description: maintNotes.trim() || undefined,
        performed_at: maintDate,
        performed_km: kmNum,
        next_due_km: nextKmNum,
        cost: costNum,
        service_provider: maintProvider.trim() || undefined,
      });

      // Atualiza o estado local do veículo se foi troca de óleo ou pneus
      const updatedVehicle: Vehicle = {
        ...vehicle,
        current_km: Math.max(vehicle.current_km, kmNum),
      };
      if (maintType === 'oleo') {
        updatedVehicle.last_oil_change_date = maintDate;
        updatedVehicle.last_oil_change_km = kmNum;
        if (nextKmNum) updatedVehicle.next_oil_change_km = nextKmNum;
      } else if (maintType === 'pneus') {
        updatedVehicle.last_tire_change_date = maintDate;
        updatedVehicle.last_tire_change_km = kmNum;
        if (nextKmNum) updatedVehicle.next_tire_change_km = nextKmNum;
      } else if (maintType === 'travoes') {
        updatedVehicle.last_brakes_check_date = maintDate;
        if (nextKmNum) updatedVehicle.next_brakes_check_km = nextKmNum;
      }

      setVehicle(updatedVehicle);
      onVehicleUpdated(updatedVehicle);
      setAddMaintenanceModalOpen(false);
      await loadAllData();
      showNotice('Registo de manutenção gravado com sucesso!');
    } catch (err: any) {
      alert('Erro ao gravar manutenção: ' + (err.message || 'Tente novamente.'));
    }
  };

  // Salvar atribuição semanal de motorista
  const handleSaveWeeklyAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const driver = employees.find((emp) => emp.id === assignDriverId);
    if (!driver && !assignDriverId) {
      alert('Selecione um motorista.');
      return;
    }

    try {
      await saveVehicleWeeklyAssignment({
        vehicle_id: vehicle.id,
        company_id: companyId || null,
        date: assignDate,
        day_of_week: assignDayOfWeek,
        driver_id: driver?.id || null,
        driver_name: driver?.full_name || 'Motorista Designado',
        driver_phone: driver?.phone || null,
        notes: assignNotes.trim() || undefined,
      });

      setAssignModalOpen(false);
      setAssignNotes('');
      await loadAllData();
      showNotice(`Responsável atribuído para ${assignDayOfWeek}!`);
    } catch (err: any) {
      alert('Erro ao salvar atribuição: ' + (err.message || 'Tente novamente.'));
    }
  };

  // Dias da semana predefinidos para a grelha semanal
  const daysOfWeek = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo',
  ];

  // Cálculo de alerta de troca de óleo
  const oilNextKm = vehicle.next_oil_change_km || (vehicle.last_oil_change_km ? vehicle.last_oil_change_km + 15000 : 0);
  const kmUntilOil = oilNextKm ? oilNextKm - vehicle.current_km : null;
  const isOilUrgent = kmUntilOil !== null && kmUntilOil <= 1000;

  // Cálculo de alerta de pneus
  const tireNextKm = vehicle.next_tire_change_km || (vehicle.last_tire_change_km ? vehicle.last_tire_change_km + 40000 : 0);
  const kmUntilTires = tireNextKm ? tireNextKm - vehicle.current_km : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Botão Voltar e Cabeçalho do Veículo */}
      <div>
        <button
          onClick={onBack}
          className="btn-flat-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            padding: '8px 14px',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} /> Voltar para Lista de Carrinhas
        </button>

        <div
          className="content-panel"
          style={{
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                position: 'relative',
                width: 76,
                height: 76,
                borderRadius: 12,
                overflow: 'hidden',
                border: '2px solid var(--border-color)',
                flexShrink: 0,
                cursor: 'pointer',
                backgroundColor: 'var(--bg-card-subtle)',
              }}
              onClick={() => {
                setNewPhotoUrl(vehicle.photo_url || '');
                setPhotoModalOpen(true);
              }}
              title="Clique para adicionar ou alterar a foto da carrinha"
            >
              {vehicle.photo_url ? (
                <img
                  src={vehicle.photo_url}
                  alt={vehicle.license_plate}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                  }}
                >
                  <Truck size={30} />
                  <span style={{ fontSize: 9, fontWeight: 700 }}>+ FOTO</span>
                </div>
              )}
              {vehicle.photo_url && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 700,
                    textAlign: 'center',
                    padding: '2px 0',
                  }}
                >
                  Alterar
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    padding: '3px 10px',
                    borderRadius: 6,
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '2px solid var(--primary)',
                    color: 'var(--text-main)',
                    letterSpacing: 1.5,
                  }}
                >
                  {vehicle.license_plate}
                </span>

                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {vehicle.brand} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
                </h1>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    backgroundColor:
                      vehicle.status === 'em_servico'
                        ? 'var(--success-subtle)'
                        : vehicle.status === 'em_manutencao'
                        ? 'var(--warning-subtle)'
                        : 'var(--primary-subtle)',
                    color:
                      vehicle.status === 'em_servico'
                        ? 'var(--success)'
                        : vehicle.status === 'em_manutencao'
                        ? 'var(--warning)'
                        : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    textTransform: 'uppercase',
                  }}
                >
                  {vehicle.status === 'em_servico'
                    ? 'Em Serviço'
                    : vehicle.status === 'em_manutencao'
                    ? 'Na Oficina'
                    : 'Parada / Reserva'}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setNewPhotoUrl(vehicle.photo_url || '');
                    setPhotoModalOpen(true);
                  }}
                  className="btn-flat-secondary"
                  style={{ padding: '4px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  title="Alterar ou adicionar foto desta viatura"
                >
                  <Camera size={13} />
                  {vehicle.photo_url ? 'Alterar Foto' : 'Adicionar Foto'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, color: 'var(--text-muted)', fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Gauge size={14} color="var(--primary)" />
                  <strong style={{ color: 'var(--text-main)' }}>{vehicle.current_km.toLocaleString('pt-PT')} km</strong> atuais
                </span>

                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={14} color="var(--primary)" />
                  Condutor: <strong style={{ color: 'var(--text-main)' }}>{vehicle.assigned_driver_name || 'Sem condutor fixo'}</strong>
                </span>

                {vehicle.assigned_site_name && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={14} color="var(--primary)" />
                    Obra: <strong style={{ color: 'var(--primary)' }}>{vehicle.assigned_site_name}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                padding: '6px 12px',
                borderRadius: 6,
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
              }}
            >
              {inventory.reduce((acc, curr) => acc + curr.quantity, 0)} itens a bordo
            </span>
          </div>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', gap: 8 }}>
        <button
          onClick={() => setActiveTab('geral')}
          style={{
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'geral' ? '3px solid var(--primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'geral' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Info size={16} />
          Informações Gerais
        </button>

        <button
          onClick={() => setActiveTab('inventario')}
          style={{
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'inventario' ? '3px solid var(--primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'inventario' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Package size={16} />
          Inventário da Carrinha ({inventory.length})
        </button>

        <button
          onClick={() => setActiveTab('manutencao')}
          style={{
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'manutencao' ? '3px solid var(--primary)' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'manutencao' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Wrench size={16} />
          Manutenção & Revisões
          {isOilUrgent && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--danger)' }} />
          )}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* ABA 1: INFORMAÇÕES GERAIS                                            */}
      {/* ==================================================================== */}
      {activeTab === 'geral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Cartões de Detalhes Técnicos & Prazos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="content-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginTop: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={16} color="var(--primary)" />
                Ficha Técnica da Carrinha
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Matrícula:</span>
                  <strong style={{ fontFamily: 'monospace' }}>{vehicle.license_plate}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Marca e Modelo:</span>
                  <strong>{vehicle.brand} {vehicle.model}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Combustível:</span>
                  <span>{vehicle.fuel_type || 'Gasóleo (Diesel)'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Quilometragem:</span>
                  <strong style={{ color: 'var(--primary)' }}>{vehicle.current_km.toLocaleString('pt-PT')} km</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ano de Fabrico:</span>
                  <span>{vehicle.year || 'Não especificado'}</span>
                </div>
              </div>
            </div>

            <div className="content-panel" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginTop: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color="var(--primary)" />
                Seguro & Inspeções Obrigatórias
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Próxima Inspeção (IPO):</span>
                  <strong>{vehicle.next_inspection_date ? new Date(vehicle.next_inspection_date).toLocaleDateString('pt-PT') : 'Não agendada'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Validade do Seguro:</span>
                  <strong>{vehicle.insurance_expiry_date ? new Date(vehicle.insurance_expiry_date).toLocaleDateString('pt-PT') : 'Não registado'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Revisão de Rotina aos:</span>
                  <strong>{vehicle.next_maintenance_km ? `${vehicle.next_maintenance_km.toLocaleString('pt-PT')} km` : 'Não definida'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Obra de Afetação:</span>
                  <span>{vehicle.assigned_site_name || 'Apoio Geral / Sede'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* PAINEL DE GESTÃO DO MOTORISTA E HISTÓRICO DE UTILIZAÇÃO */}
          <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <User size={18} color="var(--primary)" />
                  Condutor Responsável & Histórico de Utilização
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                  Controle da viatura {vehicle.license_plate}: motorista habitual e registo de colaboradores que a conduziram
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setNewDriverId(vehicle.assigned_driver_id || '');
                    setChangeDriverModalOpen(true);
                  }}
                  className="btn-flat-secondary"
                  style={{ padding: '7px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <User size={14} /> Alterar Motorista
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignDriverId(vehicle.assigned_driver_id || '');
                    setAssignDate(new Date().toISOString().slice(0, 10));
                    setAssignModalOpen(true);
                  }}
                  className="btn-flat-primary"
                  style={{ padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> + Registar Condução / Saída
                </button>
              </div>
            </div>

            {/* CARD DESTACADO: MOTORISTA HABITUAL / RESPONSÁVEL ATUAL */}
            <div
              style={{
                padding: '20px 24px',
                backgroundColor: 'var(--bg-card-subtle)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {(() => {
                  const currentDriver = employees.find(
                    (e) =>
                      e.id === vehicle.assigned_driver_id ||
                      (vehicle.assigned_driver_name &&
                        e.full_name.toLowerCase() === vehicle.assigned_driver_name.toLowerCase())
                  );
                  return (
                    <>
                      {currentDriver?.avatar_url ? (
                        <img
                          src={currentDriver.avatar_url}
                          alt={vehicle.assigned_driver_name || 'Motorista'}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid var(--primary)',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary-subtle)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            fontWeight: 800,
                            border: '2px solid var(--border-color)',
                            flexShrink: 0,
                          }}
                        >
                          {(vehicle.assigned_driver_name || 'M').charAt(0)}
                        </div>
                      )}

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>
                            {vehicle.assigned_driver_name || 'Sem Condutor Principal Definido'}
                          </span>
                          <span
                            className="badge-flat primary"
                            style={{ fontSize: 10, padding: '2px 8px', textTransform: 'uppercase' }}
                          >
                            Condutor Habitual
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          {currentDriver?.job_title || 'Colaborador da Empresa'}
                          {currentDriver?.phone ? ` • Tel: ${currentDriver.phone}` : ''}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Obra Habitual</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                    {vehicle.assigned_site_name || 'Apoio Geral / Sede'}
                  </div>
                </div>
                <div style={{ width: 1, height: 32, backgroundColor: 'var(--border-color)' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quilometragem</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                    {vehicle.current_km.toLocaleString('pt-PT')} km
                  </div>
                </div>
              </div>
            </div>

            {/* TABELA DE HISTÓRICO DE QUEM CONDUZIU */}
            <div style={{ padding: '16px 24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                  Registos de Quem Conduziu / Utilizou a Carrinha
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {assignments.length} {assignments.length === 1 ? 'registo' : 'registos'}
                </span>
              </div>

              {assignments.length === 0 ? (
                <div
                  style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: 8,
                    border: '1px dashed var(--border-color)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                    Nenhum registo de saída específico cadastrado.
                  </p>
                  <p style={{ margin: '4px 0 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                    A viatura é utilizada habitualmente pelo condutor responsável (<strong>{vehicle.assigned_driver_name || 'definido na viatura'}</strong>).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignDriverId(vehicle.assigned_driver_id || '');
                      setAssignDate(new Date().toISOString().slice(0, 10));
                      setAssignModalOpen(true);
                    }}
                    className="btn-flat-secondary"
                    style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> Registar Utilização em Dia Específico
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="flat-table" style={{ width: '100%', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>DATA</th>
                        <th>DIA DA SEMANA</th>
                        <th>CONDUTOR</th>
                        <th>TELEFONE</th>
                        <th>FINALIDADE / NOTAS</th>
                        <th style={{ textAlign: 'right' }}>AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((a) => {
                        const drv = employees.find((e) => e.id === a.driver_id || e.full_name === a.driver_name);
                        return (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              {a.date.split('-').reverse().join('/')}
                            </td>
                            <td style={{ textTransform: 'capitalize', color: 'var(--primary)', fontWeight: 600 }}>
                              {a.day_of_week}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {drv?.avatar_url ? (
                                  <img
                                    src={drv.avatar_url}
                                    alt={a.driver_name}
                                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: '50%',
                                      backgroundColor: 'var(--primary-subtle)',
                                      color: 'var(--primary)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 10,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {a.driver_name.charAt(0)}
                                  </div>
                                )}
                                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{a.driver_name}</span>
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-muted)' }}>
                              {a.driver_phone || drv?.phone || '-'}
                            </td>
                            <td>
                              <span style={{ color: a.notes ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                {a.notes || 'Deslocação e transporte de obra'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteAssignment(a.id)}
                                className="btn-flat-danger"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                title="Remover este registo"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* REPORTS ENVIADOS PELOS FUNCIONÁRIOS VIA APP */}
          <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="var(--primary)" />
                  Reports & Relatórios Enviados pelos Funcionários ({reports.length})
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Avarias, anomalias, limpeza, abastecimentos e alertas reportados pelo aplicativo móvel
                </p>
              </div>
            </div>

            {reports.length === 0 ? (
              <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Nenhum relatório enviado para esta carrinha até o momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {reports.map((rep) => {
                  const getReportBadge = (type: string) => {
                    switch (type) {
                      case 'anomalia':
                        return { label: 'Avaria / Anomalia', bg: 'var(--danger-subtle)', text: 'var(--danger)' };
                      case 'manutencao':
                        return { label: 'Manutenção Necessária', bg: 'var(--warning-subtle)', text: 'var(--warning)' };
                      case 'abastecimento':
                        return { label: 'Abastecimento', bg: 'var(--primary-subtle)', text: 'var(--primary)' };
                      case 'limpeza':
                        return { label: 'Limpeza / Lavagem', bg: 'var(--success-subtle)', text: 'var(--success)' };
                      case 'km':
                        return { label: 'Registo de KM', bg: 'var(--primary-subtle)', text: 'var(--primary)' };
                      default:
                        return { label: 'Observação Geral', bg: 'var(--bg-card-subtle)', text: 'var(--text-main)' };
                    }
                  };
                  const badge = getReportBadge(rep.report_type);

                  return (
                    <div
                      key={rep.id}
                      style={{
                        padding: '16px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              backgroundColor: badge.bg,
                              color: badge.text,
                              textTransform: 'uppercase',
                            }}
                          >
                            {badge.label}
                          </span>
                          <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>
                            Reportado por: {rep.employee_name}
                          </strong>
                          {rep.current_km && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              • KM informado: <strong>{rep.current_km.toLocaleString('pt-PT')} km</strong>
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(rep.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                        {rep.description}
                      </div>

                      {rep.photos && rep.photos.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          {rep.photos.map((uri, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPreviewPhoto(uri)}
                              style={{
                                border: '1px solid var(--border-color)',
                                borderRadius: 6,
                                overflow: 'hidden',
                                padding: 0,
                                cursor: 'pointer',
                                backgroundColor: 'transparent',
                              }}
                              title="Ampliar foto do report"
                            >
                              <img
                                src={uri}
                                alt={`Foto ${idx + 1}`}
                                style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 2: INVENTÁRIO DA CARRINHA                                        */}
      {/* ==================================================================== */}
      {activeTab === 'inventario' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header do Inventário da Carrinha */}
          <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={18} color="var(--primary)" />
                  Itens e Ferramentas a Bordo da Carrinha ({inventory.length})
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Lista em tempo real de materiais e ferramentas carregados na carrinha {vehicle.license_plate}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setLoadStockModalOpen(true)}
                  className="btn-flat-primary"
                  style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <Plus size={16} /> Carregar Item do Estoque
                </button>
              </div>
            </div>

            {/* Tabela de Itens Carregados na Carrinha */}
            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
              <table className="flat-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Item / Ferramenta</th>
                    <th>Categoria</th>
                    <th>Qtd. a Bordo</th>
                    <th>Condição</th>
                    <th>Nº de Série</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        Nenhum item carregado nesta carrinha no momento. Clique em "Carregar Item do Estoque" acima ou o funcionário pode adicionar via app.
                      </td>
                    </tr>
                  ) : (
                    inventory.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.item_name}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.category}</span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: 'var(--primary)',
                              backgroundColor: 'var(--primary-subtle)',
                              padding: '2px 8px',
                              borderRadius: 6,
                            }}
                          >
                            {item.quantity} un.
                          </span>
                        </td>
                        <td>
                          <span className="badge-flat success" style={{ fontSize: 10 }}>
                            {item.condition || 'Bom'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {item.serial_number || '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVehicleItemId(item.item_id);
                              setTransferQuantity(String(item.quantity));
                              setReturnStockModalOpen(true);
                            }}
                            className="btn-flat-secondary"
                            style={{ padding: '5px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Devolver item para o estoque central"
                          >
                            <RotateCcw size={12} /> Devolver ao Estoque
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* HISTÓRICO DINÂMICO DE MOVIMENTAÇÕES (Quem pegou e quando) */}
          <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowRightLeft size={16} color="var(--primary)" />
                Histórico Dinâmico de Movimentações ({movements.length})
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Atualização em tempo real de quem colocou ou retirou itens desta carrinha (via aplicativo móvel ou site)
              </p>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
              <table className="flat-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Data & Hora</th>
                    <th>Tipo de Ação</th>
                    <th>Item Movimentado</th>
                    <th>Quantidade</th>
                    <th>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        Nenhuma movimentação registada para esta carrinha ainda.
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => {
                      const isLoad = mov.movement_type === 'carregar';
                      return (
                        <tr key={mov.id}>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {new Date(mov.timestamp).toLocaleString('pt-PT')}
                          </td>
                          <td>
                            <span
                              className={`badge-flat ${isLoad ? 'primary' : 'warning'}`}
                              style={{ fontSize: 10, padding: '2px 8px' }}
                            >
                              {isLoad ? 'CARREGOU NA CARRINHA' : 'DEVOLVEU AO ESTOQUE'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{mov.item_name}</td>
                          <td>
                            <strong style={{ color: isLoad ? 'var(--primary)' : 'var(--warning)' }}>
                              {isLoad ? `+${mov.quantity}` : `-${mov.quantity}`} un.
                            </strong>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{mov.employee_name}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 3: MANUTENÇÃO & REVISÕES (ÓLEO, PNEUS, TRAVÕES, IPO)              */}
      {/* ==================================================================== */}
      {activeTab === 'manutencao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Cartões de Indicadores Preventivos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Troca de Óleo */}
            <div
              className="content-panel"
              style={{
                padding: 20,
                borderLeft: isOilUrgent ? '4px solid var(--danger)' : '4px solid var(--primary)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Fuel size={18} color="var(--primary)" />
                  Troca de Óleo & Filtros
                </h3>
                {isOilUrgent ? (
                  <span className="badge-flat danger" style={{ fontSize: 10 }}>URGENTE / PRÓXIMO</span>
                ) : (
                  <span className="badge-flat success" style={{ fontSize: 10 }}>EM DIA</span>
                )}
              </div>

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Última troca feita em:</span>
                  <strong>{vehicle.last_oil_change_date ? new Date(vehicle.last_oil_change_date).toLocaleDateString('pt-PT') : 'Não registada'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>KM da última troca:</span>
                  <span>{vehicle.last_oil_change_km ? `${vehicle.last_oil_change_km.toLocaleString('pt-PT')} km` : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Próxima troca obrigatória:</span>
                  <strong style={{ color: isOilUrgent ? 'var(--danger)' : 'var(--primary)' }}>
                    {oilNextKm ? `${oilNextKm.toLocaleString('pt-PT')} km` : 'Aos 15.000 km'}
                  </strong>
                </div>
                {kmUntilOil !== null && (
                  <div style={{ marginTop: 4, fontSize: 11, color: isOilUrgent ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {kmUntilOil <= 0 ? 'Revisão ultrapassada!' : `Faltam aproximadamente ${kmUntilOil.toLocaleString('pt-PT')} km`}
                  </div>
                )}
              </div>
            </div>

            {/* Pneus & Alinhamento */}
            <div className="content-panel" style={{ padding: 20, borderLeft: '4px solid var(--warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wrench size={18} color="var(--warning)" />
                  Pneus & Alinhamento
                </h3>
                <span className="badge-flat warning" style={{ fontSize: 10 }}>MONITORIZAR</span>
              </div>

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Última substituição:</span>
                  <strong>{vehicle.last_tire_change_date ? new Date(vehicle.last_tire_change_date).toLocaleDateString('pt-PT') : 'Sem registo recente'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>KM da troca:</span>
                  <span>{vehicle.last_tire_change_km ? `${vehicle.last_tire_change_km.toLocaleString('pt-PT')} km` : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Próxima verificação/troca:</span>
                  <strong>{tireNextKm ? `${tireNextKm.toLocaleString('pt-PT')} km` : 'Aos 40.000 km'}</strong>
                </div>
                {kmUntilTires !== null && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    Estimativa restante: {kmUntilTires.toLocaleString('pt-PT')} km
                  </div>
                )}
              </div>
            </div>

            {/* Travões & Segurança Geral */}
            <div className="content-panel" style={{ padding: 20, borderLeft: '4px solid var(--success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={18} color="var(--success)" />
                  Pastilhas & Travões
                </h3>
                <span className="badge-flat success" style={{ fontSize: 10 }}>REGULAR</span>
              </div>

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Última revisão de travões:</span>
                  <strong>{vehicle.last_brakes_check_date ? new Date(vehicle.last_brakes_check_date).toLocaleDateString('pt-PT') : 'Não registada'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Próxima checagem:</span>
                  <strong>{vehicle.next_brakes_check_km ? `${vehicle.next_brakes_check_km.toLocaleString('pt-PT')} km` : 'A cada 30.000 km'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Inspeção Periódica (IPO):</span>
                  <strong>{vehicle.next_inspection_date ? new Date(vehicle.next_inspection_date).toLocaleDateString('pt-PT') : 'Não agendada'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico Completo de Serviços e Manutenções */}
          <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wrench size={18} color="var(--primary)" />
                  Histórico de Intervenções & Manutenções ({maintenanceRecords.length})
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Registo detalhado de revisões, trocas de peças, custos de oficina e quilometragens
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAddMaintenanceModalOpen(true)}
                className="btn-flat-primary"
                style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <Plus size={16} /> Registar Nova Manutenção
              </button>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
              <table className="flat-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Data do Serviço</th>
                    <th>Tipo de Intervenção</th>
                    <th>KM no Momento</th>
                    <th>Próxima Prevista</th>
                    <th>Oficina / Fornecedor</th>
                    <th>Custo (€)</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        Nenhuma manutenção registada ainda. Clique em "Registar Nova Manutenção" acima para adicionar trocas de óleo, pneus ou revisões.
                      </td>
                    </tr>
                  ) : (
                    maintenanceRecords.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{new Date(m.performed_at).toLocaleDateString('pt-PT')}</strong>
                        </td>
                        <td>
                          <span className="badge-flat primary" style={{ fontSize: 10 }}>
                            {m.title || m.item_type.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <strong>{m.performed_km.toLocaleString('pt-PT')} km</strong>
                        </td>
                        <td>
                          {m.next_due_km ? `${m.next_due_km.toLocaleString('pt-PT')} km` : '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: 12 }}>{m.service_provider || 'Oficina / Interno'}</span>
                        </td>
                        <td>
                          {m.cost ? (
                            <strong style={{ color: 'var(--text-main)' }}>{m.cost.toFixed(2)} €</strong>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.description || '—'}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CARREGAR ITEM DO ESTOQUE CENTRAL PARA A CARRINHA           */}
      {/* ==================================================================== */}
      {loadStockModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 520, width: '100%', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Carregar Item na Carrinha {vehicle.license_plate}
                </h3>
              </div>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{ padding: 4 }}
                onClick={() => setLoadStockModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLoadItem} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Item do Estoque Central *</label>
                <select
                  required
                  value={selectedStockItemId}
                  onChange={(e) => setSelectedStockItemId(e.target.value)}
                  style={{ padding: '9px 12px' }}
                >
                  <option value="">Selecione um item disponível...</option>
                  {centralStock
                    .filter((i) => i.available_quantity > 0)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category}) — Disponível: {item.available_quantity} un.
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Quantidade a Carregar *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(e.target.value)}
                    style={{ padding: '9px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Responsável pelo Carregamento</label>
                  <input
                    type="text"
                    value={transferOperatorName}
                    onChange={(e) => setTransferOperatorName(e.target.value)}
                    style={{ padding: '9px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setLoadStockModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" style={{ fontWeight: 700 }}>
                  Confirmar e Carregar na Carrinha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: DEVOLVER ITEM DA CARRINHA PARA O ESTOQUE CENTRAL            */}
      {/* ==================================================================== */}
      {returnStockModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 480, width: '100%', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={20} color="var(--warning)" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Devolver Item ao Estoque Central
                </h3>
              </div>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{ padding: 4 }}
                onClick={() => setReturnStockModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReturnItem} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Este item será retirado da carrinha <strong>{vehicle.license_plate}</strong> e somado de volta ao estoque central disponível.
              </p>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Quantidade a Devolver *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  style={{ padding: '9px 12px' }}
                />
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Responsável pela Devolução</label>
                <input
                  type="text"
                  value={transferOperatorName}
                  onChange={(e) => setTransferOperatorName(e.target.value)}
                  style={{ padding: '9px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setReturnStockModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" style={{ fontWeight: 700 }}>
                  Confirmar Devolução
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: REGISTAR MANUTENÇÃO / REVISÃO                               */}
      {/* ==================================================================== */}
      {addMaintenanceModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 520, width: '100%', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wrench size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Registar Manutenção / Revisão
                </h3>
              </div>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{ padding: 4 }}
                onClick={() => setAddMaintenanceModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Tipo de Serviço *</label>
                  <select
                    value={maintType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setMaintType(val);
                      if (val === 'oleo') {
                        setMaintTitle('Troca de Óleo e Filtros');
                        setMaintNextKm(String((parseInt(maintKm, 10) || vehicle.current_km) + 15000));
                      } else if (val === 'pneus') {
                        setMaintTitle('Troca / Alinhamento de Pneus');
                        setMaintNextKm(String((parseInt(maintKm, 10) || vehicle.current_km) + 40000));
                      } else if (val === 'travoes') {
                        setMaintTitle('Substituição de Pastilhas / Travões');
                        setMaintNextKm(String((parseInt(maintKm, 10) || vehicle.current_km) + 30000));
                      } else if (val === 'ipo') {
                        setMaintTitle('Inspeção Periódica Obrigatória');
                      } else {
                        setMaintTitle('Revisão Geral / Reparação');
                      }
                    }}
                    style={{ padding: '8px 12px' }}
                  >
                    <option value="oleo">Troca de Óleo & Filtros</option>
                    <option value="pneus">Pneus & Alinhamento</option>
                    <option value="travoes">Pastilhas & Travões</option>
                    <option value="revisao_geral">Revisão Geral</option>
                    <option value="ipo">Inspeção IPO</option>
                    <option value="outro">Outra Reparação</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Data do Serviço *</label>
                  <input
                    type="date"
                    required
                    value={maintDate}
                    onChange={(e) => setMaintDate(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Título / Descrição Curta *</label>
                <input
                  type="text"
                  required
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>KM no Momento do Serviço *</label>
                  <input
                    type="number"
                    required
                    value={maintKm}
                    onChange={(e) => setMaintKm(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Próxima Revisão Prevista (KM)</label>
                  <input
                    type="number"
                    value={maintNextKm}
                    onChange={(e) => setMaintNextKm(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Custo do Serviço (€)</label>
                  <input
                    type="text"
                    placeholder="Ex: 145.50"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Oficina / Fornecedor</label>
                  <input
                    type="text"
                    placeholder="Ex: PneuCity, Mecânica Central..."
                    value={maintProvider}
                    onChange={(e) => setMaintProvider(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Observações / Peças Trocadas</label>
                <textarea
                  rows={2}
                  placeholder="Detalhes das peças, garantia ou alertas para a próxima revisão..."
                  value={maintNotes}
                  onChange={(e) => setMaintNotes(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setAddMaintenanceModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" style={{ fontWeight: 700 }}>
                  Salvar Manutenção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: ATRIBUIR RESPONSÁVEL EM DIA DA SEMANA                       */}
      {/* ==================================================================== */}
      {assignModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 480, width: '100%', padding: 24, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Atribuir Responsável da Carrinha
                </h3>
              </div>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{ padding: 4 }}
                onClick={() => setAssignModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveWeeklyAssignment} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Dia da Semana *</label>
                  <select
                    value={assignDayOfWeek}
                    onChange={(e) => setAssignDayOfWeek(e.target.value)}
                    style={{ padding: '9px 12px' }}
                  >
                    {daysOfWeek.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Data Específica *</label>
                  <input
                    type="date"
                    required
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    style={{ padding: '9px 12px' }}
                  />
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Colaborador / Motorista *</label>
                <select
                  required
                  value={assignDriverId}
                  onChange={(e) => setAssignDriverId(e.target.value)}
                  style={{ padding: '9px 12px' }}
                >
                  <option value="">Selecione o colaborador...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.job_title})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Notas / Destino / Turno</label>
                <input
                  type="text"
                  placeholder="Ex: Turno da manhã, transporte de materiais para Obra Centro..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  style={{ padding: '9px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setAssignModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary" style={{ fontWeight: 700 }}>
                  Salvar Atribuição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ALTERAR FOTO DE PERFIL DA CARRINHA                            */}
      {/* ==================================================================== */}
      {photoModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setPhotoModalOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={18} color="var(--primary)" />
                Foto de Perfil da Carrinha
              </h3>
              <button className="btn-flat-secondary" onClick={() => setPhotoModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSavePhoto} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                {newPhotoUrl ? (
                  <img
                    src={newPhotoUrl}
                    alt="Prévia Carrinha"
                    style={{
                      width: '100%',
                      height: 180,
                      borderRadius: 8,
                      objectFit: 'cover',
                      border: '2px solid var(--border-color)',
                      marginBottom: 8,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: 140,
                      borderRadius: 8,
                      backgroundColor: 'var(--primary-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      marginBottom: 8,
                      border: '1px dashed var(--border-color)',
                    }}
                  >
                    <Truck size={40} />
                    <span style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>Nenhuma foto definida</span>
                  </div>
                )}
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>URL da Foto da Carrinha</label>
                <input
                  type="url"
                  required
                  placeholder="https://... (URL da imagem da viatura)"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  style={{ padding: '9px 12px' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  Cole o link direto da imagem hospedada (ex: Cloudinary, Imgur, ou outro servidor).
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {vehicle.photo_url && (
                  <button
                    type="button"
                    className="btn-flat-danger"
                    onClick={async () => {
                      if (!confirm('Deseja remover a foto da viatura?')) return;
                      setSavingPhoto(true);
                      try {
                        const updated = await saveVehicle({ ...vehicle, photo_url: null }, companyId);
                        setVehicle(updated);
                        onVehicleUpdated(updated);
                        setPhotoModalOpen(false);
                        setNewPhotoUrl('');
                        showNotice('Foto removida!');
                      } finally {
                        setSavingPhoto(false);
                      }
                    }}
                    style={{ marginRight: 'auto', fontSize: 12 }}
                  >
                    Remover Foto
                  </button>
                )}
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setPhotoModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={savingPhoto} className="btn-flat-primary" style={{ fontWeight: 700 }}>
                  {savingPhoto ? 'A guardar...' : 'Guardar Foto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ALTERAR MOTORISTA PRINCIPAL                                   */}
      {/* ==================================================================== */}
      {changeDriverModalOpen && (
        <div className="flat-modal-backdrop" onClick={() => setChangeDriverModalOpen(false)}>
          <div className="flat-modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} color="var(--primary)" />
                Alterar Motorista Habitual
              </h3>
              <button className="btn-flat-secondary" onClick={() => setChangeDriverModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Selecione o Colaborador Responsável</label>
                <select
                  value={newDriverId}
                  onChange={(e) => setNewDriverId(e.target.value)}
                  style={{ padding: '10px 12px' }}
                >
                  <option value="">Nenhum motorista fixo (viatura em reserva / pátio)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.job_title})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  O colaborador selecionado será o condutor responsável habitual desta viatura e terá acesso prioritário aos reports no aplicativo móvel.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setChangeDriverModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={savingDriver} className="btn-flat-primary" style={{ fontWeight: 700 }}>
                  {savingDriver ? 'A guardar...' : 'Confirmar Motorista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: PRÉ-VISUALIZAÇÃO DE FOTO DO REPORT                         */}
      {/* ==================================================================== */}
      {previewPhoto && (
        <div
          className="flat-modal-backdrop"
          onClick={() => setPreviewPhoto(null)}
          style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={previewPhoto}
              alt="Anexo Ampliado"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
            />
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
