/**
 * ACCURACY-FIRST Bank Statement Parser
 * Single Provider: GROQ only
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// API Configuration - Groq primary, OpenRouter fallback
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

const MAX_TOKENS = 8192;

// Track if Groq is rate limited (switch to fallback)
let groqRateLimited = false;
let groqRateLimitResetTime = 0;

// Configuration - Optimized for accuracy
const CHUNK_SIZE = 10000;          // Smaller chunks for better accuracy
const OVERLAP_LINES = 50;          // More overlap to capture complete transactions
const DELAY_BETWEEN_CHUNKS = 3000; // 3 seconds between chunks
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

// Bank statement header for context injection
const BANK_STATEMENT_HEADER = `DateTransaction DetailsDebitsCreditsBalance
--- COLUMN LAYOUT: Date | Description | DEBIT (INR X) | CREDIT (-INR X) | Balance (INR Y) ---`;

// Debug
const DEBUG_MODE = true;
const DEBUG_DIR = path.join(__dirname, '..', 'debug');

/**
 * Save debug file
 */
function saveDebugFile(filename, content) {
  if (!DEBUG_MODE) return;
  try {
    if (!fs.existsSync(DEBUG_DIR)) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
    }
    const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
    fs.writeFileSync(path.join(DEBUG_DIR, filename), data);
  } catch (err) {}
}

/**
 * Check if AI is available
 */
async function isAIAvailable() {
  const groqOk = GROQ_API_KEY && GROQ_API_KEY.length > 10 && GROQ_API_KEY.startsWith('gsk_');
  const openrouterOk = OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 10;
  return groqOk || openrouterOk;
}

/**
 * Get current provider (Groq primary, OpenRouter fallback)
 */
function getCurrentProvider() {
  // If Groq rate limited, check if we can reset
  if (groqRateLimited && Date.now() > groqRateLimitResetTime) {
    groqRateLimited = false;
    console.log('  [INFO] Groq rate limit reset, switching back to Groq');
  }
  
  // Use OpenRouter if Groq is rate limited or unavailable
  if (groqRateLimited || !GROQ_API_KEY || !GROQ_API_KEY.startsWith('gsk_')) {
    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 10) {
      return 'openrouter';
    }
  }
  
  // Default to Groq
  if (GROQ_API_KEY && GROQ_API_KEY.startsWith('gsk_')) {
    return 'groq';
  }
  
  return null;
}

/**
 * Main parsing function
 */
async function parseWithAI(rawText) {
  if (!await isAIAvailable()) {
    throw new Error('AI unavailable: Set GROQ_API_KEY or OPENROUTER_API_KEY in .env file (or use GEMINI_API_KEY for PDF vision parsing)');
  }

  // Reset rate limit tracking for new parse
  groqRateLimited = false;
  
  const provider = getCurrentProvider();
  const model = provider === 'groq' ? GROQ_MODEL : OPENROUTER_MODEL;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`   BANK STATEMENT PARSER`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Provider: ${provider === 'groq' ? 'Groq' : 'OpenRouter'} (${model})`);
  console.log(`Input size: ${rawText.length} characters`);
  
  saveDebugFile('raw_pdf_text.txt', rawText);
  
  // Pre-parse raw text for type detection
  const typeMap = buildTypeMapFromRawText(rawText);
  
  // Smart chunking with overlap
  const chunks = smartSplitIntoChunks(rawText);
  console.log(`Split into ${chunks.length} chunks (with ${OVERLAP_LINES} line overlap)\n`);
  
  const allTransactions = [];
  let processedChunks = 0;
  let failedChunks = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[${i + 1}/${chunks.length}] Processing chunk...`);
    
    const context = {
      chunkNum: i + 1,
      totalChunks: chunks.length,
      isFirst: i === 0,
      isLast: i === chunks.length - 1
    };
    
    const result = await processChunk(chunks[i], context);
    
    if (result && result.length > 0) {
      allTransactions.push(...result);
      processedChunks++;
      console.log(`  ✓ Extracted ${result.length} transactions`);
    } else {
      failedChunks++;
      console.log(`  ✗ No transactions found`);
    }
    
    // Delay between chunks
    if (i < chunks.length - 1) {
      await sleep(DELAY_BETWEEN_CHUNKS);
    }
  }
  
  console.log(`\n[POST-PROCESSING] Deduplicating and validating...`);
  console.log(`  Raw extraction: ${allTransactions.length} transactions`);
  
  // Deduplicate (handles chunk overlap)
  const deduplicated = smartDeduplication(allTransactions);
  console.log(`  After deduplication: ${deduplicated.length} transactions`);
  
  // Validate and repair broken transactions
  console.log(`\n[VALIDATION] Checking transaction integrity...`);
  const validated = validateAndRepairTransactions(deduplicated);
  console.log(`  After validation: ${validated.length} valid transactions`);
  
  // Sort chronologically by date, then by balance (to maintain sequence)
  validated.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
    return (a.balance || 0) - (b.balance || 0);
  });
  
  // Multi-pass correction
  console.log(`\n[CORRECTION PASS 1] Raw text type detection...`);
  const pass1 = correctTypesFromRawParsing(validated, typeMap);
  
  console.log(`[CORRECTION PASS 2] Balance-based verification...`);
  const pass2 = correctTypesByBalance(pass1);
  
  console.log(`[CORRECTION PASS 3] Final validation...`);
  const finalTransactions = validateAndRepairTransactions(pass2);
  
  // Print summary
  printFinalSummary(chunks.length, processedChunks, failedChunks, finalTransactions);
  
  if (finalTransactions.length === 0) {
    throw new Error('Could not extract any transactions from the document');
  }
  
  return finalTransactions;
}

