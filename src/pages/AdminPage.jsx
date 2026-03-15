import React, { useState, useEffect } from 'react';
import MapOverlay, { deriveSearchQuery } from '../components/MapOverlay';
import MapPicker from '../components/MapPicker';
import axios from 'axios';
import { API_URL, getImgUrl, getImgFallbackUrl } from '../config';
import {
  Lock, User, ShieldCheck, CheckCircle, XCircle, Trash2, Search,
  AlertCircle, Loader2, Megaphone, Activity, Users, Settings,
  Plus, FileText, ChevronRight, Filter, PieChart, Info, MapPin,
  ExternalLink, Calendar, PlusCircle, Check, Eye, Bell, Send, Camera,
  Menu, X as XIcon } from
'lucide-react';
import Lightbox from '../components/Lightbox';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';


const buttonMotion = { whileHover: { scale: 1.04 }, whileTap: { scale: 0.96 } };
const modalMotion = { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.9, opacity: 0 }, transition: { type: 'spring', stiffness: 300, damping: 30 } };

const AdminPage = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const [platformUsers, setPlatformUsers] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [showBanModal, setShowBanModal] = useState(null);
  const [banDuration, setBanDuration] = useState(7);
  const [banReasonText, setBanReasonText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const [campaigns, setCampaigns] = useState([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    title: '', description: '', image: '', target: '',
    location: '', mapUrl: '', startDate: '', endDate: '', motives: '', organizerSocial: { instagram: '', twitter: '', website: '' }
  });

  const [admins, setAdmins] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '', password: '',
    permissions: {
      viewComplaints: true,
      approveComplaint: false,
      resolveComplaint: false,
      removeComplaint: false,
      addCampaigns: true,
      deleteCampaign: false,
      viewLogs: false,
      manageAdmins: false,
      manageUsers: false,
      broadcastNotification: false
    },
    organizerDetails: {
      name: '',
      twitter: '',
      instagram: '',
      website: ''
    }
  });

  const [logs, setLogs] = useState([]);
  const [campaignRegs, setCampaignRegs] = useState(null);
  const [userModalStep, setUserModalStep] = useState(1);
  const [modalType, setModalType] = useState('Staff');
  const [mapQuery, setMapQuery] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);


  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState([]);

  const isSuperAdmin = adminData?.username === 'sohailk2064';

  const handleImgError = (e, rawUrl) => {
    const fallback = getImgFallbackUrl(rawUrl);
    if (fallback && e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
      return;
    }
    e.currentTarget.style.display = 'none';
  };

  const clearAdminSession = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    setLoggedIn(false);
    setAdminData(null);
  };

  const handleAdminRequestError = (err, fallbackMessage) => {
    const status = err?.response?.status;
    const message = err?.response?.data?.message;
    if (status === 401 || message === 'Admin access required' || message === 'Admin token expired' || message === 'Invalid admin token') {
      clearAdminSession();
      toast.error('Admin session expired. Please login again.');
      return true;
    }
    if (fallbackMessage) toast.error(fallbackMessage);
    return false;
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const data = JSON.parse(localStorage.getItem('adminData'));
    if (token && data) {
      setLoggedIn(true);
      setAdminData(data);


      fetchSuggestions();
      fetchCampaigns();
      if (data.username === 'sohailk2064') {
        fetchAdmins();
      }
      if (data.permissions?.viewLogs || data.username === 'sohailk2064') fetchLogs();


      if (data.username !== 'sohailk2064' && data.organizerDetails) {
        setNewCampaign((prev) => ({
          ...prev,
          organizerSocial: {
            name: data.organizerDetails.name || '',
            instagram: data.organizerDetails.instagram || '',
            twitter: data.organizerDetails.twitter || '',
            website: data.organizerDetails.website || ''
          }
        }));
      }
    }
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);


  useEffect(() => {
    if (loggedIn) {
      if (activeTab === 'Logs') fetchLogs();
      if (activeTab === 'Home') fetchSuggestions();
      if (activeTab === 'Campaigns') fetchCampaigns();
      if (activeTab === 'Userperms' && isSuperAdmin) fetchAdmins();
      if (activeTab === 'Users' && isSuperAdmin) fetchPlatformUsers();
      if (activeTab === 'Notifications' && isSuperAdmin) fetchBroadcastHistory();
    }
  }, [activeTab]);

  const fetchPlatformUsers = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/admin/platform-users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      setPlatformUsers(r.data);
    } catch (err) {handleAdminRequestError(err, 'Failed to load platform users.');}
  };

  const banUser = async (userId, type, days = 0, reason = '') => {
    try {
      await axios.post(`${API_URL}/api/admin/platform-users/${userId}/ban`,
      { banType: type, durationDays: days, reason: reason },
      { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }
      );
      toast.success(`User ${type === 'none' ? 'unbanned' : 'banned'}`);
      setShowBanModal(null);
      setBanReasonText('');
      fetchPlatformUsers();
      fetchLogs();
    } catch {toast.error('Action failed');}
  };

  const deletePlatformUser = async (userId) => {
    if (!confirm('Permanently delete this user account? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/platform-users/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      toast.success('User account deleted');
      fetchPlatformUsers();
      fetchLogs();
    } catch {toast.error('Deletion failed');}
  };

  const fetchSuggestions = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/admin/suggestions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      setSuggestions(r.data);
    } catch (err) {handleAdminRequestError(err, 'Failed to load complaints.');}
  };

  const fetchCampaigns = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/campaigns`);
      setCampaigns(r.data);
    } catch {}
  };

  const fetchAdmins = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      setAdmins(r.data);
    } catch (err) {handleAdminRequestError(err);}
  };

  const fetchLogs = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/admin/logs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      setLogs(r.data);
    } catch (err) {handleAdminRequestError(err);}
  };

  const sendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {toast.error('Title and message are required.');return;}
    setBroadcasting(true);
    try {
      const r = await axios.post(`${API_URL}/api/admin/broadcast-notification`,
      { title: broadcastTitle, message: broadcastMessage },
      { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }
      );
      toast.success(r.data.message);
      setBroadcastTitle('');setBroadcastMessage('');
      fetchBroadcastHistory();
    } catch {toast.error('Failed to send notification.');} finally
    {setBroadcasting(false);}
  };

  const fetchBroadcastHistory = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/admin/broadcast-history`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } }
      );
      setBroadcastHistory(r.data);
    } catch {}
  };

  const deleteBroadcast = async (title, message) => {
    if (!confirm('Delete this broadcast? It will be removed from all users\' notifications.')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/broadcast-notification`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
        data: { title, message }
      });
      toast.success('Broadcast deleted');
      fetchBroadcastHistory();
    } catch {toast.error('Failed to delete broadcast');}
  };

  const login = async (e) => {
    e.preventDefault();setLoading(true);
    try {
      const r = await axios.post(`${API_URL}/api/admin/login`, { username, password });
      localStorage.setItem('adminToken', r.data.token);
      localStorage.setItem('adminData', JSON.stringify(r.data.user));
      setAdminData(r.data.user);
      setLoggedIn(true);toast.success('Welcome back, ' + r.data.user.username);
      window.location.reload();
    } catch {toast.error('Invalid credentials');} finally
    {setLoading(false);}
  };

  const updateStatus = async (id, status, reason = '') => {
    try {
      await axios.patch(`${API_URL}/api/suggestions/${id}/status`,
      { status, rejectionReason: reason },
      { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });
      toast.success('Status updated to ' + status);
      setRejectModal(null);setRejectReason('');fetchSuggestions();fetchLogs();
    } catch (err) {toast.error(err.response?.data?.message || 'Update failed');}
  };

  const removeComplaint = async (id) => {
    if (!confirm('Permanently delete this complaint record?')) return;
    try {
      await axios.delete(`${API_URL}/api/suggestions/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      toast.success('Complaint removed');fetchSuggestions();fetchLogs();
    } catch (err) {toast.error(err.response?.data?.message || 'Delete failed');}
  };

  const uploadAfterImages = async (id, files) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).slice(0, 3).forEach((f) => fd.append('images', f));
    try {
      await axios.post(`${API_URL}/api/suggestions/${id}/after-images`, fd, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('After-images uploaded');
      fetchSuggestions();
    } catch (err) {toast.error(err.response?.data?.message || 'Upload failed');}
  };

  const createCampaign = async () => {
    try {

      const motivesArr = newCampaign.motives.split(',').map((m) => m.trim()).filter((m) => m);
      await axios.post(`${API_URL}/api/admin/campaigns`, { ...newCampaign, motives: motivesArr }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      toast.success('Campaign launched');setShowCampaignModal(false);fetchCampaigns();fetchLogs();
    } catch (err) {toast.error('Creation failed');}
  };

  const deleteCampaign = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      toast.success('Campaign removed');fetchCampaigns();fetchLogs();
    } catch (err) {toast.error('Delete failed');}
  };

  const viewRegistrations = async (id) => {
    try {
      const r = await axios.get(`${API_URL}/api/admin/campaigns/${id}/registrations`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      setCampaignRegs({ campaignId: id, data: r.data });
    } catch {toast.error('Could not load registrations');}
  };

  const createUser = async () => {
    try {
      await axios.post(`${API_URL}/api/admin/users`, newUser, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      toast.success('Admin account created');setShowUserModal(false);fetchAdmins();fetchLogs();
    } catch (err) {toast.error('Failed to create admin');}
  };

  const deleteUser = async (id) => {
    if (!confirm('Revoke access for this admin?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });
      toast.success('Access revoked');fetchAdmins();fetchLogs();
    } catch {toast.error('Revocation failed');}
  };

  const filtered = suggestions.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = (s.title || '').toLowerCase().includes(q) || (s.complaintId || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    const sPriority = s.priorityLevel || (s.analysis ? s.analysis.priority : 'Normal');
    const matchesPriority = priorityFilter === 'All' || 
                            (priorityFilter === 'High' && (sPriority === 'High' || sPriority === 'Critical')) ||
                            sPriority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    // Bring critical/high priority to the top
    const pA = a.priorityLevel || (a.analysis ? a.analysis.priority : 'Normal');
    const pB = b.priorityLevel || (b.analysis ? b.analysis.priority : 'Normal');
    const priorityWeight = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'Normal': 1 };
    
    // Sort by priority first (highest to lowest), then by date
    const weightDiff = (priorityWeight[pB] || 1) - (priorityWeight[pA] || 1);
    if (weightDiff !== 0) return weightDiff;
    
    return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp);
  });

  const stats = {
    total: suggestions.length,
    pending: suggestions.filter((s) => s.status === 'Pending').length,
    active: suggestions.filter((s) => ['Progress', 'Approved'].includes(s.status)).length,
    resolved: suggestions.filter((s) => s.status === 'Resolved').length
  };

  if (!loggedIn) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '40px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ width: 56, height: 56, borderRadius: '10px', background: 'var(--primary-accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.2)' }}>
              <ShieldCheck size={28} />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>Admin Access</h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 500 }}>Admin dashboard</p>
          </div>
          
          <form onSubmit={login} style={{ display: 'grid', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Username
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 40px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
                
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                <input
                  type="password"
                  placeholder="????????????????????????"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 40px',
                    border: '1.5px solid var(--border)',
                    borderRadius: '10px',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
                
              </div>
            </div>
            
            <motion.button
              {...buttonMotion}
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                padding: '12px 20px',
                background: 'var(--primary-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
                opacity: loading ? 0.7 : 1,
                height: 44
              }}>
              {loading ?
              <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Signing in...
                </> :

              <>
                  <ShieldCheck size={16} />
                  Access Systems
                </>
              }
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>);


  return (
    <div className="admin-page-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', position: 'relative', width: '100%', overflowX: 'hidden' }}>
      {}
      <div
        className={`admin-sidebar-overlay${mobileNavOpen ? ' open' : ''}`}
        onClick={() => setMobileNavOpen(false)} />
      

      {}
      <aside className={`admin-sidebar${mobileNavOpen ? ' open' : ''}`} style={{ width: 240, borderRight: '1.5px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', padding: isMobileView ? '16px 12px' : '24px 16px', overflowY: 'auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, background: 'var(--primary-accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
              <ShieldCheck size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 850, fontSize: '0.95rem', color: 'var(--text)' }}>Admin</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>v2.0</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {[
          { id: 'Home', icon: Activity, label: 'Issues', hidden: !adminData?.permissions?.viewComplaints && !isSuperAdmin },
          { id: 'Campaigns', icon: Megaphone, label: 'Campaigns', hidden: !adminData?.permissions?.addCampaigns && !adminData?.permissions?.deleteCampaign && !isSuperAdmin },
          { id: 'Users', icon: Users, label: 'Platform Users', hidden: !adminData?.permissions?.manageUsers && !isSuperAdmin },
          { id: 'Notifications', icon: Bell, label: 'Notifications', hidden: !adminData?.permissions?.broadcastNotification && !isSuperAdmin },
          { id: 'Userperms', icon: ShieldCheck, label: 'Admins', hidden: !adminData?.permissions?.manageAdmins && !isSuperAdmin },
          { id: 'Logs', icon: FileText, label: 'Logs', hidden: !adminData?.permissions?.viewLogs && !isSuperAdmin }].
          filter((t) => !t.hidden).map((t) =>
          <button
            key={t.id}
            onClick={() => {setActiveTab(t.id);setMobileNavOpen(false);}}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: '8px',
              background: activeTab === t.id ? 'var(--primary-accent)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: activeTab === t.id ? 700 : 600,
              fontSize: '0.9rem',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== t.id) {
                e.target.style.background = 'var(--surface-3)';
                e.target.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== t.id) {
                e.target.style.background = 'transparent';
                e.target.style.color = 'var(--text-secondary)';
              }
            }}>
              <t.icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t.label}</span>
              {activeTab === t.id && <div style={{ width: 3, height: 16, background: 'white', borderRadius: 2, flexShrink: 0 }} />}
            </button>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '0 8px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '6px', background: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {adminData?.username[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {adminData?.username}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                {isSuperAdmin ? 'Super Admin' : 'Staff'}
              </div>
            </div>
          </div>
          <button
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              color: '#dc2626',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s ease'
            }}
            onClick={() => {localStorage.clear();window.location.reload();}}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(220, 38, 38, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}>
            <Lock size={14} /> End Session
          </button>
        </div>
      </aside>

      {}
      <main className="admin-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: isMobileView ? '12px 10px' : '28px 24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          {}
          <button
            className="admin-ham"
            onClick={() => setMobileNavOpen((v) => !v)}
            style={{
              alignItems: 'center', gap: 8, marginBottom: 16,
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
              color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem'
            }}>
            
            {mobileNavOpen ? <XIcon size={18} /> : <Menu size={18} />}
            {mobileNavOpen ? 'Close' : 'Menu'}
          </button>
          
          {}
          {activeTab === 'Home' &&
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <header style={{ marginBottom: isMobileView ? 16 : 32 }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>
                  Issues
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
                  Review and manage reports
                </p>
              </header>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(${isMobileView ? 120 : 160}px, 100%), 1fr))`, gap: isMobileView ? 10 : 16, marginBottom: isMobileView ? 16 : 32 }}>
                {[
              { label: 'Pending', value: stats.pending, color: '#f59e0b' },
              { label: 'Active', value: stats.active, color: 'var(--primary-accent)' },
              { label: 'Resolved', value: stats.resolved, color: '#22c55e' },
              { label: 'Total', value: stats.total, color: 'var(--text-secondary)' }].
              map((stat, i) =>
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: isMobileView ? '12px' : '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: isMobileView ? '1.5rem' : '2.2rem', fontWeight: 900, color: stat.color, marginBottom: 6 }}>{stat.value}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{stat.label}</div>
                  </div>
              )}
              </div>

              <div className="issue-filter-row" style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                  <input
                  placeholder="Search by ID or title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 40px',
                    border: '1.5px solid var(--border)',
                    borderRadius: '10px',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
                
                </div>
                <div className="issue-filters" style={{ display: 'flex', gap: 6, padding: '6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  {['All', 'Pending', 'Progress', 'Resolved'].map((filter) =>
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: statusFilter === filter ? 'var(--primary-accent)' : 'transparent',
                      color: statusFilter === filter ? 'white' : 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: statusFilter === filter ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (statusFilter !== filter) {
                        e.target.style.background = 'var(--surface-3)';
                        e.target.style.color = 'var(--text)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (statusFilter !== filter) {
                        e.target.style.background = 'transparent';
                        e.target.style.color = 'var(--text-secondary)';
                      }
                    }}>
                        {filter}
                      </button>
                  )}
                </div>

                {/* Priority/AI Analysis Filters */}
                <div className="priority-filters" style={{ display: 'flex', gap: 6, padding: '6px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ padding: '8px 10px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                    AI Priority
                  </div>
                  {['All', 'Critical', 'High', 'Medium', 'Low'].map((filter) =>
                  <button
                    key={filter}
                    onClick={() => setPriorityFilter(filter)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: priorityFilter === filter ? 
                        (filter === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : filter === 'High' ? 'rgba(249, 115, 22, 0.2)' : filter === 'Medium' ? 'rgba(245, 158, 11, 0.2)' : filter === 'Low' ? 'rgba(34, 197, 94, 0.2)' : 'var(--primary-accent)') 
                        : 'transparent',
                      color: priorityFilter === filter ? 
                        (filter === 'Critical' ? '#ef4444' : filter === 'High' ? '#f97316' : filter === 'Medium' ? '#f59e0b' : filter === 'Low' ? '#22c55e' : 'white')
                        : 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: priorityFilter === filter ? 700 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (priorityFilter !== filter) {
                        e.target.style.background = 'var(--surface-3)';
                        e.target.style.color = 'var(--text)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (priorityFilter !== filter) {
                        e.target.style.background = 'transparent';
                        e.target.style.color = 'var(--text-secondary)';
                      }
                    }}>
                      {filter}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {filtered.length === 0 ?
              <div style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <AlertCircle size={40} style={{ color: 'var(--text-tertiary)', marginBottom: 16 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No issues</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>Try adjusting your search or filters</p>
                  </div> :
              filtered.map((s) =>
              <div
                key={s._id}
                className="issue-card"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: isMobileView ? '12px' : '20px',
                  display: 'flex',
                  gap: isMobileView ? 10 : 20,
                  alignItems: 'flex-start',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-accent)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: s.status === 'Pending' ? 'rgba(245, 158, 11, 0.1)' :
                      s.status === 'Progress' ? 'rgba(59, 130, 246, 0.1)' :
                      'rgba(34, 197, 94, 0.1)',
                      color: s.status === 'Pending' ? '#f59e0b' :
                      s.status === 'Progress' ? 'var(--primary-accent)' :
                      '#22c55e'
                    }}>
                          {s.status}
                        </span>
                        <span style={{ padding: '2px 8px', background: 'var(--surface-3)', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                          {s.complaintId}
                        </span>

                        {(() => {
                          const pLev = s.priorityLevel || (s.analysis ? s.analysis.priority : null);
                          if (!pLev) return null;
                          const pColor = pLev === 'Critical' ? '#ef4444' : pLev === 'High' ? '#f97316' : pLev === 'Medium' ? '#f59e0b' : '#22c55e';
                          const pBg = pLev === 'Critical' ? 'rgba(239, 68, 68, 0.1)' : pLev === 'High' ? 'rgba(249, 115, 22, 0.1)' : pLev === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)';
                          return (
                            <span style={{ padding: '2px 8px', background: pBg, borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, color: pColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <AlertCircle size={10} /> {pLev} Priority
                            </span>
                          );
                        })()}

                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                          Ward {s.wada} ??? {s.city}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0' }}>
                        {s.title}
                      </h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        {s.description}
                      </p>

                      {s.analysis && s.analysis.feedback && (
                        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <Activity size={16} color="var(--primary-accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text)', margin: '0 0 4px 0', fontWeight: 600 }}>AI Analysis & Sentiment</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{s.analysis.feedback}</p>
                            {s.analysis.sentimentScore && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--primary-accent)', margin: '4px 0 0 0', fontWeight: 600 }}>Sentiment Score: {s.analysis.sentimentScore}/100</p>
                            )}
                          </div>
                        </div>
                      )}

                      {Array.isArray(s.images) && s.images.length > 0 &&
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          {s.images.map((img, i) =>
                    <img key={i} src={getImgUrl(img)} alt="" onError={(e) => handleImgError(e, img)} onClick={() => setLightbox({ images: s.images.map((im) => getImgUrl(im)), index: i })} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} loading="lazy" />
                    )}
                        </div>
                  }

                      {Array.isArray(s.imageVerification) && s.imageVerification.length > 0 &&
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
                          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
                            Metadata Review
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {s.imageVerification.map((iv, i) => {
                        const metres = iv.distanceFromComplaint != null ? Math.round(iv.distanceFromComplaint * 1000) : null;
                        const issues = [];
                        if (!iv.hasGPS) issues.push('No image location metadata');
                        if (iv.hasGPS && iv.isLocationMatch === false) issues.push(`450m+ away from pinned location${metres != null ? ` (${metres}m)` : ''}`);
                        if (!iv.hasTimestamp) issues.push('No image timestamp metadata');
                        if (iv.hasTimestamp && iv.isTimestampRecent === false) issues.push(`Time mismatch (too old${iv.ageDays != null ? `, ${iv.ageDays} days` : ''})`);

                        return (
                          <div key={`iv-${i}`} style={{ fontSize: '0.76rem', color: issues.length ? '#b91c1c' : '#065f46' }}>
                                {issues.length ? `Image ${i + 1}: ${issues.join(' | ')}` : `Image ${i + 1}: Metadata OK`}
                              </div>
                        );
                      })}
                          </div>
                        </div>
                  }
                    </div>
                    <div className="issue-actions" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
                      {s.status === 'Pending' &&
                  <button
                    onClick={() => updateStatus(s._id, 'Progress')}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--primary-accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                    onMouseLeave={(e) => e.target.style.background = 'var(--primary-accent)'}>
                          <CheckCircle size={12} /> Approve
                        </button>
                  }
                      {(s.status === 'Progress' || s.status === 'Approved') &&
                  <>
                          <button
                      onClick={() => updateStatus(s._id, 'Resolved')}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(34, 197, 94, 0.1)',
                        color: '#22c55e',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#22c55e';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(34, 197, 94, 0.1)';
                        e.target.style.color = '#22c55e';
                      }}>
                            <Check size={12} /> Resolve
                          </button>
                          <button
                      onClick={() => updateStatus(s._id, 'Pending')}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#f59e0b';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(245, 158, 11, 0.1)';
                        e.target.style.color = '#f59e0b';
                      }}>
                            <XCircle size={12} /> Lift
                          </button>
                        </>
                  }
                      <button
                    onClick={() => setRejectModal({ id: s._id })}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(220, 38, 38, 0.1)',
                      color: '#dc2626',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#dc2626';
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(220, 38, 38, 0.1)';
                      e.target.style.color = '#dc2626';
                    }}>
                        <XCircle size={12} /> Reject
                      </button>
                      <button
                    onClick={() => removeComplaint(s._id)}
                    style={{
                      padding: '8px 12px',
                      background: 'transparent',
                      color: '#dc2626',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = '#dc2626';
                      e.target.style.background = 'rgba(220, 38, 38, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = 'var(--border)';
                      e.target.style.background = 'transparent';
                    }}>
                        <Trash2 size={12} /> Delete
                      </button>
                      {s.status === 'Resolved' &&
                  <label style={{
                    padding: '8px 12px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    transition: 'all 0.2s ease'
                  }}>
                          <Camera size={12} /> After Photos
                          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={(e) => {uploadAfterImages(s._id, e.target.files);e.target.value = '';}} />
                        </label>
                  }
                      {s.status === 'Resolved' && Array.isArray(s.afterImages) && s.afterImages.length > 0 &&
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          {s.afterImages.map((img, i) =>
                    <img key={i} src={getImgUrl(img)} alt="" onError={(e) => handleImgError(e, img)} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(34,197,94,0.3)' }} loading="lazy" />
                    )}
                        </div>
                  }
                    </div>
                  </div>
              )}
              </div>
            </motion.div>
          }

          {}
          {activeTab === 'Campaigns' &&
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <header style={{ marginBottom: isMobileView ? 16 : 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: isMobileView ? 'wrap' : 'nowrap' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>Campaigns</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>Launch community initiatives and track engagement</p>
                </div>
                <button
                onClick={() => setShowCampaignModal(true)}
                style={{
                  padding: '10px 16px',
                  background: 'var(--primary-accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                onMouseLeave={(e) => e.target.style.background = 'var(--primary-accent)'}>
                  <PlusCircle size={16} /> New Campaign
                </button>
              </header>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${isMobileView ? 260 : 400}px, 100%), 1fr))`, gap: isMobileView ? 12 : 20 }}>
                {campaigns.map((c) =>
              <div key={c._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ aspectRatio: '16/9', position: 'relative' }}>
                      <img src={c.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.6))' }} />
                      <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20, color: 'white' }}>
                        <h4 className="fw-8" style={{ fontSize: '1.1rem' }}>{c.title}</h4>
                      </div>
                    </div>
                    <div style={{ padding: 20 }}>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                         <div>
                           <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase' }}>Target</div>
                           <div className="text-xs fw-7">{c.target}</div>
                         </div>
                         <div>
                           <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase' }}>Status</div>
                           <div className="text-xs fw-7 text-accent">{c.startDate && new Date(c.startDate) > new Date() ? 'Not Started' : c.status}</div>
                         </div>
                         <div>
                           <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase' }}>End Date</div>
                           <div className="text-xs fw-7">{c.endDate ? new Date(c.endDate).toLocaleDateString() : 'None'}</div>
                         </div>
                      </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                 <button className="btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => viewRegistrations(c._id)}><Users size={14} /> Registrants</button>
                                 {}
                                 {(c.location && c.location.trim() !== '' || c.mapUrl) &&
                    <button className="btn-ghost btn-sm" onClick={() => setMapQuery(deriveSearchQuery(c.location, c.mapUrl))} style={{ justifyContent: 'center' }}>
                                     <MapPin size={14} /> Map location
                                   </button>
                    }
                                 <button className="btn-ghost danger btn-sm" onClick={() => deleteCampaign(c._id)}><Trash2 size={14} /></button>
                              </div>
                    </div>
                  </div>
              )}
              </div>
            </motion.div>
          }

          {}
          {activeTab === 'Userperms' &&
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <header style={{ marginBottom: isMobileView ? 18 : 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: isMobileView ? 'wrap' : 'nowrap' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>Access Control</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>Manage staff and permissions</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                  onClick={() => {setModalType('Staff');setUserModalStep(1);setShowUserModal(true);}}
                  style={{
                    padding: '10px 16px',
                    background: 'var(--surface-3)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = 'var(--primary-accent)';
                    e.target.style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = 'var(--border)';
                    e.target.style.background = 'var(--surface-3)';
                  }}>
                    <PlusCircle size={16} /> Add Staff Admin
                  </button>
                  <button
                  onClick={() => {setModalType('Campaigner');setUserModalStep(1);setShowUserModal(true);}}
                  style={{
                    padding: '10px 16px',
                    background: 'var(--primary-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                  onMouseLeave={(e) => e.target.style.background = 'var(--primary-accent)'}>
                    <Megaphone size={16} /> Add Campaigner
                  </button>
                </div>
              </header>

              <div style={{ display: 'grid', gap: isMobileView ? 10 : 16 }}>
                {admins.length === 0 ?
              <div style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <Users size={40} style={{ color: 'var(--text-tertiary)', marginBottom: 16 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No admin accounts yet</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>Add your first admin to get started</p>
                  </div> :
              admins.map((a) =>
              <div
                key={a._id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: isMobileView ? '12px' : '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobileView ? 10 : 18,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-accent)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                    <div style={{ width: 48, height: 48, borderRadius: '8px', background: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                      {a.username[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 10px 0' }}>
                        {a.username}
                      </h4>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.entries(a.permissions).filter(([_, v]) => v).map(([k]) =>
                    <span
                      key={k}
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: 'var(--surface-3)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        whiteSpace: 'nowrap'
                      }}>
                            {k.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}
                          </span>
                    )}
                      </div>
                    </div>
                    <button
                  onClick={() => deleteUser(a._id)}
                  style={{
                    padding: '10px',
                    background: 'transparent',
                    color: '#dc2626',
                    border: '1px solid rgba(220, 38, 38, 0.2)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#dc2626';
                    e.target.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#dc2626';
                  }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
              )}
              </div>
            </motion.div>
          }

          {}
          {activeTab === 'Logs' &&
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <header style={{ marginBottom: isMobileView ? 16 : 32 }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>Audit Logs</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>Immutable record of every administrative action on the platform</p>
              </header>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Administrator</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Operation</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Details</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ?
                    <tr>
                          <td colSpan={4} style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <FileText size={40} style={{ color: 'var(--text-tertiary)', marginBottom: 16 }} />
                            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4, margin: 0 }}>No logs yet</p>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>Admin actions will appear here</p>
                          </td>
                        </tr> :
                    logs.map((l, i) =>
                    <tr
                      key={l._id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(59, 130, 246, 0.02)',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(59, 130, 246, 0.02)'}>
                          <td style={{ padding: '14px 20px', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600 }}>
                            {l.adminName}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--primary-accent)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          display: 'inline-block'
                        }}>
                              {l.action}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {l.details}
                          </td>
                          <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                            {new Date(l.timestamp).toLocaleString()}
                          </td>
                        </tr>
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          }

          {}
          {activeTab === 'Users' && isSuperAdmin &&
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <header style={{ marginBottom: isMobileView ? 16 : 32 }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>Registry of Users</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>User management and security</p>
              </header>

              <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                  <input
                  placeholder="Search by username or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }} />
                
                </div>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Citizen</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contact / Security</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Club Status</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Registered</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformUsers.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())).map((u) =>
                    <tr
                      key={u._id}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, user: u });
                      }}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s ease', cursor: 'context-menu' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <img src={getImgUrl(u.profilePic)} onError={(e) => handleImgError(e, u.profilePic)} style={{ width: 32, height: 32, borderRadius: '6px' }} alt="" />
                              <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{u.username}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>ID: {u._id}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500 }}>{u.email}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                IP: {u.ipAddress || 'Hidden'} ??? {
                          u.deviceFootprint?.platform === 'Win32' ? 'Windows' :
                          u.deviceFootprint?.platform === 'MacIntel' ? 'MacOS' :
                          u.deviceFootprint?.platform || 'Unknown'
                          }
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{u.clubStatus}</span>
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800,
                          background: u.isBanned ? 'rgba(220, 38, 38, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                          color: u.isBanned ? '#dc2626' : '#22c55e',
                          textTransform: 'uppercase'
                        }}>
                              {u.isBanned ? u.banType === 'permanent' ? 'Perm Ban' : 'Soft Ban' : 'Active'}
                            </span>
                          </td>
                        </tr>
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
                ???? Tip: Right-click on a user to perform moderator actions.
              </p>
            </motion.div>
          }

          {activeTab === 'Notifications' && isSuperAdmin &&
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <header style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Broadcast Notifications</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Send a notification to all platform users.</p>
              </header>

              {}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(129,140,248,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Megaphone size={18} style={{ color: 'var(--primary-accent)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Compose Announcement</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>This will be sent to every registered user</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Title</label>
                    <input
                    className="input"
                    placeholder="e.g. Scheduled maintenance tonight"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    maxLength={100}
                    style={{ width: '100%' }} />
                  
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Message</label>
                    <textarea
                    className="input"
                    rows={4}
                    placeholder="Write your announcement message here..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    maxLength={500}
                    style={{ width: '100%', resize: 'vertical', minHeight: 80 }} />
                  
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '4px 0 0', textAlign: 'right' }}>{broadcastMessage.length}/500</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={sendBroadcast}
                    disabled={broadcasting || !broadcastTitle.trim() || !broadcastMessage.trim()}
                    style={{
                      padding: '10px 24px', borderRadius: 10, border: 'none',
                      background: broadcasting || !broadcastTitle.trim() || !broadcastMessage.trim() ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                      color: 'white', fontWeight: 700, fontSize: '0.88rem',
                      cursor: broadcasting || !broadcastTitle.trim() || !broadcastMessage.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      boxShadow: broadcasting || !broadcastTitle.trim() || !broadcastMessage.trim() ? 'none' : '0 2px 10px rgba(124,58,237,0.3)'
                    }}>
                      {broadcasting ? <><Loader2 size={14} className="spin" /> Sending...</> : <><Send size={14} /> Send to All Users</>}
                    </motion.button>
                  </div>
                </div>
              </div>

              {}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>Recent Broadcasts</h3>
                {broadcastHistory.length === 0 ?
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                    <Bell size={32} style={{ opacity: 0.3, marginBottom: 12 }} /><br />
                    No broadcasts sent yet.
                  </div> :

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {broadcastHistory.map((b, i) =>
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', flex: 1, minWidth: 0 }}>???? {b.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                              {new Date(b.timestamp).toLocaleDateString()} ?? {b.recipientCount} users
                            </div>
                            <button
                        onClick={() => deleteBroadcast(b.title, b.message)}
                        title="Delete broadcast"
                        style={{ padding: 6, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{b.message}</p>
                      </div>
                )}
                  </div>
              }
              </div>
            </motion.div>
          }
        </div>
      </main>

      {}
      <AnimatePresence>
        {rejectModal &&
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
            <motion.div className="modal-box" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="modal-header"><span className="modal-title">Rejection Feedback</span></div>
              <div className="modal-body">
                <p className="text-sm text-3" style={{ marginBottom: 12 }}>Explain why this complaint is not being processed.</p>
                <textarea className="input" rows={5} placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </div>
              <div className="modal-footer">
                 <button className="btn-danger btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus(rejectModal.id, 'Rejected', rejectReason)}>Submit Rejection</button>
              </div>
            </motion.div>
          </div>
        }

        {showCampaignModal &&
        <div className="modal-overlay" onClick={() => setShowCampaignModal(null)}>
            <motion.div className="modal-box" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="modal-header"><span className="modal-title">Launch New Campaign</span></div>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
                   <div>
                    <label className="label">Campaign Title</label>
                    <input className="input" placeholder="Save the Bagmati Drive" onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })} />
                   </div>
                   <div>
                    <label className="label">Target Audience</label>
                    <input className="input" placeholder="Youth / Ward 10 Residents" onChange={(e) => setNewCampaign({ ...newCampaign, target: e.target.value })} />
                   </div>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input" rows={3} placeholder="Describe the mission..." onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })} />
                </div>
                <div>
                    <label className="label">Cover Image URL</label>
                    <input className="input" placeholder="https://..." onChange={(e) => setNewCampaign({ ...newCampaign, image: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
                   <div>
                    <label className="label">Display Location</label>
                    <input className="input" placeholder="Bagmati River Bank" onChange={(e) => setNewCampaign({ ...newCampaign, location: e.target.value })} />
                   </div>
                   <div>
                    <label className="label">Pin on map</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input" placeholder="No location selected" value={newCampaign.location || ''} readOnly />
                      <button className="btn-ghost" onClick={() => setShowMapPicker(true)} style={{ whiteSpace: 'nowrap' }}>Pin location</button>
                    </div>
                   </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
                   <div>
                    <label className="label">Start Date</label>
                    <input className="input" type="date" onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })} />
                   </div>
                   <div>
                    <label className="label">End Date</label>
                    <input className="input" type="date" onChange={(e) => setNewCampaign({ ...newCampaign, endDate: e.target.value })} />
                   </div>
                </div>
                <div>
                  <label className="label">Motives (comma separated)</label>
                  <input className="input" placeholder="Cleanliness, Health, Awareness" onChange={(e) => setNewCampaign({ ...newCampaign, motives: e.target.value })} />
                </div>

                {isSuperAdmin &&
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <label className="label" style={{ marginBottom: 12 }}>Campaigner Identity</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16, marginBottom: 12 }}>
                        <div>
                          <label className="label text-xs">Organizer/Campaigner Name</label>
                          <input className="input" placeholder="Name" value={newCampaign.organizerSocial?.name || ''}
                    onChange={(e) => setNewCampaign({ ...newCampaign, organizerSocial: { ...newCampaign.organizerSocial, name: e.target.value } })} />
                        </div>
                        <div>
                          <label className="label text-xs">Website</label>
                          <input className="input" placeholder="URL" value={newCampaign.organizerSocial?.website || ''}
                    onChange={(e) => setNewCampaign({ ...newCampaign, organizerSocial: { ...newCampaign.organizerSocial, website: e.target.value } })} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
                        <div>
                          <label className="label text-xs">Instagram User</label>
                          <input className="input" placeholder="@handle" value={newCampaign.organizerSocial?.instagram || ''}
                    onChange={(e) => setNewCampaign({ ...newCampaign, organizerSocial: { ...newCampaign.organizerSocial, instagram: e.target.value } })} />
                        </div>
                        <div>
                          <label className="label text-xs">Twitter/X User</label>
                          <input className="input" placeholder="@handle" value={newCampaign.organizerSocial?.twitter || ''}
                    onChange={(e) => setNewCampaign({ ...newCampaign, organizerSocial: { ...newCampaign.organizerSocial, twitter: e.target.value } })} />
                        </div>
                    </div>
                  </div>
              }
              </div>
              <div className="modal-footer">
                <button className="btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} onClick={createCampaign}>Broadcast Campaign</button>
              </div>
            </motion.div>
          </div>
        }

        <AnimatePresence>
          {mapQuery && <MapOverlay query={mapQuery} onClose={() => setMapQuery(null)} />}
          {showMapPicker &&
          <MapPicker
            initial={null}
            onCancel={() => setShowMapPicker(false)}
            onConfirm={(picked) => {


              const googleUrl = `https://www.google.com/maps/search/?api=1&query=${picked.lat},${picked.lng}`;
              setNewCampaign((prev) => ({ ...prev, location: picked.display_name, mapUrl: googleUrl }));
              setShowMapPicker(false);
            }} />

          }
        </AnimatePresence>

        {showUserModal &&
        <div className="modal-overlay" onClick={() => setShowUserModal(null)}>
            <motion.div className="modal-box" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="modal-header">
                <span className="modal-title">
                  {modalType === 'Staff' ? 'New Staff Account' : 'New Campaigner Account'} 
                  {modalType === 'Campaigner' && ` (Step ${userModalStep}/2)`}
                </span>
                {modalType === 'Campaigner' && <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)' }}>{userModalStep}/2</span>}
              </div>
              <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
                {userModalStep === 1 ?
              <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
                      <div>
                        <label className="label">Admin Username</label>
                        <input className="input" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Access Password</label>
                        <input className="input" type="password" placeholder="????????????????????????" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                      </div>
                    </div>

                    {modalType === 'Staff' ?
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                        <label className="label" style={{ marginBottom: 12 }}>System Permissions</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
                          {Object.keys(newUser.permissions).map((p) =>
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.825rem', cursor: 'pointer', color: 'var(--text-3)' }}>
                              <input type="checkbox" checked={newUser.permissions[p]} onChange={(e) => setNewUser({ ...newUser, permissions: { ...newUser.permissions, [p]: e.target.checked } })} style={{ width: 16, height: 16 }} />
                              {p.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                            </label>
                    )}
                        </div>
                      </div> :

                <div style={{ background: 'var(--accent-subtle)', padding: 16, borderRadius: 10, border: '1px solid var(--accent-border)' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, margin: 0 }}>
                          ??? Campaigner accounts are automatically granted permissions to launch initiatives, manage them, and view registrant data.
                        </p>
                      </div>
                }
                  </> :

              <>
                    <p className="text-sm text-3">These details will be shown publicly to users on campaigns this admin creates.</p>
                    <div>
                      <label className="label">Display Name / Organization</label>
                      <input className="input" placeholder="e.g. Pariwartan Youth Club" value={newUser.organizerDetails.name} onChange={(e) => setNewUser({ ...newUser, organizerDetails: { ...newUser.organizerDetails, name: e.target.value } })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 16 }}>
                      <div>
                        <label className="label">Instagram Link</label>
                        <input className="input" placeholder="https://instagram.com/..." value={newUser.organizerDetails.instagram} onChange={(e) => setNewUser({ ...newUser, organizerDetails: { ...newUser.organizerDetails, instagram: e.target.value } })} />
                      </div>
                      <div>
                        <label className="label">Twitter Link</label>
                        <input className="input" placeholder="https://twitter.com/..." value={newUser.organizerDetails.twitter} onChange={(e) => setNewUser({ ...newUser, organizerDetails: { ...newUser.organizerDetails, twitter: e.target.value } })} />
                      </div>
                    </div>
                    <div>
                      <label className="label">Official Website</label>
                      <input className="input" placeholder="https://..." value={newUser.organizerDetails.website} onChange={(e) => setNewUser({ ...newUser, organizerDetails: { ...newUser.organizerDetails, website: e.target.value } })} />
                    </div>
                  </>
              }
              </div>
              <div className="modal-footer">
                {modalType === 'Staff' ?
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={createUser}>
                    Initialize Staff Account
                  </button> :
              userModalStep === 1 ?
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
                setNewUser((prev) => ({
                  ...prev,
                  permissions: {
                    viewComplaints: false, approveComplaint: false, resolveComplaint: false, removeComplaint: false,
                    addCampaigns: true, deleteCampaign: true, viewLogs: false,
                    manageAdmins: false, manageUsers: false, broadcastNotification: false
                  }
                }));
                setUserModalStep(2);
              }}>
                    Next: Organizer Profile <ChevronRight size={16} />
                  </button> :

              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                    <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setUserModalStep(1)}>Back</button>
                    <button className="btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={createUser}>Create Campaigner Account</button>
                  </div>
              }
              </div>
            </motion.div>
          </div>
        }

        {campaignRegs &&
        <div className="modal-overlay" onClick={() => setCampaignRegs(null)}>
            <motion.div className="modal-box" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <div className="modal-header"><span className="modal-title">Campaign Registrants</span></div>
              <div className="modal-body" style={{ padding: 0 }}>
                {campaignRegs.data.length === 0 ?
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-4)' }}>No registrations yet for this campaign.</div> :

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '12px 20px', textAlign: 'left' }}>Participant</th>
                        <th style={{ padding: '12px 20px', textAlign: 'left' }}>Contact</th>
                        <th style={{ padding: '12px 20px', textAlign: 'left' }}>Address</th>
                        <th style={{ padding: '12px 20px', textAlign: 'left' }}>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignRegs.data.map((r, i) =>
                  <tr key={i} style={{ borderBottom: i === campaignRegs.data.length - 1 ? 0 : '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 20px' }}>
                            <div className="fw-7">{r.name}</div>
                            <div className="text-4" style={{ fontSize: '0.7rem' }}>{r.email}</div>
                          </td>
                          <td style={{ padding: '12px 20px' }}>{r.contact}</td>
                          <td style={{ padding: '12px 20px' }}>{r.address}</td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-4)' }}>{new Date(r.timestamp).toLocaleDateString()}</td>
                        </tr>
                  )}
                    </tbody>
                  </table>
              }
              </div>
              <div className="modal-footer">
                 <button className="btn-secondary" onClick={() => setCampaignRegs(null)}>Close</button>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>

      {}
      {contextMenu &&
      <>
          <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {e.preventDefault();setContextMenu(null);}} />
        
          <div style={{
          position: 'fixed', top: contextMenu.y, left: contextMenu.x,
          zIndex: 1001, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          padding: '6px', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 2
        }}>
            <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Actions for {contextMenu.user.username}
            </div>
            {contextMenu.user.isBanned ?
          <button onClick={() => {banUser(contextMenu.user._id, 'none');setContextMenu(null);}} className="cm-item">
                 <ShieldCheck size={14} /> Lift Ban
               </button> :

          <>
                <button onClick={() => {setShowBanModal({ userId: contextMenu.user._id, username: contextMenu.user.username });setContextMenu(null);}} className="cm-item">
                  <Activity size={14} /> Soft Ban (Temporary)
                </button>
                <button onClick={() => {
              const reason = prompt(`Reason for permanent ban of ${contextMenu.user.username}:`);
              if (reason) {
                banUser(contextMenu.user._id, 'permanent', 0, reason);
              }
              setContextMenu(null);
            }} className="cm-item danger">
                  <XCircle size={14} /> Ban Permanently
                </button>
              </>
          }
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <button onClick={() => {deletePlatformUser(contextMenu.user._id);setContextMenu(null);}} className="cm-item danger">
              <Trash2 size={14} /> Delete Account
            </button>
          </div>
        </>
      }

      {}
      {showBanModal &&
      <div className="modal-overlay" onClick={() => setShowBanModal(null)}>
          <motion.div className="modal-box" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
            <div className="modal-header"><span className="modal-title">Soft Ban: {showBanModal.username}</span></div>
            <div className="modal-body">
              <label className="label">Ban Duration (Days)</label>
              <input type="number" className="input" value={banDuration} onChange={(e) => setBanDuration(e.target.value)} min={1} style={{ marginBottom: 16 }} />
              
              <label className="label">Reason for Ban</label>
              <textarea
              className="input"
              rows={3}
              placeholder="e.g. Hate speech, Spam, Rules violation..."
              value={banReasonText}
              onChange={(e) => setBanReasonText(e.target.value)} />
            
            </div>
            <div className="modal-footer">
              <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => banUser(showBanModal.userId, 'temporary', parseInt(banDuration), banReasonText)}
              disabled={!banReasonText}>
              
                Apply Temporary Ban
              </button>
            </div>
          </motion.div>
        </div>
      }

      <style>{`
        .cm-item {
          display: flex; align-items: center; gap: 10px; width: 100%; border: none; background: transparent;
          padding: 8px 12px; border-radius: 6px; color: var(--text-secondary); font-size: 0.85rem; font-weight: 600;
          cursor: pointer; text-align: left; transition: all 0.2s;
        }
        .cm-item:hover { background: var(--surface-3); color: var(--text); }
        .cm-item.danger { color: #ef4444; }
        .cm-item.danger:hover { background: rgba(239, 68, 68, 0.1); }
      `}</style>
      {lightbox &&
      <Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      }
    </div>);

};

export default AdminPage;
