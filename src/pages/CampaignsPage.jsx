import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import {
  Megaphone,
  Loader2,
  MapPin,
  X,
  CheckCircle2,
  Info,
  Globe,
  Instagram,
  Twitter } from
'lucide-react';
import toast from 'react-hot-toast';

const fallbackCampaigns = [
{
  _id: 'fallback-1',
  title: 'Bagmati Weekend Cleanup',
  description: 'Join a riverbank cleanup drive with local volunteers focused on waste removal and neighborhood awareness.',
  image: 'https://images.unsplash.com/photo-1559027615-cd4428a20401?q=80&w=1200&auto=format&fit=crop',
  location: 'Bagmati River Corridor, Kathmandu',
  motives: ['Waste reduction', 'Community participation', 'Cleaner public spaces'],
  organizerSocial: { instagram: '#', twitter: '#', website: '#' },
  status: 'Active',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
},
{
  _id: 'fallback-2',
  title: 'Ward Park Plantation Drive',
  description: 'A neighborhood tree-planting campaign to improve shade, air quality, and public ownership of shared green space.',
  image: 'https://images.unsplash.com/photo-1492496913980-501348b61469?q=80&w=1200&auto=format&fit=crop',
  location: 'Ward Community Park',
  motives: ['Greener streets', 'Youth engagement', 'Climate resilience'],
  organizerSocial: { instagram: '#', twitter: '#', website: '#' },
  status: 'Upcoming',
  startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
}];


const Countdown = ({ endDate, t }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!endDate) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const distance = new Date(endDate).getTime() - now;
      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor(distance % (1000 * 60 * 60 * 24) / (1000 * 60 * 60)),
        minutes: Math.floor(distance % (1000 * 60 * 60) / (1000 * 60)),
        seconds: Math.floor(distance % (1000 * 60) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  if (!endDate) return null;

  const items = [
  { label: t('Days'), value: timeLeft.days, color: '#E8212A' },
  { label: t('Hours'), value: timeLeft.hours, color: '#f59e0b' },
  { label: t('Mins'), value: timeLeft.minutes, color: '#10b981' },
  { label: t('Secs'), value: timeLeft.seconds, color: '#3b82f6' }];


  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {items.map((item) =>
      <motion.div
        key={item.label}
        whileHover={{ y: -4 }}
        style={{
          background: 'var(--bg)',
          padding: '10px 8px',
          borderRadius: 10,
          textAlign: 'center',
          border: `1.5px solid ${item.color}20`
        }}>
        
          <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ fontSize: '1.1rem', fontWeight: 800, color: item.color }}>
          
            {item.value}
          </motion.div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
            {item.label}
          </div>
        </motion.div>
      )}
    </div>);

};

