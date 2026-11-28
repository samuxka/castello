import React, { useEffect } from 'react';
import './styles/landing.css';
import { LandingNavbar } from './components/LandingNavbar';
import { LandingHero } from './components/LandingHero';
import { LandingPartners } from './components/LandingPartners';
import { LandingEcosystem } from './components/LandingEcosystem';
import { LandingBentoFeatures } from './components/LandingBentoFeatures';
import { LandingWorkflow } from './components/LandingWorkflow';
import { LandingComparison } from './components/LandingComparison';
import { LandingStats } from './components/LandingStats';
import { LandingTestimonials } from './components/LandingTestimonials';
import { LandingFaq } from './components/LandingFaq';
import { LandingCtaBanner } from './components/LandingCtaBanner';
import { LandingFooter } from './components/LandingFooter';

export const LandingPage: React.FC = () => {
  useEffect(() => {
    // Definir título e meta da página de alta conversão
    const prevTitle = document.title;
    document.title = 'Castello ERP — Gestão de Obras & Ponto Digital na Construção Civil';

    // Scroll suave para links de âncora
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && anchor.hash && anchor.hash.startsWith('#') && anchor.pathname === window.location.pathname) {
        const elem = document.querySelector(anchor.hash);
        if (elem) {
          e.preventDefault();
          elem.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => {
      document.title = prevTitle;
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  return (
    <div className="castello-landing">
      {/* Background radial glow lights (inspirado no vídeo de referência) */}
      <div className="landing-glow-bg" />
      <div className="landing-glow-secondary" />
      <div className="landing-glow-tertiary" />

      {/* Sticky Glass Navbar */}
      <LandingNavbar />

      {/* Main Page Flow */}
      <main>
        {/* Hero Section com Headline, Badges, CTAs e Showcase 3D Interativo */}
        <LandingHero />

        {/* Barra de Credibilidade do Setor */}
        <LandingPartners />

        {/* O Ecossistema Unificado: Web Admin vs App Mobile */}
        <LandingEcosystem />

        {/* Bento Grid de Módulos (Ponto GPS, Finanças, Diário de Obra, Frotas, ACT) */}
        <LandingBentoFeatures />

        {/* Implementação em 3 Passos */}
        <LandingWorkflow />

        {/* Comparativo de Eficiência: Gestão Antiga vs Castello */}
        <LandingComparison />

        {/* Métricas de Impacto em Números */}
        <LandingStats />

        {/* Depoimentos de Clientes do Setor */}
        <LandingTestimonials />

        {/* FAQ Acordeão */}
        <LandingFaq />

        {/* Banner de Conversão Final e Download da App */}
        <LandingCtaBanner />
      </main>

      {/* Footer Completo */}
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