/**
 * Process a single chunk with retries and fallback
 */
async function processChunk(chunkText, context) {
  saveDebugFile(`chunk_${context.chunkNum}_input.txt`, chunkText);
  
  const provider = getCurrentProvider();
  console.log(`  Using ${provider === 'groq' ? 'Groq' : 'OpenRouter'}...`);
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callAI(chunkText, context);
      if (result && result.length > 0) {
        return result.map(t => strictNormalize(t)).filter(t => t && t.amount > 0 && t.date);
      }
    } catch (error) {
      const isRateLimit = error.message.includes('rate') || error.message.includes('429');
      
      if (isRateLimit && getCurrentProvider() === 'groq') {
        // Switch to OpenRouter fallback
        groqRateLimited = true;
        groqRateLimitResetTime = Date.now() + 60000; // Reset in 1 minute
        
        if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 10) {
          console.log(`  Groq rate limited, switching to OpenRouter fallback...`);
          // Try immediately with OpenRouter
          try {
            const result = await callAI(chunkText, context);
            if (result && result.length > 0) {
              return result.map(t => strictNormalize(t)).filter(t => t && t.amount > 0 && t.date);
            }
          } catch (fallbackErr) {
            console.log(`  OpenRouter also failed: ${fallbackErr.message}`);
          }
        }
      }
      
      if (attempt < MAX_RETRIES) {
        const delay = isRateLimit ? RETRY_DELAY : 2000;
        console.log(`  Attempt ${attempt} failed (${error.message}), retry in ${delay/1000}s...`);
        await sleep(delay);
      } else {
        console.log(`  All ${MAX_RETRIES} attempts failed: ${error.message}`);
      }
    }
  }
  
  return null;
}

/**
 * Call AI API (Groq or OpenRouter)
 */
async function callAI(chunkText, context) {
  const provider = getCurrentProvider();
  const prompt = buildPrompt(chunkText, context);
  
  let url, headers, model;
  
  if (provider === 'openrouter') {
    url = OPENROUTER_URL;
    model = OPENROUTER_MODEL;
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Bank Statement Parser'
    };
  } else {
    url = GROQ_URL;
    model = GROQ_MODEL;
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    };
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: MAX_TOKENS
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    if (errText.includes('rate') || errText.includes('429') || errText.includes('limit')) {
      throw new Error('rate limit');
    }
    throw new Error(`API ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  
  if (!content) return null;
  
  saveDebugFile(`chunk_${context.chunkNum}_${provider}_response.txt`, content);
  
  return parseAIResponse(content);
}

/**
 * Build context-aware prompt with strict completeness enforcement
 */
function buildPrompt(text, context) {
  // Count approximate transaction rows for verification
  const datePattern = /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/gi;
  const dateMatches = text.match(datePattern) || [];
  const estimatedRows = Math.floor(dateMatches.length / 2) || dateMatches.length; // Dates may repeat in header
  
  // Check if this is a continuation chunk
  const isContinuation = text.includes('[CONTINUATION FROM PREVIOUS CHUNK]') || !context.isFirst;
  
  return `You are parsing an Indian bank statement PDF. This is chunk ${context.chunkNum} of ${context.totalChunks}.
${context.isFirst ? 'This is the FIRST chunk - it contains the statement header and account details.' : ''}
${context.isLast ? 'This is the LAST chunk - extract all remaining transactions.' : ''}
${isContinuation ? `
=== CHUNK CONTINUATION WARNING ===
This chunk OVERLAPS with the previous chunk. Some transactions at the START may be duplicates.
If you see transactions that seem incomplete at the very start (no date, just description continuation),
SKIP them - they were already captured in the previous chunk.
Look for the FIRST COMPLETE transaction (starts with a date like "01 Jan 2025" or "01/01/2025").
` : ''}

=== CRITICAL: EXTRACT EVERY COMPLETE TRANSACTION ===
Estimated transactions in this chunk: ~${estimatedRows}. Extract ALL complete ones.
A COMPLETE transaction has: Date + Description + Amount + Balance

STRICT OUTPUT FORMAT - Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "date": "YYYY-MM-DD",
    "name": "Recipient Name",
    "desc": "Full transaction description", 
    "amount": 123.45,
    "type": "debit",
    "ref": "UPI_TRANSACTION_ID",
    "balance": 1000.00
  }
]

=== CRITICAL: INDIAN BANK COLUMN LAYOUT ===
Indian bank PDFs have 3 number columns: DEBIT | CREDIT | BALANCE (left to right)

PATTERN RECOGNITION (VERY IMPORTANT):
The PDF text shows amounts as "INR X.XX" with dash placement indicating column:

1. CREDIT transaction (money IN): " -INR 500.00INR 1500.00"
   - The "-INR 500.00" (dash BEFORE INR with space) = CREDIT column = 500 received
   - The "INR 1500.00" at end = new balance
   - Result: type="credit", amount=500, balance=1500

2. DEBIT transaction (money OUT): "INR 200.00 -INR 1300.00"  
   - The "INR 200.00" (no dash prefix) at start = DEBIT column = 200 spent
   - The "-INR 1300.00" (dash before) at end = new balance (display format)
   - Result: type="debit", amount=200, balance=1300

3. Alternative patterns:
   - " -INR X.XXINR Y.YY" → CREDIT X.XX, balance Y.YY
   - "INR X.XX -INR Y.YY" → DEBIT X.XX, balance Y.YY
   - "INR X.XX-INR Y.YY" → DEBIT X.XX, balance Y.YY

