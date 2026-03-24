/**
 * Analytics Service
 * Generates comprehensive financial insights and analytics
 */

const Papa = require('papaparse');

/**
 * Get overall financial overview
 * @param {Array<Object>} transactions - All transactions
 * @returns {Object} - Overview metrics
 */
function getOverview(transactions) {
  const credits = transactions.filter(t => t.type === 'Credit');
  const debits = transactions.filter(t => t.type === 'Debit');

  const totalCredit = credits.reduce((sum, t) => sum + t.amount, 0);
  const totalDebit = debits.reduce((sum, t) => sum + t.amount, 0);
  const totalAmount = totalCredit + totalDebit;

  return {
    totalTransactions: transactions.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalDebit: Math.round(totalDebit * 100) / 100,
    creditCount: credits.length,
    debitCount: debits.length,
    netFlow: Math.round((totalCredit - totalDebit) * 100) / 100,
    averageTransaction: Math.round((totalAmount / transactions.length) * 100) / 100,
    averageCredit: credits.length > 0 ? Math.round((totalCredit / credits.length) * 100) / 100 : 0,
    averageDebit: debits.length > 0 ? Math.round((totalDebit / debits.length) * 100) / 100 : 0,
    largestCredit: credits.length > 0 ? Math.max(...credits.map(t => t.amount)) : 0,
    largestDebit: debits.length > 0 ? Math.max(...debits.map(t => t.amount)) : 0
  };
}

/**
 * Get category-wise breakdown
 * @param {Array<Object>} transactions - All transactions
 * @param {string} type - 'credit', 'debit', or 'all'
 * @returns {Object} - Category breakdown
 */
function getCategoryBreakdown(transactions, type = 'all') {
  let filtered = transactions;
  
  if (type === 'credit') {
    filtered = transactions.filter(t => t.type === 'Credit');
  } else if (type === 'debit') {
    filtered = transactions.filter(t => t.type === 'Debit');
  }

  const categoryTotals = {};
  const categoryCounts = {};

  for (const t of filtered) {
    const category = t.category || 'Private';
    categoryTotals[category] = (categoryTotals[category] || 0) + t.amount;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }

  const totalAmount = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  const categories = Object.keys(categoryTotals).map(category => ({
    category,
    amount: Math.round(categoryTotals[category] * 100) / 100,
    count: categoryCounts[category],
    percentage: totalAmount > 0 
      ? Math.round((categoryTotals[category] / totalAmount) * 10000) / 100 
      : 0
  }));

  // Sort by amount descending
  categories.sort((a, b) => b.amount - a.amount);

  return {
    type,
    totalAmount: Math.round(totalAmount * 100) / 100,
    categories,
    chartData: {
      labels: categories.map(c => c.category),
      values: categories.map(c => c.amount),
      percentages: categories.map(c => c.percentage)
    }
  };
}

/**
 * Get monthly breakdown
 * @param {Array<Object>} transactions - All transactions
 * @returns {Object} - Monthly analysis
 */
function getMonthlyBreakdown(transactions) {
  const monthlyData = {};

  for (const t of transactions) {
    const date = new Date(t.date);
    if (isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        key: monthKey,
        name: monthName,
        credit: 0,
        debit: 0,
        transactions: 0,
        categories: {}
      };
    }

    const month = monthlyData[monthKey];
    month.transactions++;
    
    if (t.type === 'Credit') {
      month.credit += t.amount;
    } else {
      month.debit += t.amount;
    }

    // Track categories per month
    const category = t.category || 'Private';
    month.categories[category] = (month.categories[category] || 0) + t.amount;
  }

  // Convert to array and sort
  const months = Object.values(monthlyData)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(m => ({
      ...m,
      credit: Math.round(m.credit * 100) / 100,
      debit: Math.round(m.debit * 100) / 100,
      total: Math.round((m.credit + m.debit) * 100) / 100,
      net: Math.round((m.credit - m.debit) * 100) / 100
    }));

  return {
    months,
    chartData: {
      labels: months.map(m => m.name),
      credit: months.map(m => m.credit),
      debit: months.map(m => m.debit),
      net: months.map(m => m.net)
    }
  };
}

/**
 * Get recipient/sender analysis
 * @param {Array<Object>} transactions - All transactions
 * @param {number} limit - Maximum recipients to return
 * @returns {Object} - Recipient analysis
 */
