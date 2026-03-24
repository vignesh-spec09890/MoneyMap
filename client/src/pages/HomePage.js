import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUploadCloud, 
  FiCheck, 
  FiX, 
  FiFileText, 
  FiBarChart2, 
  FiPieChart,
  FiTrendingUp,
  FiShield,
  FiZap,
  FiLayers,
  FiClock,
  FiLogIn,
  FiLogOut,
  FiUser
} from 'react-icons/fi';
import { useSession, useAuth } from '../App';
import api from '../services/api';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const { setSessionId, setTransactions, setMonths, setFileName } = useSession();
  const { user, token, logout } = useAuth();
  
  const [uploadState, setUploadState] = useState('idle'); // idle, uploading, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setUploadState('uploading');
    setUploadProgress(0);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('statement', file);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await api.uploadStatement(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success) {
        setUploadState('success');
        setUploadSummary(response.summary);
        setSessionId(response.sessionId);
        
        // Fetch full transaction data
        const sessionData = await api.getSessionData(response.sessionId);
        if (sessionData.success) {
          setTransactions(sessionData.data.transactions);
          setMonths(sessionData.data.months);
          setFileName(file.name);

          // Auto-save to history if user is logged in
          if (token) {
            try {
              const histRes = await api.saveHistory(token, file.name, response.summary, sessionData.data.transactions);
              console.log('History saved:', histRes);
            } catch (e) {
              console.warn('Could not save history:', e.response?.data || e.message);
            }
          }
        }
      } else {
        setUploadState('error');
        setErrorMessage(response.message || 'Failed to process statement');
      }
    } catch (error) {
      setUploadState('error');
      setErrorMessage(error.response?.data?.message || error.message || 'Upload failed');
    }
  }, [setSessionId, setTransactions, setMonths, setFileName, token]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: uploadState === 'uploading'
  });

  const resetUpload = () => {
    setUploadState('idle');
    setUploadProgress(0);
    setErrorMessage('');
    setUploadedFile(null);
    setUploadSummary(null);
  };

  const goToInsights = () => {
    navigate('/insights');
  };

  const features = [
    {
      icon: <FiBarChart2 />,
      title: 'Smart Analytics',
      description: 'AI-powered categorization of your transactions'
    },
    {
      icon: <FiPieChart />,
      title: 'Visual Insights',
      description: 'Beautiful charts to understand spending patterns'
    },
    {
      icon: <FiTrendingUp />,
      title: 'Trend Analysis',
      description: 'Track your financial habits over time'
    },
    {
      icon: <FiShield />,
      title: '100% Private',
      description: 'Your data stays on your device, always'
    },
    {
      icon: <FiZap />,
      title: 'Instant Results',
      description: 'Get insights in seconds, not hours'
    },
    {
      icon: <FiLayers />,
      title: 'Multi-Month',
      description: 'Compare spending across different months'
    }
  ];

  return (
    <div className="home-page">
      {/* Floating Shapes Background */}
      <div className="floating-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      {/* Top Navigation */}
      <div className="top-nav">
        <div className="nav-brand">📊 Bank Insights</div>
        <div className="nav-actions">
          {user ? (
            <>
              <button className="btn btn-secondary btn-nav" onClick={() => navigate('/history')}>
                <FiClock /> History
              </button>
              <span className="nav-user"><FiUser /> {user.name}</span>
              <button className="btn btn-ghost btn-nav" onClick={logout}>
                <FiLogOut /> Logout
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-nav" onClick={() => navigate('/history')}>
                <FiClock /> History
              </button>
              <Link to="/login" className="btn btn-secondary btn-nav">
                <FiLogIn /> Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-nav">
                <FiUser /> Register
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <motion.section 
        className="hero-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="container">
          <motion.div 
            className="hero-content"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <span className="hero-badge">
              <FiZap /> Free & Private
            </span>
            <h1 className="hero-title">
              Discover Hidden Patterns in Your
              <span className="gradient-text"> Spending</span>
            </h1>
            <p className="hero-subtitle">
              Upload your bank statement and unlock powerful insights about your financial habits. 
              Understand where your money goes with beautiful visualizations and smart categorization.
            </p>
          </motion.div>

          {/* Upload Area */}
          <motion.div 
            className="upload-section"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <AnimatePresence mode="wait">
              {uploadState === 'idle' && (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`dropzone glass-card ${isDragActive ? 'active' : ''}`}
                  {...getRootProps()}
                >
                  <input {...getInputProps()} />
                  <div className="dropzone-content">
                    <div className="upload-icon">
                      <FiUploadCloud />
                    </div>
                    <h3>Drop your bank statement here</h3>
                    <p>or click to browse files</p>
                    <div className="supported-formats">
                      <span>Supported: PDF, JPG, PNG, CSV</span>
                      <span>Max size: 10MB</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {uploadState === 'uploading' && (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="upload-progress glass-card"
                >
                  <div className="progress-content">
                    <div className="file-info">
                      <FiFileText className="file-icon" />
                      <span>{uploadedFile?.name}</span>
                    </div>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="progress-text">
                      {uploadProgress < 100 
                        ? 'Processing your statement...' 
                        : 'Almost done...'}
                    </p>
                  </div>
                </motion.div>
              )}

              {uploadState === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="upload-error glass-card"
                >
                  <div className="error-content">
                    <div className="error-icon">
                      <FiX />
                    </div>
                    <h3>Upload Failed</h3>
                    <p>{errorMessage}</p>
                    <button className="btn btn-secondary" onClick={resetUpload}>
                      Try Again
                    </button>
                  </div>
                </motion.div>
              )}

              {uploadState === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="upload-success glass-card"
                >
                  <div className="success-content">
                    <div className="success-icon">
                      <FiCheck />
                    </div>
                    <h3>Statement Processed!</h3>
                    {uploadSummary && (
                      <>
                        <div className="summary-stats">
                          <div className="stat">
                            <span className="stat-value">{uploadSummary.totalTransactions}</span>
                            <span className="stat-label">Transactions</span>
                          </div>
                          <div className="stat">
                            <span className="stat-value">{uploadSummary.daysCovered}</span>
                            <span className="stat-label">Days</span>
                          </div>
                          <div className="stat">
                            <span className="stat-value">{uploadSummary.monthCount || uploadSummary.months?.length || 0}</span>
                            <span className="stat-label">Months</span>
                          </div>
                        </div>
                        <div className="credit-debit-summary">
                          <div className="credit-info">
                            <span className="credit-label">Credits:</span>
                            <span className="credit-value">{uploadSummary.creditCount || 0} (₹{(uploadSummary.totalCredit || 0).toLocaleString()})</span>
                          </div>
                          <div className="debit-info">
                            <span className="debit-label">Debits:</span>
                            <span className="debit-value">{uploadSummary.debitCount || 0} (₹{(uploadSummary.totalDebit || 0).toLocaleString()})</span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="success-actions">
                      <button className="btn btn-primary btn-lg" onClick={goToInsights}>
                        <FiBarChart2 /> View Insights
                      </button>
                      <button className="btn btn-secondary" onClick={resetUpload}>
                        Upload Another
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section 
        className="features-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="container">
          <h2 className="section-title">Powerful Features</h2>
          <p className="section-subtitle">
            Everything you need to understand your finances
          </p>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card glass-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h4>{feature.title}</h4>
                <p>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* How It Works Section */}
      <motion.section 
        className="how-it-works-section"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <h4>Upload Statement</h4>
              <p>Drop your bank statement (PDF, image, or CSV)</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">2</div>
              <h4>Auto-Categorize</h4>
              <p>We categorize all transactions automatically</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">3</div>
              <h4>Get Insights</h4>
              <p>Explore interactive charts and analytics</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>© 2024 Bank Insight Generator. Your data is processed locally and never stored.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
