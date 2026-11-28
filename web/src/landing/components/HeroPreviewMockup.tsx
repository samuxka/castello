import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  CheckCircle2,
  MapPin,
  Clock,
  TrendingUp,
  ShieldCheck,
  Building2,
  Users,
  Camera,
  Maximize2
} from 'lucide-react';
import { getAppUrl } from '../utils/domain';

export const HeroPreviewMockup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'web' | 'mobile'>('web');
  const appUrl = getAppUrl();

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 1100, margin: '0 auto' }}>
      {/* Device View Mode Switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 24,
      }}>
        <div style={{
          display: 'inline-flex',
          background: 'rgba(11, 15, 25, 0.85)',
          padding: 5,
          borderRadius: 14,
          border: '1px solid rgba(92, 127, 251, 0.25)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('web')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              background: activeTab === 'web' ? 'linear-gradient(135deg, #0015D4 0%, #010F6B 100%)' : 'transparent',
              color: activeTab === 'web' ? '#FFFFFF' : '#94A3B8',
              boxShadow: activeTab === 'web' ? '0 4px 15px rgba(0, 21, 212, 0.4)' : 'none',
            }}
          >
            <Monitor size={17} />
            <span>Painel Web (Escritório)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mobile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              background: activeTab === 'mobile' ? 'linear-gradient(135deg, #0015D4 0%, #010F6B 100%)' : 'transparent',
              color: activeTab === 'mobile' ? '#FFFFFF' : '#94A3B8',
              boxShadow: activeTab === 'mobile' ? '0 4px 15px rgba(0, 21, 212, 0.4)' : 'none',
            }}
          >
            <Smartphone size={17} />
            <span>App Mobile (Obra & Campo)</span>
          </button>
        </div>
      </div>

      {/* Main Container Showcase */}
      <div style={{ position: 'relative' }}>
        {/* Glow halo behind mockup */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '85%',
          height: '70%',
          background: 'radial-gradient(ellipse at center, rgba(0, 21, 212, 0.35) 0%, rgba(92, 127, 251, 0.1) 50%, transparent 75%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* WEB VIEW TAB */}
        {activeTab === 'web' && (
          <div className="glass-panel-elevated" style={{
            position: 'relative',
            zIndex: 1,
            overflow: 'hidden',
            border: '1px solid rgba(92, 127, 251, 0.3)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 50px rgba(0, 21, 212, 0.25)',
          }}>
            {/* macOS Browser Chrome Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              background: 'rgba(5, 8, 16, 0.95)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: '#10B981' }} />
              </div>

              {/* URL bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '4px 16px',
                borderRadius: 8,
                fontSize: 12,
                color: '#94A3B8',
                maxWidth: 380,
                width: '100%',
                justifyContent: 'center',
              }}>
                <span style={{ color: '#10B981' }}>🔒</span>
                <span style={{ color: '#DCE4FF', fontWeight: 500 }}>app.erpcastle.com</span>
                <span style={{ color: '#64748B' }}>/dashboard</span>
              </div>

              <div style={{ fontSize: 11, color: '#8FA6FF', fontWeight: 600 }}>
                Castello v1.0
              </div>
            </div>

            {/* Content Area: Real Screen with live fallback preview */}
            <div style={{ position: 'relative', background: '#010106' }}>
              <img
                src="/landing/app-web-screen-1.png"
                alt="Castello ERP Web Admin Dashboard"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  maxHeight: 620,
                  objectFit: 'cover',
                  objectPosition: 'top',
                }}
                onError={(e) => {
                  // Fallback para render vetorial de alta definição se a imagem local não carregar
                  (e.target as HTMLElement).style.display = 'none';
                  const fallback = document.getElementById('web-mockup-vector-fallback');
                  if (fallback) fallback.style.display = 'block';
                }}
              />

              {/* Interactive Vector Fallback (always ready) */}
              <div id="web-mockup-vector-fallback" style={{ display: 'none', padding: 24 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  marginBottom: 20
                }}>
                  <div style={{ background: '#0B0F19', padding: 18, borderRadius: 12, border: '1px solid rgba(92,127,251,0.2)' }}>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Obras em Execução</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>12 Obras</div>
                    <div style={{ fontSize: 12, color: '#10B981', marginTop: 4 }}>● 100% no prazo</div>
                  </div>
                  <div style={{ background: '#0B0F19', padding: 18, borderRadius: 12, border: '1px solid rgba(92,127,251,0.2)' }}>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Trabalhadores no Local</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>48 Presentes</div>
                    <div style={{ fontSize: 12, color: '#5C7FFB', marginTop: 4 }}>GPS auditado</div>
                  </div>
                  <div style={{ background: '#0B0F19', padding: 18, borderRadius: 12, border: '1px solid rgba(92,127,251,0.2)' }}>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Margem Financeira Global</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>+21.4%</div>
                    <div style={{ fontSize: 12, color: '#10B981', marginTop: 4 }}>Sem desvios de custo</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MOBILE VIEW TAB */}
        {activeTab === 'mobile' && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
            padding: '10px 0',
          }}>
            {/* Phone Chassis Mockup */}
            <div style={{
              width: 340,
              borderRadius: 44,
              background: '#0B0F19',
              padding: 12,
              border: '3px solid rgba(92, 127, 251, 0.4)',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8), 0 0 50px rgba(0, 21, 212, 0.35)',
              position: 'relative',
            }}>
              {/* Dynamic Island / Speaker Notch */}
              <div style={{
                position: 'absolute',
                top: 18,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 90,
                height: 22,
                backgroundColor: '#010106',
                borderRadius: 20,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0015D4' }} />
              </div>

              {/* Phone Screen */}
              <div style={{
                borderRadius: 34,
                overflow: 'hidden',
                background: '#010106',
                position: 'relative',
                minHeight: 580,
              }}>
                <img
                  src="/landing/app-mobile-screen-1.jpg"
                  alt="Castelo Mobile App - Registo de Ponto com GPS"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    minHeight: 580,
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    // Fallback para screen 2
                    (e.target as HTMLImageElement).src = '/landing/app-mobile-screen-2.jpg';
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* FLOATING STATUS CARDS (Like in the reference video!) */}
        <div
          className="glass-panel animate-float-slow"
          style={{
            position: 'absolute',
            top: '15%',
            left: '-24px',
            padding: '12px 18px',
            border: '1px solid rgba(92, 127, 251, 0.35)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.6), 0 0 20px rgba(0, 21, 212, 0.25)',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 290,
          }}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10B981',
            flexShrink: 0,
          }}>
            <MapPin size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>Ponto Validado via GPS</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>Obra Lisboa Centro • 07:58</div>
          </div>
          <CheckCircle2 size={16} color="#10B981" style={{ marginLeft: 'auto' }} />
        </div>

        <div
          className="glass-panel animate-float-reverse"
          style={{
            position: 'absolute',
            bottom: '12%',
            right: '-20px',
            padding: '12px 18px',
            border: '1px solid rgba(92, 127, 251, 0.35)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.6), 0 0 20px rgba(0, 21, 212, 0.25)',
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 280,
          }}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'rgba(0, 21, 212, 0.2)',
            border: '1px solid rgba(92, 127, 251, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#5C7FFB',
            flexShrink: 0,
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>Margem em Tempo Real</div>
            <div style={{ fontSize: 11, color: '#10B981', fontWeight: 500 }}>+19.4% acima da meta</div>
          </div>
        </div>
      </div>

      {/* Responsive adjustments for floating cards */}
      <style>{`
        @media (max-width: 900px) {
          .animate-float-slow, .animate-float-reverse {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