function getRecipientAnalysis(transactions, limit = 10) {
  const recipientData = {};

  for (const t of transactions) {
    const recipient = t.recipient || 'Unknown';
    
    if (!recipientData[recipient]) {
      recipientData[recipient] = {
        name: recipient,
        totalAmount: 0,
        creditAmount: 0,
        debitAmount: 0,
        transactions: [],
        count: 0
      };
    }

    const data = recipientData[recipient];
    data.count++;
    data.totalAmount += t.amount;
    
    if (t.type === 'Credit') {
      data.creditAmount += t.amount;
    } else {
      data.debitAmount += t.amount;
    }

    data.transactions.push({
      date: t.date,
      amount: t.amount,
      type: t.type,
      reference: t.reference
    });
  }

  // Convert to array and sort by total amount
  let recipients = Object.values(recipientData)
    .map(r => ({
      ...r,
      totalAmount: Math.round(r.totalAmount * 100) / 100,
      creditAmount: Math.round(r.creditAmount * 100) / 100,
      debitAmount: Math.round(r.debitAmount * 100) / 100,
      hasMultiple: r.count > 1
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Apply limit
  const topRecipients = recipients.slice(0, limit);

  return {
    topRecipients,
    totalRecipients: recipients.length,
    chartData: {
      labels: topRecipients.map(r => r.name.substring(0, 15)),
      values: topRecipients.map(r => r.totalAmount)
    }
  };
}

/**
 * Get spending trends (daily aggregation)
 * @param {Array<Object>} transactions - All transactions
 * @returns {Object} - Trend data
 */
function getSpendingTrends(transactions) {
  const dailyData = {};
  const weekdayTotals = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const weekdayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  for (const t of transactions) {
    const date = new Date(t.date);
    if (isNaN(date.getTime())) continue;

    const dateKey = t.date;
    const weekday = date.getDay();

    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        credit: 0,
        debit: 0,
        total: 0,
        transactionCount: 0
      };
    }

    const day = dailyData[dateKey];
    day.transactionCount++;
    
    if (t.type === 'Credit') {
      day.credit += t.amount;
    } else {
      day.debit += t.amount;
      weekdayTotals[weekday] += t.amount;
      weekdayCounts[weekday]++;
    }
    day.total += t.amount;
  }

  // Sort daily data
  const dailyTrend = Object.values(dailyData)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      credit: Math.round(d.credit * 100) / 100,
      debit: Math.round(d.debit * 100) / 100,
      total: Math.round(d.total * 100) / 100,
      transactionCount: d.transactionCount
    }));

  // Calculate weekday averages
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayAnalysis = weekdays.map((name, index) => ({
    day: name,
    total: Math.round(weekdayTotals[index] * 100) / 100,
    average: weekdayCounts[index] > 0 
      ? Math.round((weekdayTotals[index] / weekdayCounts[index]) * 100) / 100 
      : 0,
    transactionCount: weekdayCounts[index]
  }));

  // Calculate moving average (7-day)
  const movingAverage = [];
  for (let i = 6; i < dailyTrend.length; i++) {
    const sum = dailyTrend.slice(i - 6, i + 1).reduce((acc, d) => acc + d.debit, 0);
    movingAverage.push({
      date: dailyTrend[i].date,
      average: Math.round((sum / 7) * 100) / 100
    });
  }

  return {
    dailyTrend,
    weekdayAnalysis,
    movingAverage,
    chartData: {
      labels: dailyTrend.map(d => d.date),
      debit: dailyTrend.map(d => d.debit),
      credit: dailyTrend.map(d => d.credit),
      movingAvg: movingAverage.map(m => m.average)
    }
  };
}

/**
 * Detect recurring payments
 * @param {Array<Object>} transactions - All transactions
 * @returns {Object} - Recurring payment patterns
 */
