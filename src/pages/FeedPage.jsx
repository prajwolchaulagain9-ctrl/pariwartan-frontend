import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, MessageSquare, MapPin, X, Send, Filter, ArrowUpRight, Clock, User, CheckCircle, Image, Megaphone, Maximize2, Minimize2, Flag, Map, Bot } from 'lucide-react';
import axios from 'axios';
import { API_URL, getImgUrl, getImgFallbackUrl } from '../config';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { MARKER_TYPES } from '../components/MapComponent';
import Lightbox from '../components/Lightbox';
import CampaignsPage from './CampaignsPage';
import { useLanguage } from '../context/LanguageContext';

const byNewest = (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0);

const timeAgo = (d, t, language) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return t('Recently');
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return t('Just now');
  if (s < 3600) {
    const mins = Math.floor(s / 60);
    return language === 'ne' ? `${mins} मिनेट अघि` : `${mins}m ago`;
  }
  if (s < 86400) {
    const hrs = Math.floor(s / 3600);
    return language === 'ne' ? `${hrs} घण्टा अघि` : `${hrs}h ago`;
  }
  return date.toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-GB', { day: 'numeric', month: 'short' });
};

const statusStyle = (status) => {
  switch (status) {
    case 'Approved':case 'Accepted':case 'Progress':return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: 'rgba(16,185,129,0.2)' };
    case 'Resolved':return { bg: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: 'rgba(6,182,212,0.2)' };
    case 'Rejected':return { bg: 'rgba(239,68,68,0.08)', color: '#ef4444', border: 'rgba(239,68,68,0.2)' };
    default:return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: 'rgba(245,158,11,0.2)' };
  }
};

