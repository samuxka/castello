import React from 'react';
import { ArrowRight, Smartphone, ShieldCheck, Download, Sparkles } from 'lucide-react';
import { getAppUrl } from '../utils/domain';

export const LandingCtaBanner: React.FC = () => {
  const appUrl = getAppUrl();

  return (
    <section id="download-app" className="landing-section" style={{ position: 'relative' }}>
      <div className="landing-container">
        <div className="glass-panel-elevated" style={{
          padding: '60px 40px',
          borderRadius: 28,
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(0, 21, 212, 0.25) 0%, rgba(1, 15, 107, 0.45) 50%, rgba(1, 1, 6, 0.95) 100%)',
          border: '1px solid rgba(92, 127, 251, 0.35)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 50px rgba(0, 21, 212, 0.3)',
          textAlign: 'center',
        }}>
          {/* Radial light glow */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 600,
            height: 350,
            background: 'radial-gradient(ellipse at center, rgba(92, 127, 251, 0.4) 0%, transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto' }}>
            <div className="glass-badge" style={{ marginBottom: 20 }}>
              <Sparkles size={14} color="#5C7FFB" />
              <span>Modernize o seu Estaleiro Hoje</span>
            </div>

            <h2 style={{
              fontSize: 'clamp(30px, 4.5vw, 50px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              marginBottom: 20,
              color: '#FFFFFF',
            }}>
              Pronto para ter controlo total das suas obras e equipas?
            </h2>

            <p style={{
              fontSize: 'clamp(16px, 2vw, 19px)',
              color: '#DCE4FF',
              lineHeight: 1.6,
              marginBottom: 40,
              fontWeight: 400,
            }}>
              Crie a sua conta em menos de 5 minutos, adicione os seus estaleiros e
              disponibilize a app mobile à sua equipa. Sem cartão de crédito.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 32,
            }}>
              <a
                href={appUrl}
                className="btn-primary-landing"
                style={{ fontSize: 16, padding: '15px 34px' }}
              >
                <span>Aceder ao Sistema Web</span>
                <ArrowRight size={18} />
              </a>

              <a
                href="#download-app"
                className="btn-secondary-landing"
                style={{ fontSize: 16, padding: '15px 28px' }}
                onClick={(e) => {
                  e.preventDefault();
                  alert('A App Móvel Android (APK e Play Store) está disponível para instalação direta pela equipa da sua construtora após o registo no painel.');
                }}
              >
                <Smartphone size={18} color="#10B981" />
                <span>Descarregar App Android (.APK)</span>
              </a>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              fontSize: 13,
              color: '#8FA6FF',
              flexWrap: 'wrap',
            }}>
              <span>✓ Teste gratuito sem compromisso</span>
              <span>✓ Dados encriptados com segurança bancária</span>
              <span>✓ Suporte técnico dedicado por WhatsApp e E-mail</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
