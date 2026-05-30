import { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { geocode } from '../api';

export default function PlaceSearchInput({ value, onChange, onSelect, placeholder = 'Search for a place...' }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange?.(val);
    clearTimeout(timerRef.current);

    if (val.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const data = await geocode(val);
      setResults(data);
      setOpen(data.length > 0);
      setLoading(false);
    }, 300);
  };

  const handleSelect = (item) => {
    const name = item.display_name.split(',').slice(0, 2).join(',').trim();
    setQuery(item.display_name);
    setOpen(false);
    setResults([]);
    onSelect?.({
      name,
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    });
  };

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          style={{ paddingLeft: '36px' }}
        />
        <MapPin
          size={16}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}
        />
      </div>

      {open && (
        <div className="autocomplete-dropdown">
          {results.map((item) => {
            const parts = item.display_name.split(',');
            const main = parts[0];
            const sub = parts.slice(1, 3).join(',').trim();
            return (
              <div
                key={item.place_id}
                className="autocomplete-item"
                onMouseDown={() => handleSelect(item)}
              >
                <MapPin size={14} style={{ color: 'var(--text-light)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="autocomplete-item-main">{main}</div>
                  {sub && <div className="autocomplete-item-sub">{sub}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
