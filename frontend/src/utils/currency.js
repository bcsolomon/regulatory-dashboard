export const formatBillions = (value, decimals = 1) => {
  const v = parseFloat(value || 0);
  if (v >= 1)   return `$${v.toFixed(decimals)}B`;
  if (v > 0)    return `$${(v * 1000).toFixed(0)}M`;
  return '$0';
};

export const formatMillions = (value, decimals = 1) => {
  const v = parseFloat(value || 0);
  if (v >= 1000) return `$${(v / 1000).toFixed(decimals)}B`;
  if (v >= 1)    return `$${v.toFixed(decimals)}M`;
  if (v > 0)     return `$${(v * 1000).toFixed(0)}K`;
  return '$0';
};

/**
 * Returns color hex for a given ML outcome class
 */
export const outcomeColor = (outcome) => {
  switch (outcome) {
    case 'Approved_On_Schedule': return '#22C55E';
    case 'Delayed':              return '#F59E0B';
    case 'CRL_Received':         return '#EF4444';
    case 'Withdrawn':            return '#6B7280';
    default:                     return '#9CA3AF';
  }
};

export const outcomeLabel = (outcome) => {
  switch (outcome) {
    case 'Approved_On_Schedule': return 'Approved';
    case 'Delayed':              return 'Delayed';
    case 'CRL_Received':         return 'CRL';
    case 'Withdrawn':            return 'Withdrawn';
    default:                     return outcome || '—';
  }
};

export const outcomeBg = (outcome) => {
  switch (outcome) {
    case 'Approved_On_Schedule': return 'rgba(34,197,94,0.12)';
    case 'Delayed':              return 'rgba(245,158,11,0.12)';
    case 'CRL_Received':         return 'rgba(239,68,68,0.12)';
    case 'Withdrawn':            return 'rgba(107,114,128,0.12)';
    default:                     return 'rgba(156,163,175,0.12)';
  }
};
