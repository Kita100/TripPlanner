import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import { DollarSign, Check, Plane, Hotel, MapPin, Utensils, Calendar, TrendingUp, Lightbulb, ChevronDown, Star, Wifi } from 'lucide-react';
import './BudgetPage.css';

const CATEGORY_ICONS = {
  flights: <Plane size={15} />,
  accommodation: <Hotel size={15} />,
  travel_package: <Star size={15} />,
  activities: <MapPin size={15} />,
  itinerary: <Calendar size={15} />,
  food: <Utensils size={15} />,
  connectivity: <Wifi size={15} />,
};

const CATEGORY_COLORS = {
  flights: '#0ea5e9',
  accommodation: '#f59e0b',
  travel_package: '#d97706',
  activities: '#8b5cf6',
  itinerary: '#10b981',
  food: '#ef4444',
  connectivity: '#06b6d4',
};

const CATEGORY_LABELS = {
  flights: 'Flights',
  accommodation: 'Accommodation',
  travel_package: 'Travel Package',
  activities: 'Activities',
  itinerary: 'Itinerary',
  food: 'Food',
  connectivity: 'Connectivity (eSIM)',
};

const SAVINGS_TIPS = [
  'Book flights at least 6–8 weeks in advance for the best fares.',
  'Travel mid-week (Tuesday–Thursday) for cheaper flights.',
  'Consider nearby airports — they can be significantly cheaper.',
  'Use free cancellation hotel bookings so you can rebook if prices drop.',
  'Accommodation in city outskirts + public transport is often cheaper than central hotels.',
  'Get a local SIM or e-SIM for data — avoid expensive roaming charges.',
  'Look for city tourist passes that bundle transport + attraction entry.',
  'Grocery stores and local markets are great for cheap, authentic meals.',
  'Many museums have free entry on specific days or evenings.',
  'Travel insurance is worth it — it can save you thousands if plans change.',
  'Use a travel credit card to avoid foreign transaction fees.',
  'Download offline maps before arrival to avoid data costs.',
];

