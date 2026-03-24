import React from 'react';
import { FiRefreshCw, FiCalendar, FiAlertCircle } from 'react-icons/fi';
import './RecurringPayments.css';

const RecurringPayments = ({ data }) => {
  if (!data) {
    return <div className="recurring-payments glass-card">Loading...</div>;
  }

  const { recurringPayments, totalRecurring, totalRecurringAmount } = data;

  const getFrequencyBadge = (frequency) => {
    const colors = {
      monthly: 'primary',
      weekly: 'success',
      'bi-weekly': 'warning',
      quarterly: 'secondary',
      yearly: 'danger',
      irregular: 'muted'
    };
    return colors[frequency] || 'muted';
  };

  const getFrequencyLabel = (frequency) => {
    const labels = {
      monthly: 'Monthly',
      weekly: 'Weekly',
      'bi-weekly': 'Bi-Weekly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
      irregular: 'Irregular'
    };
    return labels[frequency] || frequency;
  };

  return (
    <div className="recurring-payments glass-card">
      <div className="chart-header">
        <div>
          <h3><FiRefreshCw /> Recurring Payments</h3>
          <p className="chart-subtitle">
            {totalRecurring} recurring payment patterns detected
          </p>
        </div>
        {totalRecurringAmount > 0 && (
          <div className="total-recurring">
            <span className="label">Total Recurring</span>
            <span className="amount">₹{totalRecurringAmount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {recurringPayments && recurringPayments.length > 0 ? (
        <div className="recurring-list">
          {recurringPayments.map((payment, index) => (
            <div key={index} className="recurring-card">
              <div className="recurring-main">
                <div className="recurring-icon">
                  <FiRefreshCw />
                </div>
                <div className="recurring-info">
                  <span className="recurring-name">{payment.recipient}</span>
                  <div className="recurring-meta">
                    <span className={`frequency-badge ${getFrequencyBadge(payment.frequency)}`}>
                      {getFrequencyLabel(payment.frequency)}
                    </span>
                    <span className="occurrence-count">
                      {payment.occurrences} payments
                    </span>
                  </div>
                </div>
                <div className="recurring-amount">
                  <span className="avg-amount">
                    ~₹{payment.averageAmount.toLocaleString()}
                  </span>
                  <span className="total-spent">
                    Total: ₹{payment.totalSpent.toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="recurring-details">
                <div className="detail-item">
                  <FiCalendar />
                  <span>Last: {payment.lastDate}</span>
                </div>
                {payment.nextExpected && (
                  <div className="detail-item next">
                    <FiAlertCircle />
                    <span>Next expected: {payment.nextExpected}</span>
                  </div>
                )}
                <div className="detail-item">
                  <span>Avg interval: {payment.averageInterval} days</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-recurring">
          <FiRefreshCw className="no-data-icon" />
          <p>No recurring payment patterns detected</p>
          <span className="no-data-hint">
            We look for payments to the same recipient with similar amounts at regular intervals
          </span>
        </div>
      )}

      {recurringPayments && recurringPayments.length > 0 && (
        <div className="recurring-summary">
          <div className="summary-card">
            <span className="summary-label">Monthly Subscriptions</span>
            <span className="summary-value">
              {recurringPayments.filter(p => p.frequency === 'monthly').length}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Weekly Payments</span>
            <span className="summary-value">
              {recurringPayments.filter(p => p.frequency === 'weekly').length}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Avg Monthly Cost</span>
            <span className="summary-value">
              ₹{Math.round(
                recurringPayments
                  .filter(p => p.frequency === 'monthly')
                  .reduce((sum, p) => sum + p.averageAmount, 0)
              ).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringPayments;
