import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import PlaceSearchInput from '../components/PlaceSearchInput';
import Modal from '../components/Modal';
import { Plane, Calendar, MapPin, Hotel, Train, Utensils, DollarSign, Users, Settings, Plus, X, Pencil, Check, Link2, Copy, Smartphone, CreditCard } from 'lucide-react';
import './TripHub.css';

const SECTIONS = [
  { to: '/flights',       label: 'Flights',          icon: Plane,       desc: 'Search and save your flight bookings', color: '#0ea5e9' },
  { to: '/itinerary',     label: 'Itinerary',        icon: Calendar,    desc: 'Day-by-day plans for each destination', color: '#8b5cf6' },
  { to: '/activities',    label: 'Activities',       icon: MapPin,      desc: 'Things to do, mapped and organised', color: '#10b981' },
  { to: '/accommodation', label: 'Accommodation',    icon: Hotel,       desc: 'Find and save your places to stay', color: '#f59e0b' },
  { to: '/transport',     label: 'Public Transport', icon: Train,       desc: 'Transit info and maps for each city', color: '#06b6d4' },
  { to: '/food',          label: 'Food & Dining',    icon: Utensils,    desc: 'Restaurants near your spots, filtered by diet', color: '#ef4444' },
  { to: '/mobile',        label: 'Mobile & eSIM',    icon: Smartphone,  desc: 'eSIM recommendations and connectivity planning', color: '#06b6d4' },
  { to: '/payments',      label: 'Money & Payments', icon: CreditCard,  desc: 'Local payment methods and currency tips', color: '#7c3aed' },
  { to: '/budget',        label: 'Budget',           icon: DollarSign,  desc: "Track costs and what you've paid", color: '#16a34a' },
];

