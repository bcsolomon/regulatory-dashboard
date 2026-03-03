import React from 'react';
import { formatMillions } from '../utils/currency';

const SubmissionTable = ({ submissions, onSubmissionClick }) => {
  
  const getStatusClass = (status, riskScore, daysOverdue) => {
    if (status === 'Approved') return 'status-approved';
    if (status === 'Withdrawn') return 'status-withdrawn';
    if (riskScore >= 7) return 'status-critical';  // Red: highly overdue + bad status
    if (riskScore >= 5) return 'status-warning';   // Amber: overdue or problematic
    if (riskScore >= 3) return 'status-pending';   // Yellow: moderate concern
    return 'status-approved';                      // Green: on track
  };

  const getRiskClass = (riskLevel) => {
    if (riskLevel === 'Critical') return 'status-critical';
    if (riskLevel === 'High') return 'status-warning';
    return 'status-approved';
  };

  const formatCurrency = (value) => {
    return `$${value.toFixed(1)}B`;
  };

  const getProgressWidth = (days) => {
    // Normalize to 0-100% based on typical review time (500 days max)
    return Math.min((days / 500) * 100, 100);
  };

  const getProgressColor = (daysOverdue) => {
    if (daysOverdue > 180) return '#EF4444'; // Red - critical
    if (daysOverdue > 0)   return '#F59E0B'; // Amber - overdue
    return '#22C55E';                        // Green - on track
  };

  return (
    <div className="submission-table-container">
      <table className="submission-table">
        <thead>
          <tr>
            <th>Protocol / Product</th>
            <th>Country</th>
            <th>Status</th>
            <th>Days in Review</th>
            <th>Peak Sales (Country)</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((sub) => (
            <tr 
              key={`${sub.Protocol_ID}-${sub.Country_Code}`}
              onClick={() => onSubmissionClick(sub.Protocol_ID, sub.Country_Code)}
              className="clickable-row"
              title="Click for details"
            >
              <td>
                <div className="protocol-id">{sub.Protocol_ID}</div>
                <div className="product-name">{sub.Product}</div>
              </td>
              <td>
                <div className="country-name">
                  {sub.Country}
                </div>
              </td>
              <td>
                <span className={`status-pill ${getStatusClass(sub.Submission_Status, sub.Risk_Score, sub.Days_Overdue)}`}>
                  {sub.Submission_Status}
                </span>
              </td>
              <td>
                <div className="days-bar-wrap">
                  <div className="days-bar-bg">
                    <div 
                      className="days-bar-fill" 
                      style={{
                        width: `${getProgressWidth(sub.Days_In_Review || 0)}%`,
                        background: getProgressColor(sub.Days_Overdue || 0)
                      }}
                    ></div>
                  </div>
                  <div className="days-num">
                      {sub.Days_In_Review || 0}d
                      {sub.Days_Overdue > 0 && <span style={{color:'#F59E0B',fontSize:'10px',marginLeft:'4px'}}>+{sub.Days_Overdue}d overdue</span>}
                    </div>
                </div>
              </td>
              <td>
                <div className="revenue-val">
                  {sub.Peak_Sales_Millions != null ? formatMillions(sub.Peak_Sales_Millions) : '—'}
                </div>
              </td>
              <td>
                <span className={`status-pill ${sub.Risk_Score >= 7 ? 'status-critical' : sub.Risk_Score >= 4 ? 'status-warning' : 'status-approved'}`}>
                  {sub.Risk_Score != null ? `${sub.Risk_Score}/10` : '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {submissions.length === 0 && (
        <div className="empty-state">
          <p>No submissions match the current filters</p>
        </div>
      )}
    </div>
  );
};

export default SubmissionTable;
