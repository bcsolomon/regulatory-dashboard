import React from 'react';
import { formatMillions, outcomeColor, outcomeLabel, outcomeBg } from '../utils/currency';

const ConfidenceGauge = ({ value, color, theme }) => {
  const t = (dark, light) => theme === 'dark' ? dark : light;
  const pct = Math.round((value || 0) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: `conic-gradient(${color} 0% ${pct}%, ${t('#1F2937', '#E2E8F0')} ${pct}% 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: t('#111827', '#FFFFFF'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color,
        }}>
          {pct}%
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: t('#6B7280', '#64748B'), textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
          Model Confidence
        </div>
        <div style={{ height: 4, background: t('#1F2937', '#E2E8F0'), borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      </div>
    </div>
  );
};

const ProtocolCards = ({ cards, onCardClick, onAnalyzeClick, theme = 'dark' }) => {
  const t = (dark, light) => theme === 'dark' ? dark : light;

  if (!cards || cards.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: t('#6B7280', '#64748B') }}>
        No protocols match current filters
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 12, maxHeight: 580, overflowY: 'auto', paddingRight: 4,
    }}>
      {cards.map((card, i) => {
        const outcome      = card.Predicted_Outcome || 'Approved_On_Schedule';
        const color        = outcomeColor(outcome);
        const bgColor      = outcomeBg(outcome);
        const label        = outcomeLabel(outcome);
        const conf         = parseFloat(card.Confidence || 0);
        const borderAlpha  = Math.max(0.25, conf).toFixed(2);

        return (
          <div
            key={`${card.Actv_Id}-${card.Ctry_Cd_Iso3}-${i}`}
            onClick={() => onCardClick && onCardClick(card.Actv_Id, card.Ctry_Cd_Iso3)}
            style={{
              background: t('#111827', '#FFFFFF'),
              border: `2px solid ${color}${Math.round(parseFloat(borderAlpha) * 255).toString(16).padStart(2, '0')}`,
              borderLeft: `4px solid ${color}`,
              borderRadius: 8, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = color}
            onMouseLeave={e => {
              const alpha = Math.round(Math.max(0.25, conf) * 255).toString(16).padStart(2, '0');
              e.currentTarget.style.borderColor = `${color}${alpha}`;
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: '#FF5F02', fontWeight: 600, marginBottom: 2 }}>{card.Actv_Id}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t('#F9FAFB', '#0F172A'), lineHeight: 1.3 }}>{card.Product || '—'}</div>
                <div style={{ fontSize: 11, color: t('#6B7280', '#64748B'), marginTop: 2 }}>{card.Ctry_Name} · {card.Sector}</div>
              </div>
              <div style={{
                background: bgColor, color, border: `1px solid ${color}55`,
                borderRadius: 4, padding: '3px 8px', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.08em', whiteSpace: 'nowrap', marginLeft: 8, alignSelf: 'flex-start',
              }}>
                {label}
              </div>
            </div>

            {/* Confidence gauge */}
            <div style={{ marginBottom: 10 }}>
              <ConfidenceGauge value={conf} color={color} theme={theme} />
            </div>

            {/* Probability row */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { label: 'Appr', outcome: 'Approved_On_Schedule', color: '#22C55E' },
                    { label: 'Dly',  outcome: 'Delayed',              color: '#F59E0B' },
                    { label: 'CRL',  outcome: 'CRL_Received',         color: '#EF4444' },
                    { label: 'Wdrn', outcome: 'Withdrawn',            color: '#6B7280' },
                  ].map(({ label: l, outcome: o, color: c }) => {
                    const isPredicted = outcome === o;
                    return (
                      <div key={l} style={{ textAlign: 'center', minWidth: 32 }}>
                        <div style={{ fontSize: 9, color: isPredicted ? c : t('#374151', '#CBD5E1'), marginBottom: 2, fontWeight: isPredicted ? 700 : 400 }}>{l}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: isPredicted ? c : t('#374151', '#CBD5E1') }}>
                          {isPredicted ? `${Math.round(conf * 100)}%` : 'N/A'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 9, color: t('#4B5563', '#94A3B8'), fontStyle: 'italic', textAlign: 'right', maxWidth: 80, lineHeight: 1.3 }}>
                  Full dist. unavailable
                </div>
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={(e) => { e.stopPropagation(); onAnalyzeClick && onAnalyzeClick(card); }}
              style={{
                width: '100%', marginBottom: 8,
                background: 'transparent', border: `1px solid ${color}55`, color,
                borderRadius: 4, padding: '5px 0', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => { e.target.style.background = `${color}22`; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; }}
            >
              🤖 ANALYZE IN AI PANEL
            </button>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${t('#1F2937', '#E2E8F0')}` }}>
              <div>
                <div style={{ fontSize: 9, color: t('#6B7280', '#64748B'), marginBottom: 2 }}>Revenue at Risk</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t('#F9FAFB', '#0F172A') }}>{formatMillions(card.Revenue_At_Risk_Millions)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: t('#6B7280', '#64748B'), marginBottom: 2 }}>Days Overdue</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: parseInt(card.Days_Overdue) > 0 ? '#F59E0B' : '#22C55E' }}>
                  {parseInt(card.Days_Overdue) > 0 ? `+${card.Days_Overdue}d` : 'On Track'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: t('#6B7280', '#64748B'), marginBottom: 2 }}>Authority</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t('#9CA3AF', '#475569') }}>{card.Regulatory_Authority || '—'}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProtocolCards;
