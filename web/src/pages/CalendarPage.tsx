import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Building2,
  User,
  MapPin,
  CheckCircle2,
  Circle,
  Trash2,
  X,
  Save,
  AlertCircle,
} from 'lucide-react';
import { CalendarEvent, ConstructionSite, EmployeeProfile, EventCategory } from '../types';
import { deleteCalendarEvent, getCalendarEvents, saveCalendarEvent, toggleCalendarEventCompleted } from '../lib/supabase';

interface CalendarPageProps {
  companyId?: string;
  sites: ConstructionSite[];
  employees: EmployeeProfile[];
  showNotice: (msg: string) => void;
}

export function CalendarPage({ companyId, sites, employees, showNotice }: CalendarPageProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Mês e dia selecionado
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => new Date().toISOString().slice(0, 10));

  // Filtros
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(selectedDateStr);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState<EventCategory>('obra');
  const [siteId, setSiteId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().slice(0, 10));
  };

  const openNewEventModal = (dateStr?: string) => {
    setEditingEvent(null);
    setTitle('');
    setEventDate(dateStr || selectedDateStr);
    setStartTime('09:00');
    setEndTime('10:00');
    setCategory('obra');
    setSiteId('');
    setEmployeeId('');
    setLocation('');
    setDescription('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) {
      alert('Informe o título e a data do compromisso.');
      return;
    }

    setSaving(true);
    try {
      const selectedSite = sites.find((s) => s.id === siteId);
      const selectedEmp = employees.find((e) => e.id === employeeId);

      await saveCalendarEvent(
        {
          id: editingEvent?.id,
          title: title.trim(),
          event_date: eventDate,
          start_time: startTime || null,
          end_time: endTime || null,
          category,
          site_id: siteId || null,
          site_name: selectedSite ? selectedSite.name : null,
          assigned_employee_id: employeeId || null,
          assigned_employee_name: selectedEmp ? selectedEmp.full_name : null,
          location: location.trim() || null,
          description: description.trim() || null,
          is_completed: editingEvent ? editingEvent.is_completed : false,
        },
        companyId
      );

      setModalOpen(false);
      await loadEvents();
      showNotice('Compromisso agendado com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar compromisso: ' + (err.message || 'Tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este compromisso?')) {
      await deleteCalendarEvent(id, companyId);
      await loadEvents();
      showNotice('Compromisso removido da agenda.');
    }
  };

  const handleToggleCompleted = async (id: string) => {
    await toggleCalendarEventCompleted(id, companyId);
    await loadEvents();
  };

  // Filtragem de eventos
  const filteredEvents = events.filter((evt) => {
    const matchesCategory = categoryFilter === 'all' || evt.category === categoryFilter;
    const matchesSite = siteFilter === 'all' || evt.site_id === siteFilter;
    return matchesCategory && matchesSite;
  });

  // Dias no mês
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  // No JS: 0=Dom, 1=Seg... Ajusta para Segunda=0
  const startingDay = (firstDayOfMonth.getDay() + 6) % 7;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Eventos do dia selecionado
  const selectedDayEvents = filteredEvents.filter((e) => e.event_date === selectedDateStr);

  const getCategoryColor = (cat: EventCategory) => {
    switch (cat) {
      case 'obra':
        return { bg: 'var(--primary-subtle)', text: 'var(--primary)', border: 'var(--primary-border)', label: 'Obra' };
      case 'reuniao':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)', label: 'Reunião' };
      case 'inspecao':
        return { bg: 'var(--warning-subtle)', text: 'var(--warning)', border: 'var(--warning-border)', label: 'Inspeção' };
      case 'pagamento':
        return { bg: 'var(--success-subtle)', text: 'var(--success)', border: 'var(--success-border)', label: 'Pagamento' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.08)', text: 'var(--text-main)', border: 'var(--border-color)', label: 'Geral' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header da View */}
      <div className="view-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="view-title">Agenda & Calendário de Obras</h1>
          <p className="view-description">
            Planejamento de visitas, prazos de entrega, reuniões técnicas e compromissos das obras
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={goToToday} className="btn-flat-secondary" style={{ fontSize: 13, padding: '8px 14px' }}>
            Hoje
          </button>
          <button
            onClick={() => openNewEventModal()}
            className="btn-flat-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
          >
            <Plus size={16} /> Novo Compromisso
          </button>
        </div>
      </div>

      {/* Controles de Navegação e Filtros */}
      <div
        className="content-panel"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={prevMonth}
              className="btn-flat-secondary"
              style={{ padding: '6px 10px' }}
              title="Mês Anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={nextMonth}
              className="btn-flat-secondary"
              style={{ padding: '6px 10px' }}
              title="Próximo Mês"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            {monthNames[month]} de {year}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: 13,
              outline: 'none',
            }}
          >
            <option value="all">Todas as Categorias</option>
            <option value="obra">Obras / Entregas</option>
            <option value="reuniao">Reuniões com Clientes</option>
            <option value="inspecao">Inspeções / Vistorias</option>
            <option value="pagamento">Pagamentos / Medições</option>
            <option value="outro">Outros Lembretes</option>
          </select>

          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: 13,
              outline: 'none',
            }}
          >
            <option value="all">Todas as Obras</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Principal: Calendário Mensal à Esquerda (2.2fr) e Agenda do Dia à Direita (1.3fr) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        {/* Grade do Calendário */}
        <div
          className="content-panel"
          style={{
            padding: 18,
            borderRadius: 12,
            minWidth: 0,
          }}
        >
          {/* Cabeçalho dos dias da semana */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 6,
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {weekDays.map((d) => (
              <div key={d} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', padding: '6px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Células dos dias do mês */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 6,
            }}
          >
            {/* Espaços vazios antes do dia 1 */}
            {Array.from({ length: startingDay }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  height: 72,
                  borderRadius: 8,
                  backgroundColor: 'transparent',
                }}
              />
            ))}

            {/* Dias do mês */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDateStr;
              const isToday = dateStr === new Date().toISOString().slice(0, 10);
              const dayEvents = filteredEvents.filter((e) => e.event_date === dateStr);

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDateStr(dateStr)}
                  style={{
                    height: 76,
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-card-subtle)',
                    border: isSelected ? '2px solid var(--primary)' : isToday ? '1px solid var(--primary-border)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: isToday || isSelected ? 800 : 600,
                        color: isToday ? 'var(--primary)' : 'var(--text-main)',
                      }}
                    >
                      {dayNum}
                    </span>
                    {isToday && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                        }}
                      />
                    )}
                  </div>

                  {/* Indicadores de eventos do dia */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                    {dayEvents.slice(0, 2).map((ev) => {
                      const color = getCategoryColor(ev.category);
                      return (
                        <div
                          key={ev.id}
                          style={{
                            fontSize: 10,
                            padding: '1px 4px',
                            borderRadius: 4,
                            backgroundColor: color.bg,
                            color: color.text,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: 600,
                          }}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>
                        +{dayEvents.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna Direita: Compromissos do Dia Selecionado */}
        <div
          className="content-panel"
          style={{
            padding: 20,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Compromissos do Dia
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', margin: '2px 0 0' }}>
                {new Date(selectedDateStr + 'T12:00:00').toLocaleDateString('pt-PT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h3>
            </div>

            <button
              onClick={() => openNewEventModal(selectedDateStr)}
              className="btn-flat-primary"
              style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={14} /> Agendar
            </button>
          </div>

          {/* Lista com Scroll */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 440, overflowY: 'auto' }}>
            {selectedDayEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                <CalendarIcon size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                Nenhum compromisso agendado para este dia.
              </div>
            ) : (
              selectedDayEvents.map((evt) => {
                const color = getCategoryColor(evt.category);
                return (
                  <div
                    key={evt.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: `1px solid ${evt.is_completed ? 'var(--border-color)' : color.border}`,
                      opacity: evt.is_completed ? 0.6 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => handleToggleCompleted(evt.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                          title={evt.is_completed ? 'Marcar como pendente' : 'Marcar como concluído'}
                        >
                          {evt.is_completed ? (
                            <CheckCircle2 size={18} color="var(--success)" />
                          ) : (
                            <Circle size={18} color="var(--text-muted)" />
                          )}
                        </button>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            textDecoration: evt.is_completed ? 'line-through' : 'none',
                          }}
                        >
                          {evt.title}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDelete(evt.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                      {evt.start_time && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={13} color="var(--primary)" />
                          {evt.start_time} {evt.end_time ? `- ${evt.end_time}` : ''}
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: color.bg,
                          color: color.text,
                          textTransform: 'uppercase',
                        }}
                      >
                        {color.label}
                      </span>

                      {evt.site_name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Building2 size={13} />
                          {evt.site_name}
                        </span>
                      )}

                      {evt.assigned_employee_name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={13} />
                          {evt.assigned_employee_name}
                        </span>
                      )}
                    </div>

                    {evt.description && (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {evt.description}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal de Adicionar Novo Compromisso */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CalendarIcon size={20} color="var(--primary)" />
                <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Novo Compromisso na Agenda
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Título do Compromisso *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reunião com arquiteto, Concretagem laje, Inspeção carrinha..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ padding: '10px 12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Data *</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Início</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Término</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EventCategory)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="obra">Obra / Etapa</option>
                    <option value="reuniao">Reunião com Cliente</option>
                    <option value="inspecao">Inspeção / Vistoria</option>
                    <option value="pagamento">Pagamento / Medição</option>
                    <option value="outro">Outro Lembrete</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Obra Vinculada</label>
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="">Nenhuma obra específica</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Responsável da Equipa</label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  >
                    <option value="">Não atribuído</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.job_title})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Local / Endereço</label>
                  <input
                    type="text"
                    placeholder="Ex: Canteiro de Obras, Escritório..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{ padding: '10px 12px' }}
                  />
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Descrição / Detalhes</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais, lista de materiais a levar..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ padding: '8px 12px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-flat-secondary"
                  style={{ padding: '10px 16px', fontSize: 13 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-flat-primary"
                  style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} />
                  {saving ? 'Gravando...' : 'Salvar Compromisso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

