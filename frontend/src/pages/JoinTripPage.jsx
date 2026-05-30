import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { API_BASE_URL, authFetch } from '../api';
import { Plane, Users, MapPin, Check } from 'lucide-react';
import './Auth.css';

export default function JoinTripPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/invite/${token}`);
        if (res.ok) {
          setPreview(await res.json());
        } else {
          setError('This invite link is invalid or has expired.');
        }
      } catch {
        setError('Could not connect to the server. The app may not be deployed yet — ask the trip creator for the correct link.');
      } finally {
        setLoading(false);
      }
    };
    loadPreview();
  }, [token]);

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    try {
      const res = await authFetch(`/invite/${token}/join`, { method: 'POST' });
      if (res?.ok) {
        const data = await res.json();
        setJoined(true);
        setTimeout(() => navigate(`/trips/${data.trip_id}`), 1400);
      } else {
        const data = await res.json();
        setError(data.detail || 'Failed to join trip.');
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-logo"><Plane size={32} /></div>
        <h1 className="auth-brand-name">TripPlanner</h1>
        <p className="auth-brand-tagline">You've been invited to join a trip!</p>
      </div>

      <div className="auth-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Loading trip details…</p>
          </div>
        ) : error ? (
          <div>
            <div className="alert alert-error">{error}</div>
            <Link to="/" className="btn btn-outline" style={{ marginTop: 16, display: 'block', textAlign: 'center' }}>
              Go to Dashboard
            </Link>
          </div>
        ) : joined ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Check size={52} style={{ color: '#10b981', margin: '0 auto 12px' }} />
            <h3>You're in! Redirecting…</h3>
          </div>
        ) : (
          <>
            {/* Trip preview */}
            <div style={{ textAlign: 'center', marginBottom: 24, padding: '20px 0' }}>
              <div style={{ fontSize: '4rem', lineHeight: 1, marginBottom: 12 }}>{preview.cover_emoji}</div>
              <h2 style={{ margin: '0 0 6px' }}>{preview.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                Created by <strong>{preview.creator_name}</strong>
                {preview.destination_count > 0 && (
                  <span> &middot; <MapPin size={12} style={{ verticalAlign: 'middle' }} /> {preview.destination_count} destination{preview.destination_count !== 1 ? 's' : ''}</span>
                )}
              </p>
            </div>

            {isLoggedIn ? (
              <>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleJoin}
                  disabled={joining}
                >
                  <Users size={16} /> {joining ? 'Joining…' : 'Accept & Join Trip'}
                </button>
                {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
              </>
            ) : (
              <>
                <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.875rem' }}>
                  Sign in or create an account to join this trip.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link
                    to={`/login?next=/join/${token}`}
                    className="btn btn-primary"
                    style={{ textAlign: 'center', justifyContent: 'center' }}
                  >
                    Sign In
                  </Link>
                  <Link
                    to={`/signup?next=/join/${token}`}
                    className="btn btn-outline"
                    style={{ textAlign: 'center', justifyContent: 'center' }}
                  >
                    Create Account
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
