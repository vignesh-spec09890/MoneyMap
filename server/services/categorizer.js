/**
 * Categorizer Service
 * Rules-based transaction categorization
 * OUTPUT CATEGORIES: food, fuel, groceries, travel, bills, taxes, others
 */

// Category definitions with keywords and patterns
// Internal categories are mapped to output categories at the end
const CATEGORIES = {
  food: {
    keywords: [
      'swiggy', 'zomato', 'dominos', 'pizza', 'mcdonalds', 'mcdonald',
      'burger', 'kfc', 'subway', 'starbucks', 'cafe', 'restaurant',
      'food', 'eat', 'dine', 'dinner', 'lunch', 'breakfast', 'biryani',
      'chicken', 'kitchen', 'dhaba', 'canteen', 'mess', 'tiffin',
      'ubereats', 'foodpanda', 'dunkin', 'baskin', 'haldiram',
      'barbeque', 'bbq', 'hotel', 'bakery', 'sweet', 'mithai'
    ],
    patterns: [
      /food\s*order/i,
      /restaurant|cafe|canteen/i,
      /swiggy|zomato/i
    ]
  },
  
  fuel: {
    keywords: [
      'petrol', 'diesel', 'fuel', 'hp', 'bpcl', 'iocl', 'indian oil',
      'bharat petroleum', 'hindustan petroleum', 'shell', 'cng',
      'gas station', 'filling station', 'pump', 'reliance petro',
      'essar', 'nayara'
    ],
    patterns: [
      /petrol|diesel|fuel/i,
      /hp\s*pump|bpcl|iocl/i,
      /petroleum/i
    ]
  },
  
  groceries: {
    keywords: [
      'grocery', 'groceries', 'supermarket', 'bigbasket', 'big basket',
      'grofers', 'blinkit', 'jiomart', 'dmart', 'd-mart', 'reliance fresh',
      'reliance smart', 'spencer', 'spar', 'nature basket', 'amazon fresh',
      'vegetables', 'fruits', 'milk', 'dairy', 'bread', 'rice',
      'atta flour', 'wheat flour', 'kirana', 'provision', 'zepto', 'instamart',
      'dunzo', 'swiggy instamart', 'lulu hypermarket', 'more supermarket',
      'big bazaar', 'hypercity', 'star bazaar', 'foodhall', 'easyday'
    ],
    patterns: [
      /bigbasket|blinkit|zepto|grofers/i,
      /dmart|d-mart|reliance\s*fresh|reliance\s*smart/i,
      /grocery|supermarket|hypermarket/i,
      /kirana|provision\s*store/i,
      /swiggy\s*instamart|amazon\s*fresh/i
    ]
  },
  
  travel: {
    keywords: [
      'uber', 'ola', 'rapido', 'cab', 'taxi', 'auto', 'rickshaw',
      'flight', 'airline', 'airways', 'indigo', 'spicejet', 'air india',
      'vistara', 'goair', 'airasia', 'train', 'railway', 'irctc',
      'bus', 'redbus', 'abhibus', 'metro', 'booking', 'makemytrip',
      'goibibo', 'yatra', 'cleartrip', 'expedia', 'hotel booking',
      'oyo', 'treebo', 'fabhotel', 'airbnb', 'mmt', 'easemytrip'
    ],
    patterns: [
      /uber|ola|rapido|cab/i,
      /flight|airline|train|bus/i,
      /travel|booking|trip/i,
      /irctc|railway/i
    ]
  },
  
  bills: {
    keywords: [
      'electricity', 'electric', 'power', 'bescom', 'tata power',
      'adani electricity', 'reliance energy', 'water bill', 'piped gas',
      'airtel bill', 'jio bill', 'vodafone bill', 'vi bill', 'bsnl bill',
      'broadband', 'act fibernet', 'hathway',
      'dth', 'tatasky', 'dish tv', 'airtel dth', 'sun direct',
      'insurance', 'premium', 'lic', 'hdfc life', 'icici prudential',
      'rent payment', 'maintenance', 'society', 'housing', 'apartment',
      'emi', 'loan', 'interest', 'credit card', 'cc payment',
      'utility', 'bill payment', 'recharge'
    ],
    patterns: [
      /electricity|bescom|tata\s*power|adani\s*electric/i,
      /water\s*bill|gas\s*bill|piped\s*gas/i,
      /broadband|act\s*fibernet|hathway/i,
      /dth|tatasky|dish\s*tv/i,
      /insurance\s*premium|lic\s*premium/i,
      /emi\s*pay|loan\s*emi|credit\s*card\s*pay/i,
      /rent\s*pay|maintenance\s*fee/i
    ]
  },
  
  taxes: {
    keywords: [
      'tax', 'gst', 'income tax', 'tds', 'advance tax', 'self assessment',
      'property tax', 'municipal', 'corporation', 'govt', 'government',
      'challan', 'nsdl', 'tin', 'professional tax', 'stamp duty',
      'registration', 'road tax', 'vehicle tax'
    ],
    patterns: [
      /tax|gst|tds/i,
      /govt|government|municipal/i,
      /challan|nsdl/i
    ]
  },
  
  // These internal categories will be mapped to 'private'
  shopping: {
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho',
      'snapdeal', 'shopclues', 'jabong', 'tatacliq', 'firstcry',
      'retail', 'store', 'mall', 'shopping', 'fashion', 'clothes',
      'electronics', 'mobile', 'phone', 'laptop', 'appliance',
      'furniture', 'ikea', 'pepperfry', 'urban ladder', 'decor',
      'lifestyle', 'shopper stop', 'westside', 'pantaloons',
      'reliance digital', 'croma', 'vijay sales'
    ],
    patterns: [
      /amazon|flipkart|myntra/i,
      /shopping|retail|store/i,
      /fashion|clothes|electronics/i
    ]
  },
  
  entertainment: {
    keywords: [
      'netflix', 'prime video', 'hotstar', 'disney', 'zee5', 'sonyliv',
      'spotify', 'gaana', 'wynk', 'apple music', 'youtube', 'music',
      'movie', 'cinema', 'pvr', 'inox', 'bookmyshow', 'ticket',
      'gaming', 'game', 'playstation', 'xbox', 'steam', 'pubg',
      'concert', 'event', 'show', 'theatre', 'amusement', 'park'
    ],
    patterns: [
      /netflix|hotstar|prime|spotify/i,
      /movie|cinema|theatre/i,
      /gaming|entertainment/i
    ]
  },
  
  healthcare: {
    keywords: [
      'hospital', 'clinic', 'doctor', 'medical', 'medicine', 'pharmacy',
      'pharma', 'apollo', 'medplus', 'netmeds', 'pharmeasy', '1mg',
      'healthcare', 'health', 'diagnostic', 'lab', 'test', 'pathology',
      'dental', 'dentist', 'eye', 'optical', 'lenskart', 'dr ', 'dr.'
    ],
    patterns: [
      /hospital|clinic|medical/i,
      /pharmacy|pharma|medicine/i,
      /doctor|healthcare|diagnostic/i
    ]
  },
  
  education: {
    keywords: [
      'school', 'college', 'university', 'tuition', 'coaching',
      'course', 'class', 'training', 'institute', 'academy',
      'udemy', 'coursera', 'byjus', 'unacademy', 'upgrad',
      'book', 'stationery', 'education', 'fees', 'exam'
    ],
    patterns: [
      /school|college|university/i,
      /education|tuition|coaching/i,
      /course|training|academy/i
    ]
  },
  
  transfer: {
    keywords: [
      'transfer', 'self transfer', 'own account', 'fund transfer',
      'neft', 'rtgs', 'imps', 'upi', 'bank transfer'
    ],
    patterns: [
      /self\s*transfer|own\s*account/i,
      /fund\s*transfer/i
    ]
  },
  
  salary: {
    keywords: [
      'salary', 'income', 'wages', 'payroll', 'bonus', 'incentive',
      'commission', 'consulting fee', 'freelance', 'payment received'
    ],
    patterns: [
      /salary|wages|payroll/i,
      /bonus|incentive/i
    ]
  },
  
  investment: {
    keywords: [
      'investment', 'mutual fund', 'mf', 'sip', 'stock', 'share',
      'demat', 'zerodha', 'groww', 'upstox', 'paytm money', 'kuvera',
      'fd', 'fixed deposit', 'rd', 'recurring deposit', 'ppf', 'nps',
      'gold', 'bond', 'ipo', 'smallcase'
    ],
    patterns: [
      /investment|mutual\s*fund|sip/i,
      /stock|share|demat/i,
      /zerodha|groww|upstox/i
    ]
  },
  
  atm: {
    keywords: [
      'atm', 'cash withdrawal', 'cash', 'withdraw', 'withdrawal'
    ],
    patterns: [
      /atm|cash\s*withdraw/i
    ]
  }
};

