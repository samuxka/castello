import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { OperationalAlertItem } from './teamOperations';

interface TeamOperationalAlertsProps {
  alerts: OperationalAlertItem[];
  onNavigateToTeam: (teamId: string, targetTab?: 'visao_geral' | 'colaboradores' | 'tarefas' | 'desempenho' | 'historico') => void;
}

export const TeamOperationalAlerts: React.FC<TeamOperationalAlertsProps> = ({
  alerts,
  onNavigateToTeam,
}) => {
  const [expanded, setExpanded] = useState(true);

  if (alerts.length === 0) return null;

  const dangerCount = alerts.filter((a) => a.severity === 'danger').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  const getTargetTab = (category: OperationalAlertItem['category']) => {
    switch (category) {
      case 'sem_tarefas':
        return 'tarefas' as const;
      case 'sem_lider':
      case 'colaborador_inativo':
      case 'alocacao_incompativel':
        return 'colaboradores' as const;
      case 'conflito_horario':
      case 'prazo_ultrapassado':
      default:
        return 'visao_geral' as const;
    }
  };

  return (
    <div
      className="content-panel"
      role="region"
      aria-label="Alertas operacionais de equipas"
      style={{
        padding: '14px 18px',
        borderLeft: `4px solid ${dangerCount > 0 ? 'var(--danger)' : warningCount > 0 ? '#F59E0B' : 'var(--primary)'}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: 12,
        }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <AlertTriangle
            size={18}
            color={dangerCount > 0 ? 'var(--danger)' : warningCount > 0 ? '#F59E0B' : 'var(--primary)'}
          />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
            Alertas Operacionais ({alerts.length})
          </span>
          {dangerCount > 0 && (
            <span className="badge-flat danger" style={{ fontSize: 10 }}>
              {dangerCount} crítico(s)
            </span>
          )}
          {warningCount > 0 && (
            <span className="badge-flat warning" style={{ fontSize: 10 }}>
              {warningCount} atenção
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn-icon"
          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          aria-label={expanded ? 'Recolher alertas' : 'Expandir alertas'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
            gap: 10,
            marginTop: 12,
          }}
        >
          {alerts.map((alert) => {
            const isDanger = alert.severity === 'danger';
            const isWarning = alert.severity === 'warning';
            const accentColor = isDanger ? 'var(--danger)' : isWarning ? '#F59E0B' : 'var(--primary)';

            return (
              <div
                key={alert.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 1 }}>
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    {isDanger ? (
                      <AlertCircle size={15} color={accentColor} />
                    ) : isWarning ? (
                      <AlertTriangle size={15} color={accentColor} />
                    ) : (
                      <Info size={15} color={accentColor} />
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                      {alert.description}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToTeam(alert.teamId, getTargetTab(alert.category))}
                  className="btn-flat-secondary"
                  style={{
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  Resolver
                  <ChevronRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
