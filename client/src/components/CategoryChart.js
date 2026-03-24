import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import './CategoryChart.css';

const COLORS = [
  '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
  '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140',
  '#30cfd0', '#c779d0', '#feac5e', '#a8edea'
];

const CategoryChart = ({ data, onCategoryClick, filterType, onFilterChange }) => {
  if (!data || !data.categories) {
    return <div className="category-chart glass-card">Loading...</div>;
  }

  const chartData = data.categories.map((cat, index) => ({
    name: cat.category,
    value: cat.amount,
    percentage: cat.percentage,
    count: cat.count,
    color: COLORS[index % COLORS.length]
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip glass-card-static">
          <p className="tooltip-label">{data.name}</p>
          <p className="tooltip-value">₹{data.value.toLocaleString()}</p>
          <p className="tooltip-percentage">{data.percentage.toFixed(1)}%</p>
          <p className="tooltip-count">{data.count} transactions</p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => {
    return (
      <div className="category-legend">
        {chartData.slice(0, 8).map((entry, index) => (
          <div
            key={index}
            className="legend-item"
            onClick={() => onCategoryClick(entry.name)}
          >
            <span
              className="legend-color"
              style={{ background: entry.color }}
            />
            <span className="legend-label">{entry.name}</span>
            <span className="legend-value">{entry.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="category-chart glass-card">
      <div className="chart-header">
        <div>
          <h3>Category Breakdown</h3>
          <p className="chart-subtitle">
            Total: ₹{data.totalAmount?.toLocaleString() || 0}
          </p>
        </div>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => onFilterChange('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterType === 'credit' ? 'active' : ''}`}
            onClick={() => onFilterChange('credit')}
          >
            Credits
          </button>
          <button
            className={`filter-btn ${filterType === 'debit' ? 'active' : ''}`}
            onClick={() => onFilterChange('debit')}
          >
            Debits
          </button>
        </div>
      </div>

      <div className="chart-body">
        <div className="pie-container">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
                onClick={(data) => onCategoryClick(data.name)}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {renderLegend()}
      </div>

      <div className="category-list">
        <h4>All Categories</h4>
        <div className="category-items">
          {data.categories.map((cat, index) => (
            <div
              key={index}
              className="category-item"
              onClick={() => onCategoryClick(cat.category)}
            >
              <div className="category-info">
                <span
                  className="category-dot"
                  style={{ background: COLORS[index % COLORS.length] }}
                />
                <span className="category-name">{cat.category}</span>
              </div>
              <div className="category-stats">
                <span className="category-amount">
                  ₹{cat.amount.toLocaleString()}
                </span>
                <span className="category-percentage">
                  {cat.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryChart;