THE DASH IS NOT A NEGATIVE SIGN! It's a column separator/display marker.
- Dash BEFORE amount with space = typically CREDIT column
- Amount without leading dash = typically DEBIT column

=== HANDLING MULTI-LINE TRANSACTIONS ===
Bank statement transactions span multiple lines. A single transaction looks like:
\`\`\`
01 Jan 2025SBIN0020247/SHAIK      <- DATE + start of description
MOSIN  /XXXXX                      <- description continues
/shaikmosin271@axl                 <- description continues
/UPI/908635942484/Payment          <- UPI ID is here!
from PhonePe /BRANCH               <- description continues
:  ATM SERVICE BRANCH              <- description ends
INR 35.00 -INR 5,340.10            <- AMOUNT + BALANCE line
\`\`\`
ALWAYS wait for the amount line before considering a transaction complete.

=== FIELD EXTRACTION RULES ===
1. "date": Convert to YYYY-MM-DD. Indian format: 05/03/2024 = March 5th (DD/MM/YYYY)
2. "amount": The transaction amount as NUMBER (NOT the balance). Remove commas.
3. "type": "credit" if money received, "debit" if money spent (use column position!)
4. "balance": The balance AFTER this transaction (rightmost amount)
5. "ref": Extract UPI transaction ID from patterns like /UPI/123456789/ - the NUMBERS after /UPI/
6. "name": The recipient/sender name (typically first name after IFSC code like SBIN0020247/)

=== EXTRACT UTR/REFERENCE CORRECTLY ===
From: "SBIN0020247/SHAIK MOSIN/.../UPI/100080626318/Payment..."
- ref = "100080626318" (digits after /UPI/)
- name = "SHAIK MOSIN"
- NOT the IFSC code (SBIN0020247)

BANK STATEMENT TEXT:
${text}

Return ONLY the JSON array. No markdown code blocks. No explanation.
JSON ARRAY:`;
}

/**
 * Smart chunking at transaction boundaries with overlap
 * IMPROVED: Detects complete transactions and never splits mid-transaction
 */
function smartSplitIntoChunks(text) {
  // Step 1: Pre-process text to fix PDF extraction issues
  const cleanedText = preprocessPDFText(text);
  const lines = cleanedText.split('\n');
  
  // Step 2: Identify transaction start positions
  // A transaction starts with a date pattern
  const transactionStarts = [];
  for (let i = 0; i < lines.length; i++) {
    if (isTransactionStart(lines[i])) {
      transactionStarts.push(i);
    }
  }
  
  // Step 3: Extract header from PDF (first occurrence of column header)
  let headerSection = extractHeaderSection(lines);
  
  // Step 4: Build chunks respecting transaction boundaries
  const chunks = [];
  let currentChunkLines = [];
  let currentSize = 0;
  let lastTransactionEndIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineSize = line.length + 1;
    
    // Check if we need to start a new chunk
    if (currentSize + lineSize > CHUNK_SIZE && currentChunkLines.length > 0) {
      // Find the last complete transaction boundary
      let breakPoint = findLastTransactionBoundary(currentChunkLines, transactionStarts, lastTransactionEndIndex);
      
      if (breakPoint > 0 && breakPoint < currentChunkLines.length) {
        // Create chunk ending at transaction boundary
        const chunkContent = currentChunkLines.slice(0, breakPoint).join('\n');
        chunks.push(addChunkHeader(chunkContent, headerSection, chunks.length === 0));
        
        // Keep overlap: go back to include a few complete transactions for context
        const overlapStart = findOverlapStartPoint(currentChunkLines, breakPoint, transactionStarts);
        currentChunkLines = currentChunkLines.slice(overlapStart);
        currentSize = currentChunkLines.join('\n').length;
        lastTransactionEndIndex = overlapStart;
      } else {
        // Fallback: use simple line-based split
        chunks.push(addChunkHeader(currentChunkLines.join('\n'), headerSection, chunks.length === 0));
        const overlapCount = Math.min(OVERLAP_LINES, currentChunkLines.length);
        currentChunkLines = currentChunkLines.slice(-overlapCount);
        currentSize = currentChunkLines.join('\n').length;
      }
    }
    
    currentChunkLines.push(line);
    currentSize += lineSize;
  }
  
  // Don't forget the last chunk
  if (currentChunkLines.length > 0) {
    const chunkContent = currentChunkLines.join('\n');
    chunks.push(addChunkHeader(chunkContent, headerSection, chunks.length === 0));
  }
  
  console.log(`  Split into ${chunks.length} chunks (transaction-boundary aware)`);
  return chunks;
}

/**
 * Pre-process PDF text to fix common extraction issues
 */
function preprocessPDFText(text) {
  let cleaned = text;
  
  // Fix broken words from PDF extraction (word split across lines)
  // Pattern: line ending with partial word + next line starting with lowercase continuation
  cleaned = cleaned.replace(/(\w)[ ]*\n([a-z])/g, '$1$2');
  
  // Fix common PDF line break patterns
  cleaned = cleaned.replace(/Payme\s*\n\s*nt/g, 'Payment');
  cleaned = cleaned.replace(/Pay\s*\n\s*ment/g, 'Payment');
  cleaned = cleaned.replace(/Trans\s*\n\s*action/g, 'Transaction');
  cleaned = cleaned.replace(/Trans\s*\n\s*fer/g, 'Transfer');
  
  // Normalize multiple spaces but preserve line structure
  cleaned = cleaned.replace(/  +/g, ' ');
  
  // Remove empty lines between transaction parts (but keep structure)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
}

