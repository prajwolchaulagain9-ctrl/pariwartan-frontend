import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const EcoPointsContext = createContext();
export const useEcoPoints = () => useContext(EcoPointsContext);

export const EcoPointsProvider = ({ children }) => {
  const [ecoPoints, setEcoPoints] = useState(0);
  const [badges, setBadges] = useState([]);
  const [equippedBadge, setEquippedBadge] = useState('');
  const [allBadges, setAllBadges] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      fetchEcoPoints();
    }

    axios.get(`${API_URL}/api/badges`).then((r) => setAllBadges(r.data)).catch(() => {});
  }, [token]);

  const fetchEcoPoints = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const nextEcoPoints = Number(
        r.data?.ecoPoints ??
        r.data?.eco_points ??
        r.data?.user?.ecoPoints ??
        r.data?.user?.eco_points ??
        0
      );
      setEcoPoints(Number.isFinite(nextEcoPoints) ? nextEcoPoints : 0);
      setBadges(r.data.badges || []);
      setEquippedBadge(r.data.equippedBadge || '');
    } catch {}
  };

  const updateEcoPoints = (points) => {
    setEcoPoints((prev) => prev + points);
  };

  const equipBadge = async (badgeId) => {
    try {
      await axios.patch(`${API_URL}/api/user/badge`, { badgeId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEquippedBadge(badgeId || '');
    } catch {}
  };

  return (
    <EcoPointsContext.Provider value={{ ecoPoints, setEcoPoints, fetchEcoPoints, updateEcoPoints, badges, equippedBadge, equipBadge, allBadges }}>
      {children}
    </EcoPointsContext.Provider>);

};