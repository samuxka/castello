import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  KeyRound,
  Briefcase,
  Calendar,
  Clock,
  Euro,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Check,
  X,
  Eye,
  Plus,
  AlertCircle,
} from 'lucide-react';
import {
  EmployeeProfile,
  TimeEntry,
  ConstructionSite,
  AbsenceJustification,
  EntryType,
} from '../types';
import {
  saveEmployee,
  getAbsenceJustifications,
  updateAbsenceJustificationStatus,
  createManualTimeEntry,
} from '../lib/supabase';
import { JobTitleAutocompleteSelect } from '../components/JobTitleAutocompleteSelect';

interface EmployeeDetailPageProps {
  employee: EmployeeProfile;
  sites: ConstructionSite[];
  entries: TimeEntry[];
  onBack: () => void;
  onEmployeeUpdated: (updated: EmployeeProfile) => void;
  showNotice: (msg: string) => void;
  onEntryAdded?: (entry: TimeEntry) => void;
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function EmployeeDetailPage({
  employee,
  sites,
  entries,
  onBack,
  onEmployeeUpdated,
  showNotice,
  onEntryAdded,
}: EmployeeDetailPageProps) {
  // Form de edição
  const [fullName, setFullName] = useState(employee.full_name);
  const [email, setEmail] = useState(employee.email);
  const [accessCode, setAccessCode] = useState(employee.access_code);
  const [jobTitle, setJobTitle] = useState(employee.job_title);
  const [phone, setPhone] = useState(employee.phone || '');
  const [hourlyRate, setHourlyRate] = useState(String(employee.hourly_rate));
  const [monthlyTargetHours, setMonthlyTargetHours] = useState(String(employee.monthly_target_hours));
  const [admissionDate, setAdmissionDate] = useState(employee.admission_date || '');
  const [isActive, setIsActive] = useState(employee.is_active);
  const [avatarUrl, setAvatarUrl] = useState(employee.avatar_url || '');
  const [saving, setSaving] = useState(false);

  // Registos de ponto locais e sincronizados
  const [localEntries, setLocalEntries] = useState<TimeEntry[]>(entries);
  useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  // Modal para Patrão Registar Presença Manual
  const [addPresenceModalOpen, setAddPresenceModalOpen] = useState(false);
  const [presenceDate, setPresenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [presenceTime, setPresenceTime] = useState('08:00');
  const [presenceType, setPresenceType] = useState<EntryType>('entrada');
  const [presenceSiteId, setPresenceSiteId] = useState('');
  const [presenceNotes, setPresenceNotes] = useState('Presença registada manualmente pela gerência');
  const [submittingPresence, setSubmittingPresence] = useState(false);

  // Filtra picagens apenas deste colaborador
  const empEntries = localEntries.filter((e) => e.employee_id === employee.id);
  const pendingCount = empEntries.filter((e) => e.status === 'pendente').length;
  const approvedCount = empEntries.filter((e) => e.status === 'aprovado').length;

  const handleCreateManualPresence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presenceDate || !presenceTime) {
      alert('Selecione a data e o horário.');
      return;
    }
    setSubmittingPresence(true);
    try {
      const recordedAt = `${presenceDate}T${presenceTime}:00.000Z`;
      const created = await createManualTimeEntry({
        employee_id: employee.id,
        company_id: employee.company_id,
        site_id: presenceSiteId || null,
        entry_type: presenceType,
        work_date: presenceDate,
        recorded_at: recordedAt,
        notes: presenceNotes || null,
        status: 'aprovado',
      });
      setLocalEntries((prev) => [created, ...prev]);
      if (onEntryAdded) {
        onEntryAdded(created);
      }
      setAddPresenceModalOpen(false);
      showNotice(`Presença registada com sucesso para ${employee.full_name}!`);
    } catch (err: any) {
      alert('Erro ao registar presença: ' + (err.message || 'Tente novamente'));
    } finally {
      setSubmittingPresence(false);
    }
  };

  // Estado do Calendário de Assiduidade e Justificativas de Falta
  const [justifications, setJustifications] = useState<AbsenceJustification[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeJustifModal, setActiveJustifModal] = useState<AbsenceJustification | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const loadJustifs = async () => {
    const list = await getAbsenceJustifications(employee.id, employee.company_id || undefined);
    setJustifications(list);
  };