// Map internal categories to required output format
// Required: food, fuel, groceries, travel, bills, taxes, others
const CATEGORY_OUTPUT_MAP = {
  'food': 'food',
  'fuel': 'fuel',
  'groceries': 'groceries',
  'travel': 'travel',
  'bills': 'bills',
  'taxes': 'taxes',
  'shopping': 'private',
  'entertainment': 'private',
  'healthcare': 'private',
  'education': 'private',
  'transfer': 'private',
  'salary': 'private',
  'investment': 'private',
  'atm': 'private',
  'others': 'private'
};

/**
 * Categorize a single transaction
 * @param {Object} transaction - Transaction object
 * @returns {string} - Category name (lowercase: food, fuel, groceries, travel, bills, taxes, others)
 */
function categorize(transaction) {
  const searchText = [
    transaction.description || '',
    transaction.recipient || '',
    transaction.rawLine || ''
  ].join(' ').toLowerCase();
  
  // Score each category
  const scores = {};
  
  for (const [category, rules] of Object.entries(CATEGORIES)) {
    scores[category] = 0;
    
    // Check keywords (word-boundary match to avoid substring false positives)
    for (const keyword of rules.keywords) {
      const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      if (re.test(searchText)) {
        scores[category] += 10;
      }
    }
    
    // Check patterns
    for (const pattern of rules.patterns) {
      if (pattern.test(searchText)) {
        scores[category] += 15;
      }
    }
  }
  
  // Find highest scoring category
  let bestCategory = 'private';
  let bestScore = 0;
  
  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }
  
  // Map to output category format
  return CATEGORY_OUTPUT_MAP[bestCategory] || 'private';
}

