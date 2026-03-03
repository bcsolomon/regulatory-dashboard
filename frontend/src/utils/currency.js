/**
 * Shared currency formatting utility.
 * formatBillions: input is already in billions
 * formatMillions: input is in millions, auto-upgrades to B if >= 1000M
 */

// Input in billions — show $XB if >= 1B, else $XM
export const formatBillions = (value, decimals = 1) => {
  const v = parseFloat(value || 0);
  if (v >= 1)   return `$${v.toFixed(decimals)}B`;
  if (v > 0)    return `$${(v * 1000).toFixed(0)}M`;
  return '$0';
};

// Input in millions — show $XB if >= 1000M, else $XM
export const formatMillions = (value, decimals = 1) => {
  const v = parseFloat(value || 0);
  if (v >= 1000) return `$${(v / 1000).toFixed(decimals)}B`;
  if (v >= 1)    return `$${v.toFixed(decimals)}M`;
  if (v > 0)     return `$${(v * 1000).toFixed(0)}K`;
  return '$0';
};
