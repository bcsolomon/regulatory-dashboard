import React from 'react';
import { formatBillions } from '../utils/currency';

const KPIStrip = ({ kpis, days, theme = 'dark' }) => {
  const t = (dark, light) => theme === 'dark' ? dark : light;

  const getApprovedLabel = (d) => {
    if (!d || d >= 9999) return 'Approved (All Time)';
    if (d <= 90)  return 'Approved (90 Days)';
    if (d <= 180) return 'Approved (6 Mo)';
    if (d <= 365) return 'Approved (1 Year)';
    return `Approved (${d}d)`;
  };

  const kpiConfig = [
    { label: 'Total Pipeline',        value: formatBillions(kpis.totalPipeline), sub: `${kpis.totalSubmissions} submissions`, color: 'teal' },
    { label: 'Pending Approvals',     value: kpis.pendingApprovals ?? '—',       sub: 'Active & under review',               color: 'amber' },
    { label: getApprovedLabel(days),  value: kpis.approvedYTD ?? '—',            sub: 'Confirmed approvals',                 color: 'green' },
    { label: 'Avg Cycle Time',        value: kpis.avgCycleTime > 0 ? `${kpis.avgCycleTime}d` : '—', sub: 'Submission to approval', color: 'blue' },
    { label: 'CRLs Received',         value: kpis.crlCount ?? '—',              sub: kpis.crlCount > 0 ? 'Requires response' : 'No active CRLs', color: 'red' },
  ];

  const mlTotal = (kpis.mlPredApproved || 0) + (kpis.mlPredDelayed || 0) +
                  (kpis.mlPredCRL || 0) + (kpis.mlPredWithdrawn || 0);
  const mlPct = (n) => mlTotal > 0 ? ((n / mlTotal) * 100).toFixed(0) : 0;

  return (
    <div>
      <div className="kpi-strip">
        {kpiConfig.map((kpi, i) => (
          <div key={i} className={`kpi ${kpi.color}`}>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {mlTotal > 0 && (
        <div style={{
          background: t('#0D1117', '#F8FAFC'),
          borderBottom: `1px solid ${t('#1F2937', '#E2E8F0')}`,
          padding: '10px 32px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t('#6B7280', '#64748B'), textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            ML Predicted Outcomes
          </div>

          <div style={{ flex: 1, height: 18, display: 'flex', borderRadius: 3, overflow: 'hidden', background: t('#1F2937', '#E2E8F0') }}>
            {[
              { label: 'Approved',  val: kpis.mlPredApproved,  color: '#22C55E' },
              { label: 'Delayed',   val: kpis.mlPredDelayed,   color: '#F59E0B' },
              { label: 'CRL',       val: kpis.mlPredCRL,       color: '#EF4444' },
              { label: 'Withdrawn', val: kpis.mlPredWithdrawn, color: '#6B7280' },
            ].map(({ label, val, color }) => {
              const pct = mlTotal > 0 ? (val / mlTotal) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={label}
                  title={`${label}: ${val} (${mlPct(val)}%)`}
                  style={{
                    width: `${pct}%`, background: color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: 'white', fontWeight: 700,
                    overflow: 'hidden', whiteSpace: 'nowrap', transition: 'width 0.4s ease',
                  }}
                >
                  {pct > 8 ? `${mlPct(val)}%` : ''}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            {[
              { label: 'Approved',  val: kpis.mlPredApproved,  color: '#22C55E' },
              { label: 'Delayed',   val: kpis.mlPredDelayed,   color: '#F59E0B' },
              { label: 'CRL',       val: kpis.mlPredCRL,       color: '#EF4444' },
              { label: 'Withdrawn', val: kpis.mlPredWithdrawn, color: '#6B7280' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 10, color: t('#9CA3AF', '#64748B') }}>
                  {label} <strong style={{ color: t('#F9FAFB', '#0F172A') }}>{val}</strong>
                </span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: t('#6B7280', '#64748B'), marginLeft: 4 }}>
              Avg conf: <strong style={{ color: t('#F9FAFB', '#0F172A') }}>{kpis.mlAvgConfidence}%</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIStrip;
