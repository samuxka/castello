import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Edit2,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  deleteEmployee,
  deleteSite,
  getActiveCompanySession,
  getAllTimeEntries,
  getEmployees,
  getSites,
  isSupabaseConfigured,
  saveEmployee,
  saveSite,
  setActiveCompanySession,
  updateEntryStatus,
} from './lib/supabase';
import {
  Company,
  ConstructionSite,
  EmployeeProfile,
  EntryStatus,
  SiteStatus,
  TimeEntry,
} from './types';
import { AuthModal } from './components/AuthModal';
import { SiteDetailPage } from './pages/SiteDetailPage';
import { ClientPortalPage } from './pages/ClientPortalPage';
import { EmployeeAutocompleteSelect } from './components/EmployeeAutocompleteSelect';
import { JobTitleAutocompleteSelect } from './components/JobTitleAutocompleteSelect';

type Page = 'dashboard' | 'funcionarios' | 'obras';

export default function App() {
  // Verifica se o link é o link público do cliente (?obra=CODIGO)
  const queryParams = new URLSearchParams(window.location.search);
  const clientShareCode = queryParams.get('obra');

  if (clientShareCode) {
    return <ClientPortalPage shareCode={clientShareCode} />;
  }

  const [activeCompany, setActiveCompany] = useState<Company | null>(() =>
    getActiveCompanySession()
  );

  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedSiteForDetail, setSelectedSiteForDetail] = useState<ConstructionSite | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Modal Funcionário (CRUD - Sem alocação fixa de obra)
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | undefined>();
  const [empForm, setEmpForm] = useState({
    full_name: '',
    email: '',
    access_code: '123456',
    job_title: 'Técnico de Instalações',
    phone: '',
    hourly_rate: '18.50',
    monthly_target_hours: '176',
    admission_date: new Date().toISOString().slice(0, 10),
    is_active: true,
  });

  // Modal Obra (CRUD com autocomplete de encarregado)
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | undefined>();
  const [siteForm, setSiteForm] = useState({
    name: '',
    address: '',
    manager_name: '',
    manager_id: '' as string | undefined,
    status: 'ativa' as SiteStatus,
    budget: '500000',
    description: '',
    client_name: '',
    client_phone: '',
    start_date: new Date().toISOString().slice(0, 10),
  });

  const loadData = async (compId?: string) => {
    const targetCompId = compId || activeCompany?.id;
    const [s, e, t] = await Promise.all([
      getSites(targetCompId),
      getEmployees(targetCompId),
      getAllTimeEntries(targetCompId),
    ]);
    setSites(s);
    setEmployees(e);
    setEntries(t);

    if (selectedSiteForDetail) {
      const refreshed = s.find((x) => x.id === selectedSiteForDetail.id);
      if (refreshed) setSelectedSiteForDetail(refreshed);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (activeCompany) {
      loadData(activeCompany.id);
      const timer = setInterval(() => {
        loadData(activeCompany.id);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [activeCompany]);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleLogout = () => {
    setActiveCompanySession(null);
    setActiveCompany(null);
    setSelectedSiteForDetail(null);
    setMobileMenuOpen(false);
  };

  const handleValidateEntry = async (entryId: number, newStatus: EntryStatus) => {
    await updateEntryStatus(entryId, newStatus);
    await loadData(activeCompany?.id);
    showNotice(
      newStatus === 'aprovado'
        ? `Registo #${entryId} validado com sucesso.`
        : `Registo #${entryId} rejeitado.`
    );
  };

  // CRUD Funcionários (Sem obra)
  const handleOpenNewEmployee = () => {
    setEditingEmpId(undefined);
    setEmpForm({
      full_name: '',
      email: '',
      access_code: String(Math.floor(100000 + Math.random() * 900000)),
      job_title: 'Técnico de Obra',
      phone: '+351 ',
      hourly_rate: '18.50',
      monthly_target_hours: '176',
      admission_date: new Date().toISOString().slice(0, 10),
      is_active: true,
    });
    setEmpModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: EmployeeProfile) => {
    setEditingEmpId(emp.id);
    setEmpForm({
      full_name: emp.full_name,
      email: emp.email,
      access_code: emp.access_code || '123456',
      job_title: emp.job_title,
      phone: emp.phone || '',
      hourly_rate: String(emp.hourly_rate),
      monthly_target_hours: String(emp.monthly_target_hours || 176),
      admission_date:
        emp.admission_date ||
        (emp.created_at ? emp.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      is_active: emp.is_active,
    });
    setEmpModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveEmployee(
      {
        id: editingEmpId,
        full_name: empForm.full_name.trim(),
        email: empForm.email.trim().toLowerCase(),
        access_code: empForm.access_code.trim(),
        role: 'funcionario',
        job_title: empForm.job_title.trim(),
        phone: empForm.phone.trim() || null,
        hourly_rate: parseFloat(empForm.hourly_rate) || 0,
        monthly_target_hours: parseInt(empForm.monthly_target_hours, 10) || 176,
        admission_date: empForm.admission_date || null,
        is_active: empForm.is_active,
      },
      activeCompany?.id
    );
    setEmpModalOpen(false);
    await loadData(activeCompany?.id);
    showNotice(editingEmpId ? 'Colaborador atualizado.' : 'Colaborador criado.');
  };

  const handleDeleteEmployee = async (id: string) => {
    if (confirm('Tem a certeza de que deseja remover este colaborador?')) {
      await deleteEmployee(id);
      await loadData(activeCompany?.id);
      showNotice('Colaborador removido.');
    }
  };

  // CRUD Obras com Select Autocomplete de Funcionários
  const handleOpenNewSite = () => {
    setEditingSiteId(undefined);
    setSiteForm({
      name: '',
      address: '',
      manager_name: '',
      manager_id: undefined,
      status: 'ativa',
      budget: '350000',
      description: '',
      client_name: '',
      client_phone: '',
      start_date: new Date().toISOString().slice(0, 10),
    });
    setSiteModalOpen(true);
  };

  const handleOpenEditSite = (site: ConstructionSite) => {
    setEditingSiteId(site.id);
    setSiteForm({
      name: site.name,
      address: site.address,
      manager_name: site.manager_name || '',
      manager_id: site.manager_id || undefined,
      status: site.status,
      budget: String(site.budget || 0),
      description: site.description || '',
      client_name: site.client_name || '',
      client_phone: site.client_phone || '',
      start_date: site.start_date || new Date().toISOString().slice(0, 10),
    });
    setSiteModalOpen(true);
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSite(
      {
        id: editingSiteId,
        name: siteForm.name.trim(),
        address: siteForm.address.trim(),
        manager_name: siteForm.manager_name.trim() || null,
        manager_id: siteForm.manager_id || null,
        status: siteForm.status,
        budget: parseFloat(siteForm.budget) || 0,
        description: siteForm.description.trim() || null,
        client_name: siteForm.client_name.trim() || null,
        client_phone: siteForm.client_phone.trim() || null,
        start_date: siteForm.start_date || null,
      },
      activeCompany?.id
    );
    setSiteModalOpen(false);
    await loadData(activeCompany?.id);
    showNotice(editingSiteId ? 'Obra atualizada.' : 'Obra cadastrada.');
  };

  const handleDeleteSite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Deseja realmente remover esta obra?')) {
      await deleteSite(id);
      if (selectedSiteForDetail?.id === id) {
        setSelectedSiteForDetail(null);
      }
      await loadData(activeCompany?.id);
      showNotice('Obra removida.');
    }
  };

  if (!activeCompany) {
    return (
      <AuthModal
        onSuccess={(company) => {
          setActiveCompany(company);
        }}
      />
    );
  }

  const pendingEntries = entries.filter((e) => e.status === 'pendente');
  const activeSites = sites.filter((s) => s.status === 'ativa');

  return (
    <div className="app-container">
      {/* Top Bar para Mobile / Tablet */}
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <div className="brand-logo-flat" style={{ width: 32, height: 32, fontSize: 16 }}>
            C
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div className="brand-text-name" style={{ fontSize: 16, lineHeight: 1.1 }}>
              castello
            </div>
            <div
              className="brand-text-sub"
              style={{
                fontSize: 11,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'var(--primary)',
                fontWeight: 600,
              }}
            >
              {activeCompany.name}
            </div>
          </div>
        </div>

        <div className="mobile-actions">
          <button
            className="theme-toggle-btn"
            style={{ padding: '6px 10px' }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Alternar Tema"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className="btn-flat-secondary"
            style={{ padding: '6px 10px' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Backdrop overlay para fechar a sidebar em telas pequenas */}
      <div
        className={`sidebar-backdrop ${mobileMenuOpen ? 'active' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Barra Lateral Flat */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div>
          <div className="brand-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              <div className="brand-logo-flat">C</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="brand-text-name">castello</div>
                <div
                  className="brand-text-sub"
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'var(--primary)',
                    fontWeight: 600,
                  }}
                >
                  {activeCompany.name}
                </div>
              </div>
            </div>

            <button
              className="sidebar-close-btn"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu lateral"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="nav-list">
            <button
              className={`nav-item ${currentPage === 'dashboard' && !selectedSiteForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('dashboard');
                setSelectedSiteForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button
              className={`nav-item ${currentPage === 'funcionarios' && !selectedSiteForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('funcionarios');
                setSelectedSiteForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <Users size={18} />
              Funcionários
            </button>

            <button
              className={`nav-item ${currentPage === 'obras' || selectedSiteForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('obras');
                setSelectedSiteForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <Building2 size={18} />
              Obras
            </button>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <button
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <span>Tema {theme === 'dark' ? 'Escuro' : 'Claro'}</span>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className="btn-flat-secondary"
            style={{ width: '100%', justifyContent: 'center', gap: 6, fontSize: 12 }}
            onClick={handleLogout}
          >
            <LogOut size={14} />
            Sair da Firma
          </button>

          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Database size={13} color="var(--primary)" />
            {isSupabaseConfigured ? 'Supabase Conectado' : 'Modo Local'}
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="main-view">
        {notification && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--primary-subtle)',
              border: '1px solid var(--primary-border)',
              borderRadius: 6,
              color: 'var(--primary)',
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} />
            {notification}
          </div>
        )}

        {/* DETALHE DA OBRA (Quando o usuário clica numa obra) */}
        {selectedSiteForDetail ? (
          <SiteDetailPage
            site={selectedSiteForDetail}
            employees={employees}
            onBack={() => setSelectedSiteForDetail(null)}
          />
        ) : (
          <>
            {/* 1. DASHBOARD */}
            {currentPage === 'dashboard' && (
              <>
                <div className="view-header">
                  <div>
                    <h1 className="view-title">Dashboard Operacional</h1>
                    <p className="view-description">
                      Visão consolidada de picagens e obras da firma <strong>{activeCompany.name}</strong>
                    </p>
                  </div>
                </div>

                <div className="kpi-row">
                  <div className="kpi-box">
                    <div className="kpi-label">Pontos Pendentes</div>
                    <div
                      className="kpi-value"
                      style={{
                        color:
                          pendingEntries.length > 0 ? 'var(--warning)' : 'var(--text-main)',
                      }}
                    >
                      {pendingEntries.length}
                    </div>
                    <div className="kpi-detail">Aguardando validação do patrão</div>
                  </div>

                  <div className="kpi-box">
                    <div className="kpi-label">Obras Ativas</div>
                    <div className="kpi-value" style={{ color: 'var(--primary)' }}>
                      {activeSites.length}
                    </div>
                    <div className="kpi-detail">De {sites.length} obras cadastradas</div>
                  </div>

                  <div className="kpi-box">
                    <div className="kpi-label">Equipa Ativa</div>
                    <div className="kpi-value">{employees.length}</div>
                    <div className="kpi-detail">Colaboradores registados</div>
                  </div>
                </div>

                {/* SECÇÃO DE VALIDAÇÃO DE PICAGENS */}
                <div className="content-panel">
                  <div className="panel-header-inline">
                    <div>
                      <h2 className="panel-title">Validação de Picagens de Ponto</h2>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Quando um colaborador regista o ponto no app, aparece aqui para validação
                      </p>
                    </div>
                    <div className="badge-flat warning">
                      {pendingEntries.length} para validar
                    </div>
                  </div>

                  <div className="flat-table-wrap">
                    <table className="flat-table">
                      <thead>
                        <tr>
                          <th>Data / Hora</th>
                          <th>Colaborador</th>
                          <th>Tipo</th>
                          <th>Obra</th>
                          <th>Estado</th>
                          <th style={{ textAlign: 'right' }}>Ação do Patrão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                              Nenhuma picagem de ponto registada até o momento.
                            </td>
                          </tr>
                        ) : (
                          entries.map((entry) => {
                            const emp = employees.find((x) => x.id === entry.employee_id);
                            const site = sites.find((x) => x.id === entry.site_id);
                            const d = new Date(entry.recorded_at);
                            const timeStr = `${String(d.getHours()).padStart(
                              2,
                              '0'
                            )}:${String(d.getMinutes()).padStart(2, '0')}`;

                            return (
                              <tr key={entry.id}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{entry.work_date}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {timeStr}
                                  </div>
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  {emp?.full_name || 'Colaborador'}
                                </td>
                                <td>
                                  <span className="badge-flat primary">
                                    {entry.entry_type.toUpperCase()}
                                  </span>
                                </td>
                                <td>{site ? site.name : 'Geral'}</td>
                                <td>
                                  <span
                                    className={`badge-flat ${
                                      entry.status === 'aprovado'
                                        ? 'success'
                                        : entry.status === 'rejeitado'
                                        ? 'danger'
                                        : 'warning'
                                    }`}
                                  >
                                    {entry.status.toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {entry.status === 'pendente' ? (
                                    <div
                                      style={{
                                        display: 'inline-flex',
                                        gap: 6,
                                        justifyContent: 'flex-end',
                                      }}
                                    >
                                      <button
                                        className="btn-flat-success"
                                        onClick={() =>
                                          handleValidateEntry(entry.id, 'aprovado')
                                        }
                                      >
                                        <Check size={14} />
                                        Validar
                                      </button>
                                      <button
                                        className="btn-flat-danger"
                                        onClick={() =>
                                          handleValidateEntry(entry.id, 'rejeitado')
                                        }
                                      >
                                        <X size={14} />
                                        Rejeitar
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      Processado
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 2. PÁGINA DOS FUNCIONÁRIOS (SEM OBRA FIXA) */}
            {currentPage === 'funcionarios' && (
              <>
                <div className="view-header">
                  <div>
                    <h1 className="view-title">Gestão de Funcionários</h1>
                    <p className="view-description">
                      Registe os colaboradores da firma <strong>{activeCompany.name}</strong> (disponíveis para todas as obras)
                    </p>
                  </div>
                  <button className="btn-flat-primary" onClick={handleOpenNewEmployee}>
                    <Plus size={16} />
                    Novo Funcionário
                  </button>
                </div>

                <div className="content-panel">
                  <div className="flat-table-wrap">
                    <table className="flat-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Cargo</th>
                          <th>Acesso App (Email / PIN)</th>
                          <th>Contacto</th>
                          <th>Taxa Horária (€)</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                              Nenhum colaborador registado.
                            </td>
                          </tr>
                        ) : (
                          employees.map((emp) => (
                            <tr key={emp.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{emp.full_name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  Admissão: {emp.admission_date ? emp.admission_date.split('-').reverse().join('/') : (emp.created_at ? emp.created_at.slice(0, 10).split('-').reverse().join('/') : '-')} • Meta: {emp.monthly_target_hours}h/mês
                                </div>
                              </td>
                              <td>
                                <span className="badge-flat primary">
                                  {emp.job_title}
                                </span>
                              </td>
                              <td>
                                <div>{emp.email}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  PIN: <strong style={{ color: 'var(--primary)' }}>{emp.access_code}</strong>
                                </div>
                              </td>
                              <td>{emp.phone || 'Sem registo'}</td>
                              <td style={{ fontWeight: 600 }}>
                                {Number(emp.hourly_rate).toFixed(2)} €/h
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn-flat-secondary"
                                    onClick={() => handleOpenEditEmployee(emp)}
                                  >
                                    <Edit2 size={13} />
                                    Editar
                                  </button>
                                  <button
                                    className="btn-flat-danger"
                                    onClick={() => handleDeleteEmployee(emp.id)}
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
              </>
            )}

            {/* 3. PÁGINA DE OBRAS (CLIQUE PARA ABRIR PÁGINA DA OBRA) */}
            {currentPage === 'obras' && (
              <>
                <div className="view-header">
                  <div>
                    <h1 className="view-title">Gestão de Obras</h1>
                    <p className="view-description">
                      Clique numa obra para abrir a sua página com <strong>Tarefas</strong>, <strong>Diário de Bordo</strong> e <strong>Link do Cliente</strong>
                    </p>
                  </div>
                  <button className="btn-flat-primary" onClick={handleOpenNewSite}>
                    <Plus size={16} />
                    Nova Obra
                  </button>
                </div>

                <div className="content-panel">
                  <div className="flat-table-wrap">
                    <table className="flat-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Nome da Obra</th>
                          <th>Localização</th>
                          <th>Encarregado</th>
                          <th>Estado</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sites.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                              Nenhuma obra cadastrada. Clique no botão acima para adicionar.
                            </td>
                          </tr>
                        ) : (
                          sites.map((site) => (
                            <tr
                              key={site.id}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedSiteForDetail(site)}
                            >
                              <td>
                                <span className="badge-flat primary" style={{ fontFamily: 'monospace' }}>
                                  {site.share_code}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                  {site.name} →
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  Clique para abrir tarefas e diário
                                </div>
                              </td>
                              <td>{site.address}</td>
                              <td>{site.manager_name || 'Sem encarregado'}</td>
                              <td>
                                <span
                                  className={`badge-flat ${
                                    site.status === 'ativa'
                                      ? 'success'
                                      : site.status === 'pausada'
                                      ? 'warning'
                                      : 'primary'
                                  }`}
                                >
                                  {site.status.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn-flat-secondary"
                                    onClick={() => handleOpenEditSite(site)}
                                  >
                                    <Edit2 size={13} />
                                    Editar
                                  </button>
                                  <button
                                    className="btn-flat-danger"
                                    onClick={(e) => handleDeleteSite(site.id, e)}
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
              </>
            )}
          </>
        )}
      </main>

      {/* MODAL: CRIAR / EDITAR FUNCIONÁRIO (SEM OBRA) */}
      {empModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box">
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                {editingEmpId ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h3>
              <button className="btn-flat-secondary" onClick={() => setEmpModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee}>
              <div className="flat-form-grid">
                <div className="flat-form-group full">
                  <label>Nome Completo *</label>
                  <input
                    required
                    value={empForm.full_name}
                    onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })}
                  />
                </div>

                <div className="flat-form-group">
                  <label>E-mail (Login App) *</label>
                  <input
                    required
                    type="email"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                  />
                </div>

                <div className="flat-form-group">
                  <label>PIN / Senha de Acesso *</label>
                  <input
                    required
                    value={empForm.access_code}
                    onChange={(e) => setEmpForm({ ...empForm, access_code: e.target.value })}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Função / Cargo *</label>
                  <JobTitleAutocompleteSelect
                    value={empForm.job_title}
                    onChange={(job) => setEmpForm({ ...empForm, job_title: job })}
                    existingJobs={employees.map((e) => e.job_title)}
                    placeholder="Digite o cargo..."
                  />
                </div>

                <div className="flat-form-group">
                  <label>Telefone</label>
                  <input
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Taxa Horária (€ / hora)</label>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={empForm.hourly_rate}
                    onChange={(e) => setEmpForm({ ...empForm, hourly_rate: e.target.value })}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Meta Mensal (horas)</label>
                  <input
                    type="number"
                    required
                    value={empForm.monthly_target_hours}
                    onChange={(e) => setEmpForm({ ...empForm, monthly_target_hours: e.target.value })}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Data de Admissão</label>
                  <input
                    type="date"
                    required
                    value={empForm.admission_date}
                    onChange={(e) => setEmpForm({ ...empForm, admission_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setEmpModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary">
                  Gravar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR OBRA (COM AUTOCOMPLETE DE ENCARREGADO) */}
      {siteModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box">
            <div className="flat-modal-header">
              <h3 className="flat-modal-title">
                {editingSiteId ? 'Editar Obra' : 'Nova Obra'}
              </h3>
              <button className="btn-flat-secondary" onClick={() => setSiteModalOpen(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveSite}>
              <div className="flat-form-grid">
                <div className="flat-form-group full">
                  <label>Nome da Obra *</label>
                  <input
                    required
                    value={siteForm.name}
                    onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                  />
                </div>

                <div className="flat-form-group full">
                  <label>Localização / Endereço *</label>
                  <input
                    required
                    value={siteForm.address}
                    onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                  />
                </div>

                {/* SELECT AUTOCOMPLETE DO ENCARREGADO CONFORME DIGITA */}
                <div className="flat-form-group full">
                  <label>Encarregado / Responsável da Obra</label>
                  <EmployeeAutocompleteSelect
                    employees={employees}
                    value={siteForm.manager_name}
                    onChange={(name, id) => {
                      setSiteForm({
                        ...siteForm,
                        manager_name: name,
                        manager_id: id,
                      });
                    }}
                    placeholder="Digite o nome do funcionário para filtrar..."
                  />
                </div>

                <div className="flat-form-group">
                  <label>Estado da Obra</label>
                  <select
                    value={siteForm.status}
                    onChange={(e) =>
                      setSiteForm({
                        ...siteForm,
                        status: e.target.value as SiteStatus,
                      })
                    }
                  >
                    <option value="ativa">Ativa</option>
                    <option value="pausada">Pausada</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label>Orçamento (€)</label>
                  <input
                    type="number"
                    value={siteForm.budget}
                    onChange={(e) => setSiteForm({ ...siteForm, budget: e.target.value })}
                  />
                </div>

                <div className="flat-form-group">
                  <label>Nome do Cliente (Opcional)</label>
                  <input
                    value={siteForm.client_name}
                    onChange={(e) => setSiteForm({ ...siteForm, client_name: e.target.value })}
                    placeholder="Ex: Família Moreira"
                  />
                </div>

                <div className="flat-form-group">
                  <label>Telefone do Cliente</label>
                  <input
                    value={siteForm.client_phone}
                    onChange={(e) => setSiteForm({ ...siteForm, client_phone: e.target.value })}
                    placeholder="+351 900 000 000"
                  />
                </div>

                <div className="flat-form-group full">
                  <label>Descrição da Obra</label>
                  <textarea
                    rows={2}
                    value={siteForm.description}
                    onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="flat-modal-actions">
                <button type="button" className="btn-flat-secondary" onClick={() => setSiteModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-flat-primary">
                  Gravar Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
