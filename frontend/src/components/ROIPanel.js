import React from 'react';
import { formatMillions } from '../utils/currency';

const ROIPanel = ({ roiData }) => {
  const n = (v) => parseFloat(v || 0);
  const scenarios = [
    { label: 'Accelerate 30 Days', value: n(roiData.accel30Days), description: 'Revenue unlocked across portfolio' },
    { label: 'Accelerate 60 Days', value: n(roiData.accel60Days), description: 'Revenue unlocked across portfolio' },
    { label: 'Accelerate 90 Days', value: n(roiData.accel90Days), description: 'Revenue unlocked across portfolio' },
  ];
  const maxValue = Math.max(n(roiData.accel30Days), n(roiData.accel60Days), n(roiData.accel90Days));
  const getBarWidth = (value, max) => max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="roi-panel">
      {scenarios.map((scenario, i) => (
        <div key={i} className="roi-block">
          <div className="roi-scenario">{scenario.label}</div>
          <div className="roi-value">{formatMillions(scenario.value)}</div>
          <div className="roi-desc">{scenario.description}</div>
        </div>
      ))}
      <div className="roi-chart-area">
        {[
          { label: '30d', val: roiData.accel30Days },
          { label: '60d', val: roiData.accel60Days },
          { label: '90d', val: roiData.accel90Days },
        ].map(({ label, val }) => (
          <div key={label} className="roi-bar-row">
            <div className="roi-bar-label">{label}</div>
            <div className="roi-bar-track">
              <div className="roi-bar-inner" style={{ width: `${getBarWidth(val, maxValue)}%` }}>
                {formatMillions(val)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ROIPanel;
