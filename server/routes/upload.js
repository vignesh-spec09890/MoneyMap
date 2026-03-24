/**
 * Upload Routes - Handle file upload and parsing
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pdfParser = require('../services/pdfParser');
const imageParser = require('../services/imageParser');
const transactionExtractor = require('../services/transactionExtractor');
const categorizer = require('../services/categorizer');
const validator = require('../services/validator');
const visionParser = require('../services/visionParser');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'text/csv',
    'application/vnd.ms-excel'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, PNG, and CSV files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// In-memory session storage for parsed data
const sessionData = new Map();

// Valid categories for output
const VALID_CATEGORIES = ['food', 'fuel', 'groceries', 'travel', 'bills', 'taxes', 'private'];

/**
 * Post-process transactions to ensure data consistency
 * @param {Array} transactions - Raw parsed transactions
 * @returns {Array} - Validated and normalized transactions
 */
function postProcessTransactions(transactions) {
  if (!transactions || !Array.isArray(transactions)) return [];
  
  return transactions
    .filter(t => {
      // Must have valid date
      if (!t.date || !isValidDate(t.date)) return false;
      // Must have positive amount
      if (!t.amount || t.amount <= 0) return false;
      return true;
    })
    .map(t => {
      // Normalize type
      const type = normalizeType(t.type);
      
      // Normalize category
      const category = normalizeCategory(t.category);
      
      // Clean amount
      const amount = Math.round(Math.abs(parseFloat(t.amount)) * 100) / 100;
      
      // Clean recipient
      const recipient = cleanRecipient(t.recipient || t.name || 'Unknown');
      
      // Ensure description is not identical to recipient
      let description = t.description || '';
      if (!description || description.toLowerCase().trim() === recipient.toLowerCase().trim()) {
        description = recipient !== 'Unknown' ? `Payment - ${recipient}` : '';
      }

      // Clean reference - ensure it's a proper UTR, not IFSC
      const reference = cleanReference(t.reference || t.utr || '');
      
      return {
        date: t.date,
        description,
        recipient,
        reference,
        amount,
        type,
        category,
        balance: t.balance ? Math.round(parseFloat(t.balance) * 100) / 100 : undefined
      };
    });
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(dateStr) {
  if (!dateStr) return false;
  const match = String(dateStr).match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Normalize transaction type
 */
function normalizeType(typeStr) {
  const t = String(typeStr || '').toLowerCase().trim();
  if (t === 'credit' || t === 'cr' || t === 'c' || t === 'in' || t === 'credited') {
    return 'Credit';
  }
  return 'Debit';
}

/**
 * Normalize category to valid output format
 */
function normalizeCategory(category) {
  if (!category) return 'private';
  const lower = String(category).toLowerCase().trim();
  if (VALID_CATEGORIES.includes(lower)) return lower;
  // Map legacy 'others' to 'private'
  if (lower === 'others') return 'private';
  // Map common variants
  if (lower.includes('food') || lower.includes('dining')) return 'food';
  if (lower.includes('fuel') || lower.includes('petrol')) return 'fuel';
  if (lower.includes('grocery') || lower.includes('groceries')) return 'groceries';
  if (lower.includes('travel') || lower.includes('transport')) return 'travel';
  if (lower.includes('bill') || lower.includes('utility')) return 'bills';
  if (lower.includes('tax')) return 'taxes';
  return 'private';
}

/**
 * Clean recipient name
 */
function cleanRecipient(name) {
  if (!name) return 'Unknown';
  return String(name)
    .replace(/[^\w\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50) || 'Unknown';
}

/**
 * Clean reference - remove IFSC codes, keep actual transaction IDs
 */
function cleanReference(ref) {
  if (!ref) return '';
  const str = String(ref).trim();
  // If it looks like an IFSC code (4 letters + 0 + 6 chars), return empty
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(str)) return '';
  return str.substring(0, 30);
}

/**
 * POST /api/upload/statement
 * Upload and parse bank statement
 */
router.post('/statement', upload.single('statement'), async (req, res, next) => {
  // Extend request timeout for large PDFs (10 minutes)
  req.setTimeout(600000);
  res.setTimeout(600000);
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileType = req.file.mimetype;
    let transactions = [];

    console.log(`Processing file: ${req.file.originalname} (${fileType})`);

    // Parse based on file type
    if (fileType === 'application/pdf') {
      // Use DeepSeek-OCR-2 via HuggingFace for PDFs
      if (visionParser.isVisionAvailable()) {
        console.log('Using DeepSeek-OCR-2 (HuggingFace) for PDF...');
        try {
          const ocrTransactions = await visionParser.parseWithVision(filePath);
          if (ocrTransactions && ocrTransactions.length > 0) {
            console.log(`OCR extracted ${ocrTransactions.length} transactions`);
            transactions = ocrTransactions;
          } else {
            console.log('OCR returned no transactions.');
          }
        } catch (ocrError) {
          console.log(`OCR parsing failed: ${ocrError.message}`);
        }
      }

      if (transactions.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(500).json({
          success: false,
          message: 'OCR extraction failed: Could not extract transactions from this PDF. Ensure HF_API_KEY is set in server/.env, or try uploading a clearer PDF/CSV.'
        });
      }
    } else if (fileType.startsWith('image/')) {
      // For single images, also use DeepSeek-OCR-2
      if (visionParser.isVisionAvailable()) {
        console.log('Using DeepSeek-OCR-2 (HuggingFace) for image...');
        try {
          const imgBase64 = fs.readFileSync(filePath).toString('base64');
          const mimeType = fileType;
          const result = await visionParser.extractFromPageImage(
            { page: 1, base64: imgBase64, mimeType },
            1
          );
          if (result.transactions && result.transactions.length > 0) {
            transactions = result.transactions;
          }
        } catch (err) {
          console.log(`Image OCR failed: ${err.message}`);
        }
      }

      if (transactions.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(500).json({
          success: false,
          message: 'Could not extract transactions from this image. Try a clearer image or upload CSV.'
        });
      }
    } else if (fileType === 'text/csv' || fileType === 'application/vnd.ms-excel') {
      // Direct CSV processing
      const csvContent = fs.readFileSync(filePath, 'utf-8');
      transactions = transactionExtractor.parseCSV(csvContent);
    }

    // Check extraction result
    if (transactions.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(500).json({
        success: false,
        message: 'No transactions extracted. Please check the file and try again.'
      });
    }

    // POST-PROCESSING: Validate and normalize all transactions
    transactions = postProcessTransactions(transactions);

    // Validate minimum 30 days of transactions
    const validationResult = validator.validateTransactions(transactions);
    
    if (!validationResult.isValid) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: validationResult.message,
        transactionCount: transactions.length,
        daysCovered: validationResult.daysCovered
      });
    }

    // Log credit/debit breakdown before categorization
    const credits = transactions.filter(t => t.type === 'Credit');
    const debits = transactions.filter(t => t.type === 'Debit');
    const totalCredit = credits.reduce((sum, t) => sum + t.amount, 0);
    const totalDebit = debits.reduce((sum, t) => sum + t.amount, 0);
    
    console.log(`Transaction breakdown: ${credits.length} credits (₹${totalCredit.toFixed(2)}), ${debits.length} debits (₹${totalDebit.toFixed(2)})`);

    // Categorize transactions (ensure lowercase categories)
    const categorizedTransactions = categorizer.categorizeAll(transactions);

    // Generate session ID for this upload
    const sessionId = uuidv4();
    
    // Get months from categorized transactions
    const monthsData = validator.getMonthsFromTransactions(categorizedTransactions);
    
    // Store in session
    sessionData.set(sessionId, {
      transactions: categorizedTransactions,
      uploadedAt: new Date(),
      fileName: req.file.originalname,
      months: monthsData
    });

    // Clean up uploaded file after processing
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 5000);

    console.log(`Session ${sessionId} created: ${categorizedTransactions.length} transactions across ${monthsData.length} month(s)`);

    res.json({
      success: true,
      message: 'Statement processed successfully',
      sessionId,
      summary: {
        totalTransactions: categorizedTransactions.length,
        creditCount: credits.length,
        debitCount: debits.length,
        totalCredit: Math.round(totalCredit * 100) / 100,
        totalDebit: Math.round(totalDebit * 100) / 100,
        daysCovered: validationResult.daysCovered,
        monthCount: monthsData.length,
        months: monthsData,
        dateRange: {
          start: validationResult.startDate,
          end: validationResult.endDate
        }
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    next(error);
  }
});

