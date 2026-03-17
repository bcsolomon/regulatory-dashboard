import React from 'react';
import { formatBillions, formatMillions } from '../utils/currency';

const RegionalBreakdown = ({ regions, onRegionClick, selectedRegion, theme = 'dark' }) => {
  const t = (dark, light) => theme === 'dark' ? dark : light;
  const n = (v) => parseFloat(v || 0);

  const getRiskColor = (score) => {
    const s = n(score);
    if (s >= 6) return '#EF4444';
    if (s >= 4) return '#F59E0B';
    return '#22C55E';
  };

  const getRegionColor = (region) => ({
    'United States':       '#FF5F02',
    'Europe':              '#3B82F6',
    'Asia-Pacific Africa': '#06B6D4',
    'W Hemisphere Ex-US':  '#8B5CF6',
  }[region] || '#6B7280');

  const maxPipeline = Math.max(...regions.map(r => n(r.pipeline_billions)), 1);
  const maxRisk     = Math.max(...regions.map(r => n(r.revenue_at_risk_millions)), 1);
  const maxAccel    = Math.max(...regions.map(r => n(r.accel_90d_millions)), 1);

  const totals = {
    pipeline: regions.reduce((s, r) => s + n(r.pipeline_billions), 0),
    atRisk:   regions.reduce((s, r) => s + n(r.revenue_at_risk_millions), 0),
    accel90:  regions.reduce((s, r) => s + n(r.accel_90d_millions), 0),
    subs:     regions.reduce((s, r) => s + n(r.submission_count), 0),
  };

  const cardBg       = t('#111827', '#FFFFFF');
  const cardBorder   = t('#1F2937', '#CBD5E1');
  const cardActiveBg = t('#1a1a2e', '#EFF6FF');
  const barTrack     = t('#1F2937', '#E2E8F0');
  const textPrimary  = t('#F9FAFB', '#0F172A');
  const textMuted    = t('#6B7280', '#64748B');
  const divider      = t('#1F2937', '#E2E8F0');

  return (
    <div style={{ padding: '0 24px 24px', background: t('#0D1117', '#F1F5F9') }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: textMuted, textTransform: 'uppercase' }}>
          Regional Pipeline Breakdown — click to filter
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {regions.map((region) => {
          const isSelected  = selectedRegion === region.Global_Region;
          const color       = getRegionColor(region.Global_Region);
          const riskColor   = getRiskColor(region.avg_risk_score);
          const pipelinePct = (n(region.pipeline_billions) / maxPipeline) * 100;
          const riskPct     = (n(region.revenue_at_risk_millions) / maxRisk) * 100;
          const accelPct    = (n(region.accel_90d_millions) / maxAccel) * 100;

          return (
            <div
              key={region.Global_Region}
              onClick={() => onRegionClick(isSelected ? 'all' : region.Global_Region)}
              style={{
                background: isSelected ? cardActiveBg : cardBg,
                border: `2px solid ${isSelected ? color : cardBorder}`,
                borderRadius: 8, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color, textTransform: 'uppercase' }}>{region.Global_Region}</div>
                {isSelected && <div style={{ fontSize: 9, color, border: `1px solid ${color}`, borderRadius: 3, padding: '1px 5px' }}>FILTERED</div>}
              </div>
              {[
                { label: 'Pipeline', value: formatBillions(region.pipeline_billions), pct: pipelinePct, color, valueColor: textPrimary },
                { label: 'At Risk',  value: formatMillions(region.revenue_at_risk_millions), pct: riskPct, color: '#EF4444', valueColor: '#EF4444' },
                { label: '90d Opportunity', value: formatMillions(region.accel_90d_millions), pct: accelPct, color: '#22C55E', valueColor: '#22C55E' },
              ].map(({ label, value, pct, color: bc, valueColor }) => (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: textMuted }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: valueColor }}>{value}</span>
                  </div>
                  <div style={{ height: 4, background: barTrack, borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: bc, borderRadius: 2, opacity: label === 'Pipeline' ? 1 : 0.7 }} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${divider}` }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>{region.submission_count}</div>
                  <div style={{ fontSize: 9, color: textMuted }}>Submissions</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: riskColor }}>{n(region.avg_risk_score).toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: textMuted }}>Avg Risk</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* All Regions card */}
        <div
          onClick={() => onRegionClick('all')}
          style={{
            background: selectedRegion === 'all' ? cardActiveBg : cardBg,
            border: `2px solid ${selectedRegion === 'all' ? '#FF5F02' : t('#374151', '#CBD5E1')}`,
            borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: selectedRegion === 'all' ? '#FF5F02' : textMuted, textTransform: 'uppercase', marginBottom: 10 }}>
            {selectedRegion === 'all' ? '✓ All Regions' : 'All Regions'}
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: textMuted, marginBottom: 2 }}>Total Pipeline</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: textPrimary }}>{formatBillions(totals.pipeline)}</div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, color: textMuted, marginBottom: 2 }}>Total At Risk</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444' }}>{formatMillions(totals.atRisk)}</div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: textMuted, marginBottom: 2 }}>90d Opportunity</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#22C55E' }}>{formatMillions(totals.accel90)}</div>
          </div>
          <div style={{ paddingTop: 8, borderTop: `1px solid ${divider}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
              {totals.subs} <span style={{ fontSize: 10, color: textMuted, fontWeight: 400 }}>submissions</span>
            </div>
            <div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>{regions.length} regions tracked</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionalBreakdown;
