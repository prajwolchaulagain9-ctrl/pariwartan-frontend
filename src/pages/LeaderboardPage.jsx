import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Medal, Crown, User as UserIcon, Building2, Gauge, Clock3, CheckCircle2, AlertTriangle, Star } from 'lucide-react';
import axios from 'axios';
import { API_URL, getImgUrl } from '../config';
import toast from 'react-hot-toast';
import { useEcoPoints } from '../context/EcoPointsContext';
import { useLanguage } from '../context/LanguageContext';

const GENERAL_DEPARTMENT = 'General';

const DEPARTMENT_RULES = [
{
  label: 'Nepal Electricity Authority',
  routingAliases: ['nea', 'nepal electricity authority', 'electricity authority'],
  keywords: ['electricity', 'electric', 'power cut', 'transformer', 'line fault', 'street light', 'बिजुली']
},
{
  label: 'Nepal Transport Department',
  routingAliases: ['transport', 'license office', 'yatayat', 'dotm'],
  keywords: ['license', 'driving license', 'renewal', 'vehicle registration', 'yatayat', 'trial']
},
{
  label: 'Nepal Sadak Bibhag',
  routingAliases: ['sadak', 'department of roads', 'road department'],
  keywords: ['road', 'pothole', 'traffic light', 'signal light', 'highway', 'footpath', 'bridge']
},
{
  label: 'Kathmandu Mahanagarpalika',
  routingAliases: ['kathmandu mahanagarpalika', 'kmc', 'kathmandu metropolitan'],
  keywords: ['waste', 'litter', 'garbage', 'trash', 'dump', 'cleaning', 'sanitation', 'sewage', 'dirty', 'foul smell']
},
{
  label: 'Kathmandu Mahanagarpalika',
  routingAliases: ['kathmandu mahanagarpalika', 'kmc', 'kathmandu metropolitan'],
  keywords: ['kathmandu']
},
{
  label: 'Lalitpur Mahanagarpalika',
  routingAliases: ['lalitpur mahanagarpalika', 'lmc', 'lalitpur metropolitan'],
  keywords: ['lalitpur']
}];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const hoursBetween = (a, b) => {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60);
};

const avg = (arr) => {
  if (!arr.length) return null;
  return arr.reduce((sum, item) => sum + item, 0) / arr.length;
};

const responseSpeedScore = (hours) => {
  if (hours == null) return 40;
  if (hours <= 2) return 100;
  if (hours <= 12) return 85;
  if (hours <= 24) return 70;
  if (hours <= 72) return 45;
  return 20;
};

const resolveSpeedScore = (hours) => {
  if (hours == null) return 45;
  if (hours <= 24) return 100;
  if (hours <= 72) return 80;
  if (hours <= 168) return 55;
  return 25;
};

const safeLower = (value) => String(value || '').toLowerCase();

const resolveDepartmentFromRouting = (suggestion) => {
  const routingName = safeLower(suggestion?.departmentRouting?.departmentName);
  const routingEmail = safeLower(suggestion?.departmentRouting?.primaryEmail);
  const routedBlob = `${routingName} ${routingEmail}`.trim();
  if (!routedBlob) return null;

  if (routedBlob.includes('general')) return GENERAL_DEPARTMENT;

  const directMatch = DEPARTMENT_RULES.find((rule) =>
  rule.routingAliases.some((alias) => routedBlob.includes(alias))
  );
  if (directMatch) return directMatch.label;

  // Ignore unrecognized free-form AI output and rely on deterministic rules below.
  return null;
};

