

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
export const API_URL = rawApiUrl.replace(/\/+$/, '');


export const getImgUrl = (img) => {
  if (!img) return '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;


  if (img.startsWith('/uploads/profiles/http://') || img.startsWith('/uploads/profiles/https://')) {
    return img.replace('/uploads/profiles/', '');
  }

  if (img.startsWith('/')) return `${API_URL}${img}`;


  if (!img.includes('/')) return `${API_URL}/uploads/profiles/${img}`;

  return `${API_URL}/${img}`;
};


export const getImgFallbackUrl = (img) => {
  const resolved = getImgUrl(img);
  if (!resolved) return '';
  if (!/^https?:\/\/ik\.imagekit\.io\/[^/]+\/pariwartan\/(profiles|complaints)\//.test(resolved)) return '';
  if (resolved.includes('/pariwartan/pariwartan/')) return '';
  return resolved.replace('/pariwartan/', '/pariwartan/pariwartan/');
};