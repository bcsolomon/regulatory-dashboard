import React from 'react';

const FilterBar = ({ filters, onFilterChange }) => {
  
  const handleChange = (key, value) => {
    onFilterChange({ [key]: value });
  };

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label>Region:</label>
        <select 
          value={filters.region} 
          onChange={(e) => handleChange('region', e.target.value)}
        >
          <option value="all">All Regions</option>
          <option value="United States">United States</option>
          <option value="Europe">Europe</option>
          <option value="Asia-Pacific Africa">Asia-Pacific Africa</option>
          <option value="W Hemisphere Ex-US">W Hemisphere Ex-US</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Therapeutic Area:</label>
        <select 
          value={filters.sector} 
          onChange={(e) => handleChange('sector', e.target.value)}
        >
          <option value="all">All Areas</option>
          <option value="Oncology">Oncology</option>
          <option value="Immunology">Immunology</option>
          <option value="Neurology">Neurology</option>
          <option value="Cardiovascular">Cardiovascular</option>
          <option value="Rare Disease">Rare Disease</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Status:</label>
        <select 
          value={filters.status} 
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="Under Review">Under Review</option>
          <option value="Approved">Approved</option>
          <option value="Additional Information Requested">Additional Info Requested</option>
          <option value="Additional Data Required">Additional Data Required</option>
          <option value="Pending Resubmission Review">Pending Resubmission</option>
          <option value="Withdrawn">Withdrawn</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Time Range:</label>
        <select 
          value={filters.days} 
          onChange={(e) => handleChange('days', parseInt(e.target.value))}
        >
          <option value="9999">All Time</option>
          <option value="730">Last 2 Years</option>
          <option value="365">Last Year</option>
          <option value="180">Last 6 Months</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      <div className="filter-actions">
        <button 
          onClick={() => onFilterChange({ region: 'all', sector: 'all', status: 'all', days: 365 })}
          className="clear-filters-btn"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
