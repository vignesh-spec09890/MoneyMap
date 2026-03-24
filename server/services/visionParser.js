/**
 * Vision-Based Bank Statement Parser
 * Pipeline: PDF → page images → Qwen2.5-VL via HuggingFace Inference → transactions
 *
 * Uses Qwen/Qwen2.5-VL-7B-Instruct via @huggingface/inference SDK.
 * DeepSeek-OCR-2 has no inference provider on HF, so we use Qwen2.5-VL
 * which correctly reads bank statement tables through the HF API.
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────
const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_API_KEY || '';
const HF_MODEL = 'Qwen/Qwen2.5-VL-7B-Instruct';

const MAX_TOKENS = 8192;
const DELAY_BETWEEN_PAGES = 1500;   // 1.5s between pages
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;           // 5s on error/rate-limit
const MAX_CONSECUTIVE_ERRORS = 5;   // Stop after 5 consecutive failures

// ─── Debug ───────────────────────────────────────────────────────────────────
const DEBUG_MODE = true;
const DEBUG_DIR = path.join(__dirname, '..', 'debug');

function saveDebugFile(filename, content) {
  if (!DEBUG_MODE) return;
  try {
    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
    fs.writeFileSync(path.join(DEBUG_DIR, filename), data);
  } catch (err) {}
}

// ─── Lazy-loaded HF client ──────────────────────────────────────────────────
let _hfClient = null;

async function getHFClient() {
  if (_hfClient) return _hfClient;
  const { InferenceClient } = await import('@huggingface/inference');
  _hfClient = new InferenceClient(HF_TOKEN);
  return _hfClient;
}

// ─── Availability ────────────────────────────────────────────────────────────

function isVisionAvailable() {
  const token = HF_TOKEN;
  return token && token.length > 5 && token.startsWith('hf_');
}

function getActiveProvider() {
  return { name: 'HuggingFace Qwen2.5-VL', model: HF_MODEL };
}

function getVisionStatus() {
  return {
    available: isVisionAvailable(),
    model: HF_MODEL,
    provider: 'HuggingFace Qwen2.5-VL'
  };
}

// ─── Text-Based Extraction (Primary – fast & accurate) ──────────────────────

/**
 * Extract transactions directly from PDF text using regex.
 * Works for IDBI (and similar Indian bank) statements where pdf-parse
 * returns readable text with consistent column patterns:
 *   DEBIT  line: INR {debit_amount} -INR {balance}
 *   CREDIT line:  -INR {credit_amount}INR {balance}
 */
