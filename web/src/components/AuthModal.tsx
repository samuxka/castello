import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Building,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Eye,
  EyeOff,
  FolderKanban,
  Globe,
  Hammer,
  HardHat,
  Home,
  KeyRound,
  Landmark,
  Layers,
  Lock,
  LucideIcon,
  MailCheck,
  MapPin,
  Paintbrush,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  clearLocalPendingOnboardingState,
  clearPendingEmailVerificationDraft,
  completeCompanyOnboardingAndTerms,
  getLocalPendingOnboardingState,
  getPendingEmailVerificationDraft,
  getPendingGoogleAuthUser,
  handleGoogleAuthRedirect,
  initiateEmailSignupVerification,
  isCompanyOnboardingPending,
  loginCompany,
  loginWithGoogle,
  OnboardingAnswersMap,
  PendingGoogleUser,
  registerCompanyForGoogleUser,
  resendEmailSignupCode,
  restorePendingOnboardingSession,
  savePendingEmailVerificationDraft,
  savePendingOnboardingProgress,
  setActiveCompanySession,
  supabase,
  verifyEmailSignupCodeAndCreateCompany,
} from '../lib/supabase';
import { Company } from '../types';
import { loginSchema, registerSchema, validateWithZod } from '../lib/validation';
import { verifyTurnstileToken } from '../lib/turnstile';
import { TurnstileWidget } from './TurnstileWidget';

interface AuthModalProps {
  onSuccess: (company: Company) => void;
}

type AuthStage = 'auth' | 'verify-email' | 'google-company' | 'onboarding' | 'terms';

interface OnboardingOption {
  id: string;
  Icon: LucideIcon;
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
        Icon: Home,
        title: 'Construção Residencial',
        description: 'Habitação unifamiliar, moradias, edifícios e condomínios residenciais.',
      },
      {
        id: 'comercial_industrial',
        Icon: Building2,
        title: 'Obras Comerciais & Industriais',
        description: 'Escritórios, lojas, armazéns logísticos e pavilhões industriais.',
      },
      {
        id: 'remodelacao_restauro',
        Icon: Hammer,
        title: 'Remodelação & Reabilitação',
        description: 'Renovações de interiores, reabilitação urbana e restauro de património.',
      },
      {
        id: 'infraestruturas',
        Icon: Layers,
        title: 'Infraestruturas & Terraplanagens',
        description: 'Redes de águas, saneamento, loteamentos e pavimentação viária.',
      },
      {
        id: 'acabamentos',
        Icon: Paintbrush,
        title: 'Acabamentos & Pinturas',
        description: 'Gesso cartonado (pladur), isolamentos, revestimentos e pintura geral.',
      },
      {
        id: 'instalacoes_tecnicas',
        Icon: Zap,
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
        Icon: Rocket,
        title: 'Menos de 1 ano',
        description: 'Firma recente ou em arranque acelerado de atividade.',
      },
      {
        id: '1_a_3_anos',
        Icon: TrendingUp,
        title: '1 a 3 anos',
        description: 'Empresa em crescimento com portfólio em expansão.',
      },
      {
        id: '4_a_10_anos',
        Icon: Landmark,
        title: '4 a 10 anos',
        description: 'Firma sólida, estabelecida e com carteira estável de clientes.',
      },
      {
        id: 'mais_10_anos',
        Icon: Award,
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
        Icon: User,
        title: '1 a 5 colaboradores',
        description: 'Estrutura compacta com comunicação direta e ágil.',
      },
      {
        id: '6_a_15',
        Icon: Users,
        title: '6 a 15 colaboradores',
        description: 'Equipas organizadas com encarregados ou mestres de obra.',
      },
      {
        id: '16_a_50',
        Icon: HardHat,
        title: '16 a 50 colaboradores',
        description: 'Várias equipas a operar em simultâneo em diferentes locais.',
      },
      {
        id: 'mais_50',
        Icon: Building,
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
        Icon: MapPin,
        title: '1 a 2 obras em simultâneo',
        description: 'Foco intensivo e acompanhamento próximo em cada projeto.',
      },
      {
        id: '3_a_5',
        Icon: FolderKanban,
        title: '3 a 5 obras em simultâneo',
        description: 'Volume regular com rotação planeada de trabalhadores e carrinhas.',
      },
      {
        id: '6_a_10',
        Icon: Building2,
        title: '6 a 10 obras em simultâneo',
        description: 'Gestão multi-obra que exige controlo rigoroso de horas e custos.',
      },
      {
        id: 'mais_10',
        Icon: Globe,
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
        Icon: Clock,
        title: 'Registo e Validação de Ponto',
        description: 'Controlo rigoroso de horas, presenças no terreno e horas extraordinárias.',
      },
      {
        id: 'controlo_financeiro',
        Icon: Wallet,
        title: 'Custos, Margens & Rentabilidade',
        description: 'Evitar desvios de orçamento e monitorizar a margem real de cada obra.',
      },
      {
        id: 'tarefas_e_diarios',
        Icon: ClipboardCheck,
        title: 'Tarefas, Fotos & Diários de Obra',
        description: 'Acompanhar o avanço diário dos serviços com fotos e validação digital.',
      },
      {
        id: 'carrinhas_e_materiais',
        Icon: Truck,
        title: 'Frotas, Carrinhas & Inventário',
        description: 'Gestão de carrinhas, manutenção, ferramentas e materiais em circulação.',
      },
    ],
  },
];