const resolveDepartment = (suggestion) => {
  const dbDepartment = resolveDepartmentFromRouting(suggestion);
  if (dbDepartment) return dbDepartment;

  const contentBlob = [
  suggestion?.title,
  suggestion?.description,
  suggestion?.markerType,
  suggestion?.type,
  Array.isArray(suggestion?.tags) ? suggestion.tags.join(' ') : suggestion?.tags].join(' ').toLowerCase();

  const areaBlob = [suggestion?.city, suggestion?.wada, suggestion?.address].join(' ').toLowerCase();

  // Waste/littering should map to local municipal authority by area.
  const isWasteIssue =
  ['waste', 'litter', 'garbage', 'trash', 'dump', 'cleaning', 'sanitation', 'sewage', 'dirty', 'foul smell'].
  some((kw) => contentBlob.includes(kw));
  if (isWasteIssue) {
    if (areaBlob.includes('lalitpur')) return 'Lalitpur Mahanagarpalika';
    return 'Kathmandu Mahanagarpalika';
  }

  const topicMatch = DEPARTMENT_RULES.find((rule) =>
  rule.label !== 'Kathmandu Mahanagarpalika' &&
  rule.label !== 'Lalitpur Mahanagarpalika' &&
  rule.keywords.some((kw) => contentBlob.includes(kw))
  );
  if (topicMatch) return topicMatch.label;

  if (areaBlob.includes('lalitpur')) return 'Lalitpur Mahanagarpalika';
  if (areaBlob.includes('kathmandu')) return 'Kathmandu Mahanagarpalika';

  return GENERAL_DEPARTMENT;
};

const buildDepartmentRankings = (suggestions) => {
  const buckets = {};

  suggestions.forEach((s) => {
    const departmentName = resolveDepartment(s);
    if (!buckets[departmentName]) {
      buckets[departmentName] = {
        department: departmentName,
        total: 0,
        resolved: 0,
        undone: 0,
        responseSamples: [],
        resolveSamples: [],
        voteSamples: [],
        ratingSamples: []
      };
    }

    const item = buckets[departmentName];
    item.total += 1;

    const timeline = Array.isArray(s.timeline) ? s.timeline : [];
    const createdAt = s.createdAt || s.timestamp || timeline[0]?.timestamp;

    const firstResponseEvent = timeline.find((entry) =>
    ['Progress', 'Approved', 'Resolved', 'Rejected'].includes(entry?.status)
    );
    const firstResponseAt = firstResponseEvent?.timestamp || (s.status !== 'Pending' ? s.updatedAt : null);
    const responseHours = hoursBetween(createdAt, firstResponseAt);
    if (responseHours != null) item.responseSamples.push(responseHours);

    const resolvedEvent = [...timeline].reverse().find((entry) => entry?.status === 'Resolved');
    const resolvedAt = resolvedEvent?.timestamp || (s.status === 'Resolved' ? s.updatedAt : null);
    const resolveHours = hoursBetween(createdAt, resolvedAt);

    const upvotes = Array.isArray(s.upvotes) ? s.upvotes.length : Number(s.upvotes || 0);
    item.voteSamples.push(Number.isFinite(upvotes) ? upvotes : 0);

    const explicitRating = Number(
    s.userRating ??
    s.rating ??
    s.feedbackRating ??
    s.satisfactionRating
    );
    if (Number.isFinite(explicitRating) && explicitRating > 0) {
      item.ratingSamples.push(clamp(explicitRating, 1, 5));
    }

    if (s.status === 'Resolved') {
      item.resolved += 1;
      if (resolveHours != null) item.resolveSamples.push(resolveHours);
    }

    if (['Pending', 'Progress', 'Approved'].includes(s.status)) {
      item.undone += 1;
    }
  });

  return Object.values(buckets).filter((item) => item.total > 0).map((item) => {
    const actionableTotal = item.resolved + item.undone;
    const resolveRate = actionableTotal > 0 ? item.resolved / actionableTotal * 100 : 0;
    const avgResponseHours = avg(item.responseSamples);
    const avgResolveHours = avg(item.resolveSamples);
    const avgVotes = avg(item.voteSamples) || 0;
    const citizenRating = item.ratingSamples.length > 0 ?
    avg(item.ratingSamples) :
    clamp(2 + avgVotes * 0.2 + resolveRate * 0.015, 1, 5);

    const backlogScore = item.total > 0 ? clamp(100 - item.undone / item.total * 100, 0, 100) : 35;
    const respScore = responseSpeedScore(avgResponseHours);
    const resScore = resolveSpeedScore(avgResolveHours);
    const citizenScore = citizenRating * 20;
    const score =
    resolveRate * 0.34 +
    backlogScore * 0.2 +
    respScore * 0.18 +
    resScore * 0.18 +
    citizenScore * 0.1;

    return {
      ...item,
      resolveRate,
      avgResponseHours,
      avgResolveHours,
      citizenRating,
      score
    };
  }).sort((a, b) => b.score - a.score).map((item, idx) => ({ ...item, rank: idx + 1 }));
};

