import React, { useState } from 'react';
import { Building2, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import { loginCompany, loginWithGoogle, registerCompany } from '../lib/supabase';
import { Company } from '../types';
import { loginSchema, registerSchema, validateWithZod } from '../lib/validation';

interface AuthModalProps {
  onSuccess: (company: Company) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar com o Google.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    if (mode === 'login') {
      const val = validateWithZod(loginSchema, { email, password, rememberMe });
      if (!val.success) {
        setFieldErrors(val.fieldErrors);
        setErrorMsg(val.error);
        return;
      }

      setLoading(true);
      try {
        const logged = await loginCompany(val.data.email, val.data.password);
        onSuccess(logged);
      } catch (err: any) {
        setErrorMsg(err.message || 'Falha na autenticação da firma.');
      } finally {
        setLoading(false);
      }
    } else {
      const val = validateWithZod(registerSchema, {
        companyName,
        email,
        password,
        phone,
        taxId,
      });
      if (!val.success) {
        setFieldErrors(val.fieldErrors);
        setErrorMsg(val.error);
        return;
      }

      setLoading(true);
      try {
        const created = await registerCompany(
          val.data.companyName,
          val.data.email,
          val.data.password,
          val.data.phone || '',
          val.data.taxId || ''
        );
        onSuccess(created);
      } catch (err: any) {
        setErrorMsg(err.message || 'Falha no registo da firma.');
      } finally {
        setLoading(false);
      }
    }
  };

  const isSignup = mode === 'signup';

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
        backgroundColor: '#07090e',
        backgroundImage: `
          radial-gradient(ellipse 90% 70% at 50% -20%, rgba(120, 28, 140, 0.35) 0%, transparent 60%),
          radial-gradient(ellipse 70% 60% at 100% 100%, rgba(220, 38, 90, 0.28) 0%, transparent 50%),
          radial-gradient(ellipse 70% 60% at 0% 100%, rgba(37, 99, 235, 0.25) 0%, transparent 50%),
          linear-gradient(180deg, #07090e 0%, #0d1117 100%)
        `,
        overflowY: 'auto',
      }}
    >
      {/* Decorative luminous wave lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.35,
          background: `
            radial-gradient(circle at 85% 15%, rgba(236, 72, 153, 0.4) 0%, transparent 45%),
            radial-gradient(circle at 10% 85%, rgba(59, 130, 246, 0.4) 0%, transparent 50%)
          `,
          filter: 'blur(60px)',
        }}
      />

      {/* Main Card Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1020px',
          minHeight: '620px',
          borderRadius: '32px',
          overflow: 'hidden',
          backgroundColor: '#0a0d14',
          boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexWrap: 'wrap',
        }}
      >
        {/* PANEL 1: Image Panel (Building skyscraper photo) */}
        <div
          style={{
            position: 'relative',
            width: '50%',
            minHeight: '620px',
            transform: isSignup ? 'translateX(100%)' : 'translateX(0%)',
            transition: 'transform 0.65s cubic-bezier(0.65, 0, 0.35, 1)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '48px 44px',
            overflow: 'hidden',
          }}
          className="auth-image-panel"
        >
          {/* High-res Modern Architectural Building Image Background */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1400&auto=format&fit=crop')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'brightness(0.9) contrast(1.1)',
            }}
          />

          {/* Neon atmospheric glow over the building photo */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                linear-gradient(180deg, rgba(10, 15, 28, 0.45) 0%, rgba(10, 14, 25, 0.88) 100%),
                radial-gradient(circle at 100% 0%, rgba(236, 72, 153, 0.3) 0%, transparent 60%),
                radial-gradient(circle at 0% 100%, rgba(37, 99, 235, 0.35) 0%, transparent 60%)
              `,
            }}
          />

          {/* Top Quote Tag */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span
                style={{
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                }}
              >
                A WISE QUOTE
              </span>
              <div
                style={{
                  height: '1px',
                  width: '56px',
                  backgroundColor: 'rgba(255, 255, 255, 0.35)',
                }}
              />
            </div>
          </div>

          {/* Bottom Dramatic Quote Typography */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h1
              style={{
                color: '#ffffff',
                fontSize: '44px',
                lineHeight: '1.15',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                fontFamily: `'Playfair Display', Georgia, serif`,
                marginBottom: '18px',
                textShadow: '0 4px 20px rgba(0,0,0,0.6)',
              }}
            >
              Get Everything
              <br />
              You Want
            </h1>
            <p
              style={{
                color: 'rgba(255, 255, 255, 0.82)',
                fontSize: '13.5px',
                lineHeight: '1.6',
                maxWidth: '380px',
                fontWeight: 400,
              }}
            >
              You can get everything you want if you work hard, trust the process, and stick to the
              plan. Construa o futuro com precisão.
            </p>
          </div>
        </div>

        {/* PANEL 2: Form Panel (Crisp White Card) */}
        <div
          style={{
            position: 'relative',
            width: '50%',
            minHeight: '620px',
            backgroundColor: '#ffffff',
            transform: isSignup ? 'translateX(-100%)' : 'translateX(0%)',
            transition: 'transform 0.65s cubic-bezier(0.65, 0, 0.35, 1)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '44px 50px',
            overflowY: 'auto',
          }}
          className="auth-form-panel"
        >
          {/* Top Brand Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSignup ? 'flex-start' : 'flex-end',
              gap: '8px',
              marginBottom: '20px',
              transition: 'justify-content 0.3s ease',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/logo.png"
                alt="Castello"
                style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
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

          {/* Form Header */}
          <div style={{ marginBottom: '22px' }}>
            <h2
              style={{
                fontSize: '32px',
                fontWeight: 700,
                color: '#0f172a',
                fontFamily: `'Playfair Display', Georgia, serif`,
                letterSpacing: '-0.5px',
                marginBottom: '6px',
              }}
            >
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              {isSignup
                ? 'Enter your details to register your construction firm'
                : 'Enter your email and password to access your account'}
            </p>
          </div>

          {/* Global Error Banner */}
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>{errorMsg}</span>
            </div>
          )}

          {/* The Form */}
          <form onSubmit={handleSubmit} noValidate>
            {isSignup && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      border: `1px solid ${fieldErrors.companyName ? '#ef4444' : '#e2e8f0'}`,
                      backgroundColor: '#f8fafc',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#0f172a')}
                    onBlur={(e) =>
                      (e.target.style.borderColor = fieldErrors.companyName ? '#ef4444' : '#e2e8f0')
                    }
                  />
                  {fieldErrors.companyName && (
                    <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                      {fieldErrors.companyName}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      Phone (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="+351 912 345 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        fontSize: '13px',
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '6px',
                      }}
                    >
                      NIF / Tax ID
                    </label>
                    <input
                      type="text"
                      placeholder="509 123 456"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        fontSize: '13px',
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Field */}
            <div style={{ marginBottom: '14px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Email
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${fieldErrors.email ? '#ef4444' : '#e2e8f0'}`,
                  backgroundColor: '#f8fafc',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#0f172a')}
                onBlur={(e) =>
                  (e.target.style.borderColor = fieldErrors.email ? '#ef4444' : '#e2e8f0')
                }
              />
              {fieldErrors.email && (
                <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: '14px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${fieldErrors.password ? '#ef4444' : '#e2e8f0'}`,
                    backgroundColor: '#f8fafc',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#0f172a')}
                  onBlur={(e) =>
                    (e.target.style.borderColor = fieldErrors.password ? '#ef4444' : '#e2e8f0')
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && (
                <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', display: 'block' }}>
                  {fieldErrors.password}
                </span>
              )}
            </div>

            {/* Remember me & Forgot Password */}
            {!isSignup && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '18px',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12.5px',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      width: '15px',
                      height: '15px',
                      borderRadius: '4px',
                      accentColor: '#0f172a',
                      cursor: 'pointer',
                    }}
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  onClick={() =>
                    alert(
                      'Para repor a sua palavra-passe, contacte o suporte técnico ou o administrador do sistema.'
                    )
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12.5px',
                    color: '#0f172a',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot Password
                </button>
              </div>
            )}

            {/* Solid Dark Primary Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
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
                marginBottom: '12px',
                transition: 'background-color 0.2s, transform 0.1s',
                opacity: loading ? 0.75 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget.style.backgroundColor = '#18181b');
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget.style.backgroundColor = '#09090b');
              }}
            >
              {loading
                ? 'Processing...'
                : isSignup
                ? 'Sign Up'
                : 'Sign In'}
            </button>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 500,
                border: '1px solid #e2e8f0',
                cursor: googleLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '20px',
                transition: 'background-color 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              {/* Official Google G Logo SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{isSignup ? 'Sign Up with Google' : 'Sign In with Google'}</span>
            </button>
          </form>

          {/* Footer toggle mode */}
          <div style={{ textAlign: 'center', marginTop: 'auto' }}>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'login' : 'signup');
                setErrorMsg(null);
                setFieldErrors({});
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Style for Mobile Screens */}
      <style>{`
        @media (max-width: 768px) {
          .auth-image-panel {
            display: none !important;
          }
          .auth-form-panel {
            width: 100% !important;
            transform: none !important;
            padding: 32px 24px !important;
          }
        }
      `}</style>
    </div>
  );
};
