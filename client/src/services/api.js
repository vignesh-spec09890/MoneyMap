/**
 * API Service
 * Handles all HTTP requests to the backend
 */

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Helper to get auth header
function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = {
  /**
   * Check AI/Ollama status
   * @returns {Promise<Object>} - AI status
   */
  getAIStatus: async () => {
    const response = await apiClient.get('/ai/status');
    return response.data;
  },

  /**
   * Upload bank statement
   * @param {FormData} formData - Form data with file
   * @returns {Promise<Object>} - Upload response
   */
  uploadStatement: async (formData) => {
    const response = await apiClient.post('/upload/statement', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 600000 // 10 minutes for large PDFs
    });
    return response.data;
  },

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Session data
   */
  getSessionData: async (sessionId) => {
    const response = await apiClient.get(`/upload/session/${sessionId}`);
    return response.data;
  },

  /**
   * Clear session data
   * @param {string} sessionId - Session ID
   */
  clearSession: async (sessionId) => {
    const response = await apiClient.delete(`/upload/session/${sessionId}`);
    return response.data;
  },

  /**
   * Get financial overview
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Overview data
   */
  getOverview: async (sessionId) => {
    const response = await apiClient.get(`/insights/${sessionId}/overview`);
    return response.data;
  },

  /**
   * Get category breakdown
   * @param {string} sessionId - Session ID
   * @param {string} type - 'credit', 'debit', or 'all'
   * @returns {Promise<Object>} - Category data
   */
  getCategories: async (sessionId, type = 'all') => {
    const response = await apiClient.get(`/insights/${sessionId}/categories`, {
      params: { type }
    });
    return response.data;
  },

  /**
   * Get monthly breakdown
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Monthly data
   */
  getMonthly: async (sessionId) => {
    const response = await apiClient.get(`/insights/${sessionId}/monthly`);
    return response.data;
  },

  /**
   * Get recipient analysis
   * @param {string} sessionId - Session ID
   * @param {number} limit - Max recipients to return
   * @returns {Promise<Object>} - Recipient data
   */
  getRecipients: async (sessionId, limit = 10) => {
    const response = await apiClient.get(`/insights/${sessionId}/recipients`, {
      params: { limit }
    });
    return response.data;
  },

  /**
   * Get spending trends
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Trend data
   */
  getTrends: async (sessionId) => {
    const response = await apiClient.get(`/insights/${sessionId}/trends`);
    return response.data;
  },

  /**
   * Get recurring payments
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Recurring payment data
   */
  getRecurring: async (sessionId) => {
    const response = await apiClient.get(`/insights/${sessionId}/recurring`);
    return response.data;
  },

  /**
   * Get filtered transactions
   * @param {string} sessionId - Session ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} - Filtered transactions
   */
  getTransactions: async (sessionId, filters = {}) => {
    const response = await apiClient.get(`/insights/${sessionId}/transactions`, {
      params: filters
    });
    return response.data;
  },

  /**
   * Compare two months
   * @param {string} sessionId - Session ID
   * @param {string} month1 - First month
   * @param {string} month2 - Second month
   * @returns {Promise<Object>} - Comparison data
   */
  compareMonths: async (sessionId, month1, month2) => {
    const response = await apiClient.get(`/insights/${sessionId}/compare`, {
      params: { month1, month2 }
    });
    return response.data;
  },

  /**
   * Get anomalies
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Anomaly data
   */
  getAnomalies: async (sessionId) => {
    const response = await apiClient.get(`/insights/${sessionId}/anomalies`);
    return response.data;
  },

  /**
   * Get spending prediction
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Prediction data
   */
  getPrediction: async (sessionId) => {
    const response = await apiClient.get(`/insights/${sessionId}/prediction`);
    return response.data;
  },

  /**
   * Export transactions as CSV
   * @param {string} sessionId - Session ID
   * @returns {Promise<Blob>} - CSV file blob
   */
  exportCSV: async (sessionId) => {
    const response = await apiClient.get(`/insights/${sessionId}/export`, {
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * Health check
   * @returns {Promise<Object>} - Health status
   */
  healthCheck: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // ── Auth ──────────────────────────────────────────
  register: async (name, email, password) => {
    const response = await apiClient.post('/auth/register', { name, email, password });
    return response.data;
  },

  login: async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  // ── History ───────────────────────────────────────
  saveHistory: async (token, fileName, summary, transactions) => {
    const response = await apiClient.post('/history', { fileName, summary, transactions }, {
      headers: authHeader(token)
    });
    return response.data;
  },

  getHistory: async (token) => {
    const response = await apiClient.get('/history', { headers: authHeader(token) });
    return response.data;
  },

  getHistoryEntry: async (id, token) => {
    const response = await apiClient.get(`/history/${id}`, { headers: authHeader(token) });
    return response.data;
  },

  deleteHistoryEntry: async (id, token) => {
    const response = await apiClient.delete(`/history/${id}`, { headers: authHeader(token) });
    return response.data;
  },

  // Re-create a session from stored transactions (for viewing historical data)
  createSessionFromHistory: async (transactions) => {
    const response = await apiClient.post('/upload/session-from-history', { transactions });
    return response.data;
  }
};

export default api;
