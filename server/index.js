/**
 * Bank Statement Insight Generator - Server
 * Main entry point for the Express backend
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const uploadRoutes = require('./routes/upload');
const insightsRoutes = require('./routes/insights');
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const visionParser = require('./services/visionParser');
const { connectDB } = require('./db');

// Connect to MongoDB Atlas
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads (temporary)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Bank Statement Insight Generator API is running' });
});

// OCR / AI status check
app.get('/api/ai/status', async (req, res) => {
  const status = visionParser.getVisionStatus();
  res.json({
    success: true,
    aiEnabled: status.available,
    provider: status.provider,
    model: status.model,
    message: status.available
      ? `AI enabled - ${status.provider}`
      : 'OCR disabled - Set HF_TOKEN in server/.env'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Bank Statement Insight Generator API ready`);
});

// Increase server timeout for large PDF processing (10 minutes)
server.timeout = 600000;
server.keepAliveTimeout = 600000;

module.exports = app;
