import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Medal, Crown, User as UserIcon } from 'lucide-react';
import axios from 'axios';
import { API_URL, getImgUrl } from '../config';
import toast from 'react-hot-toast';
import { useEcoPoints } from '../context/EcoPointsContext';

const ICON_MAP = { Sprout: Award, Leaf: Award, Trees: Award, Award, Target: Award, Trophy, Mountain: Award, Crown, Sparkles: Award, Users: Award };

const LeaderboardPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const { allBadges } = useEcoPoints();
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const myId = me?.id || me?._id;

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/api/leaderboard`).
    then((r) => setUsers(r.data)).
    catch(() => toast.error('Could not load leaderboard')).
    finally(() => setLoading(false));
  }, []);

  const getProfilePicUrl = (pic) => {
    if (!pic) return null;
    return getImgUrl(pic) || null;
  };

  const rankIcon = (rank) => {
    if (rank === 1) return <Crown size={18} style={{ color: '#f59e0b' }} />;
    if (rank === 2) return <Medal size={18} style={{ color: '#94a3b8' }} />;
    if (rank === 3) return <Medal size={18} style={{ color: '#cd7f32' }} />;
    return <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-tertiary)', width: 18, textAlign: 'center', display: 'inline-block' }}>{rank}</span>;
  };

  const rankBg = (rank) => {
    if (rank === 1) return 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.15))';
    if (rank === 2) return 'linear-gradient(135deg, rgba(148,163,184,0.06), rgba(148,163,184,0.12))';
    if (rank === 3) return 'linear-gradient(135deg, rgba(205,127,50,0.06), rgba(205,127,50,0.12))';
    return 'var(--surface)';
  };

  const rankBorder = (rank) => {
    if (rank === 1) return '1.5px solid rgba(245,158,11,0.3)';
    if (rank === 2) return '1.5px solid rgba(148,163,184,0.25)';
    if (rank === 3) return '1.5px solid rgba(205,127,50,0.25)';
    return '1px solid var(--border)';
  };

  return (
    <div className="main-content">
      <div className="max-content leaderboard-shell">

        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lb-header"
          style={{ marginBottom: isMobileView ? 16 : 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          
          <div>
            <h1 style={{ fontSize: isMobileView ? '1.4rem' : '2rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>Leaderboard</h1>
            <p style={{ fontSize: isMobileView ? '0.8rem' : '0.9rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>Top contributors by eco points</p>
          </div>
          <div style={{
            padding: isMobileView ? '5px 10px' : '6px 14px', borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.15))',
            border: '1px solid rgba(245,158,11,0.2)',
            fontSize: isMobileView ? '0.72rem' : '0.78rem', fontWeight: 700, color: '#f59e0b',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <Trophy size={13} /> Top 50
          </div>
        </motion.div>

        {loading ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 12 }} />)}
          </div> :
        users.length === 0 ?
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ textAlign: 'center', padding: isMobileView ? '40px 12px' : '80px 24px' }}>
            <Trophy size={40} style={{ color: 'var(--text-tertiary)', opacity: 0.3, marginBottom: 16 }} />
            <h2 style={{ fontSize: isMobileView ? '1rem' : '1.2rem', fontWeight: 700, marginBottom: 6 }}>No users yet</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: isMobileView ? '0.8rem' : '0.9rem' }}>Be the first to earn eco points!</p>
          </motion.div> :

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map((u, idx) => {
            const pic = getProfilePicUrl(u.profilePic);
            const isMe = String(u._id || '') === String(myId || '') || u.username === me?.username;
            const equippedDef = u.equippedBadge && allBadges.find((b) => b.id === u.equippedBadge);
            return (
              <motion.div
                key={u.rank}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                whileHover={{ x: 4 }}
                className="lb-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: isMobileView ? '10px 12px' : '14px 18px', borderRadius: 12,
                  background: rankBg(u.rank),
                  border: isMe ? '1.5px solid rgba(124,58,237,0.4)' : rankBorder(u.rank),
                  boxShadow: isMe ? '0 0 0 3px rgba(124,58,237,0.08)' : u.rank <= 3 ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  transition: 'all 0.2s ease'
                }}>
                
                  {}
                  <div className="lb-rank" style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    {rankIcon(u.rank)}
                  </div>

                  {}
                  <div style={{
                  width: isMobileView ? 34 : 40, height: isMobileView ? 34 : 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  background: pic ? 'none' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: u.rank <= 3 ? '2px solid rgba(245,158,11,0.3)' : '2px solid var(--border)'
                }}>
                    {pic ?
                  <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :

                  <UserIcon size={18} style={{ color: 'white' }} />
                  }
                  </div>

                  {}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                      fontSize: isMobileView ? '0.8rem' : '0.88rem', fontWeight: 700,
                      color: isMe ? '#7c3aed' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        {u.username}{isMe ? ' (you)' : ''}
                      </span>
                      {equippedDef &&
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700,
                      padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(245,158,11,0.1)', color: '#f59e0b'
                    }}>
                          {equippedDef.label}
                        </span>
                    }
                    </div>
                    <span style={{ fontSize: isMobileView ? '0.66rem' : '0.72rem', color: 'var(--text-tertiary)' }}>
                      {u.badges.length} badge{u.badges.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {}
                  <div className="lb-points" style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: isMobileView ? '4px 8px' : '6px 12px', borderRadius: 20,
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.15))',
                  border: '1px solid rgba(245,158,11,0.15)'
                }}>
                    <Award size={12} style={{ color: '#f59e0b' }} />
                    <span style={{ fontSize: isMobileView ? '0.74rem' : '0.82rem', fontWeight: 800, color: '#f59e0b' }}>{u.ecoPoints}</span>
                  </div>
                </motion.div>);

          })}
          </div>
        }
      </div>
    </div>);

};

export default LeaderboardPage;