import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { logout } from '../api';
import { Plane, Calendar, MapPin, Hotel, Train, Utensils, DollarSign, Home, Settings, LogOut, ChevronLeft, Smartphone, CreditCard } from 'lucide-react';
import './TripSidebar.css';

const NAV_ITEMS = [
  { to: '', label: 'Overview', icon: Home },
  { to: '/flights', label: 'Flights', icon: Plane },
  { to: '/itinerary', label: 'Itinerary', icon: Calendar },
  { to: '/activities', label: 'Activities', icon: MapPin },
  { to: '/accommodation', label: 'Accommodation', icon: Hotel },
  { to: '/transport', label: 'Public Transport', icon: Train },
  { to: '/food', label: 'Food & Dining', icon: Utensils },
  { to: '/mobile', label: 'Mobile & eSIM', icon: Smartphone },
  { to: '/payments', label: 'Money & Payments', icon: CreditCard },
  { to: '/budget', label: 'Budget', icon: DollarSign },
];

export default function TripSidebar({ tripName }) {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const location = useLocation();
  const base = `/trips/${tripId}`;

  const isActive = (to) => {
    const full = base + to;
    if (to === '') return location.pathname === base || location.pathname === base + '/';
    return location.pathname.startsWith(full);
  };

  return (
    <aside className="trip-sidebar">
      <div className="sidebar-top">
        <button className="sidebar-back" onClick={() => navigate('/')}>
          <ChevronLeft size={16} />
          All Trips
        </button>
        <div className="sidebar-trip-name">
          <span className="sidebar-trip-icon">✈️</span>
          <span className="sidebar-trip-label">{tripName || 'My Trip'}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={base + to}
            className={`sidebar-link ${isActive(to) ? 'active' : ''}`}
          >
            <Icon size={17} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="sidebar-link sidebar-logout" onClick={() => logout(navigate)}>
          <LogOut size={17} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
