import React, { useState, useEffect, useRef } from 'react';
import ApiService from './services/api';
import KPIStrip from './components/KPIStrip';
import SubmissionTable from './components/SubmissionTable';
import InterventionQueue from './components/InterventionQueue';
import RegionalBreakdown from './components/RegionalBreakdown';
import ROIPanel from './components/ROIPanel';
import FilterBar from './components/FilterBar';
import SubmissionModal from './components/SubmissionModal';
import './App.css';

function App() {
  const [kpis, setKpis] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [regions, setRegions] = useState([]);
  const [roiData, setRoiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [filters, setFilters] = useState({
    region: 'all',
    sector: 'all',
    status: 'all',
    days: 9999
  });

  const filteredFetchId = useRef(0);

  // Static data — load once on mount, never re-fetch on filter change
  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [interventionsData, regionsData] = await Promise.all([
          ApiService.getInterventions(),
          ApiService.getRegionalBreakdown(),
        ]);
        setInterventions(interventionsData);
        setRegions(regionsData);
      } catch (err) {
        console.error('Static data error:', err);
      }
    };
    loadStatic();
  }, []);

  // Filtered data — re-fetch on every filter change
  useEffect(() => {
    const myFetchId = ++filteredFetchId.current;

    setSubmissions([]);  // clear immediately so stale rows don't linger

    const loadFiltered = async () => {
      setLoading(true);
      try {
        const [kpiData, submissionsData, roiScenarios] = await Promise.all([
          ApiService.getKPIs(filters),
          ApiService.getSubmissions(filters),
          ApiService.getROIScenarios(),
        ]);

        // Discard if a newer filter change has since fired
        if (myFetchId !== filteredFetchId.current) return;

        setKpis(kpiData);
        setSubmissions(submissionsData);
        setRoiData(roiScenarios);
      } catch (err) {
        if (myFetchId !== filteredFetchId.current) return;
        console.error('Filtered fetch error:', err);
        setError('Failed to load data. Please check your Teradata connection.');
      } finally {
        if (myFetchId === filteredFetchId.current) setLoading(false);
      }
    };

    loadFiltered();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSubmissionClick = async (protocolId, countryCode) => {
    try {
      const details = await ApiService.getSubmissionDetails(protocolId, countryCode);
      setSelectedSubmission(details);
    } catch (err) {
      console.error('Error fetching submission details:', err);
      alert('Failed to load submission details');
    }
  };

  const handleRegionClick = (regionName) => {
    setFilters(prev => ({ ...prev, region: regionName }));
  };

  if (loading && !kpis) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Regulatory Intelligence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Connection Error</h2>
        <p>{error}</p>
        <button onClick={() => setFilters(f => ({ ...f }))}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo-mark"></div>
          <div className="logo-text">
            Regulatory <span className="accent">Intelligence</span> Command Center
          </div>
        </div>
        <div className="header-meta">
          <span className="live-badge">
            <span className="live-dot"></span>LIVE
          </span>
          <span>Last refresh: {new Date().toLocaleTimeString()}</span>
          <span>User: RA.Operations</span>
          <button onClick={() => setFilters(f => ({ ...f }))} className="refresh-btn">🔄 Refresh</button>
        </div>
      </header>

      <FilterBar filters={filters} onFilterChange={handleFilterChange} />

      {regions && (
        <RegionalBreakdown
          regions={regions}
          onRegionClick={handleRegionClick}
          selectedRegion={filters.region}
        />
      )}

      {kpis && <KPIStrip kpis={kpis} days={filters.days} />}

      <div className="main-grid">
        <div className="panel submission-panel">
          <div className="panel-header">
            <div className="panel-title">Active Submissions — Regulatory Status</div>
            <div className="panel-badge">{loading ? 'UPDATING...' : 'LIVE TRACKING'}</div>
          </div>
          <SubmissionTable submissions={submissions} onSubmissionClick={handleSubmissionClick} />
        </div>

        <div className="panel intervention-panel">
          <div className="panel-header">
            <div className="panel-title">Intervention Queue</div>
            <div className="panel-badge">
              {interventions.filter(i => i.Risk_Score >= 8).length} URGENT
            </div>
          </div>
          <InterventionQueue interventions={interventions} onInterventionClick={handleSubmissionClick} />
        </div>
      </div>

      {roiData && <ROIPanel roiData={roiData} />}

      {selectedSubmission && (
        <SubmissionModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}

      <footer className="footer">
        <div className="footer-left">hcls · Teradata · v3.0</div>
        <div className="footer-right">Enterprise Pharmaceutical — Regulatory Affairs Analytics</div>
      </footer>
    </div>
  );
}

export default App;