function detectRecurringPayments(transactions) {
  const debits = transactions.filter(t => t.type === 'Debit');
  
  // Group by recipient and similar amounts
  const patterns = {};

  for (const t of debits) {
    const recipient = t.recipient || 'Unknown';
    const amountBucket = Math.round(t.amount / 10) * 10; // Round to nearest 10

    const key = `${recipient}-${amountBucket}`;
    
    if (!patterns[key]) {
      patterns[key] = {
        recipient,
        approximateAmount: amountBucket,
        occurrences: [],
        amounts: []
      };
    }

    patterns[key].occurrences.push(new Date(t.date));
    patterns[key].amounts.push(t.amount);
  }

  // Identify recurring patterns (at least 2 occurrences)
  const recurring = [];

  for (const pattern of Object.values(patterns)) {
    if (pattern.occurrences.length >= 2) {
      // Sort by date
      pattern.occurrences.sort((a, b) => a - b);
      
      // Calculate average interval
      const intervals = [];
      for (let i = 1; i < pattern.occurrences.length; i++) {
        const daysDiff = Math.round(
          (pattern.occurrences[i] - pattern.occurrences[i - 1]) / (1000 * 60 * 60 * 24)
        );
        intervals.push(daysDiff);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const avgAmount = pattern.amounts.reduce((a, b) => a + b, 0) / pattern.amounts.length;

      // Determine frequency
      let frequency = 'irregular';
      if (avgInterval >= 28 && avgInterval <= 32) frequency = 'monthly';
      else if (avgInterval >= 13 && avgInterval <= 16) frequency = 'bi-weekly';
      else if (avgInterval >= 6 && avgInterval <= 8) frequency = 'weekly';
      else if (avgInterval >= 88 && avgInterval <= 95) frequency = 'quarterly';
      else if (avgInterval >= 360 && avgInterval <= 370) frequency = 'yearly';

      if (frequency !== 'irregular' || pattern.occurrences.length >= 3) {
        recurring.push({
          recipient: pattern.recipient,
          frequency,
          averageInterval: Math.round(avgInterval),
          averageAmount: Math.round(avgAmount * 100) / 100,
          occurrences: pattern.occurrences.length,
          totalSpent: Math.round(pattern.amounts.reduce((a, b) => a + b, 0) * 100) / 100,
          lastDate: pattern.occurrences[pattern.occurrences.length - 1].toISOString().split('T')[0],
          nextExpected: frequency !== 'irregular' 
            ? new Date(pattern.occurrences[pattern.occurrences.length - 1].getTime() + avgInterval * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : null
        });
      }
    }
  }

  // Sort by total spent
  recurring.sort((a, b) => b.totalSpent - a.totalSpent);

  return {
    recurringPayments: recurring,
    totalRecurring: recurring.length,
    totalRecurringAmount: Math.round(recurring.reduce((sum, r) => sum + r.totalSpent, 0) * 100) / 100
  };
}

/**
 * Compare two months
 * @param {Array<Object>} transactions - All transactions
 * @param {string} month1 - First month (format: "Month Year")
 * @param {string} month2 - Second month (format: "Month Year")
 * @returns {Object} - Comparison data
 */
function compareMonths(transactions, month1, month2) {
  const filterByMonth = (month) => transactions.filter(t => {
    const d = new Date(t.date);
    const longName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    const shortName = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    return longName === month || shortName === month;
  });

  const month1Data = filterByMonth(month1);
  const month2Data = filterByMonth(month2);

  const getStats = (monthTransactions) => {
    const credits = monthTransactions.filter(t => t.type === 'Credit');
    const debits = monthTransactions.filter(t => t.type === 'Debit');
    
    const categories = {};
    for (const t of debits) {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    }

    return {
      totalCredit: Math.round(credits.reduce((sum, t) => sum + t.amount, 0) * 100) / 100,
      totalDebit: Math.round(debits.reduce((sum, t) => sum + t.amount, 0) * 100) / 100,
      transactionCount: monthTransactions.length,
      creditCount: credits.length,
      debitCount: debits.length,
      categories: Object.entries(categories).map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100
      })).sort((a, b) => b.amount - a.amount)
    };
  };

  const stats1 = getStats(month1Data);
  const stats2 = getStats(month2Data);

  // Calculate changes
  const calculateChange = (val1, val2) => {
    if (val1 === 0) return val2 > 0 ? 100 : 0;
    return Math.round(((val2 - val1) / val1) * 10000) / 100;
  };

  return {
    month1: { name: month1, ...stats1 },
    month2: { name: month2, ...stats2 },
    changes: {
      creditChange: calculateChange(stats1.totalCredit, stats2.totalCredit),
      debitChange: calculateChange(stats1.totalDebit, stats2.totalDebit),
      transactionCountChange: calculateChange(stats1.transactionCount, stats2.transactionCount)
    },
    categoryComparison: createCategoryComparison(stats1.categories, stats2.categories)
  };
}

/**
 * Create category comparison between two months
 */
function createCategoryComparison(categories1, categories2) {
  const allCategories = new Set([
    ...categories1.map(c => c.name),
    ...categories2.map(c => c.name)
  ]);

  return Array.from(allCategories).map(category => {
    const cat1 = categories1.find(c => c.name === category);
    const cat2 = categories2.find(c => c.name === category);
    
    const amount1 = cat1?.amount || 0;
    const amount2 = cat2?.amount || 0;

    return {
      category,
      month1Amount: amount1,
      month2Amount: amount2,
      change: amount2 - amount1,
      changePercent: amount1 > 0 ? Math.round(((amount2 - amount1) / amount1) * 10000) / 100 : (amount2 > 0 ? 100 : 0)
    };
  }).sort((a, b) => b.month2Amount - a.month2Amount);
}

/**
 * Detect spending anomalies
 * @param {Array<Object>} transactions - All transactions
 * @returns {Object} - Anomaly data
 */
