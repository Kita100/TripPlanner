import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { Mail, Lock, Plane, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

export default function Login() {
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next') || '/';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('username', creds.username);
      form.append('password', creds.password);
      const res = await fetch(`${API_BASE_URL}/token`, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('display_name', data.display_name);
        navigate(nextPath, { replace: true });
      } else {
        setError(data.detail || 'Login failed. Please check your credentials.');
      }
    } catch {
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-logo"><Plane size={32} /></div>
        <h1 className="auth-brand-name">TripPlanner</h1>
        <p className="auth-brand-tagline">Plan your perfect journey</p>
      </div>

      <div className="auth-card">
        <div className="auth-card-header">
          <h2>Welcome back</h2>
          <p>Sign in to continue planning your adventures</p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-icon-wrap">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                placeholder="you@example.com"
                value={creds.username}
                onChange={(e) => setCreds({ ...creds, username: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-icon-wrap">
              <Lock size={16} className="input-icon" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={creds.password}
                onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPass(!showPass)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/signup">Create one</Link>
        </div>

        <div className="auth-demo">
          <span>Demo credentials:</span>
          <code>demo@tripplanner.com / demo123</code>
        </div>
      </div>
    </div>
  );
}
