import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Smartphone, Plus, X, Edit2, CheckCircle, Clock, Wifi, AlertTriangle, ExternalLink, DollarSign } from 'lucide-react';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import Modal from '../components/Modal';
import './MobilePage.css';

// ---------------------------------------------------------------------------
// Curated eSIM data by destination keyword
// ---------------------------------------------------------------------------
const ESIM_CURATED = {
  japan: {
    label: 'Japan',
    coverage: 'Excellent',
    coverageNote: '4G/LTE everywhere including rural areas. 5G in major cities.',
    providers: [
      {
        name: 'Airalo — Moshi Moshi',
        price: 'From ~$9 AUD',
        data: '1 GB / 7 days',
        link: 'https://www.airalo.com',
        note: 'Most popular option for travellers. Easy QR code activation.',
        recommended: true,
      },
      {
        name: 'IIJmio Tourist eSIM',
        price: 'From ~$15 AUD',
        data: '15 GB / 15 days',
        link: 'https://www.iijmio.jp/en/',
        note: 'Great value for longer stays. IIJ uses Docomo network (best coverage).',
        recommended: false,
      },
      {
        name: 'Holafly Japan',
        price: 'From ~$25 AUD',
        data: 'Unlimited / 5 days',
        link: 'https://esim.holafly.com',
        note: 'Unlimited data if you want peace of mind. Uses SoftBank network.',
        recommended: false,
      },
      {
        name: 'Nomad Japan',
        price: 'From ~$12 AUD',
        data: '3 GB / 30 days',
        link: 'https://www.getnomad.app',
        note: 'Good for longer trips with moderate data use.',
        recommended: false,
      },
    ],
    tips: [
      'Activate your eSIM BEFORE leaving Australia — airport Wi-Fi is unreliable.',
      'Google Maps works perfectly. Download offline maps for Tokyo/Osaka as backup.',
      'Free Wi-Fi is widely available at convenience stores (7-Eleven, FamilyMart).',
      'Pocket Wi-Fi rental is an alternative to eSIM — pick up/drop off at the airport.',
      'LINE is the main messaging app in Japan — download it to contact locals.',
      'Emergency: 110 (police), 119 (ambulance/fire). No data needed.',
    ],
  },
  china: {
    label: 'China',
    coverage: 'Good',
    coverageNote: 'Excellent 4G coverage. However Google, WhatsApp, Instagram are BLOCKED — set up a VPN before arriving.',
    providers: [
      {
        name: 'Airalo — ChinaUnicom',
        price: 'From ~$18 AUD',
        data: '1 GB / 30 days',
        link: 'https://www.airalo.com',
        note: 'Works on China Unicom network. Buy a VPN first — activate before arrival.',
        recommended: true,
      },
      {
        name: 'Nomad China',
        price: 'From ~$22 AUD',
        data: '3 GB / 30 days',
        link: 'https://www.getnomad.app',
        note: 'Solid option. Note: eSIM data does NOT bypass the Great Firewall — you still need a VPN app installed beforehand.',
        recommended: false,
      },
      {
        name: 'Holafly China',
        price: 'From ~$30 AUD',
        data: 'Unlimited / 5 days',
        link: 'https://esim.holafly.com',
        note: 'Unlimited data plan. VPN still required for most western apps.',
        recommended: false,
      },
    ],
    tips: [
      '🔴 CRITICAL: Install and test your VPN BEFORE arriving in China — the App Store is blocked once you are on a Chinese network.',
      'Recommended VPNs: ExpressVPN, NordVPN, Astrill. Buy a subscription before you go.',
      'WeChat and Alipay require setup before arrival — do this from Australia.',
      'Download Google Maps offline maps and Apple Maps for China before arriving.',
      'Baidu Maps works without a VPN and is often more accurate for local navigation.',
      'China Mobile, China Unicom, and China Telecom all have solid coverage.',
      'Emergency: 110 (police), 120 (ambulance), 119 (fire). No data needed.',
    ],
  },
  thailand: {
    label: 'Thailand',
    coverage: 'Very Good',
    coverageNote: 'Excellent 4G in cities and tourist areas. More patchy in mountains/rural north.',
    providers: [
      {
        name: 'Airalo — DTAC/True Move',
        price: 'From ~$8 AUD',
        data: '1 GB / 7 days',
        link: 'https://www.airalo.com',
        note: 'Budget-friendly. True Move H has the best overall coverage in Thailand.',
        recommended: true,
      },
      {
        name: 'Holafly Thailand',
        price: 'From ~$20 AUD',
        data: 'Unlimited / 5 days',
        link: 'https://esim.holafly.com',
        note: 'Good for heavy data users. Stream maps without worrying about limits.',
        recommended: false,
      },
      {
        name: 'Nomad Thailand',
        price: 'From ~$10 AUD',
        data: '3 GB / 30 days',
        link: 'https://www.getnomad.app',
        note: 'Great value for a month-long trip.',
        recommended: false,
      },
    ],
    tips: [
      'Physical SIM cards from AIS or True Move H are also very cheap at the airport (from ~$10 AUD for 15GB/30 days).',
      'Line app is popular in Thailand for messaging locals.',
      'Grab is the main ride-share app — works perfectly with data.',
      'Most hotels, restaurants, and cafés have free Wi-Fi.',
      'Emergency: 191 (police), 1669 (ambulance), 199 (fire).',
    ],
  },
  bali: {
    label: 'Bali / Indonesia',
    coverage: 'Good',
    coverageNote: '4G in Bali is reliable. More rural areas of Indonesia have spottier coverage.',
    providers: [
      {
        name: 'Airalo — Telkomsel',
        price: 'From ~$8 AUD',
        data: '1 GB / 7 days',
        link: 'https://www.airalo.com',
        note: 'Telkomsel has the best coverage in Indonesia including Bali.',
        recommended: true,
      },
      {
        name: 'Holafly Indonesia',
        price: 'From ~$18 AUD',
        data: 'Unlimited / 5 days',
        link: 'https://esim.holafly.com',
        note: 'Unlimited plan for heavy data use.',
        recommended: false,
      },
    ],
    tips: [
      'Physical SIMs from Telkomsel are available at the airport for ~$5 AUD.',
      'Gojek is the main ride-share and food delivery app.',
      'WhatsApp is the main communication app in Indonesia.',
      'Emergency: 110 (police), 118 (ambulance), 113 (fire).',
    ],
  },
  usa: {
    label: 'USA',
    coverage: 'Excellent',
    coverageNote: 'Excellent 5G/LTE coverage in cities. Rural areas (national parks, Montana, etc.) can have no signal.',
    providers: [
      {
        name: 'T-Mobile Tourist Plan (via Airalo)',
        price: 'From ~$25 AUD',
        data: 'Unlimited / 21 days',
        link: 'https://www.airalo.com',
        note: 'T-Mobile has the most widespread coverage for visitors. Best for road trips.',
        recommended: true,
      },
      {
        name: 'Holafly USA',
        price: 'From ~$30 AUD',
        data: 'Unlimited / 7 days',
        link: 'https://esim.holafly.com',
        note: 'Good unlimited option for city-focused trips.',
        recommended: false,
      },
      {
        name: 'Nomad USA',
        price: 'From ~$15 AUD',
        data: '3 GB / 30 days',
        link: 'https://www.getnomad.app',
        note: 'Budget option for moderate data use.',
        recommended: false,
      },
    ],
    tips: [
      'Download Google Maps offline maps for national parks — no signal in many areas.',
      'AT&T and Verizon also have strong coverage — check Airalo for those options.',
      'Google Pay and Apple Pay work almost everywhere.',
      'Emergency: 911 (police/ambulance/fire). Works without data or signal.',
    ],
  },
  uk: {
    label: 'United Kingdom',
    coverage: 'Excellent',
    coverageNote: 'Excellent 4G/5G in cities. Some rural Scotland/Wales areas have gaps.',
    providers: [
      {
        name: 'Airalo — Bnesim UK',
        price: 'From ~$8 AUD',
        data: '1 GB / 7 days',
        link: 'https://www.airalo.com',
        note: 'Affordable entry option. Uses EE or O2 network.',
        recommended: true,
      },
      {
        name: 'Holafly UK',
        price: 'From ~$22 AUD',
        data: 'Unlimited / 5 days',
        link: 'https://esim.holafly.com',
        note: 'Good for heavy streaming/navigation. Uses Three network.',
        recommended: false,
      },
    ],
    tips: [
      'Free Wi-Fi is widely available in pubs, cafés, and public transport.',
      'Download Citymapper for London navigation — better than Google Maps for tube.',
      'Emergency: 999 (police/ambulance/fire), 112 (EU standard also works).',
    ],
  },
  europe: {
    label: 'Europe',
    coverage: 'Excellent',
    coverageNote: 'Excellent throughout Western Europe. Coverage drops slightly in Eastern Europe and rural areas.',
    providers: [
      {
        name: 'Airalo — Europe Regional eSIM',
        price: 'From ~$20 AUD',
        data: '3 GB / 30 days (30+ countries)',
        link: 'https://www.airalo.com',
        note: 'One eSIM that works across most of Europe. Best value for multi-country trips.',
        recommended: true,
      },
      {
        name: 'Holafly Europe',
        price: 'From ~$35 AUD',
        data: 'Unlimited / 7 days',
        link: 'https://esim.holafly.com',
        note: 'Unlimited across 30+ European countries. Great for heavy users.',
        recommended: false,
      },
      {
        name: 'Nomad Europe',
        price: 'From ~$18 AUD',
        data: '3 GB / 30 days',
        link: 'https://www.getnomad.app',
        note: 'Competitive regional plan.',
        recommended: false,
      },
    ],
    tips: [
      'A single regional eSIM is much easier than buying per-country.',
      'Free Wi-Fi is available in most cafés, hotels, and train stations.',
      'Emergency: 112 works across all EU countries (police/ambulance/fire).',
      'Download offline maps for each country — roaming between countries means signal gaps.',
    ],
  },
  singapore: {
    label: 'Singapore',
    coverage: 'Excellent',
    coverageNote: 'One of the best mobile networks in the world. Full 5G coverage island-wide.',
    providers: [
      {
        name: 'Airalo — Singtel/StarHub',
        price: 'From ~$7 AUD',
        data: '1 GB / 7 days',
        link: 'https://www.airalo.com',
        note: 'Singapore has world-class coverage — even a cheap plan is fine.',
        recommended: true,
      },
      {
        name: 'Holafly Singapore',
        price: 'From ~$18 AUD',
        data: 'Unlimited / 5 days',
        link: 'https://esim.holafly.com',
        note: 'Unlimited option for heavy streaming.',
        recommended: false,
      },
    ],
    tips: [
      'Free Wi-Fi is available almost everywhere — Changi Airport, malls, MRT stations.',
      'Singtel has the best coverage but all major carriers are excellent.',
      'Grab is the dominant ride-share app — essential for getting around.',
      'Emergency: 999 (police), 995 (ambulance/fire).',
    ],
  },
  korea: {
    label: 'South Korea',
    coverage: 'Excellent',
    coverageNote: 'World-class 5G coverage throughout the country, including rural areas.',
    providers: [
      {
        name: 'Airalo — KT/SK Telecom',
        price: 'From ~$9 AUD',
        data: '1 GB / 7 days',
        link: 'https://www.airalo.com',
        note: 'KT has the best coverage. Very fast speeds.',
        recommended: true,
      },
      {
        name: 'Holafly South Korea',
        price: 'From ~$22 AUD',
        data: 'Unlimited / 5 days',
        link: 'https://esim.holafly.com',
        note: 'Unlimited for heavy users. KakaoTalk works over data.',
        recommended: false,
      },
    ],
    tips: [
      'Download KakaoTalk — essential for messaging locals.',
      'Naver Maps is better than Google Maps for Korea — download it.',
      'Free Wi-Fi in almost every café and public space.',
      'Emergency: 112 (police), 119 (ambulance/fire).',
    ],
  },
  vietnam: {
    label: 'Vietnam',
    coverage: 'Good',
    coverageNote: 'Good 4G in cities (Hanoi, HCMC, Da Nang). Rural/mountainous areas have limited coverage.',
    providers: [
      {
        name: 'Airalo — Viettel',
        price: 'From ~$7 AUD',
        data: '1 GB / 7 days',
        link: 'https://www.airalo.com',
        note: 'Viettel has the best rural coverage in Vietnam.',
        recommended: true,
      },
      {
        name: 'Holafly Vietnam',
        price: 'From ~$16 AUD',
        data: 'Unlimited / 5 days',
        link: 'https://esim.holafly.com',
        note: 'Good for city stays.',
        recommended: false,
      },
    ],
    tips: [
      'Physical SIMs from Viettel are very cheap at the airport (~$5 AUD for 4GB/30 days).',
      'Grab works in all major cities — use it for rides and food.',
      'Facebook and Messenger are widely used in Vietnam.',
      'Emergency: 113 (police), 115 (ambulance), 114 (fire).',
    ],
  },
};

