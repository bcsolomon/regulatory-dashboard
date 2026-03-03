import React from 'react';
import { formatMillions } from '../utils/currency';

const InterventionQueue = ({ interventions, onInterventionClick }) => {

  const getUrgencyClass = (score) => {
    if (score >= 8) return 'urgent';
    if (score >= 5) return 'high';
    return 'watch';
  };

  const getUrgencyColor = (score) => {
    if (score >= 8) return '#EF4444';
    if (score >= 5) return '#F59E0B';
    return '#3B82F6';
  };

  return (
    <div className="intervention-queue">
      {interventions.slice(0, 10).map((intervention, index) => (
        <div
          key={index}
          className={`risk-item ${getUrgencyClass(intervention.Risk_Score)}`}
          onClick={() => onInterventionClick(intervention.Protocol_ID, intervention.Country_Code)}
        >
          <div className="risk-type">Risk {intervention.Risk_Score}/10 · {intervention.Regulatory_Authority}</div>
          <div className="risk-title">{intervention.Product} — {intervention.Country_Code}</div>
          <div className="risk-meta">{intervention.Recommended_Action}</div>
          <div className="risk-amount" style={{ color: getUrgencyColor(intervention.Risk_Score) }}>
            {formatMillions(intervention.Revenue_At_Risk_Millions)} at risk
          </div>
        </div>
      ))}

      {interventions.length === 0 && (
        <div className="empty-state">
          <p>No interventions required</p>
          <p className="text-muted">All submissions on track</p>
        </div>
      )}
    </div>
  );
};

export default InterventionQueue;
