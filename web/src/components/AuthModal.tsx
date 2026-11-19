import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import {
  checkEmailVerificationStatus,
  getCompanyByEmail,
  loginCompany,
  loginWithGoogle,
  registerCompany,
  resendVerificationEmail,
  updateCompanyProfile,
  verifyRegistrationCode,
} from '../lib/supabase';
import { Company } from '../types';
import { loginSchema, registerSchema, validateWithZod } from '../lib/validation';

interface AuthModalProps {
  onSuccess: (company: Company) => void;
}

type AuthStage = 'auth' | 'code-verification' | 'onboarding' | 'terms';

interface OnboardingOption {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface OnboardingStep {
  id: string;
  field: 'industry' | 'years_active' | 'team_size' | 'active_sites_count' | 'primary_goal';
  title: string;
  subtitle: string;
  options: OnboardingOption[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'step-industry',
    field: 'industry',
    title: 'Qual é a principal área de atuação da sua firma?',
    subtitle: 'Selecione a categoria que melhor descreve os projetos e obras da sua empresa.',
    options: [
      {
        id: 'residencial',
        icon: '🏗️',
        title: 'Construção Residencial',
        description: 'Habitação unifamiliar, moradias, edifícios e condomínios residenciais.',
      },
      {
        id: 'comercial_industrial',
        icon: '🏢',
        title: 'Obras Comerciais & Industriais',
        description: 'Escritórios, lojas, armazéns logísticos e pavilhões industriais.',
      },
      {
        id: 'remodelacao_restauro',
        icon: '🔨',
        title: 'Remodelação & Reabilitação',
        description: 'Renovações de interiores, reabilitação urbana e restauro de património.',
      },
      {
        id: 'infraestruturas',
        icon: '🛣️',
        title: 'Infraestruturas & Terraplanagens',
        description: 'Redes de águas, saneamento, loteamentos e pavimentação viária.',
      },
      {
        id: 'acabamentos',
        icon: '🎨',
        title: 'Acabamentos & Pinturas',
        description: 'Gesso cartonado (pladur), isolamentos, revestimentos e pintura geral.',
      },
      {
        id: 'instalacoes_tecnicas',
        icon: '⚡',
        title: 'Instalações Técnicas (MEP)',
        description: 'Eletricidade, canalização, AVAC e soluções de energia solar.',
      },
    ],
  },
  {
    id: 'step-years',
    field: 'years_active',
    title: 'Há quantos anos a firma atua no mercado?',
    subtitle: 'Isto ajuda-nos a calibrar as métricas e relatórios financeiros da sua organização.',
    options: [
      {
        id: 'menos_1_ano',
        icon: '🚀',
        title: 'Menos de 1 ano',
        description: 'Firma recente ou em arranque acelerado de atividade.',
      },
      {
        id: '1_a_3_anos',
        icon: '📈',
        title: '1 a 3 anos',
        description: 'Empresa em crescimento com portfólio em expansão.',
      },
      {
        id: '4_a_10_anos',
        icon: '🏛️',
        title: '4 a 10 anos',
        description: 'Firma sólida, estabelecida e com carteira estável de clientes.',
      },
      {
        id: 'mais_10_anos',
        icon: '🏆',
        title: 'Mais de 10 anos',
        description: 'Empresa com vasta tradição, reconhecimento e reputação no setor.',
      },
    ],
  },
  {
    id: 'step-team',
    field: 'team_size',
    title: 'Quantos funcionários e colaboradores tem a firma?',
    subtitle: 'Poderá adicionar colaboradores e configurar as respetivas equipas a qualquer momento.',
    options: [
      {
        id: '1_a_5',
        icon: '👤',
        title: '1 a 5 colaboradores',
        description: 'Estrutura compacta com comunicação direta e ágil.',
      },
      {
        id: '6_a_15',
        icon: '👥',
        title: '6 a 15 colaboradores',
        description: 'Equipas organizadas com encarregados ou mestres de obra.',
      },
      {
        id: '16_a_50',
        icon: '👷',
        title: '16 a 50 colaboradores',
        description: 'Várias equipas a operar em simultâneo em diferentes locais.',
      },
      {
        id: 'mais_50',
        icon: '🏢',
        title: 'Mais de 50 colaboradores',
        description: 'Grande operação com múltiplos departamentos e liderança hierarquizada.',
      },
    ],
  },
  {
    id: 'step-sites',
    field: 'active_sites_count',
    title: 'Quantas obras ou frentes ativas gerem em simultâneo?',
    subtitle: 'O Castello adapta a visualização do dashboard à dimensão das suas operações.',
    options: [
      {
        id: '1_a_2',
        icon: '📍',
        title: '1 a 2 obras em simultâneo',
        description: 'Foco intensivo e acompanhamento próximo em cada projeto.',
      },
      {
        id: '3_a_5',
        icon: '🏗️',
        title: '3 a 5 obras em simultâneo',
        description: 'Volume regular com rotação planeada de trabalhadores e carrinhas.',
      },
      {
        id: '6_a_10',
        icon: '🏙️',
        title: '6 a 10 obras em simultâneo',
        description: 'Gestão multi-obra que exige controlo rigoroso de horas e custos.',
      },
      {
        id: 'mais_10',
        icon: '🌐',
        title: 'Mais de 10 obras em paralelo',
        description: 'Operação de alta cadência com necessidade de automação de processos.',
      },
    ],
  },
  {
    id: 'step-goal',
    field: 'primary_goal',
    title: 'Qual é o principal desafio que quer resolver no Castello?',
    subtitle: 'Vamos destacar os módulos e ferramentas mais relevantes para a sua firma.',
    options: [
      {
        id: 'ponto_e_presencas',
        icon: '⏱️',
        title: 'Registo e Validação de Ponto',
        description: 'Controlo rigoroso de horas, presenças no terreno e horas extraordinárias.',
      },
      {
        id: 'controlo_financeiro',
        icon: '💶',
        title: 'Custos, Margens & Rentabilidade',
        description: 'Evitar desvios de orçamento e monitorizar a margem real de cada obra.',
      },
      {
        id: 'tarefas_e_diarios',
        icon: '📋',
        title: 'Tarefas, Fotos & Diários de Obra',
        description: 'Acompanhar o avanço diário dos serviços com fotos e validação digital.',
      },
      {
        id: 'carrinhas_e_materiais',
        icon: '🚐',
        title: 'Frotas, Carrinhas & Inventário',
        description: 'Gestão de carrinhas, manutenção, ferramentas e materiais em circulação.',
      },
    ],
  },
];

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [stage, setAuthStage] = useState<AuthStage>('auth');
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

