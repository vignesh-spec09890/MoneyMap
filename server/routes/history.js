/**
 * History Routes - Get and save user insight history
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { History } = require('../db');

// JWT auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * GET /api/history
 * Get all history entries for authenticated user
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const history = await History.find({ userId: req.userId })
      .select('-transactions') // exclude heavy transactions array for list view
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
});

/**
 * GET /api/history/:id
 * Get a specific history entry with full transactions
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const entry = await History.findOne({ _id: req.params.id, userId: req.userId });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'History entry not found' });
    }
    res.json({ success: true, data: entry });
  } catch (err) {
    console.error('Get history entry error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch history entry' });
  }
});

/**
 * POST /api/history
 * Save a new history entry (called after upload, if user is authenticated)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { fileName, summary, transactions } = req.body;
    if (!fileName || !summary) {
      return res.status(400).json({ success: false, message: 'fileName and summary are required' });
    }
    const entry = new History({
      userId: req.userId,
      fileName,
      summary,
      transactions: transactions || []
    });
    await entry.save();
    res.status(201).json({ success: true, data: { id: entry._id } });
  } catch (err) {
    console.error('Save history error:', err);
    res.status(500).json({ success: false, message: 'Failed to save history' });
  }
});

/**
 * DELETE /api/history/:id
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await History.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete entry' });
  }
});

module.exports = router;