/**
 * Check if a line starts a new transaction (date pattern)
 */
function isTransactionStart(line) {
  const trimmed = line.trim();
  // Date patterns: DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY
  return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(trimmed) ||
         /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}/i.test(trimmed);
}

/**
 * Check if a line is likely the end of a transaction (has amount pattern)
 */
function isTransactionEnd(line) {
  const trimmed = line.trim();
  // Amount patterns: INR X.XX or -INR X.XX at end of line
  return /INR\s*[\d,]+\.?\d*\s*$/i.test(trimmed) ||
         /-\s*INR\s*[\d,]+\.?\d*\s*$/i.test(trimmed);
}

/**
 * Extract the header section from the PDF for context injection
 */
function extractHeaderSection(lines) {
  // Look for common bank statement header patterns
  const headerPatterns = [
    /^DateTransaction\s*Details/i,
    /^Date\s*Transaction/i,
    /^Date\s*Description/i,
    /^Txn\s*Date/i
  ];
  
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i].trim();
    for (const pattern of headerPatterns) {
      if (pattern.test(line)) {
        // Found header, return it with column context
        return line;
      }
    }
  }
  
  // Default header if not found
  return 'DateTransaction DetailsDebitsCreditsBalance';
}

/**
 * Find the last complete transaction boundary in chunk lines
 */
function findLastTransactionBoundary(lines, transactionStarts, startOffset) {
  // Work backwards from end to find a transaction start
  // A complete transaction: starts with date, ends with amount line
  
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 50); i--) {
    if (isTransactionStart(lines[i])) {
      // Found a transaction start - check if we should include it
      // Look ahead to see if the transaction is complete in this chunk
      let hasAmountLine = false;
      for (let j = i + 1; j < lines.length && j < i + 15; j++) {
        if (isTransactionEnd(lines[j])) {
          hasAmountLine = true;
          // Return position AFTER this complete transaction
          return j + 1;
        }
        // If we hit another transaction start, previous one might be incomplete
        if (j > i && isTransactionStart(lines[j])) {
          break;
        }
      }
      
      // If transaction doesn't have amount yet, split BEFORE it
      if (!hasAmountLine) {
        return i;
      }
    }
  }
  
  return lines.length;
}

/**
 * Find a good overlap start point (beginning of a complete transaction)
 */
function findOverlapStartPoint(lines, breakPoint, transactionStarts) {
  // Go back from breakPoint to find transaction starts for overlap
  const targetOverlapTransactions = 3; // Keep 3 complete transactions as overlap
  let transactionsFound = 0;
  
  for (let i = breakPoint - 1; i >= 0; i--) {
    if (isTransactionStart(lines[i])) {
      transactionsFound++;
      if (transactionsFound >= targetOverlapTransactions) {
        return i;
      }
    }
  }
  
  // Fallback to line-based overlap
  return Math.max(0, breakPoint - OVERLAP_LINES);
}

/**
 * Add header context to chunk for LLM understanding
 */
function addChunkHeader(chunkContent, headerSection, isFirstChunk) {
  if (isFirstChunk) {
    // First chunk should have the full context already
    return chunkContent;
  }
  
  // For subsequent chunks, inject header if not present
  if (!chunkContent.includes('DateTransaction') && 
      !chunkContent.includes('Date Transaction') &&
      !chunkContent.includes('DebitsCreditsBalance')) {
    // Prepend header context
    return `${BANK_STATEMENT_HEADER}\n[CONTINUATION FROM PREVIOUS CHUNK]\n${chunkContent}`;
  }
  
  return chunkContent;
}

/**
 * Pre-parse raw PDF text for type detection
 * Detects credit/debit based on Indian bank column patterns
 */