export default function TripHub() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddDest, setShowAddDest] = useState(false);
  const [showAddCollab, setShowAddCollab] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [newDestForm, setNewDestForm] = useState({ name: '', lat: null, lng: null, start_date: '', end_date: '' });
  const [collabInput, setCollabInput] = useState('');
  const [collabError, setCollabError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  const loadTrip = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/trips/${tripId}`);
      if (res?.ok) setTrip(await res.json());
      else navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const addDestination = async () => {
    if (!newDestForm.name) return;
    setSaving(true);
    try {
      const res = await authFetch(`/trips/${tripId}/destinations`, {
        method: 'POST',
        body: JSON.stringify({
          name: newDestForm.name,
          lat: newDestForm.lat,
          lng: newDestForm.lng,
          start_date: newDestForm.start_date || null,
          end_date: newDestForm.end_date || null,
          order: trip.destinations?.length || 0,
        }),
      });
      if (res?.ok) {
        setNewDestForm({ name: '', lat: null, lng: null, start_date: '', end_date: '' });
        setShowAddDest(false);
        loadTrip();
      }
    } finally {
      setSaving(false);
    }
  };

  const removeDestination = async (destId) => {
    if (!confirm('Remove this destination? All associated data will be deleted.')) return;
    await authFetch(`/trips/${tripId}/destinations/${destId}`, { method: 'DELETE' });
    loadTrip();
  };

  const addCollaborator = async () => {
    const email = collabInput.trim();
    if (!email) return;
    setCollabError('');
    setSaving(true);
    try {
      const res = await authFetch(`/trips/${tripId}/collaborators`, {
        method: 'POST',
        body: JSON.stringify({ username: email }),
      });
      const data = await res.json();
      if (res?.ok) {
        setCollabInput('');
        loadTrip();
      } else {
        setCollabError(data.detail || 'Failed to add collaborator');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeCollaborator = async (email) => {
    await authFetch(`/trips/${tripId}/collaborators/${email}`, { method: 'DELETE' });
    loadTrip();
  };

  const generateShareLink = async () => {
    setGeneratingLink(true);
    setShareCopied(false);
    try {
      const res = await authFetch(`/trips/${tripId}/invite`, { method: 'POST' });
      if (res?.ok) {
        const data = await res.json();
        const link = `${window.location.origin}/join/${data.invite_token}`;
        setShareLink(link);
        setShowShare(true);
      }
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // fallback for browsers that block clipboard
      const el = document.createElement('textarea');
      el.value = shareLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  if (loading) return (
    <div className="page-layout">
      <div className="loading-overlay" style={{ flex: 1 }}><div className="loading-spinner" /></div>
    </div>
  );

  if (!trip) return null;

  const base = `/trips/${tripId}`;
  const isCreator = trip.creator === localStorage.getItem('username');

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip.name} />
      <div className="page-content">
        <div className="triphub-hero" style={{ background: 'linear-gradient(135deg, #0f3460, #1a4a8a, #0ea5e9)' }}>
          <div className="triphub-hero-inner">
            <div className="triphub-emoji">{trip.cover_emoji || '✈️'}</div>
            <div>
              <h1 className="triphub-title">{trip.name}</h1>
              {trip.description && <p className="triphub-desc">{trip.description}</p>}
              <div className="triphub-meta">
                <span><MapPin size={14} /> {trip.destinations?.length || 0} destination{trip.destinations?.length !== 1 ? 's' : ''}</span>
                <span><Users size={14} /> {(trip.collaborators?.length || 0) + 1} traveller{(trip.collaborators?.length || 0) + 1 !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <button className="btn btn-outline triphub-settings" onClick={() => setShowSettings(true)}>
              <Settings size={16} /> Settings
            </button>
          </div>
        </div>

        <div className="page-main">
          {/* Destinations */}
          <section className="triphub-section">
            <div className="card-header">
              <h2 className="card-title"><MapPin size={18} /> Destinations</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddDest(true)}>
                <Plus size={14} /> Add
              </button>
            </div>
            {trip.destinations?.length === 0 ? (
              <div className="alert alert-info">No destinations yet. Add your first destination!</div>
            ) : (
              <div className="dest-cards">
                {trip.destinations?.map((d, i) => (
                  <div key={d.id} className="dest-hub-card card">
                    <div className="dest-hub-num">{i + 1}</div>
                    <div className="dest-hub-info">
                      <div className="dest-hub-name">{d.name}</div>
                      {(d.start_date || d.end_date) && (
                        <div className="dest-hub-dates">
                          {d.start_date && <span>From {d.start_date}</span>}
                          {d.end_date && <span> to {d.end_date}</span>}
                        </div>
                      )}
                    </div>
                    {isCreator && (
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeDestination(d.id)} title="Remove destination">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Navigation cards */}
          <section className="triphub-section">
            <h2 className="card-title" style={{ marginBottom: 16 }}>Plan Your Trip</h2>
            <div className="section-grid">
              {SECTIONS.map(({ to, label, icon: Icon, desc, color }) => (
                <Link key={to} to={base + to} className="section-card">
                  <div className="section-card-icon" style={{ background: color + '18', color }}>
                    <Icon size={22} />
                  </div>
                  <div className="section-card-text">
                    <div className="section-card-label">{label}</div>
                    <div className="section-card-desc">{desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Collaborators */}
          <section className="triphub-section">
            <div className="card-header">
              <h2 className="card-title"><Users size={18} /> Travellers</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {isCreator && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={generateShareLink} disabled={generatingLink}>
                      <Link2 size={14} /> {generatingLink ? 'Generating…' : 'Share Link'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setShowAddCollab(true); setCollabError(''); }}>
                      <Plus size={14} /> Invite by email
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="collab-cards">
              <div className="collab-card">
                <div className="collab-avatar-hub">{(trip.creator || 'Y')[0].toUpperCase()}</div>
                <div>
                  <div className="collab-email">{trip.creator}</div>
                  <div className="badge badge-blue" style={{ marginTop: 4 }}>Creator</div>
                </div>
              </div>
              {trip.collaborators?.map(email => (
                <div key={email} className="collab-card">
                  <div className="collab-avatar-hub collab-avatar-green">{email[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="collab-email">{email}</div>
                    <div className="badge badge-green" style={{ marginTop: 4 }}>Collaborator</div>
                  </div>
                  {isCreator && (
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeCollaborator(email)}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Add destination modal */}
      {showAddDest && (
        <Modal
          title="Add Destination"
          onClose={() => setShowAddDest(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowAddDest(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addDestination} disabled={!newDestForm.name || saving}>
                <Plus size={15} /> Add
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label>Destination *</label>
              <PlaceSearchInput
                value={newDestForm.name}
                onChange={v => setNewDestForm({ ...newDestForm, name: v })}
                onSelect={place => setNewDestForm({ ...newDestForm, name: place.name, lat: place.lat, lng: place.lng })}
                placeholder="Search for a city or country..."
              />
            </div>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Arrival Date</label>
                <input type="date" value={newDestForm.start_date} onChange={e => setNewDestForm({ ...newDestForm, start_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Departure Date</label>
                <input type="date" value={newDestForm.end_date} onChange={e => setNewDestForm({ ...newDestForm, end_date: e.target.value })} />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showShare && (
        <Modal title="Share Trip Link" onClose={() => setShowShare(false)}
          footer={<button className="btn btn-outline" onClick={() => setShowShare(false)}>Close</button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="alert alert-info" style={{ fontSize: '0.83rem' }}>
              Anyone with this link can <strong>view and edit</strong> this trip. They'll need to create a free TripPlanner account first.
            </div>
            <div className="form-group">
              <label>Invite link</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={shareLink} onClick={e => e.target.select()} style={{ flex: 1, fontSize: '0.8rem', fontFamily: 'monospace' }} />
                <button className="btn btn-primary" onClick={copyLink} style={{ flexShrink: 0 }}>
                  {shareCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
            </div>
            <div className="alert alert-warning" style={{ fontSize: '0.82rem' }}>
              <strong>⚠️ For others to use this link, the app must be deployed.</strong><br />
              If you're still running locally, see the README for how to deploy to Render + Vercel for free.
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              To revoke access, click <strong>Share Link</strong> again — this generates a new token and the old link stops working.
            </div>
          </div>
        </Modal>
      )}

      {showAddCollab && (
        <Modal
          title="Invite Collaborator"
          onClose={() => { setShowAddCollab(false); setCollabError(''); }}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowAddCollab(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addCollaborator} disabled={!collabInput.trim() || saving}>
                <Users size={15} /> Invite
              </button>
            </>
          }
        >
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="friend@example.com"
              value={collabInput}
              onChange={e => setCollabInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCollaborator()}
              autoFocus
            />
            {collabError && <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{collabError}</span>}
          </div>
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            The person must already have a TripPlanner account.
          </div>
        </Modal>
      )}
    </div>
  );
}