/**
 * GET /api/upload/session/:sessionId
 * Get session data
 */
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const data = sessionData.get(sessionId);

  if (!data) {
    return res.status(404).json({
      success: false,
      message: 'Session not found or expired'
    });
  }

  res.json({
    success: true,
    data: {
      transactions: data.transactions,
      months: data.months,
      fileName: data.fileName
    }
  });
});

/**
 * POST /api/upload/session-from-history
 * Restore a session from stored historical transactions
 */
router.post('/session-from-history', (req, res) => {
  const { transactions } = req.body;
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ success: false, message: 'No transactions provided' });
  }
  const sessionId = uuidv4();
  const monthsData = transactions
    .map(t => new Date(t.date).toLocaleString('default', { month: 'long', year: 'numeric' }))
    .filter((v, i, a) => a.indexOf(v) === i);

  sessionData.set(sessionId, {
    transactions,
    uploadedAt: new Date(),
    fileName: 'History',
    months: monthsData
  });
  res.json({ success: true, sessionId });
});

/**
 * DELETE /api/upload/session/:sessionId
 * Clear session data
 */
router.delete('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  sessionData.delete(sessionId);

  res.json({
    success: true,
    message: 'Session data cleared'
  });
});

// Export sessionData for use in other routes
router.sessionData = sessionData;

module.exports = router;