const DEST_KEY_MAP = [
  { keywords: ['japan', 'tokyo', 'osaka', 'kyoto', 'hiroshima', 'fukuoka', 'sapporo', 'okinawa', 'nara'], key: 'japan' },
  { keywords: ['china', 'beijing', 'shanghai', 'guangzhou', 'shenzhen', 'chengdu', 'xi\'an', 'xian', 'hangzhou'], key: 'china' },
  { keywords: ['thailand', 'bangkok', 'chiang mai', 'phuket', 'ko samui', 'koh samui', 'pattaya', 'hua hin'], key: 'thailand' },
  { keywords: ['bali', 'indonesia', 'jakarta', 'lombok', 'yogyakarta', 'ubud', 'seminyak', 'kuta'], key: 'bali' },
  { keywords: ['usa', 'united states', 'new york', 'los angeles', 'las vegas', 'san francisco', 'chicago', 'miami', 'hawaii'], key: 'usa' },
  { keywords: ['uk', 'united kingdom', 'england', 'london', 'scotland', 'wales', 'ireland', 'edinburgh', 'manchester'], key: 'uk' },
  { keywords: ['europe', 'paris', 'france', 'italy', 'rome', 'barcelona', 'spain', 'germany', 'berlin', 'amsterdam', 'netherlands', 'prague', 'vienna', 'portugal', 'lisbon', 'athens', 'greece', 'swiss', 'switzerland'], key: 'europe' },
  { keywords: ['singapore'], key: 'singapore' },
  { keywords: ['korea', 'south korea', 'seoul', 'busan', 'jeju'], key: 'korea' },
  { keywords: ['vietnam', 'hanoi', 'ho chi minh', 'hcmc', 'da nang', 'hoi an', 'nha trang'], key: 'vietnam' },
];

