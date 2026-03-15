import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { EcoPointsProvider } from './context/EcoPointsContext';
import Navbar from './components/Navbar';
import MapPage from './pages/MapPage';
import FeedPage from './pages/FeedPage';
import AdminPage from './pages/AdminPage';
import AuthPage from './pages/AuthPage';
import CampaignsPage from './pages/CampaignsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import BannedPage from './pages/BannedPage';
import TermsPage from './pages/TermsPage';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';


axios.interceptors.response.use(
  (response) => response,
  (error) => {

    const isBannedResponse = error.response?.status === 403 && error.response?.data?.banned;

    const normalizedPath = window.location.pathname.toLowerCase().replace(/\/$/, "");
    const currentlyOnBannedPage = normalizedPath === '/banned';

    if (isBannedResponse && !currentlyOnBannedPage) {
      localStorage.setItem('banInfo', JSON.stringify(error.response.data));
      window.location.href = '/banned';
    }
    return Promise.reject(error);
  }
);

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/auth" replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Toaster position="top-right"
        containerStyle={{ zIndex: 999999 }}
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontSize: '0.875rem',
            fontWeight: 500,
            padding: '12px 14px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.14)'
          },
          success: {
            duration: 3000
          },
          error: {
            duration: 5000
          }
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <Routes>
            {}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/banned" element={<BannedPage />} />
            <Route path="/terms" element={<TermsPage />} />
            
            {}
            <Route path="*" element={
            <EcoPointsProvider>
                <Navbar />
                <div id="main-content" className="app-shell-content" style={{
                flex: 1,
                paddingBottom: 'max(52px, env(safe-area-inset-bottom))',
                overflowY: 'auto'
              }}>
                  <Routes>
                    <Route path="/" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
                    <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
                    <Route path="/campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
                    <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/my-complaints" element={<ProtectedRoute><FeedPage myOwn /></ProtectedRoute>} />
                  </Routes>
                </div>
              </EcoPointsProvider>
            } />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>);

}

export default App;