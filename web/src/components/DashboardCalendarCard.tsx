import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Clock, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { getCalendarEvents, toggleCalendarEventCompleted } from '../lib/supabase';
import { CalendarEvent, ConstructionSite, EmployeeProfile } from '../types';

interface DashboardCalendarCardProps {
  companyId?: string;
  sites: ConstructionSite[];
  employees: EmployeeProfile[];
  onOpenCalendar: () => void;
}

export function DashboardCalendarCard({
  companyId,
  sites,
  employees,
  onOpenCalendar,
}: DashboardCalendarCardProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    try {
      const data = await getCalendarEvents(companyId);
      setEvents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [companyId]);

  const handleToggle = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    await toggleCalendarEventCompleted(eventId);
    await loadEvents();
  };

  // Filtra e ordena eventos futuros / de hoje primeiro
  const todayStr = new Date().toISOString().slice(0, 10);
  const sortedEvents = [...events].sort((a, b) => {
    // Pendentes primeiro, depois por data
    if (a.is_completed && !b.is_completed) return 1;
    if (!a.is_completed && b.is_completed) return -1;
    return a.event_date.localeCompare(b.event_date);
  });

  const upcomingEvents = sortedEvents.slice(0, 15);

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'obra':
        return 'primary';
      case 'reuniao':
        return 'warning';
      case 'inspecao':
        return 'danger';
      case 'pagamento':
        return 'success';
      default:
        return 'primary';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'obra':
        return 'Obra';
      case 'reuniao':
        return 'Reunião';
      case 'inspecao':
        return 'Inspeção';
      case 'pagamento':
        return 'Pagamento';
      default:
        return 'Outro';
    }
  };

  const formatMonthAbbr = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return '';
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('pt-PT', { month: 'short' }).toUpperCase().replace('.', '');
  };

  const formatDayNum = (dateStr: string) => {
    const parts = dateStr.split('-');
    return parts.length >= 3 ? parts[2] : '';
  };

  return (
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
      {/* Cabeçalho */}
      <div
        className="panel-header-inline"
        style={{
          flexShrink: 0,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarIcon size={16} color="var(--primary)" />
            <h2 className="panel-title" style={{ fontSize: 14, margin: 0 }}>
              Próximos Eventos & Agenda
            </h2>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Compromissos agendados da firma
          </p>
        </div>

        <button
          className="btn-flat-secondary"
          style={{ padding: '3px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          onClick={onOpenCalendar}
          title="Abrir calendário mensal completo"
        >
          <span>Agenda</span>
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Lista com scroll interno */}
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
        {upcomingEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
            <p>Nenhum compromisso agendado.</p>
            <button
              className="btn-flat-primary"
              style={{ padding: '4px 10px', fontSize: 11, marginTop: 8 }}
              onClick={onOpenCalendar}
            >
              + Adicionar na Agenda
            </button>
          </div>
        ) : (
          upcomingEvents.map((evt) => {
            const site = sites.find((s) => s.id === evt.site_id);
            const isToday = evt.event_date === todayStr;

            return (
              <div
                key={evt.id}
                onClick={onOpenCalendar}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: isToday ? '1px solid var(--primary-border)' : '1px solid var(--border-color)',
                  backgroundColor: evt.is_completed
                    ? 'transparent'
                    : isToday
                    ? 'var(--primary-subtle)'
                    : 'var(--bg-card-subtle)',
                  cursor: 'pointer',
                  opacity: evt.is_completed ? 0.6 : 1,
                  transition: 'background-color 0.15s ease',
                  flexShrink: 0,
                }}
              >
                {/* Bloco de Data (Dia + Mês) */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    backgroundColor: isToday ? 'var(--primary)' : 'var(--bg-page)',
                    color: isToday ? '#ffffff' : 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{formatDayNum(evt.event_date)}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>
                    {formatMonthAbbr(evt.event_date)}
                  </span>
                </div>

                {/* Conteúdo do Evento */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: 'var(--text-main)',
                        textDecoration: evt.is_completed ? 'line-through' : 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {evt.title}
                    </span>
                    <span className={`badge-flat ${getCategoryBadgeClass(evt.category)}`} style={{ fontSize: 9, padding: '1px 5px' }}>
                      {getCategoryLabel(evt.category)}
                    </span>
                  </div>

                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {evt.start_time && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> {evt.start_time}
                      </span>
                    )}
                    {site && <span>• {site.name}</span>}
                  </div>
                </div>

                {/* Botão de Conclusão Rápida */}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: evt.is_completed ? 'var(--success)' : 'var(--text-muted)',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onClick={(e) => handleToggle(e, evt.id)}
                  title={evt.is_completed ? 'Marcar como pendente' : 'Marcar como concluído'}
                >
                  {evt.is_completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