/**
 * Categorize all transactions
 * @param {Array<Object>} transactions - Array of transaction objects
 * @returns {Array<Object>} - Transactions with category added
 */
function categorizeAll(transactions) {
  return transactions.map(transaction => ({
    ...transaction,
    category: categorize(transaction)
  }));
}

/**
 * Get category list - returns valid output categories
 * @returns {Array<string>} - List of valid output category names
 */
function getCategoryList() {
  return ['food', 'fuel', 'groceries', 'travel', 'bills', 'taxes', 'private'];
}

/**
 * Add custom category rule
 * @param {string} category - Category name (lowercase)
 * @param {Array<string>} keywords - New keywords to add
 */
function addKeywords(category, keywords) {
  const lowerCategory = category.toLowerCase();
  if (CATEGORIES[lowerCategory]) {
    CATEGORIES[lowerCategory].keywords.push(...keywords.map(k => k.toLowerCase()));
  }
}

/**
 * Get keywords for a category
 * @param {string} category - Category name
 * @returns {Array<string>} - Keywords
 */
function getKeywords(category) {
  const lowerCategory = category.toLowerCase();
  return CATEGORIES[lowerCategory]?.keywords || [];
}

module.exports = {
  categorize,
  categorizeAll,
  getCategoryList,
  addKeywords,
  getKeywords,
  CATEGORIES,
  CATEGORY_OUTPUT_MAP
};
