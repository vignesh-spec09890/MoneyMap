/**
 * Insights Routes - Generate financial analytics and insights
 */

const express = require('express');
const router = express.Router();
const uploadRoutes = require('./upload');
const analyticsService = require('../services/analytics');

/**
 * GET /api/insights/:sessionId/overview
 * Get overall financial overview
 */
router.get('/:sessionId/overview', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const overview = analyticsService.getOverview(sessionData.transactions);

  res.json({
    success: true,
    data: overview
  });
});

/**
 * GET /api/insights/:sessionId/categories
 * Get category-wise breakdown
 */
router.get('/:sessionId/categories', (req, res) => {
  const { sessionId } = req.params;
  const { type } = req.query; // 'credit', 'debit', or 'all'
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const categories = analyticsService.getCategoryBreakdown(
    sessionData.transactions,
    type || 'all'
  );

  res.json({
    success: true,
    data: categories
  });
});

/**
 * GET /api/insights/:sessionId/monthly
 * Get monthly breakdown
 */
router.get('/:sessionId/monthly', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const monthly = analyticsService.getMonthlyBreakdown(sessionData.transactions);

  res.json({
    success: true,
    data: monthly
  });
});

/**
 * GET /api/insights/:sessionId/recipients
 * Get recipient/sender analysis
 */
router.get('/:sessionId/recipients', (req, res) => {
  const { sessionId } = req.params;
  const { limit } = req.query;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const recipients = analyticsService.getRecipientAnalysis(
    sessionData.transactions,
    parseInt(limit) || 10
  );

  res.json({
    success: true,
    data: recipients
  });
});

/**
 * GET /api/insights/:sessionId/trends
 * Get spending trends
 */
router.get('/:sessionId/trends', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const trends = analyticsService.getSpendingTrends(sessionData.transactions);

  res.json({
    success: true,
    data: trends
  });
});

/**
 * GET /api/insights/:sessionId/recurring
 * Detect recurring payments
 */
router.get('/:sessionId/recurring', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const recurring = analyticsService.detectRecurringPayments(sessionData.transactions);

  res.json({
    success: true,
    data: recurring
  });
});

/**
 * GET /api/insights/:sessionId/transactions
 * Get filtered transactions
 */
router.get('/:sessionId/transactions', (req, res) => {
  const { sessionId } = req.params;
  const { type, category, month, recipient } = req.query;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  let transactions = [...sessionData.transactions];

  // Filter by type
  if (type && type !== 'all') {
    transactions = transactions.filter(t => t.type.toLowerCase() === type.toLowerCase());
  }

  // Filter by category
  if (category && category !== 'all') {
    transactions = transactions.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }

  // Filter by month
  if (month) {
    transactions = transactions.filter(t => {
      const txMonth = new Date(t.date).toLocaleString('default', { month: 'long', year: 'numeric' });
      return txMonth === month;
    });
  }

  // Filter by recipient
  if (recipient) {
    transactions = transactions.filter(t => 
      t.recipient.toLowerCase().includes(recipient.toLowerCase())
    );
  }

  res.json({
    success: true,
    data: transactions,
    count: transactions.length
  });
});

/**
 * GET /api/insights/:sessionId/compare
 * Compare two months
 */
router.get('/:sessionId/compare', (req, res) => {
  const { sessionId } = req.params;
  const { month1, month2 } = req.query;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  if (!month1 || !month2) {
    return res.status(400).json({
      success: false,
      message: 'Both month1 and month2 are required for comparison'
    });
  }

  const comparison = analyticsService.compareMonths(
    sessionData.transactions,
    month1,
    month2
  );

  res.json({
    success: true,
    data: comparison
  });
});

/**
 * GET /api/insights/:sessionId/anomalies
 * Detect unusual spending patterns
 */
router.get('/:sessionId/anomalies', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const anomalies = analyticsService.detectAnomalies(sessionData.transactions);

  res.json({
    success: true,
    data: anomalies
  });
});

/**
 * GET /api/insights/:sessionId/prediction
 * Predict next month spending
 */
router.get('/:sessionId/prediction', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const prediction = analyticsService.predictNextMonth(sessionData.transactions);

  res.json({
    success: true,
    data: prediction
  });
});

/**
 * GET /api/insights/:sessionId/export
 * Export transactions as CSV
 */
router.get('/:sessionId/export', (req, res) => {
  const { sessionId } = req.params;
  const sessionData = uploadRoutes.sessionData.get(sessionId);

  if (!sessionData) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }

  const csv = analyticsService.exportToCSV(sessionData.transactions);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
  res.send(csv);
});

module.exports = router;
