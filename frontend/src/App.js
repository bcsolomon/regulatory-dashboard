import React, { useState, useEffect, useRef } from 'react';
import ApiService from './services/api';
import KPIStrip from './components/KPIStrip';
import ProtocolCards from './components/ProtocolCards';
import InterventionChat from './components/InterventionChat';
import RegionalBreakdown from './components/RegionalBreakdown';
import ROIPanel from './components/ROIPanel';
import FilterBar from './components/FilterBar';
import ModelCard from './components/ModelCard';
import SubmissionModal from './components/SubmissionModal';
import './App.css';

function App() {
  const [kpis, setKpis]                   = useState(null);
  const [cards, setCards]                 = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [regions, setRegions]             = useState([]);
  const [roiData, setRoiData]             = useState(null);
  const [modelMeta, setModelMeta]         = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedCard, setSelectedCard]             = useState(null);
  const interventionRef = useRef(null);
  const [filters, setFilters]             = useState({
    region: 'all',
    sector: 'all',
    outcome: 'all',
    days: 9999,
    hideApproved: false
  });

  const fetchId = useRef(0);

  // Truly static data — load once, never changes with filters
  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [interventionsData, modelData] = await Promise.all([
          ApiService.getInterventions(),
          ApiService.getModelMetadata(),
        ]);
        setInterventions(interventionsData);
        setModelMeta(modelData);
      } catch (err) {
        console.error('Static data error:', err);
      }
    };
    loadStatic();
  }, []);

  // Filtered data — re-fetch on filter change
  useEffect(() => {
    const myId = ++fetchId.current;
    setCards([]);

    const loadFiltered = async () => {
      setLoading(true);
      try {
        const [kpiData, cardsData, roiScenarios, regionsData] = await Promise.all([
          ApiService.getKPIs(filters),
          ApiService.getProtocolCards(filters),
          ApiService.getROIScenarios(),
          ApiService.getRegionalBreakdown(filters),
        ]);

        if (myId !== fetchId.current) return;

        setKpis(kpiData);
        setCards(cardsData);
        setRoiData(roiScenarios);
        setRegions(regionsData);
      } catch (err) {
        if (myId !== fetchId.current) return;
        console.error('Filtered fetch error:', err);
        setError('Failed to load data. Please check your Teradata connection.');
      } finally {
        if (myId === fetchId.current) setLoading(false);
      }
    };

    loadFiltered();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (newFilters) => setFilters(prev => ({ ...prev, ...newFilters }));

  const handleCardClick = async (protocolId, countryCode) => {
    try {
      const details = await ApiService.getSubmissionDetails(protocolId, countryCode);
      setSelectedSubmission(details);
    } catch (err) {
      console.error('Error fetching submission details:', err);
    }
  };

  const handleRegionClick = (regionName) => {
    setFilters(prev => ({ ...prev, region: regionName }));
  };

  const handleAnalyzeCard = (card) => {
    setSelectedCard({ ...card, _ts: Date.now() }); // _ts forces useEffect to fire even if same card re-selected
    // Scroll down to the intervention panel
    setTimeout(() => {
      interventionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  if (loading && !kpis) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading Regulatory Intelligence v2...</p>
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

  const urgentCount = interventions.filter(i =>
    i.Predicted_Outcome === 'CRL_Received' || i.Predicted_Outcome === 'Withdrawn'
  ).length;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo-mark"></div>
          <div className="logo-text">
            Regulatory <span className="accent">Intelligence</span> Command Center
            <span style={{ marginLeft: 10, fontSize: 10, color: 'rgba(255,95,2,0.7)', fontWeight: 400, letterSpacing: '0.05em' }}>
              v2 · ML Predictions
            </span>
          </div>
        </div>
        <div className="header-meta">
          <span className="live-badge"><span className="live-dot"></span>LIVE</span>
          <span>Last refresh: {new Date().toLocaleTimeString()}</span>
          <span>User: RA.Operations</span>
          <button onClick={() => setFilters(f => ({ ...f }))} className="refresh-btn">🔄 Refresh</button>
        </div>
      </header>

      <FilterBar filters={filters} onFilterChange={handleFilterChange} />

      {regions.length > 0 && (
        <RegionalBreakdown regions={regions} onRegionClick={handleRegionClick} selectedRegion={filters.region} />
      )}

      {kpis && <KPIStrip kpis={kpis} days={filters.days} />}

      {/* Protocol Cards — new in v2, replaces active submissions chart */}
      <div className="panel" style={{ margin: '1px 0', padding: 24 }}>
        <div className="panel-header">
          <div className="panel-title">Protocol Portfolio — Predicted Outcomes</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {loading && <div className="panel-badge">UPDATING...</div>}
            <div className="panel-badge">{cards.length} PROTOCOLS</div>
          </div>
        </div>
        <ProtocolCards cards={cards} onCardClick={handleCardClick} onAnalyzeClick={handleAnalyzeCard} />
      </div>

      {/* Intervention Chat — new in v2, replaces static queue */}
      <div ref={interventionRef} className="panel" style={{ margin: '1px 0', padding: 0, overflow: 'hidden' }}>
        <div className="panel-header" style={{ padding: '16px 24px', borderBottom: '1px solid #1F2937' }}>
          <div className="panel-title">Intervention Intelligence</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {urgentCount > 0 && (
              <div className="panel-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {urgentCount} URGENT
              </div>
            )}
            <div className="panel-badge">AI-ASSISTED ANALYSIS</div>
          </div>
        </div>
        <InterventionChat interventions={interventions} selectedCard={selectedCard} />
      </div>

      {roiData && <ROIPanel roiData={roiData} />}

      {/* Model transparency card — new in v2 */}
      {modelMeta && (
        <div className="panel" style={{ margin: '1px 0', padding: 24 }}>
          <div className="panel-header">
            <div className="panel-title">Model Transparency</div>
            <div className="panel-badge">
              {modelMeta.currentModel?.Model_Version} · {Math.round((parseFloat(modelMeta.currentModel?.Test_Accuracy || 0)) * 100)}% ACCURACY
            </div>
          </div>
          <ModelCard modelMeta={modelMeta} />
        </div>
      )}

      {selectedSubmission && (
        <SubmissionModal submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
      )}

      <footer className="footer">
        <div className="footer-left">hcls · Teradata VantageCloud · FINAL</div>
        <div className="footer-right">Regulatory Affairs Intelligence · ML Outcome Predictions · 4-Class Model</div>
      </footer>
    </div>
  );
}

export default App;