interface PhoneCountryOption {
  iso: string;
  name: string;
  dialCode: string;
  placeholder: string;
  maxDigits: number;
}

const PHONE_COUNTRIES: PhoneCountryOption[] = [
  { iso: 'PT', name: 'Portugal', dialCode: '+351', placeholder: '912345678', maxDigits: 9 },
  { iso: 'BR', name: 'Brasil', dialCode: '+55', placeholder: '11987654321', maxDigits: 11 },
  { iso: 'ES', name: 'Espanha', dialCode: '+34', placeholder: '612345678', maxDigits: 9 },
  { iso: 'FR', name: 'França', dialCode: '+33', placeholder: '612345678', maxDigits: 9 },
  { iso: 'CH', name: 'Suíça', dialCode: '+41', placeholder: '781234567', maxDigits: 9 },
  { iso: 'LU', name: 'Luxemburgo', dialCode: '+352', placeholder: '621123456', maxDigits: 9 },
  { iso: 'GB', name: 'Reino Unido', dialCode: '+44', placeholder: '7700900123', maxDigits: 10 },
  { iso: 'DE', name: 'Alemanha', dialCode: '+49', placeholder: '15123456789', maxDigits: 11 },
  { iso: 'BE', name: 'Bélgica', dialCode: '+32', placeholder: '470123456', maxDigits: 9 },
  { iso: 'NL', name: 'Países Baixos', dialCode: '+31', placeholder: '612345678', maxDigits: 9 },
  { iso: 'IT', name: 'Itália', dialCode: '+39', placeholder: '3123456789', maxDigits: 10 },
  { iso: 'US', name: 'Estados Unidos', dialCode: '+1', placeholder: '2015550123', maxDigits: 10 },
  { iso: 'AO', name: 'Angola', dialCode: '+244', placeholder: '923123456', maxDigits: 9 },
  { iso: 'MZ', name: 'Moçambique', dialCode: '+258', placeholder: '841234567', maxDigits: 9 },
  { iso: 'CV', name: 'Cabo Verde', dialCode: '+238', placeholder: '9912345', maxDigits: 7 },
];

