const GEO_CACHE_KEY = 'pariwartan:lastGeoFix';
const GEO_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

const now = () => Date.now();

const canUseGeolocation = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

const getCurrentPosition = (options) => new Promise((resolve, reject) => {
  if (!canUseGeolocation()) {
    reject({ code: 0, message: 'Geolocation not supported' });
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, options);
});

export const saveGeoCache = (coords) => {
  try {
    const payload = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy || null,
      timestamp: now()
    };
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(payload));
  } catch {

  }
};

export const getGeoCache = () => {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.lat || !parsed?.lng || !parsed?.timestamp) return null;
    if (now() - parsed.timestamp > GEO_CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getReliablePosition = async () => {

  try {
    const position = await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0
    });
    saveGeoCache(position.coords);
    return { position, source: 'high-accuracy' };
  } catch (error) {

    if (error?.code === 1) throw error;
  }


  try {
    const position = await getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 14000,
      maximumAge: 60000
    });
    saveGeoCache(position.coords);
    return { position, source: 'low-accuracy' };
  } catch (error) {

    const cached = getGeoCache();
    if (cached) {
      return {
        position: {
          coords: {
            latitude: cached.lat,
            longitude: cached.lng,
            accuracy: cached.accuracy
          },
          timestamp: cached.timestamp
        },
        source: 'cache'
      };
    }
    throw error;
  }
};

export const startGeoWatch = (onSuccess, onError) => {
  if (!canUseGeolocation()) {
    onError?.({ code: 0, message: 'Geolocation not supported' });
    return null;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      saveGeoCache(position.coords);
      onSuccess?.(position);
    },
    onError,
    {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 5000
    }
  );
};

export const stopGeoWatch = (watchId) => {
  if (!canUseGeolocation() || watchId == null) return;
  navigator.geolocation.clearWatch(watchId);
};