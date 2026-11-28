import React from 'react';
import {
  MapPin,
  DollarSign,
  Camera,
  Truck,
  ShieldCheck,
  FileSpreadsheet,
  Clock,
  WifiOff,
  Users2
} from 'lucide-react';

export const LandingBentoFeatures: React.FC = () => {
  return (
    <section id="solucoes" className="landing-section" style={{ position: 'relative' }}>
      <div className="landing-container">
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 60px auto' }}>
          <div className="glass-badge" style={{ marginBottom: 16 }}>
            <span>Módulos de Alta Performance</span>
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 46px)',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            marginBottom: 18,
          }}>
            Tudo o que a sua construtora precisa, <span className="gradient-text-vibrant">sem complicações.</span>
          </h2>
          <p style={{ fontSize: 17, color: '#94A3B8', lineHeight: 1.6 }}>
            Desenvolvido com foco na realidade dos estaleiros de obra: simples para o trabalhador,
            rigoroso e detalhado para a administração.
          </p>
        </div>

        {/* Bento Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 24,
        }}>
          {/* Bento Card 1: Ponto Digital Geofencing (Larger card - 8 cols) */}
          <div className="bento-card" style={{ gridColumn: 'span 8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={iconBoxStyle('#0015D4', '#5C7FFB')}>
                <MapPin size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5C7FFB', textTransform: 'uppercase' }}>
                  Auditoria de Presenças
                </span>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Ponto Digital com Geofencing & Foto Anti-Fraude
                </h3>
              </div>
            </div>

            <p style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.6, marginBottom: 20 }}>
              Acabe de vez com o "amigo que bate o ponto pelo outro". O Castello valida a posição
              GPS em tempo real (raio delimitado da obra) e tira uma selfie instantânea de confirmação.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              background: 'rgba(1, 1, 6, 0.6)',
              padding: 16,
              borderRadius: 14,
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={16} color="#10B981" />
                <span style={{ fontSize: 13, color: '#DCE4FF' }}>Horas exatas ao segundo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <WifiOff size={16} color="#5C7FFB" />
                <span style={{ fontSize: 13, color: '#DCE4FF' }}>Suporte a modo Offline</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={16} color="#10B981" />
                <span style={{ fontSize: 13, color: '#DCE4FF' }}>100% à prova de falsificações</span>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Controlo Financeiro (4 cols) */}
          <div className="bento-card" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={iconBoxStyle('#059669', '#10B981')}>
                <DollarSign size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981', textTransform: 'uppercase' }}>
                  Gestão Orçamental
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Margens & Custos por Obra
                </h3>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, marginBottom: 16 }}>
              Acompanhe compras de materiais, faturas de fornecedores e autos de medição com
              cálculo instantâneo de rentabilidade.
            </p>

            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 12,
              padding: 14,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#A7F3D0', fontWeight: 600, textTransform: 'uppercase' }}>Margem Média Monitorizada</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>+21.8%</div>
            </div>
          </div>

          {/* Bento Card 3: Diário de Obra Fotográfico (4 cols) */}
          <div className="bento-card" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={iconBoxStyle('#7C3AED', '#A78BFA')}>
                <Camera size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#A78BFA', textTransform: 'uppercase' }}>
                  Registo Visual
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Diário de Obra Digital
                </h3>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
              O encarregado tira fotografias do progresso físico diretamente na app. Ficam catalogadas
              por data, obra e hora para consulta imediata no escritório.
            </p>
          </div>

          {/* Bento Card 4: Frotas e Carrinhas (4 cols) */}
          <div className="bento-card" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={iconBoxStyle('#D97706', '#FBBF24')}>
                <Truck size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FBBF24', textTransform: 'uppercase' }}>
                  Logística
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Gestão de Carrinhas & Frota
                </h3>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
              Saiba que carrinha está com que equipa, quem é o condutor responsável e controle
              gastos de combustível e inspeções periódicas.
            </p>
          </div>

          {/* Bento Card 5: Relatórios Fiscais ACT e Exportação (4 cols) */}
          <div className="bento-card" style={{ gridColumn: 'span 4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={iconBoxStyle('#0015D4', '#5C7FFB')}>
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5C7FFB', textTransform: 'uppercase' }}>
                  Conformidade Legal
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Exportação Excel & PDF (ACT)
                </h3>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
              Gere folhas de horas mensais com um clique, prontas para enviar à contabilidade e
              em total cumprimento das normas da ACT e RGPD.
            </p>
          </div>
        </div>
      </div>

      {/* Responsive Grid Styles */}
      <style>{`
        @media (max-width: 960px) {
          .bento-card {
            grid-column: span 12 !important;
          }
        }
      `}</style>
    </section>
  );
};

function iconBoxStyle(bgColor: string, iconColor: string): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: bgColor.startsWith('#') ? `${bgColor}25` : bgColor,
    border: `1px solid ${iconColor}40`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: iconColor,
    flexShrink: 0,
  };
}
