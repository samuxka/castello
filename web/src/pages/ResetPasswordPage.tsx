import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Send,
} from 'lucide-react';
import {
  requestPasswordReset,
  supabase,
  updateAccountPassword,
} from '../lib/supabase';

interface ResetPasswordPageProps {
  initialMode?: 'request' | 'update';
  initialEmail?: string;
  onBackToLogin: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  initialMode = 'request',
  initialEmail = '',
  onBackToLogin,
}) => {
  const [mode, setMode] = useState<'request' | 'update'>(initialMode);
  const [email, setEmail] = useState(() => {
    if (initialEmail) return initialEmail;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || '';
    }
    return '';
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const { data: listener } =
      supabase?.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setMode('update');
          setErrorMsg(null);
        }
      }) || { data: { subscription: null } };

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleRequestResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Por favor, introduza um endereço de e-mail válido.');
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(cleanEmail);
      setEmailSent(true);
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Não foi possível enviar o e-mail de recuperação. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('As senhas introduzidas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await updateAccountPassword(newPassword);
      setPasswordUpdated(true);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'O link de recuperação expirou ou é inválido. Solicite um novo link de redefinição.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        backgroundColor: '#010106',
        backgroundImage: `
          radial-gradient(ellipse 90% 70% at 50% -20%, rgba(1, 15, 107, 0.55) 0%, transparent 60%),
          radial-gradient(ellipse 70% 60% at 100% 100%, rgba(0, 21, 212, 0.35) 0%, transparent 50%),
          radial-gradient(ellipse 70% 60% at 0% 100%, rgba(92, 127, 251, 0.25) 0%, transparent 50%),
          linear-gradient(180deg, #010106 0%, #111525 100%)
        `,
        fontFamily: `'Outfit', sans-serif`,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          borderRadius: '28px',
          backgroundColor: '#ffffff',
          boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          padding: '40px 42px',
          zIndex: 10,
        }}
      >
        {/* Marca Castello */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '26px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img
              src="/logo.webp"
              alt="Castello"
              width={36}
              height={36}
              style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '8px' }}
            />
            <span
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.3px',
              }}
            >
              Castello
            </span>
          </div>

          <button
            type="button"
            onClick={onBackToLogin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ArrowLeft size={15} />
            <span>Voltar ao Login</span>
          </button>
        </div>

        {/* ================================================================ */}
        {/* MODO 1: SOLICITAR LINK DE REDEFINIÇÃO POR E-MAIL                 */}
        {/* ================================================================ */}
        {mode === 'request' && !emailSent && (
          <>
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  marginBottom: '16px',
                }}
              >
                <KeyRound size={24} />
              </div>

              <h1
                style={{
                  fontSize: '26px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontFamily: `'Outfit', sans-serif`,
                  margin: '0 0 8px',
                }}
              >
                Esqueceu a sua senha?
              </h1>
              <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: 1.55 }}>
                Introduza o e-mail associado à conta da sua firma. Enviaremos um link seguro para
                redefinir a sua senha.
              </p>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#dc2626',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  marginBottom: '16px',
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRequestResetLink} noValidate>
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  E-mail da Conta
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={16}
                    color="#94a3b8"
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="exemplo@empresa.pt"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 40px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#09090b',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: loading ? 0.75 : 1,
                }}
              >
                <Send size={15} />
                <span>{loading ? 'A enviar link...' : 'Enviar Link de Redefinição'}</span>
              </button>
            </form>
          </>
        )}

        {/* ================================================================ */}
        {/* MODO 1 (CONFIRMAÇÃO): E-MAIL ENVIADO COM SUCESSO                 */}
        {/* ================================================================ */}
        {mode === 'request' && emailSent && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 16px',
                borderRadius: '18px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16a34a',
              }}
            >
              <CheckCircle2 size={28} />
            </div>

            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#0f172a',
                fontFamily: `'Outfit', sans-serif`,
                margin: '0 0 10px',
              }}
            >
              Verifique o seu E-mail
            </h2>
            <p
              style={{
                fontSize: '13.5px',
                color: '#475569',
                lineHeight: 1.6,
                margin: '0 0 22px',
              }}
            >
              Enviámos um link de redefinição de senha para{' '}
              <strong style={{ color: '#0f172a' }}>{email.trim().toLowerCase()}</strong>. Clique no
              link recebido no seu e-mail (verifique também a pasta de Spam) para escolher a sua
              nova senha.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={onBackToLogin}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#09090b',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Voltar para o Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmailSent(false);
                  setErrorMsg(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                }}
              >
                Não recebeu? Tentar outro e-mail ou reenviar
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* MODO 2: DEFINIR NOVA SENHA (APÓS CLICAR NO LINK DO E-MAIL)       */}
        {/* ================================================================ */}
        {mode === 'update' && !passwordUpdated && (
          <>
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  marginBottom: '16px',
                }}
              >
                <Lock size={24} />
              </div>

              <h1
                style={{
                  fontSize: '26px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontFamily: `'Outfit', sans-serif`,
                  margin: '0 0 8px',
                }}
              >
                Criar Nova Senha
              </h1>
              <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: 1.55 }}>
                Escolha uma nova senha segura (mínimo de 6 caracteres) para aceder à conta da sua
                firma no Castello.
              </p>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#dc2626',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  marginBottom: '16px',
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} noValidate>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Nova Senha *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 40px 12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Confirmar Nova Senha *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 40px 12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  borderRadius: '10px',
                  backgroundColor: '#09090b',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading ? 'A guardar nova senha...' : 'Guardar Nova Senha'}
              </button>
            </form>
          </>
        )}

        {/* ================================================================ */}
        {/* MODO 2 (CONFIRMAÇÃO): SENHA ALTERADA COM SUCESSO                 */}
        {/* ================================================================ */}
        {mode === 'update' && passwordUpdated && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 16px',
                borderRadius: '18px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16a34a',
              }}
            >
              <CheckCircle2 size={28} />
            </div>

            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#0f172a',
                fontFamily: `'Outfit', sans-serif`,
                margin: '0 0 10px',
              }}
            >
              Senha Alterada com Sucesso!
            </h2>
            <p
              style={{
                fontSize: '13.5px',
                color: '#475569',
                lineHeight: 1.6,
                margin: '0 0 22px',
              }}
            >
              A sua nova senha já está ativa. Pode agora aceder ao painel da sua firma.
            </p>

            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: '10px',
                backgroundColor: '#09090b',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Aceder ao Sistema
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
