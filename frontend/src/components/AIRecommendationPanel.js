import React, { useState } from 'react';

// ─── Urgency config ────────────────────────────────────────────────────────────
const URGENCY = {
  CRITICAL: { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: '#EF4444',  label: 'CRITICAL' },
  HIGH:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', label: 'HIGH' },
  MODERATE: { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', border: '#3B82F6', label: 'MODERATE' },
  WATCH:    { color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: '#22C55E', label: 'WATCH' },
};

const TIMEFRAME_ORDER = {
  'Immediate (24-48h)': 0,
  'This Week':          1,
  'Within 30 Days':     2,
  'Within 90 Days':     3,
};

const TIMEFRAME_COLORS = {
  'Immediate (24-48h)': { bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
  'This Week':          { bg: 'rgba(245,158,11,0.12)', color: '#D97706' },
  'Within 30 Days':     { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
  'Within 90 Days':     { bg: 'rgba(34,197,94,0.12)',  color: '#16A34A' },
};

const OWNER_ICON = {
  'RA Team':              '⚖️',
  'CMC Team':             '🧪',
  'Manufacturing Quality':'🏭',
  'Clinical':             '🩺',
  'Executive':            '📋',
  'Agency Liaison':       '🏛️',
};

const fmt = (n) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;

const fmtDay = (n) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M/day`
    : `$${Number(n).toLocaleString()}/day`;

const UrgencyBadge = ({ level }) => {
  const cfg = URGENCY[level] || URGENCY.WATCH;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 3,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.10em', textTransform: 'uppercase',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: cfg.color,
        animation: level === 'CRITICAL' ? 'ai-pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  );
};

const ActionCard = ({ action, index }) => {
  const tfColor = TIMEFRAME_COLORS[action.timeframe] || TIMEFRAME_COLORS['Within 90 Days'];
  const icon = OWNER_ICON[action.owner] || '👤';
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 14px',
      background: '#FAFAFA', border: '1px solid #E5E7EB',
      borderRadius: 6, borderLeft: '3px solid #FF5F02',
    }}>
      <div style={{
        minWidth: 24, height: 24, borderRadius: '50%',
        background: 'rgba(255,95,2,0.12)', color: '#FF5F02',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1,
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#00233C', lineHeight: 1.45, marginBottom: 8 }}>
          {action.action}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: 'rgba(0,35,60,0.08)', color: '#00233C',
          }}>
            {icon} {action.owner}
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: tfColor.bg, color: tfColor.color,
          }}>
            {action.timeframe}
          </span>
        </div>
      </div>
    </div>
  );
};

const TimelineImpact = ({ impact }) => {
  const delayDays   = impact.current_delay_days || 0;
  const perDay      = impact.estimated_revenue_at_risk_per_day_usd || 0;
  const total       = impact.total_revenue_at_risk_usd || 0;
  const opportunity = impact.acceleration_opportunity || '';
  return (
    <div style={{
      background: 'linear-gradient(135deg, #00233C 0%, #003a5c 100%)',
      borderRadius: 8, padding: '20px 24px', color: 'white',
    }}>
      <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)', marginBottom: 16, fontWeight: 600 }}>
        Commercial Timeline Impact
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Days Overdue',          value: `${delayDays.toLocaleString()} days`, warn: delayDays > 365 },
          { label: 'Revenue Lost / Day',    value: fmtDay(perDay),                       warn: perDay > 500_000 },
          { label: 'Total Revenue at Risk', value: fmt(total),                           warn: total > 100_000_000 },
        ].map(({ label, value, warn }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: '12px 14px',
            borderTop: `2px solid ${warn ? '#FF5F02' : 'rgba(255,255,255,0.15)'}`,
          }}>
            <p style={{ fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: warn ? '#FF5F02' : 'white' }}>{value}</p>
          </div>
        ))}
      </div>
      {opportunity && (
        <div style={{
          background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '12px 14px',
          borderLeft: '3px solid rgba(255,95,2,0.6)',
        }}>
          <p style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontWeight: 600 }}>Acceleration Opportunity</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 }}>{opportunity}</p>
        </div>
      )}
    </div>
  );
};

const LoadingSkeleton = () => (
  <div style={{ padding: '4px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%',
        border: '3px solid #E5E7EB', borderTopColor: '#FF5F02',
        animation: 'ai-spin 0.9s linear infinite' }} />
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#00233C' }}>Analyzing submission data…</p>
        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Querying Teradata · Building regulatory context · Generating recommendation</p>
      </div>
    </div>
    {[80, 60, 90, 50].map((w, i) => (
      <div key={i} style={{
        height: 12, borderRadius: 6, marginBottom: 10,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '200% 100%', animation: 'ai-shimmer 1.4s ease infinite',
        width: `${w}%`, animationDelay: `${i * 0.15}s`,
      }} />
    ))}
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div style={{ padding: '20px', background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, textAlign: 'center' }}>
    <p style={{ fontSize: 24, marginBottom: 8 }}>⚠️</p>
    <p style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', marginBottom: 4 }}>Recommendation failed</p>
    <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>{message}</p>
    <button onClick={onRetry} style={{ background: '#FF5F02', color: 'white', border: 'none',
      padding: '8px 20px', borderRadius: 4, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
      Retry
    </button>
  </div>
);

const ConfidenceBadge = ({ level, note }) => {
  const colors = {
    HIGH:   { bg: 'rgba(34,197,94,0.1)',  color: '#16A34A' },
    MEDIUM: { bg: 'rgba(245,158,11,0.1)', color: '#D97706' },
    LOW:    { bg: 'rgba(239,68,68,0.1)',  color: '#EF4444' },
  };
  const c = colors[level] || colors.MEDIUM;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
      <span style={{ padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
        background: c.bg, color: c.color, letterSpacing: '0.08em',
        textTransform: 'uppercase', flexShrink: 0 }}>
        {level} CONFIDENCE
      </span>
      {note && <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>{note}</span>}
    </div>
  );
};

const AIRecommendationPanel = ({ intervention }) => {
  const [state, setState] = useState('idle');
  const [rec, setRec]     = useState(null);
  const [errMsg, setErr]  = useState('');

  const fetchRecommendation = async () => {
    setState('loading');
    setErr('');
    try {
      const res = await fetch('http://localhost:5123/api/ai/intervention-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervention }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRec(data.recommendation);
      setState('done');
    } catch (e) {
      setErr(e.message || 'Unknown error');
      setState('error');
    }
  };

  const sortedActions = rec?.next_actions
    ? [...rec.next_actions].sort((a, b) =>
        (TIMEFRAME_ORDER[a.timeframe] ?? 99) - (TIMEFRAME_ORDER[b.timeframe] ?? 99))
    : [];

  if (state === 'idle') return (
    <div style={{ margin: '24px 0 0', padding: '20px 24px',
      background: 'linear-gradient(135deg, rgba(255,95,2,0.04) 0%, rgba(0,35,60,0.04) 100%)',
      border: '1px dashed rgba(255,95,2,0.35)', borderRadius: 8, textAlign: 'center' }}>
      <p style={{ fontSize: 22, marginBottom: 8 }}>🤖</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#00233C', marginBottom: 6 }}>AI Regulatory Recommendation</p>
      <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 18, lineHeight: 1.5, maxWidth: 360, margin: '0 auto 18px' }}>
        Analyzes this submission's risk profile against regulatory authority standards and generates specific next actions with commercial impact assessment.
      </p>
      <button onClick={fetchRecommendation} style={{ background: '#FF5F02', color: 'white', border: 'none',
        padding: '10px 28px', borderRadius: 4, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        letterSpacing: '0.03em', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        ✦ Get AI Recommendation
      </button>
      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 10 }}>Powered by Claude Sonnet 4.5 via AWS Bedrock · Read-only analysis</p>
    </div>
  );

  if (state === 'loading') return (
    <div style={{ margin: '24px 0 0', padding: '20px 24px', border: '1px solid #E5E7EB', borderRadius: 8 }}>
      <LoadingSkeleton />
    </div>
  );

  if (state === 'error') return (
    <div style={{ margin: '24px 0 0' }}><ErrorState message={errMsg} onRetry={fetchRecommendation} /></div>
  );

  const urgency = URGENCY[rec.urgency_level] || URGENCY.WATCH;
  return (
    <div style={{ margin: '24px 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#6B7280' }}>AI Recommendation</span>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>· Claude Sonnet 4.5</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UrgencyBadge level={rec.urgency_level} />
          <button onClick={() => setState('idle')} style={{ background: 'none', border: '1px solid #E5E7EB',
            borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: '#9CA3AF' }}>↺ Refresh</button>
        </div>
      </div>
      <div style={{ padding: '14px 16px', background: urgency.bg, border: `1px solid ${urgency.border}`,
        borderLeft: `4px solid ${urgency.color}`, borderRadius: 6, marginBottom: 20 }}>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#00233C', fontWeight: 500 }}>{rec.recommendation_summary}</p>
        <ConfidenceBadge level={rec.confidence} note={rec.confidence_note} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 10 }}>Recommended Actions</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedActions.map((action, i) => <ActionCard key={i} action={action} index={i} />)}
        </div>
      </div>
      {rec.timeline_impact && <div style={{ marginBottom: 20 }}><TimelineImpact impact={rec.timeline_impact} /></div>}
      {rec.regulatory_context && (
        <div style={{ padding: '12px 14px', background: 'rgba(0,35,60,0.04)',
          border: '1px solid rgba(0,35,60,0.10)', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🏛️</span>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 4 }}>Regulatory Context</p>
            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.55 }}>{rec.regulatory_context}</p>
          </div>
        </div>
      )}
      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 14, lineHeight: 1.5 }}>
        ⚠️ AI-generated analysis for decision support only. Verify with your regulatory affairs team before taking action. Data sourced from Teradata HCLS — read-only, no modifications made.
      </p>
      <style>{`
        @keyframes ai-spin { to { transform: rotate(360deg); } }
        @keyframes ai-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes ai-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
      `}</style>
    </div>
  );
};

export default AIRecommendationPanel;
