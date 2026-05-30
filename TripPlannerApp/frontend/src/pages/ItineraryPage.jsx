import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import PlaceSearchInput from '../components/PlaceSearchInput';
import Modal from '../components/Modal';
import { Calendar, Plus, X, Clock, MapPin, Check, Sun, Coffee, Zap, Pencil, ArrowRight } from 'lucide-react';
import { format, eachDayOfInterval, parseISO, differenceInDays, isWithinInterval } from 'date-fns';
import './ItineraryPage.css';

const DAY_TYPES = {
  normal: { label: 'Normal', icon: Sun, color: '#0ea5e9' },
  flex: { label: 'Flex Day', icon: Zap, color: '#f59e0b' },
  chill: { label: 'Chill Day', icon: Coffee, color: '#10b981' },
};

const CATEGORIES = ['attraction', 'food', 'transport', 'accommodation', 'shopping', 'nature', 'culture', 'other'];

const CATEGORY_COLORS = {
  attraction: '#0ea5e9', food: '#ef4444', transport: '#8b5cf6',
  accommodation: '#f59e0b', shopping: '#ec4899', nature: '#10b981',
  culture: '#6366f1', museum: '#a855f7', adventure: '#f97316', other: '#94a3b8',
};

export default function ItineraryPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [activeDest, setActiveDest] = useState(null);
  const [itinerary, setItinerary] = useState({});
  const [loading, setLoading] = useState(true);
  const [savedActivities, setSavedActivities] = useState([]);
  const [showAddItem, setShowAddItem] = useState(null); // date string
  const [editItem, setEditItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: '', location: '', lat: null, lng: null, time: '', duration: '',
    whole_day: false, end_date: '', price: '', free: false, paid: false, notes: '', category: 'attraction',
  });

  useEffect(() => { loadTrip(); }, [tripId]);
  useEffect(() => { if (activeDest) { loadItinerary(activeDest.id); loadActivities(activeDest.id); } }, [activeDest]);

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
    } finally {
      setLoading(false);
    }
  };

  const loadItinerary = async (destId) => {
    const res = await authFetch(`/trips/${tripId}/destinations/${destId}/itinerary`);
    if (res?.ok) {
      const days = await res.json();
      const map = {};
      days.forEach(d => { map[d.date] = d; });
      setItinerary(map);
    }
  };

  const loadActivities = async (destId) => {
    const res = await authFetch(`/trips/${tripId}/destinations/${destId}/activities`);
    if (res?.ok) setSavedActivities(await res.json());
    else setSavedActivities([]);
  };

  const getDaysForDest = (dest) => {
    if (!dest?.start_date || !dest?.end_date) return [];
    try {
      return eachDayOfInterval({
        start: parseISO(dest.start_date),
        end: parseISO(dest.end_date),
      });
    } catch { return []; }
  };

  const updateDayType = async (dateStr, type) => {
    await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/itinerary/${dateStr}/type`, {
      method: 'PUT', body: JSON.stringify({ type }),
    });
    loadItinerary(activeDest.id);
  };

  const openAddItem = (dateStr) => {
    setShowAddItem(dateStr);
    setItemForm({ name: '', location: '', lat: null, lng: null, time: '', duration: '', whole_day: false, end_date: '', price: '', free: false, paid: false, notes: '', category: 'attraction' });
  };

  const openEditItem = (dateStr, item) => {
    setEditItem({ dateStr, item });
    setItemForm({
      name: item.name || '',
      location: item.location || '',
      lat: item.lat || null,
      lng: item.lng || null,
      time: item.time || '',
      duration: item.duration || '',
      whole_day: item.whole_day || false,
      end_date: item.end_date || '',
      price: item.price || '',
      free: item.free || false,
      paid: item.paid || false,
      notes: item.notes || '',
      category: item.category || 'attraction',
    });
  };

  const saveItem = async () => {
    const body = {
      ...itemForm,
      price: itemForm.free ? null : (parseFloat(itemForm.price) || null),
    };
    let res;
    if (editItem) {
      res = await authFetch(
        `/trips/${tripId}/destinations/${activeDest.id}/itinerary/${editItem.dateStr}/items/${editItem.item.id}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
    } else {
      res = await authFetch(
        `/trips/${tripId}/destinations/${activeDest.id}/itinerary/${showAddItem}/items`,
        { method: 'POST', body: JSON.stringify(body) }
      );
    }
    if (res?.ok) {
      setShowAddItem(null);
      setEditItem(null);
      loadItinerary(activeDest.id);
    }
  };

  const deleteItem = async (dateStr, itemId) => {
    await authFetch(`/trips/${tripId}/destinations/${activeDest.id}/itinerary/${dateStr}/items/${itemId}`, { method: 'DELETE' });
    loadItinerary(activeDest.id);
  };

  const toggleItemPaid = async (dateStr, item) => {
    await authFetch(
      `/trips/${tripId}/destinations/${activeDest.id}/itinerary/${dateStr}/items/${item.id}`,
      { method: 'PUT', body: JSON.stringify({ paid: !item.paid }) }
    );
    loadItinerary(activeDest.id);
  };

  if (loading) return <div className="page-layout"><div className="loading-overlay" style={{ flex: 1 }}><div className="loading-spinner" /></div></div>;

  const days = getDaysForDest(activeDest);

  // Build a flat list of ALL itinerary items across all days (to find multi-day ones)
  const allItemsWithDate = Object.entries(itinerary).flatMap(([date, day]) =>
    (day.items || []).map(item => ({ ...item, _startDate: date }))
  );

  // Get multi-day items that span a given date (but didn't START on that date)
  const getSpanningItems = (dateStr) =>
    allItemsWithDate.filter(item => {
      if (!item.end_date || item._startDate === dateStr) return false;
      return item._startDate < dateStr && item.end_date >= dateStr;
    });

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title"><Calendar size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Itinerary</h1>
              <p className="page-subtitle">Plan your day-by-day activities for each destination</p>
            </div>
          </div>

          {destinations.length === 0 ? (
            <div className="alert alert-info">No destinations yet. Add destinations from the trip overview.</div>
          ) : (
            <>
              <div className="tabs" style={{ marginBottom: 24 }}>
                {destinations.map(d => (
                  <button key={d.id} className={`tab-btn ${activeDest?.id === d.id ? 'active' : ''}`} onClick={() => setActiveDest(d)}>
                    <MapPin size={14} /> {d.name}
                  </button>
                ))}
              </div>

              {activeDest && (!activeDest.start_date || !activeDest.end_date) ? (
                <div className="alert alert-warning">
                  <div>Set arrival and departure dates for <strong>{activeDest.name}</strong> to see the itinerary. Go to Trip Settings to update dates.</div>
                </div>
              ) : days.length === 0 ? (
                <div className="alert alert-info">No days to show. Set dates for this destination.</div>
              ) : (
                <div className="itinerary-grid">
                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayData = itinerary[dateStr];
                    const dayType = dayData?.type || 'normal';
                    const TypeIcon = DAY_TYPES[dayType]?.icon || Sun;
                    const typeColor = DAY_TYPES[dayType]?.color || '#0ea5e9';
                    const items = (dayData?.items || []).sort((a, b) => {
                      if (a.whole_day && !b.whole_day) return -1;
                      if (!a.whole_day && b.whole_day) return 1;
                      return (a.time || '').localeCompare(b.time || '');
                    });
                    const spanningItems = getSpanningItems(dateStr);

                    return (
                      <div key={dateStr} className="day-card card">
                        <div className="day-card-header">
                          <div className="day-info">
                            <div className="day-date">{format(day, 'EEEE')}</div>
                            <div className="day-date-full">{format(day, 'd MMMM yyyy')}</div>
                          </div>
                          <div className="day-type-selector">
                            {Object.entries(DAY_TYPES).map(([type, { label, icon: Icon, color }]) => (
                              <button
                                key={type}
                                className={`day-type-btn ${dayType === type ? 'active' : ''}`}
                                style={dayType === type ? { background: color + '20', color, borderColor: color } : {}}
                                onClick={() => updateDayType(dateStr, type)}
                                title={label}
                              >
                                <Icon size={12} />
                                <span>{label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {(dayType === 'flex' || dayType === 'chill') && (
                          <div className="day-type-banner" style={{ background: typeColor + '15', borderColor: typeColor + '40' }}>
                            <TypeIcon size={14} style={{ color: typeColor }} />
                            <span style={{ color: typeColor, fontWeight: 600 }}>
                              {dayType === 'flex' ? 'Flexible day — plans may change' : 'Relaxing day — take it easy!'}
                            </span>
                          </div>
                        )}

                        <div className="day-items">
                          {items.length === 0 && spanningItems.length === 0 && (
                            <div className="day-empty">Nothing planned yet</div>
                          )}
                          {/* Multi-day items spanning into this day */}
                          {spanningItems.map(item => {
                            const dayNum = differenceInDays(parseISO(dateStr), parseISO(item._startDate)) + 1;
                            const totalDays = differenceInDays(parseISO(item.end_date), parseISO(item._startDate)) + 1;
                            return (
                              <div key={`span-${item.id}-${dateStr}`} className="itinerary-item multi-day-span">
                                <div className="item-category-dot" style={{ background: '#8b5cf6' }} />
                                <div className="item-main">
                                  <div className="item-header">
                                    <div className="item-name">{item.name}</div>
                                    <span className="badge badge-purple" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>Day {dayNum}/{totalDays}</span>
                                  </div>
                                  {item.location && (
                                    <div className="item-meta"><span><MapPin size={11} /> {item.location.split(',')[0]}</span></div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {/* This day's own items */}
                          {items.map(item => (
                            <ItineraryItem
                              key={item.id}
                              item={item}
                              dateStr={dateStr}
                              allDates={Object.keys(itinerary)}
                              onEdit={() => openEditItem(dateStr, item)}
                              onDelete={() => deleteItem(dateStr, item.id)}
                              onTogglePaid={() => toggleItemPaid(dateStr, item)}
                            />
                          ))}
                        </div>

                        <button className="day-add-btn" onClick={() => openAddItem(dateStr)}>
                          <Plus size={14} /> Add Place
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {(showAddItem || editItem) && (
        <Modal
          title={editItem ? 'Edit Activity' : `Add to ${showAddItem ? format(parseISO(showAddItem), 'd MMMM') : ''}`}
          onClose={() => { setShowAddItem(null); setEditItem(null); }}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => { setShowAddItem(null); setEditItem(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveItem} disabled={!itemForm.name}><Check size={15} /> Save</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Pick from saved activities */}
            {savedActivities.length > 0 && (
              <div className="form-group">
                <label style={{ marginBottom: 6 }}>Pick from saved activities</label>
                <div className="activity-picker">
                  {savedActivities.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      className="activity-pick-btn"
                      onClick={() => setItemForm(f => ({
                        ...f,
                        name: a.name,
                        location: a.location || f.location,
                        lat: a.lat || f.lat,
                        lng: a.lng || f.lng,
                        category: a.category || f.category,
                        price: a.price != null ? String(a.price) : f.price,
                        free: a.free || false,
                        notes: a.notes || f.notes,
                      }))}
                    >
                      <span className="activity-pick-dot" style={{ background: CATEGORY_COLORS[a.category] || '#94a3b8' }} />
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Activity / Place *</label>
              <input placeholder="e.g. Eiffel Tower" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} autoFocus />
            </div>
            <div className="form-group">
              <label>Location (search or type)</label>
              <PlaceSearchInput
                value={itemForm.location}
                onChange={v => setItemForm({ ...itemForm, location: v })}
                onSelect={p => setItemForm({ ...itemForm, location: p.display_name, lat: p.lat, lng: p.lng, name: itemForm.name || p.name })}
                placeholder="Search for address..."
              />
            </div>

            {/* Whole day + End date row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                <input type="checkbox" checked={itemForm.whole_day} onChange={e => setItemForm({ ...itemForm, whole_day: e.target.checked, time: '', duration: '' })} style={{ width: 'auto', margin: 0 }} />
                🌅 Takes the whole day
              </label>
              <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ArrowRight size={12} /> Ends on (multi-day)</label>
                <input type="date" value={itemForm.end_date} onChange={e => setItemForm({ ...itemForm, end_date: e.target.value })}
                  min={showAddItem || editItem?.dateStr || ''} placeholder="Same day" />
              </div>
            </div>

            {!itemForm.whole_day && (
              <div className="input-row input-row-2">
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" value={itemForm.time} onChange={e => setItemForm({ ...itemForm, time: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Duration</label>
                  <input placeholder="e.g. 2 hours" value={itemForm.duration} onChange={e => setItemForm({ ...itemForm, duration: e.target.value })} />
                </div>
              </div>
            )}

            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Category</label>
                <select value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Price</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={itemForm.free ? '' : itemForm.price}
                    disabled={itemForm.free}
                    onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <input type="checkbox" checked={itemForm.free} onChange={e => setItemForm({ ...itemForm, free: e.target.checked, price: '' })} style={{ width: 'auto', margin: 0 }} />
                    Free
                  </label>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea placeholder="Any notes about this activity..." value={itemForm.notes} onChange={e => setItemForm({ ...itemForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ItineraryItem({ item, dateStr, onEdit, onDelete, onTogglePaid }) {
  const color = CATEGORY_COLORS[item.category] || '#94a3b8';
  const totalDays = item.end_date ? differenceInDays(parseISO(item.end_date), parseISO(dateStr)) + 1 : null;

  return (
    <div className={`itinerary-item ${item.whole_day ? 'whole-day-item' : ''}`}>
      <div className="item-category-dot" style={{ background: color }} />
      <div className="item-main">
        <div className="item-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            {item.whole_day && <span className="whole-day-badge">All Day</span>}
            {totalDays && totalDays > 1 && <span className="badge badge-purple" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>{totalDays} days</span>}
            <div className="item-name">{item.name}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {!item.free && item.price && (
              <span className={`paid-badge ${item.paid ? 'paid' : 'unpaid'}`} style={{ cursor: 'pointer' }} onClick={onTogglePaid}>
                {item.paid ? <><Check size={10} /> Paid</> : `A$${item.price}`}
              </span>
            )}
            {item.free && <span className="badge badge-green">Free</span>}
            <button className="btn btn-ghost btn-icon" style={{ padding: '3px', color: 'var(--text-muted)' }} onClick={onEdit}><Pencil size={12} /></button>
            <button className="btn btn-ghost btn-icon" style={{ padding: '3px', color: 'var(--text-muted)' }} onClick={onDelete}><X size={12} /></button>
          </div>
        </div>
        <div className="item-meta">
          {!item.whole_day && item.time && <span><Clock size={11} /> {item.time}</span>}
          {!item.whole_day && item.duration && <span>· {item.duration}</span>}
          {item.end_date && item.end_date !== dateStr && (
            <span><ArrowRight size={11} /> ends {format(parseISO(item.end_date), 'd MMM')}</span>
          )}
          {item.location && <span><MapPin size={11} /> {item.location.split(',')[0]}</span>}
        </div>
        {item.notes && <div className="item-notes">{item.notes}</div>}
      </div>
    </div>
  );
}
