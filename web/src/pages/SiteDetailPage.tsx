import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  addSiteDailyLog,
  createSiteTask,
  deleteTask,
  getSiteDailyLogs,
  getSiteTasks,
  updateTaskStatus,
} from '../lib/supabase';
import { ConstructionSite, EmployeeProfile, SiteDailyLog, SiteTask } from '../types';

interface SiteDetailPageProps {
  site: ConstructionSite;
  employees: EmployeeProfile[];
  onBack: () => void;
}

export const SiteDetailPage: React.FC<SiteDetailPageProps> = ({
  site,
  employees,
  onBack,
}) => {
  const [tasks, setTasks] = useState<SiteTask[]>([]);
  const [dailyLogs, setDailyLogs] = useState<SiteDailyLog[]>([]);
  const [activeTab, setActiveTab] = useState<'tarefas' | 'diario'>('tarefas');

  // Modal Nova Tarefa
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedName, setAssignedName] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Modal Novo Diário
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logSummary, setLogSummary] = useState('');
  const [workersCount, setWorkersCount] = useState('2');
  const [weather, setWeather] = useState('Ensolarado');

  const [copiedLink, setCopiedLink] = useState(false);

  const loadSiteData = async () => {
    const [t, l] = await Promise.all([
      getSiteTasks(site.id),
      getSiteDailyLogs(site.id),
    ]);
    setTasks(t);
    setDailyLogs(l);
  };

  useEffect(() => {
    loadSiteData();
  }, [site.id]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await createSiteTask(
      site.id,
      taskTitle,
      taskDesc,
      assignedName || undefined,
      dueDate || undefined,
      site.company_id || undefined
    );
    setTaskTitle('');
    setTaskDesc('');
    setAssignedName('');
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
    await updateTaskStatus(taskId, 'concluida_funcionario', worker);
    await loadSiteData();
  };

  const handleBossConfirmTask = async (taskId: string) => {
    const boss = prompt('Nome do encarregado/chefe que confirma:') || 'Chefe de Obra';
    await updateTaskStatus(taskId, 'confirmada_chefe', boss);
    await loadSiteData();
  };

  const handleCopyClientLink = () => {
    const clientUrl = `${window.location.origin}?obra=${site.share_code}`;
    navigator.clipboard.writeText(clientUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
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
            onClick={handleCopyClientLink}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ExternalLink size={15} />
            {copiedLink ? 'Link do Cliente Copiado!' : 'Copiar Link para o Cliente'}
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

      {/* Navegação entre Tarefas e Diário de Bordo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td>{task.assigned_to_name || 'Qualquer colaborador'}</td>
                      <td>{task.due_date ? task.due_date.split('-').reverse().join('/') : '-'}</td>
                      <td>
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
                            ? 'CONCLUÍDA PELO FUNCIONÁRIO'
                            : 'PENDENTE'}
                        </span>
                      </td>
                      <td>
                        {task.status === 'concluida_funcionario' && (
                          <div style={{ fontSize: 11, color: 'var(--primary)' }}>
                            Feito por: <strong>{task.completed_by_name}</strong>
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
                              onClick={() => handleBossConfirmTask(task.id)}
                            >
                              <ShieldCheck size={13} />
                              Chefe Confirmar
                            </button>
                          )}

                          <button
                            className="btn-flat-danger"
                            onClick={async () => {
                              if (confirm('Excluir esta tarefa?')) {
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
                  <label>Designar a Colaborador (Opcional)</label>
                  <select value={assignedName} onChange={(e) => setAssignedName(e.target.value)}>
                    <option value="">Qualquer funcionário da equipa</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.full_name}>
                        {emp.full_name} ({emp.job_title})
                      </option>
                    ))}
                  </select>
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
    </div>
  );
};

