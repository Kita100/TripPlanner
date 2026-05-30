# ✈️ TripPlanner

A full-stack collaborative trip planning app built with **FastAPI + MongoDB** (backend) and **React + Vite** (frontend).

---

## Features

- **Trips & Destinations** — Create trips, add multiple destinations with date ranges, invite collaborators
- **Flights** — Search mock flights (Flight Centre deep-links), filter by stops/price, save and track payment
- **Itinerary** — Day-by-day planner with flex/chill day types, activities, location pins (Nominatim geocoding), and cost tracking
- **Activities** — Map-pinned activities per destination, colored by category, interactive Leaflet map
- **Accommodation** — Search real hotels via OpenStreetMap/Overpass, filter (price, WiFi, breakfast, cancellation), Booking.com links
- **Public Transport** — Curated transit info for 9 major cities, tips, apps, and city maps
- **Food & Dining** — Dietary requirement tracking, nearby restaurant search via Overpass API, color-coded match markers
- **Budget** — Automatic cost aggregation from all pages, paid/unpaid tracking, savings tips

---

## Tech Stack

| Layer     | Technology                              |
|-----------|----------------------------------------|
| Backend   | FastAPI, Python 3.10+                  |
| Database  | MongoDB (local or Atlas)               |
| Frontend  | React 19, Vite 6                       |
| Maps      | React-Leaflet + OpenStreetMap tiles    |
| Geocoding | Nominatim API (free, no key required)  |
| Hotels    | Overpass API (OpenStreetMap data)      |
| Routing   | React Router v7                        |

---

## Setup

### 1. Backend

```bash
cd TripPlannerApp/backend

# Copy env file and fill in your values
cp .env.example .env

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn app:app --reload
```

The API runs at `http://127.0.0.1:8000`.  
Interactive docs available at `http://127.0.0.1:8000/docs`.

#### `.env` values

```
MONGO_URI=mongodb://localhost:27017        # or your Atlas connection string
MONGO_USERNAME=                           # leave blank for unauthenticated local
MONGO_PASSWORD=
SECRET_KEY=your-secret-key-here           # any long random string
```

#### MongoDB

Start MongoDB locally:
```bash
mongod
```
Or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and set the `MONGO_URI` to your cluster connection string.

---

### 2. Frontend

```bash
cd TripPlannerApp/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Demo Credentials

Two demo accounts are automatically seeded on first run:

| Email                        | Password |
|------------------------------|----------|
| `demo@tripplanner.com`       | `demo123`|
| `friend@tripplanner.com`     | `demo123`|

---

## External APIs

All external APIs used are **free and require no API keys**:

| API        | Purpose                          | URL                        |
|------------|----------------------------------|----------------------------|
| Nominatim  | Geocoding (address → lat/lng)    | `nominatim.openstreetmap.org` |
| Overpass   | Restaurant & hotel POI search    | `overpass-api.de`          |
| OpenStreetMap | Map tiles                   | `tile.openstreetmap.org`   |

> **Note:** Nominatim has a usage policy — please add a `User-Agent` header and don't make more than 1 request/second in production.

---

## Project Structure

```
TripPlannerApp/
├── backend/
│   ├── app.py              # All FastAPI routes and logic
│   ├── db.py               # MongoDB connection and collections
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Signup.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── CreateTrip.jsx
    │   │   ├── TripHub.jsx
    │   │   ├── FlightsPage.jsx
    │   │   ├── ItineraryPage.jsx
    │   │   ├── ActivitiesPage.jsx
    │   │   ├── AccommodationPage.jsx
    │   │   ├── TransportPage.jsx
    │   │   ├── FoodPage.jsx
    │   │   └── BudgetPage.jsx
    │   ├── components/
    │   │   ├── TripSidebar.jsx
    │   │   ├── MapWithMarkers.jsx
    │   │   ├── PlaceSearchInput.jsx
    │   │   └── Modal.jsx
    │   ├── styles/
    │   │   └── global.css
    │   ├── api.js
    │   └── App.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```
