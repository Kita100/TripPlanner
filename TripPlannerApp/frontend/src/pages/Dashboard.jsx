import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch, logout } from '../api';
import { Plus, MapPin, Calendar, Users, Trash2, Plane, LogOut, Globe } from 'lucide-react';
import './Dashboard.css';

const GRADIENT_PALETTES = [
  'linear-gradient(135deg, #0f3460, #0ea5e9)',
  'linear-gradient(135deg, #064e3b, #10b981)',
  'linear-gradient(135deg, #7c3aed, #c084fc)',
  'linear-gradient(135deg, #92400e, #f59e0b)',
  'linear-gradient(135deg, #be185d, #f9a8d4)',
  'linear-gradient(135deg, #1e3a5f, #06b6d4)',
  'linear-gradient(135deg, #3730a3, #818cf8)',
  'linear-gradient(135deg, #065f46, #34d399)',
];

function getGradient(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENT_PALETTES[Math.abs(hash) % GRADIENT_PALETTES.length];
}

export default function Dashboard() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const displayName = localStorage.getItem('display_name') || localStorage.getItem('username') || 'Traveller';

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/trips');
      if (res?.ok) setTrips(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (e, tripId) => {
    e.stopPropagation();
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    await authFetch(`/trips/${tripId}`, { method: 'DELETE' });
    setTrips(trips.filter(t => t.id !== tripId));
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="dashboard-brand">
            <Plane size={22} />
            <span>TripPlanner</span>
          </div>
          <div className="dashboard-user">
            <span className="dashboard-welcome">Hello, {displayName} 👋</span>
            <button className="btn btn-ghost btn-sm" onClick={() => logout(navigate)}>
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-hero">
          <h1>Your Trips</h1>
          <p>Plan, organise, and explore your next adventure</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/trips/new')}>
            <Plus size={18} />
            New Trip
          </button>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="loading-spinner" /></div>
        ) : trips.length === 0 ? (
          <div className="empty-state dashboard-empty">
            <span className="empty-icon">🌍</span>
            <div className="empty-title">No trips yet</div>
            <div className="empty-desc">Create your first trip to start planning your adventure!</div>
            <button className="btn btn-primary" onClick={() => navigate('/trips/new')}>
              <Plus size={16} />
              Create Trip
            </button>
          </div>
        ) : (
          <div className="trip-grid">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                gradient={getGradient(trip.id)}
                onOpen={() => navigate(`/trips/${trip.id}`)}
                onDelete={(e) => deleteTrip(e, trip.id)}
              />
            ))}
            <div className="trip-card trip-card-new" onClick={() => navigate('/trips/new')}>
              <Plus size={28} />
              <span>New Trip</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TripCard({ trip, gradient, onOpen, onDelete }) {
  return (
    <div className="trip-card" onClick={onOpen}>
      <div className="trip-card-banner" style={{ background: gradient }}>
        <div className="trip-card-emoji">{trip.cover_emoji || '✈️'}</div>
        <button className="trip-card-delete" onClick={onDelete} title="Delete trip">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="trip-card-body">
        <h3 className="trip-card-name">{trip.name}</h3>
        {trip.description && <p className="trip-card-desc">{trip.description}</p>}
        <div className="trip-card-meta">
          <span className="trip-card-stat">
            <MapPin size={13} />
            {trip.destination_count || 0} destination{trip.destination_count !== 1 ? 's' : ''}
          </span>
          {trip.collaborators?.length > 0 && (
            <span className="trip-card-stat">
              <Users size={13} />
              {trip.collaborators.length + 1} travellers
            </span>
          )}
        </div>
        {trip.creator !== localStorage.getItem('username') && (
          <div className="badge badge-blue" style={{ marginTop: 8 }}>Shared with you</div>
        )}
      </div>
    </div>
  );
}
