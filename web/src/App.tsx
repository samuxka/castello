import React, { useEffect, useState } from 'react';
import {
  ArrowUpDown,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Database,
  DollarSign,
  Edit2,
  ExternalLink,
  Filter,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  Menu,
  Moon,
  Phone,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
  Truck,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  applyTheme,
  deleteEmployee,
  deleteSite,
  getActiveCompanySession,
  getAbsenceJustifications,
  getAllTimeEntries,
  getEmployees,
  getFinancialRecords,
  getSavedTheme,
  getSites,
  isSupabaseConfigured,
  saveEmployee,
  saveSite,
  saveTheme,
  setActiveCompanySession,
  updateAbsenceJustificationStatus,
  updateEntryStatus,
} from './lib/supabase';
import {
  AbsenceJustification,
  Company,
  ConstructionSite,
  EmployeeProfile,
  EntryStatus,
  FinancialRecord,
  SiteStatus,
  ThemeColor,
  ThemeMode,
  TimeEntry,
  Vehicle,
} from './types';
import { AuthModal } from './components/AuthModal';
import { SiteDetailPage } from './pages/SiteDetailPage';
import { ClientPortalPage } from './pages/ClientPortalPage';
import { FinancialPage } from './pages/FinancialPage';
import { SettingsPage } from './pages/SettingsPage';
import { InventoryPage } from './pages/InventoryPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { VehicleDetailPage } from './pages/VehicleDetailPage';
import { CalendarPage } from './pages/CalendarPage';
import { EmployeeDetailPage } from './pages/EmployeeDetailPage';
import { CashFlowChart } from './components/CashFlowChart';
import { AttendanceChart } from './components/AttendanceChart';
import { DashboardCalendarCard } from './components/DashboardCalendarCard';
import { EmployeeAutocompleteSelect } from './components/EmployeeAutocompleteSelect';
import { JobTitleAutocompleteSelect } from './components/JobTitleAutocompleteSelect';

