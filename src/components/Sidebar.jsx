import React from 'react';
import { findWadaAdakshya } from '../utils/wadaData';
import { MapPin, MessageSquare, User, Phone, Info } from 'lucide-react';

const Sidebar = ({ suggestions, selectedWada, onSelectSuggestion, onPinLocation }) => {
  const wadaInfo = selectedWada ? findWadaAdakshya(selectedWada) : null;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3 className="m-0 d-flex align-items-center gap-2">
          <MessageSquare size={24} />
          Pariwartan
        </h3>
        <p className="small mb-0 opacity-75 mt-1">Make Nepal Better, One Suggestion at a Time</p>
        
        <button
          className="btn btn-light btn-sm w-100 mt-3 fw-bold d-flex align-items-center justify-content-center gap-2"
          onClick={onPinLocation}>
          
          <MapPin size={16} /> Pin My Location
        </button>
      </div>

      <div className="sidebar-content">
        {selectedWada && wadaInfo &&
        <div className="wada-info-box mb-4">
            <h6 className="d-flex align-items-center gap-2 mb-3">
              <Info size={18} className="text-primary" />
              Wada Information: {selectedWada}
            </h6>
            <div className="d-flex flex-column gap-2 small">
              <div className="d-flex align-items-center gap-2">
                <User size={14} /> <strong>Adakshya:</strong> {wadaInfo.name}
              </div>
              <div className="d-flex align-items-center gap-2">
                <Phone size={14} /> <strong>Contact:</strong> {wadaInfo.contact}
              </div>
              <div className="d-flex align-items-center gap-2">
                <MapPin size={14} /> <strong>Office:</strong> {wadaInfo.office}
              </div>
              {wadaInfo.note &&
            <div className="mt-2 text-primary fw-bold">
                  {wadaInfo.note}
                </div>
            }
            </div>
          </div>
        }

        <h5 className="mb-3 text-secondary d-flex align-items-center gap-2">
          Recent Suggestions
        </h5>
        
        {suggestions.length === 0 ?
        <div className="text-center py-5 text-muted">
            <MapPin size={48} className="opacity-25 mb-3" />
            <p>No suggestions yet.<br />Click on the map to pin an issue!</p>
          </div> :

        suggestions.map((s, idx) =>
        <div
          key={idx}
          className="suggestion-card"
          onClick={() => onSelectSuggestion(s)}>
          
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h6 className="m-0">{s.title}</h6>
                <span className={`pill ${s.type === 'Urgent' ? 'pill-urgent' : 'pill-suggestion'}`}>
                  {s.type}
                </span>
              </div>
              <p className="small text-muted mb-2 text-truncate-2">
                {s.description}
              </p>
              <div className="d-flex align-items-center gap-1 x-small text-secondary fw-medium" style={{ fontSize: '0.7rem' }}>
                <MapPin size={12} /> {s.wada}
              </div>
            </div>
        )
        }
      </div>
    </div>);

};

export default Sidebar;