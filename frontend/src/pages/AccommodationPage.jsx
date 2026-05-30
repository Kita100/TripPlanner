import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import MapWithMarkers from '../components/MapWithMarkers';
import Modal from '../components/Modal';
import { Hotel, Search, Plus, X, Star, Wifi, Coffee, RefreshCcw, ExternalLink, Check, Pencil, Filter, Package } from 'lucide-react';
import './AccommodationPage.css';

function StarRating({ rating }) {
  if (!rating) return null;
  return <span className="stars">{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span>;
}

function NightsBadge({ checkIn, checkOut }) {
  if (!checkIn || !checkOut) return null;
  try {
    const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
    if (nights <= 0) return null;
    return <span className="badge badge-blue">{nights} night{nights !== 1 ? 's' : ''}</span>;
  } catch { return null; }
}

export default function AccommodationPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [activeDest, setActiveDest] = useState(null);
  const [accommodations, setAccommodations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showPackage, setShowPackage] = useState(false);
  const [editAcc, setEditAcc] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);

  const [searchForm, setSearchForm] = useState({ check_in: '', check_out: '', lat: null, lng: null, radius: 3000 });
  const [filters, setFilters] = useState({ max_price: '', free_cancellation: false, breakfast: false, wifi: false, min_stars: 0 });

  const [manualForm, setManualForm] = useState({
    name: '', location: '', lat: null, lng: null, check_in: '', check_out: '',
    price_per_night: '', total_price: '', currency: 'AUD', rating: '', stars: '',
    free_cancellation: false, breakfast_included: false, free_wifi: false,
    booking_url: '', notes: '', paid: false,
    is_package: false, package_provider: '', includes: [],
  });

  const [pkgIncludeInput, setPkgIncludeInput] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { loadTrip(); }, [tripId]);
  useEffect(() => { if (activeDest) { loadAccommodation(activeDest.id); setSearchForm(f => ({ ...f, lat: activeDest.lat, lng: activeDest.lng })); } }, [activeDest]);

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

  const loadAccommodation = async (destId) => {
    const res = await authFetch(`/trips/${tripId}/destinations/${destId}/accommodation`);
    if (res?.ok) setAccommodations(await res.json());
    else setAccommodations([]);
  };

  const handleSearch = async () => {
    if (!searchForm.lat || !searchForm.lng) {
      alert('This destination has no coordinates. Please set them in trip settings.');
      return;
    }
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await authFetch('/accommodation/search', {
        method: 'POST',
        body: JSON.stringify({
          lat: searchForm.lat,
          lng: searchForm.lng,
          radius: searchForm.radius,
          check_in: searchForm.check_in || null,
          check_out: searchForm.check_out || null,
        }),
      });
      if (res?.ok) setSearchResults(await res.json());
    } finally { setSearching(false); }
  };

  const addFromResult = async (acc) => {
    const nights = searchForm.check_in && searchForm.check_out
      ? Math.round((new Date(searchForm.check_out) - new Date(searchForm.check_in)) / 86400000)
      : 1;
    const res = await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/accommodation`, {
      method: 'POST',
      body: JSON.stringify({
        name: acc.name, location: acc.location, lat: acc.lat, lng: acc.lng,
        check_in: searchForm.check_in || null, check_out: searchForm.check_out || null,
        price_per_night: acc.price_per_night, total_price: acc.total_price,
        currency: acc.currency, rating: acc.rating, stars: acc.stars,
        free_cancellation: acc.free_cancellation, breakfast_included: acc.breakfast_included,
        free_wifi: acc.free_wifi, booking_url: acc.booking_url, paid: false,
      }),
    });
    if (res?.ok) { loadAccommodation(activeDest.id); alert('Accommodation saved!'); }
  };

  const saveManual = async () => {
    const body = {
      ...manualForm,
      price_per_night: parseFloat(manualForm.price_per_night) || null,
      total_price: parseFloat(manualForm.total_price) || null,
      rating: parseFloat(manualForm.rating) || null,
      stars: parseInt(manualForm.stars) || null,
    };
    let res;
    if (editAcc) {
      res = await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/accommodation/${editAcc.id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      res = await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/accommodation`, { method: 'POST', body: JSON.stringify(body) });
    }
    if (res?.ok) {
      if (!editAcc) await syncAccToItinerary(manualForm, activeDest.id);
      setShowManual(false);
      setEditAcc(null);
      loadAccommodation(activeDest.id);
    }
  };

  // Auto-add check-in / check-out as itinerary items
  // Auto-add check-in / check-out as itinerary items with smart times from flights
  const syncAccToItinerary = async (acc, destId) => {
    const flightsRes = await authFetch(`/trips/${tripId}/flights`);
    const allFlights = flightsRes?.ok ? await flightsRes.json() : [];
    const getTime = (dt) => (dt && dt.includes('T')) ? (dt.split('T')[1]?.slice(0, 5) || '') : '';

    const getCheckInTime = (dateStr) => {
      const arriving = allFlights.filter(f => f.arrival_time?.split('T')[0] === dateStr);
      if (!arriving.length) return '15:00';
      const latest = arriving.map(f => getTime(f.arrival_time)).filter(Boolean).sort().reverse()[0];
      return (latest && latest >= '15:00') ? latest : '15:00';
    };

    const getCheckOutTime = (dateStr) => {
      const departing = allFlights.filter(f => f.departure_time?.split('T')[0] === dateStr);
      if (!departing.length) return '10:00';
      const earliest = departing.map(f => getTime(f.departure_time)).filter(Boolean).sort()[0];
      if (!earliest) return '10:00';
      const [h, m] = earliest.split(':').map(Number);
      const checkOutMins = h * 60 + m - 120; // 2 hours before departure
      if (checkOutMins < 600) { // before standard 10:00
        const ch = Math.max(0, Math.floor(checkOutMins / 60));
        const cm = Math.max(0, checkOutMins % 60);
        return `${String(ch).padStart(2, '0')}:${String(cm).padStart(2, '0')}`;
      }
      return '10:00';
    };

    const base = { category: 'accommodation', whole_day: false, free: true, location: acc.location || '' };
    if (acc.check_in) {
      await authFetch(`/trips/${tripId}/destinations/${destId}/itinerary/${acc.check_in}/items`, {
        method: 'POST',
        body: JSON.stringify({ ...base, name: `🏨 Check in: ${acc.name}`, time: getCheckInTime(acc.check_in) }),
      });
    }
    if (acc.check_out) {
      await authFetch(`/trips/${tripId}/destinations/${destId}/itinerary/${acc.check_out}/items`, {
        method: 'POST',
        body: JSON.stringify({ ...base, name: `🏨 Check out: ${acc.name}`, time: getCheckOutTime(acc.check_out) }),
      });
    }
  };

  const syncAllToItinerary = async () => {
    if (!confirm(`This will add check-in/check-out itinerary items for all ${accommodations.length} saved accommodation(s). Note: existing sync'd items won't be removed.\n\nContinue?`)) return;
    setSyncing(true);
    for (const acc of accommodations) {
      await syncAccToItinerary(acc, acc.destination_id || activeDest.id);
    }
    setSyncing(false);
  };

  const deleteAcc = async (id) => {
    if (!confirm('Remove this accommodation?')) return;
    await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/accommodation/${id}`, { method: 'DELETE' });
    loadAccommodation(activeDest.id);
  };

  const togglePaid = async (acc) => {
    await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/accommodation/${acc.id}`, {
      method: 'PUT', body: JSON.stringify({ paid: !acc.paid }),
    });
    loadAccommodation(activeDest.id);
  };

  const openEdit = (acc) => {
    setEditAcc(acc);
    setManualForm({
      name: acc.name || '', location: acc.location || '', lat: acc.lat || null, lng: acc.lng || null,
      check_in: acc.check_in || '', check_out: acc.check_out || '',
      price_per_night: acc.price_per_night || '', total_price: acc.total_price || '',
      currency: acc.currency || 'AUD', rating: acc.rating || '', stars: acc.stars || '',
      free_cancellation: acc.free_cancellation || false, breakfast_included: acc.breakfast_included || false,
      free_wifi: acc.free_wifi || false, booking_url: acc.booking_url || '', notes: acc.notes || '', paid: acc.paid || false,
      is_package: acc.is_package || false, package_provider: acc.package_provider || '', includes: acc.includes || [],
    });
    if (acc.is_package) setShowPackage(true);
    else setShowManual(true);
  };

  // Apply filters to search results
  let filtered = [...searchResults];
  if (filters.free_cancellation) filtered = filtered.filter(a => a.free_cancellation);
  if (filters.breakfast) filtered = filtered.filter(a => a.breakfast_included);
  if (filters.wifi) filtered = filtered.filter(a => a.free_wifi);
  if (filters.max_price) filtered = filtered.filter(a => a.price_per_night <= parseFloat(filters.max_price));
  if (filters.min_stars > 0) filtered = filtered.filter(a => (a.stars || 0) >= filters.min_stars);

  // Map markers
  const savedMarkers = accommodations.filter(a => a.lat && a.lng).map(a => ({
    id: a.id, lat: a.lat, lng: a.lng, title: a.name, subtitle: a.location,
    color: '#f59e0b', data: a,
  }));
  const searchMarkers = searchResults.filter(a => a.lat && a.lng).map(a => ({
    id: a.osm_id, lat: a.lat, lng: a.lng, title: a.name, subtitle: a.location,
    color: '#0ea5e9', data: a,
  }));
  const allMarkers = [...savedMarkers, ...searchMarkers];

  const mapCenter = activeDest?.lat && activeDest?.lng ? [activeDest.lat, activeDest.lng] : [20, 0];

  if (loading) return <div className="page-layout"><div className="loading-overlay" style={{ flex: 1 }}><div className="loading-spinner" /></div></div>;

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title"><Hotel size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Accommodation</h1>
              <p className="page-subtitle">Search for hotels near your destinations and save them</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => { setShowManual(true); setEditAcc(null); setManualForm({ name: '', location: '', lat: null, lng: null, check_in: '', check_out: '', price_per_night: '', total_price: '', currency: 'AUD', rating: '', stars: '', free_cancellation: false, breakfast_included: false, free_wifi: false, booking_url: '', notes: '', paid: false, is_package: false, package_provider: '', includes: [] }); }}><Plus size={15} /> Add Hotel</button>
              <button className="btn btn-warm" onClick={() => { setShowPackage(true); setEditAcc(null); setManualForm({ name: '', location: '', lat: null, lng: null, check_in: '', check_out: '', price_per_night: '', total_price: '', currency: 'AUD', rating: '', stars: '', free_cancellation: false, breakfast_included: false, free_wifi: false, booking_url: '', notes: '', paid: false, is_package: true, package_provider: '', includes: [] }); setPkgIncludeInput(''); }}><Package size={15} /> Add Package</button>
              <button className="btn btn-primary" onClick={() => setShowSearch(!showSearch)}><Search size={15} /> Search Hotels</button>
            </div>
          </div>

          {destinations.length === 0 ? <div className="alert alert-info">Add destinations first.</div> : (
            <>
              <div className="tabs" style={{ marginBottom: 20 }}>
                {destinations.map(d => (
                  <button key={d.id} className={`tab-btn ${activeDest?.id === d.id ? 'active' : ''}`} onClick={() => setActiveDest(d)}>
                    <Hotel size={14} /> {d.name}
                  </button>
                ))}
              </div>

              {showSearch && (
                <div className="card acc-search-card">
                  <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><Search size={16} /> Search Hotels Near {activeDest?.name}</h3>
                  <div className="input-row input-row-2" style={{ marginBottom: 12 }}>
                    <div className="form-group"><label>Check In</label><input type="date" value={searchForm.check_in} onChange={e => setSearchForm({ ...searchForm, check_in: e.target.value })} /></div>
                    <div className="form-group"><label>Check Out</label><input type="date" value={searchForm.check_out} onChange={e => setSearchForm({ ...searchForm, check_out: e.target.value })} /></div>
                  </div>

                  {/* Filters */}
                  <div className="acc-filters">
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}><Filter size={13} /> Filters:</span>
                    <label className="filter-toggle"><input type="checkbox" checked={filters.free_cancellation} onChange={e => setFilters({ ...filters, free_cancellation: e.target.checked })} /><RefreshCcw size={13} /> Free cancellation</label>
                    <label className="filter-toggle"><input type="checkbox" checked={filters.breakfast} onChange={e => setFilters({ ...filters, breakfast: e.target.checked })} /><Coffee size={13} /> Breakfast</label>
                    <label className="filter-toggle"><input type="checkbox" checked={filters.wifi} onChange={e => setFilters({ ...filters, wifi: e.target.checked })} /><Wifi size={13} /> Free WiFi</label>
                    <label className="filter-toggle" style={{ gap: 6 }}>
                      Stars ≥ <select value={filters.min_stars} onChange={e => setFilters({ ...filters, min_stars: parseInt(e.target.value) })} style={{ width: 60 }}>
                        {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}★`}</option>)}
                      </select>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Max/night: A$</span>
                      <input type="number" placeholder="Any" value={filters.max_price} onChange={e => setFilters({ ...filters, max_price: e.target.value })} style={{ width: 80 }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
                      {searching ? 'Searching...' : <><Search size={15} /> Search</>}
                    </button>
                    {activeDest?.name && (
                      <a href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(activeDest.name)}&checkin=${searchForm.check_in}&checkout=${searchForm.check_out}`}
                        target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                        <ExternalLink size={15} /> booking.com
                      </a>
                    )}
                  </div>

                  {filtered.length > 0 && (
                    <div className="acc-results" style={{ marginTop: 20 }}>
                      <div style={{ fontWeight: 600, marginBottom: 10 }}>{filtered.length} hotels found</div>
                      {filtered.map(acc => (
                        <SearchResultCard key={acc.osm_id} acc={acc} checkIn={searchForm.check_in} checkOut={searchForm.check_out} onAdd={() => addFromResult(acc)} />
                      ))}
                    </div>
                  )}
                  {searchResults.length > 0 && filtered.length === 0 && (
                    <div className="alert alert-warning" style={{ marginTop: 12 }}>No hotels match current filters. Try adjusting them.</div>
                  )}
                </div>
              )}

              {/* Map + saved */}
              <div className="split-layout">
                <div className="split-list">
                  {/* Section header with sync button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Saved ({accommodations.length})</span>
                    {accommodations.length > 0 && (
                      <button className="btn btn-outline btn-sm" onClick={syncAllToItinerary} disabled={syncing} title="Push check-in/out times to itinerary">
                        <RefreshCcw size={13} /> {syncing ? 'Syncing…' : 'Sync → Itinerary'}
                      </button>
                    )}
                  </div>

                  {/* Travel Packages */}
                  {accommodations.filter(a => a.is_package).length > 0 && (
                    <>
                      <h3 style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Package size={16} style={{ color: '#f59e0b' }} /> Travel Packages</h3>
                      {accommodations.filter(a => a.is_package).map(acc => (
                        <PackageCard key={acc.id} acc={acc} isSelected={selectedMarker?.id === acc.id}
                          onClick={() => setSelectedMarker(savedMarkers.find(m => m.id === acc.id))}
                          onEdit={() => openEdit(acc)} onDelete={() => deleteAcc(acc.id)} onTogglePaid={() => togglePaid(acc)} />
                      ))}
                      <div className="divider" />
                    </>
                  )}

                  {/* Hotels */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h3>Hotels &amp; Stays ({accommodations.filter(a => !a.is_package).length})</h3>
                  </div>
                  {accommodations.filter(a => !a.is_package).length === 0 ? (
                    <div className="empty-state" style={{ padding: 32 }}>
                      <Hotel size={30} style={{ opacity: 0.3 }} />
                      <div className="empty-title">No accommodation saved</div>
                      <div className="empty-desc">Search for hotels or add one manually</div>
                    </div>
                  ) : (
                    accommodations.filter(a => !a.is_package).map(acc => (
                      <SavedAccCard key={acc.id} acc={acc} isSelected={selectedMarker?.id === acc.id}
                        onClick={() => setSelectedMarker(savedMarkers.find(m => m.id === acc.id))}
                        onEdit={() => openEdit(acc)} onDelete={() => deleteAcc(acc.id)} onTogglePaid={() => togglePaid(acc)} />
                    ))
                  )}
                </div>

                <MapWithMarkers
                  center={mapCenter}
                  zoom={activeDest?.lat ? 13 : 10}
                  markers={allMarkers}
                  selectedId={selectedMarker?.id}
                  onMarkerClick={setSelectedMarker}
                  renderDetail={(marker) => <AccDetail acc={marker.data} />}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {showManual && (
        <Modal title={editAcc ? 'Edit Accommodation' : 'Add Accommodation'} onClose={() => { setShowManual(false); setEditAcc(null); }} wide
          footer={<><button className="btn btn-outline" onClick={() => { setShowManual(false); setEditAcc(null); }}>Cancel</button><button className="btn btn-primary" onClick={saveManual} disabled={!manualForm.name}><Check size={15} /> Save</button></>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group"><label>Hotel/Property Name *</label><input placeholder="Hotel Name" value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} autoFocus /></div>
            <div className="form-group"><label>Address</label><input placeholder="Address" value={manualForm.location} onChange={e => setManualForm({ ...manualForm, location: e.target.value })} /></div>
            <div className="input-row input-row-2">
              <div className="form-group"><label>Check In</label><input type="date" value={manualForm.check_in} onChange={e => setManualForm({ ...manualForm, check_in: e.target.value })} /></div>
              <div className="form-group"><label>Check Out</label><input type="date" value={manualForm.check_out} onChange={e => setManualForm({ ...manualForm, check_out: e.target.value })} /></div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group"><label>Price/Night (AUD)</label><input type="number" placeholder="150" value={manualForm.price_per_night} onChange={e => setManualForm({ ...manualForm, price_per_night: e.target.value })} /></div>
              <div className="form-group"><label>Total Price (AUD)</label><input type="number" placeholder="900" value={manualForm.total_price} onChange={e => setManualForm({ ...manualForm, total_price: e.target.value })} /></div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group"><label>Rating</label><input type="number" step="0.1" min="0" max="5" placeholder="4.5" value={manualForm.rating} onChange={e => setManualForm({ ...manualForm, rating: e.target.value })} /></div>
              <div className="form-group"><label>Stars</label><select value={manualForm.stars} onChange={e => setManualForm({ ...manualForm, stars: e.target.value })}><option value="">—</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}★</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[['free_cancellation', 'Free Cancellation'], ['breakfast_included', 'Breakfast Included'], ['free_wifi', 'Free WiFi']].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={manualForm[key]} onChange={e => setManualForm({ ...manualForm, [key]: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                  {label}
                </label>
              ))}
            </div>
            <div className="form-group"><label>Booking URL</label><input placeholder="https://..." value={manualForm.booking_url} onChange={e => setManualForm({ ...manualForm, booking_url: e.target.value })} /></div>
            <div className="form-group"><label>Notes</label><textarea placeholder="Notes..." value={manualForm.notes} onChange={e => setManualForm({ ...manualForm, notes: e.target.value })} rows={2} /></div>
          </div>
        </Modal>
      )}
      {showPackage && (
        <Modal title={editAcc ? 'Edit Package' : '🎁 Add Travel Package'} onClose={() => { setShowPackage(false); setEditAcc(null); }} wide
          footer={<><button className="btn btn-outline" onClick={() => { setShowPackage(false); setEditAcc(null); }}>Cancel</button><button className="btn btn-warm" onClick={() => { saveManual(); setShowPackage(false); }} disabled={!manualForm.name}><Check size={15} /> Save Package</button></>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="alert alert-info" style={{ fontSize: '0.82rem' }}>
              A travel package bundles accommodation + activities into one price. Track it here and mark what's included.
            </div>
            <div className="form-group"><label>Package Name *</label><input placeholder="e.g. Paris 5-Day Highlights Package" value={manualForm.name} onChange={e => setManualForm({ ...manualForm, name: e.target.value })} autoFocus /></div>
            <div className="input-row input-row-2">
              <div className="form-group"><label>Provider / Operator</label><input placeholder="e.g. Contiki, Intrepid" value={manualForm.package_provider} onChange={e => setManualForm({ ...manualForm, package_provider: e.target.value })} /></div>
              <div className="form-group"><label>Total Package Price (AUD)</label><input type="number" placeholder="2500" value={manualForm.total_price} onChange={e => setManualForm({ ...manualForm, total_price: e.target.value })} /></div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group"><label>Start Date</label><input type="date" value={manualForm.check_in} onChange={e => setManualForm({ ...manualForm, check_in: e.target.value })} /></div>
              <div className="form-group"><label>End Date</label><input type="date" value={manualForm.check_out} onChange={e => setManualForm({ ...manualForm, check_out: e.target.value })} /></div>
            </div>

            <div className="form-group">
              <label>What's Included</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="e.g. 4 nights Hotel Lumière" value={pkgIncludeInput} onChange={e => setPkgIncludeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && pkgIncludeInput.trim()) { setManualForm(f => ({ ...f, includes: [...(f.includes || []), pkgIncludeInput.trim()] })); setPkgIncludeInput(''); e.preventDefault(); } }} />
                <button type="button" className="btn btn-outline" style={{ flexShrink: 0 }} onClick={() => { if (pkgIncludeInput.trim()) { setManualForm(f => ({ ...f, includes: [...(f.includes || []), pkgIncludeInput.trim()] })); setPkgIncludeInput(''); } }}>Add</button>
              </div>
              {(manualForm.includes || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {(manualForm.includes || []).map((item, i) => (
                    <div key={i} className="pkg-include-row">
                      <span>✓ {item}</span>
                      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setManualForm(f => ({ ...f, includes: f.includes.filter((_, j) => j !== i) }))}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="input-row input-row-2">
              <div className="form-group"><label>Booking URL</label><input placeholder="https://..." value={manualForm.booking_url} onChange={e => setManualForm({ ...manualForm, booking_url: e.target.value })} /></div>
              <div className="form-group"><label>Location</label><input placeholder="e.g. Paris, France" value={manualForm.location} onChange={e => setManualForm({ ...manualForm, location: e.target.value })} /></div>
            </div>
            <div className="form-group"><label>Notes</label><textarea rows={2} placeholder="Notes..." value={manualForm.notes} onChange={e => setManualForm({ ...manualForm, notes: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SearchResultCard({ acc, checkIn, checkOut, onAdd }) {
  return (
    <div className="acc-result-card">
      <div className="acc-result-header">
        <div>
          <div className="acc-name">{acc.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {acc.stars && <span className="stars">{'★'.repeat(acc.stars)}</span>}
            {acc.rating && <span className="badge badge-yellow">⭐ {acc.rating}</span>}
            {acc.free_cancellation && <span className="badge badge-green"><RefreshCcw size={10} /> Free cancel</span>}
            {acc.breakfast_included && <span className="badge badge-blue"><Coffee size={10} /> Breakfast</span>}
            {acc.free_wifi && <span className="badge badge-gray"><Wifi size={10} /> WiFi</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="price-display">A${acc.price_per_night?.toFixed(0)}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/night</span></div>
          {acc.total_price && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>A${acc.total_price?.toFixed(0)} total</div>}
        </div>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>{acc.location}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={onAdd}><Plus size={13} /> Save</button>
        <a href={acc.booking_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><ExternalLink size={13} /> booking.com</a>
      </div>
    </div>
  );
}

function SavedAccCard({ acc, isSelected, onClick, onEdit, onDelete, onTogglePaid }) {
  return (
    <div className={`saved-acc-card card ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div className="acc-card-header">
        <div>
          <div className="acc-name">{acc.name}</div>
          {acc.location && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{acc.location.split(',').slice(0,2).join(',')}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <span className={`paid-badge ${acc.paid ? 'paid' : 'unpaid'}`} style={{ cursor: 'pointer' }} onClick={onTogglePaid}>
            {acc.paid ? <><Check size={10} /> Paid</> : `A$${acc.total_price || acc.price_per_night || '—'}`}
          </span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit}><Pencil size={13} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete}><X size={13} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {acc.check_in && acc.check_out && <NightsBadge checkIn={acc.check_in} checkOut={acc.check_out} />}
        {acc.check_in && <span className="badge badge-gray">{acc.check_in}</span>}
        {acc.check_out && <span className="badge badge-gray">{acc.check_out}</span>}
        {acc.free_cancellation && <span className="badge badge-green">Free cancel</span>}
        {acc.breakfast_included && <span className="badge badge-blue">Breakfast</span>}
        {acc.free_wifi && <span className="badge badge-gray">WiFi</span>}
      </div>
    </div>
  );
}

function AccDetail({ acc }) {
  return (
    <div>
      {acc.location && <div className="info-row"><span className="info-label">Address</span><span className="info-value">{acc.location}</span></div>}
      {acc.stars && <div className="info-row"><span className="info-label">Stars</span><span className="info-value stars">{'★'.repeat(acc.stars)}</span></div>}
      {acc.rating && <div className="info-row"><span className="info-label">Rating</span><span className="info-value">⭐ {acc.rating}/5</span></div>}
      {acc.price_per_night && <div className="info-row"><span className="info-label">Per Night</span><span className="info-value price-small">A${acc.price_per_night?.toFixed(2)}</span></div>}
      {acc.total_price && <div className="info-row"><span className="info-label">Total</span><span className="info-value price-small">A${acc.total_price?.toFixed(2)}</span></div>}
      {acc.check_in && <div className="info-row"><span className="info-label">Check In</span><span className="info-value">{acc.check_in}</span></div>}
      {acc.check_out && <div className="info-row"><span className="info-label">Check Out</span><span className="info-value">{acc.check_out}</span></div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {acc.free_cancellation && <span className="badge badge-green"><RefreshCcw size={10} /> Free cancel</span>}
        {acc.breakfast_included && <span className="badge badge-blue"><Coffee size={10} /> Breakfast</span>}
        {acc.free_wifi && <span className="badge badge-gray"><Wifi size={10} /> WiFi</span>}
      </div>
      {acc.booking_url && (
        <a href={acc.booking_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>
          <ExternalLink size={13} /> Book on Booking.com
        </a>
      )}
      {acc.notes && <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-muted)', borderRadius: 8, fontSize: '0.8rem' }}>{acc.notes}</div>}
    </div>
  );
}

function PackageCard({ acc, isSelected, onClick, onEdit, onDelete, onTogglePaid }) {
  return (
    <div className={`package-card card ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div className="pkg-card-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div className="pkg-icon"><Package size={18} /></div>
          <div>
            <div className="acc-name">{acc.name}</div>
            {acc.package_provider && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{acc.package_provider}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <span className={`paid-badge ${acc.paid ? 'paid' : 'unpaid'}`} style={{ cursor: 'pointer' }} onClick={onTogglePaid}>
            {acc.paid ? <><Check size={10} /> Paid</> : `A$${acc.total_price || '—'}`}
          </span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit}><Pencil size={13} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete}><X size={13} /></button>
        </div>
      </div>
      {acc.check_in && acc.check_out && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
          {acc.check_in} → {acc.check_out}
        </div>
      )}
      {acc.includes && acc.includes.length > 0 && (
        <div className="pkg-includes">
          {acc.includes.map((item, i) => (
            <div key={i} className="pkg-include-item">✓ {item}</div>
          ))}
        </div>
      )}
      {acc.booking_url && (
        <a href={acc.booking_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={e => e.stopPropagation()}>
          <ExternalLink size={13} /> View Package
        </a>
      )}
    </div>
  );
}
