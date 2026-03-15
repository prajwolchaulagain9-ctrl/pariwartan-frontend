import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const Lightbox = ({ images, startIndex = 0, onClose }) => {
  const [idx, setIdx] = useState(startIndex);

  const prev = useCallback(() => setIdx((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose, prev, next]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>

        {}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 10,
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
          <X size={20} />
        </button>

        {}
        {images.length > 1 &&
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
          background: 'rgba(0,0,0,0.4)', padding: '4px 14px', borderRadius: 20
        }}>
            {idx + 1} / {images.length}
          </div>
        }

        {}
        {images.length > 1 &&
        <button
          onClick={(e) => {e.stopPropagation();prev();}}
          style={{
            position: 'absolute', left: 16, zIndex: 10,
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
            <ChevronLeft size={22} />
          </button>
        }

        {}
        <AnimatePresence mode="wait">
          <motion.img
            key={idx}
            src={images[idx]}
            alt=""
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '85vw', maxHeight: '85vh',
              objectFit: 'contain', borderRadius: 10,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }} />
          
        </AnimatePresence>

        {}
        {images.length > 1 &&
        <button
          onClick={(e) => {e.stopPropagation();next();}}
          style={{
            position: 'absolute', right: 16, zIndex: 10,
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>
            <ChevronRight size={22} />
          </button>
        }
      </motion.div>
    </AnimatePresence>);

};

export default Lightbox;