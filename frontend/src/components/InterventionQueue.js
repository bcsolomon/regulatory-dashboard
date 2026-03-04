import React, { useState } from 'react';
import { formatMillions } from '../utils/currency';
import AIRecommendationPanel from './AIRecommendationPanel';

const InterventionPopup = ({ intervention, onClose }) => {
  if (!intervention) return null;
  const riskScore = parseInt(intervention.Risk_Score, 10) || 0;
  const priority  = parseInt(intervention.Priority_Score, 10) || 0;
  const hasCRL    = String(intervention.CRL_Received_Fl) === '1';
  const riskColor = riskScore >= 8 ? '#EF4444' : riskScore >= 5 ? '#F59E0B' : '#3B82F6';
  const priorityLabel =
    priority >= 100 ? { text: 'CRITICAL', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' } :
    priority >= 75  ? { text: 'HIGH',     color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' } :
    priority >= 50  ? { text: 'MODERATE', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' } :
                      { text: 'WATCH',    color: '#22C55E', bg: 'rgba(34,197,94,0.1)'  };
  const gmpColor =
    intervention.GMP_Site_Status === 'Warning Letter Active' ? '#EF4444' :
    intervention.GMP_Site_Status === 'Pending Inspection'    ? '#F59E0B' : '#22C55E';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, animation: 'fadeIn 0.18s ease', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 8,
        width: '100%', maxWidth: 700, maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', animation: 'slideUp 0.22s ease' }}>
        <div style={{ background: 'linear-gradient(135deg, #00233C 0%, #003a5c 100%)',
          padding: '22px 28px', borderBottom: '3px solid #FF5F02', borderRadius: '8px 8px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ padding: '3px 10px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                  background: priorityLabel.bg, color: priorityLabel.color,
                  letterSpacing: '0.10em', border: `1px solid ${priorityLabel.color}` }}>
                  {priorityLabel.text}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Priority Score: {priority}</span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 4 }}>{intervention.Product}</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                {intervention.Protocol_ID} · {intervention.Regulatory_Authority} · {intervention.Country_Code?.trim()} · {intervention.Sector}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'white', width: 34, height: 34, borderRadius: 4, cursor: 'pointer',
              fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Risk Score',       value: `${riskScore}/10`, color: riskColor },
              { label: 'Days Overdue',     value: intervention.Days_Overdue?.toLocaleString() ?? '—', color: '#EF4444' },
              { label: 'Open Deficiencies',value: intervention.Open_Deficiencies_Cnt ?? '—',
                color: parseInt(intervention.Open_Deficiencies_Cnt, 10) > 3 ? '#EF4444' : '#374151' },
              { label: 'CMC Readiness',   value: `${intervention.CMC_Readiness_Score}/10`,
                color: parseInt(intervention.CMC_Readiness_Score, 10) <= 3 ? '#EF4444' :
                       parseInt(intervention.CMC_Readiness_Score, 10) <= 6 ? '#F59E0B' : '#22C55E' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '14px 16px', background: '#F9FAFB',
                border: '1px solid #E5E7EB', borderRadius: 6, borderTop: `3px solid ${color}` }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'GMP Site Status', value: intervention.GMP_Site_Status || '—', color: gmpColor, bold: true },
              { label: 'CRL Status', value: hasCRL ? `Received — ${intervention.CRL_Category || 'Category Unknown'}` : 'None Received',
                color: hasCRL ? '#EF4444' : '#22C55E', bold: true },
              { label: 'Dose Optimization', value: intervention.Dose_Optimization_Status || '—', color: '#374151', bold: false },
              { label: 'Revenue at Risk', value: formatMillions(intervention.Revenue_At_Risk_Millions), color: '#FF5F02', bold: true, large: true },
            ].map(({ label, value, color, bold, large }) => (
              <div key={label} style={{ padding: '12px 14px', background: '#F9FAFB',
                border: '1px solid #E5E7EB', borderRadius: 6 }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 5 }}>{label}</p>
                <p style={{ fontSize: large ? 16 : 13, fontWeight: bold ? 700 : 500, color }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(0,35,60,0.04)',
            border: '1px solid rgba(0,35,60,0.12)', borderRadius: 6, marginBottom: 4 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 4 }}>System Recommendation</p>
            <p style={{ fontSize: 12, color: '#374151' }}>{intervention.Recommended_Action || '—'}</p>
          </div>
          <AIRecommendationPanel intervention={intervention} />
        </div>
      </div>
      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
};

const InterventionQueue = ({ interventions, onInterventionClick }) => {
  const [selectedIntervention, setSelectedIntervention] = useState(null);

  const getUrgencyClass = (score) => score >= 8 ? 'urgent' : score >= 5 ? 'high' : 'watch';
  const getUrgencyColor = (score) => score >= 8 ? '#EF4444' : score >= 5 ? '#F59E0B' : '#3B82F6';

  return (
    <>
      <div className="intervention-queue">
        {interventions.slice(0, 10).map((intervention, index) => (
          <div key={index} className={`risk-item ${getUrgencyClass(intervention.Risk_Score)}`}
            onClick={() => setSelectedIntervention(intervention)}
            style={{ position: 'relative' }}>
            <div className="risk-type">Risk {intervention.Risk_Score}/10 · {intervention.Regulatory_Authority}</div>
            <div className="risk-title">{intervention.Product} — {intervention.Country_Code?.trim()}</div>
            <div className="risk-meta">{intervention.Recommended_Action}</div>
            <div className="risk-amount" style={{ color: getUrgencyColor(intervention.Risk_Score) }}>
              {formatMillions(intervention.Revenue_At_Risk_Millions)} at risk
            </div>
            <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18,
              borderRadius: '50%', background: 'rgba(255,95,2,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✦</div>
          </div>
        ))}
        {interventions.length === 0 && (
          <div className="empty-state">
            <p>No interventions required</p>
            <p className="text-muted">All submissions on track</p>
          </div>
        )}
      </div>
      {selectedIntervention && (
        <InterventionPopup intervention={selectedIntervention} onClose={() => setSelectedIntervention(null)} />
      )}
    </>
  );
};

export default InterventionQueue;
