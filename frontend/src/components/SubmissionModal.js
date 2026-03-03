import React, { useState } from 'react';
import { formatMillions } from '../utils/currency';

const SubmissionModal = ({ submission, onClose }) => {
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionType, setActionType] = useState('Follow-up');
  const [actionNote, setActionNote] = useState('');
  const [actionOwner, setActionOwner] = useState('');
  const [actionSaved, setActionSaved] = useState(false);

  if (!submission) return null;

  const handleSaveAction = () => {
    if (!actionNote.trim()) return;
    // Store in localStorage keyed by protocol+country
    const key = `action_${submission.Protocol_ID}_${submission.Country_Code}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({
      type: actionType,
      note: actionNote,
      owner: actionOwner,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(existing));
    setActionSaved(true);
    setTimeout(() => {
      setActionSaved(false);
      setShowActionForm(false);
      setActionNote('');
      setActionOwner('');
    }, 1500);
  };

  const handleExport = () => {
    const data = {
      exported_at: new Date().toISOString(),
      protocol_id: submission.Protocol_ID,
      product: submission.Product,
      country: submission.Country,
      region: submission.Global_Region,
      regulatory_authority: submission.Regulatory_Authority,
      sector: submission.Sector,
      product_type: submission.Product_Type,
      submission_date: submission.Submission_Date,
      status: submission.Submission_Status,
      days_in_review: submission.Days_In_Review,
      days_overdue: submission.Days_Overdue,
      clock_stop_days: submission.Clock_Stop_Days,
      review_pathway: submission.Review_Pathway,
      resubmission_cycle: submission.Resubmission_Cycle,
      risk_score: submission.Risk_Score_Overall,
      peak_sales_millions: submission.Peak_Sales_Millions,
      crl_received: submission.CRL_Received_Fl === 1,
      crl_category: submission.CRL_Category,
      gmp_site_status: submission.GMP_Site_Status,
      cmc_readiness_score: submission.CMC_Readiness_Score,
      dose_optimization: submission.Dose_Optimization_Status,
      stability_data: submission.Stability_Data_Status,
      clinical_data_gap: submission.Clinical_Data_Gap_Type,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${submission.Protocol_ID}_${submission.Country_Code}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{submission.Product}</h2>
            <p className="modal-subtitle">{submission.Protocol_ID} · {submission.Country}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {/* Submission Info */}
          <div className="detail-section">
            <h3>Submission Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Protocol ID:</span>
                <span className="detail-value">{submission.Protocol_ID}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Product:</span>
                <span className="detail-value">{submission.Product}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Product Type:</span>
                <span className="detail-value">{submission.Product_Type}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Therapeutic Area:</span>
                <span className="detail-value">{submission.Sector}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Country:</span>
                <span className="detail-value">{submission.Country}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Region:</span>
                <span className="detail-value">{submission.Global_Region}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Regulatory Agency:</span>
                <span className="detail-value">{submission.Regulatory_Authority}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Submission Date:</span>
                <span className="detail-value">{submission.Submission_Date}</span>
              </div>
            </div>
          </div>

          {/* Review Status */}
          <div className="detail-section">
            <h3>Review Status</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Current Status:</span>
                <span className={`status-pill ${submission.Submission_Status === 'Approved' ? 'status-approved' : 'status-pending'}`}>
                  {submission.Submission_Status}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Days in Review:</span>
                <span className="detail-value highlight">
                  {submission.Days_In_Review ?? '—'} days
                  {submission.Days_Overdue > 0 &&
                    <span style={{color:'#F59E0B', fontSize:'11px', marginLeft:'6px'}}>({submission.Days_Overdue}d overdue)</span>
                  }
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Clock Stop Days:</span>
                <span className="detail-value">{submission.Clock_Stop_Days ?? '—'} days</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Review Pathway:</span>
                <span className="detail-value">{submission.Review_Pathway ?? '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Resubmission Cycle:</span>
                <span className="detail-value">{submission.Resubmission_Cycle ?? '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Risk Score:</span>
                <span className="detail-value highlight">{submission.Risk_Score_Overall ?? '—'}/10</span>
              </div>
            </div>
          </div>

          {/* Financial Impact */}
          <div className="detail-section">
            <h3>Financial Impact</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Peak Sales (This Country):</span>
                <span className="detail-value highlight-green">
                  {submission.Peak_Sales_Millions != null ? formatMillions(submission.Peak_Sales_Millions) : '—'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Daily Value at Stake:</span>
                <span className="detail-value">
                  {submission.Peak_Sales_Millions != null
                    ? `${(parseFloat(submission.Peak_Sales_Millions) / 365).toFixed(1)}K/day`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* CRL Status */}
          <div className="detail-section">
            <h3>CRL Status</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">CRL Received:</span>
                <span className={`status-pill ${submission.CRL_Received_Fl === 1 ? 'status-critical' : 'status-approved'}`}>
                  {submission.CRL_Received_Fl === 1 ? 'Yes' : 'No'}
                </span>
              </div>
              {submission.CRL_Category && (
                <div className="detail-item">
                  <span className="detail-label">CRL Category:</span>
                  <span className="detail-value">{submission.CRL_Category}</span>
                </div>
              )}
              <div className="detail-item">
                <span className="detail-label">GMP Site Status:</span>
                <span className={`status-pill ${submission.GMP_Site_Status === 'Cleared' ? 'status-approved' : 'status-warning'}`}>
                  {submission.GMP_Site_Status}
                </span>
              </div>
            </div>
          </div>

          {/* Risk & Manufacturing */}
          <div className="detail-section">
            <h3>Risk & Manufacturing</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">CMC Readiness:</span>
                <span className="detail-value">{submission.CMC_Readiness_Score ?? '—'}/10</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">GMP Site Status:</span>
                <span className={`status-pill ${submission.GMP_Site_Status === 'Cleared' ? 'status-approved' : 'status-warning'}`}>
                  {submission.GMP_Site_Status ?? '—'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Dose Optimization:</span>
                <span className="detail-value">{submission.Dose_Optimization_Status ?? '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Stability Data:</span>
                <span className="detail-value">{submission.Stability_Data_Status ?? '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Clinical Data Gap:</span>
                <span className="detail-value">{submission.Clinical_Data_Gap_Type ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Record Action Form — inline, shown on demand */}
          {showActionForm && (
            <div className="detail-section" style={{background:'#0f172a', borderRadius:6, padding:'16px', border:'1px solid #1e3a5f'}}>
              <h3 style={{marginBottom:12}}>Record Action</h3>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
                <div>
                  <label style={{fontSize:10, color:'#9CA3AF', display:'block', marginBottom:4}}>ACTION TYPE</label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(e.target.value)}
                    style={{width:'100%', background:'#1F2937', border:'1px solid #374151', color:'#F9FAFB', padding:'6px 8px', borderRadius:4, fontSize:13}}
                  >
                    <option>Follow-up</option>
                    <option>Escalation</option>
                    <option>Agency Meeting Request</option>
                    <option>Data Package Submission</option>
                    <option>CRL Response</option>
                    <option>Resubmission</option>
                    <option>Internal Review</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:10, color:'#9CA3AF', display:'block', marginBottom:4}}>OWNER</label>
                  <input
                    type="text"
                    placeholder="Name or team"
                    value={actionOwner}
                    onChange={e => setActionOwner(e.target.value)}
                    style={{width:'100%', background:'#1F2937', border:'1px solid #374151', color:'#F9FAFB', padding:'6px 8px', borderRadius:4, fontSize:13, boxSizing:'border-box'}}
                  />
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:10, color:'#9CA3AF', display:'block', marginBottom:4}}>NOTES</label>
                <textarea
                  rows={3}
                  placeholder="Describe the action taken or planned..."
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  style={{width:'100%', background:'#1F2937', border:'1px solid #374151', color:'#F9FAFB', padding:'8px', borderRadius:4, fontSize:13, resize:'vertical', boxSizing:'border-box'}}
                />
              </div>
              <div style={{display:'flex', gap:8}}>
                <button
                  onClick={handleSaveAction}
                  style={{background: actionSaved ? '#22C55E' : '#FF5F02', color:'#fff', border:'none', padding:'8px 20px', borderRadius:4, cursor:'pointer', fontWeight:600, fontSize:13}}
                >
                  {actionSaved ? '✓ Saved' : 'Save Action'}
                </button>
                <button
                  onClick={() => setShowActionForm(false)}
                  style={{background:'transparent', color:'#9CA3AF', border:'1px solid #374151', padding:'8px 16px', borderRadius:4, cursor:'pointer', fontSize:13}}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={() => setShowActionForm(a => !a)}>
            {showActionForm ? 'Hide Form' : 'Record Action'}
          </button>
          <button className="btn-secondary" onClick={handleExport}>Export JSON</button>
        </div>

      </div>
    </div>
  );
};

export default SubmissionModal;
