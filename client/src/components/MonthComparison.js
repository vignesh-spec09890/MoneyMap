import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  FiX, 
  FiArrowUp, 
  FiArrowDown,
  FiMinus
} from 'react-icons/fi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import api from '../services/api';
import './MonthComparison.css';

const MonthComparison = ({ sessionId, months, initialMonth1, initialMonth2, onClose }) => {
  const [month1, setMonth1] = useState(initialMonth1);
  const [month2, setMonth2] = useState(initialMonth2);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchComparison = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.compareMonths(sessionId, month1, month2);
      if (response.success) {
        setComparison(response.data);
      }
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, month1, month2]);

  useEffect(() => {
    if (month1 && month2 && month1 !== month2) {
      fetchComparison();
    }
  }, [month1, month2, fetchComparison]);

  const getChangeIcon = (change) => {
    if (change > 0) return <FiArrowUp className="increase" />;
    if (change < 0) return <FiArrowDown className="decrease" />;
    return <FiMinus className="neutral" />;
  };

  const getChangeClass = (change, isExpense = true) => {
    // For expenses, increase is bad (red), decrease is good (green)
    // For income, increase is good (green), decrease is bad (red)
    if (change > 0) return isExpense ? 'negative' : 'positive';
    if (change < 0) return isExpense ? 'positive' : 'negative';
    return 'neutral';
  };

  const chartData = comparison?.categoryComparison?.map(cat => ({
    name: cat.category,
    [month1]: cat.month1Amount,
    [month2]: cat.month2Amount
  })) || [];

  return (
    <motion.div
      className="comparison-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="comparison-modal glass-card-static"
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Compare Months</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="month-selector">
          <div className="select-group">
            <label>First Month</label>
            <select 
              value={month1 || ''} 
              onChange={(e) => setMonth1(e.target.value)}
            >
              <option value="">Select month</option>
              {months.map((m) => (
                <option key={m.key} value={m.name} disabled={m.name === month2}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="vs-badge">VS</div>
          
          <div className="select-group">
            <label>Second Month</label>
            <select 
              value={month2 || ''} 
              onChange={(e) => setMonth2(e.target.value)}
            >
              <option value="">Select month</option>
              {months.map((m) => (
                <option key={m.key} value={m.name} disabled={m.name === month1}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="comparison-loading">
            <div className="loading-spinner"></div>
            <p>Loading comparison...</p>
          </div>
        ) : comparison ? (
          <div className="comparison-content">
            {/* Overview Cards */}
            <div className="comparison-cards">
              <div className="comparison-card">
                <div className="card-title">Total Spending</div>
                <div className="comparison-values">
                  <div className="month-value">
                    <span className="month-label">{month1}</span>
                    <span className="value">₹{comparison.month1.totalDebit.toLocaleString()}</span>
                  </div>
                  <div className="change-indicator">
                    {getChangeIcon(comparison.changes.debitChange)}
                    <span className={getChangeClass(comparison.changes.debitChange)}>
                      {Math.abs(comparison.changes.debitChange).toFixed(1)}%
                    </span>
                  </div>
                  <div className="month-value">
                    <span className="month-label">{month2}</span>
                    <span className="value">₹{comparison.month2.totalDebit.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="comparison-card">
                <div className="card-title">Total Income</div>
                <div className="comparison-values">
                  <div className="month-value">
                    <span className="month-label">{month1}</span>
                    <span className="value credit">₹{comparison.month1.totalCredit.toLocaleString()}</span>
                  </div>
                  <div className="change-indicator">
                    {getChangeIcon(comparison.changes.creditChange)}
                    <span className={getChangeClass(comparison.changes.creditChange, false)}>
                      {Math.abs(comparison.changes.creditChange).toFixed(1)}%
                    </span>
                  </div>
                  <div className="month-value">
                    <span className="month-label">{month2}</span>
                    <span className="value credit">₹{comparison.month2.totalCredit.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="comparison-card">
                <div className="card-title">Transactions</div>
                <div className="comparison-values">
                  <div className="month-value">
                    <span className="month-label">{month1}</span>
                    <span className="value">{comparison.month1.transactionCount}</span>
                  </div>
                  <div className="change-indicator">
                    {getChangeIcon(comparison.changes.transactionCountChange)}
                    <span className="neutral">
                      {Math.abs(comparison.changes.transactionCountChange).toFixed(1)}%
                    </span>
                  </div>
                  <div className="month-value">
                    <span className="month-label">{month2}</span>
                    <span className="value">{comparison.month2.transactionCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Chart */}
            <div className="category-comparison-chart">
              <h3>Category Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="rgba(255,255,255,0.1)"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis 
                    type="number"
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    width={90}
                  />
                  <Tooltip 
                    contentStyle={{
                      background: 'rgba(10, 10, 26, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `₹${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey={month1} 
                    fill="#667eea" 
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar 
                    dataKey={month2} 
                    fill="#f093fb" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Changes Table */}
            <div className="category-changes">
              <h3>Category Changes</h3>
              <div className="changes-table">
                {comparison.categoryComparison.map((cat, index) => (
                  <div key={index} className="change-row">
                    <span className="category-name">{cat.category}</span>
                    <span className="month1-val">₹{cat.month1Amount.toLocaleString()}</span>
                    <span className={`change-val ${getChangeClass(cat.changePercent)}`}>
                      {getChangeIcon(cat.changePercent)}
                      {cat.changePercent > 0 ? '+' : ''}{cat.changePercent.toFixed(1)}%
                    </span>
                    <span className="month2-val">₹{cat.month2Amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="comparison-empty">
            <p>Select two different months to compare</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default MonthComparison;