type Page =
  | 'dashboard'
  | 'funcionarios'
  | 'obras'
  | 'financeiro'
  | 'inventario'
  | 'carrinhas'
  | 'calendario'
  | 'configuracoes';

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
  const [selectedEmployeeForDetail, setSelectedEmployeeForDetail] = useState<EmployeeProfile | null>(null);
  const [selectedVehicleForDetail, setSelectedVehicleForDetail] = useState<Vehicle | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getSavedTheme().mode);
  const [themeColor, setThemeColor] = useState<ThemeColor>(() => getSavedTheme().color);

  useEffect(() => {
    applyTheme(themeColor, theme);
  }, [themeColor, theme]);

  const toggleThemeMode = () => {
    const nextMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextMode);
    saveTheme(themeColor, nextMode);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [justifications, setJustifications] = useState<AbsenceJustification[]>([]);
  const [validationTab, setValidationTab] = useState<'pontos' | 'faltas'>('pontos');
  const [justifPreviewPhoto, setJustifPreviewPhoto] = useState<string | null>(null);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  // Estados de Busca, Filtro, Ordenação e Layout para Funcionários
  const [empSearch, setEmpSearch] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState<string>('all');
  const [empSortBy, setEmpSortBy] = useState<string>('name-asc');
  const [empViewMode, setEmpViewMode] = useState<'table' | 'cards'>('table');

  // Estados de Busca, Filtro, Ordenação e Layout para Obras
  const [siteSearch, setSiteSearch] = useState('');
  const [siteStatusFilter, setSiteStatusFilter] = useState<string>('all');
  const [siteSortBy, setSiteSortBy] = useState<string>('name-asc');
  const [siteViewMode, setSiteViewMode] = useState<'table' | 'cards'>('table');

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
    avatar_url: '',
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
    const [s, e, t, f, j] = await Promise.all([
      getSites(targetCompId),
      getEmployees(targetCompId),
      getAllTimeEntries(targetCompId),
      getFinancialRecords(targetCompId),
      getAbsenceJustifications(undefined, targetCompId),
    ]);
    setSites(s);
    setEmployees(e);
    setEntries(t);
    setFinancialRecords(f);
    setJustifications(j);
    setFinancialRecords(f);

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

  const handleValidateJustification = async (justifId: string, status: 'aprovada' | 'rejeitada') => {
    await updateAbsenceJustificationStatus(justifId, status);
    await loadData(activeCompany?.id);
    showNotice(
      status === 'aprovada'
        ? 'Justificativa de falta aprovada com sucesso!'
        : 'Justificativa de falta rejeitada.'
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
      avatar_url: '',
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
      avatar_url: emp.avatar_url || '',
    });
    setEmpModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
          avatar_url: empForm.avatar_url?.trim() || null,
        },
        activeCompany?.id
      );
      setEmpModalOpen(false);
      await loadData(activeCompany?.id);
      showNotice(editingEmpId ? 'Colaborador atualizado com sucesso.' : 'Colaborador criado com sucesso.');
    } catch (err: any) {
      console.error('Erro ao gravar colaborador:', err);
      alert('Erro ao gravar colaborador: ' + (err.message || 'Verifique os dados preenchidos.'));
    }
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
  const pendingJustifs = justifications.filter((j) => j.status === 'pendente');
  const activeSites = sites.filter((s) => s.status === 'ativa');

  // Filtragem e ordenação de funcionários
  const filteredAndSortedEmployees = employees
    .filter((emp) => {
      const q = empSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.full_name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.job_title.toLowerCase().includes(q) ||
        (emp.phone && emp.phone.includes(q));

      const matchesStatus =
        empStatusFilter === 'all' ||
        (empStatusFilter === 'active' && emp.is_active) ||
        (empStatusFilter === 'inactive' && !emp.is_active);

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (empSortBy) {
        case 'name-asc':
          return a.full_name.localeCompare(b.full_name);
        case 'name-desc':
          return b.full_name.localeCompare(a.full_name);
        case 'rate-desc':
          return (b.hourly_rate || 0) - (a.hourly_rate || 0);
        case 'rate-asc':
          return (a.hourly_rate || 0) - (b.hourly_rate || 0);
        case 'admission-desc':
          return (b.admission_date || '').localeCompare(a.admission_date || '');
        case 'admission-asc':
          return (a.admission_date || '').localeCompare(b.admission_date || '');
        default:
          return 0;
      }
    });

  // Filtragem e ordenação de obras
  const filteredAndSortedSites = sites
    .filter((site) => {
      const q = siteSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        site.name.toLowerCase().includes(q) ||
        site.share_code.toLowerCase().includes(q) ||
        site.address.toLowerCase().includes(q) ||
        (site.manager_name && site.manager_name.toLowerCase().includes(q));

      const matchesStatus =
        siteStatusFilter === 'all' || site.status === siteStatusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (siteSortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'code-asc':
          return a.share_code.localeCompare(b.share_code);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

  return (
    <div className="app-container">
      {/* Top Bar para Mobile / Tablet */}
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <div
            className="brand-logo-flat"
            style={{
              width: 34,
              height: 34,
              fontSize: 16,
              overflow: 'hidden',
              padding: 0,
              backgroundColor: activeCompany.logo_url ? 'var(--primary)' : 'transparent',
            }}
          >
            {activeCompany.logo_url ? (
              <img
                src={activeCompany.logo_url}
                alt="Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <img
                src="/logo.png"
                alt="Logo Castello"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div
              className="brand-text-name"
              style={{
                fontSize: 15,
                lineHeight: 1.2,
                fontWeight: 800,
                color: 'var(--text-main)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeCompany.name}
            </div>
            <div
              className="brand-text-sub"
              style={{
                fontSize: 11,
                color: 'var(--primary)',
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              castello
            </div>
          </div>
        </div>

        <div className="mobile-actions">
          <button
            className="theme-toggle-btn"
            style={{ padding: '6px 10px' }}
            onClick={toggleThemeMode}
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
              <div
                className="brand-logo-flat"
                style={{
                  width: 38,
                  height: 38,
                  overflow: 'hidden',
                  padding: 0,
                  backgroundColor: activeCompany.logo_url ? 'var(--primary)' : 'transparent',
                }}
              >
                {activeCompany.logo_url ? (
                  <img
                    src={activeCompany.logo_url}
                    alt="Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src="/logo.png"
                    alt="Logo Castello"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="brand-text-name"
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: -0.3,
                    color: 'var(--text-main)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeCompany.name}
                </div>
                <div
                  className="brand-text-sub"
                  style={{
                    fontSize: 11,
                    color: 'var(--primary)',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    marginTop: 1,
                  }}
                >
                  castello
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
              className={`nav-item ${currentPage === 'dashboard' && !selectedSiteForDetail && !selectedEmployeeForDetail && !selectedVehicleForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('dashboard');
                setSelectedSiteForDetail(null);
                setSelectedEmployeeForDetail(null);
                setSelectedVehicleForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button
              className={`nav-item ${currentPage === 'funcionarios' && !selectedSiteForDetail && !selectedVehicleForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('funcionarios');
                setSelectedSiteForDetail(null);
                setSelectedEmployeeForDetail(null);
                setSelectedVehicleForDetail(null);
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
                setSelectedEmployeeForDetail(null);
                setSelectedVehicleForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <Building2 size={18} />
              Obras
            </button>

            <button
              className={`nav-item ${currentPage === 'financeiro' && !selectedSiteForDetail && !selectedEmployeeForDetail && !selectedVehicleForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('financeiro');
                setSelectedSiteForDetail(null);
                setSelectedEmployeeForDetail(null);
                setSelectedVehicleForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <DollarSign size={18} />
              Gestão Financeira
            </button>

            <button
              className={`nav-item ${currentPage === 'inventario' && !selectedSiteForDetail && !selectedEmployeeForDetail && !selectedVehicleForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('inventario');
                setSelectedSiteForDetail(null);
                setSelectedEmployeeForDetail(null);
                setSelectedVehicleForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <Boxes size={18} />
              Inventário
            </button>

            <button
              className={`nav-item ${currentPage === 'carrinhas' && !selectedSiteForDetail && !selectedEmployeeForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('carrinhas');
                setSelectedSiteForDetail(null);
                setSelectedEmployeeForDetail(null);
                setSelectedVehicleForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <Truck size={18} />
              Carrinhas
            </button>

            <button
              className={`nav-item ${currentPage === 'calendario' && !selectedSiteForDetail && !selectedEmployeeForDetail && !selectedVehicleForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('calendario');
                setSelectedSiteForDetail(null);
                setSelectedEmployeeForDetail(null);
                setSelectedVehicleForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <Calendar size={18} />
              Calendário
            </button>

            <button
              className={`nav-item ${currentPage === 'configuracoes' && !selectedSiteForDetail && !selectedEmployeeForDetail && !selectedVehicleForDetail ? 'active' : ''}`}
              onClick={() => {
                setCurrentPage('configuracoes');
                setSelectedSiteForDetail(null);
                setSelectedEmployeeForDetail(null);
                setSelectedVehicleForDetail(null);
                setMobileMenuOpen(false);
              }}
            >
              <Settings size={18} />
              Configurações
            </button>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <button
            className="theme-toggle-btn"
            onClick={toggleThemeMode}
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

      {/* Conteúdo Principal com Altura Padronizada e Scroll Interno */}
      <main className="main-view">
        <div className="main-content-area">
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
          ) : selectedEmployeeForDetail && currentPage === 'funcionarios' ? (
            <EmployeeDetailPage
              employee={selectedEmployeeForDetail}
              sites={sites}
              entries={entries}
              onBack={() => setSelectedEmployeeForDetail(null)}
              onEmployeeUpdated={(updated) => {
                setSelectedEmployeeForDetail(updated);
                setEmployees(employees.map((e) => (e.id === updated.id ? updated : e)));
              }}
              onEntryAdded={(newEntry) => setEntries((prev) => [newEntry, ...prev])}
              showNotice={showNotice}
            />
          ) : selectedVehicleForDetail && currentPage === 'carrinhas' ? (
            <VehicleDetailPage
              vehicle={selectedVehicleForDetail}
              sites={sites}
              employees={employees}
              companyId={activeCompany?.id}
              onBack={() => setSelectedVehicleForDetail(null)}
              onVehicleUpdated={(updated) => {
                setSelectedVehicleForDetail(updated);
              }}
              showNotice={showNotice}
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
                    <div className="kpi-label">Pendências por Validar</div>
                    <div
                      className="kpi-value"
                      style={{
                        color:
                          (pendingEntries.length + pendingJustifs.length) > 0 ? 'var(--warning)' : 'var(--text-main)',
                      }}
                    >
                      {pendingEntries.length + pendingJustifs.length}
                    </div>
                    <div className="kpi-detail">
                      {pendingEntries.length} ponto{pendingEntries.length === 1 ? '' : 's'} • {pendingJustifs.length} falta{pendingJustifs.length === 1 ? '' : 's'}
                    </div>
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

                {/* GRID DO DASHBOARD: GRÁFICOS (ESQUERDA) + VALIDAÇÃO DE PONTOS (DIREITA) */}
                <div className="dashboard-main-grid">
                  {/* COLUNA ESQUERDA: Fluxo de Caixa e Assiduidade (tamanho original) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                    <CashFlowChart records={financialRecords} />
                    <AttendanceChart employees={employees} entries={entries} />
                  </div>

                  {/* COLUNA DIREITA: Validação de Pontos + Calendário de Próximos Eventos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                    {/* 1. Card Compacto de Validação de Pontos & Justificativas de Falta */}
                    <div
                      className="content-panel"
                      style={{
                        margin: 0,
                        height: 275,
                        maxHeight: 275,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        className="panel-header-inline"
                        style={{
                          flexShrink: 0,
                          marginBottom: 8,
                          paddingBottom: 6,
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => setValidationTab('pontos')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: validationTab === 'pontos' ? 'var(--primary)' : 'var(--bg-card-subtle)',
                              color: validationTab === 'pontos' ? '#ffffff' : 'var(--text-muted)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Pontos ({pendingEntries.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setValidationTab('faltas')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: validationTab === 'faltas' ? 'var(--primary)' : 'var(--bg-card-subtle)',
                              color: validationTab === 'faltas' ? '#ffffff' : 'var(--text-muted)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            Faltas ({pendingJustifs.length})
                          </button>
                        </div>

                        <div
                          className={`badge-flat ${
                            (validationTab === 'pontos' ? pendingEntries.length : pendingJustifs.length) > 0
                              ? 'warning'
                              : 'primary'
                          }`}
                          style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}
                        >
                          {validationTab === 'pontos' ? pendingEntries.length : pendingJustifs.length} pendente(s)
                        </div>
                      </div>

                      {/* ABA DE PICAGENS DE PONTO */}
                      {validationTab === 'pontos' ? (
                        <div
                          className="custom-scroll"
                          style={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            paddingRight: 6,
                            paddingBottom: 4,
                          }}
                        >
                          {entries.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                              Nenhuma picagem de ponto registada.
                            </div>
                          ) : (
                            [...entries]
                              .sort((a, b) => {
                                if (a.status === 'pendente' && b.status !== 'pendente') return -1;
                                if (a.status !== 'pendente' && b.status === 'pendente') return 1;
                                return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime();
                              })
                              .slice(0, 25)
                              .map((entry) => {
                                const emp = employees.find((x) => x.id === entry.employee_id);
                                const site = sites.find((x) => x.id === entry.site_id);
                                const d = new Date(entry.recorded_at);
                                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                                const isPending = entry.status === 'pendente';

                                return (
                                  <div
                                    key={entry.id}
                                    style={{
                                      border: isPending ? '1px solid var(--primary-border)' : '1px solid var(--border-color)',
                                      borderRadius: 6,
                                      padding: '8px 10px',
                                      backgroundColor: isPending ? 'var(--primary-subtle)' : 'var(--bg-card-subtle)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                      transition: 'border-color 0.15s ease',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {emp?.avatar_url ? (
                                          <img
                                            src={emp.avatar_url}
                                            alt={emp.full_name}
                                            style={{
                                              width: 28,
                                              height: 28,
                                              borderRadius: '50%',
                                              objectFit: 'cover',
                                              border: '1px solid var(--border-color)',
                                              flexShrink: 0,
                                            }}
                                          />
                                        ) : (
                                          <div
                                            style={{
                                              width: 28,
                                              height: 28,
                                              borderRadius: '50%',
                                              backgroundColor: 'var(--primary)',
                                              color: '#fff',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: 12,
                                              fontWeight: 700,
                                              flexShrink: 0,
                                            }}
                                          >
                                            {(emp?.full_name || 'C').charAt(0)}
                                          </div>
                                        )}
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {emp?.full_name || 'Colaborador'}
                                          </div>
                                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                            {entry.work_date} às {timeStr} • {site ? site.name : 'Geral'}
                                          </div>
                                        </div>
                                      </div>
                                      <span
                                        className={`badge-flat ${
                                          entry.status === 'aprovado'
                                            ? 'success'
                                            : entry.status === 'rejeitado'
                                            ? 'danger'
                                            : 'warning'
                                        }`}
                                        style={{ fontSize: 9, padding: '2px 5px', flexShrink: 0 }}
                                      >
                                        {entry.status.toUpperCase()}
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border-color)' }}>
                                      <span className="badge-flat primary" style={{ fontSize: 9, padding: '1px 5px' }}>
                                        {entry.entry_type.toUpperCase()}
                                      </span>

                                      {isPending ? (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                          <button
                                            className="btn-flat-success"
                                            style={{ padding: '3px 6px', fontSize: 10 }}
                                            onClick={() => handleValidateEntry(entry.id, 'aprovado')}
                                            title="Validar Ponto"
                                          >
                                            <Check size={11} />
                                            Validar
                                          </button>
                                          <button
                                            className="btn-flat-danger"
                                            style={{ padding: '3px 6px', fontSize: 10 }}
                                            onClick={() => handleValidateEntry(entry.id, 'rejeitado')}
                                            title="Rejeitar Ponto"
                                          >
                                            <X size={11} />
                                            Rejeitar
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                          Processado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      ) : (
                        /* ABA DE JUSTIFICATIVAS DE FALTA */
                        <div
                          className="custom-scroll"
                          style={{
                            flex: 1,
                            minHeight: 0,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            paddingRight: 6,
                            paddingBottom: 4,
                          }}
                        >
                          {justifications.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                              Nenhuma justificativa de falta submetida.
                            </div>
                          ) : (
                            [...justifications]
                              .sort((a, b) => {
                                if (a.status === 'pendente' && b.status !== 'pendente') return -1;
                                if (a.status !== 'pendente' && b.status === 'pendente') return 1;
                                return new Date(b.date).getTime() - new Date(a.date).getTime();
                              })
                              .map((j) => {
                                const emp = employees.find((x) => x.id === j.employee_id);
                                const isPending = j.status === 'pendente';

                                return (
                                  <div
                                    key={j.id}
                                    style={{
                                      border: isPending ? '1px solid var(--warning)' : '1px solid var(--border-color)',
                                      borderRadius: 6,
                                      padding: '8px 10px',
                                      backgroundColor: isPending ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card-subtle)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {emp?.avatar_url ? (
                                          <img
                                            src={emp.avatar_url}
                                            alt={emp.full_name}
                                            style={{
                                              width: 28,
                                              height: 28,
                                              borderRadius: '50%',
                                              objectFit: 'cover',
                                              border: '1px solid var(--border-color)',
                                              flexShrink: 0,
                                            }}
                                          />
                                        ) : (
                                          <div
                                            style={{
                                              width: 28,
                                              height: 28,
                                              borderRadius: '50%',
                                              backgroundColor: 'var(--primary)',
                                              color: '#fff',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontSize: 12,
                                              fontWeight: 700,
                                              flexShrink: 0,
                                            }}
                                          >
                                            {(emp?.full_name || 'C').charAt(0)}
                                          </div>
                                        )}
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {j.employee_name || emp?.full_name || 'Colaborador'}
                                          </div>
                                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                            Falta no dia {j.date.split('-').reverse().join('/')}
                                          </div>
                                        </div>
                                      </div>

                                      <span
                                        className={`badge-flat ${
                                          j.status === 'aprovada'
                                            ? 'success'
                                            : j.status === 'rejeitada'
                                            ? 'danger'
                                            : 'warning'
                                        }`}
                                        style={{ fontSize: 9, padding: '2px 5px', flexShrink: 0 }}
                                      >
                                        {j.status.toUpperCase()}
                                      </span>
                                    </div>

                                    <div style={{ fontSize: 11, color: 'var(--text-main)', lineHeight: 1.3, backgroundColor: 'var(--bg-main)', padding: '4px 6px', borderRadius: 4 }}>
                                      {j.reason}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border-color)' }}>
                                      {j.photos && j.photos.length > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => setJustifPreviewPhoto(j.photos[0])}
                                          style={{
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            padding: 0,
                                            fontSize: 10,
                                            fontWeight: 600,
                                            color: 'var(--primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                          }}
                                        >
                                          Ver {j.photos.length} comprovativo(s)
                                        </button>
                                      ) : (
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Sem fotos</span>
                                      )}

                                      {isPending ? (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                          <button
                                            className="btn-flat-success"
                                            style={{ padding: '3px 6px', fontSize: 10 }}
                                            onClick={() => handleValidateJustification(j.id, 'aprovada')}
                                            title="Aprovar Justificativa"
                                          >
                                            <Check size={11} />
                                            Aprovar
                                          </button>
                                          <button
                                            className="btn-flat-danger"
                                            style={{ padding: '3px 6px', fontSize: 10 }}
                                            onClick={() => handleValidateJustification(j.id, 'rejeitada')}
                                            title="Rejeitar Justificativa"
                                          >
                                            <X size={11} />
                                            Rejeitar
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                          Processada
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Card do Calendário de Próximos Eventos (ao lado da Assiduidade da Equipa) */}
                    <DashboardCalendarCard
                      companyId={activeCompany.id}
                      sites={sites}
                      employees={employees}
                      onOpenCalendar={() => setCurrentPage('calendario')}
                    />
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

                {/* Barra de Pesquisa, Filtro, Ordenação e Layout de Funcionários */}
                <div
                  className="content-panel"
                  style={{
                    padding: '12px 16px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 360, display: 'flex', alignItems: 'center' }}>
                      <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12 }} />
                      <input
                        type="text"
                        placeholder="Pesquisar por nome, cargo, e-mail..."
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 36px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* Filtro de Estado */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Filter size={15} color="var(--text-muted)" />
                      <select
                        value={empStatusFilter}
                        onChange={(e) => setEmpStatusFilter(e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: 13,
                        }}
                      >
                        <option value="all">Todos os Estados</option>
                        <option value="active">Apenas Ativos</option>
                        <option value="inactive">Apenas Inativos</option>
                      </select>
                    </div>

                    {/* Ordenação (Sort By) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowUpDown size={15} color="var(--text-muted)" />
                      <select
                        value={empSortBy}
                        onChange={(e) => setEmpSortBy(e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: 13,
                        }}
                      >
                        <option value="name-asc">Nome (A - Z)</option>
                        <option value="name-desc">Nome (Z - A)</option>
                        <option value="rate-desc">Taxa Horária (€ Maior)</option>
                        <option value="rate-asc">Taxa Horária (€ Menor)</option>
                        <option value="admission-desc">Admissão (Mais Recente)</option>
                        <option value="admission-asc">Admissão (Mais Antiga)</option>
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
                        onClick={() => setEmpViewMode('table')}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: empViewMode === 'table' ? 'var(--primary)' : 'transparent',
                          color: empViewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <List size={14} /> Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmpViewMode('cards')}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: empViewMode === 'cards' ? 'var(--primary)' : 'transparent',
                          color: empViewMode === 'cards' ? '#ffffff' : 'var(--text-muted)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <LayoutGrid size={14} /> Cards
                      </button>
                    </div>
                  </div>
                </div>

                {/* Exibição em Tabela ou em Cards */}
                {empViewMode === 'table' ? (
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
                          {filteredAndSortedEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                                Nenhum colaborador encontrado com os filtros selecionados.
                              </td>
                            </tr>
                          ) : (
                            filteredAndSortedEmployees.map((emp) => (
                              <tr
                                key={emp.id}
                                onClick={() => setSelectedEmployeeForDetail(emp)}
                                style={{ cursor: 'pointer' }}
                                title="Clique para ver ficha completa e histórico"
                              >
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {emp.avatar_url ? (
                                      <img
                                        src={emp.avatar_url}
                                        alt={emp.full_name}
                                        style={{
                                          width: 36,
                                          height: 36,
                                          borderRadius: '50%',
                                          objectFit: 'cover',
                                          border: '2px solid var(--border-color)',
                                          flexShrink: 0,
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: 36,
                                          height: 36,
                                          borderRadius: '50%',
                                          backgroundColor: 'var(--primary-subtle)',
                                          color: 'var(--primary)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: 14,
                                          fontWeight: 700,
                                          flexShrink: 0,
                                        }}
                                      >
                                        {emp.full_name.charAt(0)}
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontWeight: 600 }}>{emp.full_name}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        Admissão: {emp.admission_date ? emp.admission_date.split('-').reverse().join('/') : (emp.created_at ? emp.created_at.slice(0, 10).split('-').reverse().join('/') : '-')} • Meta: {emp.monthly_target_hours}h/mês
                                      </div>
                                    </div>
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
                                <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button
                                      className="btn-flat-primary"
                                      style={{ padding: '4px 8px', fontSize: 11 }}
                                      onClick={() => setSelectedEmployeeForDetail(emp)}
                                    >
                                      Ver Ficha
                                    </button>
                                    <button
                                      className="btn-flat-secondary"
                                      onClick={() => handleOpenEditEmployee(emp)}
                                      title="Editar rápido"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      className="btn-flat-danger"
                                      onClick={() => handleDeleteEmployee(emp.id)}
                                      title="Excluir"
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
                ) : (
                  /* Modo Cards para Funcionários */
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {filteredAndSortedEmployees.length === 0 ? (
                      <div className="content-panel" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                        Nenhum colaborador encontrado com os filtros selecionados.
                      </div>
                    ) : (
                      filteredAndSortedEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          className="content-panel"
                          style={{
                            padding: 20,
                            borderRadius: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 14,
                            cursor: 'pointer',
                            transition: 'border-color 0.15s, transform 0.15s',
                          }}
                          onClick={() => setSelectedEmployeeForDetail(emp)}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              {emp.avatar_url ? (
                                <img
                                  src={emp.avatar_url}
                                  alt={emp.full_name}
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '2px solid var(--border-color)',
                                    flexShrink: 0,
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--primary)',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 18,
                                    fontWeight: 800,
                                    flexShrink: 0,
                                  }}
                                >
                                  {emp.full_name.charAt(0)}
                                </div>
                              )}
                              <span
                                className={`badge-flat ${emp.is_active ? 'success' : 'danger'}`}
                                style={{ fontSize: 10, fontWeight: 700 }}
                              >
                                {emp.is_active ? 'ATIVO' : 'INATIVO'}
                              </span>
                            </div>

                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-main)' }}>
                              {emp.full_name}
                            </h3>
                            <span className="badge-flat primary" style={{ fontSize: 11, display: 'inline-block', marginBottom: 12 }}>
                              {emp.job_title}
                            </span>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Mail size={13} color="var(--primary)" />
                                <span style={{ color: 'var(--text-main)' }}>{emp.email}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Phone size={13} color="var(--primary)" />
                                <span>{emp.phone || 'Sem telefone'}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>PIN App: <strong style={{ color: 'var(--primary)' }}>{emp.access_code}</strong></span>
                                <span>•</span>
                                <span>Taxa: <strong style={{ color: 'var(--text-main)' }}>{Number(emp.hourly_rate).toFixed(2)} €/h</strong></span>
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderTop: '1px solid var(--border-color)',
                              paddingTop: 12,
                              marginTop: 4,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="btn-flat-primary"
                              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
                              onClick={() => setSelectedEmployeeForDetail(emp)}
                            >
                              Ver Ficha
                            </button>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="btn-flat-secondary"
                                style={{ padding: '6px 8px' }}
                                onClick={() => handleOpenEditEmployee(emp)}
                                title="Editar"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-flat-danger"
                                style={{ padding: '6px 8px' }}
                                onClick={() => handleDeleteEmployee(emp.id)}
                                title="Excluir"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
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

                {/* Barra de Pesquisa, Filtro, Ordenação e Layout de Obras */}
                <div
                  className="content-panel"
                  style={{
                    padding: '12px 16px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 360, display: 'flex', alignItems: 'center' }}>
                      <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12 }} />
                      <input
                        type="text"
                        placeholder="Pesquisar por nome, código, morada..."
                        value={siteSearch}
                        onChange={(e) => setSiteSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 36px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* Filtro de Estado */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Filter size={15} color="var(--text-muted)" />
                      <select
                        value={siteStatusFilter}
                        onChange={(e) => setSiteStatusFilter(e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: 13,
                        }}
                      >
                        <option value="all">Todos os Estados</option>
                        <option value="ativa">Apenas Ativas</option>
                        <option value="pausada">Apenas Pausadas</option>
                        <option value="concluida">Apenas Concluídas</option>
                      </select>
                    </div>

                    {/* Ordenação (Sort By) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowUpDown size={15} color="var(--text-muted)" />
                      <select
                        value={siteSortBy}
                        onChange={(e) => setSiteSortBy(e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: 13,
                        }}
                      >
                        <option value="name-asc">Nome (A - Z)</option>
                        <option value="name-desc">Nome (Z - A)</option>
                        <option value="code-asc">Código da Obra</option>
                        <option value="status">Estado da Obra</option>
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
                        onClick={() => setSiteViewMode('table')}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: siteViewMode === 'table' ? 'var(--primary)' : 'transparent',
                          color: siteViewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <List size={14} /> Lista
                      </button>
                      <button
                        type="button"
                        onClick={() => setSiteViewMode('cards')}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: siteViewMode === 'cards' ? 'var(--primary)' : 'transparent',
                          color: siteViewMode === 'cards' ? '#ffffff' : 'var(--text-muted)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <LayoutGrid size={14} /> Cards
                      </button>
                    </div>
                  </div>
                </div>

                {siteViewMode === 'table' ? (
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
                          {filteredAndSortedSites.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                                Nenhuma obra encontrada com os filtros selecionados.
                              </td>
                            </tr>
                          ) : (
                            filteredAndSortedSites.map((site) => (
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
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: 16,
                    }}
                  >
                    {filteredAndSortedSites.length === 0 ? (
                      <div
                        className="content-panel"
                        style={{
                          gridColumn: '1 / -1',
                          textAlign: 'center',
                          padding: 32,
                          color: 'var(--text-muted)',
                        }}
                      >
                        Nenhuma obra encontrada com os filtros selecionados.
                      </div>
                    ) : (
                      filteredAndSortedSites.map((site) => (
                        <div
                          key={site.id}
                          className="content-panel"
                          style={{
                            margin: 0,
                            padding: '16px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 14,
                            cursor: 'pointer',
                            transition: 'border-color 0.2s ease, transform 0.15s ease',
                          }}
                          onClick={() => setSelectedSiteForDetail(site)}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span className="badge-flat primary" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                #{site.share_code}
                              </span>
                              <span
                                className={`badge-flat ${
                                  site.status === 'ativa'
                                    ? 'success'
                                    : site.status === 'pausada'
                                    ? 'warning'
                                    : 'primary'
                                }`}
                                style={{ fontSize: 11 }}
                              >
                                {site.status.toUpperCase()}
                              </span>
                            </div>

                            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-main)', marginBottom: 6 }}>
                              {site.name}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                              <Building2 size={13} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {site.address}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                              <User size={13} />
                              <span>{site.manager_name || 'Sem encarregado definido'}</span>
                            </div>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: 12,
                              borderTop: '1px solid var(--border-color)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>
                              Abrir Obra →
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn-flat-secondary"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                onClick={() => handleOpenEditSite(site)}
                              >
                                <Edit2 size={12} />
                                Editar
                              </button>
                              <button
                                className="btn-flat-danger"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                onClick={(e) => handleDeleteSite(site.id, e)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            {/* 4. PÁGINA DE GESTÃO FINANCEIRA DE OBRAS */}
            {currentPage === 'financeiro' && (
              <FinancialPage
                company={activeCompany}
                sites={sites}
                records={financialRecords}
                onRefresh={() => loadData(activeCompany.id)}
                showNotice={showNotice}
              />
            )}

            {/* 5. PÁGINA DE INVENTÁRIO */}
            {currentPage === 'inventario' && (
              <InventoryPage
                companyId={activeCompany.id}
                sites={sites}
                showNotice={showNotice}
              />
            )}

            {/* 6. PÁGINA DE CARRINHAS / FROTA */}
            {currentPage === 'carrinhas' && (
              <VehiclesPage
                companyId={activeCompany.id}
                sites={sites}
                employees={employees}
                onSelectVehicle={(veh) => setSelectedVehicleForDetail(veh)}
                showNotice={showNotice}
              />
            )}

            {/* 7. PÁGINA DE CALENDÁRIO / AGENDA */}
            {currentPage === 'calendario' && (
              <CalendarPage
                companyId={activeCompany.id}
                sites={sites}
                employees={employees}
                showNotice={showNotice}
              />
            )}

            {/* 8. PÁGINA DE CONFIGURAÇÕES DA FIRMA */}
            {currentPage === 'configuracoes' && (
              <SettingsPage
                company={activeCompany}
                onCompanyUpdated={(updated) => {
                  setActiveCompany(updated);
                }}
                onAccountDeleted={handleLogout}
                showNotice={showNotice}
              />
            )}
          </>
        )}
        </div>

        {/* RODAPÉ DO SITE */}
        <footer className="app-footer">
          <span>Castello powered by SSO</span>
        </footer>
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

                <div className="flat-form-group full">
                  <label>Foto de Perfil (URL da Imagem)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {empForm.avatar_url ? (
                      <img
                        src={empForm.avatar_url}
                        alt="Prévia"
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }}
                      />
                    ) : null}
                    <input
                      type="url"
                      placeholder="https://... (deixe em branco para usar iniciais)"
                      value={empForm.avatar_url}
                      onChange={(e) => setEmpForm({ ...empForm, avatar_url: e.target.value })}
                      style={{ flex: 1 }}
                    />
                  </div>
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

      {/* MODAL LIGHTBOX: FOTO DO COMPROVATIVO DA FALTA */}
      {justifPreviewPhoto && (
        <div
          className="flat-modal-backdrop"
          style={{ zIndex: 9999 }}
          onClick={() => setJustifPreviewPhoto(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={justifPreviewPhoto}
              alt="Comprovativo Ampliado"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: 8,
                border: '2px solid var(--border-color)',
                objectFit: 'contain',
              }}
            />
            <button
              type="button"
              onClick={() => setJustifPreviewPhoto(null)}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#ffffff',
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