const MapOverlay = ({ query, onClose, t }) => {
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(query || '')}&output=embed`;

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ zIndex: 2000, backdropFilter: 'blur(6px)' }}>
      <motion.div className="modal-box" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ maxWidth: '90%', width: 1000, height: '80vh', padding: 0, overflow: 'hidden', borderRadius: 16, boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1.5px solid var(--border)', background: 'var(--bg)' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{t('Campaign Location')}</span>
          <motion.button whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)' }}>
            <X size={18} />
          </motion.button>
        </div>
        <iframe src={embedUrl} style={{ width: '100%', height: 'calc(100% - 57px)', border: 'none' }} loading="lazy" title={t('Campaign Map')} />
      </motion.div>
    </motion.div>);

};

const RegisterModal = ({ campaign, onClose, t }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', contact: '', address: '' });

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/campaigns/${campaign._id}/register`, formData);
      toast.success(`${t('Successfully registered for')} ${campaign.title}`);
      onClose();
    } catch {
      toast.error(t('Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)' }}>
      <motion.div className="modal-box" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} style={{ borderRadius: 16, maxWidth: 500, boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
        <div style={{ padding: 24, borderBottom: '1.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px 0' }}>{t('Join Campaign')}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{t('Register to participate')}</p>
          </div>
          <motion.button whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text)' }}>
            <X size={18} />
          </motion.button>
        </div>

        <form onSubmit={submit} style={{ padding: 24, display: 'grid', gap: 14 }}>
          {[
          { key: 'name', label: t('Name'), type: 'text', placeholder: t('Full name') },
          { key: 'email', label: t('Email'), type: 'email', placeholder: 'you@example.com' },
          { key: 'contact', label: t('Contact'), type: 'text', placeholder: '+977 98...' },
          { key: 'address', label: t('Address'), type: 'text', placeholder: t('Your address') }].
          map((field) =>
          <div key={field.key}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {field.label}
              </label>
              <input
              type={field.type}
              required
              value={formData[field.key]}
              onChange={(event) => setFormData({ ...formData, [field.key]: event.target.value })}
              placeholder={field.placeholder}
              style={{ width: '100%', padding: '11px 12px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' }} />
            
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClose} style={{ flex: 1, padding: '11px 16px', background: 'var(--bg)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
              {t('Cancel')}
            </motion.button>
            <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ flex: 1, padding: '11px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.65 : 1 }}>
              {loading ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
              {loading ? t('Registering...') : t('Confirm Registration')}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>);

};

const CampaignInfoModal = ({ campaign, onClose, t }) => {
  const [activeTab, setActiveTab] = useState('About');
  const [showMap, setShowMap] = useState(false);
  const motives = Array.isArray(campaign.motives) ?
  campaign.motives :
  typeof campaign.motives === 'string' && campaign.motives.trim() ?
  campaign.motives.split('\n').map((item) => item.trim()).filter(Boolean) :
  ['Participation', 'Impact'];
  const social = campaign.organizerSocial || {};

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)' }}>
      <motion.div className="modal-box" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} style={{ maxWidth: 600, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 16, boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ position: 'relative', aspectRatio: '16/9', maxHeight: 320, overflow: 'hidden', flexShrink: 0 }}>
          <img src={campaign.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={campaign.title} />
          <motion.button whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(15, 23, 42, 0.7)', border: 'none', color: 'white', width: 40, height: 40, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </motion.button>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 16, left: 20, right: 20 }}>
            <h2 style={{ color: 'white', fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{campaign.title}</h2>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1.5px solid var(--border)', flexShrink: 0 }}>
          {['About', 'Motives', 'Organizer'].map((tab) =>
          <motion.button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '14px 16px', background: activeTab === tab ? 'var(--bg)' : 'transparent', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: activeTab === tab ? 700 : 600, fontSize: '0.85rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t(tab)}
            </motion.button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {activeTab === 'About' &&
          <div style={{ display: 'grid', gap: 16 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, margin: 0 }}>{campaign.description}</p>
              {campaign.location &&
            <button onClick={() => setShowMap(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '10px 14px', background: 'var(--bg)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                  <MapPin size={16} /> {campaign.location}
                </button>
            }
            </div>
          }

          {activeTab === 'Motives' &&
          <div style={{ display: 'grid', gap: 10 }}>
              {motives.map((motive, index) =>
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: 'white', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {index + 1}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{motive}</p>
                </div>
            )}
            </div>
          }

          {activeTab === 'Organizer' &&
          <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', padding: 16, borderRadius: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, flexShrink: 0 }}>
                  P
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Pariwartan Initiative</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('Community Impact Partner')}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
              { icon: Instagram, label: 'Instagram', link: social.instagram },
              { icon: Twitter, label: 'Twitter', link: social.twitter }].
              map((entry) => {
                const Icon = entry.icon;
                return (
                  <a key={entry.label} href={entry.link || '#'} style={{ padding: 12, border: '1.5px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                      <Icon size={16} /> {entry.label}
                    </a>);

              })}
                <a href={social.website || '#'} style={{ padding: 12, border: '1.5px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, gridColumn: '1 / -1' }}>
                  <Globe size={16} /> {t('Website')}
                </a>
              </div>
            </div>
          }
        </div>

        <div style={{ borderTop: '1.5px solid var(--border)', padding: '16px 20px', flexShrink: 0 }}>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClose} style={{ width: '100%', padding: '11px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
            {t('Close')}
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showMap && <MapOverlay query={campaign.location || ''} onClose={() => setShowMap(false)} t={t} />}
      </AnimatePresence>
    </motion.div>);

};

const CampaignsPage = ({ embedded = false }) => {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerFor, setRegisterFor] = useState(null);
  const [infoFor, setInfoFor] = useState(null);

  useEffect(() => {
    axios.
    get(`${API_URL}/api/campaigns`).
    then((response) => {
      const items = Array.isArray(response.data) ? response.data : [];
      setCampaigns(items.length > 0 ? items : fallbackCampaigns);
    }).
    catch(() => {
      setCampaigns(fallbackCampaigns);
      toast.error(t('Could not load campaigns. Showing fallback items.'));
    }).
    finally(() => setLoading(false));
  }, [t]);

  const content =
  <>
      {!embedded &&
    <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.03em', margin: '0 0 4px 0' }}>{t('Campaigns')}</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', fontWeight: 500, margin: 0 }}>{t('Join initiatives. Support causes.')}</p>
        </motion.header>
    }

        {loading ?
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 24 }}>
            {[1, 2, 3].map((item) =>
      <div key={item} className="skeleton" style={{ height: 420 }} />
      )}
          </motion.div> :
    campaigns.length === 0 ?
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Megaphone size={36} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0' }}>{t('No campaigns yet')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 380, margin: 0 }}>{t('Check back soon for new campaigns.')}</p>
          </motion.div> :

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 24 }}>
            {campaigns.map((campaign, idx) =>
      <motion.div
        key={campaign._id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: idx * 0.06 }}>
        
                <motion.div whileHover={{ y: -6, borderColor: 'var(--accent)' }} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-xs)' }}>
                  <div style={{ aspectRatio: '16/9', overflow: 'hidden', position: 'relative', background: 'var(--bg)' }}>
                    <motion.img whileHover={{ scale: 1.08 }} transition={{ duration: 0.4 }} src={campaign.image || 'https://images.unsplash.com/photo-1559027615-cd4428a20401?q=80&w=600&auto=format&fit=crop'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={campaign.title} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.2) 100%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      {campaign.startDate && new Date(campaign.startDate) > new Date() ?
              <motion.span animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 2 }} style={{ padding: '5px 12px', background: 'var(--accent)', color: 'white', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {t('Coming Soon')}
                        </motion.span> :
              <span />}
                      <span style={{ padding: '5px 12px', background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600 }}>
                        {campaign.startDate && new Date(campaign.startDate) > new Date() ? t('Upcoming') : t(campaign.status || 'Active')}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, margin: '0 0 10px 0' }}>{campaign.title}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 14px 0', flex: 1, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{campaign.description}</p>

                    {campaign.endDate &&
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{t('Campaign Ends In')}</div>
                        <Countdown endDate={campaign.endDate} t={t} />
                      </div>
            }

                    <div style={{ display: 'flex', gap: 10 }}>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setRegisterFor(campaign)} style={{ flex: 1, padding: '10px 14px', background: 'linear-gradient(135deg, #E8212A, #FF6B35)', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 2px 8px rgba(232,33,42,0.3)' }}>
                        <CheckCircle2 size={14} /> {t('Register')}
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.04, color: 'white', background: 'var(--accent)' }} whileTap={{ scale: 0.96 }} onClick={() => setInfoFor(campaign)} style={{ padding: '10px 14px', background: 'var(--bg)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('Campaign details')}>
                        <Info size={16} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
      )}
          </div>
    }

      <AnimatePresence>
        {registerFor && <RegisterModal campaign={registerFor} onClose={() => setRegisterFor(null)} t={t} />}
        {infoFor && <CampaignInfoModal campaign={infoFor} onClose={() => setInfoFor(null)} t={t} />}
      </AnimatePresence>
    </>;


  if (embedded) return content;

  return (
    <div className="main-content">
      <div className="max-content">
        {content}
      </div>
    </div>);

};

export default CampaignsPage;