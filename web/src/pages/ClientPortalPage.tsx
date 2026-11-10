import React, { useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  HardHat,
  MapPin,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { getSiteByShareCode, getSiteDailyLogs, getSiteTasks } from '../lib/supabase';
import { ConstructionSite, SiteDailyLog, SiteTask } from '../types';

interface ClientPortalPageProps {
  shareCode: string;
}

export const ClientPortalPage: React.FC<ClientPortalPageProps> = ({ shareCode }) => {
  const [site, setSite] = useState<ConstructionSite | null>(null);
  const [tasks, setTasks] = useState<SiteTask[]>([]);
  const [dailyLogs, setDailyLogs] = useState<SiteDailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const foundSite = await getSiteByShareCode(shareCode);
        if (!foundSite) {
          setErrorMsg('Obra não encontrada. Verifique o código fornecido.');
          return;
        }
        setSite(foundSite);
        const [t, l] = await Promise.all([
          getSiteTasks(foundSite.id),
          getSiteDailyLogs(foundSite.id),
        ]);
        setTasks(t);
        setDailyLogs(l);
      } catch {
        setErrorMsg('Não foi possível carregar os dados da obra.');
      } finally {
        setLoading(false);
      }
    })();
  }, [shareCode]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#F8FAFC' }}>
        <p>A carregar o progresso da obra...</p>
      </div>
    );
  }

  if (errorMsg || !site) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#F8FAFC', padding: 20 }}>
        <div style={{ background: '#1E293B', padding: 30, borderRadius: 8, maxWidth: 440, textAlign: 'center', border: '1px solid #334155' }}>
          <h2 style={{ fontSize: 18, color: '#EF4444', marginBottom: 10 }}>Acesso Indisponível</h2>
          <p style={{ fontSize: 13, color: '#94A3B8' }}>{errorMsg || 'Código inválido.'}</p>
        </div>
      </div>
    );
  }

  const completedTasksCount = tasks.filter((t) => t.status === 'confirmada_chefe').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)', padding: '30px 20px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Top Header do Cliente */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-logo-flat">C</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>castello</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Portal de Acompanhamento do Cliente</div>
            </div>
          </div>
          <span className="badge-flat primary" style={{ fontFamily: 'monospace' }}>
            CÓDIGO: {site.share_code}
          </span>
        </header>

        {/* Informações da Obra */}
        <div className="content-panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700 }}>{site.name}</h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} /> {site.address}
              </p>
            </div>
            <span
              className={`badge-flat ${
                site.status === 'ativa' ? 'success' : site.status === 'pausada' ? 'warning' : 'primary'
              }`}
            >
              ESTADO: {site.status.toUpperCase()}
            </span>
          </div>

          {site.description && (
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {site.description}
            </p>
          )}

          {/* Barra de Progresso Geral da Obra */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              <span>Andamento Geral das Tarefas</span>
              <span style={{ color: 'var(--primary)' }}>{progressPercent}% Concluído</span>
            </div>
            <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: 'var(--primary)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              <span>{completedTasksCount} tarefas concluídas e validadas</span>
              <span>{tasks.length - completedTasksCount} tarefas restantes</span>
            </div>
          </div>
        </div>

        {/* Diário de Bordo: O que foi feito no dia */}
        <div className="content-panel" style={{ marginBottom: 20 }}>
          <h2 className="panel-title" style={{ marginBottom: 12 }}>
            Diário de Obra (Atualizações Diárias)
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Registo transparente das etapas concluídas pela equipa dia a dia
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dailyLogs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma atualização diária registada até ao momento.</p>
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
                    <strong style={{ fontSize: 13, color: 'var(--primary)' }}>
                      {log.log_date.split('-').reverse().join('/')}
                    </strong>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {log.workers_count} profissionais em campo • {log.weather}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {log.summary}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* O que falta e o que já foi feito (Tarefas) */}
        <div className="content-panel">
          <h2 className="panel-title" style={{ marginBottom: 12 }}>
            Cronograma e Tarefas
          </h2>

          <div className="flat-table-wrap">
            <table className="flat-table">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Prazo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      Sem tarefas no momento.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td style={{ fontWeight: 600 }}>{task.title}</td>
                      <td>{task.due_date ? task.due_date.split('-').reverse().join('/') : '-'}</td>
                      <td>
                        <span
                          className={`badge-flat ${
                            task.status === 'confirmada_chefe' ? 'success' : 'warning'
                          }`}
                        >
                          {task.status === 'confirmada_chefe' ? 'CONCLUÍDA' : 'EM ANDAMENTO'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

