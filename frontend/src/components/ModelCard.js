import React from 'react';

/**
 * ModelCard — shows current model version, accuracy, training date,
 * and top feature importances from ML_Model_Registry + Feature_Importance.
 */

const ModelCard = ({ modelMeta }) => {
  if (!modelMeta || !modelMeta.currentModel) return null;

  const model    = modelMeta.currentModel;
  const features = (modelMeta.features || []).slice(0, 8);
  const accuracy = parseFloat(model.Test_Accuracy || 0) * 100;
  const maxImp   = Math.max(...features.map(f => parseFloat(f.Importance || 0)), 1);

  return (
    <div style={{
      background: '#111827',
      border: '1px solid #1F2937',
      borderRadius: 8,
      padding: '16px 20px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20,
    }}>
      {/* Left: model info */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          ML Model — Approval Outcome Predictor
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>Version</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>{model.Model_Version}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>Type</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>{model.Model_Type || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>Accuracy</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: accuracy >= 70 ? '#22C55E' : '#F59E0B' }}>
              {accuracy.toFixed(0)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>Training Rows</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>{model.Train_Rows?.toLocaleString() || '~300'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>Trained</div>
            <div style={{ fontSize: 12, color: '#F9FAFB' }}>{model.Trained_Date || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 2 }}>Features</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>{model.Num_Features || '—'}</div>
          </div>
        </div>
        {model.Notes && (
          <div style={{ marginTop: 10, fontSize: 10, color: '#6B7280', fontStyle: 'italic', borderTop: '1px solid #1F2937', paddingTop: 8 }}>
            {model.Notes}
          </div>
        )}
      </div>

      {/* Right: feature importance */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Top Features
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {features.map((f, i) => {
            const imp    = parseFloat(f.Importance || 0);
            const pct    = (imp / maxImp) * 100;
            const name   = (f.Feature_Name || '').replace(/_/g, ' ');
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: '#D1D5DB' }}>{name}</span>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>{imp.toFixed(3)}</span>
                </div>
                <div style={{ height: 4, background: '#1F2937', borderRadius: 2 }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: i === 0 ? '#FF5F02' : `rgba(255,95,2,${0.7 - i * 0.07})`,
                    borderRadius: 2,
                    transition: 'width 0.4s ease'
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
