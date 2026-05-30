import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch, fetchNearbyRestaurants } from '../api';
import TripSidebar from '../components/TripSidebar';
import MapWithMarkers from '../components/MapWithMarkers';
import Modal from '../components/Modal';
import { Utensils, Search, Plus, X, Heart, Globe, Clock, Check, Pencil, Filter, MapPin } from 'lucide-react';
import './FoodPage.css';

const DIETARY_OPTIONS = [
  { key: 'vegan', label: '🌱 Vegan', color: '#16a34a' },
  { key: 'vegetarian', label: '🥦 Vegetarian', color: '#22c55e' },
  { key: 'gluten_free', label: '🌾 Gluten-Free', color: '#ca8a04' },
  { key: 'halal', label: '☪️ Halal', color: '#0891b2' },
  { key: 'kosher', label: '✡️ Kosher', color: '#7c3aed' },
  { key: 'lactose_free', label: '🥛 Lactose-Free', color: '#ea580c' },
  { key: 'nut_free', label: '🥜 Nut-Free', color: '#b45309' },
  { key: 'dairy_free', label: '🧀 Dairy-Free', color: '#0284c7' },
];

function dietaryMatchColor(place, userDietary) {
  if (!userDietary || userDietary.length === 0) return '#94a3b8';
  if (!place.dietary_options || Object.keys(place.dietary_options).length === 0) return '#94a3b8';
  const opts = place.dietary_options || {};
  const req = userDietary.map(d => d.toLowerCase().replace('-', '_').replace(' ', '_'));
  const all = req.every(r => opts[r] === true);
  if (all) return '#16a34a';
  const some = req.some(r => opts[r] === true);
  return some ? '#ca8a04' : '#ef4444';
}

function dietaryMatchLabel(place, userDietary) {
  if (!userDietary || userDietary.length === 0) return null;
  const color = dietaryMatchColor(place, userDietary);
  if (color === '#16a34a') return { label: 'All requirements met', color };
  if (color === '#ca8a04') return { label: 'Some requirements met', color };
  if (color === '#ef4444') return { label: 'Doesn\'t match', color };
  return { label: 'Unknown', color: '#94a3b8' };
}