function detectAnomalies(transactions) {
  const debits = transactions.filter(t => t.type === 'Debit');
  
  if (debits.length < 5) {
    return { anomalies: [], message: 'Not enough data for anomaly detection' };
  }

  // Calculate statistics
  const amounts = debits.map(t => t.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  // Find anomalies (transactions > 2 standard deviations from mean)
  const threshold = mean + (2 * stdDev);
  
  const anomalies = debits
    .filter(t => t.amount > threshold)
    .map(t => ({
      ...t,
      deviation: Math.round(((t.amount - mean) / stdDev) * 100) / 100,
      percentAboveMean: Math.round(((t.amount - mean) / mean) * 10000) / 100
    }))
    .sort((a, b) => b.amount - a.amount);

  // Category-wise anomaly detection
  const categoryStats = {};
  for (const t of debits) {
    const cat = t.category || 'Private';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { amounts: [], transactions: [] };
    }
    categoryStats[cat].amounts.push(t.amount);
    categoryStats[cat].transactions.push(t);
  }

  const categoryAnomalies = [];
  for (const [category, stats] of Object.entries(categoryStats)) {
    if (stats.amounts.length >= 3) {
      const catMean = stats.amounts.reduce((a, b) => a + b, 0) / stats.amounts.length;
      const catVariance = stats.amounts.reduce((sum, val) => sum + Math.pow(val - catMean, 2), 0) / stats.amounts.length;
      const catStdDev = Math.sqrt(catVariance);
      const catThreshold = catMean + (1.5 * catStdDev);

      const catAnomalies = stats.transactions.filter(t => t.amount > catThreshold);
      if (catAnomalies.length > 0) {
        categoryAnomalies.push({
          category,
          averageSpending: Math.round(catMean * 100) / 100,
          anomalyThreshold: Math.round(catThreshold * 100) / 100,
          anomalies: catAnomalies
        });
      }
    }
  }

  return {
    overallStats: {
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      threshold: Math.round(threshold * 100) / 100
    },
    anomalies,
    categoryAnomalies,
    totalAnomalies: anomalies.length
  };
}

/**
 * Predict next month spending using simple linear regression
 * @param {Array<Object>} transactions - All transactions
 * @returns {Object} - Prediction data
 */
function predictNextMonth(transactions) {
  const monthly = getMonthlyBreakdown(transactions);
  const months = monthly.months;

  if (months.length < 2) {
    return {
      canPredict: false,
      message: 'Need at least 2 months of data for prediction'
    };
  }

  // Simple linear regression on debit amounts
  const n = months.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = months.map(m => m.debit);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Predict next month
  const predictedDebit = intercept + slope * n;
  
  // Category-wise prediction
  const categoryProjections = {};
  const lastMonth = months[months.length - 1];
  
  for (const [category, amount] of Object.entries(lastMonth.categories)) {
    // Simple projection based on trend
    const previousMonths = months.slice(-3);
    const catAmounts = previousMonths.map(m => m.categories[category] || 0);
    const avgCat = catAmounts.reduce((a, b) => a + b, 0) / catAmounts.length;
    
    categoryProjections[category] = Math.round(avgCat * 100) / 100;
  }

  return {
    canPredict: true,
    predictedDebit: Math.round(Math.max(0, predictedDebit) * 100) / 100,
    trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
    trendPercentage: months.length > 1 
      ? Math.round(((months[months.length - 1].debit - months[0].debit) / months[0].debit) * 10000) / 100
      : 0,
    categoryProjections,
    confidence: n >= 3 ? 'moderate' : 'low',
    basedOnMonths: n,
    historicalData: months.map(m => ({ month: m.name, debit: m.debit }))
  };
}

/**
 * Export transactions to CSV with clean columns
 * @param {Array<Object>} transactions - All transactions
 * @returns {string} - CSV string
 */
function exportToCSV(transactions) {
  const data = transactions.map(t => ({
    Date: t.date,
    Recipient: cleanForCSV(t.recipient),
    UTR: t.reference || '',
    Amount: t.amount,
    Type: t.type,
    Category: t.category
  }));

  return Papa.unparse(data);
}

/**
 * Clean string for CSV export - remove special characters and limit length
 */
function cleanForCSV(str) {
  if (!str) return '';
  return str
    .replace(/["\n\r,]/g, ' ')  // Remove CSV-breaking characters
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim()
    .substring(0, 50);           // Limit length
}

module.exports = {
  getOverview,
  getCategoryBreakdown,
  getMonthlyBreakdown,
  getRecipientAnalysis,
  getSpendingTrends,
  detectRecurringPayments,
  compareMonths,
  detectAnomalies,
  predictNextMonth,
  exportToCSV
};
