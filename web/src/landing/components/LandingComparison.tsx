import React from 'react';
import { X, Check, ShieldAlert, Sparkles } from 'lucide-react';

export const LandingComparison: React.FC = () => {
  return (
    <section id="vantagens" className="landing-section">
      <div className="landing-container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 60px auto' }}>
          <div className="glass-badge" style={{ marginBottom: 16 }}>
            <span>Comparativo de Eficiência</span>
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            Porque é que as construtoras abandonam o papel e <span className="gradient-text-vibrant">escolhem o Castello?</span>
          </h2>
          <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.6 }}>
            Veja a diferença direta entre métodos manuais obsoletos e a gestão moderna com tecnologia em nuvem.
          </p>
        </div>

        {/* Comparison Table / Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 28,
        }}>
          {/* Card: Gestão Tradicional */}
          <div className="glass-panel" style={{
            padding: 36,
            border: '1px solid rgba(239, 68, 68, 0.25)',
            background: 'rgba(239, 68, 68, 0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
              }}>
                <X size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#EF4444', textTransform: 'uppercase' }}>
                  Método Obsoleto
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Papel, Cadernos & Excel Solto
                </h3>
              </div>
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <li style={comparisonRowStyle}>
                <X size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                <span>Folhas de presença manchadas, perdidas ou preenchidas no fim do mês "de cabeça".</span>
              </li>
              <li style={comparisonRowStyle}>
                <X size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                <span>Trabalhadores marcam presença por colegas que faltaram ou chegaram atrasados.</span>
              </li>
              <li style={comparisonRowStyle}>
                <X size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                <span>Desvios orçamentais só são descobertos quando a obra já deu prejuízo.</span>
              </li>
              <li style={comparisonRowStyle}>
                <X size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                <span>Dias inteiros perdidos a passar horas de papel para o Excel para enviar à contabilidade.</span>
              </li>
              <li style={comparisonRowStyle}>
                <X size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                <span>Risco elevado de multas da fiscalização (ACT) por falta de registos legais auditados.</span>
              </li>
            </ul>
          </div>

          {/* Card: Com Castello ERP */}
          <div className="glass-panel-elevated" style={{
            padding: 36,
            border: '1px solid rgba(92, 127, 251, 0.4)',
            background: 'rgba(11, 15, 25, 0.95)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(0, 21, 212, 0.25)',
                border: '1px solid rgba(92, 127, 251, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5C7FFB',
              }}>
                <Sparkles size={22} />
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5C7FFB', textTransform: 'uppercase' }}>
                  A Solução Moderna
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                  Com o Castello ERP & Ponto
                </h3>
              </div>
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <li style={comparisonRowStyle}>
                <Check size={18} color="#10B981" style={{ flexShrink: 0 }} />
                <span><strong>Registo Digital em 3s:</strong> Salvo na nuvem, com hora exata e sem perdas de dados.</span>
              </li>
              <li style={comparisonRowStyle}>
                <Check size={18} color="#10B981" style={{ flexShrink: 0 }} />
                <span><strong>Geofencing & Foto:</strong> Ponto só é aceite dentro da obra e com foto do próprio rosto.</span>
              </li>
              <li style={comparisonRowStyle}>
                <Check size={18} color="#10B981" style={{ flexShrink: 0 }} />
                <span><strong>Margens em Tempo Real:</strong> Custos, compras e mão de obra atualizados ao minuto.</span>
              </li>
              <li style={comparisonRowStyle}>
                <Check size={18} color="#10B981" style={{ flexShrink: 0 }} />
                <span><strong>Exportação Instantânea:</strong> Relatórios consolidados para contabilidade com 1 clique.</span>
              </li>
              <li style={comparisonRowStyle}>
                <Check size={18} color="#10B981" style={{ flexShrink: 0 }} />
                <span><strong>Conformidade Total:</strong> Auditoria completa e proteção jurídica perante a legislação de trabalho.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

const comparisonRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  fontSize: 14,
  color: '#DCE4FF',
  lineHeight: 1.5,
};
