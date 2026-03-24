import React, { useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import InsightsPage from './pages/InsightsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HistoryPage from './pages/HistoryPage';

// Auth context
export const AuthContext = createContext();
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Session context
export const SessionContext = createContext();
export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within SessionProvider');
  return context;
};

// Protected route - redirects to /login if not authenticated
const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  // Auth state - persist in localStorage
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [months, setMonths] = useState([]);
  const [fileName, setFileName] = useState('');

  const clearSession = () => {
    setSessionId(null);
    setTransactions([]);
    setMonths([]);
    setFileName('');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <SessionContext.Provider value={{
        sessionId, setSessionId,
        transactions, setTransactions,
        months, setMonths,
        fileName, setFileName,
        clearSession
      }}>
        <div className="app">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </SessionContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;

