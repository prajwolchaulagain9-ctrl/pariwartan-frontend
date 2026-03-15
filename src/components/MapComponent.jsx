import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as turf from '@turf/turf';
import Map, { Marker, Popup, NavigationControl, GeolocateControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navigation, Send, X, MapPin, Clock, User, Camera, ShieldAlert, AlertTriangle, Trash2, Lightbulb, Megaphone } from 'lucide-react';
import Lightbox from './Lightbox';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { API_URL, getImgUrl } from '../config';


const ZOOM_THRESHOLD = 14.5;
const NEPAL_BOUNDS = [80.0, 26.3, 88.3, 30.5];

export const MARKER_TYPES = [
{ id: 'Road Block', icon: ShieldAlert, color: '#f97316', label: 'Road Block' },
{ id: 'Pothole', icon: AlertTriangle, color: '#78716c', label: 'Pothole' },
{ id: 'Garbage', icon: Trash2, color: '#65a30d', label: 'Garbage Dump' },
{ id: 'Streetlight', icon: Lightbulb, color: '#a855f7', label: 'Streetlight Out' },
{ id: 'Noise', icon: Megaphone, color: '#ec4899', label: 'Noise Complaint' },
{ id: 'General', icon: MapPin, color: '#5e6ad2', label: 'General' }];


const getMarkerDef = (type) => MARKER_TYPES.find((m) => m.id === type) || MARKER_TYPES[MARKER_TYPES.length - 1];



