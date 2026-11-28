import React from 'react';
import { UserCheck, Smartphone, BarChart3, ArrowRight } from 'lucide-react';
import { getAppUrl } from '../utils/domain';

export const LandingWorkflow: React.FC = () => {
  const appUrl = getAppUrl();

  return (
    <section id="como-funciona" className="landing-section" style={{
      background: 'linear-gradient(180deg, rgba(1, 1, 6, 0.4) 0%, rgba(11, 15, 25, 0.8) 50%, rgba(1, 1, 6, 0.4) 100%)',
      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    }}>
      <div className="landing-container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 60px auto' }}>
          <div className="glass-badge" style={{ marginBottom: 16 }}>
            <span>Implementação Sem Fricção</span>
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            Pronto a funcionar em <span className="gradient-text-vibrant">menos de 5 minutos.</span>
          </h2>
          <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.6 }}>
            Não precisa de técnicos no local nem de formação complexa. O sistema é intuitivo
            tanto para engenheiros como para operários da construção civil.
          </p>
        </div>

        {/* 3 Steps Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 28,
          position: 'relative',
        }}>
          {/* Step 1 */}
          <div className="glass-panel" style={{ padding: 32, position: 'relative' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(0, 21, 212, 0.25)',
              border: '1px solid rgba(92, 127, 251, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5C7FFB',
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 24,
            }}>
              1
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>
              Registe a sua Construtora & Obras
            </h3>
            <p style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.6 }}>
              Aceda à plataforma web, adicione as suas obras ativas e defina a localização
              GPS e o raio de geofencing no mapa com apenas 2 cliques.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-panel" style={{ padding: 32, position: 'relative' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(0, 21, 212, 0.25)',
              border: '1px solid rgba(92, 127, 251, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5C7FFB',
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 24,
            }}>
              2
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>
              A Equipa Descarrega a App
            </h3>
            <p style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.6 }}>
              Os trabalhadores e encarregados instalam a app móvel Android.
              Ao chegar ao estaleiro, o ponto é registado em 3 segundos com validação biométrica e GPS.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-panel" style={{ padding: 32, position: 'relative' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10B981',
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 24,
            }}>
              3
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>
              Controlo em Tempo Real & Relatórios
            </h3>
            <p style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.6 }}>
              Acompanhe quem está em cada obra, desvios orçamentais e descarregue
              relatórios oficiais em Excel para o processamento de salários.
            </p>
          </div>
        </div>

        {/* CTA link */}
        <div style={{ textAlign: 'center', marginTop: 44 }}>
          <a
            href={appUrl}
            className="btn-primary-landing"
            style={{ fontSize: 15 }}
          >
            <span>Configurar a minha construtora agora</span>
            <ArrowRight size={17} />
          </a>
        </div>
      </div>
    </section>
  );
};
