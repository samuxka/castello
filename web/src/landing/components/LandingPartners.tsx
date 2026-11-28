import React from 'react';
import { HardHat, Building, Hammer, ShieldAlert, Award, Compass } from 'lucide-react';

export const LandingPartners: React.FC = () => {
  return (
    <section style={{
      padding: '40px 0 70px 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      position: 'relative',
    }}>
      <div className="landing-container" style={{ textAlign: 'center' }}>
        <p style={{
          fontSize: 13,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#64748B',
          marginBottom: 28,
        }}>
          CONSTRUÍDO PARA EMPRESAS EXIGENTES DO SETOR DA CONSTRUÇÃO CIVIL
        </p>

        {/* Contractor Sector Badges */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          flexWrap: 'wrap',
          opacity: 0.85,
        }}>
          <div style={partnerItemStyle}>
            <Building size={20} color="#5C7FFB" />
            <span>Construção Residencial & Comercial</span>
          </div>
          <div style={partnerItemStyle}>
            <Hammer size={20} color="#5C7FFB" />
            <span>Empreiteiros & Subempreiteiros</span>
          </div>
          <div style={partnerItemStyle}>
            <Compass size={20} color="#5C7FFB" />
            <span>Gabinetes de Engenharia & Fiscalização</span>
          </div>
          <div style={partnerItemStyle}>
            <HardHat size={20} color="#5C7FFB" />
            <span>Remodelações & Reabilitação Urbana</span>
          </div>
        </div>
      </div>
    </section>
  );
};

const partnerItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 14,
  fontWeight: 600,
  color: '#DCE4FF',
  background: 'rgba(255, 255, 255, 0.03)',
  padding: '10px 18px',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.06)',
};
