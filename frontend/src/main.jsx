import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import 'leaflet/dist/leaflet.css';

// StrictMode removed — react-leaflet 4.x double-initialises the map in
// React 18/19 strict mode causing all map pages to crash.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