  useEffect(() => {
    loadJustifs();
  }, [employee.id]);

  const handleUpdateJustifStatus = async (id: string, status: 'aprovada' | 'rejeitada') => {
    await updateAbsenceJustificationStatus(id, status);
    await loadJustifs();
    if (activeJustifModal && activeJustifModal.id === id) {
      setActiveJustifModal({ ...activeJustifModal, status });
    }
    showNotice(`Justificativa ${status === 'aprovada' ? 'aprovada' : 'rejeitada'} com sucesso!`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !accessCode.trim()) {
      alert('Preencha os campos obrigatórios (Nome, E-mail e PIN).');
      return;
    }

    setSaving(true);
    try {
      const updated = await saveEmployee({
        id: employee.id,
        company_id: employee.company_id,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        access_code: accessCode.trim(),
        role: employee.role || 'funcionario',
        job_title: jobTitle.trim(),
        phone: phone.trim() || null,
        hourly_rate: parseFloat(hourlyRate.replace(',', '.')) || 0,
        monthly_target_hours: parseInt(monthlyTargetHours, 10) || 176,
        admission_date: admissionDate || null,
        is_active: isActive,
        avatar_url: employee.avatar_url || null,
      });

      onEmployeeUpdated(updated);
      showNotice(`Dados de ${updated.full_name} atualizados com sucesso!`);
    } catch (err: any) {
      alert('Erro ao salvar colaborador: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960, margin: '0 auto', width: '100%' }}>
      {/* Botão Voltar e Cabeçalho do Perfil */}
      <div>
        <button
          onClick={onBack}
          className="btn-flat-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            padding: '8px 14px',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} /> Voltar para Lista de Funcionários
        </button>

        <div
          className="content-panel"
          style={{
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {avatarUrl || employee.avatar_url ? (
              <img
                src={avatarUrl || employee.avatar_url || ''}
                alt={employee.full_name}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--border-color)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 800,
                  border: '3px solid var(--border-color)',
                  flexShrink: 0,
                }}
              >
                {employee.full_name.charAt(0)}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {employee.full_name}
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    backgroundColor: employee.is_active ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                    color: employee.is_active ? 'var(--success)' : 'var(--danger)',
                    border: `1px solid ${employee.is_active ? 'var(--success-border)' : 'var(--danger-border)'}`,
                    textTransform: 'uppercase',
                  }}
                >
                  {employee.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, color: 'var(--text-muted)', fontSize: 13 }}>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{employee.job_title}</span>
                <span>•</span>
                <span>PIN: <strong>{employee.access_code}</strong></span>
                <span>•</span>
                <span>{employee.email}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-flat-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
            }}
            onClick={() => setAddPresenceModalOpen(true)}
          >
            <Plus size={16} /> Registar Presença Manual
          </button>
        </div>
      </div>

      {/* KPIs do Colaborador */}
      <div className="kpi-row">
        <div className="kpi-box">
          <div className="kpi-label">Taxa Horária</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            € {Number(employee.hourly_rate).toFixed(2)}/h
          </div>
          <div className="kpi-detail">Custo base da hora de trabalho</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Meta Mensal</div>
          <div className="kpi-value">
            {employee.monthly_target_hours}h
          </div>
          <div className="kpi-detail">Horas contratuais no mês</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Total de Picagens</div>
          <div className="kpi-value" style={{ color: 'var(--text-main)' }}>
            {empEntries.length}
          </div>
          <div className="kpi-detail">{approvedCount} aprovadas no histórico</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-label">Pontos Pendentes</div>
          <div
            className="kpi-value"
            style={{ color: pendingCount > 0 ? 'var(--warning)' : 'var(--success)' }}
          >
            {pendingCount}
          </div>
          <div className="kpi-detail">Aguardando validação</div>
        </div>
      </div>

      {/* Formulário de Edição de Dados */}
      <div
        className="content-panel"
        style={{
          padding: 24,
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <User size={20} color="var(--primary)" />
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Editar Ficha Cadastral do Colaborador
          </h2>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>Nome Completo *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>Cargo / Função *</label>
              <JobTitleAutocompleteSelect
                value={jobTitle}
                onChange={(val) => setJobTitle(val)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14 }}>
            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>E-mail de Acesso ao App *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>PIN de Acesso (6 dígitos) *</label>
              <input
                type="text"
                required
                maxLength={8}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}
              />
            </div>

            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>Telefone / Contacto</label>
              <input
                type="text"
                placeholder="+351 900 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>Taxa Horária (€/h)</label>
              <input
                type="text"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>Meta Mensal (Horas)</label>
              <input
                type="number"
                value={monthlyTargetHours}
                onChange={(e) => setMonthlyTargetHours(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>Data de Admissão</label>
              <input
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="flat-form-group">
              <label style={{ fontSize: 13, fontWeight: 700 }}>Status do Colaborador</label>
              <select
                value={isActive ? 'ativo' : 'inativo'}
                onChange={(e) => setIsActive(e.target.value === 'ativo')}
                style={{ padding: '10px 14px' }}
              >
                <option value="ativo">Ativo (Pode picar)</option>
                <option value="inativo">Inativo / Bloqueado</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              type="submit"
              disabled={saving}
              className="btn-flat-primary"
              style={{
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Save size={16} />
              {saving ? 'Gravando Alterações...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* CALENDÁRIO DE ASSIDUIDADE: DIAS QUE FOI E DIAS QUE FALTOU */}
      {(() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const admissionStr =
          employee.admission_date ||
          (employee.created_at ? employee.created_at.slice(0, 10) : '');

        const firstDayWeek = new Date(selectedYear, selectedMonth, 1).getDay();
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

        let workedDaysCount = 0;
        let absentDaysCount = 0;
        let justifiedDaysCount = 0;

        const cells: Array<{
          day: number | null;
          dateStr: string | null;
          isWeekend: boolean;
          hasWorked: boolean;
          isAbsent: boolean;
          justif?: AbsenceJustification;
          isBeforeAdmission: boolean;
          isFuture: boolean;
        }> = [];

        for (let i = 0; i < firstDayWeek; i++) {
          cells.push({
            day: null,
            dateStr: null,
            isWeekend: false,
            hasWorked: false,
            isAbsent: false,
            isBeforeAdmission: false,
            isFuture: false,
          });
        }

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dateObj = new Date(selectedYear, selectedMonth, d);
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
          const isFuture = dateStr > todayStr;
          const isBeforeAdmission = Boolean(admissionStr && dateStr < admissionStr);

          const dayEntries = empEntries.filter((e) => e.work_date === dateStr);
          const hasWorked = dayEntries.length > 0;
          const justif = justifications.find((j) => j.date === dateStr);

          const isAbsent = !hasWorked && !isWeekend && !isBeforeAdmission && !isFuture;

          if (hasWorked) workedDaysCount++;
          if (isAbsent) {
            absentDaysCount++;
            if (justif) justifiedDaysCount++;
          }

          cells.push({
            day: d,
            dateStr,
            isWeekend,
            hasWorked,
            isAbsent,
            justif,
            isBeforeAdmission,
            isFuture,
          });
        }

        return (
          <div className="content-panel" style={{ padding: 24, borderRadius: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={20} color="var(--primary)" />
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Assiduidade & Faltas do Funcionário
                  </h2>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Acompanhamento de dias trabalhados e faltas justificadas/não justificadas
                </p>
              </div>

              {/* Navegação entre Meses */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  style={{ padding: '6px 10px' }}
                  onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11);
                      setSelectedYear((y) => y - 1);
                    } else {
                      setSelectedMonth((m) => m - 1);
                    }
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', minWidth: 140, textAlign: 'center' }}>
                  {MONTHS_PT[selectedMonth]} {selectedYear}
                </span>

                <button
                  type="button"
                  className="btn-flat-secondary"
                  style={{ padding: '6px 10px' }}
                  onClick={() => {
                    if (selectedMonth === 11) {
                      setSelectedMonth(0);
                      setSelectedYear((y) => y + 1);
                    } else {
                      setSelectedMonth((m) => m + 1);
                    }
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Badges de Resumo do Mês */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--success-subtle)',
                  border: '1px solid var(--success)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--success)',
                }}
              >
                <CheckCircle2 size={15} />
                <span>Dias com Presença: <strong>{workedDaysCount}</strong></span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--danger-subtle)',
                  border: '1px solid var(--danger)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--danger)',
                }}
              >
                <XCircle size={15} />
                <span>Total de Faltas: <strong>{absentDaysCount}</strong></span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--warning-subtle)',
                  border: '1px solid var(--warning)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--warning)',
                }}
              >
                <FileText size={15} />
                <span>Faltas com Justificativa: <strong>{justifiedDaysCount}</strong></span>
              </div>
            </div>

            {/* Grelha do Calendário */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 8,
                textAlign: 'center',
              }}
            >
              {/* Cabeçalho dos dias da semana */}
              {WEEKDAYS_SHORT.map((w, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  {w}
                </div>
              ))}

              {/* Células dos Dias */}
              {cells.map((cell, idx) => {
                if (!cell.day) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      style={{
                        minHeight: 64,
                        backgroundColor: 'transparent',
                      }}
                    />
                  );
                }

                let bgColor = 'var(--card-bg)';
                let borderColor = 'var(--border-color)';
                let textColor = 'var(--text-main)';
                let label = '';
                let isClickable = Boolean(cell.justif);

                if (cell.hasWorked) {
                  bgColor = 'rgba(22, 163, 74, 0.12)';
                  borderColor = 'var(--success)';
                  textColor = 'var(--success)';
                  label = 'PRESENÇA';
                } else if (cell.isAbsent) {
                  if (cell.justif) {
                    if (cell.justif.status === 'aprovada') {
                      bgColor = 'rgba(16, 185, 129, 0.15)';
                      borderColor = '#10B981';
                      textColor = '#10B981';
                      label = 'JUSTIFICADA';
                    } else if (cell.justif.status === 'rejeitada') {
                      bgColor = 'rgba(220, 38, 38, 0.15)';
                      borderColor = 'var(--danger)';
                      textColor = 'var(--danger)';
                      label = 'FALTA REJEITADA';
                    } else {
                      bgColor = 'rgba(245, 158, 11, 0.15)';
                      borderColor = 'var(--warning)';
                      textColor = 'var(--warning)';
                      label = 'JUSTIF. PENDENTE';
                    }
                  } else {
                    bgColor = 'rgba(220, 38, 38, 0.10)';
                    borderColor = 'rgba(220, 38, 38, 0.4)';
                    textColor = 'var(--danger)';
                    label = 'FALTA';
                  }
                } else if (cell.isWeekend) {
                  bgColor = 'rgba(148, 163, 184, 0.04)';
                  textColor = 'var(--text-muted)';
                  label = 'FOLGA';
                } else if (cell.isBeforeAdmission) {
                  bgColor = 'transparent';
                  textColor = 'var(--text-muted)';
                  label = 'PRÉ-ADMISSÃO';
                } else {
                  textColor = 'var(--text-muted)';
                  label = '';
                }

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => {
                      if (cell.justif) {
                        setActiveJustifModal(cell.justif);
                      }
                    }}
                    style={{
                      minHeight: 68,
                      padding: 6,
                      borderRadius: 8,
                      backgroundColor: bgColor,
                      border: `1px solid ${borderColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: isClickable ? 'pointer' : 'default',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    title={
                      cell.justif
                        ? `Clique para ver justificativa (${cell.justif.reason})`
                        : undefined
                    }
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>
                      {cell.day}
                    </span>

                    {label && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 4px',
                          borderRadius: 4,
                          color: textColor,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        {cell.justif && <FileText size={9} />}
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal de Detalhe da Justificativa da Falta (Ver Justificativa Escrita + Fotos + Aprovar/Rejeitar) */}
            {activeJustifModal && (
              <div className="flat-modal-backdrop">
                <div
                  className="flat-modal-box"
                  style={{ maxWidth: 540, width: '100%', padding: 24, borderRadius: 12 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={20} color="var(--primary)" />
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        Justificativa de Falta
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="btn-flat-secondary"
                      style={{ padding: 4 }}
                      onClick={() => setActiveJustifModal(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Data da Falta:</span>
                      <strong style={{ color: 'var(--text-main)' }}>
                        {activeJustifModal.date.split('-').reverse().join('/')}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Estado Atual:</span>
                      <span
                        className={`badge-flat ${
                          activeJustifModal.status === 'aprovada'
                            ? 'success'
                            : activeJustifModal.status === 'rejeitada'
                            ? 'danger'
                            : 'warning'
                        }`}
                      >
                        {activeJustifModal.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                        Justificativa Escrita do Colaborador:
                      </label>
                      <div
                        style={{
                          marginTop: 6,
                          padding: 12,
                          borderRadius: 8,
                          backgroundColor: 'var(--bg-main)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {activeJustifModal.reason || 'Nenhuma descrição detalhada informada.'}
                      </div>
                    </div>

                    {/* Fotos / Comprovativos Anexados */}
                    {activeJustifModal.photos && activeJustifModal.photos.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
                          Comprovativos / Fotos Anexadas ({activeJustifModal.photos.length}):
                        </label>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {activeJustifModal.photos.map((photo, pIdx) => (
                            <div
                              key={pIdx}
                              onClick={() => setPreviewPhoto(photo)}
                              style={{
                                width: 90,
                                height: 90,
                                borderRadius: 8,
                                overflow: 'hidden',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                position: 'relative',
                              }}
                            >
                              <img
                                src={photo}
                                alt={`Comprovativo ${pIdx + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  backgroundColor: 'rgba(0,0,0,0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: 0,
                                  transition: 'opacity 0.2s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                              >
                                <Eye size={18} color="#ffffff" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ações de Aprovação para a Empresa / Chefe */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10,
                        marginTop: 10,
                        borderTop: '1px solid var(--border-color)',
                        paddingTop: 16,
                      }}
                    >
                      <button
                        type="button"
                        className="btn-flat-secondary"
                        onClick={() => handleUpdateJustifStatus(activeJustifModal.id, 'rejeitada')}
                        style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <X size={15} /> Rejeitar Justificativa
                      </button>

                      <button
                        type="button"
                        className="btn-flat-primary"
                        onClick={() => handleUpdateJustifStatus(activeJustifModal.id, 'aprovada')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Check size={15} /> Aprovar Justificativa
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Lightbox de Foto do Comprovativo */}
            {previewPhoto && (
              <div
                className="flat-modal-backdrop"
                style={{ zIndex: 1100 }}
                onClick={() => setPreviewPhoto(null)}
              >
                <div
                  style={{
                    position: 'relative',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={previewPhoto}
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
                    onClick={() => setPreviewPhoto(null)}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
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
      })()}

      {/* Justificativas de Falta Submetidas pelo Colaborador */}
      <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} color="var(--primary)" />
              Justificativas de Falta ({justifications.length})
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Justificativas e atestados médicos enviados por {employee.full_name} para aprovação
            </p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {justifications.filter((j) => j.status === 'pendente').length} pendente(s)
          </span>
        </div>

        {justifications.length === 0 ? (
          <div style={{ padding: '36px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhuma justificativa de falta enviada por este colaborador até o momento.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {justifications
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((justif) => {
                const isPending = justif.status === 'pendente';
                return (
                  <div
                    key={justif.id}
                    style={{
                      padding: '16px 24px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 16,
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: isPending ? 'var(--primary-subtle)' : 'transparent',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-main)' }}>
                          Falta no dia {justif.date.split('-').reverse().join('/')}
                        </span>
                        <span
                          className={`badge-flat ${
                            justif.status === 'aprovada'
                              ? 'success'
                              : justif.status === 'rejeitada'
                              ? 'danger'
                              : 'warning'
                          }`}
                          style={{ fontSize: 10, padding: '2px 8px' }}
                        >
                          {justif.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5, marginBottom: 10 }}>
                        <strong style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', textTransform: 'uppercase', marginBottom: 2 }}>
                          Motivo / Justificação Escrita:
                        </strong>
                        {justif.reason}
                      </div>

                      {justif.photos && justif.photos.length > 0 && (
                        <div>
                          <strong style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', textTransform: 'uppercase', marginBottom: 6 }}>
                            Anexos / Comprovativos ({justif.photos.length}):
                          </strong>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {justif.photos.map((photoUri, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setPreviewPhoto(photoUri)}
                                style={{
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                  padding: 0,
                                  cursor: 'pointer',
                                  backgroundColor: 'transparent',
                                }}
                                title="Clique para ampliar"
                              >
                                <img
                                  src={photoUri}
                                  alt={`Anexo ${idx + 1}`}
                                  style={{ width: 60, height: 60, objectFit: 'cover', display: 'block' }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateJustifStatus(justif.id, 'aprovada')}
                        className={justif.status === 'aprovada' ? 'btn-flat-secondary' : 'btn-flat-success'}
                        style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        title="Aprovar esta falta como justificada"
                      >
                        <Check size={14} />
                        {justif.status === 'aprovada' ? 'Aprovada' : 'Aprovar Falta'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateJustifStatus(justif.id, 'rejeitada')}
                        className={justif.status === 'rejeitada' ? 'btn-flat-secondary' : 'btn-flat-danger'}
                        style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                        title="Rejeitar esta justificativa"
                      >
                        <X size={14} />
                        {justif.status === 'rejeitada' ? 'Rejeitada' : 'Rejeitar'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Histórico Recente de Pontos / Picagens deste Colaborador */}
      <div className="content-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Histórico de Picagens de Ponto
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Registos efetuados por {employee.full_name} via aplicativo
            </p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {empEntries.length} registos no total
          </span>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
          <table className="flat-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Tipo de Ponto</th>
                <th>Obra</th>
                <th>Estado de Validação</th>
              </tr>
            </thead>
            <tbody>
              {empEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Nenhuma picagem registrada por este funcionário até o momento.
                  </td>
                </tr>
              ) : (
                empEntries.map((entry) => {
                  const site = sites.find((s) => s.id === entry.site_id);
                  const d = new Date(entry.recorded_at);
                  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

                  return (
                    <tr key={entry.id}>
                      <td style={{ fontWeight: 600 }}>{entry.work_date}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={13} color="var(--primary)" />
                          <span>{timeStr}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge-flat primary">
                          {entry.entry_type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {site ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Building2 size={13} color="var(--text-muted)" />
                            <span>{site.name}</span>
                          </div>
                        ) : (
                          'Geral / Apoio'
                        )}
                      </td>
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL PARA O PATRÃO ADICIONAR PRESENÇA / PONTO MANUAL */}
      {addPresenceModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 480, width: '100%', padding: 24, borderRadius: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={20} color="var(--primary)" />
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Registar Presença Manual
                </h3>
              </div>
              <button
                type="button"
                className="btn-flat-secondary"
                style={{ padding: 4 }}
                onClick={() => setAddPresenceModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateManualPresence} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Adicione a picagem de ponto para <strong>{employee.full_name}</strong>. Esta presença será registada com estado <strong>Aprovado</strong> diretamente.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Data do Ponto *</label>
                  <input
                    type="date"
                    required
                    value={presenceDate}
                    onChange={(e) => setPresenceDate(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Horário (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={presenceTime}
                    onChange={(e) => setPresenceTime(e.target.value)}
                    style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Tipo de Registo *</label>
                  <select
                    value={presenceType}
                    onChange={(e) => setPresenceType(e.target.value as EntryType)}
                    style={{ padding: '8px 12px' }}
                  >
                    <option value="entrada">ENTRADA</option>
                    <option value="almoco">ALMOÇO</option>
                    <option value="saida">SAÍDA</option>
                  </select>
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Obra de Afetação</label>
                  <select
                    value={presenceSiteId}
                    onChange={(e) => setPresenceSiteId(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  >
                    <option value="">Geral / Apoio Logístico</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (#{s.share_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Observação / Justificativa</label>
                <input
                  type="text"
                  placeholder="Ex: Trabalho autorizado / Ponto lançado pela gerência"
                  value={presenceNotes}
                  onChange={(e) => setPresenceNotes(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => setAddPresenceModalOpen(false)}
                  disabled={submittingPresence}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-flat-primary"
                  disabled={submittingPresence}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Check size={16} />
                  {submittingPresence ? 'Gravando Presença...' : 'Gravar Presença'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