async function extractFromText(pdfPath) {
  const pdfParse = require('pdf-parse');
  const buf = fs.readFileSync(pdfPath);
  const data = await pdfParse(buf);
  const rawText = data.text;

  saveDebugFile('raw_pdf_text.txt', rawText);
  console.log(`  Text extraction: ${data.numpages} pages, ${rawText.length} chars`);

  // Remove repeated page headers
  const text = rawText.replace(/DateTransaction DetailsDebitsCreditsBalance/g, '\n');

  // Split into transaction blocks by date pattern
  const DATE_RE = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/gi;

  // Collect all date matches with positions
  const dateMatches = [];
  let dm;
  while ((dm = DATE_RE.exec(text)) !== null) {
    dateMatches.push({ date: dm[1], index: dm.index });
  }

  if (dateMatches.length === 0) {
    console.log('  No date patterns found in text');
    return [];
  }

  const transactions = [];

  for (let i = 0; i < dateMatches.length; i++) {
    const start = dateMatches[i].index + dateMatches[i].date.length;
    const end = i + 1 < dateMatches.length ? dateMatches[i + 1].index : text.length;
    const block = text.substring(start, end).trim();

    // Skip summary/total/header rows
    if (/^(Opening|Closing|Ending)\s*Balance/i.test(block)) continue;
    if (/^Total\s*INR/i.test(block)) continue;
    if (/Account\s*(Details|Holder|Type|Number|Currency|Summary)/i.test(block)) continue;
    if (/^For\s*period/i.test(block)) continue;
    if (/^CREDIT INTEREST\b/i.test(block) === false && block.length < 10) continue;

    const dateStr = dateMatches[i].date;

    // Determine debit vs credit from amount patterns in the block
    // CREDIT pattern: " -INR {amount}INR {balance}" (dash marks empty Debit cell)
    // DEBIT pattern:  "INR {amount} -INR {balance}" (dash marks empty Credit cell)
    const creditMatch = block.match(/\s-INR\s*([\d,]+\.\d{2})INR\s*([\d,]+\.\d{2})/);
    const debitMatch = block.match(/INR\s*([\d,]+\.\d{2})\s+-INR\s*([\d,]+\.\d{2})/);

    let amount = 0;
    let type = 'Debit';

    if (creditMatch && !debitMatch) {
      amount = parseFloat(creditMatch[1].replace(/,/g, ''));
      type = 'Credit';
    } else if (debitMatch && !creditMatch) {
      amount = parseFloat(debitMatch[1].replace(/,/g, ''));
      type = 'Debit';
    } else if (creditMatch && debitMatch) {
      // Both matched — use the one that appears later (closer to end of block = amount line)
      if (block.lastIndexOf(creditMatch[0]) > block.lastIndexOf(debitMatch[0])) {
        amount = parseFloat(creditMatch[1].replace(/,/g, ''));
        type = 'Credit';
      } else {
        amount = parseFloat(debitMatch[1].replace(/,/g, ''));
        type = 'Debit';
      }
    } else {
      // Try simpler pattern: just grab any INR amount
      const simpleMatch = block.match(/INR\s*([\d,]+\.\d{2})/);
      if (simpleMatch) {
        amount = parseFloat(simpleMatch[1].replace(/,/g, ''));
      }
    }

    if (amount <= 0) continue;

    // Extract UPI reference (12-digit number after /UPI/)
    let utr = '';
    const upiMatch = block.match(/\/UPI\/(\d{9,15})/);
    if (upiMatch) {
      utr = upiMatch[1];
    }

    // Extract recipient: name after first IFSC code + slash
    let recipient = 'Unknown';
    // Pattern: IFSC/NAME or IFSC/Name Name
    const recipientMatch = block.match(/[A-Z]{4}[A-Z0-9]{7}\/([\w\s.'-]+?)(?:\/|$)/);
    if (recipientMatch) {
      recipient = recipientMatch[1].trim();
    }
    // Handle CREDIT INTEREST and similar non-UPI entries
    if (recipient === 'Unknown') {
      let firstLine = block.split('\n')[0].trim();
      // Remove amount patterns and everything after them
      firstLine = firstLine.replace(/\s*[-]?INR\s*[\d,]+\.?\d*.*$/i, '').trim();
      firstLine = firstLine.replace(/\/.*$/, '').trim();
      // Remove numeric-only prefixes like "00000000000098058"
      firstLine = firstLine.replace(/^\d{5,}\/?/, '').trim();
      if (firstLine && firstLine.length > 2 && firstLine.length < 100) {
        recipient = firstLine;
      }
    }

    // Clean recipient
    recipient = recipient
      .replace(/\s+/g, ' ')
      .trim();
    // Clean up known patterns
    if (/SMS.?CHGS|SERVICE\s*CHARGES/i.test(recipient + ' ' + block)) {
      recipient = 'Service Charges';
    } else if (/CREDIT\s*INTEREST/i.test(recipient)) {
      recipient = 'Credit Interest';
    } else {
      // Titlecase names
      recipient = recipient
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    if (!recipient) recipient = 'Unknown';

    // Normalize date
    const date = normalizeDate(dateStr);
    if (!date) continue;

    // Categorize
    const category = inferCategory(recipient + ' ' + block);

    transactions.push({
      date,
      utr,
      recipient,
      amount,
      type,
      category,
      needs_review: false,
      reference: utr,
      description: recipient
    });
  }

  return transactions;
}

// ─── PDF to Images ───────────────────────────────────────────────────────────

async function pdfToImages(pdfPath) {
  const { pdf } = await import('pdf-to-img');
  const images = [];
  let pageNum = 0;

  console.log(`  Converting PDF to images (scale 3.0)...`);
  const document = await pdf(pdfPath, { scale: 3.0 });

  for await (const image of document) {
    pageNum++;
    const base64 = image.toString('base64');
    images.push({ page: pageNum, base64, mimeType: 'image/png' });

    if (DEBUG_MODE) {
      fs.writeFileSync(path.join(DEBUG_DIR, `page_${pageNum}.png`), image);
    }
    console.log(`    Page ${pageNum} converted (${Math.round(base64.length / 1024)} KB)`);
  }

  console.log(`  Total: ${pageNum} pages`);
  return images;
}

// ─── OCR Prompt ──────────────────────────────────────────────────────────────

function buildSystemMessage() {
  return `You are a precise OCR data-extraction assistant. Your job is to read bank statement images exactly as printed and output structured JSON. Never guess or infer values — only output what you can clearly read from the image. Pay close attention to which column each number appears in.`;
}

function buildOCRPrompt(pageNum, totalPages) {
  return `This is page ${pageNum} of ${totalPages} of an Indian bank (IDBI Bank) account statement image.

TABLE LAYOUT — The table has exactly 5 columns:
| Date | Transaction Details | Debits | Credits | Balance |

CRITICAL — How to determine DEBIT vs CREDIT:
- The "Debits" column and "Credits" column are SEPARATE columns.
- If an INR amount appears under the "Debits" column → it is MONEY SPENT → output NEGATIVE amount.
- If an INR amount appears under the "Credits" column → it is MONEY RECEIVED → output POSITIVE amount.
- An empty cell in Debits or Credits may show a dash "-" or be blank.
- The rightmost "Balance" column shows the running balance — DO NOT use it as a transaction amount.

EXTRACT every transaction row into this JSON format. Return ONLY a raw JSON array, no markdown fences, no explanation:
[
  {
    "date": "YYYY-MM-DD",
    "utr": "12_digit_UPI_reference_number",
    "recipient": "payee name",
    "amount": -100.00,
    "category": "private"
  }
]

FIELD RULES:
1. DATE — Convert to YYYY-MM-DD. The statement uses "DD Mon YYYY" format (e.g. "01 Mar 2025" → "2025-03-01").
2. UTR — Extract only the numeric UPI/NEFT/IMPS reference number (usually 12 digits, e.g. "100080626318"). It appears after "/UPI/" in the transaction details. Output "" if not found.
3. RECIPIENT — The payee name that appears after the IFSC code and slash, e.g. "SBIN0020247/SHAIK MOSIN" → recipient is "SHAIK MOSIN". Clean up extra whitespace.
4. AMOUNT — Negative for debits, positive for credits. Remove "INR", "₹", commas. Read carefully which column the amount is in.
5. CATEGORY — Classify as one of: food, fuel, groceries, travel, bills, taxes, private.

SKIP: Opening/closing balance summary rows, page headers/footers, column headers.
If this page has no transaction rows, return [].`;
}

// ─── HuggingFace API Call ────────────────────────────────────────────────────

/**
 * Send a single page image to Qwen2.5-VL via HuggingFace SDK
 * Returns { transactions: [...], rateLimited: bool }
 */
async function extractFromPageImage(pageImage, totalPages) {
  const prompt = buildOCRPrompt(pageImage.page, totalPages);
  const client = await getHFClient();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`    [HF-VL] Page ${pageImage.page} attempt ${attempt}/${MAX_RETRIES}...`);

      const result = await client.chatCompletion({
        model: HF_MODEL,
        messages: [
          {
            role: 'system',
            content: buildSystemMessage()
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${pageImage.mimeType};base64,${pageImage.base64}`
                }
              },
              { type: 'text', text: prompt }
            ]
          }
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0
      });

      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        console.log(`    [HF-VL] Empty response`);
        saveDebugFile(`page_${pageImage.page}_hf_raw.json`, result);
        return { transactions: [], rateLimited: false };
      }

      saveDebugFile(`page_${pageImage.page}_hf_response.txt`, content);
      const transactions = parseOCRResponse(content);
      return { transactions, rateLimited: false };

    } catch (error) {
      const msg = error.message || '';
      console.log(`    [HF-VL] Attempt ${attempt} error: ${msg.substring(0, 150)}`);

      // Rate limit or model loading
      if (msg.includes('429') || msg.includes('503') || msg.includes('rate') || msg.includes('loading')) {
        if (attempt < MAX_RETRIES) {
          const wait = msg.includes('503') ? RETRY_DELAY * 3 : RETRY_DELAY;
          console.log(`    [HF-VL] Waiting ${wait / 1000}s...`);
          await sleep(wait);
          continue;
        }
        return { transactions: [], rateLimited: true };
      }

      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY);
    }
  }

  return { transactions: [], rateLimited: false };
}

// ─── Response Parsing ────────────────────────────────────────────────────────

function parseOCRResponse(responseText) {
  try {
    let cleaned = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      console.log(`    No JSON array found in response`);
      return [];
    }

    let jsonStr = cleaned.substring(start, end + 1);
    jsonStr = jsonStr
      .replace(/,\s*]/g, ']')
      .replace(/,\s*,/g, ',')
      .replace(/'/g, '"');

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(t => t && (t.date || t.amount))
      .map(t => normalizeTransaction(t));
  } catch (err) {
    console.log(`    JSON parse error: ${err.message}`);
    return [];
  }
}

// ─── Transaction Normalisation ───────────────────────────────────────────────

function normalizeTransaction(t) {
  const date = normalizeDate(t.date);

  let amount = 0;
  if (t.amount !== undefined && t.amount !== null) {
    const raw = typeof t.amount === 'string'
      ? t.amount.replace(/[₹$€£,\s]/g, '').replace(/INR/gi, '')
      : String(t.amount);
    amount = parseFloat(raw) || 0;
  }

  const validCats = ['food', 'fuel', 'groceries', 'travel', 'bills', 'taxes', 'private'];
  let category = (t.category || '').toLowerCase().trim();
  // Map legacy 'others' to 'private'
  if (category === 'others') category = 'private';
  if (!validCats.includes(category)) {
    category = inferCategory(t.recipient || t.utr || '');
  }

  const type = amount >= 0 ? 'Credit' : 'Debit';

  // Extract clean numeric UTR (12-digit UPI ref) from whatever the model returned
  let utr = cleanStr(t.utr || '');
  const utrNumericMatch = utr.match(/\d{9,15}/);
  if (utrNumericMatch) {
    utr = utrNumericMatch[0];
  }

  // Clean recipient: remove IFSC codes, account masks, UPI IDs
  let recipient = cleanStr(t.recipient || 'Unknown');
  // Remove trailing IFSC-like patterns if the model put them in the name
  recipient = recipient.replace(/\s*\/.*$/, '').trim();
  // Titlecase names
  recipient = recipient.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  if (!recipient) recipient = 'Unknown';

  return {
    date,
    utr,
    recipient,
    amount: Math.abs(amount),
    type,
    category,
    needs_review: false,
    reference: utr,
    description: recipient
  };
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;

  // DD/MM/YY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (m) {
    const yr = parseInt(m[3]) < 50 ? `20${m[3]}` : `19${m[3]}`;
    return `${yr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  // DD Mon YYYY
  const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
  m = s.match(/(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{4})/i);
  if (m) return `${m[3]}-${months[m[2].toLowerCase().substring(0,3)]}-${m[1].padStart(2,'0')}`;

  return '';
}

function inferCategory(text) {
  const l = (text || '').toLowerCase();
  if (/swiggy|zomato|food|restaurant|cafe|pizza|burger|dominos|kfc|mcdonalds|biryani/.test(l)) return 'food';
  if (/petrol|diesel|fuel|hp\b|bpcl|iocl|indian oil|shell/.test(l)) return 'fuel';
  if (/grocery|bigbasket|dmart|blinkit|zepto|supermarket|vegetables|kirana/.test(l)) return 'groceries';
  if (/uber|ola|rapido|flight|train|irctc|bus|metro|makemytrip|goibibo/.test(l)) return 'travel';
  if (/electricity|water|gas|phone|airtel|jio|vodafone|broadband|rent|emi|insurance|premium|lic/.test(l)) return 'bills';
  if (/tax|gst|income tax|tds|govt|government/.test(l)) return 'taxes';
  return 'private';
}

function cleanStr(s) {
  if (!s) return '';
  return String(s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Validation & Dedup ─────────────────────────────────────────────────────

function validateTransactions(transactions) {
  return transactions.filter(t => {
    if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return false;
    const yr = parseInt(t.date.substring(0, 4));
    if (yr < 2000 || yr > 2030) return false;
    if (!t.amount || t.amount <= 0) return false;
    if (t.amount > 10000000) return false;
    return true;
  });
}

function deduplicateTransactions(transactions) {
  const seen = new Map();
  for (const t of transactions) {
    // Include UTR in key so real transactions with same date/amount/recipient but different UTRs are preserved
    const utrPart = (t.utr || '').replace(/\D/g, '').slice(-12) || 'no-utr';
    const key = `${t.date}|${t.amount}|${t.type}|${(t.recipient || '').substring(0, 20).toLowerCase()}|${utrPart}`;
    if (!seen.has(key)) {
      seen.set(key, t);
    } else {
      const existing = seen.get(key);
      // Keep the one with more complete data
      if ((t.utr || '').length > (existing.utr || '').length) seen.set(key, t);
    }
  }
  return Array.from(seen.values());
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

async function parseWithVision(pdfPath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`   BANK STATEMENT PARSER (Hybrid: Text + Vision)`);
  console.log(`${'='.repeat(60)}`);

  // ── STEP 1: Try text-based extraction first (fast, free, accurate) ──
  console.log(`\n[STEP 1] Text-based extraction (pdf-parse)...`);

  let textTransactions = [];
  try {
    textTransactions = await extractFromText(pdfPath);
    console.log(`  Text extraction found: ${textTransactions.length} transactions`);

    if (textTransactions.length > 0) {
      // Validate text-extracted transactions
      const validated = validateTransactions(textTransactions);
      console.log(`  Validated: ${validated.length}`);

      if (validated.length >= 5) {
        // Text extraction succeeded — use it
        validated.sort((a, b) => new Date(a.date) - new Date(b.date));
        printSummary(0, 0, validated, false, 'TEXT');
        saveDebugFile('text_extraction_result.json', validated);
        return validated;
      }
      console.log(`  Text extraction yielded too few valid transactions, falling back to vision...`);
    } else {
      console.log(`  No transactions from text extraction (possibly scanned PDF), falling back to vision...`);
    }
  } catch (textErr) {
    console.log(`  Text extraction failed: ${textErr.message}`);
    console.log(`  Falling back to vision OCR...`);
  }

  // ── STEP 2: Vision OCR fallback ──
  if (!isVisionAvailable()) {
    if (textTransactions.length > 0) {
      // Return what text extraction found even if < 5
      const validated = validateTransactions(textTransactions);
      validated.sort((a, b) => new Date(a.date) - new Date(b.date));
      return validated;
    }
    throw new Error('OCR unavailable: Set HF_TOKEN (or HF_API_KEY) in server/.env');
  }

  const provider = getActiveProvider();
  console.log(`\n[STEP 2] Vision OCR fallback...`);
  console.log(`  Provider: ${provider.name}`);
  console.log(`  Model   : ${provider.model}`);

  console.log(`\n  Converting PDF to images...`);
  const pageImages = await pdfToImages(pdfPath);
  if (pageImages.length === 0) throw new Error('PDF produced zero images');

  console.log(`\n  Running vision OCR on ${pageImages.length} pages...`);

  const allTransactions = [];
  let consecutiveErrors = 0;
  let stoppedEarly = false;
  let pagesProcessed = 0;

  for (let i = 0; i < pageImages.length; i++) {
    const img = pageImages[i];
    console.log(`\n  Page ${img.page}/${pageImages.length}`);

    const result = await extractFromPageImage(img, pageImages.length);
    pagesProcessed++;

    if (result.rateLimited) {
      consecutiveErrors++;
      console.log(`    ⚠ Error/rate-limit (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`\n  ⛔ Stopping: ${MAX_CONSECUTIVE_ERRORS} consecutive failures.`);
        stoppedEarly = true;
        break;
      }
      await sleep(RETRY_DELAY * 2);
    } else if (result.transactions.length > 0) {
      consecutiveErrors = 0;
      allTransactions.push(...result.transactions);
      console.log(`    ✓ ${result.transactions.length} transactions (total: ${allTransactions.length})`);
    } else {
      consecutiveErrors = 0;
      console.log(`    ○ No transactions (header/summary page)`);
    }

    if (i < pageImages.length - 1 && !stoppedEarly) {
      await sleep(DELAY_BETWEEN_PAGES);
    }
  }

  // Step 3: Post-process vision results
  console.log(`\n[STEP 3] Post-processing ${allTransactions.length} raw transactions...`);

  const deduplicated = deduplicateTransactions(allTransactions);
  console.log(`  Deduplicated: ${deduplicated.length}`);

  const validated = validateTransactions(deduplicated);
  console.log(`  Validated   : ${validated.length}`);

  validated.sort((a, b) => new Date(a.date) - new Date(b.date));

  printSummary(pageImages.length, pagesProcessed, validated, stoppedEarly, 'VISION');
  saveDebugFile('vision_extraction_result.json', validated);

  return validated;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function printSummary(totalPages, pagesProcessed, transactions, stoppedEarly, method) {
  const credits = transactions.filter(t => t.type === 'Credit');
  const debits  = transactions.filter(t => t.type === 'Debit');
  const review  = transactions.filter(t => t.needs_review);
  const totalCr = credits.reduce((s, t) => s + t.amount, 0);
  const totalDr = debits.reduce((s, t) => s + t.amount, 0);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`           EXTRACTION COMPLETE (${method || 'VISION'})`);
  console.log(`${'═'.repeat(60)}`);
  if (totalPages > 0) {
    console.log(`Pages: ${pagesProcessed}/${totalPages}${stoppedEarly ? ' (stopped early)' : ''}`);
  }
  console.log(`Method: ${method || 'VISION'}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`TRANSACTIONS: ${transactions.length}`);
  console.log(`  Credits: ${credits.length}  (₹${totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`);
  console.log(`  Debits : ${debits.length}  (₹${totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`);
  if (review.length) console.log(`  ⚠ Needs review: ${review.length}`);
  console.log(`${'═'.repeat(60)}\n`);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  parseWithVision,
  isVisionAvailable,
  getVisionStatus,
  getActiveProvider,
  pdfToImages,
  extractFromPageImage
};
