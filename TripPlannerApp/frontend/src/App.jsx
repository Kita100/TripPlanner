import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CreateTrip from './pages/CreateTrip';
import TripHub from './pages/TripHub';
import FlightsPage from './pages/FlightsPage';
import ItineraryPage from './pages/ItineraryPage';
import ActivitiesPage from './pages/ActivitiesPage';
import AccommodationPage from './pages/AccommodationPage';
import TransportPage from './pages/TransportPage';
import FoodPage from './pages/FoodPage';
import BudgetPage from './pages/BudgetPage';

import JoinTripPage from './pages/JoinTripPage';
import MobilePage from './pages/MobilePage';
import PaymentsPage from './pages/PaymentsPage';

const Protected = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

const AuthOnly = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/" replace /> : children;
};

function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <span style={{ fontSize: '4rem' }}>🌍</span>
      <h2>404 — Page Not Found</h2>
      <a href="/" style={{ color: 'var(--accent)' }}>Go Home</a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"  element={<AuthOnly><Login /></AuthOnly>} />
        <Route path="/signup" element={<AuthOnly><Signup /></AuthOnly>} />
        <Route path="/"       element={<Protected><Dashboard /></Protected>} />
        <Route path="/trips/new" element={<Protected><CreateTrip /></Protected>} />
        <Route path="/trips/:tripId"              element={<Protected><TripHub /></Protected>} />
        <Route path="/trips/:tripId/flights"      element={<Protected><FlightsPage /></Protected>} />
        <Route path="/trips/:tripId/itinerary"    element={<Protected><ItineraryPage /></Protected>} />
        <Route path="/trips/:tripId/activities"   element={<Protected><ActivitiesPage /></Protected>} />
        <Route path="/trips/:tripId/accommodation" element={<Protected><AccommodationPage /></Protected>} />
        <Route path="/trips/:tripId/transport"    element={<Protected><TransportPage /></Protected>} />
        <Route path="/trips/:tripId/food"         element={<Protected><FoodPage /></Protected>} />
        <Route path="/trips/:tripId/budget"       element={<Protected><BudgetPage /></Protected>} />
        <Route path="/trips/:tripId/mobile"        element={<Protected><MobilePage /></Protected>} />
        <Route path="/trips/:tripId/payments"      element={<Protected><PaymentsPage /></Protected>} />
        <Route path="/join/:token" element={<JoinTripPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
