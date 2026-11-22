import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Lock,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
  FileText,
  Upload,
  Download,
  Package,
  Boxes,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import {
  addSiteDailyLog,
  createSiteTask,
  deleteTask,
  getSiteDailyLogs,
  getSiteTasks,
  updateTaskStatus,
  getSiteDocuments,
  saveSiteDocument,
  deleteSiteDocument,
  getSiteInventory,
  allocateItemToSite,
  returnItemFromSite,
  getInventoryItems,
  getFinancialRecords,
  getSiteMeasurements,
  getSiteFinancialConfigs,
} from '../lib/supabase';
import {
  ConstructionSite,
  EmployeeProfile,
  SiteDailyLog,
  SiteTask,
  SiteDocument,
  InventoryItem,
  FinancialRecord,
  SiteMeasurement,
} from '../types';
import {
  computeSiteProfitability,
  formatDatePt,
  formatEuro,
  getCategoryDefinition,
  getEffectivePaidAmount,
  getEffectiveRemainingAmount,
} from '../lib/financialCalculations';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { DOCUMENT_MIME_TYPES, toSafeExternalUrl, validateUploadFile } from '../lib/urlSafety';
import { customConfirm, customAlert } from '../context/DialogContext';

interface SiteDetailPageProps {
  site: ConstructionSite;
  employees: EmployeeProfile[];
  financialRecords?: FinancialRecord[];
  onBack: () => void;
  onOpenFinancialModule?: () => void;
  showNotice?: (msg: string) => void;
}

