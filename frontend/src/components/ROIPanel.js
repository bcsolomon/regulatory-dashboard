import React from 'react';
import { formatMillions } from '../utils/currency';

const ROIPanel = ({ roiData }) => {
  
  const n = (v) => parseFloat(v || 0);

  const scenarios = [
    {
      label: 'Accelerate 30 Days',
      value: n(roiData.accel30Days),
      description: 'Revenue unlocked across portfolio'
    },
    {
      label: 'Accelerate 60 Days',
      value: n(roiData.accel60Days),
      description: 'Revenue unlocked across portfolio'
    },
    {
      label: 'Accelerate 90 Days',
      value: n(roiData.accel90Days),
      description: 'Revenue unlocked across portfolio'
    }
  ];

  const getBarWidth = (value, max) => {
    return max > 0 ? (value / max) * 100 : 0;
  };

  const maxValue = Math.max(n(roiData.accel30Days), n(roiData.accel60Days), n(roiData.accel90Days));

  return (
    <div className="roi-panel">
      {scenarios.map((scenario, index) => (
        <div key={index} className="roi-block">
          <div className="roi-scenario">{scenario.label}</div>
          <div className="roi-value">{formatMillions(scenario.value)}</div>
          <div className="roi-desc">{scenario.description}</div>
        </div>
      ))}

      {/* ROI Chart Area */}
      <div className="roi-chart-area">
        <div className="roi-bar-row">
          <div className="roi-bar-label">30d</div>
          <div className="roi-bar-track">
            <div 
              className="roi-bar-inner" 
              style={{ width: `${getBarWidth(roiData.accel30Days, maxValue)}%` }}
            >
              {formatMillions(roiData.accel30Days)}
            </div>
          </div>
        </div>
        <div className="roi-bar-row">
          <div className="roi-bar-label">60d</div>
          <div className="roi-bar-track">
            <div 
              className="roi-bar-inner" 
              style={{ width: `${getBarWidth(roiData.accel60Days, maxValue)}%` }}
            >
              {formatMillions(roiData.accel60Days)}
            </div>
          </div>
        </div>
        <div className="roi-bar-row">
          <div className="roi-bar-label">90d</div>
          <div className="roi-bar-track">
            <div 
              className="roi-bar-inner" 
              style={{ width: `${getBarWidth(roiData.accel90Days, maxValue)}%` }}
            >
              {formatMillions(roiData.accel90Days)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROIPanel;
