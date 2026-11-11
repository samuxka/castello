import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  DollarSign,
  Globe,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Save,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { Company } from '../types';
import {
  changeCompanyPassword,
  deleteCompanyAccount,
  updateCompanyProfile,
} from '../lib/supabase';

interface SettingsPageProps {
  company: Company;
  onCompanyUpdated: (updated: Company) => void;
  onAccountDeleted: () => void;
  showNotice: (msg: string) => void;
}

export function SettingsPage({
  company,
  onCompanyUpdated,
  onAccountDeleted,
  showNotice,
}: SettingsPageProps) {
  // Dados gerais da empresa
  const [name, setName] = useState(company.name || '');
  const [taxId, setTaxId] = useState(company.tax_id || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [address, setAddress] = useState(company.address || '');
  const [logoUrl, setLogoUrl] = useState(company.logo_url || '');
  const [currency, setCurrency] = useState(company.currency || 'EUR');

  // Configurações operacionais
  const [standardHours, setStandardHours] = useState('176');
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('17:00');
  const [toleranceMinutes, setToleranceMinutes] = useState('15');
  const [notifyPendingEntries, setNotifyPendingEntries] = useState(true);
  const [notifyOverdueBills, setNotifyOverdueBills] = useState(true);

  // Alteração de senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Exclusão de conta
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Upload local de imagem / logo
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setLogoUrl(result);
        showNotice('Logo carregada. Clique em "Gravar Dados da Firma" para salvar.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGeneralInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('O nome da empresa é obrigatório.');
      return;
    }

    setSavingGeneral(true);
    try {
      const updated = await updateCompanyProfile(company.id, {
        name: name.trim(),
        tax_id: taxId.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url: logoUrl || null,
        currency,
      });

      onCompanyUpdated(updated);
      showNotice('Configurações da firma atualizadas com sucesso.');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao gravar configurações: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      alert('Por favor informe a senha atual.');
      return;
    }
    if (newPassword.length < 6) {
      alert('A nova senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('A confirmação da nova senha não confere.');
      return;
    }

    setPasswordLoading(true);
    try {
      await changeCompanyPassword(company.id, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showNotice('Senha alterada com sucesso.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Falha ao alterar senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      alert('Digite EXCLUIR para confirmar a eliminação permanente.');
      return;
    }

    try {
      await deleteCompanyAccount(company.id);
      setDeleteModalOpen(false);
      onAccountDeleted();
    } catch (err: any) {
      alert('Erro ao excluir conta: ' + (err.message || 'Tente novamente.'));
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      {/* Cabeçalho */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Configurações da Firma</h1>
          <p className="view-description">
            Gerencie a identidade visual, dados cadastrais, segurança e parâmetros operacionais de <strong>{company.name}</strong>.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* 1. IDENTIDADE E DADOS GERAIS */}
        <section className="panel-box">
          <div className="panel-header" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building2 size={20} color="var(--primary)" />
              <h2 className="panel-title" style={{ fontSize: 16 }}>
                Identidade Visual e Informações da Firma
              </h2>
            </div>
          </div>

          <form onSubmit={handleSaveGeneralInfo}>
            {/* Bloco da Logo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '16px 20px',
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                marginBottom: 20,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 10,
                  backgroundColor: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '2px solid var(--primary-border)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 28,
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo da Firma"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{name.charAt(0).toUpperCase() || 'C'}</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  Logotipo Oficial da Construtora
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Esta imagem será exibida no cabeçalho do sistema, relatórios em PDF e no portal do cliente. (PNG, JPG ou WEBP até 2MB).
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label
                    className="btn-flat-secondary"
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      padding: '8px 14px',
                    }}
                  >
                    <Upload size={14} />
                    Carregar Imagem
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleLogoFileChange}
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      className="btn-flat-secondary"
                      style={{
                        color: 'var(--danger)',
                        borderColor: 'var(--danger-border)',
                        fontSize: 12,
                        padding: '8px 14px',
                      }}
                      onClick={() => setLogoUrl('')}
                    >
                      Remover Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs de Informações */}
            <div className="flat-form-grid" style={{ marginBottom: 20 }}>
              <div className="flat-form-group">
                <label>Nome da Construtora / Firma *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Castello Construções & Obras"
                />
              </div>

              <div className="flat-form-group">
                <label>NIF / NIPC / CNPJ Fiscal</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="Ex: 509 123 456"
                />
              </div>

              <div className="flat-form-group">
                <label>Telefone Comercial</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: +351 21 000 0000"
                />
              </div>

              <div className="flat-form-group">
                <label>Moeda Padrão do Sistema</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="EUR">Euro (€) - União Europeia</option>
                  <option value="BRL">Real (R$) - Brasil</option>
                  <option value="USD">Dólar ($) - Estados Unidos</option>
                  <option value="GBP">Libra (£) - Reino Unido</option>
                  <option value="CHF">Franco Suíço (CHF)</option>
                </select>
              </div>

              <div className="flat-form-group full">
                <label>Morada / Endereço da Sede</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Avenida da República 1045, Lisboa, Portugal"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={savingGeneral}
                className="btn-flat-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Save size={16} />
                {savingGeneral ? 'A gravar...' : 'Gravar Dados da Firma'}
              </button>
            </div>
          </form>
        </section>

        {/* 2. PREFERÊNCIAS OPERACIONAIS */}
        <section className="panel-box">
          <div className="panel-header" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Globe size={20} color="var(--primary)" />
              <h2 className="panel-title" style={{ fontSize: 16 }}>
                Parâmetros Operacionais de Trabalho
              </h2>
            </div>
          </div>

          <div className="flat-form-grid" style={{ marginBottom: 20 }}>
            <div className="flat-form-group">
              <label>Horas Mensais de Referência (Meta)</label>
              <input
                type="number"
                value={standardHours}
                onChange={(e) => setStandardHours(e.target.value)}
              />
            </div>

            <div className="flat-form-group">
              <label>Tolerância de Picagem (minutos)</label>
              <input
                type="number"
                value={toleranceMinutes}
                onChange={(e) => setToleranceMinutes(e.target.value)}
              />
            </div>

            <div className="flat-form-group">
              <label>Horário de Início de Turno</label>
              <input
                type="time"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
              />
            </div>

            <div className="flat-form-group">
              <label>Horário de Término de Turno</label>
              <input
                type="time"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '16px 18px',
              backgroundColor: 'var(--bg-card-subtle)',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={notifyPendingEntries}
                onChange={(e) => setNotifyPendingEntries(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              />
              <span>Receber alertas no painel para picagens pendentes de aprovação</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={notifyOverdueBills}
                onChange={(e) => setNotifyOverdueBills(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              />
              <span>Avisar automaticamente sobre faturas de fornecedores e contas a pagar com vencimento próximo (5 dias)</span>
            </label>
          </div>
        </section>

        {/* 3. SEGURANÇA E ACESSO */}
        <section className="panel-box">
          <div className="panel-header" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={20} color="var(--primary)" />
              <h2 className="panel-title" style={{ fontSize: 16 }}>
                Segurança e Senha de Acesso
              </h2>
            </div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'var(--bg-card-subtle)',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                E-mail de Login do Administrador
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
                {company.owner_email}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                backgroundColor: 'var(--success-subtle)',
                color: 'var(--success)',
                fontWeight: 600,
                border: '1px solid var(--success-border)',
              }}
            >
              Autenticado
            </span>
          </div>

          <form onSubmit={handleChangePassword}>
            <div className="flat-form-grid" style={{ marginBottom: 20 }}>
              <div className="flat-form-group">
                <label>Senha Atual</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                />
              </div>

              <div className="flat-form-group">
                <label>Nova Senha (Mínimo 6 caracteres)</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha segura"
                />
              </div>

              <div className="flat-form-group">
                <label>Confirmar Nova Senha</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={passwordLoading}
                className="btn-flat-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <KeyRound size={16} />
                {passwordLoading ? 'A verificar...' : 'Atualizar Senha'}
              </button>
            </div>
          </form>
        </section>

        {/* 4. ZONA CRÍTICA - EXCLUSÃO DE CONTA */}
        <section
          className="panel-box"
          style={{
            borderColor: 'var(--danger-border)',
            backgroundColor: 'var(--danger-subtle)',
          }}
        >
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} color="var(--danger)" />
              <h2 className="panel-title" style={{ fontSize: 16, color: 'var(--danger)' }}>
                Zona Crítica: Eliminar Conta da Firma
              </h2>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            A exclusão da conta da firma é uma ação permanente e irreversível. Todos os dados associados a <strong>{company.name}</strong>, incluindo obras, colaboradores, picagens de ponto e registros financeiros serão removidos.
          </p>

          <button
            type="button"
            className="btn-flat-secondary"
            style={{
              backgroundColor: 'var(--danger)',
              color: '#ffffff',
              borderColor: 'var(--danger)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 600,
            }}
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteModalOpen(true);
            }}
          >
            <Trash2 size={16} />
            Eliminar Conta Permanentemente
          </button>
        </section>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {deleteModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 440 }}>
            <div className="flat-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)' }}>
                <AlertTriangle size={22} />
                <h3 className="flat-modal-title" style={{ color: 'var(--danger)' }}>
                  Confirmar Exclusão de Conta
                </h3>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, marginBottom: 16, lineHeight: 1.5 }}>
              Esta ação <strong>NÃO PODE SER DESFEITA</strong>. Todos os dados de obras, ponto e gestão financeira serão apagados.
              <br /><br />
              Para confirmar, digite a palavra <strong style={{ color: 'var(--danger)' }}>EXCLUIR</strong> no campo abaixo:
            </p>

            <div className="flat-form-group" style={{ marginBottom: 20 }}>
              <input
                type="text"
                autoFocus
                placeholder="Digite EXCLUIR"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                style={{
                  textAlign: 'center',
                  fontWeight: 700,
                  borderColor: 'var(--danger-border)',
                  color: 'var(--danger)',
                }}
              />
            </div>

            <div className="flat-modal-actions">
              <button
                type="button"
                className="btn-flat-secondary"
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR'}
                onClick={handleDeleteAccount}
                style={{
                  backgroundColor: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: deleteConfirmText.trim().toUpperCase() === 'EXCLUIR' ? 'pointer' : 'not-allowed',
                  opacity: deleteConfirmText.trim().toUpperCase() === 'EXCLUIR' ? 1 : 0.5,
                }}
              >
                Sim, Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
