import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion } from 'framer-motion';
import { X, Check, ZoomIn } from 'lucide-react';
import toast from 'react-hot-toast';

const createImage = (url) =>
new Promise((resolve, reject) => {
  const img = new Image();
  img.addEventListener('load', () => resolve(img));
  img.addEventListener('error', reject);
  img.src = url;
});

async function getCroppedImg(imageSrc, crop) {
  try {
    console.log('getCroppedImg called with crop:', crop);
    const image = await createImage(imageSrc);
    console.log('Image loaded:', image.width, 'x', image.height);

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }


    ctx.beginPath();
    ctx.arc(200, 200, 200, 0, 2 * Math.PI);
    ctx.clip();


    const { x, y, width, height } = crop;
    console.log('Drawing image with:', { x, y, width, height });

    ctx.drawImage(
      image,
      x, y, width, height,
      0, 0, 400, 400
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          console.log('Canvas blob created:', blob ? `${blob.size} bytes` : 'null');
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
          } else if (blob.size === 0) {
            reject(new Error('Canvas blob is empty - image may not have drawn correctly'));
          } else {
            resolve(blob);
          }
        },
        'image/jpeg',
        0.92
      );
    });
  } catch (err) {
    console.error('Error cropping image:', err);
    throw err;
  }
}

const ImageCropper = ({ imageSrc, onCropDone, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  React.useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleDone = async () => {
    if (!croppedAreaPixels) {
      toast.error('Please select a crop area');
      return;
    }
    try {
      console.log('Starting crop with area pixels:', croppedAreaPixels);
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      console.log('Got blob back:', blob);
      if (!blob || !(blob instanceof Blob)) {
        toast.error('Failed to process image. Please try again.');
        return;
      }
      if (blob.size === 0) {
        toast.error('Image data is empty. Please try cropping again.');
        return;
      }
      console.log('Blob is valid, calling onCropDone');
      onCropDone(blob);
    } catch (err) {
      console.error('Crop error:', err);
      toast.error('Error cropping image: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column'
      }}>
      {}
      <div style={{ flex: 1, position: 'relative' }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete} />
        
      </div>

      {}
      <div style={{
        padding: isMobileView ? '10px 12px' : '16px 24px', background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: isMobileView ? 10 : 16
      }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCancel}
          style={{
            padding: isMobileView ? '7px 10px' : '10px 20px', borderRadius: isMobileView ? 8 : 10,
            border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
            color: 'white', fontWeight: 600, fontSize: isMobileView ? '0.76rem' : '0.85rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}>
          <X size={isMobileView ? 14 : 16} /> Cancel
        </motion.button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: isMobileView ? 140 : 200 }}>
          <ZoomIn size={isMobileView ? 12 : 14} style={{ color: 'rgba(255,255,255,0.6)' }} />
          <input
            type="range"
            min={1} max={3} step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#7c3aed' }} />
          
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDone}
          style={{
            padding: isMobileView ? '7px 10px' : '10px 20px', borderRadius: isMobileView ? 8 : 10,
            border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            color: 'white', fontWeight: 600, fontSize: isMobileView ? '0.76rem' : '0.85rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 2px 10px rgba(124,58,237,0.3)'
          }}>
          <Check size={isMobileView ? 14 : 16} /> Apply
        </motion.button>
      </div>
    </motion.div>);

};

export default ImageCropper;