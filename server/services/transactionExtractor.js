/**
 * Transaction Extractor Service
 * Extracts and normalizes transaction data from text
 */

const Papa = require('papaparse');

// Date patterns for various formats
const DATE_PATTERNS = [
  /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/,  // DD-MM-YYYY or DD/MM/YYYY
  /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,     // YYYY-MM-DD
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*['']?(\d{2,4})?/i,
  /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*['']?(\d{2,4})?/i
];

// Amount patterns
const AMOUNT_PATTERNS = [
  /[₹$€£]\s*([\d,]+\.?\d*)/,           // Currency symbol prefix
  /([\d,]+\.?\d*)\s*[₹$€£]/,           // Currency symbol suffix
  /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)/i,   // Rs or INR prefix
  /\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/ // Plain numbers with optional decimals
];

// Reference/UTR patterns
const REFERENCE_PATTERNS = [
  /UTR[:\s]*([A-Z0-9]+)/i,
  /Ref[:\s#]*([A-Z0-9]+)/i,
  /Reference[:\s#]*([A-Z0-9]+)/i,
  /Transaction\s*ID[:\s]*([A-Z0-9]+)/i,
  /[A-Z]{4}\d{12,}/  // IMPS/NEFT/RTGS pattern
];

const MONTH_MAP = {
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4,
  'jun': 5, 'june': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'sept': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11
};

/**
 * Extract transactions from raw text
 * @param {string} text - Raw text from PDF/Image
 * @returns {Array<Object>} - Array of transaction objects
 */
function extractFromText(text) {
  const transactions = [];
  const lines = text.split('\n');
  
  let currentTransaction = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Try to extract date
    const date = extractDate(line);
    
    if (date) {
      // If we have a pending transaction, save it
      if (currentTransaction && currentTransaction.amount) {
        transactions.push(currentTransaction);
      }
      
      // Start new transaction
      currentTransaction = {
        date,
        rawLine: line,
        description: '',
        recipient: '',
        reference: '',
        amount: 0,
        type: 'Debit' // Default, will be updated
      };
      
      // Extract other fields from this line
      const amount = extractAmount(line);
      if (amount) {
        currentTransaction.amount = amount.value;
        currentTransaction.type = amount.type;
      }
      
      const reference = extractReference(line);
      if (reference) {
        currentTransaction.reference = reference;
      }
      
      // Extract description/recipient
      currentTransaction.description = cleanDescription(line);
      currentTransaction.recipient = extractRecipient(line);
      
    } else if (currentTransaction) {
      // Continuation of previous transaction
      // Check if this line has amount (if previous didn't have)
      if (!currentTransaction.amount) {
        const amount = extractAmount(line);
        if (amount) {
          currentTransaction.amount = amount.value;
          currentTransaction.type = amount.type;
        }
      }
      
      // Add to description
      currentTransaction.description += ' ' + cleanDescription(line);
      
      if (!currentTransaction.recipient) {
        currentTransaction.recipient = extractRecipient(line);
      }
      
      if (!currentTransaction.reference) {
        const reference = extractReference(line);
        if (reference) {
          currentTransaction.reference = reference;
        }
      }
    }
  }
  
  // Don't forget the last transaction
  if (currentTransaction && currentTransaction.amount) {
    transactions.push(currentTransaction);
  }
  
  // Clean up and normalize
  return transactions.map(normalizeTransaction).filter(t => t.amount > 0);
}

/**
 * Parse CSV content directly
 * @param {string} csvContent - CSV file content
 * @returns {Array<Object>} - Array of transaction objects
 */
function parseCSV(csvContent) {
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: header => header.toLowerCase().trim()
  });
  
  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }
  
  const transactions = [];
  
  for (const row of result.data) {
    const transaction = mapCSVRowToTransaction(row);
    if (transaction) {
      transactions.push(transaction);
    }
  }
  
  return transactions;
}

/**
 * Map CSV row to transaction object
 * Handles various CSV formats from different banks
 */
function mapCSVRowToTransaction(row) {
  // Try to find date column
  const dateValue = row.date || row.transaction_date || row['txn date'] || 
                    row.valuedate || row['value date'] || row.posting_date ||
                    Object.values(row)[0];
  
  // Try to find amount columns
  let amount = 0;
  let type = 'Debit';
  
  // Check for separate debit/credit columns
  const debitCol = row.debit || row.withdrawal || row['debit amount'] || row.dr;
  const creditCol = row.credit || row.deposit || row['credit amount'] || row.cr;
  
  if (debitCol && parseFloat(debitCol.toString().replace(/[₹$,]/g, ''))) {
    amount = parseFloat(debitCol.toString().replace(/[₹$,]/g, ''));
    type = 'Debit';
  } else if (creditCol && parseFloat(creditCol.toString().replace(/[₹$,]/g, ''))) {
    amount = parseFloat(creditCol.toString().replace(/[₹$,]/g, ''));
    type = 'Credit';
  } else {
    // Single amount column
    const amountCol = row.amount || row.transaction_amount || row['txn amount'];
    if (amountCol) {
      amount = Math.abs(parseFloat(amountCol.toString().replace(/[₹$,]/g, '')));
      // Default to Debit, will be overridden by type column if present
      type = amountCol.toString().includes('-') ? 'Debit' : 'Debit';
    }
  }
  
  // Check for explicit Type column - this overrides any inferred type
  const typeCol = row.type || row.transaction_type || row['txn type'] || row.dr_cr || row['dr/cr'];
  if (typeCol) {
    const typeValue = typeCol.toString().toLowerCase().trim();
    if (typeValue === 'credit' || typeValue === 'cr' || typeValue === 'c') {
      type = 'Credit';
    } else if (typeValue === 'debit' || typeValue === 'dr' || typeValue === 'd') {
      type = 'Debit';
    }
  }
  
  if (!dateValue || !amount) {
    return null;
  }
  
  // Parse date
  const date = parseDate(dateValue);
  if (!date) return null;
  
  // Get description/narration
  const description = row.description || row.narration || row.particulars || 
                      row.remarks || row.details || row['transaction details'] || '';
  
  // Get reference
  const reference = row.reference || row.ref || row.utr || row['ref no'] || 
                    row['transaction id'] || row.txnid || '';
  
  return {
    date,
    description: description.toString().trim(),
    recipient: extractRecipientFromDescription(description.toString()),
    reference: reference.toString().trim(),
    amount,
    type
  };
}

