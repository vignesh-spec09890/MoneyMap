import React from 'react';
import { motion } from 'framer-motion';
import {
  FiDollarSign,
  FiArrowUp,
  FiArrowDown,
  FiActivity,
  FiTrendingUp,
  FiTrendingDown
} from 'react-icons/fi';
import './OverviewCards.css';

const OverviewCards = ({ data, onCardClick }) => {
  if (!data) {
    return (
      <div className="overview-cards">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="overview-card skeleton-card">
            <div className="skeleton skeleton-icon"></div>
            <div className="skeleton skeleton-value"></div>
            <div className="skeleton skeleton-label"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: 'total',
      label: 'Total Amount',
      value: `₹${data.totalAmount?.toLocaleString() || 0}`,
      subValue: `${data.totalTransactions} transactions`,
      icon: FiActivity,
      gradient: 'primary',
      clickable: true
    },
    {
      id: 'credit',
      label: 'Total Credit',
      value: `₹${data.totalCredit?.toLocaleString() || 0}`,
      subValue: `${data.creditCount} credits`,
      icon: FiArrowUp,
      gradient: 'success',
      trend: 'up',
      clickable: true
    },
    {
      id: 'debit',
      label: 'Total Debit',
      value: `₹${data.totalDebit?.toLocaleString() || 0}`,
      subValue: `${data.debitCount} debits`,
      icon: FiArrowDown,
      gradient: 'danger',
      trend: 'down',
      clickable: true
    },
    {
      id: 'net',
      label: 'Net Flow',
      value: `${data.netFlow >= 0 ? '+' : ''}₹${data.netFlow?.toLocaleString() || 0}`,
      subValue: data.netFlow >= 0 ? 'Positive balance' : 'Negative balance',
      icon: data.netFlow >= 0 ? FiTrendingUp : FiTrendingDown,
      gradient: data.netFlow >= 0 ? 'success' : 'danger',
      clickable: false
    },
    {
      id: 'average',
      label: 'Avg Transaction',
      value: `₹${data.averageTransaction?.toLocaleString() || 0}`,
      subValue: `Largest: ₹${Math.max(data.largestCredit || 0, data.largestDebit || 0).toLocaleString()}`,
      icon: FiDollarSign,
      gradient: 'warning',
      clickable: false
    }
  ];

  return (
    <div className="overview-cards">
      {cards.map((card, index) => (
        <motion.div
          key={card.id}
          className={`overview-card glass-card ${card.gradient} ${card.clickable ? 'clickable' : ''}`}
          onClick={() => card.clickable && onCardClick(card.id)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.4 }}
          whileHover={card.clickable ? { scale: 1.02 } : {}}
          whileTap={card.clickable ? { scale: 0.98 } : {}}
        >
          <div className={`card-icon ${card.gradient}`}>
            <card.icon />
          </div>
          <div className="card-content">
            <span className="card-label">{card.label}</span>
            <span className="card-value">{card.value}</span>
            <span className="card-sub">{card.subValue}</span>
          </div>
          {card.clickable && (
            <span className="card-action">Click to view</span>
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default OverviewCards;