export default function BudgetPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState(null);

  useEffect(() => { loadData(); }, [tripId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tripRes, budgetRes] = await Promise.all([
        authFetch(`/trips/${tripId}`),
        authFetch(`/trips/${tripId}/budget`),
      ]);
      if (tripRes?.ok) setTrip(await tripRes.json());
      if (budgetRes?.ok) setBudget(await budgetRes.json());
    } finally { setLoading(false); }
  };

  const fmt = (n) => `A$${(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) return <div className="page-layout"><div className="loading-overlay" style={{ flex: 1 }}><div className="loading-spinner" /></div></div>;

  const total = budget?.total || 0;
  const paid = budget?.paid || 0;
  const remaining = total - paid;
  const paidPct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  const allItems = budget?.items || [];
  const byCategory = budget?.by_category || {};
  const byDestination = budget?.by_destination || {};

  const destinations = trip?.destinations || [];

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="page-header">
            <div className="page-header-left">
              <h1 className="page-title"><DollarSign size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Budget &amp; Costs</h1>
              <p className="page-subtitle">Track all trip expenses and see what's been paid</p>
            </div>
            <button className="btn btn-outline" onClick={loadData}>↻ Refresh</button>
          </div>

          {/* Summary cards */}
          <div className="budget-summary-grid">
            <div className="budget-summary-card total">
              <div className="budget-summary-icon"><TrendingUp size={22} /></div>
              <div>
                <div className="budget-summary-label">Total Trip Cost</div>
                <div className="budget-summary-amount">{fmt(total)}</div>
              </div>
            </div>
            <div className="budget-summary-card paid">
              <div className="budget-summary-icon"><Check size={22} /></div>
              <div>
                <div className="budget-summary-label">Paid</div>
                <div className="budget-summary-amount">{fmt(paid)}</div>
              </div>
            </div>
            <div className="budget-summary-card remaining">
              <div className="budget-summary-icon"><DollarSign size={22} /></div>
              <div>
                <div className="budget-summary-label">Still to Pay</div>
                <div className="budget-summary-amount">{fmt(remaining)}</div>
              </div>
            </div>
          </div>

          {total > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Payment Progress</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{paidPct.toFixed(0)}% paid</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${paidPct}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>{fmt(paid)} paid</span>
                <span>{fmt(remaining)} remaining</span>
              </div>
            </div>
          )}

          <div className="budget-main-grid">
            <div>
              {/* Category breakdown */}
              <div className="card" style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 16 }}>By Category</h3>
                {Object.keys(byCategory).length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: 20 }}>
                    No costs tracked yet. Add flights, accommodation, activities, and itinerary items.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Object.entries(byCategory).map(([cat, catData]) => {
                      const catTotal = catData.total || 0;
                      const catPaid = catData.paid || 0;
                      const catPct = catTotal > 0 ? (catPaid / catTotal) * 100 : 0;
                      const isOpen = expandedCategory === cat;
                      const catItems = allItems.filter(i => i.category === cat);
                      return (
                        <div key={cat} className="category-row">
                          <div className="category-row-header" onClick={() => setExpandedCategory(isOpen ? null : cat)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="category-icon-badge" style={{ background: CATEGORY_COLORS[cat] + '20', color: CATEGORY_COLORS[cat] }}>
                                {CATEGORY_ICONS[cat] || <DollarSign size={15} />}
                              </span>
                              <span style={{ fontWeight: 600 }}>{CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                              {catItems.length > 0 && <span className="badge badge-gray">{catItems.length}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span className="category-amount">{fmt(catTotal)}</span>
                              <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                            </div>
                          </div>
                          <div className="progress-bar sm">
                            <div className="progress-bar-fill" style={{ width: `${catPct}%`, background: CATEGORY_COLORS[cat] }} />
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{fmt(catPaid)} paid of {fmt(catTotal)}</div>
                          {isOpen && catItems.length > 0 && (
                            <div className="category-items">
                              {catItems.map((item, i) => (
                                <ItemRow key={i} item={item} catColor={CATEGORY_COLORS[cat]} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* By destination */}
              {Object.keys(byDestination).length > 1 && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <h3 style={{ marginBottom: 16 }}>By Destination</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(byDestination).map(([dest, destData]) => (
                      <div key={dest} className="dest-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={13} /><span>{dest}</span></div>
                        <div style={{ fontWeight: 700 }}>{fmt(destData.total || 0)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All items table */}
              {allItems.length > 0 && (
                <div className="card">
                  <h3 style={{ marginBottom: 14 }}>All Items ({allItems.length})</h3>
                  <div className="budget-table">
                    <div className="budget-table-header">
                      <div>Item</div>
                      <div>Category</div>
                      <div>Destination</div>
                      <div>Amount</div>
                      <div>Status</div>
                    </div>
                    {allItems.map((item, i) => (
                      <div key={i} className="budget-table-row">
                        <div className="item-name">{item.name}</div>
                        <div>
                          <span className="badge" style={{ background: (CATEGORY_COLORS[item.category] || '#94a3b8') + '20', color: CATEGORY_COLORS[item.category] || '#94a3b8' }}>
                            {CATEGORY_LABELS[item.category] || item.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.destination || '—'}</div>
                        <div className="item-amount">{fmt(item.price)}</div>
                        <div>
                          <span className={`paid-badge ${item.paid ? 'paid' : 'unpaid'}`} style={{ fontSize: '0.72rem' }}>
                            {item.paid ? <><Check size={10} /> Paid</> : 'Unpaid'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Savings tips */}
            <div>
              <div className="card savings-tips-card">
                <h3 style={{ marginBottom: 16 }}><Lightbulb size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Money-Saving Tips</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {SAVINGS_TIPS.map((tip, i) => (
                    <div key={i} className="savings-tip">
                      <span className="tip-icon">💡</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {destinations.length > 0 && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h4 style={{ marginBottom: 10 }}>Destination Budgets</h4>
                  {destinations.map(d => {
                    const destCosts = byDestination[d.name] || {};
                    return (
                      <div key={d.id} className="dest-budget-row">
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {destCosts.total ? fmt(destCosts.total) : 'No costs yet'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item, catColor }) {
  return (
    <div className="item-expanded-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
        <span style={{ fontSize: '0.83rem' }}>{item.name}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>{`A$${(item.price || 0).toFixed(2)}`}</span>
        <span className={`paid-badge ${item.paid ? 'paid' : 'unpaid'}`} style={{ fontSize: '0.7rem' }}>{item.paid ? 'Paid' : 'Unpaid'}</span>
      </div>
    </div>
  );
}
