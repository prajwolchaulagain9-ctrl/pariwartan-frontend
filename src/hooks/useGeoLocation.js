import { useState, useEffect, useRef, useCallback } from 'react';
import { getReliablePosition, startGeoWatch, stopGeoWatch } from '../utils/geolocation';

const useGeoLocation = () => {
  const [location, setLocation] = useState({
    loaded: false,
    coordinates: { lat: 27.7172, lng: 85.3240 },
    error: null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasFix, setHasFix] = useState(false);
  const hasFixRef = useRef(false);

  const onSuccess = (position) => {
    hasFixRef.current = true;
    setHasFix(true);
    setLocation({
      loaded: true,
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      },
      error: null
    });
  };

  const onError = (error) => {

    if (hasFixRef.current && (error.code === 2 || error.code === 3)) {
      return;
    }
    setLocation((prev) => ({
      ...prev,
      loaded: true,
      error: {
        code: error.code,
        message: error.message
      }
    }));
  };

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setLocation((prev) => ({ ...prev, error: null }));

    getReliablePosition().
    then(({ position }) => onSuccess(position)).
    catch((error) => onError(error)).
    finally(() => setIsRefreshing(false));
  }, []);

  useEffect(() => {
    refresh();

    const watchId = startGeoWatch(onSuccess, onError);
    return () => stopGeoWatch(watchId);
  }, []);

  return {
    ...location,
    refresh,
    isRefreshing,
    hasFix
  };
};

export default useGeoLocation;