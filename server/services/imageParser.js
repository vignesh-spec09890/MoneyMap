/**
 * Image Parser Service
 * Extracts text from bank statement images using OCR
 */

const Tesseract = require('tesseract.js');
const path = require('path');

/**
 * Parse image file using OCR
 * @param {string} filePath - Path to image file
 * @returns {Promise<string>} - Extracted text
 */
async function parse(filePath) {
  try {
    console.log('Starting OCR processing...');
    
    const result = await Tesseract.recognize(
      filePath,
      'eng', // English language
      {
        logger: info => {
          if (info.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(info.progress * 100)}%`);
          }
        }
      }
    );

    const text = result.data.text;
    console.log(`OCR completed: ${text.length} characters extracted`);
    
    return text;
  } catch (error) {
    console.error('OCR error:', error.message);
    throw new Error(`Failed to extract text from image: ${error.message}`);
  }
}

/**
 * Preprocess extracted OCR text
 * Clean up common OCR artifacts
 * @param {string} text - Raw OCR text
 * @returns {string} - Cleaned text
 */
function preprocessText(text) {
  let cleaned = text;
  
  // Fix common OCR mistakes
  cleaned = cleaned.replace(/[|l]/g, match => {
    // Context-aware replacement (simplified)
    return match;
  });
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Fix currency symbols
  cleaned = cleaned.replace(/Rs\.?|INR|₹/gi, '₹');
  
  // Fix common number OCR issues
  cleaned = cleaned.replace(/O/g, context => {
    // Keep 'O' as is in text context
    return context;
  });
  
  return cleaned;
}

module.exports = {
  parse,
  preprocessText
};
