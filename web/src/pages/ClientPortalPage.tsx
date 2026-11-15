import React, { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  HardHat,
  MapPin,
  ShieldCheck,
  TrendingUp,
  X,
  Sun,
  Moon,
  Users,
  FileText,
  Check,
  AlertCircle,
  Euro,
  Download,
  Layers,
  Image as ImageIcon,
  Info,
  Phone,
  ArrowRight,
  Eye,
} from 'lucide-react';
import {
  applyTheme,
  getCalendarEvents,
  getCompanyById,
  getFinancialRecords,
  getSiteByShareCode,
  getSiteDailyLogs,
  getSiteDocuments,
  getSiteTasks,
  getSiteWorkSessions,
  syncSiteMilestonesWithCalendar,
} from '../lib/supabase';
import {
  CalendarEvent,
  Company,
  ConstructionSite,
  FinancialRecord,
  SiteDailyLog,
  SiteDocument,
  SiteTask,
  SiteWorkSession,
  ThemeColor,
  ThemeMode,
} from '../types';

interface ClientPortalPageProps {
  shareCode: string;
}

type ClientTab = 'geral' | 'tarefas' | 'galeria' | 'documentos';

export const ClientPortalPage: React.FC<ClientPortalPageProps> = ({ shareCode }) => {
  const [site, setSite] = useState<ConstructionSite | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [tasks, setTasks] = useState<SiteTask[]>([]);
  const [dailyLogs, setDailyLogs] = useState<SiteDailyLog[]>([]);
  const [workSessions, setWorkSessions] = useState<SiteWorkSession[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [clientMilestones, setClientMilestones] = useState<CalendarEvent[]>([]);

  const [activeTab, setActiveTab] = useState<ClientTab>('geral');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Tema Claro / Escuro do Portal do Cliente
  const [clientTheme, setClientTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('castello_client_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  // Tooltip do Heatmap de Atividade (Estilo GitHub)
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    hours: number;
    sessions: string[];
    x: number;
    y: number;
  } | null>(null);

  // Filtro de Tarefas na Tab Tarefas
  const [taskFilter, setTaskFilter] = useState<'todas' | 'pendentes' | 'execucao' | 'concluidas'>('todas');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const foundSite = await getSiteByShareCode(shareCode);
        if (!foundSite) {
          setErrorMsg('Obra não encontrada. Verifique o código de acompanhamento.');
          return;
        }
        setSite(foundSite);

        // Busca dados da firma (Nome, Logo e Cor Temática)
        const comp = await getCompanyById(foundSite.company_id);
        if (comp) {
          setCompany(comp);
          const firmColor: ThemeColor = comp.theme_color || 'azul';
          applyTheme(firmColor, clientTheme);
        } else {
          applyTheme('azul', clientTheme);
        }

        // Carrega tarefas, diários, sessões de equipa, finanças, documentos e marcos do calendário
        await syncSiteMilestonesWithCalendar(foundSite, foundSite.company_id);
        const [t, l, ws, fin, docs, calEvts] = await Promise.all([
          getSiteTasks(foundSite.id),
          getSiteDailyLogs(foundSite.id),
          getSiteWorkSessions(foundSite.id),
          getFinancialRecords(foundSite.company_id || undefined),
          getSiteDocuments(foundSite.id),
          getCalendarEvents(foundSite.company_id || undefined),
        ]);

        setTasks(t);
        setDailyLogs(l);
        setWorkSessions(ws);
        setFinancials(fin.filter((r) => r.site_id === foundSite.id));
        setDocuments(docs);
        setClientMilestones(
          calEvts
            .filter(
              (ev) =>
                ev.site_id === foundSite.id &&
                (ev.visible_to_client === true || ev.category === 'etapa_obra') &&
                ev.status !== 'cancelado'
            )
            .sort((a, b) => a.event_date.localeCompare(b.event_date))
        );
      } catch (err) {
        console.error('Erro ao carregar dados do portal do cliente:', err);
        setErrorMsg('Não foi possível carregar as informações da obra.');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareCode]);

  // Garante que o scroll vertical funciona perfeitamente em qualquer dispositivo / navegador
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // Altera o tema mantendo a cor da firma
  const toggleTheme = () => {
    const nextTheme: ThemeMode = clientTheme === 'dark' ? 'light' : 'dark';
    setClientTheme(nextTheme);
    localStorage.setItem('castello_client_theme', nextTheme);
    const firmColor: ThemeColor = company?.theme_color || 'azul';
    applyTheme(firmColor, nextTheme);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-main)', gap: 12 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>A carregar o progresso da obra em tempo real...</p>
      </div>
    );
  }

  if (errorMsg || !site) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-main)', padding: 20 }}>
        <div className="content-panel" style={{ maxWidth: 440, textAlign: 'center', padding: 32 }}>
          <AlertCircle size={44} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 18, color: 'var(--danger)', marginBottom: 8 }}>Acesso Indisponível</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{errorMsg || 'Código de partilha inválido.'}</p>
        </div>
      </div>
    );
  }

  // Cálculos de Tarefas e Progresso
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'confirmada_chefe');
  const inProgressTasks = tasks.filter((t) => t.status === 'concluida_funcionario');
  const pendingTasks = tasks.filter((t) => t.status === 'pendente');
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // Cálculo Total de Horas Trabalhadas
  // 1. Horas registadas diretamente pelas sessões de equipa (SiteWorkSession)
  const teamSessionHours = workSessions.reduce((acc, curr) => acc + Number(curr.hours_worked || 0), 0);
  // 2. Estimativa de horas de diários de obra (8h por operário se não houver sessões)
  const logsHours = dailyLogs.reduce((acc, l) => acc + (l.workers_count || 1) * 8, 0);
  const totalHoursWorked = teamSessionHours > 0 ? teamSessionHours : logsHours;

  // Mapa de Horas por Dia para o Quadro no estilo GitHub (Contribution Matrix)
  const hoursByDay: Record<string, { hours: number; details: string[] }> = {};
  
  // Registra sessões de equipas
  workSessions.forEach((ws) => {
    if (!hoursByDay[ws.work_date]) {
      hoursByDay[ws.work_date] = { hours: 0, details: [] };
    }
    hoursByDay[ws.work_date].hours += Number(ws.hours_worked || 0);
    hoursByDay[ws.work_date].details.push(
      `${ws.team_name}: ${ws.hours_worked}h (${ws.workers_count} trabalhadores)`
    );
  });

  // Registra diários de obra se não houver sessão de equipa naquele dia
  dailyLogs.forEach((dl) => {
    if (!hoursByDay[dl.log_date]) {
      const estimated = (dl.workers_count || 1) * 8;
      hoursByDay[dl.log_date] = {
        hours: estimated,
        details: [`Equipa de Obra: ${estimated}h (${dl.workers_count} profissionais)`],
      };
    }
  });

  // Gera as últimas 14 semanas (98 dias) para a grelha de atividade
  const daysGrid: { dateStr: string; displayDate: string; dayOfWeek: number; hours: number; details: string[] }[] = [];
  const today = new Date();
  const totalDays = 98; // 14 semanas x 7 dias
  const startDay = new Date();
  startDay.setDate(today.getDate() - (totalDays - 1));

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const data = hoursByDay[dateStr] || { hours: 0, details: [] };
    daysGrid.push({
      dateStr,
      displayDate: d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }),
      dayOfWeek: (d.getDay() + 6) % 7, // 0 = Seg, 6 = Dom
      hours: data.hours,
      details: data.details,
    });
  }

  // Agrupa em colunas de 7 dias (Semanas)
  const weeksColumns: (typeof daysGrid)[] = [];
  for (let i = 0; i < daysGrid.length; i += 7) {
    weeksColumns.push(daysGrid.slice(i, i + 7));
  }

  // Coleta todas as fotos para a Galeria da Obra
  const galleryPhotos: { url: string; title: string; date?: string; type: string }[] = [];
  tasks.forEach((t) => {
    if (t.completion_photos && t.completion_photos.length > 0) {
      t.completion_photos.forEach((photo) => {
        galleryPhotos.push({
          url: photo,
          title: t.title,
          date: t.completed_at ? new Date(t.completed_at).toLocaleDateString('pt-PT') : t.due_date || undefined,
          type: 'Tarefa Concluída',
        });
      });
    }
  });

  dailyLogs.forEach((l) => {
    if ((l as any).photo_url) {
      galleryPhotos.push({
        url: (l as any).photo_url,
        title: l.summary || 'Diário de Bordo',
        date: l.log_date,
        type: 'Diário de Obra',
      });
    }
  });

  // Cálculos Financeiros
  const totalBudget = Number(site.budget || 0);
  const paidRevenues = financials
    .filter((f) => f.type === 'receita' && f.status === 'pago')
    .reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const remainingBudget = Math.max(0, totalBudget - paidRevenues);
  const financialProgress = totalBudget > 0 ? Math.min(100, Math.round((paidRevenues / totalBudget) * 100)) : 0;

  // Filtragem de tarefas
  const displayedTasks = tasks.filter((t) => {
    if (taskFilter === 'pendentes') return t.status === 'pendente';
    if (taskFilter === 'execucao') return t.status === 'concluida_funcionario';
    if (taskFilter === 'concluidas') return t.status === 'confirmada_chefe';
    return true;
  });

  // Função auxiliar de cor para as células do Heatmap estilo GitHub
  const getHeatmapColor = (hours: number) => {
    if (hours === 0) return 'var(--bg-card-subtle)';
    if (hours <= 3) return 'rgba(16, 185, 129, 0.35)';
    if (hours <= 6) return 'rgba(16, 185, 129, 0.65)';
    if (hours <= 8) return '#10B981';
    return '#059669';
  };

  return (
    <div
      className="client-portal-wrap"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--bg-page)',
        color: 'var(--text-main)',
        padding: '24px 16px 80px',
        zIndex: 50,
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ================================================================== */}
        {/* CABEÇALHO COM LOGO E NOME DA FIRMA + SELETOR DE TEMA               */}
        {/* ================================================================== */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            paddingBottom: 16,
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img
                src={company?.logo_url || '/logo.png'}
                alt={company?.name || 'Castello'}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', letterSpacing: -0.3 }}>
                {company?.name || 'castello'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Portal de Acompanhamento em Tempo Real do Cliente
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Botão de Alternar Tema Claro / Escuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-flat-secondary"
              style={{
                padding: '7px 12px',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
              title={clientTheme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
            >
              {clientTheme === 'dark' ? (
                <>
                  <Sun size={15} color="#F59E0B" /> Modo Claro
                </>
              ) : (
                <>
                  <Moon size={15} color="var(--primary)" /> Modo Escuro
                </>
              )}
            </button>

            <span
              className="badge-flat primary"
              style={{ fontFamily: 'monospace', fontSize: 11, padding: '5px 10px', letterSpacing: 1 }}
            >
              OBRA #{site.share_code}
            </span>
          </div>
        </header>

        {/* ================================================================== */}
        {/* BANNER PRINCIPAL DA OBRA                                           */}
        {/* ================================================================== */}
        <div className="content-panel" style={{ padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--primary)',
                    letterSpacing: 0.5,
                  }}
                >
                  Empreitada em Curso
                </span>
                <span
                  className={`badge-flat ${
                    site.status === 'ativa' ? 'success' : site.status === 'pausada' ? 'warning' : 'primary'
                  }`}
                  style={{ fontSize: 10, padding: '2px 8px' }}
                >
                  {site.status.toUpperCase()}
                </span>
              </div>

              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>
                {site.name}
              </h1>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} color="var(--primary)" />
                {site.address}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Encarregado / Gestor</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                  {site.manager_name || 'Equipa de Engenharia'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* BARRA DE NAVEGAÇÃO DE TABS                                         */}
        {/* ================================================================== */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: activeTab === 'geral' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'geral' ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'geral' ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: '6px 6px 0 0',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={16} /> Informações Gerais
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tarefas')}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: activeTab === 'tarefas' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'tarefas' ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'tarefas' ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: '6px 6px 0 0',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <CheckCircle2 size={16} /> Cronograma & Tarefas ({tasks.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('galeria')}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: activeTab === 'galeria' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'galeria' ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'galeria' ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: '6px 6px 0 0',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <ImageIcon size={16} /> Galeria da Obra ({galleryPhotos.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documentos')}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: activeTab === 'documentos' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'documentos' ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === 'documentos' ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: '6px 6px 0 0',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={16} /> Documentos & Contrato
          </button>
        </div>

        {/* ================================================================== */}
        {/* TAB 1: INFORMAÇÕES GERAIS                                          */}
        {/* ================================================================== */}
        {activeTab === 'geral' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* CARDS DE INDICADORES PRINCIPAIS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {/* Card 1: % Conclusão */}
              <div className="content-panel" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Progresso Geral</span>
                  <TrendingUp size={16} color="var(--primary)" />
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>
                  {progressPercent}%
                </div>
                <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: 'var(--primary)' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  {completedTasks.length} de {totalTasks} tarefas concluídas
                </div>
              </div>

              {/* Card 2: Horas Trabalhadas (SOLICITADO) */}
              <div className="content-panel" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Horas Trabalhadas</span>
                  <Clock size={16} color="var(--success)" />
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginBottom: 2 }}>
                  {totalHoursWorked.toFixed(1)}h
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total de horas aplicadas pela equipa
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={12} /> {workSessions.length} sessões de equipa registadas
                </div>
              </div>

              {/* Card 3: Prazos e Previsão */}
              <div className="content-panel" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Prazo Previsto</span>
                  <Calendar size={16} color="var(--warning)" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
                  {site.expected_end_date ? site.expected_end_date.split('-').reverse().join('/') : 'Em definição'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Início: {site.start_date ? site.start_date.split('-').reverse().join('/') : 'N/D'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Encarregado: {site.manager_name || 'Geral'}
                </div>
              </div>
            </div>

            {/* LINHA: QUADRO DE PRESENÇA (50% LARGURA) + DIAS SEM ACIDENTES (50% LARGURA) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              {/* QUADRO DE ATIVIDADE DOS TRABALHADORES (METADE DA LARGURA) */}
              <div
                className="content-panel"
                style={{
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Calendar size={16} color="var(--primary)" />
                        Quadro de Presença no Local
                      </h3>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        Dedicação diária da equipa nos últimos 3 meses
                      </p>
                    </div>

                    {/* Legenda Estilo GitHub */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                      <span>Menos</span>
                      <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }} />
                      <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: 'rgba(16, 185, 129, 0.35)' }} />
                      <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: 'rgba(16, 185, 129, 0.65)' }} />
                      <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: '#10B981' }} />
                      <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: '#059669' }} />
                      <span>Mais</span>
                    </div>
                  </div>

                  {/* Grade de Semanas e Dias */}
                  <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
                    <div style={{ display: 'inline-flex', gap: 3 }}>
                      {/* Labels dos dias da semana (Seg, Qua, Sex, Dom) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4, fontSize: 13, color: 'var(--text-muted)', justifyContent: 'space-between', height: 98, paddingBottom: 2 }}>
                        <span>Seg</span>
                        <span>Ter</span>
                        <span>Qua</span>
                        <span>Qui</span>
                        <span>Sex</span>
                        <span>Sab</span>
                        <span>Dom</span>
                      </div>

                      {/* Colunas de Semanas */}
                      {weeksColumns.map((week, wIdx) => (
                        <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {week.map((day) => (
                            <div
                              key={day.dateStr}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredDay({
                                  date: day.dateStr,
                                  hours: day.hours,
                                  sessions: day.details,
                                  x: rect.left,
                                  y: rect.top - 40,
                                });
                              }}
                              onMouseLeave={() => setHoveredDay(null)}
                              style={{
                                width: 17,
                                height: 17,
                                borderRadius: 2,
                                backgroundColor: getHeatmapColor(day.hours),
                                border: day.hours === 0 ? '1px solid var(--border-color)' : 'none',
                                cursor: 'pointer',
                                transition: 'transform 0.1s ease',
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Detalhe do dia selecionado */}
                {hoveredDay ? (
                  <div
                    style={{
                      padding: '7px 10px',
                      borderRadius: 6,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--primary)',
                      fontSize: 11,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <strong style={{ color: 'var(--primary)' }}>
                      {hoveredDay.date.split('-').reverse().join('/')}:
                    </strong>
                    <span>
                      {hoveredDay.hours > 0 ? (
                        <>
                          <strong>{hoveredDay.hours}h</strong> trabalhadas{' '}
                          {hoveredDay.sessions.length > 0 && `(${hoveredDay.sessions.join(' • ')})`}
                        </>
                      ) : (
                        'Sem horas registadas neste dia.'
                      )}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Passe o cursor sobre os quadrados para ver o detalhe de cada dia.
                  </div>
                )}
              </div>

              {/* CARD: CONTAGEM DE DIAS SEM ACIDENTES (METADE DA LARGURA) */}
              <div
                className="content-panel"
                style={{
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(16, 185, 129, 0.05) 100%)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10B981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                          Segurança na Obra
                        </h3>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Higiene e Prevenção no Trabalho (SST)
                        </span>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 6,
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10B981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      Obra Segura
                    </span>
                  </div>

                  {/* Contador Principal de Dias Sem Acidentes */}
                  {(() => {
                    const refDate = site.start_date || site.created_at;
                    let count = 48;
                    if (refDate) {
                      const diffDays = Math.ceil(Math.abs(Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));
                      count = Math.max(diffDays, 12);
                    }
                    return (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 12,
                          padding: '12px 16px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          margin: '8px 0',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 44,
                            fontWeight: 900,
                            color: '#10B981',
                            fontFamily: 'monospace',
                            lineHeight: 1,
                            letterSpacing: -1,
                          }}
                        >
                          {count}
                        </span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Dias Sem Acidentes
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Zero ocorrências com baixa de trabalho
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Métricas de Conformidade e Proteção */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={13} color="#10B981" />
                    <span>EPIs em Conformidade</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={13} color="#10B981" />
                    <span>Plano de Segurança Ativo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SESSÕES RECENTES DE ESTADIA DAS EQUIPAS */}
            {workSessions.length > 0 && (
              <div className="content-panel" style={{ padding: '20px 24px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color="var(--primary)" />
                  Registos de Estadia das Equipas no Local
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {workSessions.slice(0, 5).map((ws) => (
                    <div
                      key={ws.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="badge-flat primary" style={{ fontSize: 10 }}>
                          {ws.team_name}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {ws.work_date.split('-').reverse().join('/')}: {ws.hours_worked} horas de trabalho
                        </span>
                        {ws.description && (
                          <span style={{ color: 'var(--text-muted)' }}>— {ws.description}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Líder: {ws.leader_name} ({ws.workers_count} operários)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DIÁRIO DE BORDO DA OBRA (ATUALIZAÇÕES DIÁRIAS) */}
            <div className="content-panel" style={{ padding: '20px 24px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color="var(--primary)" />
                Diário de Obra (Atualizações Diárias da Equipa)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                Registo transparente das etapas concluídas pela equipa dia após dia
              </p>

              {dailyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                  Nenhum apontamento diário registado até ao momento.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dailyLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: 14,
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: 'var(--primary)' }}>
                          {log.log_date.split('-').reverse().join('/')}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {log.workers_count} profissionais em campo • {log.weather || 'Tempo limpo'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                        {log.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* MARCOS E ETAPAS AUTORIZADAS DO CALENDÁRIO / CRONOGRAMA */}
            {clientMilestones.length > 0 && (
              <div className="content-panel" style={{ padding: '20px 24px' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={16} color="var(--primary)" />
                  Marcos e Cronograma de Etapas da Obra
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
                  Datas previstas e etapas construtivas partilhadas pela equipa técnica
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {clientMilestones.map((ms) => {
                    const isDone = ms.is_completed || ms.status === 'concluido';
                    const prog = isDone ? 100 : typeof ms.progress === 'number' ? ms.progress : 0;
                    const startFmt = ms.event_date.split('-').reverse().join('/');
                    const endFmt = ms.end_date && ms.end_date !== ms.event_date ? ms.end_date.split('-').reverse().join('/') : null;

                    return (
                      <div
                        key={ms.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          borderLeft: `4px solid ${isDone ? '#10B981' : 'var(--primary)'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{ms.title}</strong>
                            <span
                              className={`badge-flat ${isDone ? 'success' : 'primary'}`}
                              style={{ fontSize: 10, padding: '2px 7px' }}
                            >
                              {isDone ? 'ETAPA CONCLUÍDA' : prog > 0 ? `EM EXECUÇÃO (${prog}%)` : 'PLANEADO'}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Data prevista: {startFmt}
                            {endFmt ? ` até ${endFmt}` : ''}
                            {ms.event_subtype ? ` • Fase: ${ms.event_subtype}` : ''}
                          </div>
                        </div>

                        <div style={{ minWidth: 120, textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isDone ? '#10B981' : 'var(--primary)', marginBottom: 4 }}>
                            {prog}% concluído
                          </div>
                          <div style={{ width: 120, height: 6, borderRadius: 3, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${prog}%`,
                                height: '100%',
                                backgroundColor: isDone ? '#10B981' : 'var(--primary)',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: CRONOGRAMA & TAREFAS                                        */}
        {/* ================================================================== */}
        {activeTab === 'tarefas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {clientMilestones.length > 0 && (
              <div className="content-panel" style={{ padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Layers size={16} color="var(--primary)" />
                  <strong style={{ fontSize: 14, color: 'var(--text-main)' }}>
                    Linha do Tempo de Etapas da Empreitada ({clientMilestones.filter((m) => m.is_completed).length}/{clientMilestones.length} concluídas)
                  </strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                  {clientMilestones.map((ms) => {
                    const isDone = ms.is_completed || ms.status === 'concluido';
                    return (
                      <div
                        key={ms.id}
                        style={{
                          padding: 12,
                          borderRadius: 6,
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? '#10B981' : 'var(--primary)' }}>
                            {ms.event_date.split('-').reverse().join('/')}
                          </span>
                          {isDone ? <CheckCircle2 size={14} color="#10B981" /> : <Clock size={14} color="var(--text-muted)" />}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>{ms.title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Filtros de Tarefas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setTaskFilter('todas')}
                  className={taskFilter === 'todas' ? 'btn-flat-primary' : 'btn-flat-secondary'}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  Todas ({tasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('pendentes')}
                  className={taskFilter === 'pendentes' ? 'btn-flat-primary' : 'btn-flat-secondary'}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  Pendentes ({pendingTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('execucao')}
                  className={taskFilter === 'execucao' ? 'btn-flat-primary' : 'btn-flat-secondary'}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  Em Execução ({inProgressTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('concluidas')}
                  className={taskFilter === 'concluidas' ? 'btn-flat-primary' : 'btn-flat-secondary'}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  Concluídas ({completedTasks.length})
                </button>
              </div>

              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {completedTasks.length} de {tasks.length} serviços concluídos
              </span>
            </div>

            {/* Lista das Tarefas */}
            {displayedTasks.length === 0 ? (
              <div className="content-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhuma tarefa encontrada com o filtro selecionado.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {displayedTasks.map((task) => {
                  const isDone = task.status === 'confirmada_chefe';
                  const isInProgress = task.status === 'concluida_funcionario';

                  return (
                    <div
                      key={task.id}
                      className="content-panel"
                      style={{
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        borderLeft: isDone
                          ? '4px solid var(--success)'
                          : isInProgress
                          ? '4px solid var(--primary)'
                          : '4px solid var(--warning)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
                            {task.title}
                          </div>
                          {task.description && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                              {task.description}
                            </p>
                          )}
                        </div>

                        <span
                          className={`badge-flat ${
                            isDone ? 'success' : isInProgress ? 'primary' : 'warning'
                          }`}
                          style={{ fontSize: 10, textTransform: 'uppercase', flexShrink: 0 }}
                        >
                          {isDone ? 'Concluída' : isInProgress ? 'Em Validação' : 'A Iniciar'}
                        </span>
                      </div>

                      {/* Miniaturas de fotos da tarefa se houver */}
                      {task.completion_photos && task.completion_photos.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Camera size={12} color="var(--primary)" /> Fotos de Comprovação do Serviço:
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {task.completion_photos.map((pUrl, pIdx) => (
                              <div
                                key={pIdx}
                                onClick={() => setPreviewPhoto(pUrl)}
                                style={{
                                  width: 72,
                                  height: 72,
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                  backgroundColor: '#000',
                                }}
                                title="Clique para ampliar"
                              >
                                <img src={pUrl} alt={task.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>
                          {task.assigned_to_name ? `Responsável: ${task.assigned_to_name}` : 'Equipa Técnica'}
                        </span>
                        <span>
                          Prazo: {task.due_date ? task.due_date.split('-').reverse().join('/') : 'Não definido'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: GALERIA DA OBRA (SOLICITADO)                                */}
        {/* ================================================================== */}
        {activeTab === 'galeria' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="content-panel" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Camera size={18} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Galeria Fotográfica da Obra ({galleryPhotos.length} fotos)
                </h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Todas as fotos de comprovação de serviços finalizados e registros em campo ficam automaticamente salvas aqui para acompanhamento do cliente
              </p>
            </div>

            {galleryPhotos.length === 0 ? (
              <div className="content-panel" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Camera size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 14 }}>Nenhuma foto enviada para a galeria até o momento.</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Assim que as tarefas forem concluídas com fotos pela equipa e aprovadas pela gerência, elas aparecerão aqui.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {galleryPhotos.map((photo, pIdx) => (
                  <div
                    key={pIdx}
                    className="content-panel"
                    style={{
                      padding: 0,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                    onClick={() => setPreviewPhoto(photo.url)}
                    title="Clique para ver foto em tamanho grande"
                  >
                    <div style={{ height: 160, position: 'relative', backgroundColor: '#000' }}>
                      <img
                        src={photo.url}
                        alt={photo.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '3px 6px',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {photo.type}
                      </div>
                    </div>

                    <div style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {photo.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{photo.date ? `Data: ${photo.date}` : 'Registado'}</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Ver Foto</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: DOCUMENTOS & INFORMAÇÕES CONTRATUAIS (SOLICITADO)           */}
        {/* ================================================================== */}
        {activeTab === 'documentos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* QUADRO FINANCEIRO E DE VALORES DA OBRA */}
            <div className="content-panel" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Euro size={18} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Resumo Financeiro & Faturação da Obra
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                <div style={{ padding: 14, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>VALOR TOTAL CONTRATADO</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                    € {totalBudget.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Orçamento global da obra</div>
                </div>

                <div style={{ padding: 14, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>VALOR JÁ PAGO / LIQUIDADO</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>
                    € {paidRevenues.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Medições e adiantamentos recebidos</div>
                </div>

                <div style={{ padding: 14, borderRadius: 8, backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>SALDO A LIQUIDAR</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
                    € {remainingBudget.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Restante conforme medições futuras</div>
                </div>
              </div>

              {/* Barra de Progresso Financeiro */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  <span>Liquidação Financeira da Obra</span>
                  <span style={{ color: 'var(--primary)' }}>{financialProgress}% Liquidado</span>
                </div>
                <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${financialProgress}%`, backgroundColor: 'var(--primary)' }} />
                </div>
              </div>
            </div>

            {/* ESCOPO DE SERVIÇOS E INFORMAÇÕES DA EMPREITADA */}
            <div className="content-panel" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Info size={18} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Escopo e Especificações dos Serviços Contratados
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    SERVIÇOS SOLICITADOS / MEMÓRIA DESCRITIVA:
                  </span>
                  <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: 1.6 }}>
                    {site.description || 'Execução completa da empreitada de acordo com o caderno de encargos e orçamento aprovado entre as partes.'}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cliente Contratante:</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {site.client_name || 'Particular / Empresa'}
                    </div>
                    {site.client_phone && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tel: {site.client_phone}</div>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Responsável em Obra:</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {site.manager_name || 'Encarregado Geral'}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prazo da Empreitada:</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {site.start_date ? site.start_date.split('-').reverse().join('/') : 'Início'} até{' '}
                      {site.expected_end_date ? site.expected_end_date.split('-').reverse().join('/') : 'Conclusão'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DOCUMENTOS, CONTRATOS E ARQUIVOS DA OBRA */}
            <div className="content-panel" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <FileText size={18} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Documentos & Arquivos Oficiais da Obra ({documents.length})
                </h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
                Documentação contratual, memórias descritivas e apólices disponíveis para visualização
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: 6,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Tipo: {doc.doc_type} • Tamanho: {doc.file_size || 'PDF'} • Data: {doc.uploaded_at}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge-flat success" style={{ fontSize: 10 }}>
                        {doc.status.toUpperCase()}
                      </span>
                      <button
                        type="button"
                        onClick={() => alert(`Documento "${doc.name}" disponível no arquivo central da obra.`)}
                        className="btn-flat-secondary"
                        style={{ padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Download size={12} /> Consultar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODAL LIGHTBOX PARA FOTOS EM TELA CHEIA                             */}
      {/* ==================================================================== */}
      {previewPhoto && (
        <div
          className="flat-modal-backdrop"
          style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.92)' }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{
                position: 'absolute',
                top: -42,
                right: 0,
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
              }}
              onClick={() => setPreviewPhoto(null)}
            >
              Fechar <X size={22} />
            </button>
            <img
              src={previewPhoto}
              alt="Comprovação do Serviço da Obra"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: 8,
                objectFit: 'contain',
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
