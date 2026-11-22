import React from 'react';

export const PageModuleSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }} aria-busy="true" aria-label="A carregar módulo">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton-block" style={{ width: 220, height: 26, borderRadius: 6 }} />
        <div className="skeleton-block" style={{ width: 320, height: 14, borderRadius: 4 }} />
      </div>
      <div className="skeleton-block" style={{ width: 140, height: 38, borderRadius: 6 }} />
    </div>
    <div className="kpi-row">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="kpi-box" style={{ minHeight: 108 }}>
          <div className="skeleton-block" style={{ width: '55%', height: 12, marginBottom: 14 }} />
          <div className="skeleton-block" style={{ width: '40%', height: 28, marginBottom: 10 }} />
          <div className="skeleton-block" style={{ width: '70%', height: 11 }} />
        </div>
      ))}
    </div>
    <div className="content-panel" style={{ minHeight: 280 }}>
      <div className="skeleton-block" style={{ width: 180, height: 16, marginBottom: 18 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3, 4].map((r) => (
          <div key={r} className="skeleton-block" style={{ width: '100%', height: 36, borderRadius: 6 }} />
        ))}
      </div>
    </div>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div aria-busy="true" aria-label="A carregar painel">
    <div className="kpi-row">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="kpi-box" style={{ minHeight: 112 }}>
          <div className="skeleton-block" style={{ width: '60%', height: 12, marginBottom: 14 }} />
          <div className="skeleton-block" style={{ width: '45%', height: 28, marginBottom: 10 }} />
          <div className="skeleton-block" style={{ width: '75%', height: 11 }} />
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
      <div className="content-panel" style={{ margin: 0, minHeight: 270 }}>
        <div className="skeleton-block" style={{ width: 220, height: 16, marginBottom: 18 }} />
        <div className="skeleton-block" style={{ width: '100%', height: 200, borderRadius: 8 }} />
      </div>
      <div className="content-panel" style={{ margin: 0, minHeight: 240 }}>
        <div className="skeleton-block" style={{ width: 240, height: 16, marginBottom: 18 }} />
        <div className="skeleton-block" style={{ width: '100%', height: 170, borderRadius: 8 }} />
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="content-panel" style={{ margin: 0, height: 275 }}>
          <div className="skeleton-block" style={{ width: '55%', height: 15, marginBottom: 16 }} />
          <div className="skeleton-block" style={{ width: '100%', height: 195, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  </div>
);

export const TableRowsSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 6 }) => (
  <>
    {Array.from({ length: rows }).map((_, rIdx) => (
      <tr key={rIdx} aria-hidden="true">
        {Array.from({ length: cols }).map((__, cIdx) => (
          <td key={cIdx}>
            <div
              className="skeleton-block"
              style={{
                width: cIdx === 0 ? '80%' : cIdx === cols - 1 ? 64 : '65%',
                height: 16,
                marginLeft: cIdx === cols - 1 ? 'auto' : 0,
              }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const CardsGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div
    style={{
      gridColumn: '1 / -1',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
      gap: 16,
    }}
    aria-busy="true"
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="content-panel" style={{ margin: 0, minHeight: 196 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div className="skeleton-block" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton-block" style={{ width: '70%', height: 15 }} />
            <div className="skeleton-block" style={{ width: '45%', height: 11 }} />
          </div>
        </div>
        <div className="skeleton-block" style={{ width: '100%', height: 48, borderRadius: 6, marginBottom: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div className="skeleton-block" style={{ width: '38%', height: 24, borderRadius: 6 }} />
          <div className="skeleton-block" style={{ width: '32%', height: 24, borderRadius: 6 }} />
        </div>
      </div>
    ))}
  </div>
);

export const CalendarSkeleton: React.FC = () => (
  <div className="content-panel" style={{ margin: 0, padding: 20 }} aria-busy="true">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="skeleton-block" style={{ height: 18, borderRadius: 4 }} />
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="skeleton-block" style={{ height: 78, borderRadius: 6 }} />
      ))}
    </div>
  </div>
);

export const ClientPortalSkeleton: React.FC = () => (
  <div className="client-portal-wrap" style={{ background: 'var(--bg-page)', padding: '24px 20px' }} aria-busy="true">
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="content-panel" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="skeleton-block" style={{ width: 52, height: 52, borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton-block" style={{ width: 220, height: 20 }} />
            <div className="skeleton-block" style={{ width: 160, height: 13 }} />
          </div>
        </div>
        <div className="skeleton-block" style={{ width: 110, height: 34, borderRadius: 8 }} />
      </div>
      <div className="kpi-row">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi-box" style={{ minHeight: 100 }}>
            <div className="skeleton-block" style={{ width: '55%', height: 12, marginBottom: 12 }} />
            <div className="skeleton-block" style={{ width: '40%', height: 26 }} />
          </div>
        ))}
      </div>
      <div className="content-panel" style={{ margin: 0, minHeight: 320 }}>
        <div className="skeleton-block" style={{ width: 200, height: 18, marginBottom: 18 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-block" style={{ width: '100%', height: 56, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    </div>
  </div>
);
