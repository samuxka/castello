import React from 'react';
import { ArrowRight, Sparkles, Smartphone, ShieldCheck, CheckCircle, Zap } from 'lucide-react';
import { getAppUrl } from '../utils/domain';
import { HeroPreviewMockup } from './HeroPreviewMockup';

export const LandingHero: React.FC = () => {
  const appUrl = getAppUrl();

  return (
    <section style={{
      paddingTop: 130,
      paddingBottom: 60,
      position: 'relative',
      textAlign: 'center',
    }}>
      <div className="landing-container">
        {/* Top Tagline Badge */}
        <div style={{ display: 'inline-flex', marginBottom: 24 }}>
          <div className="glass-badge">
            <span className="pulse-dot" />
            <span style={{ color: '#DCE4FF', fontSize: 13, fontWeight: 500 }}>
              Ecossistema Completo de Gestão de Obras & Ponto Digital
            </span>
          </div>
        </div>

        {/* Main Headline */}
        <h1 style={{
          fontSize: 'clamp(36px, 5.5vw, 68px)',
          fontWeight: 700,
          lineHeight: 1.12,
          letterSpacing: '-0.03em',
          maxWidth: 960,
          margin: '0 auto 22px auto',
        }}>
          Controlo absoluto das suas obras, equipas e finanças{' '}
          <span className="gradient-text-vibrant">num só lugar.</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)',
          lineHeight: 1.6,
          color: '#94A3B8',
          maxWidth: 740,
          margin: '0 auto 36px auto',
          fontWeight: 400,
        }}>
          Elimine o papel, fraudes de ponto e desvios de orçamento. A plataforma moderna
          feita para construtoras e empreiteiros, com gestão Web centralizada e
          App Mobile com GPS em tempo real.
        </p>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 48,
        }}>
          <a
            href={appUrl}
            className="btn-primary-landing"
            style={{ fontSize: 16, padding: '14px 30px' }}
          >
            <span>Começar Agora Gratuitamente</span>
            <ArrowRight size={18} />
          </a>

          <a
            href="#ecossistema"
            className="btn-secondary-landing"
            style={{ fontSize: 16, padding: '14px 26px' }}
          >
            <Zap size={18} color="#5C7FFB" />
            <span>Ver Demonstração</span>
          </a>
        </div>

        {/* Social Proof / Security Micro-Badges */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          flexWrap: 'wrap',
          color: '#64748B',
          fontSize: 13,
          fontWeight: 500,
          marginBottom: 60,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={15} color="#10B981" />
            <span style={{ color: '#DCE4FF' }}>Sem necessidade de cartão</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={15} color="#10B981" />
            <span style={{ color: '#DCE4FF' }}>Conformidade com a Legislação Laboral</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={15} color="#10B981" />
            <span style={{ color: '#DCE4FF' }}>Ativação imediata em 5 minutos</span>
          </div>
        </div>

        {/* Interactive Mockup Container */}
        <HeroPreviewMockup />
      </div>
    </section>
  );
};
