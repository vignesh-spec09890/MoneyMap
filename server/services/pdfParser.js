/**
 * PDF Parser Service
 * Extracts raw text from PDF bank statements for AI parsing
 */

const pdfParse = require('pdf-parse');
const fs = require('fs');

/**
 * Parse PDF file and extract text
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} - Raw extracted text
 */
async function parse(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    
    const data = await pdfParse(dataBuffer);
    
    console.log(`PDF parsed: ${data.numpages} pages, ${data.text.length} characters`);
    
    // Preserve column layout for AI parsing - do NOT collapse whitespace
    // Bank PDFs use column positions to separate Debit/Credit/Balance
    const text = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '    ')  // Convert tabs to 4 spaces (preserve columns)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return text;
  } catch (error) {
    console.error('PDF parsing error:', error.message);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

module.exports = { parse };
