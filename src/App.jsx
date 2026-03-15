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
  const location = useLocation();
  const navigate = useNavigate();
  const feedLayoutPaths = ['/feed', '/campaigns', '/leaderboard', '/my-complaints'];
  const isFeedLayout = feedLayoutPaths.includes(location.pathname);
  const [trendItems, setTrendItems] = useState([]);

  useEffect(() => {
    if (!isFeedLayout) return;

    let alive = true;
    axios.get(`${API_URL}/api/suggestions`).then((r) => {
      if (!alive) return;
      const items = Array.isArray(r.data) ? r.data : [];
      const tagMap = new Map();

      items.forEach((item) => {
        const rawTags = Array.isArray(item?.tags) ? item.tags : typeof item?.tags === 'string' ? item.tags.split(/[\s,]+/) : [];
        const titleDescTags = `${item?.title || ''} ${item?.description || ''}`.match(/#[a-zA-Z0-9_]+/g) || [];
        [...rawTags, ...titleDescTags].forEach((tag) => {
          const normalized = String(tag || '').trim().replace(/[^#a-zA-Z0-9_]/g, '');
          if (!normalized) return;
          const withHash = normalized.startsWith('#') ? normalized : `#${normalized}`;
          tagMap.set(withHash, (tagMap.get(withHash) || 0) + 1);
        });
      });

      const trends = Array.from(tagMap.entries()).
      sort((a, b) => b[1] - a[1]).
      slice(0, 6).
      map(([tag, count]) => ({ tag, count }));
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
            <h4>Explore</h4>
            <Link to="/feed">Home Feed</Link>
            <Link to="/campaigns">Campaigns</Link>
            <Link to="/leaderboard">Leaderboard</Link>
            <Link to="/my-complaints">My Reports</Link>
          </aside>
        }

        <main className="content-center-column">
          <Outlet />
        </main>

        {isFeedLayout &&
        <aside className="right-sidebar-rail">
            <h4>Trends for You</h4>
            {hasTrends ?
          <ol>
                {trendItems.map((trend) =>
              <li key={trend.tag}>
                    <button
                  className="trend-link-btn"
                  onClick={() => navigate(`/feed?q=${encodeURIComponent(trend.tag)}`)}>
                      <strong>{trend.tag}</strong>
                      <span>{trend.count} posts</span>
                    </button>
                  </li>
              )}
              </ol> :
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>No trend tags yet.</p>
          }
          </aside>
        }
      </div>

      <footer className="site-footer">
        <div className="site-footer-grid">
          <div>
            <h5>Company</h5>
            <Link to="/">About</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/auth">Careers</Link>
          </div>
          <div>
            <h5>Community</h5>
            <Link to="/feed">Feed</Link>
            <Link to="/campaigns">Campaigns</Link>
            <Link to="/leaderboard">Leaderboard</Link>
          </div>
          <div>
            <h5>Support</h5>
            <Link to="/auth">Help Center</Link>
            <Link to="/auth">Report Abuse</Link>
            <Link to="/terms">Privacy</Link>
          </div>
          <div>
            <h5>Connect</h5>
            <div className="footer-social-row">
              <a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer">X</a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
            </div>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>Copyright 2026 Pariwartan</span>
          <span>Protected by Google reCAPTCHA</span>
        </div>
      </footer>
    </>
  );
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
    </ThemeProvider>);

}

export default App;