const MapComponent = ({ onPinLocation, markers = [], pinMode = false, userLocation = null, manualLocation = null, zoomToId = null, onLocateMe, onCancelPin }) => {
  const { isDark } = useTheme();
  const mapRef = useRef();
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [zoom, setZoom] = useState(7);
  const [popupInfo, setPopupInfo] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (zoomToId && markers.length > 0) {
      const targetMarker = markers.find(m => m._id === zoomToId);
      if (targetMarker) {
        setPopupInfo(targetMarker);
      }
    }
  }, [zoomToId, markers]);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);


  const calcDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };


  const lightStyle = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
  const darkStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/opentechcommunity/map-of-nepal/master/nepal.geojson').
    then((r) => r.json()).then((d) => setGeoData(d)).catch(() => {});
  }, []);


  useEffect(() => {
    const loc = manualLocation || userLocation;
    if (loc?.lat && loc?.lng && mapRef.current) {
      mapRef.current.flyTo({
        center: [loc.lng, loc.lat],
        zoom: 16,
        duration: 2000,
        essential: true
      });
    }
  }, [userLocation?.lat, userLocation?.lng, manualLocation?.lat, manualLocation?.lng, manualLocation?._t]);


  const onMapLoad = (e) => {
    const map = e.target;

    const poiLayers = ['poi', 'landmark', 'hospital', 'school', 'park', 'attraction'];
    poiLayers.forEach((layer) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', 'none');
    });

    // Enhance map visuals with 3D buildings
    try {
      if (!map.getLayer('3d-buildings')) {
        map.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
              'fill-extrusion-color': isDark ? '#333333' : '#e5e5e5',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.7
            }
          }
        );
      }
    } catch(err) {
      console.log('3D buildings not supported on this map style');
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 84.124, latitude: 28.3949, zoom: 7 }}
        mapStyle={isDark ? darkStyle : lightStyle}
        style={{ width: '100%', height: '100%' }}
        onZoom={(e) => setZoom(e.viewState.zoom)}
        onLoad={onMapLoad}
        maxBounds={[79.0, 25.0, 89.0, 31.0]}>
        
        {}
        <NavigationControl position="bottom-right" showCompass={false} />
        
        {}
        {userLocation &&
        <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
            <div className="user-loc-wrapper">
              <div className="user-dot"></div>
              <div className="user-dot-label">You</div>
            </div>
          </Marker>
        }

        {}
        {geoData &&
        <Source type="geojson" data={geoData}>
            <Layer
            id="nepal-border"
            type="line"
            paint={{
              'line-color': '#5e6ad2',
              'line-width': 2,
              'line-opacity': 0.6
            }} />
          
          </Source>
        }

        {}
        {pinMode && userLocation &&
        <Source
          type="geojson"
          data={turf.circle([userLocation.lng, userLocation.lat], 5, { steps: 80, units: 'kilometers' })}>
          
            <Layer
            id="5km-radius-geo"
            type="fill"
            paint={{
              'fill-color': '#3b82f6',
              'fill-opacity': 0.10,
              'fill-outline-color': '#3b82f6'
            }} />
          
          </Source>
        }

        {}
        {pinMode &&
        <>
            {}
            {!selectedPin &&
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 100,
              cursor: 'crosshair',
              pointerEvents: 'auto'
            }}
            onClick={(e) => {
              if (!mapRef.current || !userLocation) return;
              const rect = mapRef.current.getCanvas().getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const coords = mapRef.current.unproject([x, y]);
              const distance = calcDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
              if (distance > 5) {
                toast.error(`Too far! Pin must be within 5km. Currently ${distance.toFixed(1)}km away.`, {
                  duration: 3000,
                  icon: '📍'
                });
                return;
              }
              setSelectedPin({ lat: coords.lat, lng: coords.lng });
              toast.success('Pin placed! Confirm or cancel below.', { duration: 2000, icon: '✓' });
            }} />

          }
            
            {}
            {selectedPin &&
          <Marker longitude={selectedPin.lng} latitude={selectedPin.lat}>
                <div style={{
              width: 40, height: 40,
              background: '#3b82f6',
              border: '3px solid white',
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
                  <div style={{ transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={20} color="white" /></div>
                </div>
              </Marker>
          }
          </>
        }

        {}
        {markers.map((m) => {
          const isSign = zoom >= ZOOM_THRESHOLD;
          const def = getMarkerDef(m.markerType);

          return (
            <Marker
              key={m._id}
              longitude={m.lng}
              latitude={m.lat}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPopupInfo(m);
              }}>
              
              {isSign ? (

              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))'
              }}>
                  <div style={{
                  width: 38, height: 38,
                  background: def.color,
                  borderRadius: '50% 50% 50% 4px',
                  transform: 'rotate(-45deg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2.5px solid white'
                }}>
                    <div style={{ transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><def.icon size={17} color="white" strokeWidth={2.5} /></div>
                  </div>
                  <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: def.color, opacity: 0.4, marginTop: 2
                }} />
                </div>) : (


              <div style={{
                width: 10, height: 10,
                background: def.color,
                border: '2px solid white',
                borderRadius: '50%',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                cursor: 'pointer'
              }} />)
              }
            </Marker>);

        })}

        {}
        {popupInfo && (() => {
          const def = getMarkerDef(popupInfo.markerType);
          const poster = popupInfo.userId;
          const hasImages = Array.isArray(popupInfo.images) && popupInfo.images.length > 0;
          const timeAgo = (date) => {
            const s = Math.floor((Date.now() - new Date(date)) / 1000);
            if (s < 60) return 'just now';
            const m = Math.floor(s / 60);if (m < 60) return `${m}m ago`;
            const h = Math.floor(m / 60);if (h < 24) return `${h}h ago`;
            const d = Math.floor(h / 24);if (d < 30) return `${d}d ago`;
            return new Date(date).toLocaleDateString();
          };
          return (
            <Popup
              longitude={popupInfo.lng}
              latitude={popupInfo.lat}
              anchor="bottom"
              onClose={() => setPopupInfo(null)}
              closeButton={false}
              offset={zoom >= ZOOM_THRESHOLD ? 44 : 12}
              className="custom-map-popup"
              maxWidth="320px">
              
              <div style={{ fontFamily: 'DM Sans, Mukta, sans-serif', minWidth: 240 }}>

                {}
                {hasImages &&
                <div style={{
                  margin: '-14px -14px 0 -14px',
                  borderRadius: '12px 12px 0 0', overflow: 'hidden',
                  display: 'grid',
                  gridTemplateColumns: popupInfo.images.length === 1 ? '1fr' : popupInfo.images.length === 2 ? '1fr 1fr' : '1fr 1fr',
                  gridTemplateRows: popupInfo.images.length <= 2 ? '120px' : '80px 80px',
                  gap: 2
                }}>
                    {popupInfo.images.slice(0, 3).map((img, i) =>
                  <img
                    key={i}
                    src={getImgUrl(img)}
                    alt=""
                    onClick={() => setLightbox({ images: popupInfo.images.map((im) => getImgUrl(im)), index: i })}
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      cursor: 'pointer',
                      ...(popupInfo.images.length === 3 && i === 0 ? { gridRow: '1 / 3' } : {})
                    }}
                    loading="lazy" />

                  )}
                  </div>
                }

                {}
                <div style={{ padding: hasImages ? '12px 0 0' : 0 }}>

                  {}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 6,
                      background: `${def.color}18`
                    }}>
                      <def.icon size={13} color={def.color} strokeWidth={2.5} />
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: def.color, letterSpacing: '0.02em' }}>{def.label}</span>
                    </div>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      background: popupInfo.status === 'Approved' || popupInfo.status === 'Progress' ? 'rgba(34,197,94,0.1)' : popupInfo.status === 'Resolved' ? 'rgba(232,33,42,0.1)' : 'rgba(107,114,128,0.1)',
                      color: popupInfo.status === 'Approved' || popupInfo.status === 'Progress' ? '#16a34a' : popupInfo.status === 'Resolved' ? '#E8212A' : '#6b7280'
                    }}>{popupInfo.status === 'Progress' ? 'Approved' : popupInfo.status}</span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => setPopupInfo(null)}
                      style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: 'none', background: 'var(--surface-alt, rgba(0,0,0,0.05))',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-tertiary)'
                      }}>
                      <X size={12} />
                    </button>
                  </div>

                  {}
                  <h3 style={{
                    margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 750,
                    color: 'var(--text)', lineHeight: 1.3
                  }}>{popupInfo.title}</h3>

                  {}
                  <p style={{
                    margin: '0 0 12px', fontSize: '0.78rem', color: 'var(--text-secondary)',
                    lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden'
                  }}>{popupInfo.description}</p>

                  {}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    paddingTop: 10, borderTop: '1px solid var(--border)'
                  }}>
                    {poster && typeof poster === 'object' ?
                    <>
                        {poster.profilePic ?
                      <img
                        src={getImgUrl(poster.profilePic)}
                        alt=""
                        style={{
                          width: 26, height: 26, borderRadius: '50%',
                          objectFit: 'cover', border: '1.5px solid var(--border)'
                        }} /> :


                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #E8212A, #FF6B35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 800, color: 'white'
                      }}>{poster.username?.[0]?.toUpperCase() || '?'}</div>
                      }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                          fontSize: '0.74rem', fontWeight: 700, color: 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>{poster.username}</div>
                        </div>
                      </> :

                    <>
                        <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'var(--surface-alt, rgba(0,0,0,0.05))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                          <User size={13} style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>Anonymous</div>
                        </div>
                      </>
                    }
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 500
                    }}>
                      <Clock size={11} />
                      {timeAgo(popupInfo.timestamp)}
                    </div>
                  </div>

                  {}
                  {popupInfo.complaintId &&
                  <div style={{
                    marginTop: 8, fontSize: '0.62rem', fontWeight: 700,
                    color: 'var(--text-tertiary)', letterSpacing: '0.04em',
                    fontFamily: 'monospace'
                  }}>#{popupInfo.complaintId}</div>
                  }
                </div>
              </div>
            </Popup>);

        })()}
      </Map>

      {}
      <button className="btn-secondary btn-sm"
      style={{ position: 'absolute', bottom: 108, right: 10, zIndex: 1000, background: 'var(--surface)', boxShadow: 'var(--shadow)' }}
      onClick={onLocateMe} title="My Location">
        <Navigation size={16} />
      </button>

      {}
      {pinMode && selectedPin &&
      <div style={{
        position: 'fixed',
        bottom: isMobileView ? 'calc(58px + env(safe-area-inset-bottom))' : 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        gap: isMobileView ? 8 : 12,
        background: 'var(--surface)',
        padding: isMobileView ? '8px 10px' : '12px 16px',
        borderRadius: isMobileView ? 10 : 12,
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border)'
      }}>
          <button
          className="btn-secondary btn-sm"
          onClick={() => {
            setSelectedPin(null);
            if (onCancelPin) onCancelPin();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: isMobileView ? '6px 8px' : undefined,
            fontSize: isMobileView ? '0.74rem' : undefined,
            minHeight: isMobileView ? 32 : undefined
          }}>
          
            <X size={isMobileView ? 14 : 16} /> Cancel
          </button>
          <button
          className="btn-primary btn-sm"
          onClick={() => onPinLocation(selectedPin)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: isMobileView ? '6px 8px' : undefined,
            fontSize: isMobileView ? '0.74rem' : undefined,
            minHeight: isMobileView ? 32 : undefined
          }}>
          
            <Send size={isMobileView ? 14 : 16} /> Confirm
          </button>
        </div>
      }
      {lightbox &&
      <Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />
      }
    </div>);

};

export default MapComponent;