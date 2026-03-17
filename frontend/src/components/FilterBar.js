import React from 'react';

const FilterBar = ({ filters, onFilterChange }) => {
  const handleChange = (key, value) => onFilterChange({ [key]: value });

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label>Region:</label>
        <select value={filters.region} onChange={e => handleChange('region', e.target.value)}>
          <option value="all">All Regions</option>
          <option value="United States">United States</option>
          <option value="Europe">Europe</option>
          <option value="Asia-Pacific Africa">Asia-Pacific Africa</option>
          <option value="W Hemisphere Ex-US">W Hemisphere Ex-US</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Therapeutic Area:</label>
        <select value={filters.sector} onChange={e => handleChange('sector', e.target.value)}>
          <option value="all">All Areas</option>
          <option value="Oncology">Oncology</option>
          <option value="Immunology">Immunology</option>
          <option value="Neurology">Neurology</option>
          <option value="Cardiovascular">Cardiovascular</option>
          <option value="Rare Disease">Rare Disease</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Predicted Outcome:</label>
        <select value={filters.outcome} onChange={e => handleChange('outcome', e.target.value)}>
          <option value="all">All Outcomes</option>
          <option value="Approved_On_Schedule">✅ Approved on Schedule</option>
          <option value="Delayed">⚠️ Delayed</option>
          <option value="CRL_Received">🔴 CRL Received</option>
          <option value="Withdrawn">⬜ Withdrawn</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Time Range:</label>
        <select value={filters.days} onChange={e => handleChange('days', parseInt(e.target.value))}>
          <option value="9999">All Time</option>
          <option value="730">Last 2 Years</option>
          <option value="365">Last Year</option>
          <option value="180">Last 6 Months</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {/* FINAL: show/hide already-approved drugs toggle */}
      <div className="filter-group">
        <label>Show Approved:</label>
        <button
          onClick={() => handleChange('hideApproved', !filters.hideApproved)}
          style={{
            padding: '6px 12px',
            border: '1px solid',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.15s',
            borderColor: filters.hideApproved ? '#EF4444' : '#22C55E',
            background:  filters.hideApproved ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            color:       filters.hideApproved ? '#EF4444' : '#22C55E',
          }}
        >
          {filters.hideApproved ? '🚫 Hidden' : '✅ Visible'}
        </button>
      </div>

      <div className="filter-actions">
        <button
          onClick={() => onFilterChange({ region: 'all', sector: 'all', outcome: 'all', days: 9999, hideApproved: false })}
          className="clear-filters-btn"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