const LeaderboardPage = () => {
  const [users, setUsers] = useState([]);
  const [departmentRankings, setDepartmentRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ecopoints');
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const { allBadges } = useEcoPoints();
  const { t } = useLanguage();
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const myId = me?.id || me?._id;

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    Promise.allSettled([
    axios.get(`${API_URL}/api/leaderboard`),
    axios.get(`${API_URL}/api/suggestions`)]).
    then(([leaderboardRes, suggestionsRes]) => {
      if (leaderboardRes.status === 'fulfilled') {
        setUsers(Array.isArray(leaderboardRes.value.data) ? leaderboardRes.value.data : []);
      }

      if (suggestionsRes.status === 'fulfilled') {
        const rows = Array.isArray(suggestionsRes.value.data) ? suggestionsRes.value.data : [];
        setDepartmentRankings(buildDepartmentRankings(rows));
      }

      if (leaderboardRes.status === 'rejected' && suggestionsRes.status === 'rejected') {
        toast.error(t('Could not load ranking data.'));
      }
    }).
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
            <h1 style={{ fontSize: isMobileView ? '1.4rem' : '2rem', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>{t('Ranking')}</h1>
            <p style={{ fontSize: isMobileView ? '0.8rem' : '0.9rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {activeTab === 'ecopoints' ? t('Top contributors by eco points') : t('Public department performance ranking')}
            </p>
          </div>
          <div style={{
            padding: isMobileView ? '5px 10px' : '6px 14px', borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.15))',
            border: '1px solid rgba(245,158,11,0.2)',
            fontSize: isMobileView ? '0.72rem' : '0.78rem', fontWeight: 700, color: '#f59e0b',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <Trophy size={13} /> {activeTab === 'ecopoints' ? t('Top 50') : t('Public Scorecard')}
          </div>
        </motion.div>

        <div style={{
          display: 'inline-flex', gap: 6, marginBottom: 16,
          background: 'var(--surface-alt)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 4
        }}>
          {[{ key: 'ecopoints', label: t('EcoPoints') }, { key: 'departments', label: t('Departments') }].map((tab) =>
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              border: 'none', cursor: 'pointer', borderRadius: 8,
              padding: isMobileView ? '7px 10px' : '8px 12px',
              background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: isMobileView ? '0.75rem' : '0.8rem'
            }}>
              {tab.label}
            </button>
          )}
        </div>

        {loading ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 12 }} />)}
          </div> :
        activeTab === 'ecopoints' && users.length === 0 ?
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ textAlign: 'center', padding: isMobileView ? '40px 12px' : '80px 24px' }}>
            <Trophy size={40} style={{ color: 'var(--text-tertiary)', opacity: 0.3, marginBottom: 16 }} />
            <h2 style={{ fontSize: isMobileView ? '1rem' : '1.2rem', fontWeight: 700, marginBottom: 6 }}>{t('No users yet')}</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: isMobileView ? '0.8rem' : '0.9rem' }}>{t('Be the first to earn eco points!')}</p>
          </motion.div> :

        activeTab === 'departments' && departmentRankings.length === 0 ?
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ textAlign: 'center', padding: isMobileView ? '40px 12px' : '80px 24px' }}>
            <Building2 size={40} style={{ color: 'var(--text-tertiary)', opacity: 0.35, marginBottom: 16 }} />
            <h2 style={{ fontSize: isMobileView ? '1rem' : '1.2rem', fontWeight: 700, marginBottom: 6 }}>{t('No department data yet')}</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: isMobileView ? '0.8rem' : '0.9rem' }}>{t('Department ranking will appear as complaints are processed.')}</p>
          </motion.div> :

        activeTab === 'ecopoints' ?
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
                  border: isMe ? '1.5px solid rgba(232,33,42,0.4)' : rankBorder(u.rank),
                  boxShadow: isMe ? '0 0 0 3px rgba(232,33,42,0.08)' : u.rank <= 3 ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                  transition: 'all 0.2s ease'
                }}>
                
                  {}
                  <div className="lb-rank" style={{ width: 28, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    {rankIcon(u.rank)}
                  </div>

                  {}
                  <div style={{
                  width: isMobileView ? 34 : 40, height: isMobileView ? 34 : 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  background: pic ? 'none' : 'linear-gradient(135deg, #E8212A, #FF6B35)',
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
                      color: isMe ? '#E8212A' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        {u.username}{isMe ? ` (${t('you')})` : ''}
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
                      {u.badges.length} {t('badges')}
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
          </div> :

        <div style={{ display: 'grid', gridTemplateColumns: isMobileView ? '1fr' : '1fr 1fr', gap: 12 }}>
            {departmentRankings.map((dept, idx) =>
          <motion.div
            key={dept.department}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: idx * 0.04 }}
            style={{
              border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14,
              padding: isMobileView ? 12 : 14,
              boxShadow: dept.rank <= 3 ? '0 8px 18px rgba(0,0,0,0.06)' : 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{
                    width: 28, height: 28, borderRadius: 999, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: dept.rank <= 3 ? 'rgba(245,158,11,0.14)' : 'var(--surface-alt)',
                    color: dept.rank <= 3 ? '#d97706' : 'var(--text-secondary)', fontWeight: 800, fontSize: '0.78rem'
                  }}>{dept.rank}</span>
                    <h3 style={{ fontSize: isMobileView ? '0.86rem' : '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept.department}</h3>
                  </div>
                  <span style={{
                  fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent)',
                  background: 'var(--accent-light)', border: '1px solid var(--accent-border)',
                  borderRadius: 999, padding: '4px 10px'
                }}>{Math.round(dept.score)}</span>
                </div>

                <div style={{
                marginBottom: 10,
                height: 8,
                borderRadius: 999,
                background: 'var(--surface-alt)',
                overflow: 'hidden'
              }}>
                  <div style={{
                  width: `${clamp(dept.score, 0, 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #E8212A, #f59e0b)'
                }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', marginBottom: 4 }}><CheckCircle2 size={13} /><span style={{ fontSize: '0.68rem', fontWeight: 700 }}>{t('Resolve Rate')}</span></div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{dept.resolveRate.toFixed(1)}%</div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', marginBottom: 4 }}><AlertTriangle size={13} /><span style={{ fontSize: '0.68rem', fontWeight: 700 }}>{t('Undone Jobs')}</span></div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{dept.undone}</div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb', marginBottom: 4 }}><Clock3 size={13} /><span style={{ fontSize: '0.68rem', fontWeight: 700 }}>{t('Avg Response')}</span></div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{dept.avgResponseHours == null ? '-' : `${dept.avgResponseHours.toFixed(1)}h`}</div>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed', marginBottom: 4 }}><Gauge size={13} /><span style={{ fontSize: '0.68rem', fontWeight: 700 }}>{t('Avg Resolve')}</span></div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{dept.avgResolveHours == null ? '-' : `${dept.avgResolveHours.toFixed(1)}h`}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Star size={12} color="#f59e0b" /> {t('Citizen Rating')}: {dept.citizenRating.toFixed(1)}/5</span>
                  <span>{t('Total')}: {dept.total}</span>
                </div>
              </motion.div>
          )}
          </div>
        }
      </div>
    </div>);

};

export default LeaderboardPage;