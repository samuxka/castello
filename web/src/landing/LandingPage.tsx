import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  HardHat,
  Headphones,
  Layers,
  Laptop,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import './styles/landing.css';
import { getAppUrl, navigateToCastelloApp } from './utils/domain';

interface GalleryScreen {
  id: string;
  platform: 'web' | 'mobile';
  title: string;
  subtitle: string;
  src: string;
  badge: string;
}

const CASTELLO_SCREENS: GalleryScreen[] = [
  {
    id: 'mobile-obra',
    platform: 'mobile',
    title: 'App Mobile — Gestão da Obra & Horas da Equipa',
    subtitle: 'Ficha da obra (#CST-A7JS), orçamento previsto (€ 150.000) e registo de horas em campo.',
    src: '/landing/app-mobile-screen-1.jpg',
    badge: 'App Mobile • Obras & Ponto',
  },
  {
    id: 'web-dashboard',
    platform: 'web',
    title: 'Painel Web ERP — Produtividade, Assiduidade & Pontos',
    subtitle: 'Gráficos de estado das obras, tarefas concluídas, assiduidade semanal e aprovação de pontos.',
    src: '/landing/app-web-screen-2.png',
    badge: 'Sistema Web • Dashboard Geral',
  },
  {
    id: 'mobile-tarefas',
    platform: 'mobile',
    title: 'App Mobile — Tarefas com Foto, SST & Materiais',
    subtitle: 'Conclusão de tarefas com evidência fotográfica, zero acidentes SST e materiais alocados.',
    src: '/landing/app-mobile-screen-2.jpg',
    badge: 'App Mobile • Tarefas & SST',
  },
  {
    id: 'web-calendario',
    platform: 'web',
    title: 'Painel Web ERP — Calendário & Cronograma de Obras',
    subtitle: 'Planeamento mensal, semanal e cronograma com alocação de equipas e alertas de prazos.',
    src: '/landing/app-web-screen-1.png',
    badge: 'Sistema Web • Calendário',
  },
  {
    id: 'web-funcionarios',
    platform: 'web',
    title: 'Painel Web ERP — Funcionários, PIN de Acesso & Taxa Horária',
    subtitle: 'Controlo completo da equipa, cargos, código PIN para a App Mobile e custo/hora em Euros.',
    src: '/landing/app-web-screen-3.png',
    badge: 'Sistema Web • Recursos Humanos',
  },
  {
    id: 'web-equipa',
    platform: 'web',
    title: 'Painel Web ERP — Gestão de Equipas & Alocação em Obra',
    subtitle: 'Líder da equipa, membros ativos, tarefas em execução e alocação imediata às frentes de obra.',
    src: '/landing/app-web-team-card.png',
    badge: 'Sistema Web • Equipas',
  },
];

