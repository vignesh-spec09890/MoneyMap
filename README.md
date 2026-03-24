# 🗺️ MoneyMap: The Complete Project Manual

Welcome to the **MoneyMap** Project Manual. This document serves as a comprehensive guide to understanding, deploying, and extending the Bank Statement Insight Generator.

---

## 1. Project Vision
MoneyMap is designed to solve a common problem: bank statements are hard to read and analyze. By combining traditional parsing logic with modern AI Vision (OCR), MoneyMap transforms raw financial documents (PDF, Image, CSV) into a structured, visual dashboard that reveals spending habits and helps in financial planning.

---

## 2. Dynamic Architecture
The project follows a **Decoupled Client-Server Architecture**:

### 2.1 The Backend (Express.js)
The engine of the project. It handles:
- **Multi-pipeline Parsing**: Deciding whether to use regex, papaparse, or AI OCR based on the input.
- **Data Analytics**: A pure-logic engine that calculates averages, trends, and anomalies.
- **Persistence**: Managing JWT sessions and historical data in MongoDB Atlas.

### 2.2 The Frontend (React)
A "Glassmorphism" styled UI built for clarity:
- **Interactive Charts**: Responsive visualizations using Recharts.
- **State Management**: Using standard React hooks and Axios for real-time API interaction.
- **Security**: Protected routes that require a valid JWT token to access history.

---

## 3. Deep Dive: How the "Brains" Work

### 3.1 The Parsing Logic (`server/services/visionParser.js`)
This is the most complex part of the project. It uses a **Three-Tier Fallback System**:

1.  **Tier 1: Text Extraction (Regex)**
    - MoneyMap first tries to "read" the PDF as a text file.
    - It looks for known patterns like `INR 500.00 -INR 1400.00`.
    - If it detects a clear table structure with dates, it processes it instantly without using any AI tokens.
2.  **Tier 2: AI Vision OCR (Fallback)**
    - If the PDF is a "scanned image" or Ti-1 fails, it triggers the AI.
    - The PDF is converted to a series of high-resolution PNGs.
    - These images are sent to the **Qwen2.5-VL-7B** model via HuggingFace.
    - The AI acts as a "human eye," looking at the columns and returning a JSON array.
3.  **Tier 3: CSV Mapping**
    - For CSV files, it uses a flexible header-mapping system that recognizes over 30 different bank column name variants (e.g., "Narration" vs "Description").

### 3.2 Categorization Logic (`server/services/categorizer.js`)
Once transactions are extracted, they are passed to the Categorizer. It uses a **Keyword Weighted System**:
- It scans the description for matches (e.g., `ZOMATO` -> `food`).
- It prioritizes specific matches over general ones.
- **Categories supported:** `food`, `fuel`, `groceries`, `travel`, `bills`, `taxes`, and `private` (default).

### 3.3 Analytics Engine (`server/services/analytics.js`)
This service takes the raw array of transactions and runs multiple passes:
- **Trend Analysis**: Groups spending by day to create the line chart.
- **Anomaly Detection**: Calculates the standard deviation of your spending. Any transaction significantly higher than your average is flagged as an "anomaly."
- **Recurring Detection**: Looks for similar amounts paid to the same recipient in different months (e.g., rent or Netflix).

---

## 4. Manual: User Guide

### 4.1 Prerequisites
- **Node.js**: Version 18 or higher.
- **MongoDB**: A connection string (already configured in `.env`).
- **HuggingFace Token**: Required for OCR (already configured in `.env`).

### 4.2 Installation & Startup
```bash
# Install everything
npm run install:all

# Run the project
npm run dev
```

### 4.3 Navigating the UI
1.  **Home**: Drag and drop your file.
2.  **Dashboard**: 
    - Use the **Overview Cards** for quick stats.
    - Analyze the **Category Pie Chart**.
    - Scroll through the **Transaction Table** (you can filter by category or month).
    - Check **Monthly Comparison** to see if you spent more this month vs. last.
3.  **History**: Login to save your sessions and view them later without re-uploading.

---

## 5. Developer Manual: API Endpoints

### 5.1 Authentication
- `POST /api/auth/register`: Create account.
- `POST /api/auth/login`: Get JWT.

### 5.2 Upload & Parsing
- `POST /api/upload/statement`: The main entry point. Accepts a file and returns a `sessionId`.
- `GET /api/upload/session/:sessionId`: Get the processed data for that result.

### 5.3 Insights (The Dashboard Data)
*All require a valid `:sessionId`*
- `GET /api/insights/:sessionId/overview`: Summary stats.
- `GET /api/insights/:sessionId/categories`: Pie chart data.
- `GET /api/insights/:sessionId/trends`: Line chart data.
- `GET /api/insights/:sessionId/recurring`: Detected subscriptions.
- `GET /api/insights/:sessionId/prediction`: Next month's forecast.

---

## 6. Maintenance & Troubleshooting

### 6.1 "No Transactions Extracted"
- **Cause**: PDF is encrypted or uses an unsupported column layout.
- **Fix**: Try converting the PDF to a clear image or use the CSV export from your bank.

### 6.2 "Rate Limit Reached"
- **Cause**: The HuggingFace Inference API has limits for the free model.
- **Fix**: Wait 60 seconds and try again, or upgrade to a dedicated HF Endpoint.

### 6.3 "MongoDB Connection Error"
- **Cause**: IP address not whitelisted in MongoDB Atlas or invalid URI.
- **Fix**: Check the `MONGODB_URI` in `server/.env`.

---

## 7. Configuration Reference (`.env`)
| Variable | Purpose |
|---|---|
| `HF_TOKEN` | Your HuggingFace API key for AI OCR. |
| `MONGODB_URI` | The database connection string. |
| `JWT_SECRET` | Secret key for signing user tokens. |
| `PORT` | The backend port (default 5000). |

---

## 8. Summary of Components
| Component | Function |
|---|---|
| `OverviewCards` | Displays Income, Expense, Savings, and Count. |
| `TransactionList` | Table with fuzzy search and category filtering. |
| `TrendChart` | Visualizes the "flow" of money over the month. |
| `MonthComparison` | Detects % change between selected months. |

---

**MoneyMap** is built for transparency. Check `server/index.js` to see the API start, and `client/src/App.js` to see the routing logic. Happy tracking!
