import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import MapWithMarkers from '../components/MapWithMarkers';
import PlaceSearchInput from '../components/PlaceSearchInput';
import Modal from '../components/Modal';
import { MapPin, Plus, X, Globe, Clock, DollarSign, Check, Pencil, Tag } from 'lucide-react';
import './ActivitiesPage.css';

const CATEGORIES = ['attraction', 'museum', 'nature', 'adventure', 'food', 'shopping', 'culture', 'nightlife', 'sport', 'other'];

const CATEGORY_COLORS = {
  attraction: '#0ea5e9', museum: '#8b5cf6', nature: '#10b981',
  adventure: '#f59e0b', food: '#ef4444', shopping: '#ec4899',
  culture: '#6366f1', nightlife: '#1e1b4b', sport: '#16a34a', other: '#94a3b8',
};

export default function ActivitiesPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [activeDest, setActiveDest] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editActivity, setEditActivity] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [form, setForm] = useState({
    name: '', location: '', lat: null, lng: null, price: '', free: false,
    paid: false, notes: '', website: '', opening_hours: '', category: 'attraction',
  });

  useEffect(() => { loadTrip(); }, [tripId]);
  useEffect(() => { if (activeDest) loadActivities(activeDest.id); }, [activeDest]);

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

  const loadActivities = async (destId) => {
    const res = await authFetch(`/trips/${tripId}/destinations/${destId}/activities`);
    if (res?.ok) setActivities(await res.json());
    else setActivities([]);
  };

  const saveActivity = async () => {
    const body = { ...form, price: form.free ? null : (parseFloat(form.price) || null) };
    let res;
    if (editActivity) {
      res = await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/activities/${editActivity.id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      res = await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/activities`, { method: 'POST', body: JSON.stringify(body) });
    }
    if (res?.ok) { setShowAdd(false); setEditActivity(null); loadActivities(activeDest.id); resetForm(); }
  };

  const deleteActivity = async (id) => {
    if (!confirm('Delete this activity?')) return;
    await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/activities/${id}`, { method: 'DELETE' });
    loadActivities(activeDest.id);
  };

  const togglePaid = async (activity) => {
    await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/activities/${activity.id}`, {
      method: 'PUT', body: JSON.stringify({ paid: !activity.paid }),
    });
    loadActivities(activeDest.id);
  };

  const openEdit = (activity) => {
    setEditActivity(activity);
    setForm({
      name: activity.name || '', location: activity.location || '', lat: activity.lat || null, lng: activity.lng || null,
      price: activity.price || '', free: activity.free || false, paid: activity.paid || false,
      notes: activity.notes || '', website: activity.website || '', opening_hours: activity.opening_hours || '',
      category: activity.category || 'attraction',
    });
    setShowAdd(true);
  };

  const resetForm = () => setForm({ name: '', location: '', lat: null, lng: null, price: '', free: false, paid: false, notes: '', website: '', opening_hours: '', category: 'attraction' });

  const markers = activities
    .filter(a => a.lat && a.lng)
    .map(a => ({
      id: a.id,
      lat: a.lat,
      lng: a.lng,
      title: a.name,
      subtitle: a.location,
      color: CATEGORY_COLORS[a.category] || '#0ea5e9',
      data: a,
    }));

  const mapCenter = activeDest?.lat && activeDest?.lng
    ? [activeDest.lat, activeDest.lng]
    : markers.length > 0 ? [markers[0].lat, markers[0].lng] : [20, 0];

  if (loading) return <div className="page-layout"><div className="loading-overlay" style={{ flex: 1 }}><div className="loading-spinner" /></div></div>;

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title"><MapPin size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Activities</h1>
              <p className="page-subtitle">Things to do at each destination — pinned on the map</p>
            </div>
            <button className="btn btn-primary" onClick={() => { setShowAdd(true); setEditActivity(null); resetForm(); }}>
              <Plus size={15} /> Add Activity
            </button>
          </div>

          {destinations.length === 0 ? (
            <div className="alert alert-info">Add destinations first from the trip overview.</div>
          ) : (
            <>
              <div className="tabs" style={{ marginBottom: 20 }}>
                {destinations.map(d => (
                  <button key={d.id} className={`tab-btn ${activeDest?.id === d.id ? 'active' : ''}`} onClick={() => setActiveDest(d)}>
                    <MapPin size={14} /> {d.name}
                  </button>
                ))}
              </div>

              <div className="split-layout">
                {/* Activity list */}
                <div className="split-list">
                  {activities.length === 0 ? (
                    <div className="empty-state" style={{ padding: 32 }}>
                      <MapPin size={30} style={{ opacity: 0.3 }} />
                      <div className="empty-title">No activities yet</div>
                      <div className="empty-desc">Add things to do in {activeDest?.name}</div>
                    </div>
                  ) : (
                    activities.map(activity => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        isSelected={selectedMarker?.id === activity.id}
                        onClick={() => setSelectedMarker(markers.find(m => m.id === activity.id))}
                        onEdit={() => openEdit(activity)}
                        onDelete={() => deleteActivity(activity.id)}
                        onTogglePaid={() => togglePaid(activity)}
                      />
                    ))
                  )}
                </div>

                {/* Map */}
                <div>
                  <MapWithMarkers
                    center={mapCenter}
                    zoom={activeDest?.lat ? 13 : 10}
                    markers={markers}
                    selectedId={selectedMarker?.id}
                    onMarkerClick={(m) => setSelectedMarker(m)}
                    renderDetail={(marker) => <ActivityDetail activity={marker.data} />}
                  />
                  <div className="category-legend">
                    {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                      <span key={cat} className="legend-item">
                        <span className="legend-dot" style={{ background: color }} />
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <Modal
          title={editActivity ? 'Edit Activity' : 'Add Activity'}
          onClose={() => { setShowAdd(false); setEditActivity(null); resetForm(); }}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => { setShowAdd(false); setEditActivity(null); resetForm(); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveActivity} disabled={!form.name}><Check size={15} /> Save</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label>Activity Name *</label>
              <input placeholder="e.g. Louvre Museum" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="form-group">
              <label>Location (search Maps)</label>
              <PlaceSearchInput
                value={form.location}
                onChange={v => setForm({ ...form, location: v })}
                onSelect={p => setForm({ ...form, location: p.display_name, lat: p.lat, lng: p.lng, name: form.name || p.name })}
                placeholder="Search for address on maps..."
              />
            </div>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Price (AUD)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" placeholder="0.00" value={form.free ? '' : form.price} disabled={form.free} onChange={e => setForm({ ...form, price: e.target.value })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={form.free} onChange={e => setForm({ ...form, free: e.target.checked, price: '' })} style={{ width: 'auto', margin: 0 }} />
                    Free
                  </label>
                </div>
              </div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Website</label>
                <input placeholder="https://..." value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Opening Hours</label>
                <input placeholder="e.g. 9am–6pm daily" value={form.opening_hours} onChange={e => setForm({ ...form, opening_hours: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea placeholder="Tips, reminders, things to know..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ActivityCard({ activity, isSelected, onClick, onEdit, onDelete, onTogglePaid }) {
  const color = CATEGORY_COLORS[activity.category] || '#94a3b8';
  return (
    <div className={`activity-card card ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div className="activity-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="activity-dot" style={{ background: color }} />
          <div>
            <div className="activity-name">{activity.name}</div>
            <div className="activity-category">{activity.category}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          {!activity.free && activity.price && (
            <span className={`paid-badge ${activity.paid ? 'paid' : 'unpaid'}`} style={{ cursor: 'pointer' }} onClick={onTogglePaid}>
              {activity.paid ? <><Check size={10} /> Paid</> : `A$${activity.price}`}
            </span>
          )}
          {activity.free && <span className="badge badge-green">Free</span>}
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit}><Pencil size={13} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete}><X size={13} /></button>
        </div>
      </div>
      {activity.location && (
        <div className="activity-location"><MapPin size={11} /> {activity.location.split(',').slice(0,2).join(',')}</div>
      )}
    </div>
  );
}

function ActivityDetail({ activity }) {
  return (
    <div>
      {activity.location && <div className="info-row"><span className="info-label">Location</span><span className="info-value">{activity.location}</span></div>}
      {activity.category && <div className="info-row"><span className="info-label">Category</span><span className="info-value" style={{ textTransform: 'capitalize' }}>{activity.category}</span></div>}
      {activity.opening_hours && <div className="info-row"><span className="info-label"><Clock size={12} /> Hours</span><span className="info-value">{activity.opening_hours}</span></div>}
      {!activity.free && activity.price && <div className="info-row"><span className="info-label">Price</span><span className="info-value price-small">A${activity.price}</span></div>}
      {activity.free && <div className="info-row"><span className="info-label">Price</span><span className="info-value"><span className="badge badge-green">Free Entry</span></span></div>}
      {activity.website && <div className="info-row"><span className="info-label"><Globe size={12} /> Website</span><span className="info-value"><a href={activity.website} target="_blank" rel="noopener noreferrer">Visit site</a></span></div>}
      {activity.notes && <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-muted)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activity.notes}</div>}
    </div>
  );
}
