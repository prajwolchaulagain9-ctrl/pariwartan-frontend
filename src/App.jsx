import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
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
import { API_URL } from './config';
import { LanguageProvider, useLanguage } from './context/LanguageContext';


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

const ShellLayout = () => {
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const feedLayoutPaths = ['/feed', '/campaigns', '/leaderboard', '/my-complaints'];
  const isFeedLayout = feedLayoutPaths.includes(location.pathname);
  const [trendItems, setTrendItems] = useState([]);

  useEffect(() => {
    if (!isFeedLayout) return;

    let alive = true;
    axios.get(`${API_URL}/api/suggestions/trends?limit=6`).then((r) => {
      if (!alive) return;
      const trends = Array.isArray(r.data) ? r.data : [];
      setTrendItems(trends);
    }).catch(() => {
      if (alive) setTrendItems([]);
    });

    return () => {
      alive = false;
    };
  }, [isFeedLayout]);

  const hasTrends = useMemo(() => trendItems.length > 0, [trendItems]);

  return (
    <>
      <Navbar />
      <div id="main-content" className={`app-shell-content ${isFeedLayout ? 'three-column-shell' : ''}`}>
        {isFeedLayout &&
        <aside className="left-sidebar-rail">
            <h4>{t('Explore')}</h4>
            <Link to="/feed">{t('Home Feed')}</Link>
            <Link to="/campaigns">{t('Campaigns')}</Link>
            <Link to="/leaderboard">{t('Ranking')}</Link>
            <Link to="/my-complaints">{t('My Reports')}</Link>
          </aside>
        }

        <main className="content-center-column">
          <Outlet />
        </main>

        {isFeedLayout &&
        <aside className="right-sidebar-rail">
            <h4>{t('Trends for You')}</h4>
            {hasTrends ?
          <ol>
                {trendItems.map((trend) =>
              <li key={trend.tag}>
                    <button
                  className="trend-link-btn"
                  onClick={() => navigate(`/feed?q=${encodeURIComponent(trend.tag)}`)}>
                      <strong>{trend.tag}</strong>
                      <span>{trend.count} {t('posts')}</span>
                    </button>
                  </li>
              )}
              </ol> :
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{t('No trend tags yet.')}</p>
          }
          </aside>
        }
      </div>

      <footer className="site-footer">
        <div className="site-footer-grid">
          <div>
            <h5>{t('Company')}</h5>
            <Link to="/">{t('About')}</Link>
            <Link to="/terms">{t('Terms')}</Link>
            <Link to="/auth">{t('Careers')}</Link>
          </div>
          <div>
            <h5>{t('Community')}</h5>
            <Link to="/feed">{t('Feed')}</Link>
            <Link to="/campaigns">{t('Campaigns')}</Link>
            <Link to="/leaderboard">{t('Ranking')}</Link>
          </div>
          <div>
            <h5>{t('Support')}</h5>
            <Link to="/auth">{t('Help Center')}</Link>
            <Link to="/auth">{t('Report Abuse')}</Link>
            <Link to="/terms">{t('Privacy')}</Link>
          </div>
          <div>
            <h5>{t('Connect')}</h5>
            <div className="footer-social-row">
              <a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer">X</a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
            </div>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>{t('Copyright')} 2026 Pariwartan</span>
          <span>{t('Protected by Google reCAPTCHA')}</span>
        </div>
      </footer>
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
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
          <SkipLink />
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/banned" element={<BannedPage />} />
            <Route path="/terms" element={<TermsPage />} />

            <Route element={<EcoPointsProvider><ShellLayout /></EcoPointsProvider>}>
              <Route path="/" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
              <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
              <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
              <Route path="/campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/my-complaints" element={<ProtectedRoute><FeedPage myOwn /></ProtectedRoute>} />
            </Route>
          </Routes>
        </div>
      </Router>
      </LanguageProvider>
    </ThemeProvider>);

}

const SkipLink = () => {
  const { t } = useLanguage();
  return <a href="#main-content" className="skip-link">{t('Skip to main content')}</a>;
};

export default App;