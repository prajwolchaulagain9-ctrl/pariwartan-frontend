import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';



const MapPicker = ({ initial, onCancel, onConfirm }) => {
  const mapRef = useRef(null);
  const mapElRef = useRef(null);
  const markerRef = useRef(null);
  const [loadingLib, setLoadingLib] = useState(false);
  const [coords, setCoords] = useState(initial || { lat: 27.7172, lng: 85.3240, zoom: 13 });

  useEffect(() => {
    let cssEl, scriptEl;
    const ensureLeaflet = () => new Promise((resolve, reject) => {
      if (window.L) return resolve(window.L);
      setLoadingLib(true);
      cssEl = document.createElement('link');
      cssEl.rel = 'stylesheet';
      cssEl.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      cssEl.crossOrigin = '';
      document.head.appendChild(cssEl);

      scriptEl = document.createElement('script');
      scriptEl.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      scriptEl.onload = () => {setLoadingLib(false);resolve(window.L);};
      scriptEl.onerror = reject;
      document.body.appendChild(scriptEl);
    });

    let mounted = true;
    ensureLeaflet().then((L) => {
      if (!mounted) return;

      mapRef.current = L.map(mapElRef.current).setView([coords.lat, coords.lng], coords.zoom || 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      mapRef.current.on('click', function (e) {
        const { lat, lng } = e.latlng;
        setCoords({ lat, lng, zoom: mapRef.current.getZoom() });
        if (markerRef.current) markerRef.current.setLatLng(e.latlng);else
        markerRef.current = L.marker(e.latlng).addTo(mapRef.current);
      });


      if (initial && initial.lat && initial.lng) {
        markerRef.current = L.marker([initial.lat, initial.lng]).addTo(mapRef.current);
        mapRef.current.setView([initial.lat, initial.lng], initial.zoom || 13);
      }
    }).catch(() => {
      setLoadingLib(false);
    });

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.off();
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (cssEl) cssEl.remove();
      if (scriptEl) scriptEl.remove();
    };
  }, []);

  const handleConfirm = async () => {

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      const display = data?.display_name || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      onConfirm({ lat: coords.lat, lng: coords.lng, display_name: display });
    } catch (e) {
      onConfirm({ lat: coords.lat, lng: coords.lng, display_name: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` });
    }
  };

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ zIndex: 3000 }}>
      <motion.div className="modal-box" style={{ maxWidth: '90%', width: 900, height: '80vh', padding: 0, overflow: 'hidden' }} initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
        <div className="modal-header" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(6px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px' }}>
          <span className="modal-title">Pin location on map</span>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onCancel}><X size={18} /></button>
        </div>

        <div style={{ width: '100%', height: '100%', paddingTop: 56, display: 'flex', flexDirection: 'column' }}>
          <div ref={mapElRef} style={{ flex: 1 }} />
          <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Selected</div>
              <div style={{ fontWeight: 800 }}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" onClick={onCancel}>Cancel</button>
              <button className="btn-primary" onClick={handleConfirm}>Use this location</button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>);

};

export default MapPicker;