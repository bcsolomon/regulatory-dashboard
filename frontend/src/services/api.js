/**
 * API Service for Teradata Backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5123/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // Get KPI metrics
  async getKPIs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.region && filters.region !== 'all') params.append('region', filters.region);
    if (filters.sector && filters.sector !== 'all') params.append('sector', filters.sector);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.days) params.append('days', filters.days);
    
    const response = await this.client.get(`/kpis?${params.toString()}`);
    return response.data;
  }

  // Get submissions list
  async getSubmissions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.region && filters.region !== 'all') params.append('region', filters.region);
    if (filters.sector && filters.sector !== 'all') params.append('sector', filters.sector);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.days) params.append('days', filters.days);
    
    const response = await this.client.get(`/submissions?${params.toString()}`);
    return response.data.submissions;
  }

  // Get intervention queue
  async getInterventions() {
    const response = await this.client.get('/interventions');
    return response.data.interventions;
  }

  // Get regional breakdown
  async getRegionalBreakdown() {
    const response = await this.client.get('/regional-breakdown');
    return response.data.regions;
  }

  // Get ROI scenarios
  async getROIScenarios() {
    const response = await this.client.get('/roi-scenarios');
    return response.data;
  }

  // Get submission details (drill-down)
  async getSubmissionDetails(protocolId, countryCode) {
    const response = await this.client.get(`/submission-details/${protocolId}/${encodeURIComponent(countryCode.trim())}`);
    return response.data.submission;
  }

  // Get critical delays
  async getCriticalDelays() {
    const response = await this.client.get('/critical-delays');
    return response.data.criticalDelays;
  }

  // Get approval pipeline breakdown
  async getApprovalPipeline(filters = {}) {
    const params = new URLSearchParams();
    if (filters.region && filters.region !== 'all') params.append('region', filters.region);
    if (filters.sector && filters.sector !== 'all') params.append('sector', filters.sector);
    const response = await this.client.get(`/approval-pipeline?${params.toString()}`);
    return response.data.pipeline;
  }

  // Get portfolio summary by sector
  async getPortfolioSummary() {
    const response = await this.client.get('/portfolio-summary');
    return response.data.portfolio;
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;
