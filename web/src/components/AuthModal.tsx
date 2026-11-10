import React, { useState } from 'react';
import { Building2, CheckCircle2, Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import { loginCompany, registerCompany } from '../lib/supabase';
import { Company } from '../types';

interface AuthModalProps {
  onSuccess: (company: Company) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!companyName.trim() || !email.trim() || !password.trim()) {
          throw new Error('Preencha os campos obrigatórios da firma.');
        }
        const created = await registerCompany(
          companyName,
          email,
          password,
          phone,
          taxId
        );
        onSuccess(created);
      } else {
        if (!email.trim() || !password.trim()) {
          throw new Error('Informe o e-mail e a senha de acesso da firma.');
        }
        const logged = await loginCompany(email, password);
        onSuccess(logged);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na autenticação da firma.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flat-modal-backdrop" style={{ zIndex: 999 }}>
      <div className="flat-modal-box" style={{ maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            className="brand-logo-flat"
            style={{ margin: '0 auto 12px auto', width: 44, height: 44, fontSize: 22 }}
          >
            C
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
            castello
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {mode === 'login'
              ? 'Acesso exclusivo para Gestores e Patrões de Firma'
              : 'Registo de Nova Firma no Castello'}
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              borderRadius: 6,
              color: 'var(--danger)',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="flat-form-group">
                <label>Nome da Firma / Empresa *</label>
                <input
                  required
                  placeholder="Ex: Engenharia & Obras Silva Lda"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="flat-form-group">
                <label>NIF / CNPJ (Opcional)</label>
                <input
                  placeholder="Ex: 509 123 456"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />
              </div>

              <div className="flat-form-group">
                <label>Contacto Telefónico</label>
                <input
                  placeholder="+351 21 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flat-form-group">
            <label>E-mail do Patrão / Gestor *</label>
            <input
              required
              type="email"
              placeholder="admin@suafirma.pt"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flat-form-group">
            <label>Senha de Acesso *</label>
            <input
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-flat-primary"
            style={{ width: '100%', justifyContent: 'center', padding: 12, marginTop: 10 }}
            disabled={loading}
          >
            {loading
              ? 'A processar...'
              : mode === 'login'
              ? 'Entrar no Painel da Firma'
              : 'Criar Conta da Firma'}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center',
          }}
        >
          {mode === 'login' ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Ainda não tem conta para a sua firma?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Registar Nova Firma
              </button>
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Já tem conta de firma registada?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Fazer Login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

