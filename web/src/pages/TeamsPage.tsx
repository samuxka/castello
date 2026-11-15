import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit2,
  LayoutGrid,
  List,
  Filter,
  ArrowUpDown,
  Building2,
  Phone,
  UserCheck,
  X,
  CheckCircle2,
  Clock,
  Shield,
  BarChart2,
  ChevronRight,
} from 'lucide-react';
import { Team, EmployeeProfile, ConstructionSite } from '../types';
import { getTeams, saveTeam, deleteTeam } from '../lib/supabase';
import { TeamDetailPage } from './TeamDetailPage';
import { customConfirm, customAlert } from '../context/DialogContext';

interface TeamsPageProps {
  companyId?: string;
  employees: EmployeeProfile[];
  sites: ConstructionSite[];
  showNotice?: (msg: string) => void;
}

export function TeamsPage({ companyId, employees, sites, showNotice }: TeamsPageProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamForDetail, setSelectedTeamForDetail] = useState<Team | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'em_obra' | 'livre'>('todos');
  const [sortBy, setSortBy] = useState<'nome' | 'membros_desc' | 'membros_asc'>('nome');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<{ id: string; name: string }[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showMemberSuggestions, setShowMemberSuggestions] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const memberInputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  const loadTeamsData = async () => {
    setLoading(true);
    try {
      const data = await getTeams(companyId);
      setTeams(data);
    } catch (err) {
      console.error('Erro ao carregar equipas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamsData();
  }, [companyId]);

  // Fechar dropdown de sugestões de membros ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(event.target as Node) &&
        memberInputRef.current &&
        !memberInputRef.current.contains(event.target as Node)
      ) {
        setShowMemberSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fechar o diálogo ao pressionar a tecla Escape (ESC)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const openCreateModal = () => {
    setEditingTeam(null);
    setName('');
    setLeaderId(employees[0]?.id || '');
    setSelectedMembers([]);
    setMemberSearchQuery('');
    setShowMemberSuggestions(false);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setLeaderId(team.leader_id || '');
    
    // Montar lista de membros atuais
    const currentMembers: { id: string; name: string }[] = [];
    if (team.member_ids && team.member_ids.length > 0) {
      team.member_ids.forEach((id, idx) => {
        const emp = employees.find((e) => e.id === id);
        currentMembers.push({
          id,
          name: emp ? emp.full_name : (team.member_names?.[idx] || 'Membro'),
        });
      });
    } else if (team.member_names && team.member_names.length > 0) {
      team.member_names.forEach((mName) => {
        const emp = employees.find((e) => e.full_name.toLowerCase() === mName.toLowerCase());
        currentMembers.push({
          id: emp ? emp.id : `legacy-${mName}`,
          name: mName,
        });
      });
    }
    setSelectedMembers(currentMembers);
    setMemberSearchQuery('');
    setShowMemberSuggestions(false);
    setNotes(team.notes || '');
    setIsModalOpen(true);
  };

  const handleAddMember = (emp: EmployeeProfile) => {
    if (selectedMembers.some((m) => m.id === emp.id)) return;
    setSelectedMembers([...selectedMembers, { id: emp.id, name: emp.full_name }]);
    setMemberSearchQuery('');
    setShowMemberSuggestions(false);
    if (memberInputRef.current) memberInputRef.current.focus();
  };

  const handleRemoveMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== memberId));
  };

  // Sugestões de colaboradores filtradas pelo que o usuário está digitando
  const filteredEmployeeSuggestions = useMemo(() => {
    if (!memberSearchQuery.trim()) return [];
    const query = memberSearchQuery.toLowerCase().trim();
    return employees.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(query) &&
        !selectedMembers.some((m) => m.id === emp.id)
    );
  }, [employees, memberSearchQuery, selectedMembers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor introduza o nome da equipa.');
      return;
    }

    const leaderEmp = employees.find((e) => e.id === leaderId);

    setSaving(true);
    try {
      const payload: Partial<Team> = {
        id: editingTeam ? editingTeam.id : undefined,
        company_id: companyId || null,
        name: name.trim(),
        leader_id: leaderId || null,
        leader_name: leaderEmp ? leaderEmp.full_name : 'Líder',
        leader_phone: leaderEmp ? leaderEmp.phone || null : null,
        member_ids: selectedMembers.map((m) => m.id),
        member_names: selectedMembers.map((m) => m.name),
        notes: notes.trim() || null,
      };

      await saveTeam(payload, companyId);
      await loadTeamsData();
      setIsModalOpen(false);
      if (showNotice) {
        showNotice(editingTeam ? 'Equipa atualizada com sucesso!' : 'Nova equipa criada com sucesso!');
      }
    } catch (err: any) {
      customAlert({
        title: 'Erro ao Gravar',
        message: 'Erro ao guardar equipa: ' + (err.message || 'Tente novamente.'),
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team: Team) => {
    const confirmed = await customConfirm({
      title: 'Eliminar Equipa',
      message: `Tem a certeza que deseja eliminar a equipa "${team.name}"?`,
      type: 'danger',
      confirmText: 'Eliminar Equipa',
      cancelText: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await deleteTeam(team.id, companyId);
      await loadTeamsData();
      if (showNotice) showNotice('Equipa eliminada.');
    } catch (err: any) {
      customAlert({
        title: 'Erro ao Eliminar',
        message: 'Erro ao eliminar equipa: ' + (err.message || 'Tente novamente.'),
        type: 'error',
      });
    }
  };

  // Filtragem e Ordenação
  const filteredAndSortedTeams = useMemo(() => {
    let result = teams.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.leader_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.member_names && t.member_names.some((m) => m.toLowerCase().includes(searchTerm.toLowerCase()))) ||
        (t.current_site_name && t.current_site_name.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'em_obra') {
        matchesStatus = Boolean(t.current_site_id || t.current_site_name);
      } else if (statusFilter === 'livre') {
        matchesStatus = !t.current_site_id && !t.current_site_name;
      }

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortBy === 'membros_desc') {
        return (b.member_ids?.length || 0) - (a.member_ids?.length || 0);
      }
      if (sortBy === 'membros_asc') {
        return (a.member_ids?.length || 0) - (b.member_ids?.length || 0);
      }
      return a.name.localeCompare(b.name, 'pt-PT');
    });

    return result;
  }, [teams, searchTerm, statusFilter, sortBy]);

  // Contadores
  const totalTeams = teams.length;
  const activeTeamsCount = teams.filter((t) => t.current_site_id || t.current_site_name).length;
  const totalMembersCount = useMemo(() => {
    const uniqueEmpIds = new Set<string>();
    teams.forEach((t) => {
      if (t.leader_id) uniqueEmpIds.add(t.leader_id);
      t.member_ids?.forEach((id) => uniqueEmpIds.add(id));
    });
    return uniqueEmpIds.size;
  }, [teams]);

  if (selectedTeamForDetail) {
    return (
      <TeamDetailPage
        team={selectedTeamForDetail}
        employees={employees}
        sites={sites}
        companyId={companyId}
        onBack={() => setSelectedTeamForDetail(null)}
        onTeamUpdated={(updated) => {
          setSelectedTeamForDetail(updated);
          setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }}
        showNotice={showNotice}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ================================================================== */}
      {/* CABEÇALHO & BOTÃO DE AÇÃO                                          */}
      {/* ================================================================== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={26} color="var(--primary)" />
            Gestão de Equipas
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Organize os colaboradores da firma em equipas de trabalho com líderes responsáveis e alocação dinâmica em obra
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="btn-flat-primary"
          style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} />
          Criar Nova Equipa
        </button>
      </div>

      {/* ================================================================== */}
      {/* CARDS DE RESUMO DE ESTATÍSTICAS                                    */}
      {/* ================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="content-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'var(--primary-subtle)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total de Equipas
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {totalTeams}
            </div>
          </div>
        </div>

        <div className="content-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'var(--success-subtle)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Em Obra Atualmente
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)', marginTop: 2 }}>
              {activeTeamsCount}
            </div>
          </div>
        </div>

        <div className="content-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-color)',
            }}
          >
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Colaboradores Integrados
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {totalMembersCount}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* BARRA DE CONTROLE: PESQUISA, FILTROS, ORDENAÇÃO E MODO DE VISTA   */}
      {/* ================================================================== */}
      <div
        className="content-panel"
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          {/* Caixa de Pesquisa */}
          <div style={{ position: 'relative', minWidth: 260, flex: 1, maxWidth: 400 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Pesquisar por equipa, líder ou membro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* Filtro de Estado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value="todos">Todos os Estados</option>
              <option value="em_obra">Em Obra</option>
              <option value="livre">Sem Obra / Disponíveis</option>
            </select>
          </div>

          {/* Ordenação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpDown size={14} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
              }}
            >
              <option value="nome">Nome (A - Z)</option>
              <option value="membros_desc">Mais Membros</option>
              <option value="membros_asc">Menos Membros</option>
            </select>
          </div>
        </div>

        {/* Toggle Cards vs Tabela */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid var(--border-color)', paddingLeft: 12 }}>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`btn-icon ${viewMode === 'cards' ? 'active' : ''}`}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              backgroundColor: viewMode === 'cards' ? 'var(--primary-subtle)' : 'transparent',
              color: viewMode === 'cards' ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
            title="Visualização em Grelha"
          >
            <LayoutGrid size={15} />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              backgroundColor: viewMode === 'list' ? 'var(--primary-subtle)' : 'transparent',
              color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
            title="Visualização em Lista / Tabela"
          >
            <List size={15} />
            Lista
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* CONTEÚDO PRINCIPAL: CARDS OU TABELA                                */}
      {/* ================================================================== */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          A carregar equipas...
        </div>
      ) : filteredAndSortedTeams.length === 0 ? (
        <div
          className="content-panel"
          style={{
            padding: '50px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              backgroundColor: 'var(--primary-subtle)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={26} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Nenhuma equipa encontrada
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 440 }}>
            {searchTerm || statusFilter !== 'todos'
              ? 'Não foram encontradas equipas correspondentes aos critérios de pesquisa.'
              : 'Ainda não cadastrou nenhuma equipa na sua empresa. Crie a primeira para organizar os seus colaboradores.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-flat-primary"
            style={{ padding: '8px 16px', fontSize: 13, marginTop: 6 }}
          >
            <Plus size={15} /> Criar Primeira Equipa
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* VISUALIZAÇÃO EM GRELHA (CARDS) */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredAndSortedTeams.map((team) => {
            const isAllocated = Boolean(team.current_site_id || team.current_site_name);
            const leaderEmp = employees.find((e) => e.id === team.leader_id);

            return (
              <div
                key={team.id}
                className="content-panel"
                onClick={() => setSelectedTeamForDetail(team)}
                style={{
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <div>
                  {/* Topo do Card: Nome e Círculo de Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        {team.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: isAllocated ? '#10B981' : '#64748B',
                            boxShadow: isAllocated ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
                            display: 'inline-block',
                          }}
                        />
                        <span style={{ fontSize: 12, fontWeight: 600, color: isAllocated ? 'var(--success)' : 'var(--text-muted)' }}>
                          {isAllocated ? (team.current_site_name ? `Em Obra: ${team.current_site_name}` : 'Em Obra') : 'Disponível / Sem Obra'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditModal(team)}
                        className="btn-icon"
                        style={{ padding: 6, color: 'var(--text-muted)' }}
                        title="Editar Equipa"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(team)}
                        className="btn-icon"
                        style={{ padding: 6, color: 'var(--danger)' }}
                        title="Eliminar Equipa"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Informações do Líder */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {leaderEmp?.avatar_url ? (
                        <img
                          src={leaderEmp.avatar_url}
                          alt={team.leader_name}
                          style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--primary)' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary-subtle)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 800,
                          }}
                        >
                          {team.leader_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {team.leader_name}
                          <span className="badge-flat primary" style={{ fontSize: 9, padding: '1px 6px' }}>
                            Líder
                          </span>
                        </div>
                        {team.leader_phone && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            <Phone size={11} /> {team.leader_phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alocação Atual e Horas */}
                  {isAllocated && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        backgroundColor: 'var(--success-subtle)',
                        border: '1px solid var(--success-subtle)',
                        fontSize: 12,
                        color: 'var(--success)',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Clock size={14} />
                      <span>
                        Alocada hoje às{' '}
                        <strong>
                          {team.allocated_at
                            ? new Date(team.allocated_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                            : '08:00'}
                        </strong>
                      </span>
                    </div>
                  )}

                  {/* Integrantes da Equipa */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Integrantes ({team.member_names?.length || 0})
                    </div>
                    {team.member_names && team.member_names.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {team.member_names.map((mName, mIdx) => (
                          <span
                            key={mIdx}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: 6,
                              backgroundColor: 'var(--bg-card-subtle)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)',
                            }}
                          >
                            {mName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Nenhum outro membro associado.
                      </div>
                    )}
                  </div>
                </div>

                {team.notes && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                    {team.notes}
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTeamForDetail(team);
                  }}
                  className="btn-flat-secondary"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderRadius: 8,
                    marginTop: 4,
                  }}
                >
                  <BarChart2 size={14} />
                  Ver Detalhes & Estatísticas
                  <ChevronRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISUALIZAÇÃO EM LISTA / TABELA */
        <div className="content-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="flat-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>
                <th style={{ padding: '12px 16px' }}>Equipa</th>
                <th style={{ padding: '12px 16px' }}>Líder Responsável</th>
                <th style={{ padding: '12px 16px' }}>Integrantes</th>
                <th style={{ padding: '12px 16px' }}>Obra Alocada</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', width: 80 }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTeams.map((team) => {
                const isAllocated = Boolean(team.current_site_id || team.current_site_name);
                const leaderEmp = employees.find((e) => e.id === team.leader_id);

                return (
                  <tr
                    key={team.id}
                    onClick={() => setSelectedTeamForDetail(team)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: 14 }}>{team.name}</strong>
                      {team.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {team.notes}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {leaderEmp?.avatar_url ? (
                          <img
                            src={leaderEmp.avatar_url}
                            alt={team.leader_name}
                            style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              backgroundColor: 'var(--primary-subtle)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {team.leader_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{team.leader_name}</div>
                          {team.leader_phone && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{team.leader_phone}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 300 }}>
                        {team.member_names && team.member_names.length > 0 ? (
                          team.member_names.map((mName, mIdx) => (
                            <span
                              key={mIdx}
                              style={{
                                fontSize: 11,
                                padding: '2px 6px',
                                borderRadius: 4,
                                backgroundColor: 'var(--bg-card-subtle)',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              {mName}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {team.current_site_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 size={14} color="var(--primary)" />
                          <strong style={{ color: 'var(--text-main)' }}>{team.current_site_name}</strong>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sem Obra Alocada</span>
                      )}
                    </td>

                    {/* CÍRCULO COM A COR DO STATUS CONFORME SOLICITADO */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        title={isAllocated ? 'Em Obra' : 'Disponível / Sem Obra'}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          backgroundColor: isAllocated ? '#10B981' : '#64748B',
                          boxShadow: isAllocated ? '0 0 8px rgba(16, 185, 129, 0.65)' : 'none',
                          display: 'inline-block',
                          cursor: 'help',
                        }}
                      />
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedTeamForDetail(team)}
                          className="btn-flat-secondary"
                          style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title="Ver Detalhes e Estatísticas"
                        >
                          <BarChart2 size={13} />
                          Detalhes
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(team)}
                          className="btn-icon"
                          style={{ padding: 6, color: 'var(--text-muted)' }}
                          title="Editar Equipa"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(team)}
                          className="btn-icon"
                          style={{ padding: 6, color: 'var(--danger)' }}
                          title="Eliminar Equipa"
                        >
                          <Trash2 size={15} />
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

      {/* ================================================================== */}
      {/* DIALOG DE CRIAÇÃO / EDIÇÃO DE EQUIPA                               */}
      {/* ================================================================== */}
      {isModalOpen && (
        <div
          className="flat-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="flat-modal-box"
            style={{ maxWidth: 540, width: '100%', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flat-modal-header">
              <h3
                id="team-dialog-title"
                className="flat-modal-title"
                style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}
              >
                <Users size={18} color="var(--primary)" />
                {editingTeam ? 'Editar Equipa' : 'Criar Nova Equipa'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-icon"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                aria-label="Fechar diálogo"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Nome da Equipa */}
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Nome da Equipa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Equipa 1, Equipa de Alvenaria, Equipa Elétrica..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ padding: '9px 12px' }}
                />
              </div>

              {/* Líder da Equipa */}
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Líder da Equipa *</label>
                <select
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  style={{ padding: '9px 12px' }}
                  required
                >
                  <option value="">Selecione o líder responsável...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.job_title || 'Colaborador'}) {emp.phone ? `• ${emp.phone}` : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  O líder é o responsável por alocar e registrar a obra da equipa na aplicação móvel.
                </span>
              </div>

              {/* Integrantes com Autocomplete Dinâmico e Sugestões abaixo */}
              <div className="flat-form-group" style={{ position: 'relative' }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  Integrantes da Equipa ({selectedMembers.length})
                </label>

                {/* Pills dos membros já adicionados */}
                {selectedMembers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {selectedMembers.map((member) => (
                      <span
                        key={member.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: 6,
                          backgroundColor: 'var(--primary-subtle)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                        }}
                      >
                        {member.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--danger)',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Remover da equipa"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Caixa de Digitação com Auto-completar dinâmico */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    ref={memberInputRef}
                    type="text"
                    placeholder="Digite o nome do funcionário para adicionar..."
                    value={memberSearchQuery}
                    onChange={(e) => {
                      setMemberSearchQuery(e.target.value);
                      setShowMemberSuggestions(true);
                    }}
                    onFocus={() => {
                      if (memberSearchQuery.trim()) setShowMemberSuggestions(true);
                    }}
                    style={{ padding: '9px 12px 9px 32px', width: '100%' }}
                  />
                </div>

                {/* Caixa de Sugestões que surge abaixo enquanto digita */}
                {showMemberSuggestions && filteredEmployeeSuggestions.length > 0 && (
                  <div
                    ref={suggestionsBoxRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      maxHeight: 180,
                      overflowY: 'auto',
                      zIndex: 100,
                    }}
                  >
                    {filteredEmployeeSuggestions.map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => handleAddMember(emp)}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background-color 0.1s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-subtle)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {emp.avatar_url ? (
                            <img
                              src={emp.avatar_url}
                              alt={emp.full_name}
                              style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              {emp.full_name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                              {emp.full_name}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {emp.job_title || 'Colaborador'}
                            </div>
                          </div>
                        </div>

                        <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>
                          + Adicionar
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Comece a digitar e clique no colaborador para incluí-lo na equipa.
                </span>
              </div>

              {/* Observações */}
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Notas / Observações</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais sobre esta equipa..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ padding: '8px 12px', resize: 'vertical' }}
                />
              </div>

              {/* Ações do Dialog */}
              <div className="flat-modal-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-flat-secondary"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-flat-primary"
                  disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {saving ? (
                    'A guardar...'
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      {editingTeam ? 'Guardar Alterações' : 'Criar Equipa'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
