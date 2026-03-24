import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiFileText, FiCalendar, FiTrendingDown, FiTrendingUp, FiTrash2, FiEye } from 'react-icons/fi';
import { useAuth, useSession } from '../App';
import api from '../services/api';
import './HistoryPage.css';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { setSessionId, setTransactions, setMonths, setFileName } = useSession();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchHistory();
  }, [token]);

  const fetchHistory = async () => {
    try {
      const res = await api.getHistory(token);
      if (res.success) setHistory(res.data);
    } catch (err) {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (entry) => {
    try {
      const res = await api.getHistoryEntry(entry._id, token);
      if (res.success && res.data.transactions?.length > 0) {
        // Build a session from historical data
        const sessionRes = await api.createSessionFromHistory(res.data.transactions);
        if (sessionRes.success) {
          setSessionId(sessionRes.sessionId);
          setTransactions(res.data.transactions);
          const months = [...new Set(res.data.transactions.map(t =>
            new Date(t.date).toLocaleString('default', { month: 'long', year: 'numeric' })
          ))];
          setMonths(months);
          setFileName(entry.fileName);
          navigate('/insights');
        }
      }
    } catch (err) {
      console.error('View history error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this history entry?')) return;
    try {
      await api.deleteHistoryEntry(id, token);
      setHistory(history.filter(h => h._id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="history-page">
      <div className="floating-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="history-container">
        <motion.div
          className="history-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button className="btn btn-secondary back-btn" onClick={() => navigate('/')}>
            <FiArrowLeft /> Back
          </button>
          <div>
            <h1>Your History</h1>
            <p>Past bank statement analyses</p>
          </div>
        </motion.div>

        {loading ? (
          <div className="history-loading">Loading your history...</div>
        ) : error ? (
          <div className="history-error">{error}</div>
        ) : history.length === 0 ? (
          <motion.div
            className="history-empty glass-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FiFileText size={48} />
            <h3>No history yet</h3>
            <p>Upload a bank statement to start tracking your insights</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Upload Statement
            </button>
          </motion.div>
        ) : (
          <div className="history-list">
            {history.map((entry, index) => (
              <motion.div
                key={entry._id}
                className="history-card glass-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="history-card-left">
                  <FiFileText className="file-icon" />
                  <div className="history-info">
                    <h4>{entry.fileName}</h4>
                    <span className="history-date">
                      <FiCalendar /> {formatDate(entry.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="history-stats">
                  <div className="stat-chip">
                    <FiTrendingUp className="credit-icon" />
                    <span>₹{(entry.summary?.totalCredit || 0).toLocaleString()}</span>
                  </div>
                  <div className="stat-chip">
                    <FiTrendingDown className="debit-icon" />
                    <span>₹{(entry.summary?.totalDebit || 0).toLocaleString()}</span>
                  </div>
                  <div className="stat-chip">
                    <span>{entry.summary?.totalTransactions || 0} txns</span>
                  </div>
                </div>

                <div className="history-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleView(entry)}
                    title="View insights"
                  >
                    <FiEye /> View
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(entry._id)}
                    title="Delete"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
