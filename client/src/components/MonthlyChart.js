import React from 'react';
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
import './MonthlyChart.css';

const MonthlyChart = ({ data, onMonthClick }) => {
  if (!data || !data.months) {
    return <div className="monthly-chart glass-card">Loading...</div>;
  }

  const chartData = data.months.map(month => ({
    name: month.name,
    credit: month.credit,
    debit: month.debit,
    net: month.net,
    transactions: month.transactions
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const monthData = chartData.find(m => m.name === label);
      return (
        <div className="monthly-tooltip glass-card-static">
          <p className="tooltip-title">{label}</p>
          <div className="tooltip-row credit">
            <span>Credit</span>
            <span>₹{payload[0]?.value?.toLocaleString()}</span>
          </div>
          <div className="tooltip-row debit">
            <span>Debit</span>
            <span>₹{payload[1]?.value?.toLocaleString()}</span>
          </div>
          <div className="tooltip-row net">
            <span>Net</span>
            <span className={monthData?.net >= 0 ? 'positive' : 'negative'}>
              {monthData?.net >= 0 ? '+' : ''}₹{monthData?.net?.toLocaleString()}
            </span>
          </div>
          <div className="tooltip-divider"></div>
          <p className="tooltip-transactions">
            {monthData?.transactions} transactions
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="monthly-chart glass-card">
      <div className="chart-header">
        <h3>Monthly Overview</h3>
        <p className="chart-subtitle">Income vs Expense by month</p>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            onClick={(data) => {
              if (data && data.activeLabel) {
                onMonthClick(data.activeLabel);
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Legend
              wrapperStyle={{
                paddingTop: '20px'
              }}
              formatter={(value) => (
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
                  {value}
                </span>
              )}
            />
            <Bar
              dataKey="credit"
              name="Credit"
              fill="url(#creditGradient)"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            />
            <Bar
              dataKey="debit"
              name="Debit"
              fill="url(#debitGradient)"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            />
            <defs>
              <linearGradient id="creditGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38ef7d" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#11998e" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="debitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f45c43" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#eb3349" stopOpacity={0.6} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Summary Cards */}
      <div className="monthly-summary">
        {data.months.map((month, index) => (
          <div
            key={index}
            className="month-card"
            onClick={() => onMonthClick(month.name)}
          >
            <span className="month-name">{month.name}</span>
            <span className="month-transactions">{month.transactions} transactions</span>
            <div className="month-stats">
              <div className="stat-item credit">
                <span className="stat-label">Income</span>
                <span className="stat-value">+₹{month.credit.toLocaleString()}</span>
              </div>
              <div className="stat-item debit">
                <span className="stat-label">Expense</span>
                <span className="stat-value">-₹{month.debit.toLocaleString()}</span>
              </div>
            </div>
            <div className={`month-net ${month.net >= 0 ? 'positive' : 'negative'}`}>
              Net: {month.net >= 0 ? '+' : ''}₹{month.net.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthlyChart;
