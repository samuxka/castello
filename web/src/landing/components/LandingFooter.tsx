import React from 'react';
import { ShieldCheck, Mail, Phone, ExternalLink } from 'lucide-react';
import { getAppUrl } from '../utils/domain';

export const LandingFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const appUrl = getAppUrl();

  return (
    <footer style={{
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      background: '#010106',
      padding: '70px 0 35px 0',
      position: 'relative',
      zIndex: 1,
    }}>
      <div className="landing-container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 40,
          marginBottom: 60,
        }}>
          {/* Brand Col */}
          <div style={{ maxWidth: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <img
                src="/logo-full.webp"
                alt="Castello ERP"
                style={{ height: 34, objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.webp';
                }}
              />
            </div>
            <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, marginBottom: 20 }}>
              A solução integrada de gestão de obras, equipas e ponto digital com geofencing
              feita para o setor da construção civil.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8FA6FF' }}>
              <ShieldCheck size={16} color="#10B981" />
              <span>Conforme com a Legislação Laboral & RGPD</span>
            </div>
          </div>

          {/* Links: Plataforma */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FFFFFF', marginBottom: 18 }}>
              Plataforma
            </h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <li><a href="#solucoes" style={footerLinkStyle}>Ponto Digital com GPS</a></li>
              <li><a href="#solucoes" style={footerLinkStyle}>Controlo de Obras & Custos</a></li>
              <li><a href="#solucoes" style={footerLinkStyle}>Diário de Obra Fotográfico</a></li>
              <li><a href="#solucoes" style={footerLinkStyle}>Gestão de Carrinhas & Frotas</a></li>
              <li><a href="#solucoes" style={footerLinkStyle}>Inventário & Ferramentas</a></li>
              <li><a href={appUrl} style={{ ...footerLinkStyle, color: '#5C7FFB', fontWeight: 600 }}>Aceder ao Sistema (app.erpcastle.com)</a></li>
            </ul>
          </div>

          {/* Links: Soluções */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FFFFFF', marginBottom: 18 }}>
              Setores
            </h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <li><a href="#ecossistema" style={footerLinkStyle}>Construção Residencial</a></li>
              <li><a href="#ecossistema" style={footerLinkStyle}>Empreiteiros Gerais</a></li>
              <li><a href="#ecossistema" style={footerLinkStyle}>Obras Públicas</a></li>
              <li><a href="#ecossistema" style={footerLinkStyle}>Subempreiteiros & Especialidades</a></li>
              <li><a href="#ecossistema" style={footerLinkStyle}>Remodelações & Reabilitação</a></li>
            </ul>
          </div>

          {/* Links: Legal & Contacto */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FFFFFF', marginBottom: 18 }}>
              Legal & Suporte
            </h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <li><a href="/termos" style={footerLinkStyle}>Termos de Utilização</a></li>
              <li><a href="/privacidade" style={footerLinkStyle}>Política de Privacidade</a></li>
              <li><a href="#faq" style={footerLinkStyle}>Perguntas Frequentes</a></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 13, marginTop: 8 }}>
                <Mail size={15} color="#5C7FFB" />
                <span>suporte@erpcastle.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          fontSize: 13,
          color: '#64748B',
        }}>
          <div>
            © {currentYear} Castello ERP & Ponto. Todos os direitos reservados.
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href="/termos" style={{ color: '#64748B', textDecoration: 'none' }}>Termos</a>
            <a href="/privacidade" style={{ color: '#64748B', textDecoration: 'none' }}>Privacidade</a>
            <a href="https://erpcastle.com" style={{ color: '#8FA6FF', textDecoration: 'none' }}>erpcastle.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

const footerLinkStyle: React.CSSProperties = {
  color: '#94A3B8',
  textDecoration: 'none',
  fontSize: 14,
  transition: 'color 0.2s ease',
};