export default function FoodPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [activeDest, setActiveDest] = useState(null);
  const [foodPlaces, setFoodPlaces] = useState([]);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [userDietary, setUserDietary] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [editPlace, setEditPlace] = useState(null);
  const [showDietary, setShowDietary] = useState(false);
  const [searchRadius, setSearchRadius] = useState(1500);
  const [filterDietary, setFilterDietary] = useState(false);

  const [manualForm, setManualForm] = useState({
    name: '', location: '', lat: null, lng: null, cuisine: '', opening_hours: '',
    website: '', notes: '', is_favorite: false, dietary_options: {},
  });

  useEffect(() => { loadTrip(); }, [tripId]);
  useEffect(() => { if (activeDest) loadFoodPlaces(activeDest.id); }, [activeDest]);

  const loadTrip = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/trips/${tripId}`);
      if (res?.ok) {
        const data = await res.json();
        setTrip(data);
        setUserDietary(data.dietary_requirements || []);
        const dests = data.destinations || [];
        setDestinations(dests);
        if (dests.length > 0) setActiveDest(dests[0]);
      }
    } finally { setLoading(false); }
  };

  const loadFoodPlaces = async (destId) => {
    const res = await authFetch(`/trips/${tripId}/destinations/${destId}/food`);
    if (res?.ok) setFoodPlaces(await res.json());
    else setFoodPlaces([]);
  };

  const saveDietary = async (updated) => {
    await authFetch(`/trips/${tripId}/dietary`, { method: 'PUT', body: JSON.stringify({ dietary_requirements: updated }) });
    setUserDietary(updated);
  };

  const toggleDietary = (key) => {
    const updated = userDietary.includes(key) ? userDietary.filter(d => d !== key) : [...userDietary, key];
    saveDietary(updated);
  };

  const handleSearch = async () => {
    if (!activeDest?.lat || !activeDest?.lng) {
      alert('This destination has no coordinates. Add it from the Trip Overview first.');
      return;
    }
    setSearching(true);
    setNearbyPlaces([]);
    try {
      const places = await fetchNearbyRestaurants(activeDest.lat, activeDest.lng, searchRadius, userDietary);
      setNearbyPlaces(places || []);
    } catch (e) {
      console.error(e);
    } finally { setSearching(false); }
  };

  const saveFromResult = async (place) => {
    const res = await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/food`, {
      method: 'POST',
      body: JSON.stringify({
        name: place.name, location: place.display_name || place.location, lat: place.lat, lng: place.lng,
        cuisine: place.cuisine, opening_hours: place.opening_hours, website: place.website,
        dietary_options: place.dietary_options || {}, is_favorite: false, notes: '',
      }),
    });
    if (res?.ok) { loadFoodPlaces(activeDest.id); alert('Saved!'); }
  };

  const saveManual = async () => {
    let res;
    if (editPlace) {
      res = await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/food/${editPlace.id}`, { method: 'PUT', body: JSON.stringify(manualForm) });
    } else {
      res = await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/food`, { method: 'POST', body: JSON.stringify(manualForm) });
    }
    if (res?.ok) { setShowManual(false); setEditPlace(null); loadFoodPlaces(activeDest.id); }
  };

  const deletePlace = async (id) => {
    if (!confirm('Remove this place?')) return;
    await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/food/${id}`, { method: 'DELETE' });
    loadFoodPlaces(activeDest.id);
  };

  const toggleFavorite = async (place) => {
    await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/food/${place.id}`, {
      method: 'PUT', body: JSON.stringify({ is_favorite: !place.is_favorite }),
    });
    loadFoodPlaces(activeDest.id);
  };

  const openEdit = (place) => {
    setEditPlace(place);
    setManualForm({
      name: place.name || '', location: place.location || '', lat: place.lat || null, lng: place.lng || null,
      cuisine: place.cuisine || '', opening_hours: place.opening_hours || '', website: place.website || '',
      notes: place.notes || '', is_favorite: place.is_favorite || false, dietary_options: place.dietary_options || {},
    });
    setShowManual(true);
  };

  // Map markers
  const savedMarkers = foodPlaces.filter(p => p.lat && p.lng).map(p => ({
    id: p.id, lat: p.lat, lng: p.lng, title: p.name, subtitle: p.cuisine || p.location,
    color: p.is_favorite ? '#f59e0b' : dietaryMatchColor(p, userDietary), data: p,
  }));

  const nearbyMarkers = nearbyPlaces.filter(p => p.lat && p.lng).map(p => ({
    id: `osm-${p.osm_id}`, lat: p.lat, lng: p.lng, title: p.name, subtitle: p.cuisine,
    color: dietaryMatchColor(p, userDietary), data: { ...p, _isSearch: true },
  }));

  let displayedNearby = filterDietary && userDietary.length > 0
    ? nearbyPlaces.filter(p => dietaryMatchColor(p, userDietary) !== '#ef4444')
    : nearbyPlaces;

  const allMarkers = [...savedMarkers, ...nearbyMarkers];
  const mapCenter = activeDest?.lat && activeDest?.lng ? [activeDest.lat, activeDest.lng] : [20, 0];

  if (loading) return <div className="page-layout"><div className="loading-overlay" style={{ flex: 1 }}><div className="loading-spinner" /></div></div>;

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title"><Utensils size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Food &amp; Dining</h1>
              <p className="page-subtitle">Discover restaurants matching your dietary needs and save your favorites</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowDietary(!showDietary)}>
                🥦 Dietary Requirements {userDietary.length > 0 && <span className="badge badge-green" style={{ marginLeft: 4 }}>{userDietary.length}</span>}
              </button>
              <button className="btn btn-outline" onClick={() => { setShowManual(true); setEditPlace(null); setManualForm({ name: '', location: '', lat: null, lng: null, cuisine: '', opening_hours: '', website: '', notes: '', is_favorite: false, dietary_options: {} }); }}>
                <Plus size={15} /> Add Manually
              </button>
            </div>
          </div>

          {/* Dietary panel */}
          {showDietary && (
            <div className="card dietary-panel">
              <h4>Your Dietary Requirements</h4>
              <p style={{ fontSize: '0.85rem', marginBottom: 14 }}>Select all that apply. Restaurants will be color-coded based on how well they match.</p>
              <div className="dietary-chips">
                {DIETARY_OPTIONS.map(opt => (
                  <button key={opt.key} className={`dietary-chip ${userDietary.includes(opt.key) ? 'active' : ''}`}
                    style={userDietary.includes(opt.key) ? { borderColor: opt.color, background: opt.color + '15', color: opt.color } : {}}
                    onClick={() => toggleDietary(opt.key)}>
                    {opt.label}
                    {userDietary.includes(opt.key) && <Check size={12} />}
                  </button>
                ))}
              </div>
              {userDietary.length > 0 && (
                <div className="dietary-legend">
                  <span className="legend-item"><span className="legend-dot" style={{ background: '#16a34a' }} /> All requirements met</span>
                  <span className="legend-item"><span className="legend-dot" style={{ background: '#ca8a04' }} /> Some requirements met</span>
                  <span className="legend-item"><span className="legend-dot" style={{ background: '#94a3b8' }} /> Unknown data</span>
                  <span className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }} /> Doesn't match</span>
                </div>
              )}
            </div>
          )}

          {destinations.length === 0 ? <div className="alert alert-info">Add destinations from the trip overview.</div> : (
            <>
              <div className="tabs" style={{ marginBottom: 16 }}>
                {destinations.map(d => (
                  <button key={d.id} className={`tab-btn ${activeDest?.id === d.id ? 'active' : ''}`} onClick={() => setActiveDest(d)}>
                    <MapPin size={14} /> {d.name}
                  </button>
                ))}
              </div>

              {/* Search bar */}
              <div className="card food-search-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Search radius:</label>
                    <select value={searchRadius} onChange={e => setSearchRadius(parseInt(e.target.value))} style={{ width: 130 }}>
                      <option value={500}>500m</option>
                      <option value={1000}>1 km</option>
                      <option value={1500}>1.5 km</option>
                      <option value={2000}>2 km</option>
                      <option value={3000}>3 km</option>
                      <option value={5000}>5 km</option>
                    </select>
                  </div>
                  {userDietary.length > 0 && (
                    <label className="filter-toggle" style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={filterDietary} onChange={e => setFilterDietary(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                      Hide mismatches
                    </label>
                  )}
                  <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
                    {searching ? 'Searching...' : <><Search size={15} /> Find Restaurants Near {activeDest?.name?.split(',')[0]}</>}
                  </button>
                </div>
              </div>

              <div className="split-layout">
                {/* Left: lists */}
                <div>
                  {/* Saved places */}
                  <h3 style={{ marginBottom: 10 }}>Saved Places ({foodPlaces.length})</h3>
                  {foodPlaces.length === 0 ? (
                    <div className="empty-state" style={{ marginBottom: 24 }}>
                      <Utensils size={28} style={{ opacity: 0.3 }} />
                      <div className="empty-title">No saved places yet</div>
                      <div className="empty-desc">Search nearby or add a restaurant manually</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                      {foodPlaces.map(p => (
                        <FoodCard key={p.id} place={p} userDietary={userDietary}
                          isSelected={selectedMarker?.id === p.id}
                          onClick={() => setSelectedMarker(savedMarkers.find(m => m.id === p.id))}
                          onFav={() => toggleFavorite(p)} onEdit={() => openEdit(p)} onDelete={() => deletePlace(p.id)} />
                      ))}
                    </div>
                  )}

                  {/* Search results */}
                  {nearbyPlaces.length > 0 && (
                    <>
                      <h3 style={{ marginBottom: 10 }}>Nearby Restaurants ({displayedNearby.length}{filterDietary ? ' filtered' : ''})</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {displayedNearby.map(p => (
                          <NearbyCard key={p.osm_id} place={p} userDietary={userDietary} onSave={() => saveFromResult(p)} />
                        ))}
                        {displayedNearby.length === 0 && <div className="alert alert-warning">No restaurants match your dietary filters.</div>}
                      </div>
                    </>
                  )}
                </div>

                {/* Map */}
                <MapWithMarkers
                  center={mapCenter}
                  zoom={activeDest?.lat ? 14 : 10}
                  markers={allMarkers}
                  selectedId={selectedMarker?.id}
                  onMarkerClick={setSelectedMarker}
                  renderDetail={(marker) => <FoodDetail place={marker.data} userDietary={userDietary} onSave={marker.data._isSearch ? () => saveFromResult(marker.data) : null} />}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {showManual && (
        <Modal title={editPlace ? 'Edit Place' : 'Add Restaurant'} onClose={() => { setShowManual(false); setEditPlace(null); }} wide
          footer={<><button className="btn btn-outline" onClick={() => { setShowManual(false); setEditPlace(null); }}>Cancel</button><button className="btn btn-primary" onClick={saveManual} disabled={!manualForm.name}><Check size={15} /> Save</button></>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group"><label>Name *</label><input placeholder="Restaurant name" value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} autoFocus /></div>
            <div className="input-row input-row-2">
              <div className="form-group"><label>Location / Address</label><input placeholder="Address" value={manualForm.location} onChange={e => setManualForm({ ...manualForm, location: e.target.value })} /></div>
              <div className="form-group"><label>Cuisine</label><input placeholder="Italian, Japanese..." value={manualForm.cuisine} onChange={e => setManualForm({ ...manualForm, cuisine: e.target.value })} /></div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group"><label>Opening Hours</label><input placeholder="Mon–Sat 12–10pm" value={manualForm.opening_hours} onChange={e => setManualForm({ ...manualForm, opening_hours: e.target.value })} /></div>
              <div className="form-group"><label>Website / Menu</label><input placeholder="https://..." value={manualForm.website} onChange={e => setManualForm({ ...manualForm, website: e.target.value })} /></div>
            </div>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 8, display: 'block' }}>Dietary Options</label>
              <div className="dietary-chips">
                {DIETARY_OPTIONS.map(opt => {
                  const active = manualForm.dietary_options?.[opt.key];
                  return (
                    <button key={opt.key} type="button"
                      className={`dietary-chip ${active ? 'active' : ''}`}
                      style={active ? { borderColor: opt.color, background: opt.color + '15', color: opt.color } : {}}
                      onClick={() => setManualForm({ ...manualForm, dietary_options: { ...manualForm.dietary_options, [opt.key]: !active } })}>
                      {opt.label}{active && <Check size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="form-group"><label>Notes</label><textarea rows={2} placeholder="Notes..." value={manualForm.notes} onChange={e => setManualForm({ ...manualForm, notes: e.target.value })} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={manualForm.is_favorite} onChange={e => setManualForm({ ...manualForm, is_favorite: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
              ⭐ Favourite
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FoodCard({ place, userDietary, isSelected, onClick, onFav, onEdit, onDelete }) {
  const matchColor = dietaryMatchColor(place, userDietary);
  return (
    <div className={`food-card card ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
          <div className="food-dot" style={{ background: matchColor, border: place.is_favorite ? '2px solid #f59e0b' : 'none', transform: place.is_favorite ? 'scale(1.2)' : 'none' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {place.is_favorite && '⭐ '}{place.name}
            </div>
            {place.cuisine && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{place.cuisine}</div>}
            {place.location && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}><MapPin size={10} /> {place.location.split(',').slice(0,2).join(',')}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onFav} title={place.is_favorite ? 'Unfavourite' : 'Favourite'}>
            <Heart size={13} style={{ fill: place.is_favorite ? '#f59e0b' : 'none', color: place.is_favorite ? '#f59e0b' : undefined }} />
          </button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit}><Pencil size={13} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete}><X size={13} /></button>
        </div>
      </div>
      {userDietary.length > 0 && (
        <DietaryBadges place={place} userDietary={userDietary} />
      )}
    </div>
  );
}

function NearbyCard({ place, userDietary, onSave }) {
  const match = dietaryMatchLabel(place, userDietary);
  const matchColor = dietaryMatchColor(place, userDietary);
  return (
    <div className="nearby-food-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
          <div className="food-dot" style={{ background: matchColor, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{place.name}</div>
            {place.cuisine && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{place.cuisine}</div>}
            {place.distance && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{place.distance}m away</div>}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onSave}><Heart size={13} /> Save</button>
      </div>
      {match && <div className="dietary-match-row" style={{ color: match.color }}>{match.label}</div>}
      <DietaryBadges place={place} userDietary={userDietary} compact />
    </div>
  );
}

function DietaryBadges({ place, userDietary, compact }) {
  const opts = place.dietary_options || {};
  const matched = userDietary.filter(d => opts[d] === true);
  if (matched.length === 0 && !Object.values(opts).some(Boolean)) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {Object.entries(opts).filter(([, v]) => v === true).map(([k]) => {
        const def = DIETARY_OPTIONS.find(o => o.key === k);
        const isReq = userDietary.includes(k);
        return def ? (
          <span key={k} className="dietary-badge" style={{ borderColor: isReq ? def.color : 'var(--border)', background: isReq ? def.color + '18' : undefined, color: isReq ? def.color : 'var(--text-muted)' }}>
            {compact ? def.label.split(' ')[0] : def.label.split(' ').slice(1).join(' ')}
          </span>
        ) : null;
      })}
    </div>
  );
}

function FoodDetail({ place, userDietary, onSave }) {
  return (
    <div>
      {place.cuisine && <div className="info-row"><span className="info-label">Cuisine</span><span className="info-value">{place.cuisine}</span></div>}
      {place.location && <div className="info-row"><span className="info-label">Address</span><span className="info-value">{place.location}</span></div>}
      {place.opening_hours && <div className="info-row"><span className="info-label"><Clock size={12} /> Hours</span><span className="info-value">{place.opening_hours}</span></div>}
      {place.website && <div className="info-row"><span className="info-label"><Globe size={12} /> Menu</span><span className="info-value"><a href={place.website} target="_blank" rel="noopener noreferrer">View menu / website</a></span></div>}
      {place.distance && <div className="info-row"><span className="info-label">Distance</span><span className="info-value">{place.distance}m away</span></div>}
      <DietaryBadges place={place} userDietary={userDietary} />
      {onSave && <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={onSave}><Heart size={13} /> Save to Trip</button>}
      {place.notes && <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-muted)', borderRadius: 8, fontSize: '0.8rem' }}>{place.notes}</div>}
      {!place._isSearch && (
        <a href={`https://maps.google.com/?q=${encodeURIComponent(place.name + ' ' + (place.location || ''))}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 10, display: 'inline-flex' }}>
          <MapPin size={13} /> Google Maps
        </a>
      )}
    </div>
  );
}
