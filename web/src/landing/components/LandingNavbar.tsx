import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowRight, Smartphone, ShieldCheck, ExternalLink } from 'lucide-react';
import { getAppUrl } from '../utils/domain';

export const LandingNavbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const appUrl = getAppUrl();

  return (
    <header className="landing-navbar-sticky" style={{
      boxShadow: scrolled ? '0 12px 40px rgba(0, 0, 0, 0.7)' : '0 10px 30px rgba(0, 0, 0, 0.4)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
      }}>
        {/* Logo & Brand */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img
            src="/logo-full.webp"
            alt="Castello ERP"
            style={{ height: 34, objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo.webp';
            }}
          />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: 'rgba(0, 21, 212, 0.25)',
            color: '#8FA6FF',
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid rgba(92, 127, 251, 0.3)',
            display: 'none',
          }}>
            ERP & PONTO
          </span>
        </a>

        {/* Desktop Nav Links */}
        <nav style={{ display: 'none' }} className="landing-desktop-nav">
          <ul style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            listStyle: 'none',
            margin: 0,
            padding: 0
          }}>
            <li>
              <a href="#solucoes" style={navLinkStyle}>Módulos</a>
            </li>
            <li>
              <a href="#ecossistema" style={navLinkStyle}>Web & Mobile</a>
            </li>
            <li>
              <a href="#vantagens" style={navLinkStyle}>Vantagens</a>
            </li>
            <li>
              <a href="#como-funciona" style={navLinkStyle}>Como Funciona</a>
            </li>
            <li>
              <a href="#faq" style={navLinkStyle}>FAQ</a>
            </li>
          </ul>
        </nav>

        {/* Desktop Actions */}
        <div style={{ display: 'none', alignItems: 'center', gap: 12 }} className="landing-desktop-actions">
          <a
            href="#download-app"
            style={{
              color: '#B9C8FF',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#B9C8FF'}
          >
            <Smartphone size={16} />
            App Mobile
          </a>

          <a
            href={appUrl}
            className="btn-primary-landing"
            style={{
              padding: '9px 18px',
              fontSize: 14,
              borderRadius: 10,
            }}
          >
            <span>Aceder ao Sistema</span>
            <ArrowRight size={15} />
          </a>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Abrir menu"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="landing-mobile-menu-btn"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          padding: '16px 20px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(1, 1, 6, 0.96)',
          borderRadius: '0 0 16px 16px',
        }}>
          <ul style={{
            listStyle: 'none',
            margin: '0 0 20px 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <li>
              <a
                href="#solucoes"
                onClick={() => setMobileMenuOpen(false)}
                style={mobileNavLinkStyle}
              >
                Módulos do Sistema
              </a>
            </li>
            <li>
              <a
                href="#ecossistema"
                onClick={() => setMobileMenuOpen(false)}
                style={mobileNavLinkStyle}
              >
                Web & Mobile Integrados
              </a>
            </li>
            <li>
              <a
                href="#vantagens"
                onClick={() => setMobileMenuOpen(false)}
                style={mobileNavLinkStyle}
              >
                Vantagens & Conformidade
              </a>
            </li>
            <li>
              <a
                href="#como-funciona"
                onClick={() => setMobileMenuOpen(false)}
                style={mobileNavLinkStyle}
              >
                Como Funciona
              </a>
            </li>
            <li>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                style={mobileNavLinkStyle}
              >
                Perguntas Frequentes
              </a>
            </li>
          </ul>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href={appUrl}
              className="btn-primary-landing"
              style={{ width: '100%', boxSizing: 'border-box' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>Aceder ao Sistema</span>
              <ArrowRight size={16} />
            </a>
            <a
              href="#download-app"
              className="btn-secondary-landing"
              style={{ width: '100%', boxSizing: 'border-box' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Smartphone size={16} />
              <span>Descarregar App Android</span>
            </a>
          </div>
        </div>
      )}

      {/* Inline styles for media query toggles */}
      <style>{`
        @media (min-width: 860px) {
          .landing-desktop-nav {
            display: block !important;
          }
          .landing-desktop-actions {
            display: flex !important;
          }
          .landing-mobile-menu-btn {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};

const navLinkStyle: React.CSSProperties = {
  color: '#D2D8E4',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 500,
  transition: 'color 0.2s ease',
  letterSpacing: '-0.01em',
};

const mobileNavLinkStyle: React.CSSProperties = {
  color: '#F5F7FB',
  textDecoration: 'none',
  fontSize: 16,
  fontWeight: 500,
  display: 'block',
  padding: '6px 0',
};
