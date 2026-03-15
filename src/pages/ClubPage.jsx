import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import {
  Users, Plus, MapPin, Shield, ChevronRight, Heart, Pin,
  MessageSquare, Search, Wand2, Calendar, X, Target,
  Edit2, Trash, Share2, Filter, SortAsc, Clock, Info,
  CheckCircle2, AlertCircle, TrendingUp, UserPlus, UserMinus,
  Navigation, RefreshCw, ArrowUp, Copy, ExternalLink, Activity,
  Globe, Zap, Hash, BarChart3, Settings } from
'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import './ClubPage.css';
import { getReliablePosition } from '../utils/geolocation';


const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } }
};


const formatTime = (date) => {
  const diff = (new Date() - new Date(date)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
};


const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
  Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const KMC_REGISTRY = [
{ id: '26', name: 'Samakhusi', lat: 27.7215, lng: 85.3115 },
{ id: '2', name: 'Lazimpat', lat: 27.7240, lng: 85.3235 },
{ id: '16', name: 'Balaju', lat: 27.7320, lng: 85.3020 },
{ id: '1', name: 'Naxal', lat: 27.7160, lng: 85.3260 },
{ id: '10', name: 'Baneshwor', lat: 27.6915, lng: 85.3325 },
{ id: '3', name: 'Maharajgunj', lat: 27.7360, lng: 85.3300 }];


const ClubPage = () => {

  const [clubs, setClubs] = useState([]);
  const [selectedClub, setSelectedClub] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', description: '', rules: '', goal: '', wada: '', city: 'Kathmandu' });
  const [newNotice, setNewNotice] = useState({ title: '', content: '', category: 'General' });
  const [search, setSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [noticeFilter, setNoticeFilter] = useState('All');
  const [noticeSort, setSortBy] = useState('Newest');
  const [currentWard, setCurrentWard] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showWardPicker, setShowWardPicker] = useState(false);
  const [nearbyWards, setNearbyWards] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClubForm, setEditClubForm] = useState({ name: '', description: '', rules: '', goal: '' });
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem('user')));
  const [profileSynced, setProfileSynced] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);


  const myClub = useMemo(() => {
    if (!clubs.length || !userData) return null;
    const uid = userData.id || userData._id;
    return clubs.find((c) => c.members.some((m) => m.userId === uid));
  }, [clubs, userData]);

  const token = localStorage.getItem('token');

  const createClub = async (e) => {
    e.preventDefault();
    if (!token) return toast.error('Sign in required');
    try {
      const payload = { ...newClub, wada: currentWard };
      const res = await axios.post(`${API_URL}/api/clubs`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ward Hub Initialized!');
      const updatedUser = { ...userData, currentWard: currentWard };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUserData(updatedUser);
      setShowCreateModal(false);
      fetchClubs();

      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {toast.error(err.response?.data?.message || 'Establishment failed');}
  };

  const handleEditOpen = () => {
    if (selectedClub) {
      setEditClubForm({
        name: selectedClub.name,
        description: selectedClub.description,
        rules: selectedClub.rules,
        goal: selectedClub.goal
      });
      setShowEditModal(true);
    }
  };

  const updateClub = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/clubs/${selectedClub._id}`, editClubForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ward Club updated successfully!');
      setShowEditModal(false);
      fetchClubs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };


  useEffect(() => {
    const syncProfile = async () => {
      try {
        const r = await axios.get(`${API_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const latest = r.data;
        localStorage.setItem('user', JSON.stringify(latest));
        setUserData(latest);
        setProfileSynced(true);


        if (latest.currentWard || myClub) {
          setCurrentWard(latest.currentWard || myClub?.wada);
          setSearch(latest.currentWard || myClub?.wada);
          setLoading(false);
          setIsLocating(false);
        } else {
          detectLocation();
        }
      } catch {
        setProfileSynced(true);
        if (userData?.currentWard || myClub) {
          setCurrentWard(userData?.currentWard || myClub?.wada);
          setSearch(userData?.currentWard || myClub?.wada);
          setLoading(false);
          setIsLocating(false);
        } else {
          detectLocation();
        }
      }
    };

    fetchClubs().then(() => syncProfile());

    const interval = setInterval(() => {
      fetchClubs();
      if (selectedClub) fetchNotices(selectedClub._id);
    }, 45000);

    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [userData?.id, userData?._id, myClub?._id]);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const detectLocation = useCallback(() => {

    if (userData?.currentWard || myClub || currentWard) {
      setIsLocating(false);
      setLoading(false);
      return;
    }
    setIsLocating(true);
    getReliablePosition().
    then(async ({ position, source }) => {
      const { latitude, longitude } = position.coords;
      try {
        let results = [];


        const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
        const full = (res.data.display_name || '').toLowerCase();
        const match = full.match(/(?:ward|wada)\s*(\d+)/i);
        if (match) results.push({ id: match[1], name: `Ward ${match[1]} Hub`, distance: 0 });


        KMC_REGISTRY.forEach((w) => {
          const d = calculateDistance(latitude, longitude, w.lat, w.lng);
          if (d <= 1.2 && !results.find((r) => r.id === w.id)) {
            results.push({ id: w.id, name: w.name, distance: d.toFixed(2) });
          }
        });

        setNearbyWards(results);
        if (results.length > 0) {
          const targetId = userData?.currentWard || results[0].id;
          setCurrentWard(targetId);
          setSearch(targetId);
          if (source === 'cache') {
            toast('Using recent GPS cache. Refresh for live precision.', { icon: '📍' });
          }
        } else {
          setCurrentWard('Out of Bound');
        }
      } catch {
        console.error('GPS Sync Fail');
      }
    }).
    catch((error) => {
      if (error?.code === 1) {
        toast.error('GPS permission denied. Enable location permission in browser/site settings.');
      } else if (error?.code === 2) {
        toast.error('Location unavailable. Try again or manually select a ward.');
      } else if (error?.code === 3) {
        toast.error('GPS timeout. Move to open sky and retry.');
      } else {
        toast.error('GPS unavailable. Manually select a ward to proceed.');
      }
    }).
    finally(() => {
      setIsLocating(false);
      setLoading(false);
    });
  }, [userData?.currentWard, myClub, currentWard]);

  const fetchClubs = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/clubs`);
      setClubs(r.data);
      if (selectedClub) {
        const updated = r.data.find((c) => c._id === selectedClub._id);
        if (updated) setSelectedClub(updated);
      }
      setLoading(false);
    } catch {setLoading(false);}
  };

  const fetchNotices = async (clubId) => {
    try {
      const r = await axios.get(`${API_URL}/api/clubs/${clubId}/notices`);
      setNotices(r.data);
    } catch {}
  };

  const handleJoin = async (id) => {
    if (!token) return toast.error('Sign in required');
    try {
      const res = await axios.post(`${API_URL}/api/clubs/${id}/join`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Joined Ward Club!', { icon: '🛡️' });
      const updatedUser = { ...userData, currentWard: res.data.wada };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {toast.error(err.response?.data?.message || 'Lock sync failed');}
  };

  const handleLeave = async (id) => {
    if (!window.confirm("Exit this community club? Your ward lock will be reset.")) return;
    try {
      const res = await axios.post(`${API_URL}/api/clubs/${id}/leave`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      const updatedUser = { ...userData, currentWard: null };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {toast.error(err.response?.data?.message || 'Sync error');}
  };

  const promoteToVP = async (memberId) => {
    try {
      const res = await axios.post(`${API_URL}/api/clubs/${selectedClub._id}/promote`, { memberId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchClubs();
    } catch (err) {toast.error(err.response?.data?.message);}
  };

  const demoteToMember = async (memberId) => {
    try {
      const res = await axios.post(`${API_URL}/api/clubs/${selectedClub._id}/demote`, { memberId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchClubs();
    } catch (err) {toast.error(err.response?.data?.message);}
  };

  const postNotice = async (e) => {
    e.preventDefault();
    if (newNotice.content.length > 500) return toast.error('Broadcast too large');
    try {
      await axios.post(`${API_URL}/api/clubs/${selectedClub._id}/notices`, newNotice, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Broadcast Published');
      setNewNotice({ title: '', content: '', category: 'General' });
      fetchNotices(selectedClub._id);
    } catch {toast.error('Publish failed');}
  };

  const likeNotice = async (id) => {
    try {
      await axios.patch(`${API_URL}/api/notices/${id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotices(selectedClub._id);
    } catch {}
  };


  const filteredNotices = useMemo(() => {
    let list = [...notices];
    if (noticeFilter !== 'All') list = list.filter((n) => n.category === noticeFilter);
    if (noticeSort === 'Popular') list.sort((a, b) => b.likes.length - a.likes.length);else
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return list;
  }, [notices, noticeFilter, noticeSort]);

  const filteredMembers = useMemo(() => {
    if (!selectedClub) return [];
    return selectedClub.members.filter((m) =>
    m.username.toLowerCase().includes(memberSearch.toLowerCase())
    ).sort((a, b) => {
      const ranks = { 'President': 0, 'Vice President': 1, 'Member': 2 };
      return ranks[a.role] - ranks[b.role];
    });
  }, [selectedClub, memberSearch]);

  const isPresident = (club) => club.creatorId === (userData?.id || userData?._id);
  const isVP = (club) => club.members.find((m) => m.userId === (userData?.id || userData?._id))?.role === 'Vice President';
  const isAuthorized = (club) => isPresident(club) || isVP(club);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', height: '80vh' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5 }}>
        <RefreshCw size={48} color="var(--primary-accent)" />
      </motion.div>
      <div style={{ marginTop: 20, color: 'var(--text-secondary)', fontWeight: 600 }}>Syncing Hub Territories...</div>
    </div>);


  return (
    <div className="main-content club-page-root">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobileView ? '10px 8px' : '24px 20px', width: '100%', overflowX: 'hidden' }}>
        {}
        <AnimatePresence>
          {showScrollTop &&
          <motion.button
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              position: 'fixed', bottom: isMobileView ? 82 : 40, right: isMobileView ? 14 : 40, width: isMobileView ? 44 : 56, height: isMobileView ? 44 : 56, borderRadius: '50%',
              background: 'var(--primary-accent)', color: 'white', border: 'none',
              boxShadow: '0 12px 32px rgba(59, 130, 246, 0.3)', cursor: 'pointer', zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}>
            
              <ArrowUp size={24} />
            </motion.button>
          }
        </AnimatePresence>

        {}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: isMobileView ? 20 : 48 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: isMobileView ? 'wrap' : 'nowrap' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-accent)', letterSpacing: '0.1em', marginBottom: 8 }}>WARD COMMUNITIES</div>
                <h1 style={{ marginBottom: isMobileView ? 10 : 16, fontSize: isMobileView ? '1.35rem' : undefined }}>Ward Clubs</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                   <div className="badge" style={{
                  background: currentWard && currentWard !== 'Out of Bound' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                  color: currentWard && currentWard !== 'Out of Bound' ? 'var(--success)' : 'var(--text-secondary)',
                  padding: '6px 14px', borderRadius: 20, transition: 'all 0.3s'
                }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', marginRight: 8, display: 'inline-block' }}></div>
                      {isLocating ? 'Scanning GPS...' : currentWard ? `Zone: Ward ${currentWard}` : 'GPS Offline'}
                   </div>
                   {!userData?.currentWard &&
                <button className="btn-ghost" onClick={detectLocation} style={{ padding: 4 }} title="Refresh GPS"><RefreshCw size={14} className={isLocating ? 'spin' : ''} /></button>
                }
                   {userData?.currentWard && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={12} /> Lock Active</div>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobileView ? '100%' : 'auto' }}>
                 <button className="btn btn-secondary" onClick={() => {
                const msg = `Join our Ward Hub for Ward ${selectedClub?.wada || currentWard} on Pariwartan! ${window.location.origin}/club`;
                navigator.clipboard.writeText(msg);
                toast.success('Invite message copied');
              }}>
                   <Share2 size={18} /> Share Area
                 </button>
                  {!userData?.currentWard && !myClub && currentWard && !isLocating &&
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                       <Plus size={20} /> Initialize Hub
                     </button>
              }
              </div>
           </div>
        </motion.header>

        <div className="club-layout" style={{ display: 'grid', gridTemplateColumns: isMobileView ? '1fr' : 'minmax(260px, 320px) 1fr', gap: isMobileView ? 14 : 40, alignItems: 'start', width: '100%' }}>
          {}
          <aside>
             <div style={{ position: 'relative', marginBottom: isMobileView ? 12 : 24 }}>
                <Search size={18} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-tertiary)' }} />
                <input className="input" style={{ paddingLeft: 42, background: 'var(--bg-secondary)' }} placeholder="Find local hub..." value={search} onChange={(e) => setSearch(e.target.value)} />
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {clubs.filter((c) => {
                const nameMatch = c.name.toLowerCase().includes(search.toLowerCase()) || c.wada.includes(search);
                return userData?.currentWard ? c.wada === userData.currentWard : nameMatch;
              }).map((c) =>
              <motion.div
                key={c._id}
                className="card"
                style={{
                  padding: isMobileView ? 12 : 20, cursor: 'pointer',
                  borderColor: selectedClub?._id === c._id ? 'var(--primary-accent)' : 'var(--border)',
                  background: selectedClub?._id === c._id ? 'var(--bg-secondary)' : 'var(--surface)'
                }}
                onClick={() => {setSelectedClub(c);fetchNotices(c._id);}}
                whileHover={{ scale: 1.01 }}>
                
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                       <span className="badge badge-primary">W{c.wada}</span>
                       <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}><Users size={12} style={{ marginRight: 4 }} /> {c.members.length}</div>
                    </div>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{c.name}</h3>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       <div className="text-secondary" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 4 }}><Activity size={10} /> Active Feed</div>
                       <ChevronRight size={14} className="text-muted" />
                    </div>
                  </motion.div>
              )}
             </div>
          </aside>

          {}
          <main>
             <AnimatePresence mode="wait">
                {!selectedClub ?
              <motion.div
                className="card mt-1"
                style={{ padding: isMobileView ? 18 : 64, textAlign: 'center', borderStyle: 'dashed', background: 'transparent' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                
                    <div className="flex-center" style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-secondary)', margin: '0 auto 24px' }}>
                       <Globe size={40} className="text-muted" />
                    </div>
                    <h2>Resilient Territories</h2>
                    <p className="text-secondary" style={{ maxWidth: 400, margin: '16px auto', fontSize: isMobileView ? '0.82rem' : undefined }}>Select a ward community to view broadcasts, join the hub, and participate in local governance.</p>
                  </motion.div> :

              <motion.div key={selectedClub._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    {}
                      <div className="card" style={{ padding: isMobileView ? 14 : 40, background: 'var(--bg-secondary)', border: 'none', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isMobileView ? 14 : 24, gap: 10, flexWrap: isMobileView ? 'wrap' : 'nowrap' }}>
                          <div>
                             <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <span className="badge badge-primary">WARD {selectedClub.wada}</span>
                                {isPresident(selectedClub) && <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>PRESIDENT</span>}
                                {isVP(selectedClub) && <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-accent)' }}>VICE PRESIDENT</span>}
                             </div>
                             <h2 style={{ fontSize: isMobileView ? '1.3rem' : '2.25rem', letterSpacing: '-0.02em', margin: 0 }}>{selectedClub.name}</h2>
                          </div>
                          <div style={{ display: 'flex', gap: 8, width: isMobileView ? '100%' : 'auto' }}>
                             {selectedClub.members.some((m) => m.userId === (userData?.id || userData?._id)) ?
                      <div className="club-actions" style={{ display: 'flex', gap: 8, flexWrap: isMobileView ? 'wrap' : 'nowrap', width: isMobileView ? '100%' : 'auto' }}>
                                  {isPresident(selectedClub) &&
                        <button className="btn btn-secondary" onClick={handleEditOpen} title="Edit Club Details (30d cooldown)">
                                      <Edit2 size={18} /> Edit Hub
                                    </button>
                        }
                                  <button className="btn btn-secondary" onClick={() => setShowMembersModal(true)}><Users size={18} /> Residents</button>
                                  <button className="btn btn-ghost" onClick={() => handleLeave(selectedClub._id)} style={{ color: 'var(--danger)' }}>Leave Club</button>
                               </div> :

                      <button className="btn btn-primary" onClick={() => handleJoin(selectedClub._id)}>Join Community</button>
                      }
                          </div>
                       </div>
                       <p className="text-secondary" style={{ fontSize: isMobileView ? '0.9rem' : '1.1rem', lineHeight: 1.6 }}>{selectedClub.description}</p>
                       <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobileView ? 140 : 200}px, 1fr))`, gap: isMobileView ? 10 : 20, marginTop: isMobileView ? 16 : 32 }}>
                          <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
                             <div className="label">Primary Goal</div>
                             <div className="fw-600" style={{ fontSize: '0.9rem' }}>{selectedClub.goal}</div>
                          </div>
                          <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
                             <div className="label">Social Contract</div>
                             <div className="fw-600" style={{ fontSize: '0.9rem' }}>{selectedClub.rules}</div>
                          </div>
                          <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
                             <div className="label">Community Rank</div>
                             <div className="fw-600" style={{ fontSize: '0.9rem' }}>Level {Math.ceil(selectedClub.members.length / 5)} Community</div>
                          </div>
                       </div>
                    </div>

                    {}
                      <div style={{ marginTop: isMobileView ? 18 : 48 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobileView ? 14 : 32, gap: 8, flexWrap: isMobileView ? 'wrap' : 'nowrap' }}>
                          <div className="broadcast-filters" style={{ display: 'flex', gap: 8 }}>
                             {['All', 'General', 'Alert', 'Event'].map((f) =>
                      <button key={f} className={`btn-ghost ${noticeFilter === f ? 'active' : ''}`}
                      onClick={() => setNoticeFilter(f)}
                      style={{
                        fontSize: '0.85rem', fontWeight: 600,
                        background: noticeFilter === f ? 'var(--bg-tertiary)' : 'transparent',
                        borderRadius: 20
                      }}>
                        {f}</button>
                      )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', width: isMobileView ? '100%' : 'auto' }}>
                             <SortAsc size={16} className="text-muted" />
                             <select className="btn-ghost" value={noticeSort} onChange={(e) => setSortBy(e.target.value)} style={{ padding: 4, fontWeight: 600, border: 'none', width: 'auto' }}>
                                <option>Newest</option>
                                <option>Popular</option>
                             </select>
                          </div>
                       </div>

                       {selectedClub.members.some((m) => m.userId === (userData?.id || userData?._id)) &&
                  <div className="card" style={{ padding: isMobileView ? 12 : 24, marginBottom: isMobileView ? 14 : 32, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <form onSubmit={postNotice}>
                               <input className="input" placeholder="Broadcast Headline..." value={newNotice.title} onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })} required style={{ border: 'none', padding: '0 0 12px 0', fontSize: isMobileView ? '0.92rem' : '1.1rem', fontWeight: 700, borderBottom: '1px solid var(--border)', borderRadius: 0, marginBottom: 16 }} />
                               <textarea className="input" placeholder="Speak to your community..." rows={3} value={newNotice.content} onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })} required style={{ border: 'none', padding: 0, fontSize: isMobileView ? '0.84rem' : '1rem', resize: 'none', background: 'transparent' }} />
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16, gap: 8, flexWrap: isMobileView ? 'wrap' : 'nowrap' }}>
                                  <div style={{ fontSize: '0.75rem', color: newNotice.content.length > 450 ? 'var(--danger)' : 'var(--text-tertiary)' }}>{newNotice.content.length}/500</div>
                                   <div style={{ display: 'flex', gap: 8, width: isMobileView ? '100%' : 'auto', flexWrap: isMobileView ? 'wrap' : 'nowrap' }}>
                                     <select className="input" style={{ width: 'auto', padding: '4px 12px' }} value={newNotice.category} onChange={(e) => setNewNotice({ ...newNotice, category: e.target.value })}>
                                        <option>General</option><option>Alert</option><option>Event</option>
                                     </select>
                                     <button className="btn btn-primary" type="submit" style={{ padding: '8px 24px' }}>Post</button>
                                  </div>
                               </div>
                            </form>
                         </div>
                  }

                         <div style={{ display: 'grid', gap: isMobileView ? 10 : 20 }}>
                          {filteredNotices.map((n) =>
                    <motion.div key={n._id} className="card" style={{ padding: isMobileView ? 12 : 32, position: 'relative', border: n.isPinned ? '2px solid var(--primary-accent)' : '1px solid var(--border)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                               {n.isPinned && <div style={{ position: 'absolute', top: -12, left: 24, background: 'var(--primary-accent)', color: 'white', padding: '2px 10px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>PINNED</div>}
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                     <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--primary-accent)' }}>{n.username[0].toUpperCase()}</div>
                                     <div className="meta">
                                        <div style={{ fontWeight: 700 }}>{n.username} <span className="badge badge-sm" style={{ padding: '0 6px', fontSize: '0.6rem' }}>{n.category}</span></div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}><Clock size={10} style={{ marginRight: 4 }} /> {formatTime(n.timestamp)}</div>
                                     </div>
                                  </div>
                                  {(isAuthorized(selectedClub) || n.userId === (userData?.id || userData?._id)) &&
                        <button className="btn-ghost" style={{ padding: 4, color: 'var(--danger)' }} onClick={() => deleteNotice(n._id)}><Trash size={16} /></button>
                        }
                               </div>
                               <h4 style={{ marginBottom: 12 }}>{n.title}</h4>
                               <p className="text-secondary" style={{ fontSize: isMobileView ? '0.84rem' : '0.95rem', lineHeight: 1.6, marginBottom: isMobileView ? 12 : 24 }}>{n.content}</p>
                               <div style={{ display: 'flex', gap: isMobileView ? 12 : 24, borderTop: '1px solid var(--border)', paddingTop: isMobileView ? 12 : 20 }}>
                                  <button className="btn-ghost" style={{ padding: 0, fontSize: '0.85rem', color: n.likes.includes(userData?.id || userData?._id) ? 'var(--danger)' : 'var(--text-secondary)' }} onClick={() => likeNotice(n._id)}>
                                    <Heart size={16} fill={n.likes.includes(userData?.id || userData?._id) ? 'var(--danger)' : 'none'} style={{ marginRight: 6 }} /> {n.likes.length}
                                  </button>
                                  <button className="btn-ghost" style={{ padding: 0, fontSize: '0.85rem' }}><MessageSquare size={16} style={{ marginRight: 6 }} /> Discuss</button>
                               </div>
                            </motion.div>
                    )}
                       </div>
                    </div>
                  </motion.div>
              }
             </AnimatePresence>
          </main>
        </div>
      </div>

      {}
      <AnimatePresence>
         {showMembersModal &&
        <div className="modal-overlay" onClick={() => setShowMembersModal(false)} style={{ justifyContent: 'flex-end', padding: 0 }}>
              <motion.div
            style={{ width: '100%', maxWidth: isMobileView ? '100%' : 440, height: '100%', background: 'var(--surface)', padding: isMobileView ? 14 : 40, overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}>
            
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobileView ? 16 : 40 }}>
                    <div>
                       <h3>Residents</h3>
                       <p className="text-muted text-sm">{selectedClub.members.length} Community Members</p>
                    </div>
                    <button className="btn-ghost" onClick={() => setShowMembersModal(false)}><X size={24} /></button>
                 </div>
                 
                 <div style={{ position: 'relative', marginBottom: 24 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                    <input className="input" placeholder="Search neighbor..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} style={{ paddingLeft: 40 }} />
                 </div>

                 <div>
                    {filteredMembers.map((member) =>
              <div key={member.userId} style={{ padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{member.username[0].toUpperCase()}</div>
                            <div>
                               <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.username}</div>
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Joined {new Date(member.joinedAt).toLocaleDateString()}</div>
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{
                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                    background: member.role === 'President' ? 'rgba(245, 158, 11, 0.1)' : member.role === 'Vice President' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: member.role === 'President' ? 'var(--warning)' : member.role === 'Vice President' ? 'var(--primary-accent)' : 'var(--text-tertiary)'
                  }}>{member.role}</span>
                            {isPresident(selectedClub) && member.userId !== (userData?.id || userData?._id) &&
                  <div style={{ display: 'flex', gap: 4 }}>
                                  {member.role === 'Member' ?
                    <button className="btn-ghost" style={{ padding: 4 }} onClick={() => promoteToVP(member.userId)} title="Promote to VP"><UserPlus size={14} /></button> :
                    member.role === 'Vice President' ?
                    <button className="btn-ghost" style={{ padding: 4 }} onClick={() => demoteToMember(member.userId)} title="Demote to Member"><UserMinus size={14} /></button> :
                    null}
                               </div>
                  }
                         </div>
                      </div>
              )}
                 </div>
              </motion.div>
           </div>
        }
      </AnimatePresence>

      <AnimatePresence>
         {showCreateModal &&
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
              <motion.div className="modal-box" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                 <div className="modal-header">
                   <h3 className="modal-title">Initialize Ward Hub</h3>
                   <button className="btn-ghost" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
                 </div>
                 <div className="modal-body">
                   <form onSubmit={createClub}>
                    <div style={{ display: 'grid', gap: 20 }}>
                       <div>
                         <label className="label">Hub Name</label>
                         <input className="input" placeholder="e.g. Ward 26 Alliance" value={newClub.name} onChange={(e) => setNewClub({ ...newClub, name: e.target.value })} required />
                       </div>
                       <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
                          <div className="label" style={{ marginBottom: 4 }}>Locked Territory</div>
                          <div className="fw-700" style={{ color: 'var(--primary-accent)' }}>Kathmandu Ward {currentWard}</div>
                       </div>
                       <div>
                         <label className="label">Hub Mission</label>
                         <textarea className="input" placeholder="What is the goal of this hub?" rows={4} value={newClub.description} onChange={(e) => setNewClub({ ...newClub, description: e.target.value })} required></textarea>
                       </div>
                       <div className="modal-footer" style={{ borderTop: 'none', padding: '16px 0 0 0' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Establish Hub</button>
                      </div>
                    </div>
                   </form>
                 </div>
              </motion.div>
           </div>
        }
      </AnimatePresence>

      <AnimatePresence>
         {showEditModal &&
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
              <motion.div className="modal-box" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                 <div className="modal-header">
                   <h3 className="modal-title">Edit Ward Hub</h3>
                   <button className="btn-ghost" onClick={() => setShowEditModal(false)}><X size={20} /></button>
                 </div>
                 <div className="modal-body">
                   <form onSubmit={updateClub}>
                    <div style={{ display: 'grid', gap: 20 }}>
                       <div>
                         <label className="label">Hub Name</label>
                         <input className="input" placeholder="Club Name" value={editClubForm.name} onChange={(e) => setEditClubForm({ ...editClubForm, name: e.target.value })} required />
                       </div>
                       <div>
                         <label className="label">Primary Goal</label>
                         <input className="input" placeholder="Primary Goal" value={editClubForm.goal} onChange={(e) => setEditClubForm({ ...editClubForm, goal: e.target.value })} required />
                       </div>
                       <div>
                         <label className="label">Social Contract</label>
                         <textarea className="input" placeholder="Social Contract" rows={3} value={editClubForm.rules} onChange={(e) => setEditClubForm({ ...editClubForm, rules: e.target.value })} required></textarea>
                       </div>
                       <div>
                         <label className="label">Hub Mission (Description)</label>
                         <textarea className="input" placeholder="Hub Mission" rows={4} value={editClubForm.description} onChange={(e) => setEditClubForm({ ...editClubForm, description: e.target.value })} required></textarea>
                       </div>

                       <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--warning)' }}>
                         <AlertCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 
                         <strong>Note:</strong> Hub details can only be edited once every 30 days.
                       </div>

                       <div className="modal-footer" style={{ borderTop: 'none', padding: '16px 0 0 0' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Changes</button>
                      </div>
                    </div>
                   </form>
                 </div>
              </motion.div>
           </div>
        }
      </AnimatePresence>
    </div>);

};

export default ClubPage;