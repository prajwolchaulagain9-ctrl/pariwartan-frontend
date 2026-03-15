import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, LogOut, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BannedPage = () => {
  const navigate = useNavigate();
  const [banInfo, setBanInfo] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const savedBan = localStorage.getItem('banInfo');
    if (savedBan) {
      setBanInfo(JSON.parse(savedBan));
    } else {

      const user = JSON.parse(localStorage.getItem('user'));
      if (!user) navigate('/auth');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/auth');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: isMobileView ? '12px' : '24px'
    }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          maxWidth: '480px',
          width: '100%',
          background: 'var(--surface)',
          padding: isMobileView ? '18px' : '40px',
          borderRadius: isMobileView ? '14px' : '24px',
          border: '1px solid var(--border)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)'
        }}>
        
        <div style={{
          width: isMobileView ? '58px' : '80px',
          height: isMobileView ? '58px' : '80px',
          borderRadius: isMobileView ? '14px' : '20px',
          background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: `0 auto ${isMobileView ? 14 : 24}px`,
          color: '#ef4444'
        }}>
          <AlertOctagon size={isMobileView ? 30 : 40} />
        </div>

        <h1 style={{ fontSize: isMobileView ? '1.45rem' : '2.2rem', fontWeight: 900, marginBottom: isMobileView ? 8 : 12, letterSpacing: '-0.03em' }}>
          Access Restricted
        </h1>
        
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: isMobileView ? 18 : 32, fontSize: isMobileView ? '0.85rem' : '1rem' }}>
          Your account has been suspended for violating platform community guidelines. 
          Security protocols have restricted your access until further notice.
        </p>

        {banInfo &&
        <div style={{
          background: 'var(--bg-secondary)',
          padding: isMobileView ? '12px' : '20px',
          borderRadius: isMobileView ? '12px' : '16px',
          textAlign: 'left',
          marginBottom: isMobileView ? 18 : 32,
          border: '1px solid var(--border)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#ef4444' }}>
              <MessageSquare size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>Reason for Suspension</span>
            </div>
            <div style={{ fontSize: isMobileView ? '0.88rem' : '1rem', fontWeight: 600, color: 'var(--text)' }}>
              {banInfo.reason || 'No specific reason provided by moderator.'}
            </div>
            {banInfo.type === 'temporary' && banInfo.expiry &&
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Access will be restored after: <strong style={{ color: 'var(--text-secondary)' }}>{new Date(banInfo.expiry).toLocaleString()}</strong>
              </div>
          }
          </div>
        }

        <div style={{ display: 'grid', gap: 12 }}>
          <button
            onClick={() => window.location.href = 'mailto:support@pariwartan.org'}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}>
            
            Appeal Suspension
          </button>
          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            
            <LogOut size={16} /> Sign out of account
          </button>
        </div>

        <p style={{ marginTop: isMobileView ? 16 : 32, fontSize: isMobileView ? '0.68rem' : '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
          System Token ID: {JSON.parse(localStorage.getItem('user'))?.id?.substring(0, 8).toUpperCase() || 'ANONYMOUS'}
          <br />
          <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>
            IP Hash Record: {
            (JSON.parse(localStorage.getItem('user'))?.ipAddress || '').replace(/^::ffff:/, '') || 'Cloudflare Hidden'
            }
          </span>
        </p>
      </motion.div>
    </div>);

};

export default BannedPage;