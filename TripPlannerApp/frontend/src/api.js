// Set VITE_API_URL in frontend/.env to use a LAN IP or ngrok URL for sharing.
// e.g.  VITE_API_URL=http://192.168.1.42:8000
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function authFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('display_name');
    window.location.replace('/login');
    return null;
  }

  return response;
}

export function logout(navigate) {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('display_name');
  navigate('/login', { replace: true });
}

export async function geocode(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'TripPlannerApp/1.0' } }
    );
    return await res.json();
  } catch {
    return [];
  }
}

export async function overpassQuery(query) {
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    return await res.json();
  } catch {
    return { elements: [] };
  }
}

export async function fetchNearbyRestaurants(lat, lng, radius = 1500, dietary = []) {
  const dietFilters = dietary.map(d => {
    const map = { vegan: 'diet:vegan', vegetarian: 'diet:vegetarian', halal: 'diet:halal', kosher: 'diet:kosher' };
    return map[d] || null;
  }).filter(Boolean);

  const query = `[out:json][timeout:25];(node[amenity~"restaurant|cafe|fast_food|bar|food_court"](around:${radius},${lat},${lng});way[amenity~"restaurant|cafe|fast_food|bar|food_court"](around:${radius},${lat},${lng}););out center tags;`;
  const data = await overpassQuery(query);
  return (data.elements || [])
    .filter(el => el.tags?.name)
    .map(el => {
      const tags = el.tags || {};
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      const dietOpts = [];
      if (tags['diet:vegan'] === 'yes' || tags['diet:vegan'] === 'only') dietOpts.push('vegan');
      if (tags['diet:vegetarian'] === 'yes' || tags['diet:vegetarian'] === 'only') dietOpts.push('vegetarian');
      if (tags['diet:halal'] === 'yes') dietOpts.push('halal');
      if (tags['diet:kosher'] === 'yes') dietOpts.push('kosher');
      if (tags['diet:gluten_free'] === 'yes') dietOpts.push('gluten-free');
      return {
        osm_id: String(el.id),
        name: tags.name,
        location: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' ') || '',
        lat: elLat,
        lng: elLng,
        cuisine: tags.cuisine || '',
        website: tags.website || '',
        phone: tags.phone || '',
        opening_hours: tags.opening_hours || '',
        dietary_options: dietOpts,
        manually_reviewed: false,
        selected: false,
      };
    })
    .filter(r => r.lat && r.lng)
    .slice(0, 40);
}
