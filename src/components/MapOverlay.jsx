import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';


export const deriveSearchQuery = (location, mapUrl) => {
  if (location && location.trim() !== '') return location;
  if (!mapUrl) return '';

  try {
    const u = new URL(mapUrl);
    if (u.hostname.includes('google')) {
      const params = new URLSearchParams(u.search);
      if (params.get('q')) return params.get('q');
      const parts = u.pathname.split('/').filter(Boolean);
      const placeIdx = parts.indexOf('place');
      if (placeIdx !== -1 && parts.length > placeIdx + 1) {
        return decodeURIComponent(parts[placeIdx + 1].replace(/\+/g, ' '));
      }
      const atPart = parts.find((p) => p.startsWith('@'));
      if (atPart) {
        const coords = atPart.substring(1).split(',');
        if (coords.length >= 2) return coords[0] + ',' + coords[1];
      }
    }
  } catch (e) {

  }

  return mapUrl;
};

const MapOverlay = ({ query, onClose }) => {
  const [searchQuery, setSearchQuery] = useState(query || '');
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(searchQuery)}&output=embed`;

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ zIndex: 2000 }}>
      <motion.div className="modal-box" style={{ maxWidth: '90%', width: 1000, height: '80vh', padding: 0, overflow: 'hidden' }} initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
        <div className="modal-header" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px' }}>
          <span className="modal-title">Map — Search location</span>
          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location or refine address"
              className="input"
              style={{ width: '100%', margin: 0 }} />
            
            <button className="btn-ghost" onClick={() => setSearchQuery(searchQuery)} style={{ whiteSpace: 'nowrap' }}>Search</button>
          </div>
          <button className="btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ width: '100%', height: '100%', paddingTop: 60 }}>
          <iframe
            src={embedUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allowFullScreen=""
            loading="lazy"
            title="Google Maps Location">
          </iframe>
        </div>
      </motion.div>
    </motion.div>);

};

export default MapOverlay;