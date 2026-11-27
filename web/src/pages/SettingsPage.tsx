import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Moon,
  Palette,
  Phone,
  Save,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { Company, ThemeColor, ThemeMode } from '../types';
import {
  changeCompanyPassword,
  deleteCompanyAccount,
  getSavedTheme,
  saveTheme,
  updateCompanyProfile,
} from '../lib/supabase';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { IMAGE_MIME_TYPES, validateUploadFile } from '../lib/urlSafety';

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
  // Dados básicos
  const [name, setName] = useState(company.name || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [taxId, setTaxId] = useState(company.tax_id || '');
  const [logoUrl, setLogoUrl] = useState(company.logo_url || '');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Temas Visuais (Azul, Vermelho, Verde, Amarelo, Laranja - Claro / Escuro)
  const [themeColor, setThemeColor] = useState<ThemeColor>(() => (company.theme_color as ThemeColor) || getSavedTheme().color);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (company.theme_mode as ThemeMode) || getSavedTheme().mode);

  const THEMES_LIST: { id: ThemeColor; name: string; lightHex: string; darkHex: string; desc: string }[] = [
    { id: 'azul', name: 'Azul', lightHex: '#2563eb', darkHex: '#3b82f6', desc: 'Corporativo Castello' },
    { id: 'vermelho', name: 'Vermelho', lightHex: '#dc2626', darkHex: '#ef4444', desc: 'Rubro / Destaque' },
    { id: 'verde', name: 'Verde', lightHex: '#16a34a', darkHex: '#22c55e', desc: 'Esmeralda / Obra' },
    { id: 'amarelo', name: 'Amarelo', lightHex: '#d97706', darkHex: '#f59e0b', desc: 'Âmbar / Máquinas' },
    { id: 'laranja', name: 'Laranja', lightHex: '#ea580c', darkHex: '#f97316', desc: 'Segurança / Energia' },
  ];

  const handleApplyColor = async (color: ThemeColor) => {
    setThemeColor(color);
    saveTheme(color, themeMode);
    try {
      const updated = await updateCompanyProfile(company.id, {
        theme_color: color,
        theme_mode: themeMode,
      });
      onCompanyUpdated(updated);
    } catch (e) {
      console.warn('Erro ao sincronizar cor do tema:', e);
    }
    showNotice(`Tema de cor ${color.toUpperCase()} ativado e sincronizado!`);
  };

  const handleApplyMode = async (mode: ThemeMode) => {
    setThemeMode(mode);
    saveTheme(themeColor, mode);
    try {
      const updated = await updateCompanyProfile(company.id, {
        theme_color: themeColor,
        theme_mode: mode,
      });
      onCompanyUpdated(updated);
    } catch (e) {
      console.warn('Erro ao sincronizar modo do tema:', e);
    }
    showNotice(`Modo ${mode === 'dark' ? 'Escuro' : 'Claro'} ativado e sincronizado!`);
  };

  // Exclusão
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Selecionar arquivo de logo com upload direto para Cloudinary e sincronização instantânea
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const check = validateUploadFile(file, {
      maxSizeMb: 5,
      allowedMimeTypes: IMAGE_MIME_TYPES,
    });
    if (!check.valid) {
      alert(check.error);
      return;
    }

    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (!base64) {
          setUploadingLogo(false);
          return;
        }
        try {
          // Upload para o Cloudinary (CDN de alta disponibilidade na nuvem)
          const cdnUrl = await uploadImageToCloudinary(base64, 'castello_company');
          setLogoUrl(cdnUrl);
          const updated = await updateCompanyProfile(company.id, {
            logo_url: cdnUrl,
            theme_color: themeColor,
            theme_mode: themeMode,
          });
          onCompanyUpdated(updated);
          showNotice('Logotipo atualizado e sincronizado na nuvem com sucesso!');
        } catch (uploadErr: any) {
          alert(uploadErr?.message || 'Não foi possível enviar o logotipo para a nuvem.');
        } finally {
          setUploadingLogo(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingLogo(false);
      alert('Erro ao processar ficheiro de imagem.');
    }
  };

  const handleRemoveLogo = async () => {
    setLogoUrl('');
    try {
      const updated = await updateCompanyProfile(company.id, {
        logo_url: null,
      });
      onCompanyUpdated(updated);
      showNotice('Logotipo removido com sucesso!');
    } catch (err: any) {
      alert('Erro ao remover: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome da sua empresa.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCompanyProfile(company.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        tax_id: taxId.trim() || null,
        logo_url: logoUrl || null,
        theme_color: themeColor,
        theme_mode: themeMode,
      });

      onCompanyUpdated(updated);
      showNotice('Dados da empresa salvos e sincronizados com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      alert('Digite sua senha atual.');
      return;
    }
    if (newPassword.length < 6) {
      alert('A nova senha deve ter pelo menos 6 letras ou números.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('As duas senhas novas digitadas não são iguais.');
      return;
    }

    setSavingPassword(true);
    try {
      await changeCompanyPassword(company.id, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showNotice('Senha alterada com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Falha ao alterar senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      alert('Para confirmar, digite EXCLUIR no campo indicado.');
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
    <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', letterSpacing: -0.5 }}>
          Configurações da Empresa
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>
          Altere a logo da sua firma, o nome cadastrado ou sua senha de acesso.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* BLOCO 1: LOGO E DADOS DA FIRMA */}
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <Building2 size={20} color="var(--primary)" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>
              1. Logo e Nome da Firma
            </h2>
          </div>

          <form onSubmit={handleSaveCompany}>
            {/* Escolher e Pré-visualizar Logo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '16px 20px',
                borderRadius: 10,
                backgroundColor: 'var(--bg-card-subtle)',
                marginBottom: 20,
                flexWrap: 'wrap',
              }}
            >
              {/* Círculo da Foto/Logo */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  backgroundColor: 'var(--primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  fontWeight: 800,
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid var(--border-color)',
                }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{name.charAt(0).toUpperCase() || 'C'}</span>
                )}
              </div>

              {/* Botões de Ação para a Logo */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  Logotipo da Empresa
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Esta imagem vai aparecer no topo da página e nos relatórios.
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      cursor: uploadingLogo ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '8px 16px',
                      borderRadius: 6,
                      backgroundColor: 'var(--primary)',
                      color: '#ffffff',
                      opacity: uploadingLogo ? 0.7 : 1,
                    }}
                  >
                    {uploadingLogo ? (
                      <>
                        <Loader2 size={15} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                        A carregar para a nuvem...
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        Escolher Foto do Computador
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingLogo}
                      style={{ display: 'none' }}
                      onChange={handleLogoChange}
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      className="btn-flat-secondary"
                      style={{ fontSize: 12, padding: '8px 12px', color: '#dc2626' }}
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo}
                    >
                      Remover Foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Campos de Nome e Telefone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 13, fontWeight: 700 }}>Nome da Empresa / Construtora *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Castello Construções"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ fontSize: 15, padding: '10px 14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="Ex: +351 900 000 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ padding: '10px 14px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>NIF / CNPJ Fiscal</label>
                  <input
                    type="text"
                    placeholder="Número fiscal (opcional)"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    style={{ padding: '10px 14px' }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-flat-primary"
              style={{
                width: '100%',
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Save size={18} />
              {saving ? 'Salvando...' : 'Salvar Informações da Empresa'}
            </button>
          </form>
        </div>

        {/* BLOCO 2: PERSONALIZAÇÃO DE TEMA */}
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Palette size={20} color="var(--primary)" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>
              2. Tema e Cores da Firma
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Escolha a cor principal e o modo visual do sistema. Todas as telas e botões se adaptam imediatamente.
          </p>

          {/* Seletor de Modo: Claro / Escuro */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-main)' }}>
              Modo de Visualização
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                type="button"
                onClick={() => handleApplyMode('dark')}
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: themeMode === 'dark' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: themeMode === 'dark' ? 'var(--primary-subtle)' : 'var(--bg-card-subtle)',
                  color: themeMode === 'dark' ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease',
                }}
              >
                <Moon size={18} />
                <span>Modo Escuro (Dark)</span>
                {themeMode === 'dark' && <Check size={16} />}
              </button>

              <button
                type="button"
                onClick={() => handleApplyMode('light')}
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: themeMode === 'light' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: themeMode === 'light' ? 'var(--primary-subtle)' : 'var(--bg-card-subtle)',
                  color: themeMode === 'light' ? 'var(--primary)' : 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'all 0.15s ease',
                }}
              >
                <Sun size={18} />
                <span>Modo Claro (Light)</span>
                {themeMode === 'light' && <Check size={16} />}
              </button>
            </div>
          </div>

          {/* Seletor de Cores: Azul, Vermelho, Verde, Amarelo, Laranja */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-main)' }}>
              Cor Principal da Interface (5 Temas Pré-definidos)
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 12,
              }}
            >
              {THEMES_LIST.map((t) => {
                const isSelected = themeColor === t.id;
                const activeColor = themeMode === 'dark' ? t.darkHex : t.lightHex;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleApplyColor(t.id)}
                    style={{
                      padding: '14px 10px',
                      borderRadius: 10,
                      border: isSelected ? `2px solid ${activeColor}` : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-card-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: activeColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        boxShadow: isSelected ? `0 0 12px ${activeColor}80` : 'none',
                      }}
                    >
                      {isSelected && <Check size={16} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {t.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* BLOCO 3: MUDAR SENHA */}
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <KeyRound size={20} color="var(--primary)" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>
              3. Alterar sua Senha de Acesso
            </h2>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Seu e-mail de acesso é: <strong>{company.owner_email}</strong>
          </div>

          <form onSubmit={handleChangePassword}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
              <div className="flat-form-group">
                <label style={{ fontSize: 13, fontWeight: 700 }}>Senha Atual</label>
                <input
                  type="password"
                  required
                  placeholder="Digite a senha que você usa hoje"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ padding: '10px 14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="flat-form-group">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Nova Senha</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo de 6 letras ou números"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ padding: '10px 14px' }}
                  />
                </div>

                <div className="flat-form-group">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Confirmar Nova Senha</label>
                  <input
                    type="password"
                    required
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ padding: '10px 14px' }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="btn-flat-secondary"
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Lock size={16} />
              {savingPassword ? 'Alterando senha...' : 'Atualizar Minha Senha'}
            </button>
          </form>
        </div>

        {/* BLOCO 3: EXCLUIR CONTA */}
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid #fecaca',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
              Excluir Conta da Empresa
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Apaga permanentemente os dados, obras e registros desta firma.
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteModalOpen(true);
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #dc2626',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={16} />
            Excluir Conta
          </button>
        </div>
      </div>

      {/* Documentos Legais Públicos */}
      <div
        className="content-panel"
        style={{
          padding: 20,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>
            Documentos Legais Públicos
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Consulte a Política de Privacidade (RGPD / LGPD) e os Termos de Serviço oficiais da plataforma Castello.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="/privacidade"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/privacidade');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="btn-flat-secondary"
            style={{ textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Política de Privacidade
          </a>
          <a
            href="/termos"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/termos');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="btn-flat-secondary"
            style={{ textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
          >
            Termos de Serviço
          </a>
        </div>
      </div>

      {/* Modal de Confirmação */}
      {deleteModalOpen && (
        <div className="flat-modal-backdrop">
          <div className="flat-modal-box" style={{ maxWidth: 420 }}>
            <div className="flat-modal-header">
              <h3 className="flat-modal-title" style={{ color: '#dc2626' }}>
                Tem certeza que deseja excluir?
              </h3>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              Essa ação não pode ser desfeita. Para confirmar a exclusão da conta de <strong>{company.name}</strong>, digite a palavra <strong>EXCLUIR</strong>:
            </p>

            <div style={{ marginTop: 14, marginBottom: 18 }}>
              <input
                type="text"
                autoFocus
                placeholder="Digite EXCLUIR"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontWeight: 700,
                  borderColor: '#dc2626',
                  padding: '10px',
                  borderRadius: 6,
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
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 16px',
                  borderRadius: 6,
                  fontWeight: 700,
                  cursor: deleteConfirmText.trim().toUpperCase() === 'EXCLUIR' ? 'pointer' : 'not-allowed',
                  opacity: deleteConfirmText.trim().toUpperCase() === 'EXCLUIR' ? 1 : 0.5,
                }}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
