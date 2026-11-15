import React, { useState, useEffect } from 'react';
import { Building2, Calendar, Clock, ArrowRightLeft, Square, X, CheckCircle2 } from 'lucide-react';
import { Team, ConstructionSite, EmployeeProfile } from '../../types';
import { allocateTeamToSiteWeb, finishTeamAllocationWeb } from '../../lib/supabase';
import { customConfirm, customAlert } from '../../context/DialogContext';

export type AllocationModalMode = 'allocate' | 'transfer' | 'finish';

interface TeamAllocationModalProps {
  isOpen: boolean;
  mode: AllocationModalMode;
  team: Team | null;
  sites: ConstructionSite[];
  employees: EmployeeProfile[];
  companyId?: string;
  defaultDate?: string;
  onClose: () => void;
  onSuccess: (updatedTeam: Team, message: string) => void;
}

export const TeamAllocationModal: React.FC<TeamAllocationModalProps> = ({
  isOpen,
  mode,
  team,
  sites,
  employees,
  companyId,
  defaultDate,
  onClose,
  onSuccess,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeSites = sites.filter((s) => s.status !== 'concluida');

  const [siteId, setSiteId] = useState('');
  const [startDate, setStartDate] = useState(defaultDate || todayStr);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [notes, setNotes] = useState('');
  const [recordSessionOnFinish, setRecordSessionOnFinish] = useState(true);
  const [finishHours, setFinishHours] = useState('8');
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isOpen || !team) return;
    const candidateSites = activeSites.filter((s) =>
      mode === 'transfer' ? s.id !== team.current_site_id : true
    );
    setSiteId(candidateSites[0]?.id || sites[0]?.id || '');
    setStartDate(defaultDate || todayStr);
    setEndDate(team.allocation_end_date || '');
    setStartTime(team.allocation_start_time || '');
    setEndTime(team.allocation_end_time || '');
    setTransferReason('');
    setNotes('');
    setRecordSessionOnFinish(true);

    if (team.allocated_at) {
      const diff = (Date.now() - new Date(team.allocated_at).getTime()) / (1000 * 60 * 60);
      const calc = Math.min(12, Math.max(0.5, Math.round(diff * 10) / 10));
      setFinishHours(String(calc));
    } else {
      setFinishHours('8');
    }
    setIsDirty(false);
  }, [isOpen, team, mode, defaultDate]);

  if (!isOpen || !team) return null;

  const handleSafeClose = async () => {
    if (isDirty && !submitting) {
      const discard = await customConfirm({
        title: 'Descartar Alterações',
        message: 'Existem dados preenchidos não guardados. Deseja realmente fechar o formulário?',
        type: 'warning',
        confirmText: 'Descartar',
        cancelText: 'Continuar',
      });
      if (!discard) return;
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'finish') {
        const hrs = parseFloat(finishHours.replace(',', '.')) || 0;
        const updated = await finishTeamAllocationWeb({
          team,
          recordSession: recordSessionOnFinish,
          sessionHours: recordSessionOnFinish ? hrs : 0,
          notes: notes.trim() || undefined,
          companyId,
        });
        onSuccess(updated, `Alocação da equipa "${team.name}" terminada com sucesso.`);
        onClose();
        return;
      }

      const targetSite = sites.find((s) => s.id === siteId);
      if (!targetSite) {
        await customAlert({
          title: 'Obra Obrigatória',
          message: 'Selecione uma obra válida para alocar a equipa.',
          type: 'warning',
        });
        setSubmitting(false);
        return;
      }

      if (endDate && endDate < startDate) {
        await customAlert({
          title: 'Datas Inválidas',
          message: 'A data de conclusão prevista não pode ser anterior à data de início.',
          type: 'error',
        });
        setSubmitting(false);
        return;
      }

      const updated = await allocateTeamToSiteWeb({
        team,
        site: targetSite,
        startDate,
        endDate: endDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        transferReason: mode === 'transfer' ? transferReason.trim() || 'Transferência entre obras' : null,
        notes: notes.trim() || null,
        companyId,
        employees,
      });

      onSuccess(
        updated,
        mode === 'transfer'
          ? `Equipa "${team.name}" transferida para "${targetSite.name}".`
          : `Equipa "${team.name}" alocada em "${targetSite.name}".`
      );
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro ao atualizar a alocação.';
      await customAlert({
        title: 'Não foi possível concluir a operação',
        message: msg,
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flat-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alloc-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      <div
        className="flat-modal-box"
        style={{ maxWidth: 520, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flat-modal-header">
          <h3
            id="alloc-modal-title"
            className="flat-modal-title"
            style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}
          >
            {mode === 'finish' ? (
              <>
                <Square size={17} color="var(--danger)" />
                Terminar Alocação — {team.name}
              </>
            ) : mode === 'transfer' ? (
              <>
                <ArrowRightLeft size={17} color="var(--primary)" />
                Transferir Equipa — {team.name}
              </>
            ) : (
              <>
                <Building2 size={17} color="var(--primary)" />
                Alocar Equipa a uma Obra — {team.name}
              </>
            )}
          </h3>
          <button
            type="button"
            onClick={handleSafeClose}
            className="btn-icon"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
            aria-label="Fechar janela"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'finish' ? (
            <>
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  fontSize: 13,
                  color: 'var(--text-main)',
                }}
              >
                Obra atual: <strong>{team.current_site_name || 'Em Obra'}</strong>
                {team.allocated_at && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Iniciada em: {new Date(team.allocated_at).toLocaleDateString('pt-PT')}
                    {team.allocation_start_time ? ` às ${team.allocation_start_time}` : ''}
                  </div>
                )}
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={recordSessionOnFinish}
                  onChange={(e) => {
                    setRecordSessionOnFinish(e.target.checked);
                    setIsDirty(true);
                  }}
                />
                Registar sessão de trabalho no histórico ao encerrar alocação
              </label>

              {recordSessionOnFinish && (
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Duração da Sessão da Equipa (Horas)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    required
                    value={finishHours}
                    onChange={(e) => {
                      setFinishHours(e.target.value);
                      setIsDirty(true);
                    }}
                    style={{ padding: '9px 12px' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Equipa com {(team.member_ids?.length || 0) + (team.leader_id ? 1 : 0)} elemento(s) • Total estimado:{' '}
                    {(
                      (parseFloat(finishHours.replace(',', '.')) || 0) *
                      Math.max(1, (team.member_ids?.length || 0) + (team.leader_id ? 1 : 0))
                    ).toFixed(1)}{' '}
                    horas-homem
                  </span>
                </div>
              )}

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Observações do Fecho (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Resumo do serviço realizado no turno..."
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setIsDirty(true);
                  }}
                  style={{ padding: '8px 12px', resize: 'none' }}
                />
              </div>
            </>
          ) : (
            <>
              {mode === 'transfer' && team.current_site_name && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    fontSize: 12,
                  }}
                >
                  Obra de origem: <strong>{team.current_site_name}</strong>
                </div>
              )}

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  {mode === 'transfer' ? 'Obra de Destino *' : 'Obra a Alocar *'}
                </label>
                <select
                  required
                  value={siteId}
                  onChange={(e) => {
                    setSiteId(e.target.value);
                    setIsDirty(true);
                  }}
                  style={{ padding: '9px 12px' }}
                >
                  <option value="">Selecione a obra...</option>
                  {sites
                    .filter((s) => (mode === 'transfer' ? s.id !== team.current_site_id : true))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status.toUpperCase()}) — {s.address}
                      </option>
                    ))}
                </select>
              </div>

              <div className="responsive-form-grid-2">
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setIsDirty(true);
                    }}
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Conclusão Prevista (opcional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setIsDirty(true);
                    }}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              <div className="responsive-form-grid-2">
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Hora de Início (opcional)
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setIsDirty(true);
                    }}
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Hora de Fim (opcional)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setIsDirty(true);
                    }}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              </div>

              {mode === 'transfer' && (
                <div className="flat-form-group">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Motivo da Transferência</label>
                  <input
                    type="text"
                    placeholder="Ex: Prioridade de acabamento, conclusão de etapa..."
                    value={transferReason}
                    onChange={(e) => {
                      setTransferReason(e.target.value);
                      setIsDirty(true);
                    }}
                    style={{ padding: '8px 12px' }}
                  />
                </div>
              )}

              <div className="flat-form-group">
                <label style={{ fontSize: 12, fontWeight: 700 }}>Notas Operacionais (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Instruções específicas para esta alocação..."
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setIsDirty(true);
                  }}
                  style={{ padding: '8px 12px', resize: 'none' }}
                />
              </div>
            </>
          )}

          <div className="flat-modal-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={handleSafeClose}
              className="btn-flat-secondary"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={mode === 'finish' ? 'btn-flat-danger' : 'btn-flat-primary'}
              disabled={submitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle2 size={15} />
              {submitting
                ? 'A processar...'
                : mode === 'finish'
                ? 'Confirmar Fim de Alocação'
                : mode === 'transfer'
                ? 'Confirmar Transferência'
                : 'Confirmar Alocação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
