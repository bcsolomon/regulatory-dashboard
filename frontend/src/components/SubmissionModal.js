import React, { useState } from 'react';
import { formatMillions, outcomeColor, outcomeLabel, outcomeBg } from '../utils/currency';

const ProbBar = ({ label, value, color }) => (
  <div style={{ marginBottom: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{Math.round((parseFloat(value) || 0) * 100)}%</span>
    </div>
    <div style={{ height: 5, background: '#1F2937', borderRadius: 3 }}>
      <div style={{ height: '100%', width: `${Math.round((parseFloat(value) || 0) * 100)}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  </div>
);

const SubmissionModal = ({ submission, onClose }) => {
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionType, setActionType]         = useState('Follow-up');
  const [actionNote, setActionNote]         = useState('');
  const [actionOwner, setActionOwner]       = useState('');
  const [actionSaved, setActionSaved]       = useState(false);

  if (!submission) return null;

  const outcome = submission.Predicted_Outcome;
  const oColor  = outcomeColor(outcome);
  const oBg     = outcomeBg(outcome);
  const oLabel  = outcomeLabel(outcome);

  const handleSaveAction = () => {
    if (!actionNote.trim()) return;
    const key = `action_${submission.Protocol_ID}_${submission.Country_Code}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({ type: actionType, note: actionNote, owner: actionOwner, timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(existing));
    setActionSaved(true);
    setTimeout(() => { setActionSaved(false); setShowActionForm(false); setActionNote(''); setActionOwner(''); }, 1500);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${submission.Protocol_ID}_${submission.Country_Code}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{submission.Product}</h2>
            <p className="modal-subtitle">{submission.Protocol_ID} · {submission.Country}</p>
          </div>
          {outcome && (
            <div style={{ background: oBg, color: oColor, border: `1px solid ${oColor}55`, borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700, alignSelf: 'center' }}>
              {oLabel}
            </div>
          )}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {/* ML Prediction vs Actual — FINAL */}
          {outcome && (
            <div className="detail-section">
              <h3>Predicted vs Actual Status</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  {/* Side-by-side comparison */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: `${oColor}11`, border: `1px solid ${oColor}44`, borderRadius: 6, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>ML Predicted</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: oColor }}>{oLabel}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{Math.round((parseFloat(submission.Confidence)||0)*100)}% confidence</div>
                    </div>
                    <div style={{
                      background: submission.Actual_Approval_Date ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                      border: `1px solid ${submission.Actual_Approval_Date ? '#22C55E44' : '#F59E0B44'}`,
                      borderRadius: 6, padding: '10px 12px'
                    }}>
                      <div style={{ fontSize: 9, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Actual Status</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: submission.Actual_Approval_Date ? '#22C55E' : '#F59E0B' }}>
                        {submission.Actual_Approval_Date ? 'Approved' : (submission.Submission_Status || 'In Progress')}
                      </div>
                      {submission.Actual_Approval_Date && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{submission.Actual_Approval_Date}</div>
                      )}
                    </div>
                  </div>
                  {/* Match/mismatch indicator */}
                  {submission.Actual_Approval_Date && (
                    <div style={{
                      padding: '6px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: oLabel === 'Approved' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: oLabel === 'Approved' ? '#22C55E' : '#EF4444',
                      border: `1px solid ${oLabel === 'Approved' ? '#22C55E44' : '#EF444444'}`,
                    }}>
                      {oLabel === 'Approved' ? '✓ Prediction matched actual outcome' : '✗ Prediction did not match actual outcome'}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Class Probabilities
                    </div>
                    {[
                      { label: 'Approved on Schedule', val: submission.Prob_Approved,  color: '#22C55E', outcome: 'Approved_On_Schedule' },
                      { label: 'Delayed',               val: submission.Prob_Delayed,   color: '#F59E0B', outcome: 'Delayed' },
                      { label: 'CRL Received',          val: submission.Prob_CRL,       color: '#EF4444', outcome: 'CRL_Received' },
                      { label: 'Withdrawn',             val: submission.Prob_Withdrawn, color: '#6B7280', outcome: 'Withdrawn' },
                    ].map(({ label, val, color, outcome }) => {
                      const pct       = Math.round((parseFloat(val) || 0) * 100);
                      const isPredicted = submission.Predicted_Outcome === outcome;
                      // Data model only stores winning class probability — show N/A for others
                      const display   = pct > 0 ? `${pct}%` : (isPredicted ? `${pct}%` : 'N/A');
                      return (
                        <div key={label} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: isPredicted ? color : '#6B7280', fontWeight: isPredicted ? 700 : 400 }}>
                              {label}{isPredicted ? ' ★' : ''}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: pct > 0 ? color : '#374151' }}>{display}</span>
                          </div>
                          <div style={{ height: 5, background: '#1F2937', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease', opacity: pct > 0 ? 1 : 0.2 }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 8, fontSize: 9, color: '#4B5563', fontStyle: 'italic' }}>
                      ★ Predicted class · N/A = full probability distribution not available in current model version
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submission Info */}
          <div className="detail-section">
            <h3>Submission Information</h3>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">Protocol ID</span><span className="detail-value">{submission.Protocol_ID}</span></div>
              <div className="detail-item"><span className="detail-label">Product</span><span className="detail-value">{submission.Product}</span></div>
              <div className="detail-item"><span className="detail-label">Therapeutic Area</span><span className="detail-value">{submission.Sector}</span></div>
              <div className="detail-item"><span className="detail-label">Country</span><span className="detail-value">{submission.Country}</span></div>
              <div className="detail-item"><span className="detail-label">Region</span><span className="detail-value">{submission.Global_Region}</span></div>
              <div className="detail-item"><span className="detail-label">Regulatory Agency</span><span className="detail-value">{submission.Regulatory_Authority}</span></div>
              <div className="detail-item"><span className="detail-label">Submission Date</span><span className="detail-value">{submission.Submission_Date}</span></div>
              <div className="detail-item"><span className="detail-label">Review Pathway</span><span className="detail-value">{submission.Review_Pathway}</span></div>
            </div>
          </div>

          {/* Review Status */}
          <div className="detail-section">
            <h3>Review Status</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Days in Review</span>
                <span className="detail-value highlight">
                  {submission.Days_In_Review ?? '—'} days
                  {submission.Days_Overdue > 0 && <span style={{ color: '#F59E0B', fontSize: 11, marginLeft: 6 }}>({submission.Days_Overdue}d overdue)</span>}
                </span>
              </div>
              <div className="detail-item"><span className="detail-label">Model Confidence</span><span className="detail-value highlight">{Math.round((parseFloat(submission.Confidence)||0)*100)}%</span></div>
              <div className="detail-item"><span className="detail-label">Clock Stop Days</span><span className="detail-value">{submission.Clock_Stop_Days ?? '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Resubmission Cycle</span><span className="detail-value">{submission.Resubmission_Cycle ?? '—'}</span></div>
            </div>
          </div>

          {/* Financial Impact */}
          <div className="detail-section">
            <h3>Financial Impact</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Peak Sales (Country)</span>
                <span className="detail-value highlight-green">{submission.Peak_Sales_Millions != null ? formatMillions(submission.Peak_Sales_Millions) : '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Daily Value at Stake</span>
                <span className="detail-value">{submission.Peak_Sales_Millions != null ? `${(parseFloat(submission.Peak_Sales_Millions)/365).toFixed(1)}K/day` : '—'}</span>
              </div>
            </div>
          </div>

          {/* CRL + Risk */}
          <div className="detail-section">
            <h3>Risk & Manufacturing</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">CRL Received</span>
                <span className={`status-pill ${submission.CRL_Received_Fl === 1 ? 'status-critical' : 'status-approved'}`}>{submission.CRL_Received_Fl === 1 ? 'Yes' : 'No'}</span>
              </div>
              {submission.CRL_Category && <div className="detail-item"><span className="detail-label">CRL Category</span><span className="detail-value">{submission.CRL_Category}</span></div>}
              <div className="detail-item"><span className="detail-label">CMC Readiness</span><span className="detail-value">{submission.CMC_Readiness_Score ?? '—'}/10</span></div>
              <div className="detail-item">
                <span className="detail-label">GMP Site Status</span>
                <span className={`status-pill ${submission.GMP_Site_Status === 'Cleared' ? 'status-approved' : 'status-warning'}`}>{submission.GMP_Site_Status ?? '—'}</span>
              </div>
              <div className="detail-item"><span className="detail-label">Dose Optimization</span><span className="detail-value">{submission.Dose_Optimization_Status ?? '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Stability Data</span><span className="detail-value">{submission.Stability_Data_Status ?? '—'}</span></div>
              <div className="detail-item"><span className="detail-label">Clinical Data Gap</span><span className="detail-value">{submission.Clinical_Data_Gap_Type ?? '—'}</span></div>
            </div>
          </div>

          {/* Action form */}
          {showActionForm && (
            <div className="detail-section" style={{ background: '#0f172a', borderRadius: 6, padding: 16, border: '1px solid #1e3a5f' }}>
              <h3 style={{ marginBottom: 12 }}>Record Action</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>ACTION TYPE</label>
                  <select value={actionType} onChange={e => setActionType(e.target.value)} style={{ width: '100%', background: '#1F2937', border: '1px solid #374151', color: '#F9FAFB', padding: '6px 8px', borderRadius: 4, fontSize: 13 }}>
                    <option>Follow-up</option><option>Escalation</option><option>Agency Meeting Request</option>
                    <option>Data Package Submission</option><option>CRL Response</option><option>Resubmission</option>
                    <option>Internal Review</option><option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>OWNER</label>
                  <input type="text" placeholder="Name or team" value={actionOwner} onChange={e => setActionOwner(e.target.value)} style={{ width: '100%', background: '#1F2937', border: '1px solid #374151', color: '#F9FAFB', padding: '6px 8px', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 4 }}>NOTES</label>
                <textarea rows={3} placeholder="Describe the action..." value={actionNote} onChange={e => setActionNote(e.target.value)} style={{ width: '100%', background: '#1F2937', border: '1px solid #374151', color: '#F9FAFB', padding: 8, borderRadius: 4, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveAction} style={{ background: actionSaved ? '#22C55E' : '#FF5F02', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {actionSaved ? '✓ Saved' : 'Save Action'}
                </button>
                <button onClick={() => setShowActionForm(false)} style={{ background: 'transparent', color: '#9CA3AF', border: '1px solid #374151', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={() => setShowActionForm(a => !a)}>{showActionForm ? 'Hide Form' : 'Record Action'}</button>
          <button className="btn-secondary" onClick={handleExport}>Export JSON</button>
        </div>
      </div>
    </div>
  );
};

export default SubmissionModal;
