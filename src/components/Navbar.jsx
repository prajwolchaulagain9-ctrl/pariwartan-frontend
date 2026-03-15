import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Layout, Megaphone, Users, ShieldCheck, LogOut, X,
  User as UserIcon, Moon, Sun, Award, Camera, Bell,
  Settings, FileText, Lock, Pencil, ImagePlus,
  Target, Trophy, Leaf, Trees, Mountain, Sparkles, Crown, Sprout,
  CheckCircle2, XCircle, PartyPopper, RefreshCw, Trash2,
  KeyRound, Megaphone as MegaphoneIcon, Home, UserMinus, Star } from
'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useEcoPoints } from '../context/EcoPointsContext';
import ImageCropper from './ImageCropper';
import './Navbar.css';
import axios from 'axios';
import { API_URL, getImgUrl, getImgFallbackUrl } from '../config';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';

const ANNOUNCEMENT_COOKIE = 'community_alert_closed';

const Navbar = () => {
  const NAV_ICON_SIZE = 16;
  const ACTION_ICON_SIZE = 18;
  const { isDark, toggle } = useTheme();
  const { language, changeLanguage, t } = useLanguage();
  const { ecoPoints, badges, equippedBadge, equipBadge, allBadges, fetchEcoPoints } = useEcoPoints();
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user'));
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ username: '', oldPassword: '', newPassword: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [pendingPic, setPendingPic] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navRaised, setNavRaised] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const profileRef = useRef(null);
  const picInputRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const cookieEntry = document.cookie.split('; ').find((entry) => entry.startsWith(`${ANNOUNCEMENT_COOKIE}=`));
    const isDismissed = cookieEntry?.split('=')[1] === '1';
    if (isDismissed) setShowAnnouncement(false);
  }, []);

  useEffect(() => {
    const onScroll = () => setNavRaised(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ICON_MAP = { Sprout, Leaf, Trees, Award, Target, Trophy, Mountain, Crown, Sparkles, Users };


  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);


  useEffect(() => {
    if (!user) return;
    fetchEcoPoints?.();
    const token = localStorage.getItem('token');
    const fetchCount = () => {
      axios.get(`${API_URL}/api/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }).
      then((r) => setUnreadCount(r.data.count)).catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchEcoPoints]);

  useEffect(() => {
    setProfileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q') || '';
    setNavSearch(q);
  }, [location.pathname, location.search]);


  useEffect(() => {
    if (showSettings && user) {
      setProfileData(null);
      const token = localStorage.getItem('token');
      axios.get(`${API_URL}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } }).
      then((r) => {
        setProfileData(r.data);
        setSettingsForm({ username: r.data.username, oldPassword: '', newPassword: '' });
      }).
      catch(() => toast.error('Could not load profile'));
    }
  }, [showSettings]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  const hasPendingChanges = () => {
    if (pendingPic) return true;
    if (profileData && settingsForm.username !== profileData.username) return true;
    if (settingsForm.oldPassword && settingsForm.newPassword) return true;
    return false;
  };

  const trimmedUsername = settingsForm.username.trim();
  const usernameChanged = Boolean(profileData) && trimmedUsername !== (profileData?.username || '').trim();
  const usernameError = usernameChanged && trimmedUsername.length < 3 ? 'Username must be at least 3 characters.' : '';
  const passwordChangeStarted = Boolean(settingsForm.oldPassword || settingsForm.newPassword);
  const passwordError =
  passwordChangeStarted && !settingsForm.oldPassword ? 'Enter your current password to change it.' :
  passwordChangeStarted && !settingsForm.newPassword ? 'Enter a new password.' :
  settingsForm.newPassword && settingsForm.newPassword.length < 8 ? 'New password must be at least 8 characters.' :
  '';
  const canApplyChanges = hasPendingChanges() && !settingsLoading && !usernameError && !passwordError;

  const closeSettings = () => {
    setShowSettings(false);
    if (pendingPic?.preview) {
      URL.revokeObjectURL(pendingPic.preview);
      setPendingPic(null);
    }
  };

  const handleApplyChanges = async () => {
    if (usernameError || passwordError) {
      toast.error(usernameError || passwordError);
      return;
    }
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (pendingPic) {
        if (!pendingPic.blob) {
          toast.error('Profile picture data is invalid. Please select a new image.');
          setSettingsLoading(false);
          return;
        }
        if (!(pendingPic.blob instanceof Blob)) {
          toast.error('Invalid file format. Please select a valid image.');
          setSettingsLoading(false);
          return;
        }
        if (pendingPic.blob.size === 0) {
          toast.error('Image data is empty. Please crop the image again.');
          setSettingsLoading(false);
          return;
        }
        console.log('Uploading profile pic:', { size: pendingPic.blob.size, type: pendingPic.blob.type });
        const fd = new FormData();
        fd.append('profilePic', pendingPic.blob, 'profile.jpg');
        console.log('FormData created, posting to API...');
        try {
          const r = await axios.post(`${API_URL}/api/user/profile-pic`, fd, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
          });
          console.log('Upload response:', r.data);
          const storedUser = JSON.parse(localStorage.getItem('user'));
          storedUser.profilePic = r.data.profilePic;
          localStorage.setItem('user', JSON.stringify(storedUser));
          setProfileData((prev) => prev ? { ...prev, profilePic: r.data.profilePic } : prev);
          if (pendingPic.preview) URL.revokeObjectURL(pendingPic.preview);
          setPendingPic(null);
          toast.success('Profile picture updated');
        } catch (uploadErr) {
          console.error('Upload error details:', uploadErr.response?.data || uploadErr.message);
          throw uploadErr;
        }
      }

      const payload = {};
      if (profileData && trimmedUsername !== profileData.username) payload.username = trimmedUsername;
      if (settingsForm.oldPassword && settingsForm.newPassword) {
        payload.oldPassword = settingsForm.oldPassword;
        payload.newPassword = settingsForm.newPassword;
      }
      if (Object.keys(payload).length > 0) {
        const r = await axios.put(`${API_URL}/api/user/profile`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const storedUser = JSON.parse(localStorage.getItem('user'));
        storedUser.username = r.data.username;
        localStorage.setItem('user', JSON.stringify(storedUser));
        setProfileData(r.data);
        setSettingsForm((f) => ({ ...f, oldPassword: '', newPassword: '' }));
      }
      toast.success('Changes applied');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {setSettingsLoading(false);}
  };

  const handleProfilePicCropped = (blob) => {
    try {
      console.log('handleProfilePicCropped called with blob:', blob);
      if (!blob || !(blob instanceof Blob)) {
        toast.error('Invalid image blob received');
        console.error('Invalid blob:', blob);
        return;
      }
      if (blob.size === 0) {
        toast.error('Image is blank. Please try selecting a different area to crop.');
        console.error('Blob is empty');
        return;
      }
      setCropSrc(null);
      if (pendingPic && pendingPic.preview) {
        URL.revokeObjectURL(pendingPic.preview);
      }
      const preview = URL.createObjectURL(blob);
      console.log('Created preview URL:', preview);
      setPendingPic({ blob, preview });
      toast.success('Photo cropped successfully. Click Apply to save.');
    } catch (err) {
      toast.error('Error processing image: ' + (err.message || 'Unknown error'));
      console.error('Profile pic cropped error:', err);
    }
  };

  const getProfilePicUrl = (pic) => {
    if (!pic) return null;
    return getImgUrl(pic) || null;
  };

  const resolveEcoPoints = (...values) => {
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };

  const profilePicUrl = getProfilePicUrl(user?.profilePic);
  const displayedEcoPoints = resolveEcoPoints(
    profileData?.ecoPoints,
    profileData?.eco_points,
    ecoPoints,
    user?.ecoPoints,
    user?.eco_points,
    user?.user?.ecoPoints,
    user?.user?.eco_points
  );

  const handleImgError = (e, rawUrl) => {
    const fallback = getImgFallbackUrl(rawUrl);
    if (fallback && e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
      return;
    }
    e.currentTarget.style.display = 'none';
  };

  const openNotifications = () => {
    setNotifOpen((o) => !o);
    if (!notifOpen) {
      const token = localStorage.getItem('token');
      axios.get(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } }).
      then((r) => setNotifications(r.data)).catch(() => {});
    }
  };

  const markAllRead = () => {
    const token = localStorage.getItem('token');
    axios.patch(`${API_URL}/api/notifications/read-all`, {}, { headers: { Authorization: `Bearer ${token}` } }).
    then(() => {setUnreadCount(0);setNotifications((n) => n.map((x) => ({ ...x, read: true })));}).catch(() => {});
  };

  const notifIconMeta = (type) => {
    const map = {
      complaint_approved: { Icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      complaint_rejected: { Icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
      complaint_resolved: { Icon: PartyPopper, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
      complaint_progress: { Icon: RefreshCw, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
      complaint_deleted: { Icon: Trash2, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
      password_changed: { Icon: KeyRound, color: '#E8212A', bg: 'rgba(139,92,246,0.1)' },
      username_changed: { Icon: Pencil, color: '#E8212A', bg: 'rgba(232,33,42,0.1)' },
      profile_pic_changed: { Icon: ImagePlus, color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
      club_deleted: { Icon: Home, color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
      club_kicked: { Icon: UserMinus, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
      eco_points: { Icon: Star, color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
      announcement: { Icon: MegaphoneIcon, color: '#E8212A', bg: 'rgba(232,33,42,0.1)' }
    };
    return map[type] || { Icon: Bell, color: '#E8212A', bg: 'rgba(232,33,42,0.08)' };
  };

  const NotifIcon = ({ type }) => {
    const { Icon, color, bg } = notifIconMeta(type);
    return (
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={15} color={color} strokeWidth={2.2} />
      </div>);

  };

  const timeAgo = (date) => {
    const s = Math.floor((Date.now() - new Date(date)) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);if (d < 30) return `${d}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const isAdmin = Boolean(localStorage.getItem('adminToken'));
  const leftDesktopNavItems = [
  { to: '/', icon: Home, label: 'Home' },
  ...(user ?
  [
  { to: '/feed', icon: Layout, label: 'Feed' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' }] :

  [])];
  const rightDesktopNavItems = [
  ...(user ? [{ to: '/leaderboard', icon: Trophy, label: 'Ranking' }] : []),
  ...(isAdmin ? [{ to: '/admin', icon: ShieldCheck, label: 'Admin' }] : [])
  ];
  const navItems = [...leftDesktopNavItems, ...rightDesktopNavItems];

  const isFeedSearchPage = location.pathname === '/feed';

  const dismissAnnouncement = () => {
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `${ANNOUNCEMENT_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
    setShowAnnouncement(false);
  };

  const handleNavSearchChange = (value) => {
    setNavSearch(value);
    if (!isFeedSearchPage) return;
    const trimmed = value.trim();
    if (!trimmed) {
      navigate('/feed', { replace: true });
      return;
    }
    navigate(`/feed?q=${encodeURIComponent(trimmed)}`, { replace: true });
  };


  return (
    <>
      {showAnnouncement &&
      <div className="announcement-strip">
          <span>📢 {t('Community Alert: Join our civic action push.')} <a href="/campaigns">{t('See ongoing missions')}</a></span>
          <button onClick={dismissAnnouncement} aria-label="Dismiss announcement">×</button>
        </div>
      }
      <nav className="nav-header" style={{
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: showAnnouncement ? 40 : 0, zIndex: 1000,
        boxShadow: navRaised ? '0 5px 18px rgba(17,17,17,0.08)' : '0 1px 0 rgba(17,17,17,0.05)',
        padding: isMobileView ? '10px 12px' : '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isMobileView ? 8 : 12,
        minHeight: isMobileView ? 60 : 74
      }}>
        {isMobileView &&
        <button
          className="nav-mobile-hamburger"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={t('Open menu')}>
            {mobileMenuOpen ? <X size={18} /> : <Layout size={18} />}
          </button>
        }

        <div className="nav-header-left" style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobileView ? 8 : 14,
          minWidth: 0,
          overflow: 'hidden',
          flex: isMobileView ? '1 1 auto' : '1 1 0',
          paddingLeft: isMobileView ? 0 : 10
        }}>
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: isMobileView ? 6 : 10 }}>
            <img
              className="nav-logo"
              src="/logo.png"
              alt="Pariwartan"
              style={{
                height: isMobileView ? 42 : 56,
                width: 'auto',
                maxWidth: isMobileView ? 'calc(100vw - 140px)' : '100%',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => {e.currentTarget.style.display = 'none';}} />
            <img
              className="nav-logo-mark"
              src="/assets/logo.png"
              alt="Genz Reports"
              style={{ height: isMobileView ? 32 : 40, width: 'auto', display: 'block' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </NavLink>

          <div className="desktop-nav-links" style={{
            display: isMobileView ? 'none' : 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'transparent',
            borderRadius: 12,
            padding: 0,
            border: 'none'
          }}>
            {leftDesktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 16px', borderRadius: 10,
                      background: isActive ?
                      '#E8212A' :
                      'transparent',
                      color: isActive ? 'white' : 'var(--text-secondary)',
                      fontSize: '0.86rem', fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      boxShadow: 'none'
                    }}>

                    <Icon size={NAV_ICON_SIZE} />
                    {t(item.label)}
                  </motion.div>
                </NavLink>);

            })}
          </div>
        </div>

        <div className="nav-search-wrap" style={{
          display: !isMobileView && isFeedSearchPage ? 'flex' : 'none',
          alignItems: 'center',
          flex: !isMobileView && isFeedSearchPage ? '0 1 520px' : '0 0 auto',
          width: 'min(42vw, 520px)',
          marginLeft: !isMobileView && isFeedSearchPage ? 'auto' : 0,
          marginRight: !isMobileView && isFeedSearchPage ? 'auto' : 0,
          background: '#f1f1f1',
          border: '1px solid #ebebeb',
          borderRadius: 999,
          padding: '10px 14px'
        }}>
          <span style={{ color: '#666666', marginRight: 8 }}>🔍</span>
          <input
            type="text"
            placeholder={t('Search issues, people, campaigns')}
            value={navSearch}
            onChange={(e) => handleNavSearchChange(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              fontSize: '0.9rem',
              color: 'var(--text)'
            }} />
        </div>

        <div className="nav-header-right" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          minWidth: 0,
          flex: isMobileView ? '0 0 auto' : '1 1 0'
        }}>
          <div className="desktop-nav-links" style={{
            display: isMobileView ? 'none' : 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'transparent',
            borderRadius: 12,
            padding: 0,
            border: 'none'
          }}>
            {rightDesktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink key={`right-${item.to}`} to={item.to} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 16px', borderRadius: 10,
                      background: isActive ? '#E8212A' : 'transparent',
                      color: isActive ? 'white' : 'var(--text-secondary)',
                      fontSize: '0.86rem', fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      boxShadow: 'none'
                    }}>
                    <Icon size={NAV_ICON_SIZE} />
                    {t(item.label)}
                  </motion.div>
                </NavLink>);

            })}
          </div>

          <div className="nav-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => changeLanguage(language === 'ne' ? 'en' : 'ne')}
            title={language === 'ne' ? 'Switch to English' : 'नेपालीमा बदल्नुहोस्'}
            aria-label={language === 'ne' ? 'Switch to English' : 'Switch to Nepali'}
            style={{
              height: 36,
              padding: '0 10px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface-alt)',
              color: 'var(--text)',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {language === 'ne' ? 'EN' : 'ने'}
            </button>
          {}
          {user &&
          <div ref={notifRef} style={{ position: 'relative' }}>
              <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={openNotifications}
              style={{
                width: 40, height: 40, borderRadius: 10,
                background: notifOpen ? 'var(--surface-alt)' : 'transparent',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', position: 'relative',
                transition: 'all 0.2s ease'
              }}
              aria-label="Open notifications">
                <Bell size={ACTION_ICON_SIZE} />
                {unreadCount > 0 &&
              <span style={{
                position: 'absolute', top: -4, right: -4,
                minWidth: 20, height: 20, borderRadius: 10,
                background: '#ef4444', color: 'white',
                fontSize: '0.65rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px', border: '2px solid var(--nav-bg)'
              }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
              }
              </motion.button>

              {}
              <AnimatePresence>
                {notifOpen &&
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="mobile-notif-dropdown"
                style={{
                  position: isMobileView ? 'fixed' : 'absolute',
                  top: isMobileView ? 'calc(56px + env(safe-area-inset-top))' : 'calc(100% + 8px)',
                  right: isMobileView ? 10 : 0,
                  left: isMobileView ? 10 : 'auto',
                  width: isMobileView ? 'auto' : 'min(360px, calc(100vw - 20px))',
                  maxHeight: isMobileView ? 'min(62vh, 420px)' : 'min(400px, 70vh)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 14,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
                  overflow: 'hidden', zIndex: 10000,
                  display: 'flex', flexDirection: 'column'
                }}>
                    {}
                    <div style={{
                  padding: '14px 16px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{t('Notifications')}</h4>
                      {unreadCount > 0 &&
                  <button onClick={markAllRead} style={{
                    background: 'none', border: 'none', color: '#E8212A',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                  }}>{t('Mark read')}</button>
                  }
                    </div>
                    {}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {notifications.length === 0 ?
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          <Bell size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                          <p style={{ fontSize: '0.82rem', margin: 0 }}>{t('No notifications')}</p>
                        </div> :
                  notifications.map((n) =>
                  <motion.div
                    key={n._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: n.read ? 'transparent' : 'rgba(232,33,42,0.04)',
                      cursor: 'default', display: 'flex', gap: 10, alignItems: 'flex-start'
                    }}>
                          <NotifIcon type={n.type} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                        margin: 0, fontSize: '0.8rem', fontWeight: n.read ? 500 : 700,
                        color: 'var(--text)', lineHeight: 1.35
                      }}>{n.title}</p>
                            <p style={{
                        margin: '3px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)',
                        lineHeight: 1.4, overflow: 'hidden',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                      }}>{n.message}</p>
                            <p style={{
                        margin: '4px 0 0', fontSize: '0.68rem', color: 'var(--text-tertiary)'
                      }}>
                              {timeAgo(n.timestamp)}
                            </p>
                          </div>
                        </motion.div>
                  )}
                    </div>
                  </motion.div>
              }
              </AnimatePresence>
            </div>
          }

          {}
          {user ?
          <div ref={profileRef} style={{ position: 'relative' }}>
              <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setProfileOpen((o) => !o)}
              style={{
                width: 40, height: 40,
                padding: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
                background: profilePicUrl ? 'none' : 'linear-gradient(135deg, #E8212A, #FF6B35)',
                borderRadius: '50%',
                border: profileOpen ? '2px solid #E8212A' : '2px solid var(--border)',
                transition: 'all 0.2s ease'
              }}
              aria-label="Open account menu">
                {profilePicUrl ?
              <img src={profilePicUrl} alt="" onError={(e) => handleImgError(e, user?.profilePic)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :

              <UserIcon size={ACTION_ICON_SIZE} style={{ color: 'white' }} />
              }
              </motion.button>

              {}
              <AnimatePresence>
                {profileOpen &&
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 240, background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 12,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  overflow: 'hidden', zIndex: 10000
                }}>
                    {}
                    <div style={{
                  padding: '14px 16px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                      <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: profilePicUrl ? 'none' : 'linear-gradient(135deg, #E8212A, #FF6B35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', flexShrink: 0
                  }}>
                        {profilePicUrl ?
                    <img src={profilePicUrl} alt="" onError={(e) => handleImgError(e, user?.profilePic)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :

                    <UserIcon size={17} style={{ color: 'white' }} />
                    }
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0 }}>{displayedEcoPoints} ecopoints</p>
                      </div>
                    </div>

                    <div style={{ padding: '6px' }}>
                      <button onClick={() => {navigate('/my-complaints');setProfileOpen(false);}} style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: 'none', background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-alt)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <FileText size={15} />
                        My Reports
                      </button>

                      <button onClick={() => {setShowSettings(true);setProfileOpen(false);}} style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: 'none', background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-alt)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <Settings size={15} />
                        Settings
                      </button>

                      <button onClick={() => {toggle();setProfileOpen(false);}} style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: 'none', background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-alt)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        {isDark ? <Sun size={15} /> : <Moon size={15} />}
                        {isDark ? 'Light Mode' : 'Dark Mode'}
                      </button>

                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                      <button onClick={() => {logout();setProfileOpen(false);}} style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: 'none', background: 'transparent',
                    color: '#ef4444', fontSize: '0.82rem', fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
              }
              </AnimatePresence>
            </div> :

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/auth')}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}>
                Sign In
              </motion.button>
              {!isMobileView &&
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/auth')}
              style={{
                padding: '8px 14px',
                background: '#E8212A',
                color: 'white',
                border: '1px solid #E8212A',
                borderRadius: 999,
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}>
                  Register
                </motion.button>
            }
            </div>
          }
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileView && mobileMenuOpen &&
        <>
            <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.35)', zIndex: 1200 }}
          />
            <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: 'tween', duration: 0.2 }}
            style={{
              position: 'fixed',
              top: showAnnouncement ? 96 : 56,
              left: 0,
              width: 240,
              maxWidth: '82vw',
              bottom: 0,
              background: '#ffffff',
              borderRight: '1px solid #ebebeb',
              zIndex: 1201,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              {navItems.map((item) => (
                <button
                  key={`mobile-${item.to}`}
                  onClick={() => {
                    navigate(item.to);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    border: 'none',
                    background: location.pathname === item.to ? '#E8212A' : '#f7f7f7',
                    color: location.pathname === item.to ? '#fff' : '#111111',
                    borderRadius: 10,
                    minHeight: 44,
                    fontWeight: 700,
                    textAlign: 'left',
                    padding: '0 14px'
                  }}>
                  {item.label}
                </button>
              ))}
            </motion.aside>
          </>
        }
      </AnimatePresence>

      {isMobileView &&
      <nav className="bottom-nav-bar" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--nav-bg)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        minHeight: 44,
        padding: '4px 0 max(4px, env(safe-area-inset-bottom))',
        maxWidth: '100vw'
      }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none', flex: 1 }}>
              <motion.div
                whileTap={{ scale: 0.9 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  padding: '4px 4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: isActive ?
                  'linear-gradient(135deg, #E8212A, #FF6B35)' :
                  'transparent'
                }}>
                  <Icon size={16} color={isActive ? 'white' : 'var(--text-secondary)'} strokeWidth={2} />
                </div>
                <span style={{
                  fontSize: '0.58rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#E8212A' : 'var(--text-tertiary)'
                }}>
                  {item.label}
                </span>
              </motion.div>
            </NavLink>);

        })}
      </nav>
      }

      {

      }
      <AnimatePresence>
        {showSettings &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSettings}
          style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20
          }}>
            <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16, width: '100%', maxWidth: 440,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}>
              {}
              <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>Account Settings</h3>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={closeSettings}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <X size={15} />
                </motion.button>
              </div>

              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {!profileData &&
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div className="skeleton skeleton-avatar" />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="skeleton skeleton-line sm" />
                        <div className="skeleton skeleton-line" style={{ maxWidth: 160 }} />
                      </div>
                    </div>
                    <div className="skeleton skeleton-field" />
                    <div className="skeleton skeleton-field" />
                    <div className="skeleton skeleton-field" />
                  </div>
                }

                {profileData &&
                <>

                {}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                  width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  background: pendingPic || getProfilePicUrl(profileData?.profilePic) ? 'none' : 'linear-gradient(135deg, #E8212A, #FF6B35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: pendingPic ? '3px solid #E8212A' : '3px solid var(--border)',
                  transition: 'border-color 0.2s'
                }}>
                    {pendingPic ?
                  <img src={pendingPic.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
                  getProfilePicUrl(profileData?.profilePic) ?
                  <img src={getProfilePicUrl(profileData.profilePic)} alt="" onError={(e) => handleImgError(e, profileData?.profilePic)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :

                  <UserIcon size={26} style={{ color: 'white' }} />
                  }
                  </div>
                  <div>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => picInputRef.current?.click()}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    background: 'var(--surface-alt)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}>
                      <Camera size={14} /> {pendingPic ? 'Change' : 'Upload'}
                    </motion.button>
                    {pendingPic && <p style={{ fontSize: '0.68rem', color: '#E8212A', margin: '6px 0 0', fontWeight: 500 }}>{t('Ready to save')}</p>}
                    <input ref={picInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    try {
                      if (!e?.target?.files) {
                        toast.error('File input error. Please try again.');
                        return;
                      }
                      const file = e.target.files[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('File size must be less than 5 MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setCropSrc(reader.result);
                      reader.onerror = () => toast.error('Error reading file');
                      reader.readAsDataURL(file);
                    } catch (err) {
                      toast.error('Error selecting file: ' + (err.message || 'Unknown error'));
                    }
                    e.target.value = '';
                  }} />
                  
                  </div>
                </div>

                {}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Username</label>
                  <input
                  value={settingsForm.username}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, username: e.target.value }))}
                  className={usernameError ? 'input-error' : ''}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--surface-alt)',
                    color: 'var(--text)', fontSize: '0.88rem', outline: 'none',
                    boxSizing: 'border-box'
                  }} />

                  {usernameError ?
                <p className="input-help error">{usernameError}</p> :
                profileData?.lastUsernameChange ?
                <p className="input-help info">{t('Can change once every 30 days')}</p> :
                usernameChanged ?
                <p className="input-help info">{t('Username will update when you apply changes.')}</p> :
                null}
                </div>

                {}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Lock size={12} /> Change Password
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                    type="password"
                    placeholder="Current password"
                    value={settingsForm.oldPassword}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, oldPassword: e.target.value }))}
                    className={passwordChangeStarted && !settingsForm.oldPassword ? 'input-error' : ''}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--surface-alt)',
                      color: 'var(--text)', fontSize: '0.88rem', outline: 'none',
                      boxSizing: 'border-box'
                    }} />
                  
                    <input
                    type="password"
                    placeholder="New password"
                    value={settingsForm.newPassword}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, newPassword: e.target.value }))}
                    className={passwordError && settingsForm.newPassword ? 'input-error' : ''}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--surface-alt)',
                      color: 'var(--text)', fontSize: '0.88rem', outline: 'none',
                      boxSizing: 'border-box'
                    }} />

                    {passwordError && <p className="input-help error">{passwordError}</p>}
                  </div>
                </div>

                {}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Award size={12} /> My Badges
                  </label>
                  {badges.length === 0 ?
                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0 }}>{t('No badges earned yet. Keep reporting!')}</p> :

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                      {badges.map((bId) => {
                    const def = allBadges.find((a) => a.id === bId);
                    if (!def) return null;
                    const Icon = ICON_MAP[def.icon] || Award;
                    const isEquipped = equippedBadge === bId;
                    return (
                      <motion.button
                        key={bId}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => equipBadge(isEquipped ? '' : bId)}
                        style={{
                          padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                          background: isEquipped ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.22))' : 'var(--surface-alt)',
                          border: isEquipped ? '2px solid #f59e0b' : '1px solid var(--border)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          transition: 'all 0.2s ease'
                        }}>
                            <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                              <Icon size={15} style={{ color: 'white' }} />
                            </div>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2 }}>{def.label}</span>
                            <span style={{
                          fontSize: '0.6rem', fontWeight: 700,
                          color: isEquipped ? '#f59e0b' : 'var(--text-tertiary)'
                        }}>
                              {isEquipped ? 'EQUIPPED' : 'EQUIP'}
                            </span>
                          </motion.button>);

                  })}
                    </div>
                }
                </div>
                </>
                }
              </div>

              {}
              <div style={{
              padding: '16px 24px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'flex-end', gap: 10
            }}>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={closeSettings}
              style={{
                padding: '10px 20px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface-alt)',
                color: 'var(--text-secondary)', fontSize: '0.84rem', fontWeight: 600,
                cursor: 'pointer'
              }}>
                  Cancel
                </motion.button>
                <motion.button whileHover={canApplyChanges ? { scale: 1.03 } : {}} whileTap={canApplyChanges ? { scale: 0.97 } : {}}
              onClick={handleApplyChanges}
              disabled={!canApplyChanges}
              aria-busy={settingsLoading}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none',
                background: canApplyChanges ?
                'linear-gradient(135deg, #E8212A, #FF6B35)' : 'var(--surface-alt)',
                color: canApplyChanges ? 'white' : 'var(--text-tertiary)',
                fontSize: '0.84rem', fontWeight: 700,
                cursor: canApplyChanges ? 'pointer' : 'default',
                boxShadow: canApplyChanges ? '0 2px 10px rgba(232,33,42,0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}>
                  {settingsLoading ? 'Applying...' : 'Apply Changes'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {}
      <AnimatePresence>
        {cropSrc &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ImageCropper
            imageSrc={cropSrc}
            onCancel={() => setCropSrc(null)}
            onCropDone={handleProfilePicCropped} />
          
          </motion.div>
        }
      </AnimatePresence>
    </>);

};

export default Navbar;