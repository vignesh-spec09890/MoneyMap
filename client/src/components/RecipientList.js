import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiUser } from 'react-icons/fi';
import './RecipientList.css';

const RecipientList = ({ data, onRecipientClick }) => {
  const [expandedRecipient, setExpandedRecipient] = useState(null);

  if (!data || !data.topRecipients) {
    return <div className="recipient-list glass-card">Loading...</div>;
  }

  const { topRecipients, totalRecipients } = data;

  const toggleExpand = (name) => {
    setExpandedRecipient(expandedRecipient === name ? null : name);
  };

  return (
    <div className="recipient-list glass-card">
      <div className="chart-header">
        <div>
          <h3>Top Recipients</h3>
          <p className="chart-subtitle">
            {totalRecipients} unique recipients found
          </p>
        </div>
      </div>

      <div className="recipients-container">
        {topRecipients.map((recipient, index) => (
          <div key={index} className="recipient-card">
            <div 
              className="recipient-header"
              onClick={() => recipient.hasMultiple && toggleExpand(recipient.name)}
            >
              <div className="recipient-rank">
                {index + 1}
              </div>
              <div className="recipient-avatar">
                <FiUser />
              </div>
              <div className="recipient-info">
                <span className="recipient-name">{recipient.name}</span>
                <span className="recipient-count">
                  {recipient.count} transaction{recipient.count > 1 ? 's' : ''}
                </span>
              </div>
              <div className="recipient-amount">
                <span className="amount-total">
                  ₹{recipient.totalAmount.toLocaleString()}
                </span>
                {recipient.debitAmount > 0 && recipient.creditAmount > 0 && (
                  <div className="amount-breakdown">
                    <span className="credit">+₹{recipient.creditAmount.toLocaleString()}</span>
                    <span className="debit">-₹{recipient.debitAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>
              {recipient.hasMultiple && (
                <button className="expand-btn">
                  {expandedRecipient === recipient.name ? (
                    <FiChevronUp />
                  ) : (
                    <FiChevronDown />
                  )}
                </button>
              )}
            </div>

            {/* Expanded transactions */}
            {expandedRecipient === recipient.name && recipient.transactions && (
              <div className="recipient-transactions">
                {recipient.transactions.map((tx, txIndex) => (
                  <div key={txIndex} className="transaction-row">
                    <span className="tx-date">{tx.date}</span>
                    <span className={`tx-amount ${tx.type.toLowerCase()}`}>
                      {tx.type === 'Credit' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                    </span>
                    {tx.reference && (
                      <span className="tx-ref">{tx.reference}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {topRecipients.length > 0 && (
        <div className="view-all-action">
          <button 
            className="btn btn-secondary"
            onClick={() => onRecipientClick(null)}
          >
            View All Transactions
          </button>
        </div>
      )}
    </div>
  );
};

export default RecipientList;