/**
 * Extract date from text
 */
function extractDate(text) {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return parseDate(match[0]);
    }
  }
  return null;
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  dateStr = dateStr.toString().trim();
  
  // IMPORTANT: Try DD-MM-YYYY FIRST (Indian format) before native parsing
  // new Date("05/06/2024") parses as MM/DD (May 6) but Indian banks use DD/MM (June 5)
  let match = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);  
  if (match) {
    let [_, day, month, year] = match;
    day = parseInt(day);
    month = parseInt(month);
    year = year.length === 2 ? '20' + year : year;
    
    // Validate DD/MM interpretation (Indian format)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const parsedDate = new Date(year, month - 1, day);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    }
  }
  
  // Try YYYY-MM-DD format (ISO)
  match = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) {
    const [_, year, month, day] = match;
    const parsedDate = new Date(year, parseInt(month) - 1, parseInt(day));
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }
  
  // Fallback: Try native Date parsing only for non-numeric formats
  if (!/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(dateStr)) {
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2000) {
      return parsedDate.toISOString().split('T')[0];
    }
  }
  
  // Try "DD Mon YYYY" format
  match = dateStr.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*['']?(\d{2,4})?/i);
  if (match) {
    const day = parseInt(match[1]);
    const month = MONTH_MAP[match[2].toLowerCase().substring(0, 3)];
    const year = match[3] ? (match[3].length === 2 ? '20' + match[3] : match[3]) : new Date().getFullYear();
    const parsedDate = new Date(year, month, day);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }
  
  return null;
}

/**
 * Extract amount from text
 */
function extractAmount(text) {
  // Look for credit/debit indicators
  const isCredit = /credit|cr\.?|deposit|\+|received|incoming/i.test(text);
  const isDebit = /debit|dr\.?|withdrawal|-|paid|outgoing|spent/i.test(text);
  
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1] || match[0];
      const value = parseFloat(amountStr.replace(/[,₹$€£]/g, ''));
      
      if (value && value > 0) {
        return {
          value,
          type: isCredit ? 'Credit' : (isDebit ? 'Debit' : 'Debit')
        };
      }
    }
  }
  
  return null;
}

/**
 * Extract reference number
 */
function extractReference(text) {
  for (const pattern of REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return '';
}

/**
 * Extract recipient name from text or description
 */
function extractRecipient(text) {
  // Common patterns for recipients
  const patterns = [
    /(?:to|from|paid to|received from|transfer to|transfer from)[:\s]+([A-Za-z0-9\s]+?)(?:\s+(?:utr|ref|on|\d))/i,
    /(?:UPI|IMPS|NEFT|RTGS)[\/\-][\w]+[\/\-]([A-Za-z\s]+?)(?:[\/\-]|$)/i,
    /(?:UPI)-([A-Za-z0-9@.]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return cleanRecipientName(match[1]);
    }
  }
  
  return extractRecipientFromDescription(text);
}

/**
 * Extract recipient from description field
 */
function extractRecipientFromDescription(description) {
  if (!description) return 'Unknown';
  
  // Remove common banking prefixes
  let cleaned = description.toString()
    .replace(/^(UPI|IMPS|NEFT|RTGS|ATM|POS|ECS|EMI)[\/\-\s]*/i, '')
    .replace(/[\d]{10,}/g, '') // Remove long numbers
    .replace(/[A-Z]{4}\d{7}/g, '') // Remove IFSC-like codes
    .trim();
  
  // Try to extract name
  const parts = cleaned.split(/[\/\-@]/);
  for (const part of parts) {
    const trimmed = part.trim();
    // Check if it looks like a name (contains letters, reasonable length)
    if (trimmed.length > 2 && trimmed.length < 50 && /[A-Za-z]/.test(trimmed)) {
      return cleanRecipientName(trimmed);
    }
  }
  
  return cleaned.substring(0, 30) || 'Unknown';
}

/**
 * Clean recipient name
 */
function cleanRecipientName(name) {
  return name
    .replace(/[^A-Za-z0-9\s.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50) || 'Unknown';
}

/**
 * Clean description text
 */
function cleanDescription(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize transaction object
 */
function normalizeTransaction(transaction) {
  return {
    date: transaction.date,
    description: transaction.description?.substring(0, 200) || '',
    recipient: transaction.recipient || 'Unknown',
    reference: transaction.reference || '',
    amount: Math.round(transaction.amount * 100) / 100,
    type: transaction.type || 'Debit',
    category: 'Private' // Will be set by categorizer
  };
}

module.exports = {
  extractFromText,
  parseCSV,
  parseDate,
  extractAmount,
  extractReference,
  extractRecipient
};