function buildTypeMapFromRawText(rawText) {
  const typeMap = new Map();
  const lines = rawText.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.includes('INR')) continue;
    
    // PATTERN 1: CREDIT - " -INR X.XXINR Y.YY" (dash before first amount, no space before second)
    // The leading " -INR" or "-INR" at start indicates CREDIT column
    const creditMatch1 = trimmed.match(/^\s*-\s*INR\s*([\d,]+\.?\d*)\s*INR\s*([\d,]+\.?\d*)\s*$/i);
    if (creditMatch1) {
      const amount = parseFloat(creditMatch1[1].replace(/,/g, ''));
      const balance = parseFloat(creditMatch1[2].replace(/,/g, ''));
      if (amount > 0 && !isNaN(balance)) {
        typeMap.set(`${amount.toFixed(2)}_${balance.toFixed(2)}`, { type: 'Credit', amount, balance });
      }
      continue;
    }
    
    // PATTERN 1b: CREDIT variant - "-INR X.XXINR Y.YY" (no space)
    const creditMatch1b = trimmed.match(/^-INR\s*([\d,]+\.?\d*)\s*INR\s*([\d,]+\.?\d*)\s*$/i);
    if (creditMatch1b) {
      const amount = parseFloat(creditMatch1b[1].replace(/,/g, ''));
      const balance = parseFloat(creditMatch1b[2].replace(/,/g, ''));
      if (amount > 0 && !isNaN(balance)) {
        typeMap.set(`${amount.toFixed(2)}_${balance.toFixed(2)}`, { type: 'Credit', amount, balance });
      }
      continue;
    }
    
    // PATTERN 2: DEBIT - "INR X.XX -INR Y.YY" or "INR X.XX-INR Y.YY" (amount first, then balance)
    const debitMatch1 = trimmed.match(/^INR\s*([\d,]+\.?\d*)\s*-\s*INR\s*([\d,]+\.?\d*)\s*$/i);
    if (debitMatch1) {
      const amount = parseFloat(debitMatch1[1].replace(/,/g, ''));
      const balance = parseFloat(debitMatch1[2].replace(/,/g, ''));
      if (amount > 0 && !isNaN(balance)) {
        typeMap.set(`${amount.toFixed(2)}_${balance.toFixed(2)}`, { type: 'Debit', amount, balance });
      }
      continue;
    }
    
    // PATTERN 2b: DEBIT variant - no space before dash
    const debitMatch1b = trimmed.match(/^INR\s*([\d,]+\.?\d*)-INR\s*([\d,]+\.?\d*)\s*$/i);
    if (debitMatch1b) {
      const amount = parseFloat(debitMatch1b[1].replace(/,/g, ''));
      const balance = parseFloat(debitMatch1b[2].replace(/,/g, ''));
      if (amount > 0 && !isNaN(balance)) {
        typeMap.set(`${amount.toFixed(2)}_${balance.toFixed(2)}`, { type: 'Debit', amount, balance });
      }
      continue;
    }
    
    // PATTERN 3: Single line with both columns visible (rare)
    // "INR X.XX    INR Y.YY" - only debit column filled, large gap to balance
    const singleDebit = trimmed.match(/^INR\s*([\d,]+\.?\d*)\s{3,}INR\s*([\d,]+\.?\d*)\s*$/i);
    if (singleDebit) {
      const amount = parseFloat(singleDebit[1].replace(/,/g, ''));
      const balance = parseFloat(singleDebit[2].replace(/,/g, ''));
      if (amount > 0 && balance > 0) {
        typeMap.set(`${amount.toFixed(2)}_${balance.toFixed(2)}`, { type: 'Debit', amount, balance });
      }
    }
  }
  
  console.log(`  Pre-parsed ${typeMap.size} transaction types from raw text`);
  return typeMap;
}

/**
 * Strict normalization with proper UTR extraction
 */
function strictNormalize(t) {
  if (!t) return null;
  
  const amount = parseAmount(t.amount);
  if (amount <= 0) return null;
  
  const date = parseDate(t.date);
  if (!date) return null;
  
  const type = normalizeType(t.type);
  const balance = parseAmount(t.balance);
  const description = cleanString(t.desc || t.description || '');
  const recipient = cleanString(t.name || '').replace(/\s+/g, ' ').trim() || extractRecipientFromDesc(description);
  
  // Extract proper UTR/reference - prioritize UPI transaction ID over IFSC code
  const reference = extractProperReference(t.ref, description);
  
  return {
    date,
    description: description || `Transaction with ${recipient}`,
    recipient: recipient || 'Unknown',
    reference,
    amount,
    type,
    category: categorize(recipient, description),
    balance: balance > 0 ? balance : undefined
  };
}

/**
 * Extract proper UTR/reference number from text
 * Prioritizes UPI transaction IDs over IFSC codes
 */
function extractProperReference(providedRef, description) {
  const fullText = `${providedRef || ''} ${description || ''}`;
  
  // Priority 1: UPI transaction ID (12+ digit number after /UPI/)
  const upiMatch = fullText.match(/\/UPI\/(\d{9,})/i);
  if (upiMatch) return upiMatch[1];
  
  // Priority 2: UTR number
  const utrMatch = fullText.match(/UTR[:\s]*([A-Z0-9]{12,})/i);
  if (utrMatch) return utrMatch[1];
  
  // Priority 3: Reference number
  const refMatch = fullText.match(/Ref[:\s#]*([A-Z0-9]{8,})/i);
  if (refMatch) return refMatch[1];
  
  // Priority 4: IMPS/NEFT/RTGS reference pattern
  const bankRefMatch = fullText.match(/([A-Z]{4}\d{10,})/);
  if (bankRefMatch) return bankRefMatch[1];
  
  // Priority 5: Any long number sequence that's not an IFSC code
  const numMatch = fullText.match(/\b(\d{12,})\b/);
  if (numMatch) return numMatch[1];
  
  // Fallback: Use provided ref only if it's not just an IFSC code
  if (providedRef && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(providedRef)) {
    return cleanString(providedRef);
  }
  
  return '';
}

/**
 * Extract recipient name from description
 */
function extractRecipientFromDesc(description) {
  if (!description) return 'Unknown';
  
  // Pattern: "IFSC/Name/..." - extract the second part
  const parts = description.split('/');
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    // Check if it looks like a name (contains letters, not too long)
    if (part.length > 2 && part.length < 40 && /^[A-Za-z\s]+$/.test(part)) {
      return part;
    }
  }
  
  return 'Unknown';
}

function parseAmount(val) {
  if (typeof val === 'number') return Math.abs(val);
  if (!val) return 0;
  const cleaned = String(val).replace(/[₹$€£,\s]/g, '').replace(/^[+-]/, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    if (parseInt(month) <= 12 && parseInt(day) <= 31) {
      return `${m[3]}-${month}-${day}`;
    }
  }
  
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12'
  };
  
  m = str.match(/(\d{1,2})[\s\-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-]*(\d{4})/i);
  if (m) {
    return `${m[3]}-${months[m[2].toLowerCase().substring(0, 3)]}-${m[1].padStart(2, '0')}`;
  }
  
  m = str.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s]*(\d{1,2}),?\s*(\d{4})/i);
  if (m) {
    return `${m[3]}-${months[m[1].toLowerCase().substring(0, 3)]}-${m[2].padStart(2, '0')}`;
  }
  
  return null;
}

