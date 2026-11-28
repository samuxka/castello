import React from 'react';
import { Clock, ShieldCheck, TrendingUp, Building2 } from 'lucide-react';

export const LandingStats: React.FC = () => {
  return (
    <section className="landing-section" style={{
      padding: '70px 0',
      background: 'rgba(0, 21, 212, 0.08)',
      borderTop: '1px solid rgba(92, 127, 251, 0.15)',
      borderBottom: '1px solid rgba(92, 127, 251, 0.15)',
      position: 'relative',
    }}>
      <div className="landing-container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 32,
          textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              +150.000
            </div>
            <div style={{ fontSize: 15, color: '#5C7FFB', fontWeight: 600, marginTop: 4 }}>
              Horas de Trabalho Auditadas
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              Sem divergências ou papel
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              99.8%
            </div>
            <div style={{ fontSize: 15, color: '#10B981', fontWeight: 600, marginTop: 4 }}>
              Precisão de Geofencing GPS
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              Delimitação exata do estaleiro
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              -85%
            </div>
            <div style={{ fontSize: 15, color: '#5C7FFB', fontWeight: 600, marginTop: 4 }}>
              Tempo em Tarefas de RH
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              Exportação direta para contabilidade
            </div>
          </div>

          <div>
            <div style={{ fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              0%
            </div>
            <div style={{ fontSize: 15, color: '#10B981', fontWeight: 600, marginTop: 4 }}>
              Fraudes de Ponto por Terceiros
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              Validação biométrica por foto e PIN
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
