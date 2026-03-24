import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft,
  FiDownload,
  FiPieChart,
  FiBarChart2,
  FiTrendingUp,
  FiUsers,
  FiRefreshCw,
  FiAlertTriangle,
  FiChevronRight,
  FiCalendar,
  FiActivity
} from 'react-icons/fi';
import { useSession } from '../App';
import api from '../services/api';
import OverviewCards from '../components/OverviewCards';
import CategoryChart from '../components/CategoryChart';
import MonthlyChart from '../components/MonthlyChart';
import TrendChart from '../components/TrendChart';
import RecipientList from '../components/RecipientList';
import RecurringPayments from '../components/RecurringPayments';
import TransactionList from '../components/TransactionList';
import MonthComparison from '../components/MonthComparison';
import './InsightsPage.css';

const INSIGHT_TYPES = [
  { id: 'categories', label: 'Categories', icon: FiPieChart },
  { id: 'monthly', label: 'Monthly Spending', icon: FiBarChart2 },
  { id: 'trends', label: 'Spending Trends', icon: FiTrendingUp },
  { id: 'recipients', label: 'Top Recipients', icon: FiUsers },
  { id: 'recurring', label: 'Recurring Payments', icon: FiRefreshCw },
  { id: 'anomalies', label: 'Unusual Spending', icon: FiAlertTriangle }
];