  // Pending company state after initial registration
  const [pendingCompany, setPendingCompany] = useState<Company | null>(null);

  // OTP 6-Digit Code State
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(45);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Multi-step Onboarding State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState<Record<string, string>>({
    industry: '',
    years_active: '',
    team_size: '',
    active_sites_count: '',
    primary_goal: '',
  });

  // Terms and Privacy State
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  // Temporizador para reenvio do código
  useEffect(() => {
    if (stage !== 'code-verification') return;
    if (resendTimer <= 0) return;

    const timer = setInterval(() => {
      setResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, resendTimer]);

  // Foco automático no primeiro campo quando entra na tela de código
  useEffect(() => {
    if (stage === 'code-verification') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [stage]);

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
      // 1. Registo de Conta: Dispara o registo e envio de código
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
        // Guarda a firma pendente e avança para a tela de introdução do código!
        setPendingCompany(created);
        setOtpDigits(['', '', '', '', '', '']);
        setCodeError(null);
        setCodeSuccess(false);
        setResendTimer(45);
        setAuthStage('code-verification');
      } catch (err: any) {
        setErrorMsg(err.message || 'Falha no registo da firma.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Gerenciamento dos 6 dígitos de OTP
  const handleOtpChange = (index: number, value: string) => {
    setCodeError(null);

    // Se o utilizador colar uma string com múltiplos caracteres (ex: "123456")
    const cleanedDigits = value.replace(/\D/g, '');
    if (cleanedDigits.length > 1) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = cleanedDigits[i] || '';
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(cleanedDigits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      if (cleanedDigits.length >= 6) {
        executeVerifyCode(newDigits.join(''));
      }
      return;
    }

    const singleDigit = cleanedDigits.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = singleDigit;
    setOtpDigits(newDigits);

    // Se digitou um número, salta para o próximo campo
    if (singleDigit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Se preencheu os 6 dígitos, dispara a validação automaticamente
    if (singleDigit && index === 5 && newDigits.every((d) => d !== '')) {
      executeVerifyCode(newDigits.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[nextIndex]?.focus();

    if (pastedData.length === 6) {
      executeVerifyCode(pastedData);
    }
  };

  // Executa verificação do código digitado
  const executeVerifyCode = async (codeToVerify?: string) => {
    const fullCode = codeToVerify || otpDigits.join('');
    const targetEmail = pendingCompany?.owner_email || email;

    if (fullCode.length !== 6) {
      setCodeError('Por favor introduza o código completo de 6 dígitos.');
      return;
    }

    setVerifyingCode(true);
    setCodeError(null);

    try {
      const result = await verifyRegistrationCode(targetEmail, fullCode);
      if (result.success) {
        setCodeSuccess(true);
        setTimeout(() => {
          // Conta verificada com sucesso! Avança para o formulário multistep
          setAuthStage('onboarding');
        }, 600);
      } else {
        setCodeError(result.error || 'Código incorreto. Tente novamente.');
      }
    } catch (err: any) {
      setCodeError(err.message || 'Falha ao validar o código.');
    } finally {
      setVerifyingCode(false);
    }
  };

  // Reenviar código
  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    const targetEmail = pendingCompany?.owner_email || email;

    setResendNotice('A enviar novo código...');
    try {
      await resendVerificationEmail(targetEmail);
      setResendTimer(45);
      setResendNotice('✓ Novo código de 6 dígitos enviado para o seu e-mail!');
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
      setTimeout(() => setResendNotice(null), 4000);
    } catch (err: any) {
      setResendNotice('Aviso: ' + (err.message || 'Aguarde antes de reenviar novo código.'));
    }
  };

  // Multi-step Onboarding
  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const selectedOptionForCurrentStep = onboardingAnswers[currentStep?.field];

  const handleSelectOption = (optionId: string) => {
    setOnboardingAnswers((prev) => ({
      ...prev,
      [currentStep.field]: optionId,
    }));
  };

  const handleNextStep = () => {
    if (!selectedOptionForCurrentStep) return;
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setAuthStage('terms');
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Finalização dos Termos de Uso e Entrada no Sistema
  const handleCompleteRegistration = async () => {
    if (!acceptTerms || !acceptPrivacy) return;
    setSavingOnboarding(true);

    try {
      let finalCompany = pendingCompany;
      if (pendingCompany?.id) {
        finalCompany = await updateCompanyProfile(pendingCompany.id, {
          industry: onboardingAnswers.industry,
          years_active: onboardingAnswers.years_active,
          team_size: onboardingAnswers.team_size,
          active_sites_count: onboardingAnswers.active_sites_count,
          primary_goal: onboardingAnswers.primary_goal,
          terms_accepted_at: new Date().toISOString(),
          email_verified_at: new Date().toISOString(),
        });
      }
      if (finalCompany) {
        onSuccess(finalCompany);
      }
    } catch (err) {
      console.warn('Aviso ao guardar dados do questionário:', err);
      if (pendingCompany) {
        onSuccess(pendingCompany);
      }
    } finally {
      setSavingOnboarding(false);
    }
  };

  const isSignup = mode === 'signup';
  const isFullCodeEntered = otpDigits.every((d) => d !== '');

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

      {/* ==================================================================== */}
      {/* ESTÁGIO 1: FORMULÁRIO DE CADASTRO / LOGIN COM ANIMAÇÃO SLIDING       */}
      {/* ==================================================================== */}
      {stage === 'auth' && (
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
                      }}
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
                  }}
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
                    }}
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
                      alert('Contacte o suporte técnico ou administrador para repor a sua senha.')
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

              {/* Submit Button */}
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
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading ? 'A processar...' : isSignup ? 'Sign Up' : 'Sign In'}
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
                }}
              >
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
      )}

      {/* ==================================================================== */}
      {/* ESTÁGIO 2: TELA DE CÓDIGO (USUÁRIO DIGITA O CÓDIGO DE 6 DÍGITOS)     */}
      {/* ==================================================================== */}
      {stage === 'code-verification' && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '560px',
            borderRadius: '28px',
            backgroundColor: '#ffffff',
            boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            padding: '48px 40px',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          {/* Key / Shield Icon */}
          <div
            style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 20px auto',
              borderRadius: '24px',
              backgroundColor: '#eff6ff',
              border: '2px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              boxShadow: '0 12px 30px -8px rgba(37, 99, 235, 0.3)',
            }}
          >
            <KeyRound size={38} />
          </div>

          <h2
            style={{
              fontSize: '26px',
              fontWeight: 700,
              color: '#0f172a',
              fontFamily: `'Playfair Display', Georgia, serif`,
              marginBottom: '8px',
            }}
          >
            Introduza o Código de Verificação
          </h2>

          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, marginBottom: '18px' }}>
            Enviámos um código numérico de <strong>6 dígitos</strong> para o e-mail:
          </p>

          {/* Email badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '12px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '13.5px',
              marginBottom: '30px',
            }}
          >
            <Mail size={15} color="#2563eb" />
            <span>{pendingCompany?.owner_email || email}</span>
          </div>

          {/* 6 Individual Digit Boxes */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '24px',
            }}
            onPaste={handleOtpPaste}
          >
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (otpInputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                style={{
                  width: '52px',
                  height: '60px',
                  borderRadius: '14px',
                  border: `2px solid ${
                    codeError
                      ? '#ef4444'
                      : digit
                      ? '#2563eb'
                      : '#cbd5e1'
                  }`,
                  backgroundColor: digit ? '#f0f7ff' : '#f8fafc',
                  textAlign: 'center',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#0f172a',
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: digit ? '0 4px 12px -2px rgba(37, 99, 235, 0.2)' : 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.backgroundColor = '#f0f7ff';
                }}
                onBlur={(e) => {
                  if (!digit && !codeError) {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.backgroundColor = '#f8fafc';
                  }
                }}
              />
            ))}
          </div>

          {/* Feedback Messages */}
          {codeError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '12.5px',
                fontWeight: 500,
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              {codeError}
            </div>
          )}

          {codeSuccess && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={18} color="#22c55e" />
              <span>Código validado com sucesso! A carregar questionário...</span>
            </div>
          )}

          {/* Action Button: "Verificar Código" */}
          <button
            type="button"
            onClick={() => executeVerifyCode()}
            disabled={!isFullCodeEntered || verifyingCode}
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: '12px',
              backgroundColor: isFullCodeEntered ? '#09090b' : '#f1f5f9',
              color: isFullCodeEntered ? '#ffffff' : '#94a3b8',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: isFullCodeEntered && !verifyingCode ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '20px',
              transition: 'all 0.2s',
              boxShadow: isFullCodeEntered ? '0 8px 24px -6px rgba(0,0,0,0.4)' : 'none',
            }}
          >
            {verifyingCode ? (
              <>
                <RefreshCw size={17} className="spin-slow" />
                <span>A validar código...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={18} color={isFullCodeEntered ? '#22c55e' : '#94a3b8'} />
                <span>Verificar Código</span>
              </>
            )}
          </button>

          {/* Resend and Edit Email Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9',
              fontSize: '12.5px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setAuthStage('auth');
                setMode('signup');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
              }}
            >
              <ArrowLeft size={14} />
              <span>Alterar e-mail</span>
            </button>

            <div>
              {resendTimer > 0 ? (
                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} />
                  <span>Reenviar código em {resendTimer}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Reenviar código agora
                </button>
              )}
            </div>
          </div>

          {resendNotice && (
            <p
              style={{
                fontSize: '12px',
                color: resendNotice.startsWith('✓') ? '#16a34a' : '#d97706',
                marginTop: '12px',
                fontWeight: 500,
              }}
            >
              {resendNotice}
            </p>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ESTÁGIO 3: FORMULÁRIO MULTI-STEP PARA CONHECER A FIRMA (DE MARCAR)   */}
      {/* ==================================================================== */}
      {stage === 'onboarding' && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '820px',
            borderRadius: '28px',
            backgroundColor: '#ffffff',
            boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            padding: '40px 44px',
            zIndex: 10,
            overflowY: 'auto',
            maxHeight: '90vh',
          }}
        >
          {/* Header & Step Tracker */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: '#2563eb',
                }}
              >
                Conhecer a Sua Firma • Passo {currentStepIndex + 1} de {ONBOARDING_STEPS.length}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                {Math.round(((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100)}% Concluído
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div
              style={{
                height: '6px',
                width: '100%',
                borderRadius: '999px',
                backgroundColor: '#e2e8f0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100}%`,
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* Question Title & Subtitle */}
          <div style={{ marginBottom: '28px' }}>
            <h2
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: '#0f172a',
                fontFamily: `'Playfair Display', Georgia, serif`,
                lineHeight: 1.25,
                marginBottom: '8px',
              }}
            >
              {currentStep.title}
            </h2>
            <p style={{ fontSize: '13.5px', color: '#64748b' }}>{currentStep.subtitle}</p>
          </div>

          {/* Grid of Selectable Options (Todas de Marcar) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '14px',
              marginBottom: '32px',
            }}
          >
            {currentStep.options.map((option) => {
              const isSelected = selectedOptionForCurrentStep === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '16px',
                    border: `2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#f0f7ff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    boxShadow: isSelected
                      ? '0 8px 20px -6px rgba(37, 99, 235, 0.25)'
                      : 'none',
                    transform: isSelected ? 'translateY(-2px)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }
                  }}
                >
                  <span style={{ fontSize: '24px', lineHeight: 1 }}>{option.icon}</span>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 700,
                        color: isSelected ? '#1e3a8a' : '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      {option.title}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.45 }}>
                      {option.description}
                    </div>
                  </div>

                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: isSelected ? '#2563eb' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '2px',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                    }}
                  >
                    {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step Navigation Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '20px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: currentStepIndex === 0 ? '#cbd5e1' : '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={16} />
              <span>Voltar</span>
            </button>

            <button
              type="button"
              onClick={handleNextStep}
              disabled={!selectedOptionForCurrentStep}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 26px',
                borderRadius: '10px',
                backgroundColor: selectedOptionForCurrentStep ? '#09090b' : '#e2e8f0',
                color: selectedOptionForCurrentStep ? '#ffffff' : '#94a3b8',
                fontSize: '13.5px',
                fontWeight: 600,
                border: 'none',
                cursor: selectedOptionForCurrentStep ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: selectedOptionForCurrentStep
                  ? '0 6px 18px -4px rgba(0,0,0,0.3)'
                  : 'none',
              }}
            >
              <span>
                {currentStepIndex === ONBOARDING_STEPS.length - 1 ? 'Continuar para os Termos' : 'Próxima Pergunta'}
              </span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ESTÁGIO 4: TERMOS DE USO & POLÍTICA DE PRIVACIDADE                   */}
      {/* ==================================================================== */}
      {stage === 'terms' && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '680px',
            borderRadius: '28px',
            backgroundColor: '#ffffff',
            boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            padding: '40px 42px',
            zIndex: 10,
            overflowY: 'auto',
            maxHeight: '90vh',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 16px auto',
                borderRadius: '18px',
                backgroundColor: '#f8fafc',
                border: '2px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0f172a',
              }}
            >
              <ShieldCheck size={28} />
            </div>

            <h2
              style={{
                fontSize: '26px',
                fontWeight: 700,
                color: '#0f172a',
                fontFamily: `'Playfair Display', Georgia, serif`,
                marginBottom: '6px',
              }}
            >
              Termos de Uso e Privacidade
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Para concluir a ativação da sua firma, leia e aceite os nossos termos contratuais e de
              proteção de dados.
            </p>
          </div>

          <div
            style={{
              padding: '18px 20px',
              borderRadius: '14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              maxHeight: '220px',
              overflowY: 'auto',
              fontSize: '12.5px',
              color: '#334155',
              lineHeight: 1.6,
              marginBottom: '24px',
            }}
          >
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              1. Isolamento Multi-Firma e Confidencialidade
            </div>
            <p style={{ marginBottom: '12px' }}>
              A sua organização opera num ambiente com isolamento lógico estrito. Todas as
              informações de obras, transações financeiras, frotas e equipas são encriptadas e
              inacessíveis a qualquer outra entidade.
            </p>

            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              2. Proteção de Dados de Colaboradores e RGPD
            </div>
            <p style={{ marginBottom: '12px' }}>
              Os registos de assiduidade, fotografias de serviço e coordenadas GPS de início e fim
              de jornada destinam-se exclusivamente à gestão operacional da firma e validação de
              ponto laboral, em estrita conformidade com a legislação europeia de proteção de dados.
            </p>

            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              3. Segurança da Informação e Cópias de Segurança
            </div>
            <p style={{ marginBottom: '12px' }}>
              O Castello implementa autenticação segura, retenção redundante em nuvem e
              rastreabilidade de auditoria para proteger o histórico de dados contra perdas ou acessos
              indevidos.
            </p>

            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              4. Licenciamento e Disponibilidade
            </div>
            <p style={{ margin: 0 }}>
              O serviço SaaS é disponibilizado sob modelo de subscrição para gestão da construção civil,
              assegurando atualizações automáticas e suporte contínuo.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: `1px solid ${acceptTerms ? '#2563eb' : '#e2e8f0'}`,
                backgroundColor: acceptTerms ? '#f0f7ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  marginTop: '2px',
                  accentColor: '#2563eb',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.45 }}>
                Li, compreendo e aceito integralmente os{' '}
                <strong>Termos de Uso</strong> e as condições de licenciamento do sistema Castello.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                border: `1px solid ${acceptPrivacy ? '#2563eb' : '#e2e8f0'}`,
                backgroundColor: acceptPrivacy ? '#f0f7ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  marginTop: '2px',
                  accentColor: '#2563eb',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.45 }}>
                Aceito a <strong>Política de Privacidade</strong> e autorizo o tratamento de dados
                operacionais da firma e dos colaboradores para fins de gestão de obras.
              </span>
            </label>
          </div>

          {/* Botão Bloqueado até aceitar os termos */}
          {(!acceptTerms || !acceptPrivacy) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#d97706',
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                padding: '8px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontWeight: 500,
              }}
            >
              <Lock size={14} />
              <span>O botão de continuar está bloqueado até aceitar os termos acima.</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setAuthStage('onboarding')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} />
              <span>Voltar</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteRegistration}
              disabled={!acceptTerms || !acceptPrivacy || savingOnboarding}
              style={{
                flex: 1,
                padding: '13px 20px',
                borderRadius: '12px',
                backgroundColor: acceptTerms && acceptPrivacy ? '#09090b' : '#f1f5f9',
                color: acceptTerms && acceptPrivacy ? '#ffffff' : '#94a3b8',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: acceptTerms && acceptPrivacy && !savingOnboarding ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s',
                boxShadow:
                  acceptTerms && acceptPrivacy
                    ? '0 8px 20px -6px rgba(0, 0, 0, 0.4)'
                    : 'none',
              }}
            >
              {savingOnboarding ? (
                <span>A configurar o seu sistema...</span>
              ) : (
                <>
                  {acceptTerms && acceptPrivacy ? (
                    <CheckCircle2 size={18} color="#22c55e" />
                  ) : (
                    <Lock size={16} />
                  )}
                  <span>Concluir e Aceder ao Sistema</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-slow {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};
