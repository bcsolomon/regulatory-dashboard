import React from 'react';
import { formatBillions } from '../utils/currency';

const KPIStrip = ({ kpis, days }) => {

  const getApprovedLabel = (days) => {
    if (!days || days >= 9999) return 'Approved (All Time)';
    if (days <= 90)  return 'Approved (90 Days)';
    if (days <= 180) return 'Approved (6 Months)';
    if (days <= 365) return 'Approved (1 Year)';
    if (days <= 730) return 'Approved (2 Years)';
    return `Approved (${days}d)`;
  };

  const getApprovedSub = (days) => {
    if (!days || days >= 9999) return 'All time approvals';
    if (days <= 90)  return 'Last 90 days';
    if (days <= 180) return 'Last 6 months';
    if (days <= 365) return 'Last 12 months';
    if (days <= 730) return 'Last 2 years';
    return `Last ${days} days`;
  };

  const kpiConfig = [
    {
      label: 'Total Pipeline',
      value: formatBillions(kpis.totalPipeline),
      sub: `${kpis.totalSubmissions || (kpis.pendingApprovals || 0) + (kpis.approvedYTD || 0)} submissions`,
      color: 'teal'
    },
    {
      label: 'Pending Approvals',
      value: kpis.pendingApprovals ?? '—',
      sub: 'Active & under review',
      color: 'amber'
    },
    {
      label: getApprovedLabel(days),
      value: kpis.approvedYTD ?? '—',
      sub: getApprovedSub(days),
      color: 'green'
    },
    {
      label: 'Avg Cycle Time',
      value: kpis.avgCycleTime != null && kpis.avgCycleTime > 0 ? `${kpis.avgCycleTime}d` : '—',
      sub: 'Submission to approval',
      color: 'blue'
    },
    {
      label: 'CRLs Received',
      value: kpis.crlCount ?? '—',
      sub: kpis.crlCount > 0 ? 'Requires response' : 'No active CRLs',
      color: 'red'
    }
  ];

  return (
    <div className="kpi-strip">
      {kpiConfig.map((kpi, index) => (
        <div key={index} className={`kpi ${kpi.color}`}>
          <div className="kpi-label">{kpi.label}</div>
          <div className="kpi-value">{kpi.value}</div>
          <div className="kpi-sub">{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
};

export default KPIStrip;