const FeedPage = ({ myOwn = false }) => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [suggestions, setSuggestions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [discussion, setDiscussion] = useState(null);
  const [reportModal, setReportModal] = useState({ visible: false, id: null });
  const [reportReason, setReportReason] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [socket, setSocket] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [subTab, setSubTab] = useState('feed');
  const [viewMode, setViewMode] = useState('compact');
  const [aiSolutionModal, setAiSolutionModal] = useState({ visible: false, suggestion: null });
  const bottomRef = useRef(null);

  const handleImgError = (e, rawUrl) => {
    const fallback = getImgFallbackUrl(rawUrl);
    if (fallback && e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
      return;
    }
    e.currentTarget.style.display = 'none';
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const s = io(API_URL, { auth: { token } });
    setSocket(s);
    return () => s.close();
  }, []);

  useEffect(() => {
    if (!socket || !discussion) return;
    socket.emit('join_discussion', discussion._id);
    const handler = (msg) => setMessages((p) => [...p, msg]);
    socket.on('receive_message', handler);
    axios.get(`${API_URL}/api/suggestions/${discussion._id}/comments`).then((r) => setMessages(r.data));
    return () => socket.off('receive_message', handler);
  }, [socket, discussion]);

  useEffect(() => {bottomRef.current?.scrollIntoView({ behavior: 'smooth' });}, [messages]);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q') || '';
    setSearch(q);
  }, [location.search]);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const ownReq = token ?
    axios.get(`${API_URL}/api/me/suggestions`, { headers: { Authorization: `Bearer ${token}` } }) :
    Promise.resolve({ data: [] });

    if (myOwn) {
      ownReq.
      then((r) => setSuggestions(Array.isArray(r.data) ? r.data.sort(byNewest) : [])).
      catch(() => toast.error('Could not load complaints.')).
      finally(() => setLoading(false));
      return;
    }

    Promise.allSettled([axios.get(`${API_URL}/api/suggestions`), ownReq]).
    then(([pub, own]) => {
      const pubItems = pub.status === 'fulfilled' && Array.isArray(pub.value.data) ? pub.value.data : [];
      const ownItems = own.status === 'fulfilled' && Array.isArray(own.value.data) ? own.value.data : [];
      const merged = [...pubItems, ...ownItems].reduce((acc, item) => {
        if (!item?._id || acc.some((e) => e._id === item._id)) return acc;
        acc.push(item);
        return acc;
      }, []);
      setSuggestions(merged.sort(byNewest));
      if (pub.status === 'rejected' && own.status === 'rejected') toast.error('Could not load complaints.');
    }).
    finally(() => setLoading(false));
  }, [myOwn]);

  const handleVote = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {toast.error(t('Sign in to vote.'));return;}
      const r = await axios.patch(`${API_URL}/api/suggestions/${id}/upvote`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSuggestions((p) => p.map((s) => s._id === id ? r.data : s));
    } catch (err) {toast.error(err.response?.data?.message || t('Could not register vote.'));}
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (!u) {toast.error(t('Sign in to comment.'));return;}
    socket.emit('send_message', { suggestionId: discussion._id, userId: u.id || u._id, username: u.username, profilePic: u.profilePic, text: newMsg });
    setNewMsg('');
  };

  const handleReportSubmit = async () => {
    if (!reportReason.trim()) { toast.error(t('Please enter a reason.')); return; }
    try {
      const token = localStorage.getItem('token');
      if (!token) { toast.error(t('Sign in to report.')); return; }
      await axios.post(`${API_URL}/api/suggestions/${reportModal.id}/report`, { reason: reportReason }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(t('Report submitted successfully.'));
      setReportModal({ visible: false, id: null });
      setReportReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || t('Could not submit report.'));
    }
  };

  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const myUserId = me?.id || me?._id;

  const filtered = suggestions.filter((s) => {
    const q = search.toLowerCase();
    const tagsArray = Array.isArray(s.tags) ? s.tags : typeof s.tags === 'string' ? s.tags.split(/[\s,]+/) : [];
    const textTags = `${s.title || ''} ${s.description || ''}`.match(/#[a-zA-Z0-9_]+/g) || [];
    const searchableTags = [...tagsArray, ...textTags].join(' ').toLowerCase();
    const matchSearch =
    (s.title || '').toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q) ||
    (s.complaintId || '').toLowerCase().includes(q) ||
    searchableTags.includes(q);
    return matchSearch;
  });

  return (
    <div className="main-content">
      <div className="max-content">

        {}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          
          <div>
            <h1 style={{ fontSize: 'clamp(1.3rem, 5vw, 2rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>
              {myOwn ? 'My Reports' : 'Feed'}
              {myOwn ? t('My Reports') : t('Feed')}
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {myOwn ? t('Track your submitted issues.') : `${filtered.length} ${t('issues reported in your area')}`}
            </p>
          </div>
          {!myOwn &&
          <div style={{
            padding: '6px 14px', borderRadius: 20,
            background: 'var(--accent-light)', border: '1px solid var(--accent-border)',
            fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
              <ArrowUpRight size={13} /> {t('Live')}
            </div>
          }
        </motion.div>

        {}
        {!myOwn &&
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, marginBottom: 24, flexWrap: 'wrap'
        }}>
            <div style={{
            display: 'flex', gap: 4,
            background: 'var(--surface-alt)', borderRadius: 12,
            padding: 4, border: '1px solid var(--border)',
            width: 'fit-content'
          }}>
              {[{ key: 'feed', label: 'Feed', icon: Filter }, { key: 'campaigns', label: 'Campaigns', icon: Megaphone }].map((tab) =>
            <motion.button
              key={tab.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSubTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 20px', borderRadius: 9, border: 'none',
                background: subTab === tab.key ? 'linear-gradient(135deg, #E8212A, #FF6B35)' : 'transparent',
                color: subTab === tab.key ? 'white' : 'var(--text-secondary)',
                fontSize: '0.84rem', fontWeight: subTab === tab.key ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: subTab === tab.key ? '0 2px 8px rgba(232,33,42,0.3)' : 'none'
              }}>
              
                  <tab.icon size={14} />
                  {t(tab.label)}
                </motion.button>
            )}
            </div>

            {subTab === 'feed' &&
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface-alt)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
                {[{ key: 'compact', label: 'Compact', icon: Minimize2 }, { key: 'full', label: 'Full', icon: Maximize2 }].map((mode) =>
            <motion.button
              key={mode.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setViewMode(mode.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 9, border: 'none',
                background: viewMode === mode.key ? 'linear-gradient(135deg, #E8212A, #FF6B35)' : 'transparent',
                color: viewMode === mode.key ? 'white' : 'var(--text-secondary)',
                fontSize: '0.8rem', fontWeight: viewMode === mode.key ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: viewMode === mode.key ? '0 2px 8px rgba(232,33,42,0.3)' : 'none'
              }}>
              
                    <mode.icon size={12} />
                    {t(mode.label)}
                  </motion.button>
            )}
              </div>
          }
          </div>
        }

        {}
        {!myOwn && subTab === 'campaigns' ?
        <CampaignsPage embedded /> :

        <>
        {}
        {}
        {loading ?
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 16 }}>
            {[1, 2, 3, 4].map((i) =>
            <div key={i} className="skeleton" style={{ height: 300, borderRadius: 14 }} />
            )}
          </div> :
          filtered.length === 0 ?
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            <div style={{
              width: 72, height: 72, borderRadius: 16,
              background: 'var(--accent-light)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20
            }}>
              <Filter size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 6 }}>{t('No issues found')}</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', maxWidth: 360 }}>
              {t('Try adjusting your search or filters.')}
            </p>
          </motion.div> :

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 16 }}>
            {filtered.map((s, idx) => {
              const isRejected = s.status === 'Rejected';
              const isVoted = Array.isArray(s.upvotedBy) ?
              s.upvotedBy.some((id) => String(id ?? '') === String(myUserId ?? '')) :
              false;
              const tagsArray = Array.isArray(s.tags) ? s.tags : typeof s.tags === 'string' ? s.tags.split(/[\s,]+/) : [];
              const textTags = `${s.title || ''} ${s.description || ''}`.match(/#[a-zA-Z0-9_]+/g) || [];
              const cardTags = Array.from(new Set([...tagsArray, ...textTags].
              map((tag) => String(tag || '').trim()).
              map((tag) => tag.replace(/[^#a-zA-Z0-9_]/g, '')).
              map((tag) => tag ? tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}` : '').
              filter(Boolean))).slice(0, 8);
              const markerDef = (MARKER_TYPES || []).find((m) => m.id === s.markerType) || { icon: MapPin, label: 'General' };
              const sts = statusStyle(s.status);

              return (
                <motion.div
                  key={s._id || idx}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  whileHover={{ y: -5 }}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 0,
                    overflow: 'hidden',
                    transition: 'all 0.25s ease',
                    cursor: 'default',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: 'var(--shadow-xs)'
                  }}>
                  
                  {}
                  <div style={{ height: 3, background: isRejected ?
                    'linear-gradient(90deg, #ef4444, #f97316)' :
                    'linear-gradient(90deg, #E8212A, #E8212A, #06b6d4)',
                    borderRadius: '14px 14px 0 0'
                  }} />

                  <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>

                    {}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{
                        width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--surface-alt)', borderRadius: 10
                      }}>
                        <markerDef.icon size={18} color="var(--text-secondary)" strokeWidth={2.2} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20,
                          fontSize: '0.68rem', fontWeight: 700,
                          background: sts.bg, color: sts.color,
                          border: `1px solid ${sts.border}`,
                          textTransform: 'uppercase', letterSpacing: '0.03em'
                        }}>
                          {s.status === 'Progress' ? t('Approved') : s.status}
                        </span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setAiSolutionModal({ visible: true, suggestion: s })}
                        style={{
                          marginLeft: 'auto',
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 10px', borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--surface-alt)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.72rem', fontWeight: 700,
                          cursor: 'pointer'
                        }}>
                        <Bot size={13} />
                        AI
                      </motion.button>
                    </div>

                    {}
                    {(() => {
                      const poster = s.userId;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                          {poster && typeof poster === 'object' ?
                          <>
                              {poster.profilePic ?
                            <img src={getImgUrl(poster.profilePic)} alt=""
                            onError={(e) => handleImgError(e, poster.profilePic)}
                            style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--border)' }} /> :

                            <div style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: 'linear-gradient(135deg, #E8212A, #FF6B35)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.6rem', fontWeight: 800, color: 'white'
                            }}>{poster.username?.[0]?.toUpperCase() || '?'}</div>
                            }
                              <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--text)' }}>{poster.username}</span>
                            </> :

                          <>
                              <div style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: 'var(--surface-alt)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}><User size={12} style={{ color: 'var(--text-tertiary)' }} /></div>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>{t('Anonymous')}</span>
                            </>
                          }
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} style={{ color: 'var(--text-tertiary)' }} />
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-tertiary)' }}>{timeAgo(s.timestamp || s.createdAt, t, language)}</span>
                          </div>
                        </div>);

                    })()}

                    {}
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, margin: '0 0 8px 0' }}>
                      {s.title}
                    </h3>

                    {}
                    <p style={{
                      fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55,
                      flex: 1,
                      display: viewMode === 'full' ? 'block' : '-webkit-box',
                      WebkitLineClamp: viewMode === 'full' ? 'unset' : 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: viewMode === 'full' ? 'visible' : 'hidden',
                      margin: '0 0 14px 0'
                    }}>
                      {s.description}
                    </p>

                    {cardTags.length > 0 &&
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {cardTags.map((tag) =>
                      <span
                        key={`${s._id || idx}-${tag}`}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: 'var(--accent-light)',
                          border: '1px solid var(--accent-border)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--accent)'
                        }}>
                            {tag}
                          </span>
                      )}
                      </div>
                    }

                    {}
                    {Array.isArray(s.images) && s.images.length > 0 &&
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: s.images.length === 1 ? '1fr' : s.images.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
                      gap: 6, marginBottom: 14, borderRadius: 10, overflow: 'hidden'
                    }}>
                        {s.images.map((img, i) =>
                      <img
                        key={i}
                        src={getImgUrl(img)}
                        alt=""
                        onError={(e) => handleImgError(e, img)}
                        onClick={() => setLightbox({ images: s.images.map((im) => getImgUrl(im)), index: i })}
                        style={{
                          width: '100%', height: s.images.length === 1 ? 180 : 100,
                          objectFit: 'cover', borderRadius: 8,
                          cursor: 'pointer', transition: 'opacity 0.2s ease'
                        }}
                        loading="lazy" />

                      )}
                      </div>
                    }

                    {}
                    {s.status === 'Resolved' && Array.isArray(s.afterImages) && s.afterImages.length > 0 &&
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Image size={12} style={{ color: '#22c55e' }} />
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('After Resolution')}</span>
                        </div>
                        <div style={{
                        display: 'grid',
                        gridTemplateColumns: s.afterImages.length === 1 ? '1fr' : s.afterImages.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr',
                        gap: 6, borderRadius: 10, overflow: 'hidden'
                      }}>
                          {s.afterImages.map((img, i) =>
                        <img key={i} src={getImgUrl(img)} alt=""
                        onError={(e) => handleImgError(e, img)}
                        onClick={() => setLightbox({ images: s.afterImages.map((im) => getImgUrl(im)), index: i })}
                        style={{ width: '100%', height: s.afterImages.length === 1 ? 180 : 100, objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
                        loading="lazy" />
                        )}
                        </div>
                      </div>
                    }

                    {}
                    {viewMode === 'full' && Array.isArray(s.timeline) && s.timeline.length > 1 &&
                    <div style={{
                      marginBottom: 14, padding: 12,
                      background: 'var(--surface-alt)', borderRadius: 10,
                      border: '1px solid var(--border)'
                    }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('Timeline')}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {s.timeline.map((t, i) => {
                          const tsts = statusStyle(t.status);
                          const isLast = i === s.timeline.length - 1;
                          return (
                            <div key={i} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                                  <div style={{
                                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                                  background: isLast ? tsts.color : 'var(--border)',
                                  border: isLast ? 'none' : '2px solid var(--border)',
                                  marginTop: 3
                                }} />
                                  {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border)', minHeight: 16 }} />}
                                </div>
                                <div style={{ paddingBottom: isLast ? 0 : 10, flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: tsts.color }}>
                                    {t.status === 'Progress' ? 'Approved' : t.status}
                                  </span>
                                  <div style={{ display: 'flex', gap: 8, fontSize: '0.66rem', color: 'var(--text-tertiary)', marginTop: 1 }}>
                                    {t.timestamp && <span>{new Date(t.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                                    {t.by && <span>{language === 'ne' ? 'द्वारा' : 'by'} {t.by}</span>}
                                  </div>
                                </div>
                              </div>);

                        })}
                        </div>
                      </div>
                    }

                    {}
                    {myOwn && isRejected && s.rejectionReason &&
                    <div style={{
                      padding: 12, background: 'rgba(239,68,68,0.05)',
                      border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, marginBottom: 14
                    }}>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ef4444', margin: '0 0 4px 0', textTransform: 'uppercase' }}>{t('Feedback')}</p>
                        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{s.rejectionReason}</p>
                      </div>
                    }

                    {}
                    <div style={{
                      fontSize: '0.78rem', color: 'var(--text-tertiary)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      paddingTop: 12, marginBottom: 14,
                      borderTop: '1px solid var(--border)'
                    }}>
                      <MapPin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      <span>{s.wada || t('Unknown area')}, {s.city || 'Kathmandu'}</span>
                      {s.complaintId &&
                      <>
                          <span style={{ color: 'var(--border)' }}>|</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>#{s.complaintId}</span>
                        </>
                      }
                    </div>

                    {}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isRejected && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleVote(s._id)}
                          style={{
                            flex: 1, padding: '9px 12px',
                            background: isVoted ? 'linear-gradient(135deg, #E8212A, #FF6B35)' : 'var(--surface-alt)',
                            color: isVoted ? 'white' : 'var(--text-secondary)',
                            border: isVoted ? 'none' : '1.5px solid var(--border)',
                            borderRadius: 10, fontSize: '0.8rem', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            transition: 'all 0.2s ease',
                            boxShadow: isVoted ? '0 2px 8px rgba(232,33,42,0.3)' : 'none'
                          }}>
                          <ChevronUp size={14} />
                          {s.upvotes || 0}
                        </motion.button>
                      )}

                      {!isRejected && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {setDiscussion(s);setMessages([]);}}
                          style={{
                            flex: 1, padding: '9px 12px',
                            background: 'var(--surface-alt)',
                            color: 'var(--text-secondary)',
                            border: '1.5px solid var(--border)',
                            borderRadius: 10, fontSize: '0.8rem', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            transition: 'all 0.2s ease'
                          }}>
                          <MessageSquare size={13} />
                          {t('Discuss')}
                        </motion.button>
                      )}

                      {(s.status === 'Approved' || s.status === 'Rejected' || s.status === 'Progress') && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setReportModal({ visible: true, id: s._id })}
                          style={{
                            padding: '9px 12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                          <Flag size={14} />
                        </motion.button>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(`/?lat=${s.latitude || s.lat}&lng=${s.longitude || s.lng}&zoomTo=${s._id}`)}
                        style={{
                          padding: '9px 12px',
                          background: 'var(--surface-alt)',
                          color: 'var(--text-secondary)',
                          border: '1.5px solid var(--border)',
                          borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                        <Map size={14} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>);

            })}
          </div>
          }
        </>}
      </div>

      {}
      <AnimatePresence>
        {discussion &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-overlay"
          onClick={(e) => {if (e.target === e.currentTarget) setDiscussion(null);}}
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          
            <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0,
              width: 'min(440px, 100%)',
              background: 'var(--bg)',
              borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              zIndex: 2001, boxShadow: 'var(--shadow-xl)'
            }}>
            
              {}
              <div style={{ padding: 20, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {t('Discussion')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, lineHeight: 1.35 }}>{discussion.title}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '6px 0 0 0' }}>
                      {messages.length} {messages.length === 1 ? t('comment') : t('comments')}
                    </p>
                  </div>
                  <motion.button
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setDiscussion(null)}
                  style={{
                    background: 'var(--surface-alt)', border: '1px solid var(--border)',
                    color: 'var(--text)', cursor: 'pointer', padding: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, flexShrink: 0
                  }}>
                  
                    <X size={16} />
                  </motion.button>
                </div>
              </div>

              {}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {messages.length === 0 ?
              <div style={{ textAlign: 'center', margin: 'auto', padding: '40px 20px', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: 10, opacity: 0.3 }}>💬</div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{t('No comments yet')}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', margin: '6px 0 0 0' }}>{t('Start the conversation')}</p>
                  </div> :
              messages.map((m, i) => {
                const isMe = m.username === me?.username;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: isMe ? 16 : -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{ display: 'flex', gap: 10, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                    
                      {m.profilePic ?
                    <img
                      src={getImgUrl(m.profilePic)}
                      onError={(e) => handleImgError(e, m.profilePic)}
                      style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid var(--border)' }}
                      alt={m.username} /> :


                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #E8212A, #FF6B35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 800, color: 'white',
                      border: '1.5px solid var(--border)'
                    }}>{m.username?.[0]?.toUpperCase() || '?'}</div>
                    }
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        {!isMe &&
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', marginBottom: 4, paddingLeft: 10 }}>
                            {m.username}
                          </div>
                      }
                        <div style={{
                        padding: '10px 14px', borderRadius: 12,
                        background: isMe ? 'linear-gradient(135deg, #E8212A, #FF6B35)' : 'var(--surface)',
                        color: isMe ? 'white' : 'var(--text)',
                        maxWidth: '80%', wordBreak: 'break-word',
                        border: isMe ? 'none' : '1px solid var(--border)',
                        borderBottomRightRadius: isMe ? 4 : 12,
                        borderBottomLeftRadius: isMe ? 12 : 4
                      }}>
                          <span style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>{m.text}</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 4, paddingLeft: isMe ? 0 : 10, paddingRight: isMe ? 10 : 0 }}>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </motion.div>);

              })}
                <div ref={bottomRef} />
              </div>

              {}
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
                <input
                placeholder={t('Write a comment...')}
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
                style={{
                  flex: 1, padding: '10px 14px',
                  border: '1.5px solid var(--border)', borderRadius: 10,
                  background: 'var(--surface)', color: 'var(--text)',
                  fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {e.target.style.borderColor = 'var(--accent)';e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';}}
                onBlur={(e) => {e.target.style.borderColor = 'var(--border)';e.target.style.boxShadow = 'none';}} />
              
                <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sendMessage}
                style={{
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, #E8212A, #FF6B35)',
                  color: 'white', border: 'none', borderRadius: 10,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(232,33,42,0.3)',
                  flexShrink: 0
                }}>
                
                  <Send size={15} />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {aiSolutionModal.visible && (
          <div
            className="modal-overlay"
            style={{ zIndex: 3000 }}
            onClick={(e) => { if (e.target === e.currentTarget) setAiSolutionModal({ visible: false, suggestion: null }); }}
          >
            <motion.div
              className="modal-box ai-solution-modal"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bot size={18} /> {t('AI Suggestion Review')}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    {t('Complaint')} #{aiSolutionModal.suggestion?.complaintId || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => setAiSolutionModal({ visible: false, suggestion: null })}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 6,
                    background: 'var(--surface-alt)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                ><X size={14} /></button>
              </div>

              <div className="modal-body">
                <div style={{ marginBottom: 12 }}>
                  <span className="ai-generated-tag">{t('Generated by AI')}</span>
                </div>

                <div className="ai-summary-box">
                  {aiSolutionModal.suggestion?.aiSolution?.summary || t('AI solution is not available for this report yet.')}
                </div>

                {Array.isArray(aiSolutionModal.suggestion?.aiSolution?.actions) && aiSolutionModal.suggestion.aiSolution.actions.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t('AI Action Plan')}
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
                      {aiSolutionModal.suggestion.aiSolution.actions.slice(0, 3).map((item, idx) => (
                        <li key={idx} style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: 999, padding: '5px 10px' }}>
                    {t('Severity')}: {aiSolutionModal.suggestion?.aiSolution?.severity || 3}/5
                  </span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 10px' }}>
                    {t('Category')}: {aiSolutionModal.suggestion?.aiSolution?.category || t('Other')}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportModal.visible && (
          <div
            className="modal-overlay"
            style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 3000 }}
            onClick={(e) => { if (e.target === e.currentTarget) setReportModal({ visible: false, id: null }); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: 'var(--bg)',
                padding: 24,
                borderRadius: 16,
                width: '90%',
                maxWidth: 400,
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border)'
              }}
            >
              <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--text)' }}>{t('Report Issue')}</h2>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {t('Please provide a reason for reporting this complaint. This will help our team investigate.')}
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder={t('Enter report reasoning...')}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-alt)',
                  color: 'var(--text)',
                  outline: 'none',
                  minHeight: 100,
                  marginBottom: 16,
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setReportModal({ visible: false, id: null })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {t('Cancel')}
                </button>
                <button
                  onClick={handleReportSubmit}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {t('Submit Report')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {lightbox &&
      <Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      }
    </div>);

};

export default FeedPage;