export const SiteDetailPage: React.FC<SiteDetailPageProps> = ({
  site,
  employees,
  financialRecords,
  onBack,
  onOpenFinancialModule,
  showNotice,
}) => {
  const [tasks, setTasks] = useState<SiteTask[]>([]);
  const [dailyLogs, setDailyLogs] = useState<SiteDailyLog[]>([]);
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [siteMaterials, setSiteMaterials] = useState<InventoryItem[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<InventoryItem[]>([]);
  const [siteFinRecords, setSiteFinRecords] = useState<FinancialRecord[]>([]);
  const [siteMeasurements, setSiteMeasurements] = useState<SiteMeasurement[]>([]);
  const [activeTab, setActiveTab] = useState<'tarefas' | 'diario' | 'documentos' | 'materiais' | 'financeiro'>('tarefas');

  // Modal Documento
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('Contrato de Empreitada');
  const [docFileUrl, setDocFileUrl] = useState('');
  const [docFileSize, setDocFileSize] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);

  // Modal Alocação de Material
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [selectedStockItemId, setSelectedStockItemId] = useState('');
  const [allocateQty, setAllocateQty] = useState(1);
  const [allocatingMat, setAllocatingMat] = useState(false);

  // Modal Devolução de Material
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState<InventoryItem | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returningMat, setReturningMat] = useState(false);

  // Modal Nova Tarefa
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedEmpId, setAssignedEmpId] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Modal Novo Diário
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logSummary, setLogSummary] = useState('');
  const [workersCount, setWorkersCount] = useState('2');
  const [weather, setWeather] = useState('Ensolarado');

  // Modal Visualizar Fotos
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  // Modal Confirmação do Chefe
  const [confirmModalTask, setConfirmModalTask] = useState<SiteTask | null>(null);
  const [bossNameInput, setBossNameInput] = useState('');
  const [approveForClient, setApproveForClient] = useState(true);

  const loadSiteData = async () => {
    try {
      const [t, l, d, sm, wh, fin, meas] = await Promise.all([
        getSiteTasks(site.id),
        getSiteDailyLogs(site.id),
        getSiteDocuments(site.id),
        getSiteInventory(site.id, site.company_id || undefined),
        getInventoryItems(site.company_id || undefined),
        getFinancialRecords(site.company_id || undefined),
        getSiteMeasurements(site.company_id || undefined, site.id),
      ]);
      setTasks(t);
      setDailyLogs(l);
      setDocuments(d);
      setSiteMaterials(sm);
      setWarehouseStock(wh);
      setSiteFinRecords(fin.filter((r) => r.site_id === site.id && r.status !== 'cancelado'));
      setSiteMeasurements(meas);
    } catch (err) {
      console.error('Erro ao carregar dados da obra:', err);
    }
  };

  useEffect(() => {
    loadSiteData();
  }, [site.id, financialRecords?.length]);

  const siteProfitability = React.useMemo(() => {
    const configs = getSiteFinancialConfigs(site.company_id || undefined);
    const activeRecs =
      financialRecords && financialRecords.length > 0
        ? financialRecords.filter((r) => r.site_id === site.id && r.status !== 'cancelado')
        : siteFinRecords;
    return computeSiteProfitability(site, activeRecs, siteMeasurements, configs);
  }, [site, financialRecords, siteFinRecords, siteMeasurements]);

  // Handlers de Documentos
  const handleDocFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateUploadFile(file, {
      maxSizeMb: 10,
      allowedMimeTypes: DOCUMENT_MIME_TYPES,
    });
    if (!check.valid) {
      await customAlert({
        title: 'Ficheiro Inválido',
        message: check.error,
        type: 'warning',
      });
      return;
    }
    setUploadingDoc(true);
    try {
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;
      setDocFileSize(sizeStr);

      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const url = await uploadImageToCloudinary(base64, 'castello_docs');
          setDocFileUrl(url);
          if (!docName.trim()) {
            setDocName(file.name.replace(/\.[^/.]+$/, ''));
          }
        } catch (err: any) {
          await customAlert({
            title: 'Erro no Upload',
            message: err?.message || 'Não foi possível enviar o documento para a nuvem.',
            type: 'error',
          });
        } finally {
          setUploadingDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingDoc(false);
      alert('Erro ao processar ficheiro.');
    }
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) {
      alert('Por favor introduza o nome do documento.');
      return;
    }
    setSavingDoc(true);
    try {
      await saveSiteDocument({
        site_id: site.id,
        name: docName.trim(),
        doc_type: docType,
        file_url: docFileUrl.trim() || null,
        file_size: docFileSize || 'PDF / Digital',
        uploaded_at: new Date().toISOString().slice(0, 10),
        status: 'disponivel',
      });
      await loadSiteData();
      setDocModalOpen(false);
      setDocName('');
      setDocFileUrl('');
      setDocFileSize('');
      if (showNotice) showNotice('Documento anexado com sucesso e visível para o cliente!');
    } catch (err: any) {
      alert('Erro ao guardar documento: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const confirmed = await customConfirm({
      title: 'Eliminar Documento',
      message: 'Tem a certeza que deseja eliminar este documento da obra?',
      type: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await deleteSiteDocument(site.id, docId);
      await loadSiteData();
      if (showNotice) showNotice('Documento removido.');
    } catch (err: any) {
      customAlert({
        title: 'Erro ao Eliminar',
        message: 'Erro ao eliminar documento: ' + (err.message || 'Tente novamente.'),
        type: 'error',
      });
    }
  };

  // Handlers de Materiais
  const handleAllocateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockItemId) {
      alert('Selecione um material do armazém.');
      return;
    }
    const item = warehouseStock.find((i) => i.id === selectedStockItemId);
    if (!item) return;
    if (allocateQty <= 0 || allocateQty > item.available_quantity) {
      alert(`Quantidade inválida. Quantidade máxima disponível em armazém: ${item.available_quantity}`);
      return;
    }

    setAllocatingMat(true);
    try {
      await allocateItemToSite(
        item.id,
        site.id,
        site.name,
        Number(allocateQty),
        site.company_id || undefined
      );
      await loadSiteData();
      setAllocateModalOpen(false);
      setSelectedStockItemId('');
      setAllocateQty(1);
      if (showNotice) showNotice('Material alocado com sucesso a esta obra!');
    } catch (err: any) {
      alert('Erro ao alocar material: ' + (err.message || 'Tente novamente.'));
    } finally {
      setAllocatingMat(false);
    }
  };

  const handleReturnMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnItem) return;
    const maxQty = selectedReturnItem.allocated_quantity || 0;
    if (returnQty <= 0 || returnQty > maxQty) {
      alert(`Quantidade inválida. Quantidade alocada nesta obra: ${maxQty}`);
      return;
    }

    setReturningMat(true);
    try {
      await returnItemFromSite(
        selectedReturnItem.id,
        site.id,
        Number(returnQty),
        site.company_id || undefined
      );
      await loadSiteData();
      setReturnModalOpen(false);
      setSelectedReturnItem(null);
      setReturnQty(1);
      if (showNotice) showNotice('Material devolvido ao armazém central.');
    } catch (err: any) {
      alert('Erro ao devolver material: ' + (err.message || 'Tente novamente.'));
    } finally {
      setReturningMat(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const assignedEmp = employees.find((x) => x.id === assignedEmpId);
    const assignedName = assignedEmp ? assignedEmp.full_name : undefined;

    await createSiteTask(
      site.id,
      taskTitle,
      taskDesc,
      assignedName,
      dueDate || undefined,
      site.company_id || undefined,
      assignedEmpId || undefined
    );

    setTaskTitle('');
    setTaskDesc('');
    setAssignedEmpId('');
    setDueDate('');
    setTaskModalOpen(false);
    await loadSiteData();
  };

  const handleCreateDailyLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logSummary.trim()) return;
    await addSiteDailyLog(
      site.id,
      logSummary,
      parseInt(workersCount, 10) || 1,
      weather
    );
    setLogSummary('');
    setLogModalOpen(false);
    await loadSiteData();
  };

  const handleWorkerCompleteTask = async (taskId: string) => {
    const worker = prompt('Nome do colaborador que concluiu a tarefa:') || 'Colaborador';
    try {
      await updateTaskStatus(taskId, 'concluida_funcionario', worker);
    } catch (err) {
      console.warn('Erro ao concluir tarefa:', err);
    } finally {
      await loadSiteData();
    }
  };

  const handleOpenConfirmModal = (task: SiteTask) => {
    setConfirmModalTask(task);
    setBossNameInput(site.manager_name || 'Encarregado da Obra');
    setApproveForClient(true);
  };

  const handleExecuteBossConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmModalTask) return;
    try {
      await updateTaskStatus(
        confirmModalTask.id,
        'confirmada_chefe',
        bossNameInput.trim() || 'Chefe de Obra',
        undefined,
        approveForClient
      );
    } catch (err) {
      console.warn('Erro ao aprovar tarefa:', err);
    } finally {
      setConfirmModalTask(null);
      await loadSiteData();
    }
  };

  const handleOpenClientPage = () => {
    const clientUrl = `${window.location.origin}${window.location.pathname}?obra=${site.share_code}`;
    window.location.href = clientUrl;
  };

  // Contadores
  const pendingTasks = tasks.filter((t) => t.status === 'pendente').length;
  const waitingConfirmTasks = tasks.filter((t) => t.status === 'concluida_funcionario').length;
  const completedTasks = tasks.filter((t) => t.status === 'confirmada_chefe').length;

  return (
    <div>
      {/* Barra de Topo da Obra */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <button className="btn-flat-secondary" onClick={onBack}>
          ← Voltar à Lista de Obras
        </button>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn-flat-primary"
            onClick={handleOpenClientPage}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ExternalLink size={15} />
            Página do Cliente
          </button>
        </div>
      </div>

      {/* Cartão de Resumo da Obra */}
      <div className="content-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
                {site.name}
              </h1>
              <span className="badge-flat primary" style={{ fontFamily: 'monospace' }}>
                CÓDIGO: {site.share_code}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} /> {site.address}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              className={`badge-flat ${
                site.status === 'ativa' ? 'success' : site.status === 'pausada' ? 'warning' : 'primary'
              }`}
            >
              ESTADO: {site.status.toUpperCase()}
            </span>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              Encarregado: <strong>{site.manager_name || 'Não definido'}</strong>
            </div>
          </div>
        </div>

        {site.description && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
            {site.description}
          </p>
        )}
      </div>

      {/* KPIs de Tarefas da Obra */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        <div className="kpi-box">
          <div className="kpi-label">Tarefas por Fazer</div>
          <div className="kpi-value" style={{ color: 'var(--warning)' }}>
            {pendingTasks}
          </div>
          <div className="kpi-detail">Pendente de execução pelos funcionários</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Aguardando Validação</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            {waitingConfirmTasks}
          </div>
          <div className="kpi-detail">Funcionário concluiu, requer confirmação do chefe</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Tarefas Confirmadas</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            {completedTasks}
          </div>
          <div className="kpi-detail">Concluídas e validadas pela gestão</div>
        </div>
      </div>

      {/* Navegação entre Tarefas, Diário de Bordo, Documentos e Materiais */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          className={`btn-flat-secondary ${activeTab === 'tarefas' ? 'active' : ''}`}
          style={{
            backgroundColor: activeTab === 'tarefas' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'tarefas' ? '#ffffff' : 'var(--text-main)',
          }}
          onClick={() => setActiveTab('tarefas')}
        >
          Tarefas da Obra ({tasks.length})
        </button>

        <button
          className={`btn-flat-secondary ${activeTab === 'diario' ? 'active' : ''}`}
          style={{
            backgroundColor: activeTab === 'diario' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'diario' ? '#ffffff' : 'var(--text-main)',
          }}
          onClick={() => setActiveTab('diario')}
        >
          Diário de Bordo ({dailyLogs.length})
        </button>

        <button
          className={`btn-flat-secondary ${activeTab === 'documentos' ? 'active' : ''}`}
          style={{
            backgroundColor: activeTab === 'documentos' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'documentos' ? '#ffffff' : 'var(--text-main)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          onClick={() => setActiveTab('documentos')}
        >
          <FileText size={15} />
          Documentos ({documents.length})
        </button>

        <button
          className={`btn-flat-secondary ${activeTab === 'materiais' ? 'active' : ''}`}
          style={{
            backgroundColor: activeTab === 'materiais' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'materiais' ? '#ffffff' : 'var(--text-main)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          onClick={() => setActiveTab('materiais')}
        >
          <Boxes size={15} />
          Materiais na Obra ({siteMaterials.length})
        </button>

        <button
          className={`btn-flat-secondary ${activeTab === 'financeiro' ? 'active' : ''}`}
          style={{
            backgroundColor: activeTab === 'financeiro' ? 'var(--primary)' : 'var(--bg-card)',
            color: activeTab === 'financeiro' ? '#ffffff' : 'var(--text-main)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          onClick={() => setActiveTab('financeiro')}
        >
          <DollarSign size={15} />
          Resumo Financeiro ({formatEuro(siteProfitability.cashBalance)})
        </button>
      </div>

      {/* ABA 1: TAREFAS */}
      {activeTab === 'tarefas' && (
        <div className="content-panel">
          <div className="panel-header-inline">
            <div>
              <h2 className="panel-title">Lista de Tarefas da Obra</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                O funcionário clica em "Concluir Tarefa" e o encarregado/chefe confirma
              </p>
            </div>
            <button className="btn-flat-primary" onClick={() => setTaskModalOpen(true)}>
              <Plus size={16} /> Adicionar Tarefa
            </button>
          </div>

          <div className="flat-table-wrap">
            <table className="flat-table">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Designado a</th>
                  <th>Prazo</th>
                  <th>Estado</th>
                  <th>Conclusão & Confirmação</th>
                  <th style={{ textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Nenhuma tarefa criada para esta obra. Clique em "Adicionar Tarefa".
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{task.title}</div>
                        {task.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {task.description}
                          </div>
                        )}
                        {task.completion_photos && task.completion_photos.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Camera size={12} /> {task.completion_photos.length} foto{task.completion_photos.length > 1 ? 's' : ''}:
                            </span>
                            {task.completion_photos.map((photoUrl, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => setViewingPhotoUrl(photoUrl)}
                                style={{
                                  padding: 0,
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 4,
                                  overflow: 'hidden',
                                  width: 26,
                                  height: 26,
                                  cursor: 'pointer',
                                  backgroundColor: 'var(--bg-card)',
                                }}
                                title="Clique para ampliar foto do serviço"
                              >
                                <img
                                  src={photoUrl}
                                  alt="Serviço"
                                  width={80}
                                  height={80}
                                  loading="lazy"
                                  decoding="async"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {task.assigned_to_name ? (
                          <div>
                            <span
                              className="badge-flat warning"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                              title="Configurada para ser vista apenas por este colaborador no app móvel"
                            >
                              <Lock size={10} />
                              {task.assigned_to_name}
                            </span>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              Exclusiva deste funcionário
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Qualquer colaborador
                          </span>
                        )}
                      </td>
                      <td>{task.due_date ? task.due_date.split('-').reverse().join('/') : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span
                            className={`badge-flat ${
                              task.status === 'confirmada_chefe'
                                ? 'success'
                                : task.status === 'concluida_funcionario'
                                ? 'primary'
                                : 'warning'
                            }`}
                          >
                            {task.status === 'confirmada_chefe'
                              ? 'CONFIRMADA'
                              : task.status === 'concluida_funcionario'
                              ? 'AGUARDANDO CHEFE'
                              : 'PENDENTE'}
                          </span>
                          {task.status === 'confirmada_chefe' && task.show_to_client && (
                            <span className="badge-flat primary" style={{ fontSize: 10 }}>
                              No Portal do Cliente
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {task.status === 'concluida_funcionario' && (
                          <div style={{ fontSize: 11, color: 'var(--primary)' }}>
                            Concluído por: <strong>{task.completed_by_name}</strong>
                            {task.completion_photos && task.completion_photos.length > 0 && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {task.completion_photos.length} foto(s) anexada(s)
                              </div>
                            )}
                          </div>
                        )}
                        {task.status === 'confirmada_chefe' && (
                          <div style={{ fontSize: 11, color: 'var(--success)' }}>
                            Validado por: <strong>{task.confirmed_by_name}</strong>
                          </div>
                        )}
                        {task.status === 'pendente' && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aguardando início</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {task.status === 'pendente' && (
                            <button
                              className="btn-flat-secondary"
                              style={{ fontSize: 11 }}
                              onClick={() => handleWorkerCompleteTask(task.id)}
                            >
                              <CheckCircle2 size={13} color="var(--primary)" />
                              Concluir Tarefa
                            </button>
                          )}

                          {task.status === 'concluida_funcionario' && (
                            <button
                              className="btn-flat-success"
                              style={{ fontSize: 11 }}
                              onClick={() => handleOpenConfirmModal(task)}
                            >
                              <ShieldCheck size={13} />
                              Aprovar & Confirmar
                            </button>
                          )}

                          <button
                            className="btn-flat-danger"
                            onClick={async () => {
                              const confirmed = await customConfirm({
                                title: 'Excluir Tarefa',
                                message: `Tem certeza que deseja excluir a tarefa "${task.title}"?`,
                                type: 'danger',
                                confirmText: 'Excluir',
                                cancelText: 'Cancelar',
                              });
                              if (confirmed) {
                                await deleteTask(task.id);
                                await loadSiteData();
                              }
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: DIÁRIO DE BORDO */}
      {activeTab === 'diario' && (
        <div className="content-panel">
          <div className="panel-header-inline">
            <div>
              <h2 className="panel-title">Diário de Bordo da Obra</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Registos do que foi feito no dia. Ficam visíveis para o cliente no link compartilhado
              </p>
            </div>
            <button className="btn-flat-primary" onClick={() => setLogModalOpen(true)}>
              <Plus size={16} /> Novo Registo Diário
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dailyLogs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                Nenhum registo diário adicionado ainda.
              </p>
            ) : (
              dailyLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      Data: {log.log_date.split('-').reverse().join('/')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Efetivo: {log.workers_count} trabalhadores • Clima: {log.weather}
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {log.summary}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 3: DOCUMENTOS DA OBRA                                          */}
      {/* ================================================================== */}
      {activeTab === 'documentos' && (
        <div className="content-panel">
          <div className="panel-header-inline" style={{ marginBottom: 16 }}>
            <div>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--primary)" />
                Documentos & Contratos da Obra
              </h2>
              <p className="panel-subtitle">
                Faça o upload dos documentos e ficheiros que ficam acessíveis tanto para a gestão quanto para o cliente na sua página de acompanhamento
              </p>
            </div>
            <button
              className="btn-flat-primary"
              onClick={() => {
                setDocName('');
                setDocType('Contrato de Empreitada');
                setDocFileUrl('');
                setDocFileSize('');
                setDocModalOpen(true);
              }}
            >
              <Plus size={16} />
              Anexar Documento
            </button>
          </div>

          {documents.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 8,
                border: '1px dashed var(--border-color)',
              }}
            >
              <FileText size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>
                Nenhum documento anexado ainda
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                Anexe contratos, orçamentos, alvarás ou plantas da obra. Os ficheiros carregados aqui aparecem instantaneamente na aba de documentos do cliente.
              </p>
              <button
                className="btn-flat-primary"
                onClick={() => setDocModalOpen(true)}
                style={{ padding: '7px 16px', fontSize: 12 }}
              >
                <Upload size={14} /> Carregar Primeiro Documento
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="flat-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>
                    <th style={{ padding: '10px 14px' }}>Nome do Documento</th>
                    <th style={{ padding: '10px 14px' }}>Tipo</th>
                    <th style={{ padding: '10px 14px' }}>Data de Envio</th>
                    <th style={{ padding: '10px 14px' }}>Tamanho</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 6,
                              backgroundColor: 'var(--primary-subtle)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={16} />
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-main)', display: 'block' }}>
                              {doc.name}
                            </strong>
                            <span style={{ fontSize: 11, color: 'var(--success)' }}>
                              Disponível no Portal do Cliente
                            </span>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge-flat primary" style={{ fontSize: 11 }}>
                          {doc.doc_type}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                        {doc.uploaded_at ? doc.uploaded_at.split('-').reverse().join('/') : '-'}
                      </td>

                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                        {doc.file_size || 'Digital'}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {toSafeExternalUrl(doc.file_url) ? (
                            <a
                              href={toSafeExternalUrl(doc.file_url)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-flat-secondary"
                              style={{
                                padding: '5px 10px',
                                fontSize: 11,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                textDecoration: 'none',
                              }}
                              title="Abrir ou descarregar ficheiro"
                            >
                              <Download size={13} /> Abrir
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '5px 8px' }}>
                              Sem anexo
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="btn-icon"
                            style={{ padding: 6, color: 'var(--danger)' }}
                            title="Eliminar Documento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 4: MATERIAIS ALOCADOS NA OBRA                                  */}
      {/* ================================================================== */}
      {activeTab === 'materiais' && (
        <div className="content-panel">
          <div className="panel-header-inline" style={{ marginBottom: 16 }}>
            <div>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Boxes size={18} color="var(--primary)" />
                Materiais e Equipamentos na Obra
              </h2>
              <p className="panel-subtitle">
                Controle de ferramentas, máquinas e consumíveis enviados do armazém central para o estaleiro desta obra (visível na app e web)
              </p>
            </div>
            <button
              className="btn-flat-primary"
              onClick={() => {
                setSelectedStockItemId(warehouseStock.find((i) => i.available_quantity > 0)?.id || '');
                setAllocateQty(1);
                setAllocateModalOpen(true);
              }}
            >
              <Plus size={16} />
              Alocar Material do Armazém
            </button>
          </div>

          {siteMaterials.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 8,
                border: '1px dashed var(--border-color)',
              }}
            >
              <Boxes size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>
                Nenhum material alocado a esta obra
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                Aloque materiais, ferramentas ou equipamentos do seu inventário central para esta obra para que a equipa no local possa consultá-los no telemóvel.
              </p>
              <button
                className="btn-flat-primary"
                onClick={() => setAllocateModalOpen(true)}
                style={{ padding: '7px 16px', fontSize: 12 }}
              >
                <Plus size={14} /> Alocar Primeiro Material
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="flat-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>
                    <th style={{ padding: '10px 14px' }}>Material / Ferramenta</th>
                    <th style={{ padding: '10px 14px' }}>Categoria</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Qtd. na Obra</th>
                    <th style={{ padding: '10px 14px' }}>Estado / Condição</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {siteMaterials.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 6,
                              backgroundColor: 'var(--primary-subtle)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Package size={16} />
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-main)', display: 'block' }}>
                              {item.name}
                            </strong>
                            {item.serial_number && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                S/N: {item.serial_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge-flat secondary" style={{ fontSize: 11 }}>
                          {item.category}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: 'var(--primary)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            backgroundColor: 'var(--primary-subtle)',
                          }}
                        >
                          {item.allocated_quantity} un.
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: item.condition === 'novo' ? 'var(--success)' : 'var(--text-muted)',
                            textTransform: 'capitalize',
                          }}
                        >
                          {item.condition}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReturnItem(item);
                            setReturnQty(item.allocated_quantity || 1);
                            setReturnModalOpen(true);
                          }}
                          className="btn-flat-secondary"
                          style={{
                            padding: '5px 10px',
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="Devolver ao Armazém Central"
                        >
                          <ArrowRightLeft size={13} /> Devolver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 5: RESUMO FINANCEIRO DA OBRA (INTEGRADO COM MÓDULO FINANCEIRO) */}
      {activeTab === 'financeiro' && (
        <div className="content-panel">
          <div className="panel-header-inline">
            <div>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="var(--primary)" />
                Resumo Financeiro, Orçamento e Rentabilidade da Obra
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Dados sincronizados diretamente com o Centro de Gestão Financeira e Autos de Medição
              </p>
            </div>
            {onOpenFinancialModule && (
              <button className="btn-flat-primary" onClick={onOpenFinancialModule}>
                <DollarSign size={15} /> Abrir Módulo Financeiro Completo
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div className="kpi-box" style={{ borderTop: '3px solid #2563EB' }}>
              <div className="kpi-label">Valor Contratado (Cliente)</div>
              <div className="kpi-value" style={{ fontSize: 19 }}>
                {formatEuro(siteProfitability.contractedValue, true)}
              </div>
              <div className="kpi-detail">Receita contratual prevista</div>
            </div>

            <div className="kpi-box" style={{ borderTop: '3px solid #64748B' }}>
              <div className="kpi-label">Orçamento Interno de Custos</div>
              <div className="kpi-value" style={{ fontSize: 19 }}>
                {formatEuro(siteProfitability.costBudget, true)}
              </div>
              <div className="kpi-detail">
                Consumido/Comprometido: {siteProfitability.budgetCommittedPct.toFixed(1)}%
              </div>
            </div>

            <div className="kpi-box" style={{ borderTop: '3px solid #10B981' }}>
              <div className="kpi-label">Receitas Recebidas</div>
              <div className="kpi-value" style={{ fontSize: 19, color: '#10B981' }}>
                {formatEuro(siteProfitability.receivedRevenue, true)}
              </div>
              <div className="kpi-detail">
                Pendente a receber: {formatEuro(siteProfitability.pendingRevenue)}
              </div>
            </div>

            <div className="kpi-box" style={{ borderTop: '3px solid #EF4444' }}>
              <div className="kpi-label">Custos Realizados (Pagos)</div>
              <div className="kpi-value" style={{ fontSize: 19, color: '#EF4444' }}>
                {formatEuro(siteProfitability.realizedCosts, true)}
              </div>
              <div className="kpi-detail">
                Comprometidos a pagar: {formatEuro(siteProfitability.committedCosts)}
              </div>
            </div>

            <div className="kpi-box" style={{ borderTop: '3px solid #7C3AED' }}>
              <div className="kpi-label">Saldo de Caixa da Obra</div>
              <div
                className="kpi-value"
                style={{
                  fontSize: 19,
                  color: siteProfitability.cashBalance >= 0 ? '#2563EB' : '#EF4444',
                }}
              >
                {formatEuro(siteProfitability.cashBalance, true)}
              </div>
              <div className="kpi-detail">
                Margem Prevista: {siteProfitability.forecastMarginPct.toFixed(1)}% (
                {formatEuro(siteProfitability.forecastResult)})
              </div>
            </div>
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            Movimentações Financeiras desta Obra ({siteFinRecords.length})
          </h3>
          <div className="flat-table-wrap">
            <table className="flat-table">
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Entidade</th>
                  <th style={{ textAlign: 'right' }}>Valor (€)</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {siteFinRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Nenhum lançamento financeiro registado para esta obra.
                    </td>
                  </tr>
                ) : (
                  siteFinRecords.map((r) => {
                    const cat = getCategoryDefinition(r.category, r.type);
                    const paid = getEffectivePaidAmount(r);
                    const rem = getEffectiveRemainingAmount(r);
                    return (
                      <tr key={r.id}>
                        <td>{formatDatePt(r.due_date)}</td>
                        <td style={{ fontWeight: 700 }}>{r.title}</td>
                        <td>{cat.label}</td>
                        <td>{r.entity_name || '—'}</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color: r.type === 'receita' ? '#10B981' : '#EF4444',
                          }}
                        >
                          {r.type === 'receita' ? '+' : '-'} {formatEuro(r.amount, true)}
                          {r.status === 'parcial' && (
                            <div style={{ fontSize: 10.5, color: '#F59E0B' }}>
                              Pago: {formatEuro(paid)} • Restante: {formatEuro(rem)}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge-flat ${
                              r.status === 'pago'
                                ? 'success'
                                : r.status === 'parcial'
                                ? 'warning'
                                : 'primary'
                            }`}
                          >
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR TAREFA */}
      {taskModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box">
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Nova Tarefa para a Obra</h3>
              <button className="btn-flat-secondary" onClick={() => setTaskModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="flat-form-group">
                <label>Título da Tarefa *</label>
                <input
                  required
                  placeholder="Ex: Assentamento de azulejos no piso 2"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </div>

              <div className="flat-form-group">
                <label>Descrição / Instruções</label>
                <textarea
                  rows={2}
                  placeholder="Detalhes para os colaboradores..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                />
              </div>

              <div className="flat-form-grid">
                <div className="flat-form-group">
                  <label>Designar a Colaborador Específico</label>
                  <select
                    value={assignedEmpId}
                    onChange={(e) => setAssignedEmpId(e.target.value)}
                  >
                    <option value="">Aberto a todos (Qualquer colaborador vê)</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.job_title}) - Apenas ele verá
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Ao designar a um colaborador específico, apenas ele conseguirá ver e concluir esta tarefa no app móvel.
                  </p>
                </div>

                <div className="flat-form-group">
                  <label>Prazo de Execução</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setTaskModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary">
                  Gravar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTO DIÁRIO */}
      {logModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box">
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Novo Registo no Diário de Bordo</h3>
              <button className="btn-flat-secondary" onClick={() => setLogModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateDailyLog}>
              <div className="flat-form-group">
                <label>O que foi realizado hoje na obra? *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Ex: Concluída a impermeabilização da laje e iniciada a montagem dos quadros elétricos."
                  value={logSummary}
                  onChange={(e) => setLogSummary(e.target.value)}
                />
              </div>

              <div className="flat-form-grid">
                <div className="flat-form-group">
                  <label>Número de Trabalhadores no Local</label>
                  <input
                    type="number"
                    value={workersCount}
                    onChange={(e) => setWorkersCount(e.target.value)}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Condição Meteorológica</label>
                  <input
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    placeholder="Ensolarado, Chuva, etc."
                  />
                </div>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setLogModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary">
                  Salvar no Diário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHEFE APROVAR TAREFA & FOTOS */}
      {confirmModalTask && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 520 }}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">Aprovar e Confirmar Tarefa</h3>
              <button className="btn-flat-secondary" onClick={() => setConfirmModalTask(null)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleExecuteBossConfirm}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{confirmModalTask.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Concluída por: <strong>{confirmModalTask.completed_by_name}</strong>
                </div>
              </div>

              {/* Fotos do Serviço anexadas pelo funcionário */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Fotos do Serviço Enviadas pelo Colaborador:
                </label>
                {confirmModalTask.completion_photos && confirmModalTask.completion_photos.length > 0 ? (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {confirmModalTask.completion_photos.map((pUrl, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setViewingPhotoUrl(pUrl)}
                        title="Clique para ampliar"
                      >
                        <img src={pUrl} alt="Foto do serviço" width={160} height={120} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma foto anexada.</p>
                )}
              </div>

              <div className="flat-form-group">
                <label>Nome do Encarregado / Chefe Validador *</label>
                <input
                  required
                  value={bossNameInput}
                  onChange={(e) => setBossNameInput(e.target.value)}
                />
              </div>

              {/* Checkbox para exibir foto no portal do cliente */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  backgroundColor: 'var(--primary-subtle)',
                  borderRadius: 6,
                  border: '1px solid var(--primary-border)',
                  marginBottom: 16,
                }}
              >
                <input
                  type="checkbox"
                  id="clientPortalCheck"
                  checked={approveForClient}
                  onChange={(e) => setApproveForClient(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="clientPortalCheck" style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                  Aprovar foto para o site do cliente (Portal de Acompanhamento da Obra)
                </label>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setConfirmModalTask(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-success">
                  <ShieldCheck size={14} />
                  Confirmar e Aprovar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX EXPANDIR FOTO */}
      {viewingPhotoUrl && (
        <div
          className="flat-modal-backdrop"
          style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setViewingPhotoUrl(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
              onClick={() => setViewingPhotoUrl(null)}
            >
              <X size={28} />
            </button>
            <img
              src={viewingPhotoUrl}
              alt="Foto do Serviço"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: 8,
                objectFit: 'contain',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: ANEXAR NOVO DOCUMENTO                                       */}
      {/* ================================================================== */}
      {docModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 500, width: '95%' }}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--primary)" />
                Anexar Documento à Obra
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setDocModalOpen(false)}
                disabled={savingDoc}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveDocument}>
              <div className="flat-form-group">
                <label>Nome do Documento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Contrato Assinado, Orçamento Aprovado, Planta..."
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                />
              </div>

              <div className="flat-form-group">
                <label>Tipo de Documento *</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="Contrato de Empreitada">Contrato de Empreitada</option>
                  <option value="Orçamento Detalhado">Orçamento Detalhado</option>
                  <option value="Alvará / Licença">Alvará / Licença Camarária</option>
                  <option value="Projeto de Arquitetura">Projeto de Arquitetura / Plantas</option>
                  <option value="Certificado Energético">Certificado Energético / Segurança</option>
                  <option value="Aditamento / Auto">Aditamento / Auto de Medição</option>
                  <option value="Outro Documento">Outro Documento</option>
                </select>
              </div>

              <div className="flat-form-group">
                <label style={{ display: 'block', marginBottom: 6 }}>Ficheiro do Documento (Upload)</label>
                {docFileUrl ? (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={20} color="var(--primary)" />
                      <div>
                        <strong style={{ fontSize: 13, color: 'var(--text-main)', display: 'block' }}>
                          Ficheiro carregado com sucesso
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Tamanho: {docFileSize || 'Normal'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDocFileUrl('');
                        setDocFileSize('');
                      }}
                      className="btn-icon"
                      style={{ color: 'var(--danger)' }}
                      title="Remover ficheiro"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '24px 16px',
                      borderRadius: 8,
                      border: '2px dashed var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      cursor: uploadingDoc ? 'not-allowed' : 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      type="file"
                      accept=".pdf,image/*,.doc,.docx"
                      style={{ display: 'none' }}
                      disabled={uploadingDoc}
                      onChange={handleDocFileUpload}
                    />
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {uploadingDoc ? (
                        <div style={{ width: 18, height: 18, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      ) : (
                        <Upload size={18} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                        {uploadingDoc ? 'A enviar ficheiro para a nuvem...' : 'Clique para carregar o ficheiro (PDF ou Imagem)'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Upload direto do seu dispositivo
                      </div>
                    </div>
                  </label>
                )}
              </div>

              <div className="flat-modal-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setDocModalOpen(false)}
                  disabled={savingDoc}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-flat-primary"
                  disabled={savingDoc || uploadingDoc}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {savingDoc ? 'A guardar...' : 'Anexar à Obra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: ALOCAR MATERIAL DO ARMAZÉM                                  */}
      {/* ================================================================== */}
      {allocateModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 480, width: '95%' }}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Boxes size={18} color="var(--primary)" />
                Alocar Material do Armazém Central
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setAllocateModalOpen(false)}
                disabled={allocatingMat}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAllocateMaterial}>
              <div className="flat-form-group">
                <label>Selecionar Material / Ferramenta do Armazém *</label>
                <select
                  required
                  value={selectedStockItemId}
                  onChange={(e) => {
                    setSelectedStockItemId(e.target.value);
                    setAllocateQty(1);
                  }}
                >
                  <option value="">Selecione o material...</option>
                  {warehouseStock
                    .filter((i) => i.available_quantity > 0)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.category}) — Disponível: {item.available_quantity} un.
                      </option>
                    ))}
                </select>
              </div>

              {selectedStockItemId && (
                <div className="flat-form-group">
                  <label>
                    Quantidade a Alocar para esta Obra * (Máx:{' '}
                    {warehouseStock.find((i) => i.id === selectedStockItemId)?.available_quantity || 1})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={warehouseStock.find((i) => i.id === selectedStockItemId)?.available_quantity || 1}
                    required
                    value={allocateQty}
                    onChange={(e) => setAllocateQty(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    O estoque será debitado do armazém central e passará a constar como alocado nesta obra.
                  </span>
                </div>
              )}

              <div className="flat-modal-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setAllocateModalOpen(false)}
                  disabled={allocatingMat}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-flat-primary"
                  disabled={allocatingMat || !selectedStockItemId}
                >
                  {allocatingMat ? 'A alocar...' : 'Confirmar Alocação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: DEVOLVER MATERIAL AO ARMAZÉM                                */}
      {/* ================================================================== */}
      {returnModalOpen && selectedReturnItem && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 440, width: '95%' }}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowRightLeft size={18} color="var(--primary)" />
                Devolver Material ao Armazém
              </h3>
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setReturnModalOpen(false)}
                disabled={returningMat}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleReturnMaterial}>
              <div style={{ marginBottom: 14 }}>
                <strong style={{ fontSize: 14, color: 'var(--text-main)', display: 'block' }}>
                  {selectedReturnItem.name}
                </strong>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Alocado atualmente nesta obra: <strong>{selectedReturnItem.allocated_quantity} un.</strong>
                </span>
              </div>

              <div className="flat-form-group">
                <label>Quantidade a Devolver *</label>
                <input
                  type="number"
                  min={1}
                  max={selectedReturnItem.allocated_quantity || 1}
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              <div className="flat-modal-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setReturnModalOpen(false)}
                  disabled={returningMat}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-flat-primary"
                  disabled={returningMat}
                >
                  {returningMat ? 'A devolver...' : 'Confirmar Devolução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