const CountryFlagSvg: React.FC<{ iso: string }> = ({ iso }) => {
  switch (iso) {
    case 'PT':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="8" height="14" fill="#006600" />
          <rect x="8" width="12" height="14" fill="#FF0000" />
          <circle cx="8" cy="7" r="2.6" fill="#FFCC00" />
        </svg>
      );
    case 'BR':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="14" fill="#009B3A" />
          <polygon points="10,2 18,7 10,12 2,7" fill="#FEDF00" />
          <circle cx="10" cy="7" r="2.6" fill="#002776" />
        </svg>
      );
    case 'ES':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="14" fill="#AA151B" />
          <rect y="3.5" width="20" height="7" fill="#F1BF00" />
        </svg>
      );
    case 'FR':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="6.67" height="14" fill="#002395" />
          <rect x="6.67" width="6.67" height="14" fill="#FFFFFF" />
          <rect x="13.33" width="6.67" height="14" fill="#ED2939" />
        </svg>
      );
    case 'CH':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="14" fill="#D52B1E" />
          <rect x="8.5" y="3" width="3" height="8" fill="#FFFFFF" />
          <rect x="6" y="5.5" width="8" height="3" fill="#FFFFFF" />
        </svg>
      );
    case 'LU':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="4.67" fill="#EA141D" />
          <rect y="4.67" width="20" height="4.67" fill="#FFFFFF" />
          <rect y="9.33" width="20" height="4.67" fill="#51ADDA" />
        </svg>
      );
    case 'GB':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="14" fill="#012169" />
          <path d="M0,0 L20,14 M20,0 L0,14" stroke="#FFFFFF" strokeWidth="2.4" />
          <path d="M10,0 L10,14 M0,7 L20,7" stroke="#FFFFFF" strokeWidth="4" />
          <path d="M10,0 L10,14 M0,7 L20,7" stroke="#C8102E" strokeWidth="2.4" />
        </svg>
      );
    case 'DE':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="4.67" fill="#000000" />
          <rect y="4.67" width="20" height="4.67" fill="#DD0000" />
          <rect y="9.33" width="20" height="4.67" fill="#FFCE00" />
        </svg>
      );
    case 'BE':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="6.67" height="14" fill="#000000" />
          <rect x="6.67" width="6.67" height="14" fill="#FDDA24" />
          <rect x="13.33" width="6.67" height="14" fill="#EF3340" />
        </svg>
      );
    case 'NL':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="4.67" fill="#AE1C28" />
          <rect y="4.67" width="20" height="4.67" fill="#FFFFFF" />
          <rect y="9.33" width="20" height="4.67" fill="#21468B" />
        </svg>
      );
    case 'IT':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="6.67" height="14" fill="#009246" />
          <rect x="6.67" width="6.67" height="14" fill="#FFFFFF" />
          <rect x="13.33" width="6.67" height="14" fill="#CE2B37" />
        </svg>
      );
    case 'US':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="14" fill="#B22234" />
          <rect y="2" width="20" height="2" fill="#FFFFFF" />
          <rect y="6" width="20" height="2" fill="#FFFFFF" />
          <rect y="10" width="20" height="2" fill="#FFFFFF" />
          <rect width="9" height="7" fill="#3C3B6E" />
        </svg>
      );
    case 'AO':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="7" fill="#CC092F" />
          <rect y="7" width="20" height="7" fill="#000000" />
          <circle cx="10" cy="7" r="2.3" fill="#FFCB00" />
        </svg>
      );
    case 'MZ':
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="4.67" fill="#007168" />
          <rect y="4.67" width="20" height="4.67" fill="#000000" />
          <rect y="9.33" width="20" height="4.67" fill="#FCE100" />
          <polygon points="0,0 8,7 0,14" fill="#D21034" />
        </svg>
      );
    default:
      return (
        <svg width="20" height="14" viewBox="0 0 20 14" style={{ borderRadius: 2, flexShrink: 0 }}>
          <rect width="20" height="14" fill="#003893" />
          <rect y="7" width="20" height="3" fill="#FFFFFF" />
          <rect y="8" width="20" height="1" fill="#CF2027" />
        </svg>
      );
  }
};

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const initialOnboardingDraft = getLocalPendingOnboardingState();
  const initialEmailVerifyDraft = !initialOnboardingDraft ? getPendingEmailVerificationDraft() : null;

  const [stage, setAuthStage] = useState<AuthStage>(() => {
    if (initialOnboardingDraft) return initialOnboardingDraft.stage;
    if (initialEmailVerifyDraft) return 'verify-email';
    return 'auth';
  });
  const [mode, setMode] = useState<'login' | 'signup'>(() =>
    initialEmailVerifyDraft ? 'signup' : 'login'
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Form states
  const [companyName, setCompanyName] = useState(() => initialEmailVerifyDraft?.companyName || '');
  const [email, setEmail] = useState(
    () => initialOnboardingDraft?.company?.owner_email || initialEmailVerifyDraft?.email || ''
  );
  const [password, setPassword] = useState('');
  const [phoneDigits, setPhoneDigits] = useState(() => initialEmailVerifyDraft?.phoneDigits || '');
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountryOption>(() => {
    if (initialEmailVerifyDraft?.selectedCountryIso) {
      const found = PHONE_COUNTRIES.find((c) => c.iso === initialEmailVerifyDraft.selectedCountryIso);
      if (found) return found;
    }
    return PHONE_COUNTRIES[0];
  });
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [taxId, setTaxId] = useState(() => initialEmailVerifyDraft?.taxId || '');

  const fullFormattedPhone = phoneDigits.trim()
    ? `${selectedCountry.dialCode} ${phoneDigits.trim()}`
    : '';

  // Pending company state after initial registration
  const [pendingCompany, setPendingCompany] = useState<Company | null>(
    () => initialOnboardingDraft?.company || null
  );
  const [pendingGoogleUser, setPendingGoogleUser] = useState<PendingGoogleUser | null>(null);
  const isManualAuthFlowRef = useRef(Boolean(initialOnboardingDraft || initialEmailVerifyDraft));

  // Email verification code states (para registo com e-mail/senha)
  const [verificationCode, setVerificationCode] = useState('');
  const [resendingCode, setResendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null);

  // Cloudflare Turnstile token & single-use reset counter
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  // Multi-step Onboarding State (restaurado automaticamente se a página for atualizada)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(
    () => initialOnboardingDraft?.currentStepIndex ?? 0
  );
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswersMap>(() =>
    initialOnboardingDraft?.onboardingAnswers || {
      industry: '',
      years_active: '',
      team_size: '',
      active_sites_count: '',
      primary_goal: '',
    }
  );

  // Terms and Privacy State
  const [acceptTerms, setAcceptTerms] = useState<boolean>(
    () => initialOnboardingDraft?.acceptTerms ?? false
  );
  const [acceptPrivacy, setAcceptPrivacy] = useState<boolean>(
    () => initialOnboardingDraft?.acceptPrivacy ?? false
  );
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Restaura onboarding pendente ao atualizar a página ou detecta retorno do Google OAuth
  useEffect(() => {
    let mounted = true;

    const checkAuthAndOnboardingState = async () => {
      // 1. Verifica se existe um registo recém-criado com formulário multi-step ou termos pendentes
      const pendingOnboarding = await restorePendingOnboardingSession();
      if (!mounted) return;
      if (pendingOnboarding && pendingOnboarding.company) {
        isManualAuthFlowRef.current = true;
        setPendingCompany(pendingOnboarding.company);
        setOnboardingAnswers(pendingOnboarding.onboardingAnswers);
        setCurrentStepIndex(pendingOnboarding.currentStepIndex);
        setAcceptTerms(pendingOnboarding.acceptTerms);
        setAcceptPrivacy(pendingOnboarding.acceptPrivacy);
        setAuthStage(pendingOnboarding.stage);
        return;
      }

      if (isManualAuthFlowRef.current) return;

      // 2. Fluxo Google OAuth
      const existingCompany = await handleGoogleAuthRedirect();
      if (!mounted || isManualAuthFlowRef.current) return;
      if (existingCompany) {
        onSuccess(existingCompany);
        return;
      }

      // Verifica novamente se o retorno do Google encontrou uma firma com onboarding pendente
      const googlePendingOnboarding = await restorePendingOnboardingSession();
      if (!mounted) return;
      if (googlePendingOnboarding && googlePendingOnboarding.company) {
        setPendingCompany(googlePendingOnboarding.company);
        setOnboardingAnswers(googlePendingOnboarding.onboardingAnswers);
        setCurrentStepIndex(googlePendingOnboarding.currentStepIndex);
        setAcceptTerms(googlePendingOnboarding.acceptTerms);
        setAcceptPrivacy(googlePendingOnboarding.acceptPrivacy);
        setAuthStage(googlePendingOnboarding.stage);
        return;
      }

      const googleUsr = await getPendingGoogleAuthUser();
      if (!mounted || isManualAuthFlowRef.current) return;
      if (googleUsr) {
        setPendingGoogleUser(googleUsr);
        setEmail(googleUsr.email);
        if (googleUsr.phone && !phoneDigits) {
          setPhoneDigits(googleUsr.phone.replace(/\D/g, ''));
        }
        setAuthStage((prev) => (prev === 'auth' ? 'google-company' : prev));
      }
    };

    checkAuthAndOnboardingState();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((event) => {
        if (isManualAuthFlowRef.current) return;
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          checkAuthAndOnboardingState();
        }
      }) || { data: { subscription: null } };

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleGoogleCompanyStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});

    const nextErrors: Record<string, string> = {};
    if (!companyName.trim() || companyName.trim().length < 2) {
      nextErrors.companyName = 'Informe o nome da sua empresa / construtora.';
    }
    if (!taxId.trim() || !/^[0-9]{5,15}$/.test(taxId.trim())) {
      nextErrors.taxId = 'Informe um NIF válido contendo apenas números.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setErrorMsg('Preencha os dados obrigatórios da empresa para avançar.');
      return;
    }

    setLoading(true);
    try {
      const created = await registerCompanyForGoogleUser(companyName, taxId, fullFormattedPhone);
      setPendingCompany(created);
      setCurrentStepIndex(0);
      setAuthStage('onboarding');
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível guardar os dados da firma.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelGoogleRegistration = async () => {
    try {
      await supabase?.auth.signOut();
    } catch {}
    clearLocalPendingOnboardingState();
    clearPendingEmailVerificationDraft();
    isManualAuthFlowRef.current = false;
    setPendingGoogleUser(null);
    setPendingCompany(null);
    setErrorMsg(null);
    setFieldErrors({});
    setAuthStage('auth');
  };

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

      if (!turnstileToken) {
        setErrorMsg('Conclua a verificação de segurança Cloudflare Turnstile.');
        return;
      }

      setLoading(true);
      try {
        await verifyTurnstileToken(turnstileToken, 'login');
        const logged = await loginCompany(val.data.email, val.data.password);
        if (isCompanyOnboardingPending(logged)) {
          const restored = await restorePendingOnboardingSession();
          setPendingCompany(restored?.company || logged);
          if (restored?.onboardingAnswers) {
            setOnboardingAnswers(restored.onboardingAnswers);
          }
          setCurrentStepIndex(restored?.currentStepIndex ?? 0);
          setAcceptTerms(restored?.acceptTerms ?? false);
          setAcceptPrivacy(restored?.acceptPrivacy ?? false);
          setAuthStage(restored?.stage || 'onboarding');
          return;
        }
        onSuccess(logged);
      } catch (err: any) {
        setErrorMsg(err.message || 'Falha na autenticação da firma.');
      } finally {
        setTurnstileResetSignal((prev) => prev + 1);
        setLoading(false);
      }
    } else {
      // Registo de Conta: envia código de confirmação e valida campos numéricos
      const val = validateWithZod(registerSchema, {
        companyName,
        email,
        password,
        phone: fullFormattedPhone,
        taxId,
      });
      if (!val.success) {
        setFieldErrors(val.fieldErrors);
        setErrorMsg(val.error);
        return;
      }

      if (!turnstileToken) {
        setErrorMsg('Conclua a verificação de segurança Cloudflare Turnstile.');
        return;
      }

      setLoading(true);
      isManualAuthFlowRef.current = true;
      try {
        await verifyTurnstileToken(turnstileToken, 'signup');
        await initiateEmailSignupVerification(
          val.data.companyName,
          val.data.email,
          val.data.password,
          fullFormattedPhone,
          val.data.taxId || ''
        );
        savePendingEmailVerificationDraft({
          companyName: val.data.companyName,
          email: val.data.email,
          phoneDigits,
          selectedCountryIso: selectedCountry.iso,
          taxId: val.data.taxId || '',
        });
        setVerificationCode('');
        setResendSuccessMsg(null);
        setResendCooldown(60);
        setAuthStage('verify-email');
      } catch (err: any) {
        isManualAuthFlowRef.current = false;
        setErrorMsg(err.message || 'Falha no registo da firma.');
      } finally {
        setTurnstileResetSignal((prev) => prev + 1);
        setLoading(false);
      }
    }
  };

  const handleVerifyEmailCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResendSuccessMsg(null);

    const cleanCode = verificationCode.trim().replace(/\s+/g, '');
    if (cleanCode.length < 6) {
      setErrorMsg('Introduza o código de verificação enviado para o seu e-mail.');
      return;
    }

    setLoading(true);
    try {
      const created = await verifyEmailSignupCodeAndCreateCompany(
        companyName,
        email,
        password,
        cleanCode,
        fullFormattedPhone,
        taxId
      );
      setPendingCompany(created);
      setCurrentStepIndex(0);
      setAuthStage('onboarding');
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Código inválido ou expirado. Verifique o código recebido no seu e-mail.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerificationCode = async () => {
    if (resendCooldown > 0 || resendingCode) return;
    setErrorMsg(null);
    setResendSuccessMsg(null);
    setResendingCode(true);
    try {
      await resendEmailSignupCode(email);
      setResendSuccessMsg('Enviámos um novo código de verificação para o seu e-mail.');
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível reenviar o código neste momento.');
    } finally {
      setResendingCode(false);
    }
  };

  // Multi-step Onboarding
  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const selectedOptionForCurrentStep = currentStep ? onboardingAnswers[currentStep.field] : '';

  const handleSelectOption = (optionId: string) => {
    if (!currentStep) return;
    const nextAnswers: OnboardingAnswersMap = {
      ...onboardingAnswers,
      [currentStep.field]: optionId,
    };
    setOnboardingAnswers(nextAnswers);
    if (pendingCompany) {
      savePendingOnboardingProgress(pendingCompany, {
        stage: 'onboarding',
        currentStepIndex,
        onboardingAnswers: nextAnswers,
        acceptTerms,
        acceptPrivacy,
      });
    }
  };

  const handleNextStep = () => {
    if (!selectedOptionForCurrentStep) return;
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      const nextStep = currentStepIndex + 1;
      setCurrentStepIndex(nextStep);
      if (pendingCompany) {
        savePendingOnboardingProgress(pendingCompany, {
          stage: 'onboarding',
          currentStepIndex: nextStep,
          onboardingAnswers,
          acceptTerms,
          acceptPrivacy,
        });
      }
    } else {
      setAuthStage('terms');
      if (pendingCompany) {
        savePendingOnboardingProgress(pendingCompany, {
          stage: 'terms',
          currentStepIndex,
          onboardingAnswers,
          acceptTerms,
          acceptPrivacy,
        });
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      const prevStep = currentStepIndex - 1;
      setCurrentStepIndex(prevStep);
      if (pendingCompany) {
        savePendingOnboardingProgress(pendingCompany, {
          stage: 'onboarding',
          currentStepIndex: prevStep,
          onboardingAnswers,
          acceptTerms,
          acceptPrivacy,
        });
      }
    } else if (pendingGoogleUser) {
      setAuthStage('google-company');
    }
  };

  const handleToggleAcceptTerms = (checked: boolean) => {
    setAcceptTerms(checked);
    if (pendingCompany) {
      savePendingOnboardingProgress(pendingCompany, {
        stage: 'terms',
        currentStepIndex,
        onboardingAnswers,
        acceptTerms: checked,
        acceptPrivacy,
      });
    }
  };

  const handleToggleAcceptPrivacy = (checked: boolean) => {
    setAcceptPrivacy(checked);
    if (pendingCompany) {
      savePendingOnboardingProgress(pendingCompany, {
        stage: 'terms',
        currentStepIndex,
        onboardingAnswers,
        acceptTerms,
        acceptPrivacy: checked,
      });
    }
  };

  const handleBackFromTermsToOnboarding = () => {
    setAuthStage('onboarding');
    if (pendingCompany) {
      savePendingOnboardingProgress(pendingCompany, {
        stage: 'onboarding',
        currentStepIndex,
        onboardingAnswers,
        acceptTerms,
        acceptPrivacy,
      });
    }
  };

  // Finalização dos Termos de Uso e Entrada no Sistema
  const handleCompleteRegistration = async () => {
    if (!acceptTerms || !acceptPrivacy) return;
    setSavingOnboarding(true);
    setErrorMsg(null);

    try {
      const companyToComplete = pendingCompany || getLocalPendingOnboardingState()?.company || null;
      if (!companyToComplete) {
        throw new Error('Não foi possível localizar os dados da firma. Atualize a página e tente novamente.');
      }
      const finalCompany = await completeCompanyOnboardingAndTerms(
        companyToComplete,
        onboardingAnswers
      );
      setActiveCompanySession(finalCompany);
      onSuccess(finalCompany);
    } catch (err: any) {
      console.warn('Aviso ao guardar dados do questionário:', err);
      setErrorMsg(err?.message || 'Não foi possível guardar a confirmação dos termos. Tente novamente.');
    } finally {
      setSavingOnboarding(false);
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
            <img
              src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=75&w=1000&auto=format&fit=crop&fm=webp"
              srcSet="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=75&w=600&auto=format&fit=crop&fm=webp 600w, https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=75&w=1000&auto=format&fit=crop&fm=webp 1000w, https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=75&w=1400&auto=format&fit=crop&fm=webp 1400w"
              sizes="(max-width: 768px) 0px, 50vw"
              alt="Edifício arquitetónico moderno"
              width={700}
              height={900}
              fetchPriority="high"
              decoding="async"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
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
                  GROW WITH US
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
                  fontSize: '39px',
                  lineHeight: '1.15',
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                  fontFamily: `'Outfit', sans-serif`,
                  marginBottom: '18px',
                  textShadow: '0 4px 20px rgba(0,0,0,0.6)',
                }}
              >
                Gerencie seu negocio
                <br />
                com precisão.
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
                Tudo que você precisa para alavancar seu negocio em um só lugar.
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
              <img
                src="/logo.webp"
                alt="Castello"
                width={36}
                height={36}
                style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '8px' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
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

            <div style={{ marginBottom: '22px' }}>
              <h2
                style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontFamily: `'Outfit', sans-serif`,
                  letterSpacing: '-0.5px',
                  marginBottom: '6px',
                }}
              >
                {isSignup ? 'Crie sua conta' : 'Bem vindo de volta'}
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                {isSignup
                  ? 'Digite os detalhes da sua empresa para criar uma conta'
                  : 'Digite suas credenciais para acessar a conta'}
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
                      Nome da empresa
                    </label>
                    <input
                      type="text"
                      placeholder="ex.: Castello"
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
                    <div style={{ flex: 1.35, position: 'relative' }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#334155',
                          marginBottom: '6px',
                        }}
                      >
                        Telefone
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          borderRadius: '8px',
                          border: `1px solid ${fieldErrors.phone ? '#DC2626' : '#D2D8E4'}`,
                          backgroundColor: '#F5F7FB',
                          minHeight: '44px',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setCountryDropdownOpen((prev) => !prev)}
                          title={`País: ${selectedCountry.name} (${selectedCountry.dialCode})`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '0 10px',
                            border: 'none',
                            borderRight: '1px solid #D2D8E4',
                            backgroundColor: '#EEF1FF',
                            borderTopLeftRadius: '7px',
                            borderBottomLeftRadius: '7px',
                            color: '#010106',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <CountryFlagSvg iso={selectedCountry.iso} />
                          <span>{selectedCountry.dialCode}</span>
                          <ChevronDown size={13} color="#64748B" />
                        </button>

                        <input
                          type="tel"
                          inputMode="numeric"
                          placeholder={selectedCountry.placeholder}
                          maxLength={selectedCountry.maxDigits}
                          value={phoneDigits}
                          onChange={(e) =>
                            setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, selectedCountry.maxDigits))
                          }
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '10px 12px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            fontSize: '13.5px',
                            color: '#010106',
                            outline: 'none',
                          }}
                        />
                      </div>

                      {countryDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '4px',
                            width: '240px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #D2D8E4',
                            borderRadius: '8px',
                            boxShadow: '0 12px 28px -6px rgba(1, 1, 6, 0.22)',
                            zIndex: 50,
                            padding: '4px',
                          }}
                        >
                          {PHONE_COUNTRIES.map((c) => {
                            const isActive = c.iso === selectedCountry.iso;
                            return (
                              <button
                                key={c.iso}
                                type="button"
                                onClick={() => {
                                  setSelectedCountry(c);
                                  setPhoneDigits((prev) => prev.slice(0, c.maxDigits));
                                  setCountryDropdownOpen(false);
                                }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  backgroundColor: isActive ? '#EEF1FF' : 'transparent',
                                  color: '#010106',
                                  fontSize: '12.5px',
                                  fontWeight: isActive ? 600 : 500,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                }}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                  <CountryFlagSvg iso={c.iso} />
                                  <span>{c.name}</span>
                                </span>
                                <span style={{ color: '#0015D4', fontWeight: 600 }}>{c.dialCode}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {fieldErrors.phone && (
                        <span style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '4px', display: 'block' }}>
                          {fieldErrors.phone}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 0.9 }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#334155',
                          marginBottom: '6px',
                        }}
                      >
                        NIF
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="509123456"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value.replace(/\D/g, '').slice(0, 15))}
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${fieldErrors.taxId ? '#DC2626' : '#D2D8E4'}`,
                          backgroundColor: '#F5F7FB',
                          fontSize: '13.5px',
                          color: '#010106',
                          outline: 'none',
                        }}
                      />
                      {fieldErrors.taxId && (
                        <span style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '4px', display: 'block' }}>
                          {fieldErrors.taxId}
                        </span>
                      )}
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
                  placeholder="exemplo@email.com"
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
                    placeholder="********"
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
                    Lembre-se de mim
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      const query = email.trim()
                        ? `?email=${encodeURIComponent(email.trim().toLowerCase())}`
                        : '';
                      window.history.pushState({}, '', `/recuperar-senha${query}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
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
                    Esqueci a senha
                  </button>
                </div>
              )}

              {/* Cloudflare Turnstile Bot Protection */}
              <TurnstileWidget
                action={isSignup ? 'signup' : 'login'}
                onTokenChange={setTurnstileToken}
                resetSignal={turnstileResetSignal}
                theme="light"
              />

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
                {loading ? 'A processar...' : isSignup ? 'Registrar' : 'Entrar'}
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
                <span>Continuar com Google</span>
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 'auto' }}>
              <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                {isSignup ? 'Já tem uma conta? ' : "Ainda não tem uma contat? "}
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
                {isSignup ? 'Acessar' : 'Registrar'}
              </button>

              <div
                style={{
                  marginTop: '14px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  fontSize: '11.5px',
                  color: '#64748b',
                }}
              >
                <a
                  href="/privacidade"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/privacidade');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  style={{ color: '#475569', textDecoration: 'underline', fontWeight: 500 }}
                >
                  Política de Privacidade
                </a>
                <span>•</span>
                <a
                  href="/termos"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/termos');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  style={{ color: '#475569', textDecoration: 'underline', fontWeight: 500 }}
                >
                  Termos de Serviço
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ESTÁGIO 1.2 (E-MAIL/SENHA): TELA DE CÓDIGO DE CONFIRMAÇÃO DE E-MAIL  */}
      {/* ==================================================================== */}
      {stage === 'verify-email' && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '520px',
            borderRadius: '24px',
            backgroundColor: '#ffffff',
            boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            padding: '40px 44px',
            zIndex: 10,
            overflowY: 'auto',
            maxHeight: '92vh',
          }}
        >
          {/* Barra de Progresso */}
          <div style={{ marginBottom: '22px' }}>
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
                  color: '#0015D4',
                }}
              >
                Verificação de Conta • Código de Confirmação
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                Passo 1 de {ONBOARDING_STEPS.length + 2}
              </span>
            </div>

            <div
              style={{
                height: '6px',
                width: '100%',
                borderRadius: '999px',
                backgroundColor: '#EEF1FF',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.round((1 / (ONBOARDING_STEPS.length + 2)) * 100)}%`,
                  borderRadius: '999px',
                  backgroundColor: '#0015D4',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* Ícone e Título */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 16px',
                borderRadius: '16px',
                backgroundColor: '#EEF1FF',
                border: '1px solid #B9C8FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0015D4',
              }}
            >
              <MailCheck size={28} />
            </div>

            <h2
              style={{
                fontSize: '26px',
                fontWeight: 600,
                color: '#010106',
                fontFamily: `'Outfit', sans-serif`,
                margin: '0 0 8px',
              }}
            >
              Confirme o seu E-mail
            </h2>
            <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0, lineHeight: 1.55 }}>
              Enviámos um código de verificação para{' '}
              <strong style={{ color: '#010106' }}>{email.trim().toLowerCase()}</strong>. Introduza
              o código abaixo para validar o seu e-mail e prosseguir com o registo da firma.
            </p>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '12.5px',
                fontWeight: 500,
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              {errorMsg}
            </div>
          )}

          {resendSuccessMsg && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#DCFCE7',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                color: '#16A34A',
                fontSize: '12.5px',
                fontWeight: 600,
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              {resendSuccessMsg}
            </div>
          )}

          <form onSubmit={handleVerifyEmailCodeSubmit} noValidate>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#010106',
                  marginBottom: '8px',
                }}
              >
                <KeyRound size={14} color="#0015D4" />
                <span>Código de Verificação</span>
              </label>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={8}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                style={{
                  width: '100%',
                  minHeight: '54px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '2px solid #D2D8E4',
                  backgroundColor: '#F5F7FB',
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '8px',
                  textAlign: 'center',
                  color: '#010106',
                  outline: 'none',
                  fontFamily: `'Outfit', monospace`,
                }}
              />
              <span
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: '11.5px',
                  color: '#64748B',
                  marginTop: '6px',
                }}
              >
                Digite ou cole o código recebido na sua caixa de entrada (verifique também a pasta
                de Spam).
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.trim().length < 6}
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '13px 20px',
                borderRadius: '8px',
                backgroundColor:
                  verificationCode.trim().length >= 6 && !loading ? '#0015D4' : '#D2D8E4',
                color: verificationCode.trim().length >= 6 && !loading ? '#FFFFFF' : '#64748B',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor:
                  verificationCode.trim().length >= 6 && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '14px',
                transition: 'all 0.18s ease',
              }}
            >
              <span>{loading ? 'A validar código...' : 'Verificar Código e Continuar'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Reenviar Código e Voltar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              paddingTop: '14px',
              borderTop: '1px solid #EEF1FF',
            }}
          >
            <button
              type="button"
              onClick={handleResendVerificationCode}
              disabled={resendCooldown > 0 || resendingCode}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                color: resendCooldown > 0 ? '#64748B' : '#0015D4',
                cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                padding: 0,
              }}
            >
              <RefreshCw size={13} />
              <span>
                {resendingCode
                  ? 'A reenviar código...'
                  : resendCooldown > 0
                  ? `Reenviar código em ${resendCooldown}s`
                  : 'Não recebeu o e-mail? Reenviar código'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                isManualAuthFlowRef.current = false;
                setErrorMsg(null);
                setResendSuccessMsg(null);
                setAuthStage('auth');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 500,
                color: '#64748B',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              <ArrowLeft size={13} />
              <span>Voltar e corrigir dados ou e-mail</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ESTÁGIO 1.5 (GOOGLE OAUTH): COLETAR DADOS DA EMPRESA (NOME, NIF...)  */}
      {/* ==================================================================== */}
      {stage === 'google-company' && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '640px',
            borderRadius: '28px',
            backgroundColor: '#ffffff',
            boxShadow: '0 30px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            padding: '40px 44px',
            zIndex: 10,
            overflowY: 'auto',
            maxHeight: '92vh',
          }}
        >
          {/* Barra de progresso do Registo Multi-Step */}
          <div style={{ marginBottom: '22px' }}>
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
                Registo da Firma • Passo 1 de {ONBOARDING_STEPS.length + 2}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                Dados da Empresa
              </span>
            </div>

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
                  width: `${Math.round((1 / (ONBOARDING_STEPS.length + 2)) * 100)}%`,
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
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
                flexShrink: 0,
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '25px',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontFamily: `'Outfit', sans-serif`,
                  margin: '0 0 4px',
                }}
              >
                Dados da Sua Firma
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Conta Google autorizada com sucesso. Preencha os dados da sua construtora para continuar.
              </p>
            </div>
          </div>

          {/* Selo da conta Google autenticada */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
              fontSize: '12.5px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span>
                E-mail verificado: <strong>{pendingGoogleUser?.email || email}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelGoogleRegistration}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Trocar de conta
            </button>
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

          <form onSubmit={handleGoogleCompanyStepSubmit} noValidate>
            <div style={{ marginBottom: '16px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Nome da Firma / Construtora *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ex: Castello Construções Lda"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${fieldErrors.companyName ? '#ef4444' : '#e2e8f0'}`,
                  backgroundColor: '#f8fafc',
                  fontSize: '13.5px',
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '12px', marginBottom: '22px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  NIF / Identificação Fiscal *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={15}
                  placeholder="Ex: 509123456"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value.replace(/\D/g, '').slice(0, 15))}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${fieldErrors.taxId ? '#DC2626' : '#D2D8E4'}`,
                    backgroundColor: '#F5F7FB',
                    fontSize: '13.5px',
                    color: '#010106',
                    outline: 'none',
                  }}
                />
                {fieldErrors.taxId && (
                  <span style={{ fontSize: '11.5px', color: '#DC2626', marginTop: '4px', display: 'block' }}>
                    {fieldErrors.taxId}
                  </span>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Telefone / WhatsApp (Opcional)
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    borderRadius: '8px',
                    border: '1px solid #D2D8E4',
                    backgroundColor: '#F5F7FB',
                    minHeight: '44px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCountryDropdownOpen((prev) => !prev)}
                    title={`País: ${selectedCountry.name} (${selectedCountry.dialCode})`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '0 10px',
                      border: 'none',
                      borderRight: '1px solid #D2D8E4',
                      backgroundColor: '#EEF1FF',
                      borderTopLeftRadius: '7px',
                      borderBottomLeftRadius: '7px',
                      color: '#010106',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <CountryFlagSvg iso={selectedCountry.iso} />
                    <span>{selectedCountry.dialCode}</span>
                    <ChevronDown size={13} color="#64748B" />
                  </button>

                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder={selectedCountry.placeholder}
                    maxLength={selectedCountry.maxDigits}
                    value={phoneDigits}
                    onChange={(e) =>
                      setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, selectedCountry.maxDigits))
                    }
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '10px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '13.5px',
                      color: '#010106',
                      outline: 'none',
                    }}
                  />
                </div>

                {countryDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      width: '240px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D2D8E4',
                      borderRadius: '8px',
                      boxShadow: '0 12px 28px -6px rgba(1, 1, 6, 0.22)',
                      zIndex: 50,
                      padding: '4px',
                    }}
                  >
                    {PHONE_COUNTRIES.map((c) => {
                      const isActive = c.iso === selectedCountry.iso;
                      return (
                        <button
                          key={c.iso}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(c);
                            setPhoneDigits((prev) => prev.slice(0, c.maxDigits));
                            setCountryDropdownOpen(false);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            padding: '8px 10px',
                            border: 'none',
                            borderRadius: '6px',
                            backgroundColor: isActive ? '#EEF1FF' : 'transparent',
                            color: '#010106',
                            fontSize: '12.5px',
                            fontWeight: isActive ? 600 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <CountryFlagSvg iso={c.iso} />
                            <span>{c.name}</span>
                          </span>
                          <span style={{ color: '#0015D4', fontWeight: 600 }}>{c.dialCode}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '18px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={handleCancelGoogleRegistration}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 18px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={16} />
                <span>Voltar ao Login</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 26px',
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
                <span>{loading ? 'A guardar dados...' : 'Continuar'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ESTÁGIO 2: FORMULÁRIO MULTI-STEP PARA CONHECER A FIRMA (DE MARCAR)   */}
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
                fontFamily: `'Outfit', sans-serif`,
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
              const OptionIcon = option.Icon;
              return (
                <div
                  key={option.id}
                  onClick={() => handleSelectOption(option.id)}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    border: `2px solid ${isSelected ? '#0015D4' : '#D2D8E4'}`,
                    backgroundColor: isSelected ? '#EEF1FF' : '#F5F7FB',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#8FA6FF';
                      e.currentTarget.style.backgroundColor = '#EEF1FF';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#D2D8E4';
                      e.currentTarget.style.backgroundColor = '#F5F7FB';
                    }
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#0015D4' : '#FFFFFF',
                      border: `1px solid ${isSelected ? '#0015D4' : '#D2D8E4'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? '#FFFFFF' : '#0015D4',
                      flexShrink: 0,
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <OptionIcon size={20} strokeWidth={1.75} />
                  </div>

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
              disabled={currentStepIndex === 0 && !pendingGoogleUser}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: currentStepIndex === 0 && !pendingGoogleUser ? '#cbd5e1' : '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: currentStepIndex === 0 && !pendingGoogleUser ? 'not-allowed' : 'pointer',
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
                fontFamily: `'Outfit', sans-serif`,
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
                onChange={(e) => handleToggleAcceptTerms(e.target.checked)}
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
                <a
                  href="/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}
                >
                  Termos de Serviço
                </a>{' '}
                e as condições de licenciamento do sistema Castello.
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
                onChange={(e) => handleToggleAcceptPrivacy(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  marginTop: '2px',
                  accentColor: '#2563eb',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.45 }}>
                Aceito a{' '}
                <a
                  href="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}
                >
                  Política de Privacidade
                </a>{' '}
                e autorizo o tratamento de dados
                operacionais da firma e dos colaboradores para fins de gestão de obras.
              </span>
            </label>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '12.5px',
                fontWeight: 600,
                marginBottom: '14px',
                textAlign: 'center',
              }}
            >
              {errorMsg}
            </div>
          )}

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
              onClick={handleBackFromTermsToOnboarding}
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