function normalizeType(typeStr) {
  const t = String(typeStr || '').toLowerCase().trim();
  if (t === 'credit' || t === 'cr' || t === 'c' || t === 'in' || t === 'credited') {
    return 'Credit';
  }
  return 'Debit';
}

function cleanString(str) {
  if (!str) return '';
  return String(str).replace(/[\/\\|]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 100);
}

/**
 * Smart deduplication - handles overlapping chunks from PDF splitting
 * Preserves legitimate duplicate transactions (same day, same amount to different recipients)
 * Only removes true duplicates caused by chunk overlap
 */
function smartDeduplication(transactions) {
  if (!transactions || transactions.length === 0) return [];
  
  const unique = new Map();
  let dupeCount = 0;
  let fuzzyDupeCount = 0;
  
  for (const t of transactions) {
    // Primary key: date + amount + balance (most reliable for identifying duplicates)
    // Secondary: use reference OR description hash for disambiguation
    const refKey = t.reference || '';
    const descHash = (t.description || t.recipient || '').substring(0, 30).toLowerCase().replace(/\s+/g, '');
    
    // Strong key: includes reference for precise matching
    const strongKey = `${t.date}|${t.amount.toFixed(2)}|${t.balance ? t.balance.toFixed(2) : 'x'}|${refKey}`;
    
    // Weak key: for fuzzy duplicate detection when references are missing/different
    const weakKey = `${t.date}|${t.amount.toFixed(2)}|${t.balance ? t.balance.toFixed(2) : 'x'}|${descHash.substring(0, 15)}`;
    
    // Check for exact duplicate (same strong key)
    if (unique.has(strongKey)) {
      dupeCount++;
      const existing = unique.get(strongKey);
      // Keep the one with more complete data
      if (getTransactionCompleteness(t) > getTransactionCompleteness(existing)) {
        unique.set(strongKey, t);
      }
      continue;
    }
    
    // Check for fuzzy duplicate (overlap artifacts)
    // These occur when the same transaction is extracted from overlapping chunks
    // but with slightly different parsing (e.g., truncated description)
    let foundFuzzyMatch = false;
    for (const [existingKey, existing] of unique.entries()) {
      if (existingKey.startsWith(`${t.date}|${t.amount.toFixed(2)}|${t.balance ? t.balance.toFixed(2) : 'x'}|`)) {
        // Same date + amount + balance - likely a duplicate from chunk overlap
        // Check if descriptions are similar enough
        const existingDesc = (existing.description || existing.recipient || '').toLowerCase();
        const currentDesc = (t.description || t.recipient || '').toLowerCase();
        
        if (existingDesc && currentDesc && 
            (existingDesc.includes(currentDesc.substring(0, 10)) || 
             currentDesc.includes(existingDesc.substring(0, 10)) ||
             areRecipientsMatching(existing.recipient, t.recipient))) {
          // Fuzzy match found - keep the more complete one
          fuzzyDupeCount++;
          if (getTransactionCompleteness(t) > getTransactionCompleteness(existing)) {
            unique.delete(existingKey);
            unique.set(strongKey, t);
          }
          foundFuzzyMatch = true;
          break;
        }
      }
    }
    
    if (!foundFuzzyMatch) {
      unique.set(strongKey, t);
    }
  }
  
  if (dupeCount > 0 || fuzzyDupeCount > 0) {
    console.log(`    Removed ${dupeCount} exact + ${fuzzyDupeCount} fuzzy duplicates`);
  }
  
  return Array.from(unique.values());
}

/**
 * Calculate completeness score for a transaction
 */
function getTransactionCompleteness(t) {
  let score = 0;
  if (t.date) score += 10;
  if (t.amount && t.amount > 0) score += 10;
  if (t.balance && t.balance > 0) score += 5;
  if (t.reference && t.reference.length > 5) score += 10;
  if (t.recipient && t.recipient !== 'Unknown' && t.recipient.length > 3) score += 5;
  if (t.description && t.description.length > 20) score += 5;
  if (t.type && (t.type === 'Credit' || t.type === 'Debit')) score += 5;
  return score;
}

/**
 * Check if two recipient names likely refer to the same person
 */
function areRecipientsMatching(r1, r2) {
  if (!r1 || !r2) return false;
  const clean1 = r1.toLowerCase().replace(/[^a-z]/g, '');
  const clean2 = r2.toLowerCase().replace(/[^a-z]/g, '');
  if (clean1 === clean2) return true;
  if (clean1.length > 3 && clean2.length > 3) {
    // Check if one contains the other (partial match)
    return clean1.includes(clean2.substring(0, 5)) || clean2.includes(clean1.substring(0, 5));
  }
  return false;
}

/**
 * Validate and repair transactions after chunk merging
 * Catches issues from chunk boundary problems
 */