export const LandingPage: React.FC = () => {
  const appUrl = getAppUrl();
  const rootScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [heroFocusMode, setHeroFocusMode] = useState<'both' | 'web' | 'mobile'>('both');
  const [activeWebTab, setActiveWebTab] = useState<0 | 1 | 2>(0);
  const [lightboxScreen, setLightboxScreen] = useState<GalleryScreen | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSent, setNewsletterSent] = useState(false);

  // Scroll listener com requestAnimationFrame para animações de parallax suaves idênticas ao vídeo
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Castello — Sistema de Gestão de Obras & Ponto (Web & Mobile)';

    const scrollContainer = rootScrollRef.current;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = scrollContainer
            ? scrollContainer.scrollTop
            : window.scrollY || window.pageYOffset;
          setScrollY(y);
          setIsScrolled(y > 24);
          ticking = false;
        });
        ticking = true;
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // IntersectionObserver usando o container com scroll (.lp-root)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      {
        root: scrollContainer || null,
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    const revealNodes = document.querySelectorAll('.lp-reveal');
    revealNodes.forEach((el) => observer.observe(el));

    return () => {
      document.title = prevTitle;
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', onScroll);
      }
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  // Cálculos de deslocamento parallax suave (limitados para manter enquadramento perfeito)
  const clampedHeroScroll = Math.min(scrollY, 650);
  const frontDeviceOffsetY = clampedHeroScroll * -0.14;
  const backDeviceOffsetY = clampedHeroScroll * 0.11;

  const pulseParallaxY = Math.max(-36, Math.min(36, (scrollY - 1450) * -0.08));
  const floatingCard1X = Math.max(-24, Math.min(24, (scrollY - 2200) * -0.05));
  const floatingCard2X = Math.max(-20, Math.min(20, (scrollY - 2200) * 0.04));
  const floatingCard3X = Math.max(-24, Math.min(24, (scrollY - 2200) * -0.04));

  const webRealtimeScreens = [
    {
      title: 'Dashboard & Assiduidade',
      metric: '100% Obras Ativas',
      delta: '+300% Tarefas Concluídas',
      src: '/landing/app-web-screen-2.png',
    },
    {
      title: 'Calendário & Cronograma',
      metric: '8 Eventos Programados',
      delta: '0 Atrasos na Obra',
      src: '/landing/app-web-screen-1.png',
    },
    {
      title: 'Funcionários & Taxa Horária',
      metric: '7 Colaboradores Ativos',
      delta: 'PIN & Ponto Sincronizados',
      src: '/landing/app-web-screen-3.png',
    },
  ];

  return (
    <div ref={rootScrollRef} className="lp-root">
      {/* ====================================================================
          NAVBAR FLUTUANTE (COMO NO VÍDEO: Logo com círculo, 4 links, Log In + CTA)
         ==================================================================== */}
      <header className={`lp-navbar ${isScrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-container lp-navbar-inner">
          <a href="#topo" className="lp-brand">
            <img
              src="/logo.webp"
              alt="Castello"
              width={32}
              height={32}
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }}
            />
            <span className="lp-brand-dot">Castello</span>
          </a>

          <nav className="lp-nav-links" aria-label="Navegação Principal">
            <a href="#plataforma" className="lp-nav-link">
              Web &amp; Mobile
            </a>
            <a href="#vantagens" className="lp-nav-link">
              Vantagens
            </a>
            <a href="#modulos" className="lp-nav-link">
              Módulos
            </a>
            <a href="#tempo-real" className="lp-nav-link">
              Tempo Real
            </a>
          </nav>

          <div className="lp-nav-actions">
            <a href={appUrl} onClick={navigateToCastelloApp} className="lp-btn-login">
              Entrar
            </a>
            <a href={appUrl} onClick={navigateToCastelloApp} className="lp-btn-dark">
              <Smartphone size={15} />
              <span>Web &amp; App</span>
            </a>
          </div>
        </div>
      </header>

      {/* ====================================================================
          SECÇÃO 1: HERO CARD ARREDONDADO COM SETA LOOPING & MOCKUPS 3D (f_01)
         ==================================================================== */}
      <section id="topo" className="lp-hero-wrapper">
        <div className="lp-container">
          <div className="lp-hero-card">
            {/* Coluna Esquerda: Headline + Seta Looping SVG + Botão CTA */}
            <div className="lp-hero-left">
              <div className="lp-hero-pill-switcher" role="tablist" aria-label="Alternar visualização">
                <button
                  type="button"
                  onClick={() => setHeroFocusMode('both')}
                  className={`lp-hero-pill-btn ${heroFocusMode === 'both' ? 'is-active' : ''}`}
                >
                  <Layers size={13} />
                  <span>Ecossistema Completo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroFocusMode('web')}
                  className={`lp-hero-pill-btn ${heroFocusMode === 'web' ? 'is-active' : ''}`}
                >
                  <Laptop size={13} />
                  <span>Painel Web</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroFocusMode('mobile')}
                  className={`lp-hero-pill-btn ${heroFocusMode === 'mobile' ? 'is-active' : ''}`}
                >
                  <Smartphone size={13} />
                  <span>App Mobile</span>
                </button>
              </div>

              <h1 className="lp-hero-title">
                Construa o
                <span className="lp-sparkle-star" aria-hidden="true">
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <path
                      d="M19 3C19.8 11.6 26.4 18.2 35 19C26.4 19.8 19.8 26.4 19 35C18.2 26.4 11.6 19.8 3 19C11.6 18.2 18.2 11.6 19 3Z"
                      stroke="#010106"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <br />
                Futuro da Obra
              </h1>

              <p className="lp-hero-subtitle">
                Trabalhe com todas as informações e ferramentas para controlar ponto GPS, equipas,
                orçamentos, frotas e diários de obra usando o <strong>Castello Web &amp; Mobile</strong>!
              </p>

              <div className="lp-hero-cta-row">
                <a
                  href={appUrl}
                  onClick={navigateToCastelloApp}
                  className="lp-btn-dark lp-btn-dark-lg"
                >
                  <Zap size={17} />
                  <span>Aceder ao Sistema</span>
                </a>

                <button
                  type="button"
                  onClick={() => setLightboxScreen(CASTELLO_SCREENS[0])}
                  className="lp-btn-login"
                  style={{
                    padding: '14px 20px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.78)',
                    border: '1px solid rgba(1, 15, 107, 0.14)',
                    fontSize: 14,
                  }}
                >
                  Ver Telas Reais
                </button>
              </div>

              <a href="#plataforma" className="lp-find-more">
                <span>Descubra Mais</span>
                <ArrowDown size={15} />
              </a>

              {/* Seta curva com loop idêntica ao frame f_01 do vídeo */}
              <svg
                className="lp-hero-loop-arrow"
                viewBox="0 0 240 250"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  className="lp-draw-path"
                  d="M138 14 C 212 28, 232 108, 194 176 C 175 210, 148 232, 138 220 C 128 208, 146 184, 162 198 C 176 210, 132 178, 22 182"
                  stroke="#010106"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M32 173 L 18 182 L 33 190"
                  stroke="#010106"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Coluna Direita: 2 Dispositivos Inclinados com Parallax no Scroll e Imagens Reais do Castello */}
            <div className="lp-hero-devices">
              {/* CARTÃO FRONTAL (Branco, inclinado à esquerda -7deg): App Mobile Castello Real */}
              <div
                className="lp-device-card-front"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[0])}
                title="Clique para ampliar a tela real da App Mobile Castello"
                style={{
                  transform:
                    heroFocusMode === 'web'
                      ? `translate3d(-25px, ${frontDeviceOffsetY + 14}px, 0) rotate(-9deg) scale(0.92)`
                      : heroFocusMode === 'mobile'
                      ? `translate3d(28px, ${frontDeviceOffsetY}px, 0) rotate(-3deg) scale(1.05)`
                      : `translate3d(0px, ${frontDeviceOffsetY}px, 0) rotate(-7deg)`,
                  zIndex: heroFocusMode === 'web' ? 2 : 4,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    padding: '2px 4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#0015D4',
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#010106' }}>
                      Castello Mobile
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#EEF1FF',
                      color: '#0015D4',
                    }}
                  >
                    #CST-A7JS
                  </span>
                </div>

                <img
                  src="/landing/app-mobile-screen-1.jpg"
                  alt="App Mobile Castello — Obra Apartamento do Luiz e Horas da Equipa"
                  className="lp-device-screen-img"
                  style={{ height: 365, objectPosition: 'top' }}
                />

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <div
                    style={{
                      padding: '7px 10px',
                      borderRadius: 10,
                      background: '#0015D4',
                      color: '#FFFFFF',
                      fontSize: 11.5,
                      fontWeight: 700,
                      textAlign: 'center',
                    }}
                  >
                    + Registar Ponto
                  </div>
                  <div
                    style={{
                      padding: '7px 10px',
                      borderRadius: 10,
                      background: '#DCE4FF',
                      color: '#010F6B',
                      fontSize: 11.5,
                      fontWeight: 700,
                      textAlign: 'center',
                    }}
                  >
                    14.5h Validadas
                  </div>
                </div>
              </div>

              {/* CARTÃO TRASEIRO (Obsidian escuro, inclinado à direita +8deg): Painel Web ERP Castello Real */}
              <div
                className="lp-device-card-back"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[1])}
                title="Clique para ampliar o Painel Web ERP Castello"
                style={{
                  transform:
                    heroFocusMode === 'web'
                      ? `translate3d(-30px, ${backDeviceOffsetY - 10}px, 0) rotate(2deg) scale(1.06)`
                      : heroFocusMode === 'mobile'
                      ? `translate3d(20px, ${backDeviceOffsetY + 12}px, 0) rotate(10deg) scale(0.92)`
                      : `translate3d(0px, ${backDeviceOffsetY}px, 0) rotate(8deg)`,
                  zIndex: heroFocusMode === 'web' ? 5 : 2,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                    padding: '2px 6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img
                      src="/logo.webp"
                      alt="Castello"
                      width={18}
                      height={18}
                      style={{ width: 18, height: 18, borderRadius: 4 }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>
                      Castello Web ERP
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#5C7FFB' }}>
                    € 150.000,00 • Ativa
                  </span>
                </div>

                <img
                  src="/landing/app-web-screen-2.png"
                  alt="Painel Web Castello — Produtividade e Assiduidade da Equipa"
                  className="lp-device-screen-img"
                  style={{
                    height: 225,
                    objectFit: 'cover',
                    objectPosition: 'left top',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />

                <div style={{ marginTop: 10 }}>
                  <img
                    src="/landing/app-web-screen-1.png"
                    alt="Calendário e Cronograma Castello Web"
                    className="lp-device-screen-img"
                    style={{
                      height: 125,
                      objectFit: 'cover',
                      objectPosition: 'top',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECÇÃO 2: "TIRE O MÁXIMO PROVEITO" — 2 BENTO CARDS (f_03)
         ==================================================================== */}
      <section id="plataforma" className="lp-section">
        <div className="lp-container">
          <h2 className="lp-section-heading lp-reveal">
            Tire o Máximo Proveito
            <br />
            da Gestão das Suas Obras
          </h2>

          <div className="lp-bento-two-grid">
            {/* Bento Card 1: Sistema Web ERP */}
            <div className="lp-bento-card lp-reveal lp-delay-1">
              <div className="lp-bento-content">
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#0015D4',
                    background: '#DCE4FF',
                    padding: '4px 10px',
                    borderRadius: 999,
                    marginBottom: 12,
                  }}
                >
                  <Laptop size={13} />
                  <span>PAINEL WEB ADMINISTRATIVO</span>
                </div>
                <h3 className="lp-bento-title">Obras, Equipas &amp; Finanças Ilimitadas</h3>
                <p className="lp-bento-desc">
                  Gira todas as suas obras, cronogramas, folhas de ponto, medições, faturas e frotas
                  a partir de um único painel central no computador.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[3])}
                className="lp-read-more"
              >
                <span>Ver Painel Web</span>
                <ArrowRight size={16} />
              </button>

              {/* Gráfico geométrico idêntico ao card esquerdo do frame f_03, com as cores do Design System */}
              <svg
                className="lp-bento-graphic-left"
                viewBox="0 0 220 220"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect
                  x="110"
                  y="44"
                  width="115"
                  height="165"
                  rx="26"
                  transform="rotate(18 110 44)"
                  fill="#7E9DFF"
                />
                <rect
                  x="38"
                  y="128"
                  width="96"
                  height="96"
                  rx="22"
                  transform="rotate(-16 38 128)"
                  fill="#010106"
                />
                <path
                  d="M126 112 C 126 142, 168 144, 168 120 C 168 102, 136 104, 122 136"
                  stroke="#010106"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Bento Card 2: App Mobile */}
            <div className="lp-bento-card lp-reveal lp-delay-2">
              <div className="lp-bento-content">
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#010F6B',
                    background: '#DCE4FF',
                    padding: '4px 10px',
                    borderRadius: 999,
                    marginBottom: 12,
                  }}
                >
                  <Smartphone size={13} />
                  <span>APP MOBILE NO TERRENO</span>
                </div>
                <h3 className="lp-bento-title">Ponto GPS, Tarefas &amp; Diário na App</h3>
                <p className="lp-bento-desc">
                  Os colaboradores e encarregados registam o ponto, anexam fotos de tarefas,
                  consultam materiais e reportam segurança (SST) direto do telemóvel.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[2])}
                className="lp-read-more"
              >
                <span>Ver App Mobile</span>
                <ArrowRight size={16} />
              </button>

              {/* Gráfico de anel tripartido + linha de tendência idêntico ao card direito do frame f_03 */}
              <svg
                className="lp-bento-graphic-right"
                viewBox="0 0 230 230"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Arco Azul Royal */}
                <path
                  d="M48 195 A 92 92 0 0 1 56 88"
                  stroke="#0015D4"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* Arco Sky Blue */}
                <path
                  d="M72 68 A 92 92 0 0 1 134 46"
                  stroke="#5C7FFB"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* Arco Obsidian */}
                <path
                  d="M158 50 A 92 92 0 0 1 218 118"
                  stroke="#010106"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                {/* Linha zig-zag ascendente no centro */}
                <path
                  d="M96 154 L 112 138 L 122 152 L 138 124 L 152 134 L 170 106"
                  stroke="#010106"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M159 105 L 171 105 L 171 117"
                  stroke="#010106"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECÇÃO 3: "VANTAGENS" — COLUNA ESQUERDA + GRELHA 2x2 (f_05)
         ==================================================================== */}
      <section id="vantagens" className="lp-section">
        <div className="lp-container lp-advantages-layout">
          <div className="lp-advantages-intro lp-reveal">
            <h2 className="lp-section-heading" style={{ marginBottom: 14 }}>
              Vantagens
            </h2>
            <p>
              Ouvimos engenheiros, mestres de obra e diretores de construtoras para criar a
              plataforma mais rápida, intuitiva e rigorosa no escritório e no canteiro de obras.
            </p>
          </div>

          <div className="lp-advantages-grid">
            {/* Item 1 */}
            <div className="lp-advantage-cell lp-reveal lp-delay-1">
              <div className="lp-advantage-icon-circle">
                <TrendingUp size={19} strokeWidth={2} />
              </div>
              <div className="lp-advantage-body">
                <h3>Arranque Rápido</h3>
                <p>
                  Sem visitas técnicas demoradas: cria a conta da sua firma, cadastra as obras e
                  gera o PIN dos colaboradores em menos de 5 minutos.
                </p>
                <a href={appUrl} onClick={navigateToCastelloApp} className="lp-advantage-pill">
                  Criar Conta da Firma
                </a>
              </div>
            </div>

            {/* Item 2 */}
            <div className="lp-advantage-cell lp-reveal lp-delay-2">
              <div className="lp-advantage-icon-circle">
                <Headphones size={19} strokeWidth={2} />
              </div>
              <div className="lp-advantage-body">
                <h3>Suporte &amp; Portal do Cliente</h3>
                <p>
                  Partilhe o progresso da obra através de um link exclusivo para o seu cliente e
                  conte com suporte dedicado para toda a sua equipa.
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxScreen(CASTELLO_SCREENS[1])}
                  className="lp-advantage-pill"
                >
                  Ver Demonstração
                </button>
              </div>
            </div>

            {/* Item 3 */}
            <div className="lp-advantage-cell lp-reveal lp-delay-3">
              <div className="lp-advantage-icon-circle">
                <Wallet size={19} strokeWidth={2} />
              </div>
              <div className="lp-advantage-body">
                <h3>Zero Desvios de Orçamento</h3>
                <p>
                  Cruze automaticamente as horas aprovadas das equipas com a taxa horária, compras
                  de materiais, autos de medição e fluxo de caixa.
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxScreen(CASTELLO_SCREENS[4])}
                  className="lp-advantage-pill"
                >
                  Explorar Financeiro
                </button>
              </div>
            </div>

            {/* Item 4 */}
            <div className="lp-advantage-cell lp-reveal lp-delay-4">
              <div className="lp-advantage-icon-circle">
                <CheckCircle2 size={19} strokeWidth={2} />
              </div>
              <div className="lp-advantage-body">
                <h3>Qualquer Dimensão de Obra</h3>
                <p>
                  Desde remodelações residenciais até grandes empreitadas com dezenas de equipas e
                  carrinhas em simultâneo: o Castello escala consigo.
                </p>
                <a href={appUrl} onClick={navigateToCastelloApp} className="lp-advantage-pill">
                  Começar Agora
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECÇÃO 4: "OS NOSSOS MÓDULOS" — 8 MEDALHÕES CIRCULARES (f_07)
         ==================================================================== */}
      <section id="modulos" className="lp-partners-section">
        <div className="lp-container">
          <h2 className="lp-section-heading lp-reveal">Ecossistema de Módulos</h2>
          <p className="lp-partners-subtitle lp-reveal lp-delay-1">
            Todos os departamentos da sua construtora integrados nativamente entre o Painel Web e a
            App Mobile
          </p>

          <div className="lp-medallions-row lp-reveal lp-delay-2">
            {[
              { Icon: Building2, label: 'Obras', screenIdx: 0 },
              { Icon: Clock, label: 'Ponto GPS', screenIdx: 1 },
              { Icon: Users, label: 'Equipas', screenIdx: 5 },
              { Icon: Wallet, label: 'Financeiro', screenIdx: 4 },
              { Icon: Calendar, label: 'Calendário', screenIdx: 3 },
              { Icon: Truck, label: 'Carrinhas', screenIdx: 1 },
              { Icon: HardHat, label: 'SST & Tarefas', screenIdx: 2 },
              { Icon: ShieldCheck, label: 'RGPD & PIN', screenIdx: 4 },
            ].map((item, idx) => {
              const IconComp = item.Icon;
              return (
                <div
                  key={idx}
                  className="lp-medallion"
                  onClick={() => setLightboxScreen(CASTELLO_SCREENS[item.screenIdx])}
                  title={`Ver módulo ${item.label} no Castello`}
                >
                  <IconComp size={22} strokeWidth={1.85} />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECÇÃO 5: BANNER ESCURO "MANTENHA O PULSO DA OBRA" + TELEMÓVEL PARALLAX (f_09)
         ==================================================================== */}
      <section className="lp-pulse-section">
        <div className="lp-container">
          <div className="lp-pulse-banner lp-reveal">
            {/* Linhas de onda em perspetiva no fundo do banner escuro (igual ao f_09) */}
            <svg
              className="lp-pulse-waves-bg"
              viewBox="0 0 1200 360"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <path
                  key={i}
                  d={`M -50 ${40 + i * 26} Q 540 ${10 + i * 18}, 1250 ${90 + i * 24}`}
                  stroke="#5C7FFB"
                  strokeWidth="1"
                  strokeOpacity={0.35 - i * 0.02}
                />
              ))}
            </svg>

            <div className="lp-pulse-left">
              {/* Ícone de onda branca à esquerda como no f_09 */}
              <svg
                width="74"
                height="42"
                viewBox="0 0 74 42"
                fill="none"
                style={{ marginBottom: 14 }}
                aria-hidden="true"
              >
                <path
                  d="M2 38 C 18 12, 28 6, 38 22 C 46 36, 58 34, 72 20"
                  stroke="#FFFFFF"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>

              <h2 className="lp-pulse-title">
                Mantenha o Pulso de Todas as Obras em Tempo Real
              </h2>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a href={appUrl} onClick={navigateToCastelloApp} className="lp-btn-white-lg">
                  <Smartphone size={17} />
                  <span>Aceder ao Web &amp; App</span>
                </a>
              </div>
            </div>

            {/* Telemóvel/Card vertical que ultrapassa o topo e a base do banner escuro com parallax (f_09) */}
            <div
              className="lp-pulse-floating-phone"
              onClick={() => setLightboxScreen(CASTELLO_SCREENS[0])}
              style={{
                transform: `translate3d(0, ${pulseParallaxY}px, 0)`,
                cursor: 'pointer',
              }}
              title="Clique para inspecionar a tela real da App Mobile"
            >
              <div style={{ textAlign: 'center', padding: '6px 0 12px' }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: '#64748B',
                    textTransform: 'uppercase',
                  }}
                >
                  ORÇAMENTO PREVISTO DA OBRA
                </div>
                <div
                  style={{
                    fontSize: 25,
                    fontWeight: 700,
                    color: '#010106',
                    letterSpacing: '-0.02em',
                    marginTop: 2,
                  }}
                >
                  € 150.000,00
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0015D4' }}>
                  +14.5h Equipa 1 • Turno Validado
                </div>
              </div>

              <img
                src="/landing/app-mobile-screen-1.jpg"
                alt="Castello App Mobile — Obra Apartamento do Luiz"
                style={{
                  width: '100%',
                  height: 290,
                  objectFit: 'cover',
                  objectPosition: 'center 22%',
                  borderRadius: 18,
                  display: 'block',
                  border: '1px solid #E2E8F0',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECÇÃO 6: "GESTÃO EM TEMPO REAL" — CARTÃO ESCURO INCLINADO (f_11)
         ==================================================================== */}
      <section id="tempo-real" className="lp-section">
        <div className="lp-container lp-realtime-grid">
          {/* Esquerda: Cartão escuro inclinado com cartão Royal/Sky Blue por trás (f_11) */}
          <div className="lp-tilted-chart-stack lp-reveal">
            <div className="lp-tilted-accent-backing" />
            <div className="lp-tilted-dark-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  {webRealtimeScreens.map((tab, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveWebTab(i as 0 | 1 | 2)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 8,
                        border: 'none',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        background:
                          activeWebTab === i ? '#0015D4' : 'rgba(255, 255, 255, 0.08)',
                        color: activeWebTab === i ? '#FFFFFF' : '#94A3B8',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {i === 0 ? 'Dashboard' : i === 1 ? 'Calendário' : 'Equipa & PIN'}
                    </button>
                  ))}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                    {webRealtimeScreens[activeWebTab].metric}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#5C7FFB' }}>
                    {webRealtimeScreens[activeWebTab].delta}
                  </div>
                </div>
              </div>

              {/* Imagem Real do Painel Web ERP Castello */}
              <div
                onClick={() =>
                  setLightboxScreen(
                    activeWebTab === 0
                      ? CASTELLO_SCREENS[1]
                      : activeWebTab === 1
                      ? CASTELLO_SCREENS[3]
                      : CASTELLO_SCREENS[4]
                  )
                }
                style={{ cursor: 'pointer', position: 'relative' }}
                title="Clique para ampliar a captura real do Painel Web"
              >
                <img
                  src={webRealtimeScreens[activeWebTab].src}
                  alt={webRealtimeScreens[activeWebTab].title}
                  style={{
                    width: '100%',
                    height: 235,
                    objectFit: 'cover',
                    objectPosition: 'top left',
                    borderRadius: 16,
                    display: 'block',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                />
              </div>

              {/* Linha de gráfico em tempo real estilo f_11 na base do cartão escuro */}
              <svg
                viewBox="0 0 420 58"
                fill="none"
                style={{ width: '100%', height: 48, marginTop: 10, display: 'block' }}
                aria-hidden="true"
              >
                <path
                  d="M4 44 Q 42 14, 78 26 T 152 20 T 226 36 T 302 14 T 378 24 L 416 10"
                  stroke="#5C7FFB"
                  strokeWidth="2.2"
                  fill="none"
                />
                <path
                  d="M4 52 C 110 46, 240 48, 416 28"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1.2"
                  fill="none"
                />
              </svg>
            </div>
          </div>

          {/* Direita: Texto "Sincronização em Tempo Real" (f_11) */}
          <div className="lp-reveal lp-delay-1">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: '#0015D4',
                background: '#EEF1FF',
                padding: '5px 12px',
                borderRadius: 999,
                marginBottom: 14,
              }}
            >
              <Sparkles size={13} />
              <span>WEB &amp; MOBILE EM SIMULTÂNEO</span>
            </div>

            <h2 className="lp-section-heading" style={{ marginBottom: 18 }}>
              Operação em Tempo Real
            </h2>

            <p
              style={{
                fontSize: 16,
                lineHeight: 1.65,
                color: '#5A6478',
                margin: '0 0 24px',
                maxWidth: 460,
              }}
            >
              Sem esperas nem folhas de ponto em papel ao final do mês. Cada entrada de turno,
              tarefa concluída com foto, alocação de equipa ou lançamento financeiro feito na App
              Mobile atualiza o Painel Web da administração no mesmo segundo.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[1])}
                className="lp-btn-login"
              >
                Inspecionar Painel Web
              </button>
              <button
                type="button"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[2])}
                className="lp-btn-login"
              >
                Inspecionar App Mobile
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECÇÃO 7: "100% DA SUA FIRMA NO WEB E NA APP" + 3 CARTÕES FLUTUANTES
                    + LINHA SINUOSA ATÉ AO CTA FINAL (f_11, f_13)
         ==================================================================== */}
      <section className="lp-stonks-section">
        <div className="lp-container">
          <div className="lp-stonks-grid">
            {/* Esquerda: Título + Texto */}
            <div className="lp-reveal">
              <h2 className="lp-section-heading" style={{ marginBottom: 20 }}>
                100% da Sua Firma
                <br />
                no Web e na App
              </h2>
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.68,
                  color: '#5A6478',
                  maxWidth: 430,
                  margin: 0,
                }}
              >
                Gira todas as frentes de obra através do Castello e tenha acesso imediato a
                presenças, equipas, tarefas com fotografia, segurança no trabalho (SST), carrinhas
                e tesouraria. Tudo desenhado sob medida para a construção civil.
              </p>
            </div>

            {/* Direita: Orbe circular + 3 cartões horizontais flutuantes com dados reais do Castello (f_11) */}
            <div className="lp-floating-cards-stage lp-reveal lp-delay-1">
              <div className="lp-accent-circle-orb" />

              {/* Linha sinuosa preta que passa por trás dos 3 cartões e desce para o CTA central (f_11, f_13) */}
              <svg
                viewBox="0 0 500 470"
                fill="none"
                style={{
                  position: 'absolute',
                  left: -40,
                  top: -10,
                  width: 520,
                  height: 470,
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
                aria-hidden="true"
              >
                <path
                  d="M 330 28 C 245 14, 175 72, 162 126 C 148 180, 176 226, 210 214 C 242 202, 224 166, 194 188 C 166 208, 186 270, 198 334 C 210 398, 120 395, 76 456"
                  stroke="#010106"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>

              {/* Cartão Flutuante 1 */}
              <div
                className="lp-floating-module-pill"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[0])}
                style={{
                  transform: `translate3d(${floatingCard1X}px, 0, 0) rotate(5deg)`,
                  marginLeft: 24,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#010106',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#010106' }}>
                      Apartamento do Luiz
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                      #CST-A7JS • Obra Ativa
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#010106' }}>
                    € 150.000,00
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0015D4' }}>
                    5 Tarefas Validadas
                  </div>
                </div>
              </div>

              {/* Cartão Flutuante 2 */}
              <div
                className="lp-floating-module-pill"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[5])}
                style={{
                  transform: `translate3d(${floatingCard2X}px, 0, 0) rotate(-3deg)`,
                  marginLeft: 48,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#EEF1FF',
                      color: '#0015D4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#010106' }}>
                      Equipa 1 • Samuel Oliveira
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                      3 Integrantes • Ponto GPS
                    </div>
                  </div>
                </div>

                {/* Mini sparkline igual ao f_11 */}
                <svg width="56" height="22" viewBox="0 0 56 22" fill="none" aria-hidden="true">
                  <path
                    d="M2 16 L 14 10 L 24 15 L 36 6 L 46 11 L 54 4"
                    stroke="#0015D4"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#010106' }}>14.5h</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>Aprovado</div>
                </div>
              </div>

              {/* Cartão Flutuante 3 */}
              <div
                className="lp-floating-module-pill"
                onClick={() => setLightboxScreen(CASTELLO_SCREENS[2])}
                style={{
                  transform: `translate3d(${floatingCard3X}px, 0, 0) rotate(2deg)`,
                  marginLeft: 76,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: '#DCE4FF',
                      color: '#010F6B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileCheck2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#010106' }}>
                      SST &amp; Diário de Obra
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                      Rebocar parede externa
                    </div>
                  </div>
                </div>

                <svg width="56" height="22" viewBox="0 0 56 22" fill="none" aria-hidden="true">
                  <path
                    d="M2 18 L 16 14 L 28 16 L 40 7 L 54 3"
                    stroke="#5C7FFB"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#010106' }}>0 Acidentes</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0015D4' }}>+300% Meta</div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Final Centralizado no Fim da Linha Sinuosa (f_13) */}
          <div className="lp-final-cta-center lp-reveal">
            <h2 className="lp-final-cta-title">
              Comece Gratuitamente
              <br />e Controle as Suas Obras Agora
            </h2>

            <a
              href={appUrl}
              onClick={navigateToCastelloApp}
              className="lp-btn-dark lp-btn-dark-lg"
            >
              <Smartphone size={17} />
              <span>Aceder ao Sistema Web &amp; App</span>
            </a>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECÇÃO 8: FOOTER ESCURO OBSIDIAN (f_13)
         ==================================================================== */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-grid">
          {/* Coluna 1: Marca Castello com Círculo de Destaque */}
          <div>
            <a
              href="#topo"
              className="lp-brand"
              style={{ color: '#FFFFFF', marginBottom: 14 }}
            >
              <img
                src="/logo.webp"
                alt="Castello"
                width={32}
                height={32}
                style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }}
              />
              <span className="lp-brand-dot" style={{ zIndex: 1 }}>
                Castello
              </span>
            </a>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: '#8E98AD',
                maxWidth: 250,
                margin: '12px 0 0',
              }}
            >
              Ecossistema Web &amp; Mobile para gestão de obras, validação de ponto GPS, equipas e
              controlo financeiro na construção civil.
            </p>
          </div>

          {/* Coluna 2: Recursos */}
          <div className="lp-footer-col">
            <h4>Plataforma</h4>
            <ul className="lp-footer-links">
              <li>
                <button type="button" onClick={() => setLightboxScreen(CASTELLO_SCREENS[1])}>
                  Painel Web ERP
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setLightboxScreen(CASTELLO_SCREENS[0])}>
                  App Mobile (Android &amp; iOS)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setLightboxScreen(CASTELLO_SCREENS[3])}>
                  Calendário &amp; Cronograma
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setLightboxScreen(CASTELLO_SCREENS[4])}>
                  Controlo de Ponto &amp; PIN
                </button>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Empresa & Legal */}
          <div className="lp-footer-col">
            <h4>Empresa</h4>
            <ul className="lp-footer-links">
              <li>
                <a href="#vantagens">Vantagens</a>
              </li>
              <li>
                <a href="#modulos">Módulos</a>
              </li>
              <li>
                <a href="/privacidade">Política de Privacidade</a>
              </li>
              <li>
                <a href="/termos">Termos de Serviço</a>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Newsletter / Acesso Rápido (f_13) */}
          <div className="lp-footer-col">
            <h4>Receba Novidades do Castello</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newsletterEmail.trim()) {
                  setNewsletterSent(true);
                  setNewsletterEmail('');
                }
              }}
              className="lp-newsletter-box"
            >
              <input
                type="email"
                placeholder="O seu e-mail profissional"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                required
              />
              <button type="submit" className="lp-newsletter-submit" aria-label="Subscrever">
                <ArrowRight size={17} />
              </button>
            </form>

            {newsletterSent && (
              <div style={{ fontSize: 12.5, color: '#5C7FFB', marginBottom: 12, fontWeight: 600 }}>
                Obrigado! O seu e-mail foi registado com sucesso.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#8E98AD', fontSize: 12.5 }}>
              <MapPin size={14} color="#5C7FFB" />
              <span>Portugal &amp; Europa • Conformidade RGPD</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ====================================================================
          MODAL LIGHTBOX INTERATIVO PARA VER AS CAPTURAS REAIS WEB & MOBILE
         ==================================================================== */}
      {lightboxScreen && (
        <div
          onClick={() => setLightboxScreen(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(1, 1, 6, 0.84)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: lightboxScreen.platform === 'mobile' ? 460 : 980,
              backgroundColor: '#0A0E1C',
              borderRadius: 24,
              border: '1px solid rgba(92, 127, 251, 0.28)',
              padding: 24,
              color: '#FFFFFF',
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.75)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#5C7FFB',
                    backgroundColor: 'rgba(92, 127, 251, 0.14)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    marginBottom: 6,
                  }}
                >
                  {lightboxScreen.badge}
                </span>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                  {lightboxScreen.title}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#94A3B8' }}>
                  {lightboxScreen.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLightboxScreen(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: '#010106',
                textAlign: 'center',
              }}
            >
              <img
                src={lightboxScreen.src}
                alt={lightboxScreen.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '64vh',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
            </div>

            {/* Seletor rápido de todas as 6 capturas reais do sistema */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 18,
              }}
            >
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CASTELLO_SCREENS.map((scr) => (
                  <button
                    key={scr.id}
                    type="button"
                    onClick={() => setLightboxScreen(scr)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border:
                        scr.id === lightboxScreen.id
                          ? '1px solid #5C7FFB'
                          : '1px solid rgba(255,255,255,0.12)',
                      background:
                        scr.id === lightboxScreen.id
                          ? '#0015D4'
                          : 'rgba(255,255,255,0.05)',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {scr.badge.replace('Sistema Web • ', 'Web: ').replace('App Mobile • ', 'App: ')}
                  </button>
                ))}
              </div>

              <a
                href={appUrl}
                onClick={navigateToCastelloApp}
                className="lp-btn-white-lg"
                style={{ padding: '9px 18px', fontSize: 13 }}
              >
                <span>Entrar no Sistema</span>
                <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
