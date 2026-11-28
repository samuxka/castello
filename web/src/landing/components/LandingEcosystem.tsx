import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  CheckCircle2,
  DollarSign,
  Clock,
  MapPin,
  Camera,
  FileSpreadsheet,
  Truck,
  Boxes,
  Users,
  ShieldCheck,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { getAppUrl } from '../utils/domain';

export const LandingEcosystem: React.FC = () => {
  const [selectedSide, setSelectedSide] = useState<'web' | 'mobile'>('web');
  const appUrl = getAppUrl();

  return (
    <section id="ecossistema" className="landing-section">
      <div className="landing-container">
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: 780, margin: '0 auto 60px auto' }}>
          <div className="glass-badge" style={{ marginBottom: 16 }}>
            <span>O Ecossistema Castello</span>
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 46px)',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            marginBottom: 18,
          }}>
            Uma plataforma unificada entre o <span className="gradient-text-vibrant">Escritório e o Terreno.</span>
          </h2>
          <p style={{ fontSize: 17, color: '#94A3B8', lineHeight: 1.6 }}>
            O Castello conecta em tempo real a administração da sua construtora aos encarregados
            e equipas em cada obra, eliminando falhas de comunicação e folhas de ponto em papel.
          </p>
        </div>

        {/* Dual Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 32,
        }}>
          {/* CARD 1: PAINEL WEB */}
          <div className="bento-card" style={{
            border: selectedSide === 'web' ? '1px solid rgba(92, 127, 251, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: selectedSide === 'web' ? '0 15px 40px rgba(0, 21, 212, 0.25)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(0, 21, 212, 0.2)',
                border: '1px solid rgba(92, 127, 251, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5C7FFB',
              }}>
                <Monitor size={24} />
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#8FA6FF',
                background: 'rgba(92, 127, 251, 0.1)',
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid rgba(92, 127, 251, 0.25)',
              }}>
                Para Gestores & Engenharia
              </span>
            </div>

            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>
              Painel Web de Gestão Central
            </h3>
            <p style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.6, marginBottom: 24 }}>
              Visão 360º de todas as obras, orçamentos, assiduidade e equipas num só ecrã
              sem sair do escritório.
            </p>

            {/* Feature List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
              <div style={featureItemStyle}>
                <CheckCircle2 size={18} color="#10B981" />
                <span><strong>Controlo de Custos por Obra:</strong> Orçamentado vs. Gasto real e margem de lucro.</span>
              </div>
              <div style={featureItemStyle}>
                <CheckCircle2 size={18} color="#10B981" />
                <span><strong>Relatórios Oficiais de Assiduidade:</strong> Exportação para Excel/PDF para contabilidade e ACT.</span>
              </div>
              <div style={featureItemStyle}>
                <CheckCircle2 size={18} color="#10B981" />
                <span><strong>Gestão de Frotas & Carrinhas:</strong> Atribuição de carrinhas às equipas e fiscalização.</span>
              </div>
              <div style={featureItemStyle}>
                <CheckCircle2 size={18} color="#10B981" />
                <span><strong>Inventário de Equipamentos:</strong> Rastreie ferramentas caras e máquinas em cada local.</span>
              </div>
            </div>

            {/* Visual Thumbnail */}
            <div style={{
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#010106',
              marginBottom: 20,
            }}>
              <img
                src="/landing/app-web-screen-2.png"
                alt="Gestão Web Castello"
                style={{ width: '100%', height: 210, objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/landing/app-web-screen-1.png';
                }}
              />
            </div>

            <a
              href={appUrl}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: '#5C7FFB',
                fontWeight: 600,
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              <span>Explorar painel web</span>
              <ArrowRight size={16} />
            </a>
          </div>

          {/* CARD 2: APP MOBILE */}
          <div className="bento-card" style={{
            border: selectedSide === 'mobile' ? '1px solid rgba(92, 127, 251, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: selectedSide === 'mobile' ? '0 15px 40px rgba(0, 21, 212, 0.25)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}>
                <Smartphone size={24} />
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#A7F3D0',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}>
                Para Encarregados & Trabalhadores
              </span>
            </div>

            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>
              App Mobile de Campo (Android)
            </h3>
            <p style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.6, marginBottom: 24 }}>
              Criada especificamente para o ritmo exigente da construção. Rápida, intuitiva
              e com validação biométrica e GPS à prova de fraudes.
            </p>

            {/* Feature List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
              <div style={featureItemStyle}>
                <CheckCircle2 size={18} color="#10B981" />
                <span><strong>Ponto Digital com Geofencing:</strong> O funcionário só consegue bater ponto dentro do raio da obra.</span>
              </div>
              <div style={featureItemStyle}>
                <CheckCircle2 size={18} color="#10B981" />
                <span><strong>Diário de Obra Fotográfico:</strong> Registe o avanço físico da obra com fotografias georreferenciadas.</span>
              </div>
              <div style={featureItemStyle}>
                <CheckCircle2 size={18} color="#10B981" />
                <span><strong>Justificação de Faltas & Atestados:</strong> Envio imediato da fotografia do documento para o escritório.</span>
              </div>
              <div style={featureItemStyle}>
                <CheckCircle2 size={18} color="#10B981" />
                <span><strong>Modo Offline com Sincronização:</strong> Sem rede na cave ou no subsolo? O ponto fica guardado e envia depois.</span>
              </div>
            </div>

            {/* Visual Thumbnail */}
            <div style={{
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#010106',
              marginBottom: 20,
            }}>
              <img
                src="/landing/app-mobile-screen-2.jpg"
                alt="App Mobile Castello"
                style={{ width: '100%', height: 210, objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/landing/app-mobile-screen-1.jpg';
                }}
              />
            </div>

            <a
              href="#download-app"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: '#10B981',
                fontWeight: 600,
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              <span>Descarregar app para a equipa</span>
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

const featureItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  fontSize: 14,
  color: '#DCE4FF',
  lineHeight: 1.5,
};
