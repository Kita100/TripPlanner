import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CreditCard, Banknote, Smartphone, AlertTriangle, CheckCircle, ExternalLink, Info } from 'lucide-react';
import { authFetch } from '../api';
import TripSidebar from '../components/TripSidebar';
import './PaymentsPage.css';

// ---------------------------------------------------------------------------
// Curated payment data by destination keyword
// ---------------------------------------------------------------------------
const PAYMENT_DATA = {
  japan: {
    label: 'Japan',
    summary: 'Japan is still largely a cash society, though card acceptance is growing fast. Always carry yen.',
    methods: [
      { name: 'Cash (JPY)', icon: '💴', status: 'essential', note: 'Many small restaurants, shrines, markets, and local shops are cash-only. Carry at least ¥10,000–¥20,000 at all times.' },
      { name: 'IC Cards (Suica / Pasmo)', icon: '🚆', status: 'recommended', note: 'Top up at any train station. Use for trains, buses, and convenience stores. Load via Apple Wallet (Suica) or physical card.' },
      { name: 'Visa / Mastercard', icon: '💳', status: 'accepted', note: 'Accepted at hotels, department stores, and larger restaurants. Not reliable for smaller places.' },
      { name: 'Apple Pay / Google Pay', icon: '📱', status: 'growing', note: 'Increasingly accepted via iD or QUICPay. Load Suica into Apple Wallet for seamless transport payments.' },
      { name: 'PayPay', icon: '📲', status: 'local', note: 'Japan\'s dominant QR payment app. International visitors can now sign up with a foreign card. Great for convenience stores and restaurants.' },
    ],
    apps: [
      { name: 'Suica (via Apple/Google Wallet)', note: 'Load on your phone before arriving. Instantly usable at any JR station gate.', link: 'https://suica.jr-east.co.jp/en/' },
      { name: 'PayPay', note: 'Sign up with a foreign card. Widely accepted at restaurants and shops.', link: 'https://paypay.ne.jp/en/' },
    ],
    atm: '7-Eleven ATMs and Japan Post ATMs accept international Visa/Mastercard/Maestro cards. Convenience store ATMs charge ~¥110–330 per withdrawal. Avoid bank ATMs — many don\'t accept foreign cards.',
    exchange: 'Best exchange rates at the airport banks or Japan Post. Avoid hotel currency exchange. 7-Eleven ATM withdrawals in yen are often the best rate.',
    tips: [
      'Many restaurants only accept cash — check before ordering.',
      'Coin purse is essential — Japanese transactions produce a lot of coins.',
      'Vending machines accept both coins and IC cards.',
      'Department stores (Isetan, Takashimaya) always accept cards.',
    ],
    watchOut: [
      'Many smaller temples and shrines are cash-only entry.',
      'Taxi drivers usually accept cards now, but confirm before getting in.',
      'Some restaurants require exact change if paying cash.',
    ],
  },
  china: {
    label: 'China',
    summary: 'China is nearly cashless — WeChat Pay and Alipay dominate everything. Set both up BEFORE you arrive.',
    methods: [
      { name: 'WeChat Pay', icon: '💬', status: 'essential', note: 'Accepted absolutely everywhere. International visitors can now link a foreign Visa/Mastercard. Set up BEFORE arriving — requires phone verification.' },
      { name: 'Alipay International', icon: '🔵', status: 'essential', note: 'Also near-universal. "Alipay International" app accepts foreign cards without a Chinese bank account. Set up before arrival.' },
      { name: 'Cash (CNY)', icon: '💵', status: 'recommended', note: 'Needed for some markets and older vendors who haven\'t adopted QR payments. Keep ¥500–¥1000 on hand.' },
      { name: 'UnionPay', icon: '💳', status: 'accepted', note: 'UnionPay ATMs are everywhere. Some foreign Mastercard/Visa work at ICBC, Bank of China ATMs.' },
      { name: 'Visa / Mastercard', icon: '💳', status: 'limited', note: 'Accepted in international hotels and some large department stores. Not useful for daily spending.' },
    ],
    apps: [
      { name: 'WeChat (WeChat Pay)', note: 'CRITICAL — set up payment before arriving. Requires selfie verification.', link: 'https://www.wechat.com/' },
      { name: 'Alipay International', note: 'Second essential payment app. Link your foreign bank card.', link: 'https://intl.alipay.com/' },
    ],
    atm: 'Bank of China, ICBC, and China Construction Bank ATMs accept international cards. Look for the UnionPay or Visa/Plus logo. Withdrawal limit is typically ¥2,500–¥3,000 per transaction.',
    exchange: 'Exchange at Bank of China (best official rate) or at your hotel. Airport rates are acceptable. Avoid street money changers.',
    tips: [
      'QR code payments are so universal that some food stalls are QR-only — no cash accepted.',
      'Top up WeChat Pay or Alipay with a foreign card before leaving Australia.',
      'Keep a VPN active for Google Pay, Apple Maps, and WhatsApp.',
      'Didi is China\'s Uber — requires WeChat or Alipay for payment.',
    ],
    watchOut: [
      '🔴 Google Pay does NOT work in China without a VPN — and WeChat/Alipay QR is faster anyway.',
      'Do not rely on card-only — many places refuse foreign cards entirely.',
      'ATM fees in China can be high (~¥25–¥35 per withdrawal).',
    ],
  },
  thailand: {
    label: 'Thailand',
    summary: 'A mix of cash and card. Cards work in tourist areas; cash (THB) is essential for local markets, street food, and tuk-tuks.',
    methods: [
      { name: 'Cash (THB)', icon: '💵', status: 'essential', note: 'Essential for street food, markets, temples, and small shops. Always have THB 500–1,000 in cash.' },
      { name: 'Visa / Mastercard', icon: '💳', status: 'accepted', note: 'Accepted at hotels, malls, and tourist-facing restaurants. 2–3% foreign transaction fee is common.' },
      { name: 'PromptPay (QR)', icon: '📲', status: 'local', note: 'Thailand\'s QR payment system. Some shops show QR codes — scan with your banking app if supported.' },
      { name: 'Apple Pay / Google Pay', icon: '📱', status: 'growing', note: 'Works at major malls and franchises (7-Eleven, Starbucks). Not widely accepted at local places.' },
    ],
    apps: [
      { name: 'Grab', note: 'For taxis, food delivery. Accepts credit card — no need for cash in the app.', link: 'https://www.grab.com/' },
      { name: 'SuperRich Exchange', note: 'Best currency exchange rate in Bangkok. Multiple locations in tourist areas.', link: 'https://www.superrich1965.com/en' },
    ],
    atm: 'ATMs everywhere in tourist areas. Standard fee is 220 THB (~$9 AUD) per withdrawal for foreign cards. Withdraw larger amounts less often to minimize fees. Bangkok Bank and Kasikorn Bank ATMs widely accept international cards.',
    exchange: 'SuperRich exchange (green logo) has the best rates in Bangkok. Avoid airport exchange counters — rates are ~10% worse. Airport arrival is acceptable for a small initial amount.',
    tips: [
      'Street food and markets are almost always cash-only.',
      'Tuk-tuks and motorbike taxis are cash-only.',
      'Temples often have a cash entry fee (20–500 THB).',
      'Large malls (CentralWorld, Siam Paragon) accept cards and Apple Pay.',
    ],
    watchOut: [
      'ATM fee of 220 THB adds up fast — make bigger withdrawals less often.',
      'Some ATMs offer "lock in" exchange rate — always decline and let your bank do the conversion.',
      'Watch out for ATM skimmers in tourist areas — use bank-attached machines.',
    ],
  },
  bali: {
    label: 'Bali / Indonesia',
    summary: 'Cash (IDR) is king in Bali, especially outside Kuta/Seminyak. Cards work at tourist businesses.',
    methods: [
      { name: 'Cash (IDR)', icon: '💵', status: 'essential', note: 'Essential. Local warungs, markets, rice terraces, temples — cash only. The large denomination notes (IDR 50,000 / 100,000) are most useful.' },
      { name: 'Visa / Mastercard', icon: '💳', status: 'accepted', note: 'Accepted at hotels, restaurants in tourist areas, and larger surf shops. Always confirm before ordering.' },
      { name: 'QRIS (QR Payment)', icon: '📲', status: 'growing', note: 'Indonesia\'s national QR system. Increasingly seen in tourist areas — scan with compatible apps.' },
      { name: 'GoPay / OVO / Dana', icon: '📱', status: 'local', note: 'Indonesian e-wallets. Useful if you plan an extended stay. Requires local phone number.' },
    ],
    apps: [
      { name: 'Gojek', note: 'Dominant ride-share and food delivery app. Accepts card payment.', link: 'https://www.gojek.com/' },
      { name: 'Grab', note: 'Also works in Bali. Card payment accepted.', link: 'https://www.grab.com/' },
    ],
    atm: 'BCA and Mandiri ATMs have the best rates and are the most reliable for international cards. Airport ATMs charge high fees — exchange first, withdraw later from city ATMs. Standard fee: IDR 25,000–50,000 per withdrawal.',
    exchange: 'Best exchange in Seminyak and Kuta at licensed money changers (PT Dirgahayu, Central Kuta). Avoid unlicensed "no commission" exchangers — they use tricks to give you less money. Always count your money before leaving.',
    tips: [
      'Negotiate in cash — vendors expect it at markets.',
      'Temple entry fees are usually cash (IDR 20,000–150,000).',
      'Booking.com and Airbnb rates often assume card payment — ask about cash discount.',
      'Bring small notes — getting change for IDR 100,000 at warungs can be tricky.',
    ],
    watchOut: [
      'Unlicensed money changers use slight of hand and fast counting tricks — always use licensed changers.',
      'Some ATMs will offer a "fixed exchange rate" — always select "no" and let your home bank convert.',
      'Credit card surcharge of 2–3% is common in tourist restaurants.',
    ],
  },
  usa: {
    label: 'USA',
    summary: 'Card-first culture. Credit cards are accepted almost everywhere. Cash is rarely needed.',
    methods: [
      { name: 'Visa / Mastercard', icon: '💳', status: 'universal', note: 'Accepted absolutely everywhere. Tap to pay is standard. Chip+PIN less common — tap or swipe+sign is the norm.' },
      { name: 'Apple Pay / Google Pay', icon: '📱', status: 'recommended', note: 'Accepted at most major retailers, restaurants, and cafés. Faster than card in many places.' },
      { name: 'American Express', icon: '💳', status: 'accepted', note: 'Widely accepted but some small businesses don\'t take it due to higher merchant fees.' },
      { name: 'Cash (USD)', icon: '💵', status: 'optional', note: 'Useful for tips, small food trucks, farmers markets, and parking meters. Keep $50–$100 on hand.' },
      { name: 'Venmo / Zelle / CashApp', icon: '📲', status: 'local', note: 'Americans split bills using these apps. You may receive payment requests — Venmo works with some foreign cards.' },
    ],
    apps: [
      { name: 'Venmo', note: 'For splitting costs with Americans. Download if you\'re travelling with US locals.', link: 'https://venmo.com/' },
    ],
    atm: 'ATMs everywhere. Airport ATMs charge $3–$5 fee. Use your bank\'s partner ATMs to avoid fees. Many Walmarts and CVS stores have fee-free ATMs with certain accounts.',
    exchange: 'Bring USD from Australia — exchange rates at Australian airports/banks are competitive. US airport exchange kiosks (Travelex) have poor rates.',
    tips: [
      '🧾 TIPPING: 18–22% at sit-down restaurants is standard. 10–15% for takeaway/casual. $1–$2 per drink at bars.',
      'Hotel valet, bellhop, and housekeeping customarily receive $2–$5 tip.',
      'Rideshare (Uber, Lyft) — tip is optional but expected (15–20%).',
      'Some US businesses won\'t accept $100 bills — use smaller denominations.',
    ],
    watchOut: [
      'Prices shown EXCLUDE tax — budget an extra 8–10% on purchases.',
      'Restaurant bills don\'t include tip — always add before paying.',
      'Uber Eats, DoorDash, and similar add significant fees and expect a tip.',
    ],
  },
  uk: {
    label: 'United Kingdom',
    summary: 'Contactless card payment is dominant. Cash is rare but still useful in rural areas.',
    methods: [
      { name: 'Contactless Card', icon: '💳', status: 'universal', note: 'The dominant payment method. Accepted on London Transport (tap your credit/debit card directly on Tube gates — no Oyster needed).' },
      { name: 'Apple Pay / Google Pay', icon: '📱', status: 'recommended', note: 'Works everywhere contactless works. Also accepted on the London Underground.' },
      { name: 'Cash (GBP)', icon: '💵', status: 'optional', note: 'Rarely needed in cities. Useful for rural pubs, markets, and tips. Keep £20–£30 on hand.' },
      { name: 'Visa / Mastercard', icon: '💳', status: 'universal', note: 'Accepted everywhere. 0% foreign transaction fee cards (Wise, Revolut) save money on currency conversion.' },
    ],
    apps: [
      { name: 'Citymapper', note: 'Essential for London transit — better than Google Maps for tube/bus timing.', link: 'https://citymapper.com/' },
      { name: 'Wise / Revolut', note: 'Get a Wise or Revolut card for fee-free GBP spending.', link: 'https://wise.com/' },
    ],
    atm: 'HSBC, Barclays, and Lloyds ATMs are most reliable. Avoid "no fee" ATMs with a dynamic currency conversion warning — always pay in GBP.',
    exchange: 'Get a Wise or Revolut card before travelling — they offer near-interbank exchange rates with no fees. Much better than airport exchange.',
    tips: [
      'Tap your credit/debit card directly on London Tube gates — the system automatically calculates the cheapest daily/weekly fare.',
      'Contactless payment limit is £100 per transaction (higher than many other countries).',
      'Tipping in restaurants: 10–12.5% is standard. Always check if service charge is already included.',
    ],
    watchOut: [
      'Some ATMs (not bank-owned) charge withdrawal fees — check before using.',
      'Dynamic currency conversion at card machines — always pay in GBP, not AUD.',
    ],
  },
  europe: {
    label: 'Europe',
    summary: 'Contactless cards and Apple/Google Pay are near-universal in Western Europe. Keep some cash for rural areas and markets.',
    methods: [
      { name: 'Contactless Card', icon: '💳', status: 'universal', note: 'Accepted everywhere in major cities. Tap to pay is the default in most Western European countries.' },
      { name: 'Apple Pay / Google Pay', icon: '📱', status: 'recommended', note: 'Widely accepted. Works for transit in Paris, Berlin, Amsterdam, and more.' },
      { name: 'Cash (EUR)', icon: '💵', status: 'recommended', note: 'Keep €50–€100 for smaller restaurants, markets, tolls, and rural areas. Some old-school cafés and churches request cash.' },
      { name: 'Visa / Mastercard', icon: '💳', status: 'universal', note: 'Universally accepted. Use a no-foreign-fee card (Wise, Revolut) to avoid 2–3% conversion charges.' },
    ],
    apps: [
      { name: 'Wise / Revolut', note: 'Best way to spend EUR without fees. Set up before travelling.', link: 'https://wise.com/' },
      { name: 'Google Maps Offline', note: 'Download maps for each country before arriving.', link: '' },
    ],
    atm: 'Withdraw from bank ATMs (BNP Paribas, Deutsche Bank, ING). Avoid standalone ATMs in tourist areas — they have poor rates. Always pay in local currency (EUR), not AUD.',
    exchange: 'A Wise or Revolut card is the best option — near-interbank rate with no fees. Airport exchange is convenient but expensive (rates 5–10% worse).',
    tips: [
      'Paris Métro, Berlin U-Bahn, Amsterdam GVB all accept contactless card tap.',
      'Italy still uses more cash than other Western European countries.',
      'Eastern Europe (Poland, Czech Republic, Hungary) still uses local currencies — not EUR.',
      'Many European countries have a minimum spend for card payment — keep small change.',
    ],
    watchOut: [
      'Some French and German restaurants are still cash-only — check before sitting down.',
      'ATM "currency conversion offer" — always decline and pay in local currency.',
      'Prague, Budapest, Kraków use their own currencies — not EUR. Plan accordingly.',
    ],
  },
  singapore: {
    label: 'Singapore',
    summary: 'One of the most cashless countries in the world. Cards, Apple Pay, and PayNow work everywhere.',
    methods: [
      { name: 'Visa / Mastercard (Contactless)', icon: '💳', status: 'universal', note: 'Tap your card directly on MRT gates. Accepted virtually everywhere including hawker centres (increasingly).' },
      { name: 'Apple Pay / Google Pay', icon: '📱', status: 'universal', note: 'Works on MRT and buses. Accepted at almost every merchant.' },
      { name: 'PayNow (QR)', icon: '📲', status: 'recommended', note: 'Singapore\'s bank-linked QR payment. Foreign visitors can use it via DBS/POSB Digibank if you open an account. Many hawker stalls use PayNow.' },
      { name: 'NETS', icon: '🏦', status: 'local', note: 'Singapore\'s debit network. Widely accepted alongside Visa/Mastercard.' },
      { name: 'Cash (SGD)', icon: '💵', status: 'optional', note: 'Still used at some hawker centres and older shops. Keep SGD 20–50 for backup.' },
    ],
    apps: [
      { name: 'Grab', note: 'Dominant ride-share in Singapore. Card payment accepted.', link: 'https://www.grab.com/' },
      { name: 'foodpanda / Deliveroo', note: 'Food delivery apps. Card payment.', link: '' },
    ],
    atm: 'DBS, OCBC, and UOB ATMs are most common. Low fees for international cards. Changi Airport has ATMs in all terminals.',
    exchange: 'Licensed money changers at Lucky Plaza, Peoples Park Complex, or Mustafa Centre offer the best rates. Much better than airport exchange.',
    tips: [
      'Tap your card directly on MRT turnstiles — faster than buying tickets.',
      'Most hawker centres now have QR payment stalls — look for NETS QR or PayNow signs.',
      'GST (9%) is included in restaurant prices.',
      'No tipping culture — it\'s not expected and some places refuse it.',
    ],
    watchOut: [
      'Some older hawker stalls and kopitiams are still cash-only.',
      'Changi Airport Jewel shops all accept cards.',
    ],
  },
  korea: {
    label: 'South Korea',
    summary: 'Very card-friendly. T-money card for transit. Cash is rarely needed.',
    methods: [
      { name: 'Visa / Mastercard', icon: '💳', status: 'universal', note: 'Accepted almost everywhere including small restaurants and convenience stores.' },
      { name: 'T-money Card', icon: '🚇', status: 'recommended', note: 'Rechargeable transit card for subway, buses, and taxis. Also works at convenience stores. Buy at GS25 or CU convenience stores.' },
      { name: 'Apple Pay / Samsung Pay', icon: '📱', status: 'accepted', note: 'Apple Pay works at most merchants. Samsung Pay is dominant locally.' },
      { name: 'Kakao Pay', icon: '📲', status: 'local', note: 'Korea\'s major mobile payment. Linked to KakaoTalk. Requires Korean bank account.' },
      { name: 'Cash (KRW)', icon: '💵', status: 'optional', note: 'Rarely needed. Keep ₩50,000–100,000 for street food and small markets.' },
    ],
    apps: [
      { name: 'KakaoTalk', note: 'Essential messaging app in Korea. Also used for group payments.', link: 'https://www.kakaocorp.com/page/service/service/KakaoTalk' },
      { name: 'Kakao T (ride-share)', note: 'Korea\'s dominant taxi app. Card payment accepted.', link: '' },
    ],
    atm: 'Woori Bank, KB Kookmin Bank, and Shinhan Bank ATMs accept international cards. GS25 and 7-Eleven ATMs also accept foreign cards. Fees ~₩1,000–3,000 per withdrawal.',
    exchange: 'Myeongdong (Seoul) has the best exchange rates from licensed street exchangers. Avoid airport exchange for large amounts.',
    tips: [
      'Buy a T-money card at the airport convenience store — immediately usable on AREX train to Seoul.',
      'Korean convenience stores (GS25, CU, 7-Eleven) accept cards for everything.',
      'Many restaurants have automated ordering kiosks that accept cards.',
    ],
    watchOut: [
      'Some traditional Korean restaurants are cash-only — check before ordering.',
      'Duty-free shops at Incheon Airport accept all cards.',
    ],
  },
  vietnam: {
    label: 'Vietnam',
    summary: 'Cash (VND) is still dominant, especially outside tourist hotels. Always carry local currency.',
    methods: [
      { name: 'Cash (VND)', icon: '💵', status: 'essential', note: 'Essential everywhere. Street food, local restaurants, markets, motorbike taxis, and temples are cash-only. Keep VND 500,000–1,000,000 on hand.' },
      { name: 'Visa / Mastercard', icon: '💳', status: 'accepted', note: 'Accepted at international hotels, tourist restaurants, and larger stores. 2–3% surcharge is common.' },
      { name: 'MoMo (E-wallet)', icon: '📲', status: 'growing', note: 'Vietnam\'s dominant e-wallet. Requires Vietnamese phone number and bank account — mainly for locals.' },
      { name: 'Apple Pay / Google Pay', icon: '📱', status: 'limited', note: 'Works at some international chains. Not useful for daily spending.' },
    ],
    apps: [
      { name: 'Grab', note: 'Essential for taxis and food. Card payment accepted.', link: 'https://www.grab.com/' },
    ],
    atm: 'Vietcombank and BIDV ATMs accept international cards reliably. Fee: VND 40,000–80,000 per withdrawal. Maximum withdrawal ~VND 5,000,000 per transaction (~$280 AUD).',
    exchange: 'Vietnam International Bank (VIB) and Vietcombank offer good rates. Avoid changing money at restaurants or markets. Gold shops in Hanoi Old Quarter also offer competitive cash exchange rates.',
    tips: [
      'Negotiate prices for street shopping — cash is your leverage.',
      'Xe om (motorbike taxi) and cyclos are cash-only.',
      'Grab is much safer than street taxis in major cities.',
      'Many street food vendors won\'t have change for large notes — keep small denominations.',
    ],
    watchOut: [
      'Metered taxi scams in HCMC — use Grab instead.',
      'Some shops show prices in USD but deal in VND — confirm currency before paying.',
      'VND notes all have Ho Chi Minh on them — check the number carefully (20k vs 200k look similar).',
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
  universal:    { label: 'Universal',     color: '#15803d', bg: '#dcfce7' },
  essential:    { label: 'Essential',     color: '#b45309', bg: '#fef3c7' },
  recommended:  { label: 'Recommended',   color: '#0369a1', bg: '#e0f2fe' },
  accepted:     { label: 'Accepted',      color: '#4f46e5', bg: '#ede9fe' },
  growing:      { label: 'Growing',       color: '#0891b2', bg: '#cffafe' },
  local:        { label: 'Local App',     color: '#7c3aed', bg: '#f3e8ff' },
  optional:     { label: 'Optional',      color: '#64748b', bg: '#f1f5f9' },
  limited:      { label: 'Limited',       color: '#94a3b8', bg: '#f8fafc' },
};

// ---------------------------------------------------------------------------
// Pre-trip checklist items (global)
// ---------------------------------------------------------------------------
const CHECKLIST_ITEMS = [
  'Notify your bank you are travelling (avoid card blocks)',
  'Get a no-foreign-fee card (Wise, Revolut, 28 Degrees)',
  'Download Wise or Revolut and load with travel funds',
  'Enable contactless on your physical card',
  'Add debit/credit card to Apple Pay or Google Pay',
  'Take a note of your bank\'s 24/7 overseas phone number',
  'Take a photo of both sides of your cards',
  'Research ATM withdrawal limits for your card',
  'Check if your card charges currency conversion fees',
];

export default function PaymentsPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [activeDestIdx, setActiveDestIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`pay-checklist-${tripId}`) || '{}'); }
    catch { return {}; }
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tripRes, destRes] = await Promise.all([
      authFetch(`/trips/${tripId}`),
      authFetch(`/trips/${tripId}/destinations`),
    ]);
    if (tripRes?.ok) setTrip(await tripRes.json());
    if (destRes?.ok) setDestinations(await destRes.json());
    setLoading(false);
  }, [tripId]);

  useEffect(() => { loadData(); }, [loadData]);

  const activeDest = destinations[activeDestIdx];
  const curatedKey = activeDest ? getDestKey(activeDest.name) : null;
  const curatedData = curatedKey ? PAYMENT_DATA[curatedKey] : null;

  const toggleCheck = (item) => {
    const updated = { ...checklist, [item]: !checklist[item] };
    setChecklist(updated);
    localStorage.setItem(`pay-checklist-${tripId}`, JSON.stringify(updated));
  };

  const doneCount = CHECKLIST_ITEMS.filter(i => checklist[i]).length;

  if (loading) return (
    <div className="page-layout">
      <TripSidebar tripName={null} />
      <div className="page-content"><div className="page-main"><div className="page-loading">Loading…</div></div></div>
    </div>
  );

  return (
    <div className="page-layout">
      <TripSidebar tripName={trip?.name} />
      <div className="page-content">
        <div className="page-main">
          <div className="payments-page">
        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title"><CreditCard size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Money &amp; Payments</h1>
            <p className="page-subtitle">Local payment methods, cash tips, and pre-trip checklist</p>
          </div>
        </div>

        {/* Pre-trip checklist */}
        <section className="card pay-section">
          <h2 className="card-title" style={{ marginBottom: 4 }}>
            <CheckCircle size={17} style={{ marginRight: 6 }} />
            Pre-Trip Checklist
          </h2>
          <p className="pay-subtitle">{doneCount}/{CHECKLIST_ITEMS.length} complete</p>
          <div className="checklist-bar">
            <div className="checklist-fill" style={{ width: `${(doneCount / CHECKLIST_ITEMS.length) * 100}%` }} />
          </div>
          <div className="checklist-list">
            {CHECKLIST_ITEMS.map(item => (
              <label key={item} className={`checklist-item${checklist[item] ? ' done' : ''}`}>
                <input type="checkbox" checked={!!checklist[item]} onChange={() => toggleCheck(item)} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </section>

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

        {/* Curated payment info */}
        {activeDest && (
          <>
            {curatedData ? (
              <>
                {/* Summary */}
                <div className="pay-summary-banner">
                  <Info size={16} />
                  <span>{curatedData.summary}</span>
                </div>

                {/* Payment Methods */}
                <section className="card pay-section">
                  <h2 className="card-title" style={{ marginBottom: 16 }}>
                    <CreditCard size={17} style={{ marginRight: 6 }} />
                    Payment Methods in {curatedData.label}
                  </h2>
                  <div className="methods-list">
                    {curatedData.methods.map((m, i) => {
                      const st = STATUS_META[m.status] || STATUS_META.optional;
                      return (
                        <div key={i} className="method-card">
                          <div className="method-icon">{m.icon}</div>
                          <div className="method-info">
                            <div className="method-name">
                              {m.name}
                              <span className="method-badge" style={{ color: st.color, background: st.bg }}>
                                {st.label}
                              </span>
                            </div>
                            <p className="method-note">{m.note}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Apps & ATM & Exchange in a grid */}
                <div className="pay-info-grid">
                  {curatedData.apps.length > 0 && (
                    <section className="card pay-section">
                      <h2 className="card-title" style={{ marginBottom: 14 }}>
                        <Smartphone size={16} style={{ marginRight: 6 }} />
                        Apps to Download
                      </h2>
                      <div className="apps-list">
                        {curatedData.apps.map((a, i) => (
                          <div key={i} className="app-row">
                            <div>
                              <div className="app-name">{a.name}</div>
                              <div className="app-note">{a.note}</div>
                            </div>
                            {a.link && (
                              <a href={a.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="card pay-section">
                    <h2 className="card-title" style={{ marginBottom: 14 }}>
                      <Banknote size={16} style={{ marginRight: 6 }} />
                      ATMs & Exchange
                    </h2>
                    <div className="info-block">
                      <div className="info-label">ATMs</div>
                      <p className="info-text">{curatedData.atm}</p>
                    </div>
                    <div className="info-block" style={{ marginTop: 12 }}>
                      <div className="info-label">Currency Exchange</div>
                      <p className="info-text">{curatedData.exchange}</p>
                    </div>
                  </section>
                </div>

                {/* Tips & Watch Out */}
                <div className="pay-info-grid">
                  <section className="card pay-section tips-section">
                    <h2 className="card-title tips-title-green" style={{ marginBottom: 12 }}>
                      <CheckCircle size={16} style={{ marginRight: 6 }} />
                      Useful Tips
                    </h2>
                    <ul className="pay-tips-list">
                      {curatedData.tips.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </section>

                  <section className="card pay-section watchout-section">
                    <h2 className="card-title watchout-title" style={{ marginBottom: 12 }}>
                      <AlertTriangle size={16} style={{ marginRight: 6 }} />
                      Watch Out For
                    </h2>
                    <ul className="pay-tips-list">
                      {curatedData.watchOut.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </section>
                </div>
              </>
            ) : (
              <section className="card pay-section">
                <p className="no-curated">
                  No curated payment data for "{activeDest.name}" yet. 
                  Check <a href="https://wise.com" target="_blank" rel="noopener noreferrer">Wise</a> or your bank's travel guide for local payment advice.
                </p>
              </section>
            )}
          </>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
