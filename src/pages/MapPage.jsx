import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import MapComponent, { MARKER_TYPES } from '../components/MapComponent';
import useGeoLocation from '../hooks/useGeoLocation';
import { MapPin, X, Loader2, AlertTriangle, ImagePlus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

const MapPage = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [pinMode, setPinMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [manualCenter, setManualCenter] = useState(null);
  const [tempCoords, setTempCoords] = useState(null);
  const [detectedArea, setDetectedArea] = useState('Detecting...');
  const [form, setForm] = useState({ title: '', description: '', type: 'Suggestion', markerType: 'General' });
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const fileRef = useRef(null);
  const userLoc = useGeoLocation();
  const location = useLocation();
  const [zoomToId, setZoomToId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    const zoomTo = params.get('zoomTo');
    if (!isNaN(lat) && !isNaN(lng)) {
      setManualCenter({ lat, lng, _t: Date.now() });
    }
    if (zoomTo) {
      setZoomToId(zoomTo);
    }
  }, [location.search]);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/api/suggestions`).
    then((r) => setSuggestions(r.data)).
    catch(() => toast.error('Could not load map data.'));
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {document.body.style.overflow = '';};
  }, [showModal]);

  const calcDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371,dLat = (lat2 - lat1) * Math.PI / 180,dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleStartPinning = () => {
    if (!localStorage.getItem('user')) {toast.error('Please sign in to submit a complaint.');return;}
    setPinMode(true);
    toast('Click on the map to drop a pin.', { icon: '📍' });
  };

  const handleConfirmPin = async (coords) => {
    if (userLoc.loaded && userLoc.coordinates.lat) {
      const dist = calcDistance(userLoc.coordinates.lat, userLoc.coordinates.lng, coords.lat, coords.lng);
      if (dist > 5) {toast.error(`Pin must be within 5km. Currently ${dist.toFixed(1)}km away.`);return;}
    }
    setTempCoords(coords);
    setShowModal(true);
    setDetectedArea('Detecting...');
    try {
      const r = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`);
      const a = r.data.address;
      setDetectedArea(a.suburb || a.neighbourhood || a.city_district || a.city || 'Unknown Area');
    } catch {setDetectedArea('Unknown Area');}
  };

  const handleCancel = () => {
    setShowModal(false);
    setPinMode(false);
    setTempCoords(null);
    setForm({ title: '', description: '', type: 'Suggestion', markerType: 'General' });
    setImages([]);
    setPreviews([]);
  };

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 3) {toast.error('Maximum 3 images allowed');return;}
    const validFiles = files.filter((f) => f.size <= 5 * 1024 * 1024);
    if (validFiles.length < files.length) toast.error('Some files exceeded 5MB limit');
    const newImages = [...images, ...validFiles].slice(0, 3);
    setImages(newImages);
    const newPreviews = newImages.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => {prev.forEach((u) => URL.revokeObjectURL(u));return newPreviews;});
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.description) {toast.error('Please fill in all fields.');return;}
    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('type', form.type);
      fd.append('markerType', form.markerType);
      fd.append('lat', tempCoords.lat);
      fd.append('lng', tempCoords.lng);
      fd.append('wada', detectedArea);
      fd.append('city', 'Kathmandu');
      images.forEach((f) => fd.append('images', f));
      await axios.post(`${API_URL}/api/suggestions`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Complaint submitted — pending admin review.');
      setShowModal(false);setPinMode(false);
      setForm({ title: '', description: '', type: 'Suggestion', markerType: 'General' });
      setImages([]);setPreviews([]);
      const r = await axios.get(`${API_URL}/api/suggestions`);
      setSuggestions(r.data);
    } catch {toast.error('Failed to submit. Please try again.');} finally
    {setSubmitting(false);}
  };

  const selectedMarker = MARKER_TYPES.find((m) => m.id === form.markerType) || MARKER_TYPES[MARKER_TYPES.length - 1];

  return (
    <motion.div
      className="map-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 68px)',
        background: 'var(--bg)',
        overflow: 'hidden'
      }}>
      
      {}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden'
        }}>
        <MapComponent
          pygame={pinMode}
          onPinLocation={handleConfirmPin}
          markers={suggestions}
          userLocation={userLoc.loaded ? userLoc.coordinates : null}
          manualLocation={manualCenter}
          zoomToId={zoomToId}
          pinMode={pinMode}
          onLocateMe={() => {
            if (userLoc.loaded && userLoc.coordinates.lat) setManualCenter({ ...userLoc.coordinates, _t: Date.now() });else
            navigator.geolocation?.getCurrentPosition(
              (p) => setManualCenter({ lat: p.coords.latitude, lng: p.coords.longitude, _t: Date.now() }),
              () => toast.error('Location unavailable.'),
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
            );
          }}
          onCancelPin={() => {
            setPinMode(false);
            setTempCoords(null);
          }} />
        

        {}
        <AnimatePresence>
          {userLoc.error &&
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
              <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
              background: 'rgba(239,68,68,0.9)', backdropFilter: 'blur(8px)',
              borderRadius: 10, boxShadow: '0 4px 16px rgba(239,68,68,0.25)'
            }}>
                <AlertTriangle size={13} color="white" />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'white' }}>GPS unavailable</span>
              </div>
            </motion.div>
          }
          {!userLoc.loaded && !userLoc.error &&
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 100 }}>
              <div style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
            }}>
                <Loader2 size={13} className="spin" style={{ color: '#7c3aed' }} />
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Locating...</span>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {}
        <motion.button
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleStartPinning}
          disabled={pinMode}
          style={{
            position: isMobileView ? 'fixed' : 'absolute',
            bottom: isMobileView ? 'calc(64px + env(safe-area-inset-bottom))' : 16,
            left: 16,
            zIndex: isMobileView ? 2001 : 1000,
            width: isMobileView ? 38 : 'auto',
            height: isMobileView ? 38 : 'auto',
            padding: isMobileView ? 0 : '11px 18px',
            borderRadius: isMobileView ? 11 : 12,
            border: 'none',
            background: pinMode ? 'var(--text-tertiary)' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            color: 'white',
            fontWeight: 700,
            fontSize: isMobileView ? 0 : '0.84rem',
            cursor: pinMode ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobileView ? 0 : 8,
            boxShadow: pinMode ? 'none' : isMobileView ? '0 4px 14px rgba(124,58,237,0.35)' : '0 4px 20px rgba(124,58,237,0.35)',
            opacity: pinMode ? 0.5 : 1,
            transition: 'all 0.2s ease',
            letterSpacing: isMobileView ? 0 : '0.01em'
          }}>
          <MapPin size={isMobileView ? 16 : 15} />
          {!isMobileView && (pinMode ? 'Placing...' : 'Drop Pin')}
        </motion.button>
      </div>


      {}
      <AnimatePresence>
        {showModal &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleCancel}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(8px)',
            padding: 16
          }}>
            <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '85vh',
              background: 'var(--surface)',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              border: '1px solid var(--border)'
            }}>

              {}
              <div style={{
              padding: '18px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(129,140,248,0.12))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <selectedMarker.icon size={20} color="#7c3aed" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                      New Report
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={10} /> {detectedArea}
                    </p>
                  </div>
                </div>
                <motion.button
                whileHover={{ rotate: 90, scale: 1.1 }}
                whileTap={{ scale: 0.85 }}
                onClick={handleCancel}
                style={{
                  padding: 8, background: 'var(--surface-alt)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text)'
                }}>
                  <X size={16} />
                </motion.button>
              </div>

              {}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

                {}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Type
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['Complaint', 'Suggestion'].map((type) =>
                    <button
                      key={type}
                      onClick={() => setForm((f) => ({ ...f, type }))}
                      style={{
                        flex: 1, padding: '8px 6px', borderRadius: 8,
                        border: form.type === type ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                        background: form.type === type ? 'var(--accent-light)' : 'var(--bg)',
                        color: form.type === type ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.15s ease'
                      }}>
                          {type}
                        </button>
                    )}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Category
                    </label>
                    <select
                    value={form.markerType}
                    onChange={(e) => setForm((f) => ({ ...f, markerType: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      border: '1.5px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--text)', fontSize: '0.82rem', fontWeight: 500,
                      fontFamily: 'inherit', cursor: 'pointer'
                    }}>
                      {MARKER_TYPES.map((m) =>
                    <option key={m.id} value={m.id}>{m.label}</option>
                    )}
                    </select>
                  </div>
                </div>

                {}
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Title
                  </label>
                  <input
                  type="text"
                  placeholder="Brief, clear title..."
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={100}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'inherit',
                    outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {e.target.style.borderColor = 'var(--accent)';e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';}}
                  onBlur={(e) => {e.target.style.borderColor = 'var(--border)';e.target.style.boxShadow = 'none';}} />
                
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '4px 0 0', textAlign: 'right' }}>
                    {form.title.length}/100
                  </p>
                </div>

                {}
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Description
                  </label>
                  <textarea
                  rows={3}
                  placeholder="Describe the issue in detail..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  maxLength={500}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text)', fontSize: '0.88rem', fontFamily: 'inherit',
                    resize: 'vertical', minHeight: 60, outline: 'none',
                    transition: 'all 0.2s ease', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {e.target.style.borderColor = 'var(--accent)';e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';}}
                  onBlur={(e) => {e.target.style.borderColor = 'var(--border)';e.target.style.boxShadow = 'none';}} />
                
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '4px 0 0', textAlign: 'right' }}>
                    {form.description.length}/500
                  </p>
                </div>

                {}
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Photos <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>({images.length}/3)</span>
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {previews.map((src, i) =>
                  <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 22, height: 22, borderRadius: 6,
                        background: 'rgba(0,0,0,0.6)', border: 'none',
                        color: 'white', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                  )}
                    {images.length < 3 &&
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => fileRef.current?.click()}
                    style={{
                      width: 80, height: 80, borderRadius: 10,
                      border: '2px dashed var(--border)', background: 'var(--bg)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 4,
                      color: 'var(--text-tertiary)', transition: 'all 0.2s ease'
                    }}>
                        <ImagePlus size={18} />
                        <span style={{ fontSize: '0.6rem', fontWeight: 600 }}>Add</span>
                      </motion.button>
                  }
                  </div>
                  <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleImageAdd}
                  style={{ display: 'none' }} />
                
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
                    JPG, PNG, WebP · Max 5MB each
                  </p>
                </div>
              </div>

              {}
              <div style={{
              padding: '14px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', gap: 10, flexShrink: 0
            }}>
                <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancel}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontWeight: 600, fontSize: '0.88rem',
                  cursor: 'pointer'
                }}>
                  Cancel
                </motion.button>
                <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={submitting || !form.title || !form.description}
                onClick={handleSubmit}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  border: 'none',
                  background: submitting || !form.title || !form.description ?
                  'rgba(124,58,237,0.3)' :
                  'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  color: 'white', fontWeight: 600, fontSize: '0.88rem',
                  cursor: submitting || !form.title || !form.description ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: submitting || !form.title || !form.description ?
                  'none' :
                  '0 2px 10px rgba(124,58,237,0.3)'
                }}>
                  {submitting ?
                <><Loader2 size={14} className="spin" /> Submitting...</> :

                <><selectedMarker.icon size={14} /> Submit</>
                }
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

};

export default MapPage;