/**
 * API Service — v2 DanAI edition
 * Adds: predictions, protocol-cards, model-metadata, intervention-chat-context
 * Backend runs on port 5124 to avoid collision with v1 (5123)
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getKPIs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.region && filters.region !== 'all') params.append('region', filters.region);
    if (filters.sector && filters.sector !== 'all') params.append('sector', filters.sector);
    if (filters.days) params.append('days', filters.days);
    if (filters.hideApproved) params.append('hideApproved', 'true');
    const response = await this.client.get(`/kpis?${params.toString()}`);
    return response.data;
  }

  async getProtocolCards(filters = {}) {
    const params = new URLSearchParams();
    if (filters.region  && filters.region  !== 'all') params.append('region',  filters.region);
    if (filters.sector  && filters.sector  !== 'all') params.append('sector',  filters.sector);
    if (filters.outcome && filters.outcome !== 'all') params.append('outcome', filters.outcome);
    if (filters.hideApproved) params.append('hideApproved', 'true');
    const response = await this.client.get(`/protocol-cards?${params.toString()}`);
    return response.data.cards;
  }

  async getSubmissions(filters = {}) {
    const params = new URLSearchParams();
    if (filters.region  && filters.region  !== 'all') params.append('region',  filters.region);
    if (filters.sector  && filters.sector  !== 'all') params.append('sector',  filters.sector);
    if (filters.outcome && filters.outcome !== 'all') params.append('outcome', filters.outcome);
    if (filters.days) params.append('days', filters.days);
    const response = await this.client.get(`/submissions?${params.toString()}`);
    return response.data.submissions;
  }

  async getPredictions(outcome = 'all') {
    const params = outcome !== 'all' ? `?outcome=${outcome}` : '';
    const response = await this.client.get(`/predictions${params}`);
    return response.data.predictions;
  }

  async getModelMetadata() {
    const response = await this.client.get('/model-metadata');
    return response.data;
  }

  async getInterventions() {
    const response = await this.client.get('/interventions');
    return response.data.interventions;
  }

  async getInterventionChatContext(protocolId, countryCode) {
    const response = await this.client.get(
      `/intervention-chat-context/${protocolId}/${encodeURIComponent(countryCode.trim())}`
    );
    return response.data;
  }

  async getRegionalBreakdown(filters = {}) {
    const params = new URLSearchParams();
    if (filters.sector      && filters.sector  !== 'all') params.append('sector',       filters.sector);
    if (filters.hideApproved) params.append('hideApproved', 'true');
    const response = await this.client.get(`/regional-breakdown?${params.toString()}`);
    return response.data.regions;
  }

  async getROIScenarios() {
    const response = await this.client.get('/roi-scenarios');
    return response.data;
  }

  async getSubmissionDetails(protocolId, countryCode) {
    const response = await this.client.get(
      `/submission-details/${protocolId}/${encodeURIComponent(countryCode.trim())}`
    );
    return response.data.submission;
  }

  async getCriticalDelays() {
    const response = await this.client.get('/critical-delays');
    return response.data.criticalDelays;
  }

  async getPortfolioSummary() {
    const response = await this.client.get('/portfolio-summary');
    return response.data.portfolio;
  }

  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;
