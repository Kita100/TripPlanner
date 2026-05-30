import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import Modal from '../components/Modal';
import { Plane, Search, Filter, Clock, Luggage, ExternalLink, Check, X, Plus, ChevronDown, ChevronUp, ArrowRight, RefreshCcw } from 'lucide-react';
import './FlightsPage.css';

const CLASSES = ['Economy', 'Premium Economy', 'Business', 'First'];

function formatDateTime(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return dt; }
}

function AirlineLogo({ code }) {
  const colors = { QF: '#ef4444', EK: '#dc2626', SQ: '#1d4ed8', QR: '#7c3aed', AF: '#1e40af', LH: '#1d4ed8', CX: '#065f46', JL: '#dc2626', JQ: '#f97316', TR: '#eab308' };
  const bg = colors[code] || '#6b7280';
  return (
    <div style={{ width: 40, height: 40, background: bg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
      {code}
    </div>
  );
}

export default function FlightsPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [flights, setFlights] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [sortBy, setSortBy] = useState('price');
  const [filterStops, setFilterStops] = useState(-1); // -1 = all
  const [maxPrice, setMaxPrice] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const [searchForm, setSearchForm] = useState({
    from_city: '', to_city: '', date: '', return_date: '', passengers: 1, cabin_class: 'Economy',
  });

  const [manualForm, setManualForm] = useState({
    from_airport: '', to_airport: '', from_city: '', to_city: '', airline: '', flight_number: '',
    departure_time: '', arrival_time: '', duration: '', stops: 0, price: '', currency: 'AUD',
    cabin_class: 'Economy', notes: '', segment: '', paid: false,
  });

  useEffect(() => {
    loadData();
  }, [tripId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tripRes, flightsRes] = await Promise.all([
        authFetch(`/trips/${tripId}`),
        authFetch(`/trips/${tripId}/flights`),
      ]);
      if (tripRes?.ok) setTrip(await tripRes.json());
      if (flightsRes?.ok) setFlights(await flightsRes.json());
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchForm.from_city || !searchForm.to_city || !searchForm.date) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await authFetch('/flights/search', { method: 'POST', body: JSON.stringify(searchForm) });
      if (res?.ok) setSearchResults(await res.json());
    } finally {
      setSearching(false);
    }
  };

  const addFlightFromResult = async (f) => {
    const res = await authFetch(`/trips/${tripId}/flights`, {
      method: 'POST',
      body: JSON.stringify({
        from_airport: f.from_city,
        to_airport: f.to_city,
        from_city: f.from_city,
        to_city: f.to_city,
        airline: f.airline,
        flight_number: f.flight_number,
        departure_time: f.departure_time,
        arrival_time: f.arrival_time,
        duration: f.duration,
        stops: f.stops,
        stop_cities: f.stop_cities,
        price: f.price,
        currency: f.currency,
        cabin_class: f.cabin_class,
        paid: false,
        booking_url: f.booking_url,
        segment: `${searchForm.from_city} → ${searchForm.to_city}`,
      }),
    });
    if (res?.ok) {
      await syncFlightToItinerary(f);
      loadData();
      alert('Flight added to your trip!');
    }
  };

  const addManualFlight = async () => {
    const data = { ...manualForm, price: parseFloat(manualForm.price) || 0, stops: parseInt(manualForm.stops) || 0 };
    const res = await authFetch(`/trips/${tripId}/flights`, { method: 'POST', body: JSON.stringify(data) });
    if (res?.ok) {
      await syncFlightToItinerary(data);
      setShowManual(false);
      setManualForm({ from_airport: '', to_airport: '', from_city: '', to_city: '', airline: '', flight_number: '', departure_time: '', arrival_time: '', duration: '', stops: 0, price: '', currency: 'AUD', cabin_class: 'Economy', notes: '', segment: '', paid: false });
      loadData();
    }
  };

  // Auto-add flight departure/arrival as itinerary transport items
  const syncFlightToItinerary = async (f) => {
    const destinations = trip?.destinations || [];
    if (!destinations.length) return;

    const getDate = (dt) => dt ? dt.split('T')[0] : null;
    const getTime = (dt) => (dt && dt.includes('T')) ? dt.split('T')[1]?.slice(0, 5) || '' : '';
    const findDest = (dateStr) => dateStr ? destinations.find(d =>
      d.start_date && d.end_date && d.start_date <= dateStr && dateStr <= d.end_date
    ) : null;

    const departDate = getDate(f.departure_time);
    const arrivalDate = getDate(f.arrival_time);
    const departDest = findDest(departDate);
    const arrivalDest = findDest(arrivalDate);
    const label = [f.airline, f.flight_number].filter(Boolean).join(' ');

    if (departDest && departDate) {
      await authFetch(`/trips/${tripId}/destinations/${departDest.id}/itinerary/${departDate}/items`, {
        method: 'POST',
        body: JSON.stringify({
          name: `✈️ Depart${label ? ' ' + label : ''} → ${f.to_city || f.to_airport || ''}`,
          category: 'transport', time: getTime(f.departure_time),
          whole_day: false, free: true,
          notes: f.duration ? `Flight duration: ${f.duration}` : '',
        }),
      });
    }
    if (arrivalDest && arrivalDate) {
      await authFetch(`/trips/${tripId}/destinations/${arrivalDest.id}/itinerary/${arrivalDate}/items`, {
        method: 'POST',
        body: JSON.stringify({
          name: `✈️ Arrive${label ? ' ' + label : ''} — ${f.to_city || f.to_airport || ''}`,
          category: 'transport', time: getTime(f.arrival_time),
          whole_day: false, free: true,
          notes: f.duration ? `Flight duration: ${f.duration}` : '',
        }),
      });
    }
  };

  const syncAllFlightsToItinerary = async () => {
    if (!flights.length) return;
    if (!confirm(`This will add departure/arrival items to your itinerary for all ${flights.length} saved flight(s). Note: existing sync'd items won't be removed.\n\nContinue?`)) return;
    setSyncing(true);
    for (const f of flights) {
      await syncFlightToItinerary(f);
    }
    setSyncing(false);
  };

  const togglePaid = async (flight) => {
    await authFetch(`/trips/${tripId}/flights/${flight.id}`, {
      method: 'PUT', body: JSON.stringify({ paid: !flight.paid }),
    });
    loadData();
  };

  const deleteFlight = async (id) => {
    if (!confirm('Remove this flight?')) return;
    await authFetch(`/trips/${tripId}/flights/${id}`, { method: 'DELETE' });
    loadData();
  };

  let displayResults = [...searchResults];
  if (filterStops >= 0) displayResults = displayResults.filter(f => f.stops === filterStops);
  if (maxPrice) displayResults = displayResults.filter(f => f.price <= maxPrice);
  if (sortBy === 'price') displayResults.sort((a, b) => a.price - b.price);
  else if (sortBy === 'duration') displayResults.sort((a, b) => a.duration?.localeCompare(b.duration));
  else if (sortBy === 'departure') displayResults.sort((a, b) => a.departure_time?.localeCompare(b.departure_time));

  if (loading) return (
    <div className="page-layout"><div className="loading-overlay" style={{ flex: 1 }}><div className="loading-spinner" /></div></div>
  );

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title"><Plane size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Flights</h1>
              <p className="page-subtitle">Search Flight Centre for flights and save them to your trip</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowManual(true)}><Plus size={15} /> Add Manually</button>
              <button className="btn btn-primary" onClick={() => setShowSearch(!showSearch)}><Search size={15} /> Search Flights</button>
            </div>
          </div>

          {/* Search panel */}
          {showSearch && (
            <div className="card flights-search-card">
              <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Search size={18} /> Flight Search</h3>
              <div className="input-row input-row-2" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label>From (City or Airport)</label>
                  <input placeholder="e.g. Sydney" value={searchForm.from_city} onChange={e => setSearchForm({ ...searchForm, from_city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>To (City or Airport)</label>
                  <input placeholder="e.g. Paris" value={searchForm.to_city} onChange={e => setSearchForm({ ...searchForm, to_city: e.target.value })} />
                </div>
              </div>
              <div className="input-row" style={{ gridTemplateColumns: '1fr 1fr 100px 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group">
                  <label>Departure Date</label>
                  <input type="date" value={searchForm.date} onChange={e => setSearchForm({ ...searchForm, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Return Date (optional)</label>
                  <input type="date" value={searchForm.return_date} onChange={e => setSearchForm({ ...searchForm, return_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Passengers</label>
                  <input type="number" min="1" max="9" value={searchForm.passengers} onChange={e => setSearchForm({ ...searchForm, passengers: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="form-group">
                  <label>Cabin Class</label>
                  <select value={searchForm.cabin_class} onChange={e => setSearchForm({ ...searchForm, cabin_class: e.target.value })}>
                    {CLASSES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={handleSearch} disabled={searching || !searchForm.from_city || !searchForm.to_city || !searchForm.date}>
                  {searching ? 'Searching...' : <><Search size={15} /> Search Flights</>}
                </button>
                <a href={`https://www.flightcentre.com.au/flights`} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                  <ExternalLink size={15} /> Open Flight Centre
                </a>
              </div>

              {/* Results */}
              {(searchResults.length > 0 || searching) && (
                <div className="search-results-section">
                  <div className="search-results-header">
                    <div className="search-filters">
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {searching ? 'Searching...' : `${displayResults.length} results`}
                      </span>
                      <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto' }}>
                        <option value="price">Sort: Price</option>
                        <option value="duration">Sort: Duration</option>
                        <option value="departure">Sort: Departure</option>
                      </select>
                      <select value={filterStops} onChange={e => setFilterStops(parseInt(e.target.value))} style={{ width: 'auto' }}>
                        <option value={-1}>All stops</option>
                        <option value={0}>Direct only</option>
                        <option value={1}>1 stop</option>
                        <option value={2}>2 stops</option>
                      </select>
                    </div>
                  </div>

                  {searching ? (
                    <div className="loading-overlay"><div className="loading-spinner" /></div>
                  ) : (
                    <div className="flight-results">
                      {displayResults.map(f => (
                        <FlightResultCard key={f.id} flight={f} onAdd={() => addFlightFromResult(f)} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Saved flights */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="card-title"><Plane size={18} /> Saved Flights ({flights.length})</h3>
              {flights.length > 0 && (
                <button className="btn btn-outline btn-sm" onClick={syncAllFlightsToItinerary} disabled={syncing} title="Push all flights to itinerary">
                  <RefreshCcw size={13} /> {syncing ? 'Syncing…' : 'Sync → Itinerary'}
                </button>
              )}
            </div>
            {flights.length === 0 ? (
              <div className="empty-state">
                <Plane size={36} style={{ opacity: 0.3 }} />
                <div className="empty-title">No flights saved yet</div>
                <div className="empty-desc">Search for flights above or add one manually</div>
              </div>
            ) : (
              <div className="saved-flights">
                {flights.map(f => (
                  <SavedFlightCard key={f.id} flight={f} onTogglePaid={() => togglePaid(f)} onDelete={() => deleteFlight(f.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual add modal */}
      {showManual && (
        <Modal title="Add Flight Manually" onClose={() => setShowManual(false)} wide
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowManual(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addManualFlight}><Plus size={15} /> Add Flight</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>From City/Airport</label>
                <input placeholder="Sydney (SYD)" value={manualForm.from_city} onChange={e => setManualForm({ ...manualForm, from_city: e.target.value })} />
              </div>
              <div className="form-group">
                <label>To City/Airport</label>
                <input placeholder="Paris (CDG)" value={manualForm.to_city} onChange={e => setManualForm({ ...manualForm, to_city: e.target.value })} />
              </div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Airline</label>
                <input placeholder="Qantas" value={manualForm.airline} onChange={e => setManualForm({ ...manualForm, airline: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Flight Number</label>
                <input placeholder="QF1" value={manualForm.flight_number} onChange={e => setManualForm({ ...manualForm, flight_number: e.target.value })} />
              </div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Departure</label>
                <input type="datetime-local" value={manualForm.departure_time} onChange={e => setManualForm({ ...manualForm, departure_time: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Arrival</label>
                <input type="datetime-local" value={manualForm.arrival_time} onChange={e => setManualForm({ ...manualForm, arrival_time: e.target.value })} />
              </div>
            </div>
            <div className="input-row" style={{ gridTemplateColumns: '1fr 80px 1fr 1fr' }}>
              <div className="form-group">
                <label>Duration</label>
                <input placeholder="23h 15m" value={manualForm.duration} onChange={e => setManualForm({ ...manualForm, duration: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Stops</label>
                <input type="number" min="0" max="5" value={manualForm.stops} onChange={e => setManualForm({ ...manualForm, stops: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Price (AUD)</label>
                <input type="number" placeholder="1500" value={manualForm.price} onChange={e => setManualForm({ ...manualForm, price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Cabin Class</label>
                <select value={manualForm.cabin_class} onChange={e => setManualForm({ ...manualForm, cabin_class: e.target.value })}>
                  {CLASSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input placeholder="Any additional notes..." value={manualForm.notes} onChange={e => setManualForm({ ...manualForm, notes: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FlightResultCard({ flight, onAdd }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flight-result-card">
      <div className="flight-result-main">
        <AirlineLogo code={flight.airline_code} />
        <div className="flight-result-times">
          <div className="flight-time-row">
            <span className="flight-time">{formatDateTime(flight.departure_time)?.split(',')[1]?.trim()}</span>
            <div className="flight-duration-line">
              <span className="flight-duration">{flight.duration}</span>
              <div className="flight-line">
                <div className="flight-line-bar" />
                <Plane size={12} style={{ color: 'var(--accent)' }} />
              </div>
              <span className="flight-stops-label">{flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</span>
            </div>
            <span className="flight-time">{formatDateTime(flight.arrival_time)?.split(',')[1]?.trim()}</span>
          </div>
          <div className="flight-route-row">
            <span>{flight.from_city}</span>
            <ArrowRight size={12} style={{ color: 'var(--text-light)' }} />
            <span>{flight.to_city}</span>
          </div>
        </div>
        <div className="flight-result-right">
          <div className="flight-airline-name">{flight.airline}</div>
          <div className="flight-cabin">{flight.cabin_class}</div>
          <div className="price-display">A${flight.price?.toLocaleString()}</div>
          {flight.passengers > 1 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total: A${flight.total_price?.toLocaleString()}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={onAdd}><Plus size={13} /> Save</button>
            <a href={flight.booking_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              <ExternalLink size={13} /> Book
            </a>
          </div>
        </div>
      </div>
      <button className="flight-expand-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? 'Less detail' : 'More detail'}
      </button>
      {expanded && (
        <div className="flight-detail">
          <div className="info-row"><span className="info-label">Baggage</span><span className="info-value">{flight.baggage}</span></div>
          <div className="info-row"><span className="info-label">Refundable</span><span className="info-value">{flight.refundable ? '✅ Yes' : '❌ No'}</span></div>
          {flight.stop_cities?.length > 0 && (
            <div className="info-row"><span className="info-label">Stops via</span><span className="info-value">{flight.stop_cities.join(', ')}</span></div>
          )}
          <div className="info-row"><span className="info-label">Flight No.</span><span className="info-value">{flight.flight_number}</span></div>
        </div>
      )}
    </div>
  );
}

function SavedFlightCard({ flight, onTogglePaid, onDelete }) {
  return (
    <div className="saved-flight-card">
      <div className="saved-flight-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AirlineLogo code={flight.airline?.slice(0, 2).toUpperCase()} />
          <div>
            <div style={{ fontWeight: 700 }}>{flight.airline} {flight.flight_number}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{flight.cabin_class} · {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`paid-badge ${flight.paid ? 'paid' : 'unpaid'}`}>
            {flight.paid ? <><Check size={11} /> Paid</> : 'Unpaid'}
          </span>
          <button className="btn btn-danger btn-icon btn-sm" onClick={onDelete}><X size={14} /></button>
        </div>
      </div>
      <div className="saved-flight-body">
        <div className="saved-flight-route">
          <div>
            <div className="saved-flight-time">{formatDateTime(flight.departure_time)}</div>
            <div className="saved-flight-city">{flight.from_city || flight.from_airport}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{flight.duration}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 30, height: 1, background: 'var(--border-strong)' }} />
              <Plane size={14} style={{ color: 'var(--accent)' }} />
              <div style={{ width: 30, height: 1, background: 'var(--border-strong)' }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="saved-flight-time">{formatDateTime(flight.arrival_time)}</div>
            <div className="saved-flight-city">{flight.to_city || flight.to_airport}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div className="price-display">A${flight.price?.toLocaleString()}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${flight.paid ? 'btn-success' : 'btn-outline'}`} onClick={onTogglePaid}>
              {flight.paid ? <><Check size={13} /> Paid</> : 'Mark Paid'}
            </button>
            {flight.booking_url && (
              <a href={flight.booking_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                <ExternalLink size={13} /> View
              </a>
            )}
          </div>
        </div>
        {flight.notes && <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{flight.notes}</div>}
      </div>
    </div>
  );
}