function validateAndRepairTransactions(transactions) {
  if (!transactions || transactions.length === 0) return [];
  
  const valid = [];
  const invalid = [];
  
  for (const t of transactions) {
    const issues = [];
    
    // Rule 1: Must have valid date
    if (!t.date || !isValidDateFormat(t.date)) {
      issues.push('invalid_date');
    }
    
    // Rule 2: Must have positive amount
    if (!t.amount || t.amount <= 0 || isNaN(t.amount)) {
      issues.push('invalid_amount');
    }
    
    // Rule 3: Amount should not equal balance (common parsing mistake)
    if (t.amount && t.balance && Math.abs(t.amount - t.balance) < 0.01 && t.amount > 1000) {
      // Amount equals balance - likely parsed the balance as amount
      issues.push('amount_equals_balance');
    }
    
    // Rule 4: Check for unreasonable amounts (outliers)
    if (t.amount > 10000000) { // More than 1 crore - likely parsing error
      issues.push('unreasonable_amount');
    }
    
    // Rule 5: Type must be valid
    if (!t.type || (t.type !== 'Credit' && t.type !== 'Debit')) {
      issues.push('invalid_type');
      t.type = 'Debit'; // Default to debit
    }
    
    // Rule 6: Reference should not be an IFSC code
    if (t.reference && /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(t.reference)) {
      // This is an IFSC code, not a transaction reference
      t.reference = '';
    }
    
    // If only minor issues, try to repair
    if (issues.length === 0 || 
        (issues.length === 1 && (issues[0] === 'invalid_type' || issues[0] === 'amount_equals_balance'))) {
      
      // Repair: If amount equals balance, try to detect actual amount from description
      if (issues.includes('amount_equals_balance')) {
        // In most cases this is because the parser confused columns
        // Keep transaction but log a warning
        console.log(`    [WARN] Transaction ${t.date} - amount equals balance (₹${t.amount}), may need review`);
      }
      
      valid.push(t);
    } else {
      invalid.push({ transaction: t, issues });
    }
  }
  
  if (invalid.length > 0) {
    console.log(`    [WARN] Rejected ${invalid.length} invalid transactions:`);
    for (const item of invalid.slice(0, 5)) {
      console.log(`      - ${item.transaction.date || 'no-date'}: ${item.issues.join(', ')}`);
    }
    if (invalid.length > 5) {
      console.log(`      ... and ${invalid.length - 5} more`);
    }
  }
  
  return valid;
}

/**
 * Check if date is in valid YYYY-MM-DD format
 */
function isValidDateFormat(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);
  
  // Basic validation
  if (year < 2000 || year > 2030) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  // Check if date is actually valid
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Correct types using pre-parsed type map
 */
function correctTypesFromRawParsing(transactions, typeMap) {
  if (typeMap.size === 0) return transactions;
  
  let corrected = 0;
  for (const t of transactions) {
    if (!t.balance || t.balance <= 0) continue;
    
    const key = `${t.amount.toFixed(2)}_${t.balance.toFixed(2)}`;
    const mapped = typeMap.get(key);
    
    if (mapped && mapped.type !== t.type) {
      console.log(`    [RAW] ${t.date} ₹${t.amount}: ${t.type} → ${mapped.type}`);
      t.type = mapped.type;
      corrected++;
    }
  }
  
  if (corrected > 0) {
    console.log(`    Corrected ${corrected} types from raw text`);
  }
  return transactions;
}

/**
 * Correct types using balance changes
 */
function correctTypesByBalance(transactions) {
  if (transactions.length === 0) return transactions;
  
  const hasBalance = transactions.some(t => t.balance !== undefined);
  if (!hasBalance) return transactions;
  
  let corrected = 0;
  let prevBalance = null;
  
  for (const t of transactions) {
    if (t.balance === undefined || t.balance === null) continue;
    
    if (prevBalance !== null) {
      const balanceChange = t.balance - prevBalance;
      const expectedType = balanceChange > 0 ? 'Credit' : 'Debit';
      const changeMagnitude = Math.abs(balanceChange);
      
      if (Math.abs(changeMagnitude - t.amount) < 0.01) {
        if (t.type !== expectedType) {
          console.log(`    [BAL] ${t.date} ₹${t.amount}: ${t.type} → ${expectedType}`);
          t.type = expectedType;
          corrected++;
        }
      }
    }
    prevBalance = t.balance;
  }
  
  if (corrected > 0) {
    console.log(`    Corrected ${corrected} types using balance`);
  }
  return transactions;
}

/**
 * Parse AI response with robust truncated JSON recovery and validation
 */
function parseAIResponse(responseText) {
  if (!responseText || typeof responseText !== 'string') return null;
  
  try {
    // Remove markdown code blocks and extra whitespace
    let cleaned = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .replace(/^\s*JSON\s*ARRAY:\s*/i, '')
      .trim();
    
    // Find JSON array boundaries
    const start = cleaned.indexOf('[');
    if (start === -1) {
      console.log('    [PARSE] No JSON array found in response');
      return null;
    }
    
    let end = cleaned.lastIndexOf(']');
    let jsonStr;
    
    // If closing bracket exists, try normal parsing first
    if (end > start) {
      jsonStr = cleaned.substring(start, end + 1);
      
      // Clean common issues before parsing
      jsonStr = cleanJsonString(jsonStr);
      
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validated = validateAndFilterTransactions(parsed);
          if (validated.length > 0) {
            return validated;
          }
        }
      } catch (e) {
        console.log(`    [PARSE] Standard parse failed: ${e.message}`);
      }
    }
    
    // TRUNCATED JSON RECOVERY: Model hit token limit mid-output
    console.log('    [RECOVERY] Attempting truncated JSON recovery...');
    
    let truncatedStr = cleaned.substring(start);
    const lastBrace = truncatedStr.lastIndexOf('}');
    
    if (lastBrace > 0) {
      // Find the last complete object
      truncatedStr = truncatedStr.substring(0, lastBrace + 1);
      
      // Remove any trailing incomplete object
      const lastCompletePair = truncatedStr.lastIndexOf('},');
      if (lastCompletePair > 0) {
        const afterPair = truncatedStr.substring(lastCompletePair + 2).trim();
        if (afterPair.startsWith('{') && !afterPair.includes('}')) {
          truncatedStr = truncatedStr.substring(0, lastCompletePair + 1);
        }
      }
      
      // Ensure we end with a complete object
      if (!truncatedStr.endsWith('}')) {
        const lastBracePos = truncatedStr.lastIndexOf('}');
        if (lastBracePos > 0) {
          truncatedStr = truncatedStr.substring(0, lastBracePos + 1);
        }
      }
      
      // Add closing bracket
      jsonStr = truncatedStr + ']';
      jsonStr = cleanJsonString(jsonStr);
      
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validated = validateAndFilterTransactions(parsed);
          console.log(`    [RECOVERY] Recovered ${validated.length} transactions`);
          return validated;
        }
      } catch (e) {
        console.log(`    [RECOVERY] Failed: ${e.message}`);
      }
    }
    
    return null;
  } catch (err) {
    console.log(`    [PARSE] Exception: ${err.message}`);
    return null;
  }
}

