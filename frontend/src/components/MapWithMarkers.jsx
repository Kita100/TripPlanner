import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useState, useEffect } from 'react';
import { X, MapPin, Globe, Phone, Clock, Star } from 'lucide-react';

// Fix default icons for Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createColorMarker(color, selected = false) {
  const size = selected ? 30 : 24;
  const border = selected ? 4 : 3;
  const pulse = selected ? `box-shadow: 0 0 0 4px ${color}40;` : '';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      width:${size}px;height:${size}px;
      border-radius:50%;
      border:${border}px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      ${pulse}
      transition:all 0.2s;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] != null && center[1] != null) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function MapWithMarkers({
  center = [20, 0],
  zoom = 12,
  markers = [],
  onMarkerClick,
  selectedId,
  renderDetail,
}) {
  const [activeMarker, setActiveMarker] = useState(null);

  const handleClick = (marker) => {
    setActiveMarker(marker);
    onMarkerClick?.(marker);
  };

  return (
    <div className="map-container" style={{ position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FlyTo center={center} zoom={zoom} />

        {markers.map((marker) => {
          if (!marker.lat || !marker.lng) return null;
          const isSelected = marker.id === selectedId || (activeMarker && marker.id === activeMarker.id);
          const icon = createColorMarker(marker.color || '#0ea5e9', isSelected);

          return (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={icon}
              eventHandlers={{ click: () => handleClick(marker) }}
            >
              <Tooltip
                direction="top"
                offset={[0, -12]}
                opacity={1}
                className="custom-tooltip"
              >
                <div className="tooltip-name">{marker.title}</div>
                {marker.subtitle && <div className="tooltip-detail">{marker.subtitle}</div>}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {activeMarker && renderDetail && (
        <div className="map-detail-panel">
          <div className="map-detail-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                {activeMarker.title}
              </div>
              {activeMarker.subtitle && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {activeMarker.subtitle}
                </div>
              )}
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setActiveMarker(null)}>
              <X size={16} />
            </button>
          </div>
          <div className="map-detail-body">
            {renderDetail(activeMarker)}
          </div>
        </div>
      )}
    </div>
  );
}
