/**
 * Validator Service
 * Validates transaction data and business rules
 */

const MIN_DAYS_REQUIRED = 1;  // Reduced from 30 to allow smaller statements for testing

/**
 * Validate transactions meet minimum requirements
 * @param {Array<Object>} transactions - Array of transactions
 * @returns {Object} - Validation result
 */
function validateTransactions(transactions) {
  if (!transactions || transactions.length === 0) {
    return {
      isValid: false,
      message: 'No transactions found in the uploaded file. Please ensure you upload a valid bank statement.',
      daysCovered: 0,
      transactionCount: 0
    };
  }

  // Get date range
  const dates = transactions
    .map(t => new Date(t.date))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);

  if (dates.length === 0) {
    return {
      isValid: false,
      message: 'Could not parse transaction dates. Please check the file format.',
      daysCovered: 0,
      transactionCount: transactions.length
    };
  }

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const daysCovered = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  if (daysCovered < MIN_DAYS_REQUIRED) {
    return {
      isValid: false,
      message: `Statement must contain at least ${MIN_DAYS_REQUIRED} days of transactions. Found ${daysCovered} days (${formatDate(startDate)} to ${formatDate(endDate)}).`,
      daysCovered,
      transactionCount: transactions.length,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  return {
    isValid: true,
    message: 'Validation successful',
    daysCovered,
    transactionCount: transactions.length,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

/**
 * Get unique months from transactions
 * @param {Array<Object>} transactions - Array of transactions
 * @returns {Array<Object>} - Array of month info
 */
function getMonthsFromTransactions(transactions) {
  const monthMap = new Map();

  for (const transaction of transactions) {
    const date = new Date(transaction.date);
    if (isNaN(date.getTime())) continue;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    // Use short month format to match analytics service
    const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        key: monthKey,
        name: monthName,
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        transactionCount: 0,
        totalCredit: 0,
        totalDebit: 0
      });
    }

    const monthData = monthMap.get(monthKey);
    monthData.transactionCount++;
    
    if (transaction.type === 'Credit') {
      monthData.totalCredit += transaction.amount;
    } else {
      monthData.totalDebit += transaction.amount;
    }
  }

  // Sort by date and return
  return Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Check if comparison feature should be enabled
 * @param {Array<Object>} transactions - Array of transactions
 * @returns {boolean} - True if more than 2 months
 */
function shouldEnableComparison(transactions) {
  const months = getMonthsFromTransactions(transactions);
  return months.length >= 2;
}

/**
 * Validate file type
 * @param {string} mimetype - File MIME type
 * @returns {Object} - Validation result
 */
function validateFileType(mimetype) {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'text/csv',
    'application/vnd.ms-excel'
  ];

  if (allowedTypes.includes(mimetype)) {
    return { isValid: true, message: 'Valid file type' };
  }

  return {
    isValid: false,
    message: 'Invalid file type. Please upload a PDF, image (JPG/PNG), or CSV file.'
  };
}

/**
 * Format date for display
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

module.exports = {
  validateTransactions,
  getMonthsFromTransactions,
  shouldEnableComparison,
  validateFileType,
  MIN_DAYS_REQUIRED
};