/**
 * Clean JSON string to fix common LLM formatting issues
 */
function cleanJsonString(jsonStr) {
  return jsonStr
    .replace(/,\s*]/g, ']')           // Remove trailing commas
    .replace(/,\s*,/g, ',')           // Remove double commas
    .replace(/\n\s*\n/g, '\n')        // Remove blank lines
    .replace(/'/g, '"')               // Single to double quotes
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')  // Unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"')        // Single-quoted values
    .replace(/:\s*undefined/g, ': null')        // undefined to null
    .replace(/,\s*}/g, '}');          // Remove trailing comma in objects
}

/**
 * Validate and filter transactions - remove invalid entries
 */
function validateAndFilterTransactions(transactions) {
  return transactions.filter(t => {
    // Must have date
    if (!t.date) return false;
    
    // Must have amount (non-zero)
    const amount = parseAmount(t.amount);
    if (amount <= 0) return false;
    
    // Must have valid type
    const type = String(t.type || '').toLowerCase();
    if (type !== 'credit' && type !== 'debit') {
      // Try to infer from other fields, default to debit
      t.type = 'debit';
    }
    
    return true;
  });
}

/**
 * Categorize transaction - Returns required lowercase categories
 * Valid categories: food, fuel, groceries, travel, bills, taxes, private
 */
function categorize(recipient, description) {
  const text = `${recipient} ${description}`.toLowerCase();
  
  // Food keywords
  if (/swiggy|zomato|restaurant|food|pizza|cafe|dominos|mcdonalds|kfc|burger|biryani|kitchen|dhaba|hotel|bakery/.test(text)) {
    return 'food';
  }
  
  // Fuel keywords  
  if (/petrol|diesel|fuel|hp\s*pump|bpcl|iocl|indian\s*oil|shell|cng|petroleum|filling/.test(text)) {
    return 'fuel';
  }
  
  // Groceries keywords
  if (/grocery|groceries|supermarket|bigbasket|blinkit|dmart|zepto|instamart|vegetables|kirana|provisions?|fresh/.test(text)) {
    return 'groceries';
  }
  
  // Travel keywords
  if (/uber|ola|rapido|cab|taxi|flight|airline|train|irctc|bus|metro|makemytrip|goibibo|oyo|booking/.test(text)) {
    return 'travel';
  }
  
  // Bills keywords
  if (/electricity|electric|power|water|gas|recharge|airtel|jio|vodafone|broadband|wifi|insurance|premium|lic|rent|emi|loan|maintenance|bill/.test(text)) {
    return 'bills';
  }
  
  // Taxes keywords
  if (/tax|gst|income\s*tax|tds|govt|government|municipal|challan|stamp\s*duty/.test(text)) {
    return 'taxes';
  }
  
  return 'private';
}

/**
 * Print summary
 */
function printFinalSummary(totalChunks, processed, failed, transactions) {
  const credits = transactions.filter(t => t.type === 'Credit');
  const debits = transactions.filter(t => t.type === 'Debit');
  const totalCredit = credits.reduce((sum, t) => sum + t.amount, 0);
  const totalDebit = debits.reduce((sum, t) => sum + t.amount, 0);
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`               EXTRACTION COMPLETE`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Chunks: ${processed}/${totalChunks} processed (${failed} failed)`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`TOTAL TRANSACTIONS: ${transactions.length}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`Credits: ${credits.length} transactions`);
  console.log(`         Amount: ₹${totalCredit.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`Debits:  ${debits.length} transactions`);
  console.log(`         Amount: ₹${totalDebit.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`NET FLOW: ₹${(totalCredit - totalDebit).toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
  console.log(`${'═'.repeat(60)}\n`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get AI status
 */
async function getAIStatus() {
  const isEnabled = await isAIAvailable();
  const provider = getCurrentProvider();
  const hasGroq = GROQ_API_KEY && GROQ_API_KEY.startsWith('gsk_');
  const hasOpenRouter = OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 10;
  
  let providerName = 'None';
  let model = 'N/A';
  let message = 'AI parsing disabled - Set GROQ_API_KEY or OPENROUTER_API_KEY in .env (or GEMINI_API_KEY for vision parsing)';
  
  if (isEnabled) {
    if (provider === 'groq') {
      providerName = hasOpenRouter ? 'Groq (+ OpenRouter fallback)' : 'Groq';
      model = GROQ_MODEL;
    } else {
      providerName = 'OpenRouter';
      model = OPENROUTER_MODEL;
    }
    message = `AI enabled - ${providerName} (${model})`;
  }
  
  return { aiEnabled: isEnabled, provider: providerName, model, message };
}

module.exports = { parseWithAI, isAIAvailable, getAIStatus };
