import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  Building2,
  Clock,
  Calendar,
  Phone,
  UserCheck,
  Shield,
  Briefcase,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Award,
  Layers,
  ChevronRight,
  Plus,
  Play,
  Square,
} from 'lucide-react';
import { Team, EmployeeProfile, ConstructionSite, SiteWorkSession } from '../types';
import { getSiteWorkSessions, saveTeam, saveSiteWorkSession } from '../lib/supabase';

interface TeamDetailPageProps {
  team: Team;
  employees: EmployeeProfile[];
  sites: ConstructionSite[];
  companyId?: string;
  onBack: () => void;
  onTeamUpdated: (updated: Team) => void;
  showNotice?: (msg: string) => void;
}

export function TeamDetailPage({
  team,
  employees,
  sites,
  companyId,
  onBack,
  onTeamUpdated,
  showNotice,
}: TeamDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'geral' | 'estatisticas' | 'historico'>('geral');
  const [sessions, setSessions] = useState<SiteWorkSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Carregar histórico de sessões de trabalho de todas as obras para esta equipa
  useEffect(() => {
    let isMounted = true;
    async function loadSessions() {
      setLoadingSessions(true);
      try {
        const allSessions: SiteWorkSession[] = [];
        // Percorrer todas as obras para buscar sessões desta equipa
        for (const s of sites) {
          try {
            const list = await getSiteWorkSessions(s.id);
            const teamSessions = list.filter(
              (sess) =>
                sess.team_name?.trim().toLowerCase() === team.name?.trim().toLowerCase() ||
                (sess.leader_id && sess.leader_id === team.leader_id)
            );
            allSessions.push(...teamSessions);
          } catch {}
        }
        // Ordenar da mais recente para a mais antiga
        allSessions.sort(
          (a, b) => new Date(b.created_at || b.work_date).getTime() - new Date(a.created_at || a.work_date).getTime()
        );
        if (isMounted) setSessions(allSessions);
      } catch (e) {
        console.error('Erro ao carregar sessões da equipa:', e);
      } finally {
        if (isMounted) setLoadingSessions(false);
      }
    }
    loadSessions();
    return () => {
      isMounted = false;
    };
  }, [team.id, team.name, team.leader_id, sites]);

  // Líder e Membros como objetos de EmployeeProfile
  const leaderEmployee = useMemo(() => {
    return employees.find(
      (e) => e.id === team.leader_id || e.full_name?.trim().toLowerCase() === team.leader_name?.trim().toLowerCase()
    );
  }, [employees, team.leader_id, team.leader_name]);

  const memberEmployees = useMemo(() => {
    return (team.member_ids || []).map((id, index) => {
      const match = employees.find((e) => e.id === id);
      if (match) return match;
      const name = (team.member_names || [])[index] || `Membro ${index + 1}`;
      return {
        id,
        full_name: name,
        job_title: 'Colaborador de Obra',
        email: '',
        role: 'funcionario' as const,
        is_active: true,
      } as EmployeeProfile;
    });
  }, [employees, team.member_ids, team.member_names]);

  // Estatísticas calculadas
  const totalHoursWorked = useMemo(() => {
    return sessions.reduce((acc, s) => acc + (Number(s.hours_worked) || 0), 0);
  }, [sessions]);

  const distinctSitesServed = useMemo(() => {
    const siteIds = new Set<string>();
    if (team.current_site_id) siteIds.add(team.current_site_id);
    sessions.forEach((s) => {
      if (s.site_id) siteIds.add(s.site_id);
    });
    return siteIds.size;
  }, [sessions, team.current_site_id]);

  // Horas por Obra
  const hoursPerSite = useMemo(() => {
    const map: Record<string, { siteName: string; hours: number; count: number }> = {};
    sessions.forEach((sess) => {
      const site = sites.find((s) => s.id === sess.site_id);
      const name = site ? site.name : `Obra ${sess.site_id.slice(0, 6)}`;
      if (!map[sess.site_id]) {
        map[sess.site_id] = { siteName: name, hours: 0, count: 0 };
      }
      map[sess.site_id].hours += Number(sess.hours_worked) || 0;
      map[sess.site_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [sessions, sites]);

  const isAllocated = Boolean(team.current_site_id || team.current_site_name);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', paddingBottom: 60 }}>
      {/* CABEÇALHO DA PÁGINA */}
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          onClick={onBack}
          className="btn-flat-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          Voltar às Equipas
        </button>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                backgroundColor: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 800,
                border: '1px solid var(--border-color)',
                flexShrink: 0,
              }}
            >
              <Users size={28} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {team.name}
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    backgroundColor: isAllocated ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                    color: isAllocated ? '#10B981' : 'var(--text-muted)',
                    border: `1px solid ${isAllocated ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: isAllocated ? '#10B981' : '#64748B',
                      boxShadow: isAllocated ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
                    }}
                  />
                  {isAllocated ? `Alocada: ${team.current_site_name}` : 'Disponível / Sem Obra'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                Líder responsável: <strong>{team.leader_name}</strong> •{' '}
                {team.member_ids?.length || 0} integrantes registados
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI BOXES DA EQUIPA */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* KPI 1: Membros */}
        <div
          className="content-panel"
          style={{
            margin: 0,
            padding: 18,
            borderRadius: 12,
            borderLeft: '4px solid var(--primary)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Composição da Equipa
            </span>
            <Users size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', marginTop: 8 }}>
            {(team.member_ids?.length || 0) + 1}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            1 Líder + {team.member_ids?.length || 0} Membro{(team.member_ids?.length || 0) === 1 ? '' : 's'}
          </div>
        </div>

        {/* KPI 2: Horas Trabalhadas em Obra */}
        <div
          className="content-panel"
          style={{
            margin: 0,
            padding: 18,
            borderRadius: 12,
            borderLeft: '4px solid #10B981',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Horas Acumuladas
            </span>
            <Clock size={18} style={{ color: '#10B981' }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#10B981', marginTop: 8 }}>
            {totalHoursWorked.toFixed(1)}h
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {sessions.length} turnos/sessões registadas
          </div>
        </div>

        {/* KPI 3: Obras Atendidas */}
        <div
          className="content-panel"
          style={{
            margin: 0,
            padding: 18,
            borderRadius: 12,
            borderLeft: '4px solid #3B82F6',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Obras Atendidas
            </span>
            <Building2 size={18} style={{ color: '#3B82F6' }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', marginTop: 8 }}>
            {distinctSitesServed}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Projetos com atuação desta equipa
          </div>
        </div>

        {/* KPI 4: Localização / Obra Atual */}
        <div
          className="content-panel"
          style={{
            margin: 0,
            padding: 18,
            borderRadius: 12,
            borderLeft: `4px solid ${isAllocated ? '#F59E0B' : 'var(--border-color)'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Localização Atual
            </span>
            <MapPin size={18} style={{ color: isAllocated ? '#F59E0B' : 'var(--text-muted)' }} />
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--text-main)',
              marginTop: 10,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={team.current_site_name || 'Disponível'}
          >
            {team.current_site_name || 'Nenhuma Obra Ativa'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {team.allocated_at ? `Desde ${new Date(team.allocated_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}` : 'Pronta para nova alocação'}
          </div>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO DA EQUIPA */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border-color)',
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('geral')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'geral' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'geral' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Users size={16} />
          Informações & Membros
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('estatisticas')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'estatisticas' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'estatisticas' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <TrendingUp size={16} />
          Estatísticas & Produtividade
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'historico' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'historico' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Calendar size={16} />
          Histórico de Alocações ({sessions.length})
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* ABA 1: GERAL & MEMBROS */}
      {activeTab === 'geral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* CARD DO LÍDER */}
          <div
            className="content-panel"
            style={{
              margin: 0,
              padding: 20,
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Shield size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Líder da Equipa
              </h3>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                padding: 16,
                borderRadius: 10,
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {leaderEmployee?.avatar_url ? (
                  <img
                    src={leaderEmployee.avatar_url}
                    alt={team.leader_name}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--primary)',
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
                      border: '2px solid var(--primary)',
                    }}
                  >
                    {team.leader_name ? team.leader_name[0].toUpperCase() : 'L'}
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      {team.leader_name}
                    </h4>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                      }}
                    >
                      Líder / Encarregado
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {leaderEmployee?.job_title || 'Encarregado de Equipa'} •{' '}
                    {leaderEmployee?.email || 'Email não registado'}
                  </div>
                </div>
              </div>

              {(team.leader_phone || leaderEmployee?.phone) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <a
                    href={`tel:${team.leader_phone || leaderEmployee?.phone}`}
                    className="btn-flat-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      padding: '8px 14px',
                      textDecoration: 'none',
                    }}
                  >
                    <Phone size={14} />
                    {team.leader_phone || leaderEmployee?.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* LISTA DE INTEGRANTES */}
          <div
            className="content-panel"
            style={{
              margin: 0,
              padding: 20,
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Integrantes da Equipa ({memberEmployees.length})
                </h3>
              </div>
            </div>

            {memberEmployees.length === 0 ? (
              <div
                style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 8,
                }}
              >
                Esta equipa é composta atualmente apenas pelo líder. Pode editar a equipa para associar mais colaboradores.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 14,
                }}
              >
                {memberEmployees.map((member, idx) => (
                  <div
                    key={member.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: 10,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.full_name}
                        style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary-subtle)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 15,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {member.full_name ? member.full_name[0].toUpperCase() : 'M'}
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {member.full_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {member.job_title || 'Colaborador'}
                      </div>
                      {member.phone && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {member.phone}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OBSERVAÇÕES / NOTAS */}
          {team.notes && (
            <div
              className="content-panel"
              style={{
                margin: 0,
                padding: 20,
                borderRadius: 12,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FileText size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Notas & Diretrizes da Equipa
                </h3>
              </div>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text-main)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {team.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: ESTATÍSTICAS & PRODUTIVIDADE */}
      {activeTab === 'estatisticas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* DISTRIBUIÇÃO DE HORAS POR OBRA */}
          <div
            className="content-panel"
            style={{
              margin: 0,
              padding: 22,
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrendingUp size={20} style={{ color: 'var(--primary)' }} />
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Distribuição de Horas por Obra
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  Horas efetivas trabalhadas em cada projeto pela equipa {team.name}
                </p>
              </div>
            </div>

            {hoursPerSite.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                }}
              >
                Ainda não existem registos de horas ou sessões de trabalho concluídas por esta equipa.
                Quando o líder registar a alocação no app móvel, as horas aparecerão aqui automaticamente.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {hoursPerSite.map((item, idx) => {
                  const pct = totalHoursWorked > 0 ? (item.hours / totalHoursWorked) * 100 : 0;
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                          {item.siteName}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                            {item.hours.toFixed(1)}h
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            ({pct.toFixed(0)}% • {item.count} turnos)
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          height: 8,
                          backgroundColor: 'var(--border-color)',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: 'var(--primary)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: HISTÓRICO DE ALOCAÇÕES */}
      {activeTab === 'historico' && (
        <div
          className="content-panel"
          style={{
            margin: 0,
            padding: 22,
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Calendar size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Histórico de Turnos e Alocações
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                Todos os registos de presença e períodos de trabalho registados pelo líder
              </p>
            </div>
          </div>

          {loadingSessions ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              A carregar histórico da equipa...
            </div>
          ) : sessions.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 14,
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 8,
              }}
            >
              Nenhum turno de trabalho registado ainda.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Obra</th>
                    <th>Horas Trabalhadas</th>
                    <th>Trabalhadores</th>
                    <th>Líder do Turno</th>
                    <th>Notas do Turno</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sess) => {
                    const site = sites.find((s) => s.id === sess.site_id);
                    return (
                      <tr key={sess.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                            <strong style={{ color: 'var(--text-main)' }}>
                              {new Date(sess.work_date).toLocaleDateString('pt-PT')}
                            </strong>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {site?.name || sess.site_id}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 700,
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#10B981',
                            }}
                          >
                            {Number(sess.hours_worked || 0).toFixed(1)} horas
                          </span>
                        </td>
                        <td>{sess.workers_count || 1} colaboradores</td>
                        <td>{sess.leader_name}</td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {sess.description || '—'}
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
    </div>
  );
}
