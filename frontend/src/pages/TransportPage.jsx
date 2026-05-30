import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import MapWithMarkers from '../components/MapWithMarkers';
import { Train, MapPin, ExternalLink, Bus, Navigation } from 'lucide-react';
import './TransportPage.css';

export default function TransportPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [activeDest, setActiveDest] = useState(null);
  const [transportInfo, setTransportInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingInfo, setLoadingInfo] = useState(false);

  useEffect(() => { loadTrip(); }, [tripId]);
  useEffect(() => { if (activeDest?.name) loadTransportInfo(activeDest.name); }, [activeDest]);

  const loadTrip = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/trips/${tripId}`);
      if (res?.ok) {
        const data = await res.json();
        setTrip(data);
        const dests = data.destinations || [];
        setDestinations(dests);
        if (dests.length > 0) setActiveDest(dests[0]);
      }
    } finally { setLoading(false); }
  };

  const loadTransportInfo = async (cityName) => {
    setLoadingInfo(true);
    setTransportInfo(null);
    try {
      const res = await authFetch(`/transit-info?city=${encodeURIComponent(cityName)}`);
      if (res?.ok) setTransportInfo(await res.json());
    } finally { setLoadingInfo(false); }
  };

  const mapCenter = activeDest?.lat && activeDest?.lng ? [activeDest.lat, activeDest.lng] : [20, 0];

  if (loading) return <div className="page-layout"><div className="loading-overlay" style={{ flex: 1 }}><div className="loading-spinner" /></div></div>;

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title"><Train size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Public Transport</h1>
              <p className="page-subtitle">Transit information and maps for each city you're visiting</p>
            </div>
          </div>

          {destinations.length === 0 ? <div className="alert alert-info">Add destinations from the trip overview.</div> : (
            <>
              <div className="tabs" style={{ marginBottom: 24 }}>
                {destinations.map(d => (
                  <button key={d.id} className={`tab-btn ${activeDest?.id === d.id ? 'active' : ''}`} onClick={() => setActiveDest(d)}>
                    <MapPin size={14} /> {d.name}
                  </button>
                ))}
              </div>

              {loadingInfo ? (
                <div className="loading-overlay"><div className="loading-spinner" /></div>
              ) : transportInfo ? (
                <div className="transport-layout">
                  {/* Info panel */}
                  <div className="transport-info">
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title"><Train size={16} /> {transportInfo.city}</h3>
                        {transportInfo.official_site && (
                          <a href={transportInfo.official_site} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                            <ExternalLink size={13} /> Official Site
                          </a>
                        )}
                      </div>
                      <p style={{ marginBottom: 20 }}>{transportInfo.overview}</p>

                      {/* Transport types */}
                      <h4 style={{ marginBottom: 12 }}>Available Transport</h4>
                      <div className="transport-types">
                        {transportInfo.types?.map((type, i) => (
                          <div key={i} className="transport-type-card">
                            <div className="transport-type-icon">{type.icon}</div>
                            <div>
                              <div className="transport-type-name">{type.name}</div>
                              <div className="transport-type-desc">{type.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card">
                      <h4 style={{ marginBottom: 14 }}>What to Buy / Get</h4>
                      <ul className="transport-list">
                        {transportInfo.what_to_buy?.map((item, i) => (
                          <li key={i} className="transport-list-item">
                            <span className="transport-check">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="card">
                      <h4 style={{ marginBottom: 14 }}>Useful Apps</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {transportInfo.apps?.map((app, i) => (
                          <span key={i} className="badge badge-blue" style={{ padding: '6px 12px' }}>{app}</span>
                        ))}
                      </div>
                    </div>

                    <div className="card">
                      <h4 style={{ marginBottom: 14 }}>💡 Tourist Tips</h4>
                      <div className="transport-tips">
                        {transportInfo.tourist_tips?.map((tip, i) => (
                          <div key={i} className="transport-tip">
                            <span className="tip-num">{i + 1}</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Map */}
                  <div>
                    <div className="card" style={{ marginBottom: 12 }}>
                      <h4 style={{ marginBottom: 4 }}>🗺️ City Map</h4>
                      <p style={{ fontSize: '0.8rem', marginBottom: 0 }}>The map shows the city centre. Use the apps listed to plan specific routes.</p>
                    </div>
                    <MapWithMarkers
                      center={mapCenter}
                      zoom={activeDest?.lat ? 13 : 10}
                      markers={[]}
                    />
                    <div className="alert alert-info" style={{ marginTop: 12 }}>
                      <Navigation size={14} />
                      <div>For interactive transit maps, use <strong>{transportInfo.apps?.[0] || 'Citymapper'}</strong> or open <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeDest?.name || '')}&travelmode=transit`} target="_blank" rel="noopener noreferrer">Google Maps Transit</a> for this city.</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-warning">Could not load transport info for {activeDest?.name}. Try again or check the official transit authority website.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