function getDestKey(name) {
  const lower = name.toLowerCase();
  for (const { keywords, key } of DEST_KEY_MAP) {
    if (keywords.some(k => lower.includes(k))) return key;
  }
  return null;
}

const STATUS_META = {
  planned:   { label: 'Planned',   color: '#94a3b8', bg: '#f1f5f9' },
  purchased: { label: 'Purchased', color: '#0ea5e9', bg: '#e0f2fe' },
  active:    { label: 'Active',    color: '#22c55e', bg: '#dcfce7' },
  used:      { label: 'Used',      color: '#8b5cf6', bg: '#f3e8ff' },
  expired:   { label: 'Expired',   color: '#ef4444', bg: '#fee2e2' },
};

const EMPTY_FORM = {
  provider: '', coverage: '', data_gb: '', validity_days: '',
  price: '', currency: 'AUD', purchased_date: '', activation_date: '',
  status: 'planned', notes: '', website: '', iccid: '', paid: false,
  destination_id: '',
};

export default function MobilePage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [activeDestIdx, setActiveDestIdx] = useState(0);
  const [esims, setEsims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEsim, setEditEsim] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tripRes, destRes, esimRes] = await Promise.all([
      authFetch(`/trips/${tripId}`),
      authFetch(`/trips/${tripId}/destinations`),
      authFetch(`/trips/${tripId}/esims`),
    ]);
    if (tripRes?.ok) setTrip(await tripRes.json());
    if (destRes?.ok) setDestinations(await destRes.json());
    if (esimRes?.ok) setEsims(await esimRes.json());
    setLoading(false);
  }, [tripId]);

  useEffect(() => { loadData(); }, [loadData]);

  const activeDest = destinations[activeDestIdx];
  const curatedKey = activeDest ? getDestKey(activeDest.name) : null;
  const curatedData = curatedKey ? ESIM_CURATED[curatedKey] : null;

  const openAdd = () => {
    setEditEsim(null);
    setForm({ ...EMPTY_FORM, destination_id: activeDest?.id || '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (e) => {
    setEditEsim(e);
    setForm({
      provider: e.provider || '',
      coverage: e.coverage || '',
      data_gb: e.data_gb ?? '',
      validity_days: e.validity_days ?? '',
      price: e.price ?? '',
      currency: e.currency || 'AUD',
      purchased_date: e.purchased_date || '',
      activation_date: e.activation_date || '',
      status: e.status || 'planned',
      notes: e.notes || '',
      website: e.website || '',
      iccid: e.iccid || '',
      paid: e.paid || false,
      destination_id: e.destination_id || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const saveEsim = async () => {
    if (!form.provider.trim()) { setFormError('Provider name is required.'); return; }
    setSaving(true);
    setFormError('');
    const body = {
      ...form,
      data_gb: form.data_gb !== '' ? parseFloat(form.data_gb) : null,
      validity_days: form.validity_days !== '' ? parseInt(form.validity_days) : null,
      price: form.price !== '' ? parseFloat(form.price) : 0,
    };
    try {
      let res;
      if (editEsim) {
        res = await authFetch(`/trips/${tripId}/esims/${editEsim.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        res = await authFetch(`/trips/${tripId}/esims`, { method: 'POST', body: JSON.stringify(body) });
      }
      if (res?.ok) {
        setShowModal(false);
        loadData();
      } else {
        const data = await res?.json().catch(() => ({}));
        setFormError(data?.detail || 'Failed to save. Is the backend running?');
      }
    } catch {
      setFormError('Network error — check the backend is running.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEsim = async (id) => {
    if (!confirm('Delete this eSIM?')) return;
    await authFetch(`/trips/${tripId}/esims/${id}`, { method: 'DELETE' });
    loadData();
  };

  const togglePaid = async (e) => {
    await authFetch(`/trips/${tripId}/esims/${e.id}`, {
      method: 'PUT',
      body: JSON.stringify({ paid: !e.paid }),
    });
    setEsims(prev => prev.map(x => x.id === e.id ? { ...x, paid: !x.paid } : x));
  };

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalCost = esims.reduce((s, e) => s + (e.price || 0), 0);
  const paidCost = esims.filter(e => e.paid).reduce((s, e) => s + (e.price || 0), 0);

  if (loading) return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content"><div className="page-main"><div className="page-loading">Loading…</div></div></div>
    </div>
  );

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="mobile-page">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title"><Smartphone size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Mobile &amp; eSIM</h1>
            <p className="page-subtitle">Connectivity recommendations and eSIM tracker</p>
          </div>
        </div>

        {/* Destination tabs */}
        {destinations.length > 0 && (
          <div className="dest-tabs">
            {destinations.map((d, i) => (
              <button
                key={d.id}
                className={`dest-tab${i === activeDestIdx ? ' active' : ''}`}
                onClick={() => setActiveDestIdx(i)}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}

        {/* Curated recommendations */}
        {activeDest && (
          <section className="card mobile-section">
            <h2 className="card-title" style={{ marginBottom: 4 }}>
              <Wifi size={17} style={{ marginRight: 6 }} />
              eSIM Recommendations for {activeDest.name}
            </h2>
            {curatedData ? (
              <>
                <div className={`coverage-badge coverage-${curatedData.coverage.toLowerCase().replace(' ', '-')}`}>
                  <CheckCircle size={13} /> {curatedData.coverage} Coverage — {curatedData.coverageNote}
                </div>
                <div className="provider-grid">
                  {curatedData.providers.map((p, i) => (
                    <div key={i} className={`provider-card${p.recommended ? ' recommended' : ''}`}>
                      {p.recommended && <div className="rec-badge">⭐ Recommended</div>}
                      <div className="provider-name">{p.name}</div>
                      <div className="provider-meta">
                        <span className="provider-price">{p.price}</span>
                        <span className="provider-data">{p.data}</span>
                      </div>
                      <p className="provider-note">{p.note}</p>
                      <a href={p.link} target="_blank" rel="noopener noreferrer" className="provider-link">
                        <ExternalLink size={13} /> Visit site
                      </a>
                    </div>
                  ))}
                </div>
                <div className="tips-box">
                  <div className="tips-title"><AlertTriangle size={14} /> Tips for {curatedData.label}</div>
                  <ul className="tips-list">
                    {curatedData.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                  </ul>
                </div>
              </>
            ) : (
              <p className="no-curated">No curated eSIM data for "{activeDest.name}" yet — check <a href="https://www.airalo.com" target="_blank" rel="noopener noreferrer">Airalo</a> or <a href="https://esim.holafly.com" target="_blank" rel="noopener noreferrer">Holafly</a> for options.</p>
            )}
          </section>
        )}

        {/* My eSIMs tracker */}
        <section className="card mobile-section">
          <div className="card-header">
            <h2 className="card-title"><Smartphone size={17} /> My eSIMs</h2>
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              <Plus size={14} /> Add eSIM
            </button>
          </div>

          {esims.length > 0 && (
            <div className="esim-budget-summary">
              <DollarSign size={14} />
              Total: <strong>${totalCost.toFixed(2)} AUD</strong>
              {' · '}
              <span style={{ color: '#22c55e' }}>Paid: ${paidCost.toFixed(2)}</span>
              {' · '}
              <span style={{ color: '#ef4444' }}>Unpaid: ${(totalCost - paidCost).toFixed(2)}</span>
            </div>
          )}

          {esims.length === 0 ? (
            <p className="empty-state">No eSIMs added yet. Add one to track your connectivity costs.</p>
          ) : (
            <div className="esim-list">
              {esims.map(e => {
                const st = STATUS_META[e.status] || STATUS_META.planned;
                return (
                  <div key={e.id} className="esim-card">
                    <div className="esim-card-top">
                      <div className="esim-card-info">
                        <div className="esim-provider">{e.provider}</div>
                        {e.coverage && <div className="esim-coverage">{e.coverage}</div>}
                      </div>
                      <div className="esim-card-actions">
                        <span className="esim-status-badge" style={{ color: st.color, background: st.bg }}>
                          {st.label}
                        </span>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(e)} title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteEsim(e.id)} title="Delete">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="esim-card-meta">
                      {e.data_gb && <span>{e.data_gb} GB</span>}
                      {e.validity_days && <span>{e.validity_days} days</span>}
                      {e.purchased_date && <span>Bought: {e.purchased_date}</span>}
                      {e.activation_date && <span>Activates: {e.activation_date}</span>}
                      {e.iccid && <span className="esim-iccid">ICCID: {e.iccid}</span>}
                    </div>
                    {e.notes && <div className="esim-notes">{e.notes}</div>}
                    <div className="esim-card-footer">
                      <span className="esim-price">{e.price ? `$${e.price} ${e.currency}` : 'Free'}</span>
                      <button
                        className={`btn btn-sm ${e.paid ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => togglePaid(e)}
                      >
                        {e.paid ? <CheckCircle size={13} /> : <Clock size={13} />}
                        {e.paid ? 'Paid' : 'Mark Paid'}
                      </button>
                      {e.website && (
                        <a href={e.website} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                          <ExternalLink size={13} /> Site
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal
          title={editEsim ? 'Edit eSIM' : 'Add eSIM'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEsim} disabled={saving}>
                {saving ? 'Saving…' : editEsim ? 'Save' : 'Add eSIM'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {formError && <div className="form-error">{formError}</div>}
            {destinations.length > 0 && (
              <div className="form-group">
                <label>Destination</label>
                <select value={form.destination_id} onChange={e => setField('destination_id', e.target.value)}>
                  <option value="">All destinations</option>
                  {destinations.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Provider *</label>
              <input
                value={form.provider}
                onChange={e => setField('provider', e.target.value)}
                placeholder="e.g. Airalo, Holafly, Nomad"
              />
            </div>
            <div className="form-group">
              <label>Coverage / Region</label>
              <input
                value={form.coverage}
                onChange={e => setField('coverage', e.target.value)}
                placeholder="e.g. Japan, Europe, Southeast Asia"
              />
            </div>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Data (GB)</label>
                <input type="number" min="0" step="0.1" value={form.data_gb} onChange={e => setField('data_gb', e.target.value)} placeholder="e.g. 3" />
              </div>
              <div className="form-group">
                <label>Validity (days)</label>
                <input type="number" min="1" value={form.validity_days} onChange={e => setField('validity_days', e.target.value)} placeholder="e.g. 30" />
              </div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Price</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={e => setField('price', e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select value={form.currency} onChange={e => setField('currency', e.target.value)}>
                  <option>AUD</option><option>USD</option><option>GBP</option>
                  <option>EUR</option><option>JPY</option><option>SGD</option><option>THB</option>
                </select>
              </div>
            </div>
            <div className="input-row input-row-2">
              <div className="form-group">
                <label>Purchase Date</label>
                <input type="date" value={form.purchased_date} onChange={e => setField('purchased_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Activation Date</label>
                <input type="date" value={form.activation_date} onChange={e => setField('activation_date', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="planned">Planned</option>
                <option value="purchased">Purchased</option>
                <option value="active">Active</option>
                <option value="used">Used</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="form-group">
              <label>ICCID / QR Reference</label>
              <input value={form.iccid} onChange={e => setField('iccid', e.target.value)} placeholder="eSIM code or reference number" />
            </div>
            <div className="form-group">
              <label>Website / Purchase Link</label>
              <input type="url" value={form.website} onChange={e => setField('website', e.target.value)} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any notes about this eSIM…" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={form.paid} onChange={e => setField('paid', e.target.checked)} />
              Already paid
            </label>
          </div>
        </Modal>
      )}
        </div>
      </div>
    </div>
  );
}
