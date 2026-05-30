import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../api';
import PlaceSearchInput from '../components/PlaceSearchInput';
import { Plus, X, Check, ChevronRight, ChevronLeft, Plane, MapPin, Users, Sparkles } from 'lucide-react';
import './CreateTrip.css';

const EMOJI_OPTIONS = ['✈️','🌍','🏖️','🗺️','🏔️','🌅','🎒','🚂','⛵','🏕️','🌴','🎭'];

export default function CreateTrip() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: basics
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('✈️');

  // Step 2: destinations
  const [destinations, setDestinations] = useState([]);
  const [destForm, setDestForm] = useState({ name: '', lat: null, lng: null, start_date: '', end_date: '' });

  // Step 3: collaborators
  const [collabInput, setCollabInput] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [collabError, setCollabError] = useState('');

  const addDestination = () => {
    if (!destForm.name) return;
    setDestinations([...destinations, { ...destForm, id: Date.now() }]);
    setDestForm({ name: '', lat: null, lng: null, start_date: '', end_date: '' });
  };

  const removeDestination = (id) => setDestinations(destinations.filter(d => d.id !== id));

  const addCollaborator = async () => {
    const email = collabInput.trim();
    if (!email || collaborators.includes(email)) return;
    setCollabError('');
    // We'll validate when creating the trip
    setCollaborators([...collaborators, email]);
    setCollabInput('');
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter a trip name.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await authFetch('/trips', {
        method: 'POST',
        body: JSON.stringify({ name, description, cover_emoji: emoji }),
      });
      if (!res?.ok) throw new Error('Failed to create trip');
      const trip = await res.json();

      // Add destinations
      for (let i = 0; i < destinations.length; i++) {
        const d = destinations[i];
        await authFetch(`/trips/${trip.id}/destinations`, {
          method: 'POST',
          body: JSON.stringify({
            name: d.name,
            lat: d.lat,
            lng: d.lng,
            start_date: d.start_date || null,
            end_date: d.end_date || null,
            order: i,
          }),
        });
      }

      // Add collaborators
      for (const email of collaborators) {
        await authFetch(`/trips/${trip.id}/collaborators`, {
          method: 'POST',
          body: JSON.stringify({ username: email }),
        });
      }

      navigate(`/trips/${trip.id}`);
    } catch (e) {
      setError('Failed to create trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-trip-page">
      <div className="create-trip-card">
        <div className="create-trip-header">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            <ChevronLeft size={16} /> Back
          </button>
          <h2>Create New Trip</h2>
          <div className="step-indicators">
            {[1,2,3].map(s => (
              <div key={s} className={`step-dot ${step === s ? 'active' : step > s ? 'done' : ''}`}>
                {step > s ? <Check size={12} /> : s}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="alert alert-error" style={{margin:'0 0 16px'}}>{error}</div>}

        {step === 1 && (
          <div className="create-step">
            <div className="step-title">
              <Plane size={22} />
              <div>
                <h3>Name Your Trip</h3>
                <p>Give your adventure an identity</p>
              </div>
            </div>

            <div className="form-group">
              <label>Trip Name *</label>
              <input
                type="text"
                placeholder="e.g. European Summer 2025"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                placeholder="A brief description of your trip..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="form-group">
              <label>Trip Icon</label>
              <div className="emoji-grid">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    type="button"
                    className={`emoji-btn ${emoji === e ? 'selected' : ''}`}
                    onClick={() => setEmoji(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="create-step">
            <div className="step-title">
              <MapPin size={22} />
              <div>
                <h3>Add Destinations</h3>
                <p>Where are you going? Add one or more destinations</p>
              </div>
            </div>

            <div className="dest-add-form card" style={{ padding: 16 }}>
              <div className="form-group">
                <label>Destination</label>
                <PlaceSearchInput
                  value={destForm.name}
                  onChange={(v) => setDestForm({ ...destForm, name: v })}
                  onSelect={(place) => setDestForm({
                    ...destForm,
                    name: place.name,
                    lat: place.lat,
                    lng: place.lng,
                  })}
                  placeholder="Search for a city or country..."
                />
              </div>
              <div className="input-row input-row-2">
                <div className="form-group">
                  <label>Arrival Date</label>
                  <input type="date" value={destForm.start_date} onChange={e => setDestForm({...destForm, start_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Departure Date</label>
                  <input type="date" value={destForm.end_date} onChange={e => setDestForm({...destForm, end_date: e.target.value})} />
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addDestination} disabled={!destForm.name}>
                <Plus size={14} /> Add Destination
              </button>
            </div>

            {destinations.length > 0 ? (
              <div className="dest-list">
                {destinations.map((d, i) => (
                  <div key={d.id} className="dest-item card">
                    <div className="dest-item-num">{i + 1}</div>
                    <div className="dest-item-info">
                      <div className="dest-item-name">{d.name}</div>
                      {(d.start_date || d.end_date) && (
                        <div className="dest-item-dates">
                          {d.start_date && <span>{d.start_date}</span>}
                          {d.start_date && d.end_date && <span> → </span>}
                          {d.end_date && <span>{d.end_date}</span>}
                        </div>
                      )}
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeDestination(d.id)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert alert-info">
                Add at least one destination to continue. You can add more or edit dates later.
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="create-step">
            <div className="step-title">
              <Users size={22} />
              <div>
                <h3>Add Collaborators</h3>
                <p>Invite friends or family to plan together (optional)</p>
              </div>
            </div>

            <div className="form-group">
              <label>Add by Email Address</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  placeholder="friend@example.com"
                  value={collabInput}
                  onChange={e => setCollabInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCollaborator()}
                />
                <button className="btn btn-outline" onClick={addCollaborator}>
                  <Plus size={16} /> Add
                </button>
              </div>
              {collabError && <span style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{collabError}</span>}
            </div>

            {collaborators.length > 0 ? (
              <div className="collab-list">
                {collaborators.map(email => (
                  <div key={email} className="collab-item">
                    <div className="collab-avatar">{email[0].toUpperCase()}</div>
                    <span>{email}</span>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setCollaborators(collaborators.filter(c => c !== email))}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert alert-info">
                No collaborators added. You can always invite people later from the trip settings.
              </div>
            )}

            <div className="create-review">
              <div className="review-item">
                <span className="review-emoji">{emoji}</span>
                <div>
                  <div className="review-name">{name}</div>
                  {description && <div className="review-desc">{description}</div>}
                </div>
              </div>
              {destinations.length > 0 && (
                <div className="review-dests">
                  {destinations.map(d => <span key={d.id} className="badge badge-blue">{d.name}</span>)}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="create-trip-footer">
          {step > 1 && (
            <button className="btn btn-outline" onClick={() => setStep(s => s - 1)}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {step < 3 ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                if (step === 1 && !name.trim()) { setError('Please enter a trip name.'); return; }
                setError('');
                setStep(s => s + 1);
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
              <Sparkles size={16} />
              {loading ? 'Creating...' : 'Create Trip'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
