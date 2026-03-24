import React, { useState } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import './TrendChart.css';

const TrendChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('daily'); // daily, weekday

  if (!data) {
    return <div className="trend-chart glass-card">Loading...</div>;
  }

  const { dailyTrend, weekdayAnalysis, movingAverage } = data;

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Combine daily trend with moving average
  const chartData = dailyTrend.map((day, index) => {
    const ma = movingAverage.find(m => m.date === day.date);
    return {
      ...day,
      formattedDate: formatDate(day.date),
      movingAvg: ma?.average || null
    };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = chartData.find(d => d.formattedDate === label || d.date === label);
      return (
        <div className="trend-tooltip glass-card-static">
          <p className="tooltip-date">{dataPoint?.date || label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="tooltip-item">
              <span 
                className="tooltip-dot" 
                style={{ background: entry.color }}
              />
              <span className="tooltip-label">{entry.name}:</span>
              <span className="tooltip-value">
                ₹{entry.value?.toLocaleString() || 0}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="trend-chart glass-card">
      <div className="chart-header">
        <div>
          <h3>Spending Trends</h3>
          <p className="chart-subtitle">Daily spending patterns and trends</p>
        </div>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'daily' ? 'active' : ''}`}
            onClick={() => setViewMode('daily')}
          >
            Daily
          </button>
          <button
            className={`toggle-btn ${viewMode === 'weekday' ? 'active' : ''}`}
            onClick={() => setViewMode('weekday')}
          >
            By Weekday
          </button>
        </div>
      </div>

      {viewMode === 'daily' ? (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="debitGradientArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f45c43" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f45c43" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="creditGradientArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38ef7d" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38ef7d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
                vertical={false}
              />
              <XAxis
                dataKey="formattedDate"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="debit"
                name="Spending"
                stroke="#f45c43"
                strokeWidth={2}
                fill="url(#debitGradientArea)"
              />
              <Area
                type="monotone"
                dataKey="credit"
                name="Income"
                stroke="#38ef7d"
                strokeWidth={2}
                fill="url(#creditGradientArea)"
              />
              {movingAverage.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  name="7-Day Average"
                  stroke="#667eea"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="weekday-analysis">
          <div className="weekday-chart">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={weekdayAnalysis} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="weekdayGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.1)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="average"
                  name="Avg Spending"
                  stroke="#667eea"
                  strokeWidth={2}
                  fill="url(#weekdayGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="weekday-cards">
            {weekdayAnalysis.map((day, index) => (
              <div key={index} className="weekday-card">
                <span className="weekday-name">{day.day.substring(0, 3)}</span>
                <span className="weekday-avg">
                  ₹{day.average.toLocaleString()}
                </span>
                <span className="weekday-count">
                  {day.transactionCount} txns
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Transactions Cards */}
      {viewMode === 'daily' && (
        <div className="daily-cards">
          {dailyTrend.slice(-7).map((day, index) => {
            const formattedDate = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <div key={index} className="daily-card">
                <span className="daily-date">{formattedDate}</span>
                <div className="daily-amounts">
                  {day.credit > 0 && (
                    <span className="daily-credit">+₹{day.credit.toLocaleString()}</span>
                  )}
                  {day.debit > 0 && (
                    <span className="daily-debit">-₹{day.debit.toLocaleString()}</span>
                  )}
                </div>
                <span className="daily-count">{day.transactionCount} txns</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Summary */}
      <div className="trend-stats">
        <div className="stat-card">
          <span className="stat-label">Peak Spending Day</span>
          <span className="stat-value">
            {dailyTrend.reduce((max, day) => 
              day.debit > max.debit ? day : max, dailyTrend[0]
            )?.date}
          </span>
          <span className="stat-detail">
            ₹{dailyTrend.reduce((max, day) => 
              day.debit > max.debit ? day : max, dailyTrend[0]
            )?.debit?.toLocaleString() || 0}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Busiest Day</span>
          <span className="stat-value">
            {weekdayAnalysis.reduce((max, day) => 
              day.transactionCount > max.transactionCount ? day : max, weekdayAnalysis[0]
            )?.day}
          </span>
          <span className="stat-detail">
            {weekdayAnalysis.reduce((max, day) => 
              day.transactionCount > max.transactionCount ? day : max, weekdayAnalysis[0]
            )?.transactionCount} transactions
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Daily Average</span>
          <span className="stat-value">
            ₹{Math.round(
              dailyTrend.reduce((sum, d) => sum + d.debit, 0) / dailyTrend.length
            ).toLocaleString()}
          </span>
          <span className="stat-detail">
            {Math.round(dailyTrend.reduce((sum, d) => sum + d.transactionCount, 0) / dailyTrend.length)} txns/day avg
          </span>
        </div>
      </div>
    </div>
  );
};

export default TrendChart;
