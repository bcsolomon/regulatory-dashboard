import React from 'react';

const ModelCard = ({ modelMeta, theme = 'dark' }) => {
  const t = (dark, light) => theme === 'dark' ? dark : light;

  if (!modelMeta || !modelMeta.currentModel) return null;

  const model    = modelMeta.currentModel;
  const features = (modelMeta.features || []).slice(0, 8);
  const accuracy = parseFloat(model.Test_Accuracy || 0) * 100;
  const maxImp   = Math.max(...features.map(f => parseFloat(f.Importance || 0)), 1);

  return (
    <div style={{
      background: t('#111827', '#FFFFFF'),
      border: `1px solid ${t('#1F2937', '#CBD5E1')}`,
      borderRadius: 8, padding: '16px 20px',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
    }}>
      {/* Left: model info */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: t('#6B7280', '#64748B'), textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          ML Model — Approval Outcome Predictor
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Version',       value: model.Model_Version },
            { label: 'Type',          value: model.Model_Type || '—' },
            { label: 'Training Rows', value: model.Train_Rows?.toLocaleString() || '~300' },
            { label: 'Trained',       value: model.Trained_Date || '—' },
            { label: 'Features',      value: model.Num_Features || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: t('#6B7280', '#64748B'), marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t('#F9FAFB', '#0F172A') }}>{value}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 9, color: t('#6B7280', '#64748B'), marginBottom: 2 }}>Accuracy</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: accuracy >= 70 ? '#22C55E' : '#F59E0B' }}>
              {accuracy.toFixed(0)}%
            </div>
          </div>
        </div>
        {model.Notes && (
          <div style={{ marginTop: 10, fontSize: 10, color: t('#6B7280', '#64748B'), fontStyle: 'italic', borderTop: `1px solid ${t('#1F2937', '#E2E8F0')}`, paddingTop: 8 }}>
            {model.Notes}
          </div>
        )}
      </div>

      {/* Right: feature importance */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: t('#6B7280', '#64748B'), textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Top Features
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {features.map((f, i) => {
            const imp  = parseFloat(f.Importance || 0);
            const pct  = (imp / maxImp) * 100;
            const name = (f.Feature_Name || '').replace(/_/g, ' ');
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: t('#D1D5DB', '#334155') }}>{name}</span>
                  <span style={{ fontSize: 10, color: t('#9CA3AF', '#64748B') }}>{imp.toFixed(3)}</span>
                </div>
                <div style={{ height: 4, background: t('#1F2937', '#E2E8F0'), borderRadius: 2 }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: i === 0 ? '#FF5F02' : `rgba(255,95,2,${0.7 - i * 0.07})`,
                    borderRadius: 2, transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ModelCard;