const InsightsPage = () => {
  const navigate = useNavigate();
  const { sessionId, transactions, months, fileName, clearSession } = useSession();

  const [activeInsight, setActiveInsight] = useState('categories');
  const [overview, setOverview] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [recipientData, setRecipientData] = useState(null);
  const [recurringData, setRecurringData] = useState(null);
  const [anomalyData, setAnomalyData] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filterType, setFilterType] = useState('all'); // all, credit, debit
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonMonths, setComparisonMonths] = useState({ month1: null, month2: null });

  const canCompare = months && months.length >= 2;

  // Redirect if no session
  useEffect(() => {
    if (!sessionId) {
      navigate('/');
    }
  }, [sessionId, navigate]);

  // Fetch overview data
  useEffect(() => {
    if (!sessionId) return;

    const fetchOverview = async () => {
      try {
        const response = await api.getOverview(sessionId);
        if (response.success) {
          setOverview(response.data);
        }
      } catch (err) {
        console.error('Error fetching overview:', err);
      }
    };

    fetchOverview();
  }, [sessionId]);

  // Fetch data based on active insight
  useEffect(() => {
    if (!sessionId) return;

    const fetchInsightData = async () => {
      setLoading(true);
      setError(null);

      try {
        switch (activeInsight) {
          case 'categories':
            const catResponse = await api.getCategories(sessionId, filterType);
            if (catResponse.success) {
              setCategoryData(catResponse.data);
            }
            break;

          case 'monthly':
            const monthlyResponse = await api.getMonthly(sessionId);
            if (monthlyResponse.success) {
              setMonthlyData(monthlyResponse.data);
            }
            break;

          case 'trends':
            const trendResponse = await api.getTrends(sessionId);
            if (trendResponse.success) {
              setTrendData(trendResponse.data);
            }
            break;

          case 'recipients':
            const recipientResponse = await api.getRecipients(sessionId, 15);
            if (recipientResponse.success) {
              setRecipientData(recipientResponse.data);
            }
            break;

          case 'recurring':
            const recurringResponse = await api.getRecurring(sessionId);
            if (recurringResponse.success) {
              setRecurringData(recurringResponse.data);
            }
            break;

          case 'anomalies':
            const anomalyResponse = await api.getAnomalies(sessionId);
            if (anomalyResponse.success) {
              setAnomalyData(anomalyResponse.data);
            }
            break;

          default:
            break;
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchInsightData();
  }, [sessionId, activeInsight, filterType]);

  // Filter transactions when filter changes
  useEffect(() => {
    if (!transactions) return;

    let filtered = [...transactions];

    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type.toLowerCase() === filterType);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(t => t.category === filterCategory);
    }

    if (selectedMonth) {
      filtered = filtered.filter(t => {
        const txMonth = new Date(t.date).toLocaleString('default', { month: 'short', year: 'numeric' });
        return txMonth === selectedMonth;
      });
    }

    setFilteredTransactions(filtered);
  }, [transactions, filterType, filterCategory, selectedMonth]);

  // Get unique categories from transactions
  const categories = useMemo(() => {
    if (!transactions) return [];
    const cats = [...new Set(transactions.map(t => t.category))];
    return cats.sort();
  }, [transactions]);

  const handleOverviewCardClick = (type) => {
    if (type === 'credit') {
      setFilterType('credit');
      setShowTransactions(true);
    } else if (type === 'debit') {
      setFilterType('debit');
      setShowTransactions(true);
    } else if (type === 'total') {
      setFilterType('all');
      setShowTransactions(true);
    }
  };

  const handleCategoryClick = (category) => {
    setFilterCategory(category);
    setShowTransactions(true);
  };

  const handleMonthClick = (month) => {
    setSelectedMonth(month);
    setShowTransactions(true);
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportCSV(sessionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleComparePrepare = () => {
    if (months && months.length >= 2) {
      setComparisonMonths({
        month1: months[months.length - 2]?.name,
        month2: months[months.length - 1]?.name
      });
      setShowComparison(true);
    }
  };

  const handleBack = () => {
    clearSession();
    navigate('/');
  };

  if (!sessionId) {
    return null;
  }

  return (
    <div className="insights-page">
      {/* Header */}
      <header className="insights-header glass-card-static">
        <div className="header-left">
          <button className="btn-icon" onClick={handleBack}>
            <FiArrowLeft />
          </button>
          <div className="header-info">
            <h1>Financial Insights</h1>
            <span className="file-name">{fileName}</span>
          </div>
        </div>
        <div className="header-actions">
          {canCompare && (
            <button 
              className="btn btn-secondary"
              onClick={handleComparePrepare}
            >
              <FiCalendar /> Compare Months
            </button>
          )}
          <button className="btn btn-primary" onClick={handleExport}>
            <FiDownload /> Export CSV
          </button>
        </div>
      </header>

      <div className="insights-layout">
        {/* Left Sidebar - Month Navigation */}
        {months && months.length > 0 && (
          <aside className="months-sidebar glass-card-static">
            <h3>
              <FiCalendar /> Months
            </h3>
            <div className="months-list">
              <button
                className={`month-item ${!selectedMonth ? 'active' : ''}`}
                onClick={() => setSelectedMonth(null)}
              >
                <span>All Months</span>
                <FiChevronRight />
              </button>
              {months.map((month) => (
                <button
                  key={month.key}
                  className={`month-item ${selectedMonth === month.name ? 'active' : ''}`}
                  onClick={() => handleMonthClick(month.name)}
                >
                  <span>{month.name}</span>
                  <span className="month-count">{month.transactionCount}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="insights-main">
          {/* Overview Cards */}
          <section className="overview-section">
            <OverviewCards 
              data={overview} 
              onCardClick={handleOverviewCardClick}
            />
          </section>

          {/* Charts Area */}
          <section className="charts-section">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="chart-loading"
                >
                  <div className="loading-spinner"></div>
                  <p>Loading insights...</p>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="chart-error glass-card"
                >
                  <FiAlertTriangle />
                  <p>{error}</p>
                </motion.div>
              ) : (
                <motion.div
                  key={activeInsight}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="chart-container"
                >
                  {activeInsight === 'categories' && categoryData && (
                    <CategoryChart 
                      data={categoryData} 
                      onCategoryClick={handleCategoryClick}
                      filterType={filterType}
                      onFilterChange={setFilterType}
                    />
                  )}
                  
                  {activeInsight === 'monthly' && monthlyData && (
                    <MonthlyChart 
                      data={monthlyData}
                      onMonthClick={handleMonthClick}
                    />
                  )}
                  
                  {activeInsight === 'trends' && trendData && (
                    <TrendChart data={trendData} />
                  )}
                  
                  {activeInsight === 'recipients' && recipientData && (
                    <RecipientList 
                      data={recipientData}
                      onRecipientClick={(name) => {
                        setFilteredTransactions(
                          transactions.filter(t => t.recipient === name)
                        );
                        setShowTransactions(true);
                      }}
                    />
                  )}
                  
                  {activeInsight === 'recurring' && recurringData && (
                    <RecurringPayments data={recurringData} />
                  )}
                  
                  {activeInsight === 'anomalies' && anomalyData && (
                    <div className="anomalies-view glass-card">
                      <h3><FiAlertTriangle /> Unusual Spending Detected</h3>
                      {anomalyData.anomalies?.length > 0 ? (
                        <div className="anomaly-list">
                          {anomalyData.anomalies.map((anomaly, index) => (
                            <div key={index} className="anomaly-item">
                              <div className="anomaly-info">
                                <span className="anomaly-date">{anomaly.date}</span>
                                <span className="anomaly-recipient">{anomaly.recipient}</span>
                              </div>
                              <div className="anomaly-amount">
                                ₹{anomaly.amount.toLocaleString()}
                                <span className="anomaly-deviation">
                                  {anomaly.percentAboveMean}% above average
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-data">No unusual spending patterns detected</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>

        {/* Right Sidebar - Insight Types */}
        <aside className="insights-sidebar glass-card-static">
          <h3>
            <FiActivity /> Insight Type
          </h3>
          <div className="insight-types">
            {INSIGHT_TYPES.map((type) => (
              <button
                key={type.id}
                className={`insight-type-btn ${activeInsight === type.id ? 'active' : ''}`}
                onClick={() => setActiveInsight(type.id)}
              >
                <type.icon />
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* Transaction Modal */}
      <AnimatePresence>
        {showTransactions && (
          <TransactionList
            transactions={filteredTransactions}
            onClose={() => {
              setShowTransactions(false);
              setFilterType('all');
              setFilterCategory('all');
              setSelectedMonth(null);
            }}
            title={
              selectedMonth
                ? `${selectedMonth} Transactions`
                : filterCategory !== 'all' 
                  ? `${filterCategory} Transactions`
                  : filterType !== 'all'
                    ? `${filterType === 'credit' ? 'Credit' : 'Debit'} Transactions`
                    : 'All Transactions'
            }
          />
        )}
      </AnimatePresence>

      {/* Month Comparison Modal */}
      <AnimatePresence>
        {showComparison && (
          <MonthComparison
            sessionId={sessionId}
            months={months}
            initialMonth1={comparisonMonths.month1}
            initialMonth2={comparisonMonths.month2}
            onClose={() => setShowComparison(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default InsightsPage;
