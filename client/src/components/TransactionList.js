import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  FiX, 
  FiSearch, 
  FiArrowUp, 
  FiArrowDown,
  FiDownload 
} from 'react-icons/fi';
import './TransactionList.css';

const TransactionList = ({ transactions, onClose, title }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];

    // Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.recipient?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.category?.toLowerCase().includes(term) ||
        t.reference?.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date) - new Date(b.date);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'recipient':
          comparison = (a.recipient || '').localeCompare(b.recipient || '');
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [transactions, searchTerm, sortBy, sortOrder]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const totals = useMemo(() => {
    const credit = filteredAndSorted
      .filter(t => t.type === 'Credit')
      .reduce((sum, t) => sum + t.amount, 0);
    const debit = filteredAndSorted
      .filter(t => t.type === 'Debit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return { credit, debit, net: credit - debit };
  }, [filteredAndSorted]);

  const exportToCSV = () => {
    const headers = ['Date', 'Recipient', 'Description', 'Amount', 'Type', 'Category', 'Reference'];
    const rows = filteredAndSorted.map(t => [
      t.date,
      t.recipient,
      t.description?.replace(/,/g, ' '),
      t.amount,
      t.type,
      t.category,
      t.reference
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      className="transaction-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="transaction-modal glass-card-static"
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="modal-toolbar">
          <div className="search-box">
            <FiSearch />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="export-btn btn btn-secondary" onClick={exportToCSV}>
            <FiDownload /> Export
          </button>
        </div>

        <div className="transaction-summary">
          <div className="summary-item">
            <span className="summary-label">Total</span>
            <span className="summary-value">{filteredAndSorted.length} transactions</span>
          </div>
          <div className="summary-item credit">
            <span className="summary-label">Credits</span>
            <span className="summary-value">+₹{totals.credit.toLocaleString()}</span>
          </div>
          <div className="summary-item debit">
            <span className="summary-label">Debits</span>
            <span className="summary-value">-₹{totals.debit.toLocaleString()}</span>
          </div>
          <div className={`summary-item ${totals.net >= 0 ? 'positive' : 'negative'}`}>
            <span className="summary-label">Net</span>
            <span className="summary-value">
              {totals.net >= 0 ? '+' : ''}₹{totals.net.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="table-container">
          <table className="transaction-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('date')} className="sortable">
                  Date
                  {sortBy === 'date' && (
                    sortOrder === 'desc' ? <FiArrowDown /> : <FiArrowUp />
                  )}
                </th>
                <th onClick={() => toggleSort('recipient')} className="sortable">
                  Recipient
                  {sortBy === 'recipient' && (
                    sortOrder === 'desc' ? <FiArrowDown /> : <FiArrowUp />
                  )}
                </th>
                <th>Description</th>
                <th onClick={() => toggleSort('category')} className="sortable">
                  Category
                  {sortBy === 'category' && (
                    sortOrder === 'desc' ? <FiArrowDown /> : <FiArrowUp />
                  )}
                </th>
                <th onClick={() => toggleSort('amount')} className="sortable amount-col">
                  Amount
                  {sortBy === 'amount' && (
                    sortOrder === 'desc' ? <FiArrowDown /> : <FiArrowUp />
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((transaction, index) => (
                <tr key={index}>
                  <td className="date-cell">{transaction.date}</td>
                  <td className="recipient-cell">
                    {transaction.recipient || 'Unknown'}
                  </td>
                  <td className="description-cell">
                    <span title={transaction.description}>
                      {transaction.description?.substring(0, 50) || '-'}
                      {transaction.description?.length > 50 ? '...' : ''}
                    </span>
                  </td>
                  <td className="category-cell">
                    <span className={`category-tag ${transaction.category?.toLowerCase()}`}>
                      {transaction.category || 'Private'}
                    </span>
                  </td>
                  <td className={`amount-cell ${transaction.type?.toLowerCase()}`}>
                    {transaction.type === 'Credit' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAndSorted.length === 0 && (
            <div className="no-transactions">
              <p>No transactions found</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TransactionList;
