from datetime import datetime, timedelta, timezone, date
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from contextlib import asynccontextmanager
from typing import Optional, List, Any
from pydantic import BaseModel
import bcrypt
import jwt
import uuid
import random
import math
import httpx
from dotenv import load_dotenv
import os

from db import build_connection

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ---------------------------------------------------------------------------
# MongoDB collections
# ---------------------------------------------------------------------------
(
    client,
    users_col,
    trips_col,
    destinations_col,
    flights_col,
    itinerary_col,
    activities_col,
    accommodation_col,
    food_col,
    esims_col,
) = build_connection()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        seed_demo_users()
    except Exception as e:
        print(f"Warning: seed_demo_users skipped — DB unavailable at startup: {e}")
    yield
    client.close()
    print("MongoDB disconnected.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # open to any origin/IP so LAN & ngrok sharing works
    allow_credentials=False,   # Bearer-token auth doesn't need cookie credentials
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    payload["exp"] = expire
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")


def seed_demo_users():
    for u, p in [("demo@tripplanner.com", "demo123"), ("friend@tripplanner.com", "demo123")]:
        if not users_col.find_one({"username": u}):
            users_col.insert_one({
                "username": u,
                "display_name": u.split("@")[0].capitalize(),
                "password": hash_password(p),
            })


def serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None


class TripCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cover_emoji: Optional[str] = "✈️"


class TripUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_emoji: Optional[str] = None


class CollaboratorAdd(BaseModel):
    username: str


class DestinationCreate(BaseModel):
    name: str
    country: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    order: Optional[int] = 0


class DestinationUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    order: Optional[int] = None


class FlightCreate(BaseModel):
    from_airport: str
    to_airport: str
    from_city: Optional[str] = None
    to_city: Optional[str] = None
    airline: str
    flight_number: Optional[str] = None
    departure_time: str
    arrival_time: str
    duration: Optional[str] = None
    stops: Optional[int] = 0
    stop_cities: Optional[List[str]] = []
    price: float
    currency: Optional[str] = "AUD"
    cabin_class: Optional[str] = "Economy"
    paid: Optional[bool] = False
    booking_url: Optional[str] = None
    notes: Optional[str] = None
    segment: Optional[str] = None  # e.g. "SYD→CDG"


class FlightUpdate(BaseModel):
    paid: Optional[bool] = None
    price: Optional[float] = None
    notes: Optional[str] = None
    airline: Optional[str] = None
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    duration: Optional[str] = None
    stops: Optional[int] = None
    cabin_class: Optional[str] = None


class FlightSearch(BaseModel):
    from_city: str
    to_city: str
    date: str
    return_date: Optional[str] = None
    passengers: Optional[int] = 1
    cabin_class: Optional[str] = "Economy"


class ItineraryItemCreate(BaseModel):
    name: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    time: Optional[str] = None
    duration: Optional[str] = None
    whole_day: Optional[bool] = False
    end_date: Optional[str] = None   # for multi-day items (YYYY-MM-DD)
    price: Optional[float] = None
    free: Optional[bool] = False
    paid: Optional[bool] = False
    notes: Optional[str] = None
    category: Optional[str] = "attraction"


class ItineraryItemUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    time: Optional[str] = None
    duration: Optional[str] = None
    whole_day: Optional[bool] = None
    end_date: Optional[str] = None
    price: Optional[float] = None
    free: Optional[bool] = None
    paid: Optional[bool] = None
    notes: Optional[str] = None
    category: Optional[str] = None


class DayTypeUpdate(BaseModel):
    type: str  # "normal" | "flex" | "chill"


class ActivityCreate(BaseModel):
    name: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price: Optional[float] = None
    free: Optional[bool] = False
    paid: Optional[bool] = False
    notes: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[str] = None
    category: Optional[str] = "attraction"


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price: Optional[float] = None
    free: Optional[bool] = None
    paid: Optional[bool] = None
    notes: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[str] = None
    category: Optional[str] = None


class AccommodationCreate(BaseModel):
    name: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    price_per_night: Optional[float] = None
    total_price: Optional[float] = None
    currency: Optional[str] = "AUD"
    rating: Optional[float] = None
    stars: Optional[int] = None
    free_cancellation: Optional[bool] = False
    breakfast_included: Optional[bool] = False
    free_wifi: Optional[bool] = False
    booking_url: Optional[str] = None
    notes: Optional[str] = None
    paid: Optional[bool] = False
    images: Optional[List[str]] = []
    # Travel package fields
    is_package: Optional[bool] = False
    package_provider: Optional[str] = None
    includes: Optional[List[str]] = []


class AccommodationUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    price_per_night: Optional[float] = None
    total_price: Optional[float] = None
    rating: Optional[float] = None
    free_cancellation: Optional[bool] = None
    breakfast_included: Optional[bool] = None
    free_wifi: Optional[bool] = None
    booking_url: Optional[str] = None
    notes: Optional[str] = None
    paid: Optional[bool] = None
    is_package: Optional[bool] = None
    package_provider: Optional[str] = None
    includes: Optional[List[str]] = None


class EsimCreate(BaseModel):
    provider: str
    destination_id: Optional[str] = None
    coverage: Optional[str] = None
    data_gb: Optional[float] = None
    validity_days: Optional[int] = None
    price: Optional[float] = 0.0
    currency: Optional[str] = "AUD"
    purchased_date: Optional[str] = None
    activation_date: Optional[str] = None
    status: Optional[str] = "planned"  # planned/purchased/active/used/expired
    notes: Optional[str] = None
    website: Optional[str] = None
    iccid: Optional[str] = None
    paid: Optional[bool] = False


class EsimUpdate(BaseModel):
    provider: Optional[str] = None
    destination_id: Optional[str] = None
    coverage: Optional[str] = None
    data_gb: Optional[float] = None
    validity_days: Optional[int] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    purchased_date: Optional[str] = None
    activation_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    website: Optional[str] = None
    iccid: Optional[str] = None
    paid: Optional[bool] = None


class FoodPlaceCreate(BaseModel):
    name: str
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    cuisine: Optional[str] = None
    price_range: Optional[str] = None
    rating: Optional[float] = None
    dietary_options: Optional[List[str]] = []
    manually_reviewed: Optional[bool] = False
    selected: Optional[bool] = False
    notes: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[str] = None
    osm_id: Optional[str] = None


class FoodPlaceUpdate(BaseModel):
    dietary_options: Optional[List[str]] = None
    manually_reviewed: Optional[bool] = None
    selected: Optional[bool] = None
    notes: Optional[str] = None
    price_range: Optional[str] = None


class DietaryRequirementsUpdate(BaseModel):
    requirements: List[str]


class AccommodationSearch(BaseModel):
    lat: float
    lng: float
    radius: Optional[int] = 3000
    check_in: Optional[str] = None
    check_out: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@app.post("/register")
async def register(data: RegisterRequest):
    if users_col.find_one({"username": data.username}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    users_col.insert_one({
        "username": data.username,
        "display_name": data.display_name or data.username.split("@")[0].capitalize(),
        "password": hash_password(data.password),
    })
    return {"message": "Account created successfully"}


@app.post("/token")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = users_col.find_one({"username": form.username})
    if not user or not verify_password(form.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token(
        {"sub": user["username"]},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user["username"],
        "display_name": user.get("display_name", user["username"]),
    }


@app.get("/users/me")
async def get_me(current_user: str = Depends(get_current_user)):
    user = users_col.find_one({"username": current_user})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"username": user["username"], "display_name": user.get("display_name", "")}


@app.get("/users/search")
async def search_users(q: str, current_user: str = Depends(get_current_user)):
    results = list(users_col.find(
        {"username": {"$regex": q, "$options": "i"}, "username": {"$ne": current_user}},
        {"_id": 0, "username": 1, "display_name": 1}
    ).limit(10))
    return results


# ---------------------------------------------------------------------------
# Trip endpoints
# ---------------------------------------------------------------------------

def can_access_trip(trip: dict, username: str) -> bool:
    return trip["creator"] == username or username in trip.get("collaborators", [])


@app.get("/trips")
async def get_trips(current_user: str = Depends(get_current_user)):
    trips = list(trips_col.find(
        {"$or": [{"creator": current_user}, {"collaborators": current_user}]}
    ))
    result = []
    for t in trips:
        t = serialize(t)
        # Attach destination count
        t["destination_count"] = destinations_col.count_documents({"trip_id": t["id"]})
        result.append(t)
    return result


@app.post("/trips", status_code=201)
async def create_trip(data: TripCreate, current_user: str = Depends(get_current_user)):
    trip = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description or "",
        "cover_emoji": data.cover_emoji or "✈️",
        "creator": current_user,
        "collaborators": [],
        "dietary_requirements": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    trips_col.insert_one(trip)
    return serialize(trip)


@app.get("/trips/{trip_id}")
async def get_trip(trip_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    trip = serialize(trip)
    trip["destinations"] = [serialize(d) for d in destinations_col.find({"trip_id": trip_id}).sort("order", 1)]
    return trip


@app.put("/trips/{trip_id}")
async def update_trip(trip_id: str, data: TripUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    trips_col.update_one({"id": trip_id}, {"$set": update})
    return serialize(trips_col.find_one({"id": trip_id}))


@app.delete("/trips/{trip_id}", status_code=204)
async def delete_trip(trip_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip["creator"] != current_user:
        raise HTTPException(status_code=403, detail="Only the trip creator can delete it")
    trips_col.delete_one({"id": trip_id})
    # Cascade delete
    for col in [destinations_col, flights_col, itinerary_col, activities_col, accommodation_col, food_col]:
        col.delete_many({"trip_id": trip_id})


@app.post("/trips/{trip_id}/collaborators")
async def add_collaborator(trip_id: str, data: CollaboratorAdd, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    user = users_col.find_one({"username": data.username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.username == trip["creator"] or data.username in trip.get("collaborators", []):
        raise HTTPException(status_code=400, detail="User is already part of this trip")
    trips_col.update_one({"id": trip_id}, {"$push": {"collaborators": data.username}})
    return {"message": f"{data.username} added as collaborator"}


@app.delete("/trips/{trip_id}/collaborators/{username}")
async def remove_collaborator(trip_id: str, username: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    trips_col.update_one({"id": trip_id}, {"$pull": {"collaborators": username}})
    return {"message": "Collaborator removed"}


# ---------------------------------------------------------------------------
# Invite-link endpoints
# ---------------------------------------------------------------------------

@app.post("/trips/{trip_id}/invite")
async def generate_invite(trip_id: str, current_user: str = Depends(get_current_user)):
    """Generate (or regenerate) a shareable invite token for this trip."""
    trip = trips_col.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip["creator"] != current_user:
        raise HTTPException(status_code=403, detail="Only the trip creator can generate invite links")
    token = str(uuid.uuid4())
    trips_col.update_one({"id": trip_id}, {"$set": {"invite_token": token}})
    return {"invite_token": token}


@app.get("/invite/{token}")
async def get_invite_preview(token: str):
    """Public — returns trip preview so the join page can display it before login."""
    trip = trips_col.find_one({"invite_token": token})
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    creator_user = users_col.find_one({"username": trip["creator"]})
    return {
        "trip_id": trip["id"],
        "name": trip["name"],
        "cover_emoji": trip.get("cover_emoji", "✈️"),
        "creator_name": creator_user.get("display_name", trip["creator"]) if creator_user else trip["creator"],
        "destination_count": destinations_col.count_documents({"trip_id": trip["id"]}),
    }


@app.post("/invite/{token}/join")
async def join_via_invite(token: str, current_user: str = Depends(get_current_user)):
    """Join a trip via invite token — adds current user as collaborator."""
    trip = trips_col.find_one({"invite_token": token})
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid or expired invite link")
    if trip["creator"] == current_user:
        return {"message": "You are already the creator of this trip", "trip_id": trip["id"]}
    if current_user in trip.get("collaborators", []):
        return {"message": "Already a collaborator", "trip_id": trip["id"]}
    trips_col.update_one({"id": trip["id"]}, {"$push": {"collaborators": current_user}})
    return {"message": "Joined successfully", "trip_id": trip["id"]}


# ---------------------------------------------------------------------------
# Destination endpoints
# ---------------------------------------------------------------------------

@app.get("/trips/{trip_id}/destinations")
async def get_destinations(trip_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return [serialize(d) for d in destinations_col.find({"trip_id": trip_id}).sort("order", 1)]


@app.post("/trips/{trip_id}/destinations", status_code=201)
async def add_destination(trip_id: str, data: DestinationCreate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    dest = {
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "name": data.name,
        "country": data.country or "",
        "lat": data.lat,
        "lng": data.lng,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "order": data.order or 0,
    }
    destinations_col.insert_one(dest)
    return serialize(dest)


@app.put("/trips/{trip_id}/destinations/{dest_id}")
async def update_destination(trip_id: str, dest_id: str, data: DestinationUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    destinations_col.update_one({"id": dest_id, "trip_id": trip_id}, {"$set": update})
    return serialize(destinations_col.find_one({"id": dest_id}))


@app.delete("/trips/{trip_id}/destinations/{dest_id}", status_code=204)
async def delete_destination(trip_id: str, dest_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    destinations_col.delete_one({"id": dest_id, "trip_id": trip_id})
    # Cascade
    for col in [activities_col, accommodation_col, food_col, itinerary_col]:
        col.delete_many({"destination_id": dest_id})


# ---------------------------------------------------------------------------
# Flight endpoints
# ---------------------------------------------------------------------------

@app.get("/trips/{trip_id}/flights")
async def get_flights(trip_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return [serialize(f) for f in flights_col.find({"trip_id": trip_id}).sort("departure_time", 1)]


@app.post("/trips/{trip_id}/flights", status_code=201)
async def add_flight(trip_id: str, data: FlightCreate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    flight = {
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        **data.model_dump(),
    }
    flights_col.insert_one(flight)
    return serialize(flight)


@app.put("/trips/{trip_id}/flights/{flight_id}")
async def update_flight(trip_id: str, flight_id: str, data: FlightUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    flights_col.update_one({"id": flight_id, "trip_id": trip_id}, {"$set": update})
    return serialize(flights_col.find_one({"id": flight_id}))


@app.delete("/trips/{trip_id}/flights/{flight_id}", status_code=204)
async def delete_flight(trip_id: str, flight_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    flights_col.delete_one({"id": flight_id, "trip_id": trip_id})


@app.post("/flights/search")
async def search_flights(data: FlightSearch, current_user: str = Depends(get_current_user)):
    """Generate realistic mock flight options. Integrate Amadeus API here for real data."""
    return generate_mock_flights(data)


def generate_mock_flights(data: FlightSearch) -> List[dict]:
    airlines = [
        {"name": "Qantas", "code": "QF", "tier": "full"},
        {"name": "Emirates", "code": "EK", "tier": "premium"},
        {"name": "Singapore Airlines", "code": "SQ", "tier": "premium"},
        {"name": "Qatar Airways", "code": "QR", "tier": "premium"},
        {"name": "Air France", "code": "AF", "tier": "full"},
        {"name": "Lufthansa", "code": "LH", "tier": "full"},
        {"name": "Cathay Pacific", "code": "CX", "tier": "full"},
        {"name": "Japan Airlines", "code": "JL", "tier": "full"},
        {"name": "Jetstar", "code": "JQ", "tier": "budget"},
        {"name": "Scoot", "code": "TR", "tier": "budget"},
    ]

    class_multipliers = {"Economy": 1.0, "Premium Economy": 1.8, "Business": 4.0, "First": 7.0}
    multiplier = class_multipliers.get(data.cabin_class, 1.0)

    base_price = random.uniform(800, 2200)
    results = []
    random.shuffle(airlines)

    for i, airline in enumerate(airlines[:6]):
        stops = 0 if i < 2 else (1 if i < 5 else 2)
        duration_hours = random.uniform(8, 28) + stops * 2
        price = round(base_price * multiplier * (0.85 + 0.3 * random.random()) * (1 + stops * 0.05), 2)
        if airline["tier"] == "premium":
            price *= 1.15
        elif airline["tier"] == "budget":
            price *= 0.75

        dep_hour = random.choice([6, 7, 9, 11, 14, 17, 20, 22])
        dep_min = random.choice([0, 15, 30, 45])
        arr_hour = (dep_hour + int(duration_hours)) % 24
        arr_min = dep_min

        # Stop cities
        stop_list = []
        if stops == 1:
            stop_list = [random.choice(["Dubai (DXB)", "Singapore (SIN)", "Hong Kong (HKG)", "Doha (DOH)", "Frankfurt (FRA)"])]
        elif stops == 2:
            stop_list = random.sample(["Dubai (DXB)", "Singapore (SIN)", "Bangkok (BKK)", "Kuala Lumpur (KUL)"], 2)

        days_offset = stops  # arrival might be next day(s)
        dep_date = data.date
        arr_date_obj = datetime.strptime(dep_date, "%Y-%m-%d") + timedelta(days=days_offset)
        arr_date = arr_date_obj.strftime("%Y-%m-%d")

        flight_num = f"{airline['code']}{random.randint(100, 999)}"
        results.append({
            "id": str(uuid.uuid4()),
            "airline": airline["name"],
            "airline_code": airline["code"],
            "flight_number": flight_num,
            "from_city": data.from_city,
            "to_city": data.to_city,
            "departure_time": f"{dep_date}T{dep_hour:02d}:{dep_min:02d}:00",
            "arrival_time": f"{arr_date}T{arr_hour:02d}:{arr_min:02d}:00",
            "duration": f"{int(duration_hours)}h {int((duration_hours % 1) * 60)}m",
            "stops": stops,
            "stop_cities": stop_list,
            "price": price,
            "currency": "AUD",
            "cabin_class": data.cabin_class,
            "passengers": data.passengers,
            "total_price": round(price * data.passengers, 2),
            "booking_url": (
                f"https://www.flightcentre.com.au/flights/results"
                f"?from={data.from_city.split()[0]}&to={data.to_city.split()[0]}"
                f"&depart={data.date}&adults={data.passengers}&cabin={data.cabin_class.lower()}"
            ),
            "baggage": "23kg checked" if airline["tier"] != "budget" else "Carry-on only",
            "refundable": airline["tier"] == "premium",
        })

    return sorted(results, key=lambda x: x["price"])


# ---------------------------------------------------------------------------
# Itinerary endpoints
# ---------------------------------------------------------------------------

@app.get("/trips/{trip_id}/destinations/{dest_id}/itinerary")
async def get_itinerary(trip_id: str, dest_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    dest = destinations_col.find_one({"id": dest_id, "trip_id": trip_id})
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")

    days = [serialize(d) for d in itinerary_col.find({"destination_id": dest_id}).sort("date", 1)]
    return days


@app.post("/trips/{trip_id}/destinations/{dest_id}/itinerary/{date_str}/items", status_code=201)
async def add_itinerary_item(trip_id: str, dest_id: str, date_str: str, data: ItineraryItemCreate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    day = itinerary_col.find_one({"destination_id": dest_id, "date": date_str})
    item = {"id": str(uuid.uuid4()), **data.model_dump()}

    if not day:
        day = {
            "id": str(uuid.uuid4()),
            "trip_id": trip_id,
            "destination_id": dest_id,
            "date": date_str,
            "type": "normal",
            "items": [item],
        }
        itinerary_col.insert_one(day)
    else:
        itinerary_col.update_one({"destination_id": dest_id, "date": date_str}, {"$push": {"items": item}})

    return item


@app.put("/trips/{trip_id}/destinations/{dest_id}/itinerary/{date_str}/items/{item_id}")
async def update_itinerary_item(trip_id: str, dest_id: str, date_str: str, item_id: str, data: ItineraryItemUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    day = itinerary_col.find_one({"destination_id": dest_id, "date": date_str})
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    items = day.get("items", [])
    for i, item in enumerate(items):
        if item["id"] == item_id:
            update = {k: v for k, v in data.model_dump().items() if v is not None}
            items[i].update(update)
            break
    itinerary_col.update_one({"destination_id": dest_id, "date": date_str}, {"$set": {"items": items}})
    return {"message": "Updated"}


@app.delete("/trips/{trip_id}/destinations/{dest_id}/itinerary/{date_str}/items/{item_id}", status_code=204)
async def delete_itinerary_item(trip_id: str, dest_id: str, date_str: str, item_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    itinerary_col.update_one(
        {"destination_id": dest_id, "date": date_str},
        {"$pull": {"items": {"id": item_id}}}
    )


@app.put("/trips/{trip_id}/destinations/{dest_id}/itinerary/{date_str}/type")
async def update_day_type(trip_id: str, dest_id: str, date_str: str, data: DayTypeUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    day = itinerary_col.find_one({"destination_id": dest_id, "date": date_str})
    if not day:
        itinerary_col.insert_one({
            "id": str(uuid.uuid4()),
            "trip_id": trip_id,
            "destination_id": dest_id,
            "date": date_str,
            "type": data.type,
            "items": [],
        })
    else:
        itinerary_col.update_one({"destination_id": dest_id, "date": date_str}, {"$set": {"type": data.type}})
    return {"message": "Day type updated"}


# ---------------------------------------------------------------------------
# Activity endpoints
# ---------------------------------------------------------------------------

@app.get("/trips/{trip_id}/destinations/{dest_id}/activities")
async def get_activities(trip_id: str, dest_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return [serialize(a) for a in activities_col.find({"destination_id": dest_id})]


@app.post("/trips/{trip_id}/destinations/{dest_id}/activities", status_code=201)
async def add_activity(trip_id: str, dest_id: str, data: ActivityCreate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    activity = {
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "destination_id": dest_id,
        **data.model_dump(),
    }
    activities_col.insert_one(activity)
    return serialize(activity)


@app.put("/trips/{trip_id}/destinations/{dest_id}/activities/{activity_id}")
async def update_activity(trip_id: str, dest_id: str, activity_id: str, data: ActivityUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    activities_col.update_one({"id": activity_id, "destination_id": dest_id}, {"$set": update})
    return serialize(activities_col.find_one({"id": activity_id}))


@app.delete("/trips/{trip_id}/destinations/{dest_id}/activities/{activity_id}", status_code=204)
async def delete_activity(trip_id: str, dest_id: str, activity_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    activities_col.delete_one({"id": activity_id, "destination_id": dest_id})


# ---------------------------------------------------------------------------
# Accommodation endpoints
# ---------------------------------------------------------------------------

@app.get("/trips/{trip_id}/destinations/{dest_id}/accommodation")
async def get_accommodation(trip_id: str, dest_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return [serialize(a) for a in accommodation_col.find({"destination_id": dest_id})]


@app.post("/trips/{trip_id}/destinations/{dest_id}/accommodation", status_code=201)
async def add_accommodation(trip_id: str, dest_id: str, data: AccommodationCreate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    acc = {
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "destination_id": dest_id,
        **data.model_dump(),
    }
    accommodation_col.insert_one(acc)
    return serialize(acc)


@app.put("/trips/{trip_id}/destinations/{dest_id}/accommodation/{acc_id}")
async def update_accommodation(trip_id: str, dest_id: str, acc_id: str, data: AccommodationUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    accommodation_col.update_one({"id": acc_id, "destination_id": dest_id}, {"$set": update})
    return serialize(accommodation_col.find_one({"id": acc_id}))


@app.delete("/trips/{trip_id}/destinations/{dest_id}/accommodation/{acc_id}", status_code=204)
async def delete_accommodation(trip_id: str, dest_id: str, acc_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    accommodation_col.delete_one({"id": acc_id, "destination_id": dest_id})


@app.post("/accommodation/search")
async def search_accommodation(data: AccommodationSearch, current_user: str = Depends(get_current_user)):
    """Search for hotels near a location using OpenStreetMap Overpass API."""
    query = (
        f"[out:json][timeout:25];"
        f"(node[tourism~'hotel|hostel|guest_house|motel|apartment']"
        f"(around:{data.radius},{data.lat},{data.lng});"
        f"way[tourism~'hotel|hostel|guest_house|motel|apartment']"
        f"(around:{data.radius},{data.lat},{data.lng}););"
        f"out center;"
    )
    try:
        async with httpx.AsyncClient(timeout=20) as client_http:
            resp = await client_http.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
            )
            osm_data = resp.json()
    except Exception:
        return []

    results = []
    for el in osm_data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name")
        if not name:
            continue
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lng = el.get("lon") or el.get("center", {}).get("lon")
        if not lat or not lng:
            continue

        stars = tags.get("stars")
        try:
            stars = int(stars) if stars else None
        except ValueError:
            stars = None

        nights = 1
        if data.check_in and data.check_out:
            try:
                ci = datetime.strptime(data.check_in, "%Y-%m-%d")
                co = datetime.strptime(data.check_out, "%Y-%m-%d")
                nights = max(1, (co - ci).days)
            except Exception:
                nights = 1

        base_price = {5: 350, 4: 180, 3: 110, 2: 70, 1: 45}.get(stars, 130)
        price_per_night = round(base_price * (0.8 + 0.4 * random.random()), 2)
        total_price = round(price_per_night * nights, 2)

        addr_parts = [
            tags.get("addr:housenumber", ""),
            tags.get("addr:street", ""),
            tags.get("addr:city", ""),
        ]
        address = " ".join(p for p in addr_parts if p) or f"Near {data.lat:.2f}, {data.lng:.2f}"

        results.append({
            "osm_id": str(el.get("id")),
            "name": name,
            "location": address,
            "lat": lat,
            "lng": lng,
            "stars": stars,
            "rating": round(3.5 + random.random() * 1.5, 1),
            "price_per_night": price_per_night,
            "total_price": total_price,
            "currency": "AUD",
            "free_cancellation": random.random() > 0.4,
            "breakfast_included": random.random() > 0.6,
            "free_wifi": random.random() > 0.2,
            "accommodation_type": tags.get("tourism", "hotel"),
            "website": tags.get("website", ""),
            "phone": tags.get("phone", ""),
            "booking_url": (
                f"https://www.booking.com/searchresults.html"
                f"?ss={name.replace(' ', '+')}"
                f"&checkin={data.check_in or ''}&checkout={data.check_out or ''}"
            ),
        })

    return results[:20]


# ---------------------------------------------------------------------------
# eSIM endpoints
# ---------------------------------------------------------------------------

@app.get("/trips/{trip_id}/esims")
async def get_esims(trip_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return [serialize(e) for e in esims_col.find({"trip_id": trip_id})]


@app.post("/trips/{trip_id}/esims")
async def add_esim(trip_id: str, esim: EsimCreate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    doc = {"id": str(uuid.uuid4()), "trip_id": trip_id, **esim.model_dump()}
    esims_col.insert_one(doc)
    return serialize(doc)


@app.put("/trips/{trip_id}/esims/{esim_id}")
async def update_esim(trip_id: str, esim_id: str, esim: EsimUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    updates = {k: v for k, v in esim.model_dump().items() if v is not None}
    esims_col.update_one({"id": esim_id, "trip_id": trip_id}, {"$set": updates})
    updated = esims_col.find_one({"id": esim_id})
    return serialize(updated)


@app.delete("/trips/{trip_id}/esims/{esim_id}")
async def delete_esim(trip_id: str, esim_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    esims_col.delete_one({"id": esim_id, "trip_id": trip_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Food endpoints
# ---------------------------------------------------------------------------

@app.get("/trips/{trip_id}/destinations/{dest_id}/food")
async def get_food(trip_id: str, dest_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return [serialize(f) for f in food_col.find({"destination_id": dest_id})]


@app.post("/trips/{trip_id}/destinations/{dest_id}/food", status_code=201)
async def add_food_place(trip_id: str, dest_id: str, data: FoodPlaceCreate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    place = {
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "destination_id": dest_id,
        **data.model_dump(),
    }
    food_col.insert_one(place)
    return serialize(place)


@app.put("/trips/{trip_id}/destinations/{dest_id}/food/{food_id}")
async def update_food_place(trip_id: str, dest_id: str, food_id: str, data: FoodPlaceUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    food_col.update_one({"id": food_id, "destination_id": dest_id}, {"$set": update})
    return serialize(food_col.find_one({"id": food_id}))


@app.delete("/trips/{trip_id}/destinations/{dest_id}/food/{food_id}", status_code=204)
async def delete_food_place(trip_id: str, dest_id: str, food_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    food_col.delete_one({"id": food_id, "destination_id": dest_id})


@app.get("/trips/{trip_id}/dietary")
async def get_dietary(trip_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"requirements": trip.get("dietary_requirements", [])}


@app.put("/trips/{trip_id}/dietary")
async def update_dietary(trip_id: str, data: DietaryRequirementsUpdate, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    trips_col.update_one({"id": trip_id}, {"$set": {"dietary_requirements": data.requirements}})
    return {"requirements": data.requirements}


# ---------------------------------------------------------------------------
# Budget endpoint
# ---------------------------------------------------------------------------

@app.get("/trips/{trip_id}/budget")
async def get_budget(trip_id: str, current_user: str = Depends(get_current_user)):
    trip = trips_col.find_one({"id": trip_id})
    if not trip or not can_access_trip(trip, current_user):
        raise HTTPException(status_code=403, detail="Access denied")

    destinations = list(destinations_col.find({"trip_id": trip_id}))
    dest_map = {d["id"]: d["name"] for d in destinations}

    # Flights
    flight_items = []
    for f in flights_col.find({"trip_id": trip_id}):
        flight_items.append({
            "id": f["id"],
            "category": "flights",
            "name": f"{f.get('airline', '')} {f.get('flight_number', '')} — {f.get('from_city', '')} → {f.get('to_city', '')}",
            "destination": "All",
            "price": f.get("price", 0),
            "paid": f.get("paid", False),
            "currency": f.get("currency", "AUD"),
        })

    # Accommodation
    acc_items = []
    for a in accommodation_col.find({"trip_id": trip_id}):
        is_pkg = a.get("is_package", False)
        acc_items.append({
            "id": a["id"],
            "category": "travel_package" if is_pkg else "accommodation",
            "name": a.get("name", "Accommodation"),
            "destination": dest_map.get(a["destination_id"], "Unknown"),
            "price": a.get("total_price") or a.get("price_per_night", 0),
            "paid": a.get("paid", False),
            "currency": a.get("currency", "AUD"),
        })

    # Itinerary items
    itinerary_items = []
    for day in itinerary_col.find({"trip_id": trip_id}):
        for item in day.get("items", []):
            if not item.get("free") and item.get("price"):
                itinerary_items.append({
                    "id": item["id"],
                    "category": "itinerary",
                    "name": item.get("name", "Activity"),
                    "destination": dest_map.get(day["destination_id"], "Unknown"),
                    "price": item.get("price", 0),
                    "paid": item.get("paid", False),
                    "currency": "AUD",
                })

    all_items = flight_items + acc_items + itinerary_items

    # eSIMs
    esim_items = []
    for e in esims_col.find({"trip_id": trip_id}):
        if e.get("price", 0):
            dest_name = dest_map.get(e.get("destination_id") or "", "All")
            esim_items.append({
                "id": e["id"],
                "category": "connectivity",
                "name": f"eSIM — {e.get('provider', '')} ({e.get('coverage', 'Unknown')})",
                "destination": dest_name,
                "price": e.get("price", 0),
                "paid": e.get("paid", False),
                "currency": e.get("currency", "AUD"),
            })

    all_items = flight_items + acc_items + itinerary_items + esim_items

    total = sum(i["price"] for i in all_items)
    paid = sum(i["price"] for i in all_items if i["paid"])
    unpaid = total - paid

    by_category = {}
    for item in all_items:
        cat = item["category"]
        if cat not in by_category:
            by_category[cat] = {"total": 0, "paid": 0}
        by_category[cat]["total"] += item["price"]
        if item["paid"]:
            by_category[cat]["paid"] += item["price"]

    by_destination = {}
    for item in all_items:
        dest = item["destination"]
        if dest not in by_destination:
            by_destination[dest] = {"total": 0, "paid": 0}
        by_destination[dest]["total"] += item["price"]
        if item["paid"]:
            by_destination[dest]["paid"] += item["price"]

    return {
        "total": round(total, 2),
        "paid": round(paid, 2),
        "unpaid": round(unpaid, 2),
        "by_category": by_category,
        "by_destination": by_destination,
        "items": all_items,
        "currency": "AUD",
    }


# ---------------------------------------------------------------------------
# Transport info endpoint
# ---------------------------------------------------------------------------

TRANSPORT_INFO = {
    "paris": {
        "city": "Paris, France",
        "overview": "Paris has one of the world's best public transport networks, operated by RATP.",
        "types": [
            {"name": "Metro", "description": "16 lines covering all of Paris and inner suburbs. Runs 5:30am–1:15am (2:15am Fri/Sat).", "icon": "🚇"},
            {"name": "RER", "description": "Regional express network connecting Paris to suburbs and CDG/Orly airports.", "icon": "🚆"},
            {"name": "Bus", "description": "300+ bus routes. Night buses (Noctilien) run when Metro closes.", "icon": "🚌"},
            {"name": "Tram", "description": "9 tram lines in outer Paris and suburbs.", "icon": "🚋"},
            {"name": "Vélib' Bikes", "description": "City-wide bike-sharing scheme, great for short trips.", "icon": "🚲"},
        ],
        "what_to_buy": [
            "Navigo Discover card (€5 deposit) — load weekly/monthly passes",
            "Paris Visite tourist pass — 1, 2, 3 or 5 days, zones 1–3 or 1–5",
            "Individual t+ tickets — €2.15 each, or carnet of 10",
            "Download the RATP app for journey planning",
        ],
        "tourist_tips": [
            "A single Metro/Bus ticket costs €2.15; a 10-pack (carnet) saves money",
            "The Navigo Easy contactless card is handy for short stays",
            "CDG airport: RER B to Gare du Nord ~35 min, €11.80",
            "Orly airport: Orlyval tram + RER B, or OrlyCar bus",
            "Vélib' bikes: first 30 min free with a day pass (€5)",
        ],
        "apps": ["RATP", "Citymapper", "Google Maps"],
        "official_site": "https://www.ratp.fr/en",
    },
    "london": {
        "city": "London, United Kingdom",
        "overview": "Transport for London (TfL) operates the Underground, Overground, buses, DLR, and more.",
        "types": [
            {"name": "Underground (Tube)", "description": "11 lines covering central London and beyond. Runs ~5am–midnight (24hr Fri/Sat on some lines).", "icon": "🚇"},
            {"name": "Elizabeth Line", "description": "New high-frequency east-west service through central London.", "icon": "🚊"},
            {"name": "Bus", "description": "700+ routes covering all of Greater London, 24/7.", "icon": "🚌"},
            {"name": "Overground", "description": "Orbital rail network connecting outer London boroughs.", "icon": "🚆"},
            {"name": "DLR", "description": "Driverless light rail serving east London and Docklands.", "icon": "🚋"},
            {"name": "Santander Cycles", "description": "Bike-sharing scheme across central London.", "icon": "🚲"},
        ],
        "what_to_buy": [
            "Oyster card (£7 deposit) — tap on/off, daily price capping",
            "Or use contactless bank card — same prices as Oyster, auto-capped",
            "Travelcard (daily/weekly) — unlimited travel on zones selected",
            "Download the TfL Go app",
        ],
        "tourist_tips": [
            "Contactless cards (Visa/Mastercard) work the same as Oyster — no deposit needed",
            "Daily cap: ~£8.10 for zones 1–2, so you never overpay",
            "Heathrow: Piccadilly Line ~50 min into central London, £6 with Oyster",
            "Avoid Heathrow Express unless your employer is paying (£35!)",
            "Bus is cashless — pay with Oyster or contactless",
        ],
        "apps": ["TfL Go", "Citymapper", "Google Maps"],
        "official_site": "https://tfl.gov.uk",
    },
    "tokyo": {
        "city": "Tokyo, Japan",
        "overview": "Tokyo has the world's busiest and most punctual transit network, operated by JR East, Tokyo Metro, Toei, and many private railways.",
        "types": [
            {"name": "JR Lines", "description": "JR Yamanote loop line and many regional lines. Covered by JR Pass.", "icon": "🚆"},
            {"name": "Tokyo Metro", "description": "9 lines covering central Tokyo. Very punctual.", "icon": "🚇"},
            {"name": "Toei Subway", "description": "4 lines complementing Tokyo Metro.", "icon": "🚇"},
            {"name": "Private Railways", "description": "Many private lines serving suburbs (Odakyu, Keio, Tokyu, etc.).", "icon": "🚊"},
            {"name": "Bus", "description": "Extensive bus network, mostly useful in non-rail areas.", "icon": "🚌"},
        ],
        "what_to_buy": [
            "IC Card: Suica (JR East) or PASMO — rechargeable, works on almost all transit",
            "Buy at any train station vending machine (¥500 deposit)",
            "JR Pass: if travelling to other cities, a 7/14/21-day JR Pass covers bullet trains",
            "Tokyo Metro 24/48/72-hour tourist passes — great value for heavy metro users",
            "Download the Japan Official Travel App or Navitime",
        ],
        "tourist_tips": [
            "Suica/PASMO can also be used at convenience stores and many shops",
            "Trains are extremely punctual — if it says 12:03, it leaves at exactly 12:03",
            "Narita Airport: Narita Express (N'EX) to Shinjuku ~90 min, ¥3,070",
            "Haneda Airport: Keikyu Line to Shinagawa ~15 min, ¥460",
            "Peak hours (8–9am, 6–8pm) are very crowded — avoid with luggage if possible",
        ],
        "apps": ["Japan Official Travel App", "Navitime", "Google Maps", "Hyperdia"],
        "official_site": "https://www.tokyometro.jp/en/",
    },
    "new york": {
        "city": "New York City, USA",
        "overview": "NYC's MTA subway and bus system runs 24/7, one of the few systems in the world that never sleeps.",
        "types": [
            {"name": "Subway", "description": "25+ lines covering all 5 boroughs. Runs 24/7.", "icon": "🚇"},
            {"name": "MTA Bus", "description": "City and express buses. Slower but reaches everywhere.", "icon": "🚌"},
            {"name": "LIRR", "description": "Long Island Rail Road for Long Island and some Manhattan terminals.", "icon": "🚆"},
            {"name": "Metro-North", "description": "Commuter rail to Connecticut and Hudson Valley.", "icon": "🚆"},
            {"name": "PATH Train", "description": "Connects Manhattan to New Jersey 24/7.", "icon": "🚇"},
            {"name": "Staten Island Ferry", "description": "Free ferry between Manhattan and Staten Island.", "icon": "⛴️"},
            {"name": "Citi Bike", "description": "Bike-sharing with stations throughout Manhattan, Brooklyn, Queens.", "icon": "🚲"},
        ],
        "what_to_buy": [
            "OMNY contactless payment — tap your bank card or phone on any subway/bus",
            "MetroCard: $2.90 per ride, or unlimited 7-day ($34) or 30-day ($132)",
            "OMNY weekly cap: $34 after 12 rides Mon–Sun",
            "Download the MYmta app",
        ],
        "tourist_tips": [
            "Use OMNY (contactless) — no card deposit, auto-capped at $34/week",
            "JFK Airport: AirTrain + E/A/J subway, ~60 min to midtown, $8.50 total",
            "Newark Airport: NJ Transit to Penn Station, ~30 min, ~$18",
            "LaGuardia: No subway — take the Q70 bus to Jackson Heights subway station",
            "Subway is 24/7 but some lines have reduced service late night",
        ],
        "apps": ["MYmta", "Citymapper", "Google Maps"],
        "official_site": "https://new.mta.info",
    },
    "rome": {
        "city": "Rome, Italy",
        "overview": "Rome's transit (ATAC) includes the metro, buses, and trams. The historic centre is very walkable.",
        "types": [
            {"name": "Metro", "description": "2 main lines (A and B) plus a short C line. Limited coverage but key tourist spots.", "icon": "🚇"},
            {"name": "Bus", "description": "Extensive network covering all of Rome. Can be slow in traffic.", "icon": "🚌"},
            {"name": "Tram", "description": "Several tram lines in central and outer Rome.", "icon": "🚋"},
            {"name": "Trenitalia", "description": "National rail connecting Rome to other Italian cities.", "icon": "🚆"},
        ],
        "what_to_buy": [
            "Single ticket (BIT): €1.50, valid 100 min on bus/tram/metro",
            "Daily pass: €7, unlimited rides for 24 hours",
            "48-hour pass: €12.50",
            "72-hour pass: €18",
            "Weekly pass (CIS): €24",
            "Download the ATAC app or use Google Maps",
        ],
        "tourist_tips": [
            "Buy tickets at tabacchi (tobacco shops), newsagents, or metro vending machines",
            "Fiumicino Airport: Leonardo Express train to Roma Termini, 32 min, €14",
            "Validate your ticket when boarding buses/trams — inspectors do check",
            "Much of central Rome is a ZTL zone (restricted traffic) — taxis know routes",
            "Walking is often faster than transit in the historic centre",
        ],
        "apps": ["ATAC Roma", "Moovit", "Google Maps"],
        "official_site": "https://www.atac.roma.it",
    },
    "barcelona": {
        "city": "Barcelona, Spain",
        "overview": "TMB operates an excellent metro and bus network. The city is also very walkable and bike-friendly.",
        "types": [
            {"name": "Metro", "description": "8 lines (L1–L11, some numbers unused) covering the city well.", "icon": "🚇"},
            {"name": "Bus", "description": "Day and night buses. Night buses (Nitbus) run when metro is closed.", "icon": "🚌"},
            {"name": "FGC", "description": "Regional trains serving Tibidabo and northern suburbs.", "icon": "🚆"},
            {"name": "Rodalies", "description": "Renfe commuter trains to airport and wider Catalonia.", "icon": "🚆"},
            {"name": "Tram", "description": "Two separate tram networks (Trambaix and Trambesòs).", "icon": "🚋"},
            {"name": "Bicing", "description": "Bike-sharing scheme (requires Barcelona residency — not for tourists).", "icon": "🚲"},
        ],
        "what_to_buy": [
            "T-Casual (10-trip card): €12.15, works on metro, bus, tram, FGC",
            "T-Dia (1-day): €11.35, unlimited travel for one day",
            "Barcelona Card: includes unlimited transit + free museum entry",
            "Airport: T-Money ticket from Aeroport L9 station, €5.15 to city centre",
            "Hola Barcelona Travel Card: 48–120 hours unlimited travel",
        ],
        "tourist_tips": [
            "T-Casual card is the best value for most visitors",
            "El Prat Airport: Metro L9 to Zona Universitària or Collblanc, then change (~35 min total, €5.15)",
            "Sagrada Família: Metro L2/L5 to Sagrada Família station",
            "Validate your card at the start of each journey on buses",
            "Nightlife district (Barceloneta/Gothic): night buses N6, N9, N0 run until 5am",
        ],
        "apps": ["TMB App", "Moovit", "Google Maps"],
        "official_site": "https://www.tmb.cat/en/home",
    },
    "sydney": {
        "city": "Sydney, Australia",
        "overview": "Transport for NSW operates trains, buses, ferries, and light rail across Sydney.",
        "types": [
            {"name": "Train", "description": "Sydney Trains and Metro network. Key lines include City Circle and all suburban lines.", "icon": "🚆"},
            {"name": "Bus", "description": "Extensive network including express, local, and night services.", "icon": "🚌"},
            {"name": "Ferry", "description": "Scenic ferry routes across the harbour, including Manly and Parramatta.", "icon": "⛴️"},
            {"name": "Light Rail", "description": "CBD & South East Light Rail, and Parramatta Light Rail.", "icon": "🚋"},
            {"name": "Metro", "description": "New high-frequency driverless metro lines — Metro Northwest, City, and Southwest.", "icon": "🚇"},
        ],
        "what_to_buy": [
            "Opal card ($0 cost, load with minimum $10) — tap on/off, all modes",
            "Or use contactless bank card/phone — same fares as Opal",
            "Daily travel cap: $17.80 (all day, all modes)",
            "Weekly cap: $50 (Mon–Sun)",
            "Download the Opal Travel app",
        ],
        "tourist_tips": [
            "Contactless bank cards work exactly like Opal — no need to get a separate card",
            "Airport train: T8 Airport & South Line from Domestic/International stations, ~$20 to city",
            "City Explorer bus pass covers major tourist attractions",
            "Sunday cap: only $2.80 for unlimited travel",
            "Ferries are a great way to see the harbour — Circular Quay to Manly is iconic",
        ],
        "apps": ["Opal Travel", "Google Maps", "TripView"],
        "official_site": "https://transportnsw.info",
    },
    "amsterdam": {
        "city": "Amsterdam, Netherlands",
        "overview": "GVB operates trams, buses, and ferries in Amsterdam. Cycling is king here.",
        "types": [
            {"name": "Tram", "description": "15 tram lines serving the city centre and surrounding areas.", "icon": "🚋"},
            {"name": "Bus", "description": "Day and night buses complementing the tram network.", "icon": "🚌"},
            {"name": "Metro", "description": "5 metro lines, particularly useful for east/south of the city.", "icon": "🚇"},
            {"name": "Ferry", "description": "Free ferries across the IJ from Central Station to Noord.", "icon": "⛴️"},
            {"name": "Cycling", "description": "Amsterdam is the world's cycling capital — rent a bike!", "icon": "🚲"},
        ],
        "what_to_buy": [
            "OV-chipkaart: Dutch transport smart card, use everywhere",
            "GVB day tickets: 1-day (€9), 2-day (€15), 3-day (€21), etc.",
            "Amsterdam Travel Ticket: includes Schiphol airport train + city transit",
            "I amsterdam City Card: includes transit + free museums",
            "Download the GVB app or 9292 for journey planning",
        ],
        "tourist_tips": [
            "Rent a bike — it's the fastest and most fun way to see Amsterdam",
            "Schiphol Airport: Intercity train to Amsterdam Centraal, ~15 min, €4.50",
            "GVB day tickets available at tram stops, Central Station, or the GVB app",
            "Tram 2 and 5 run through the main tourist areas",
            "Night trams and buses run Thu–Sat until 3am",
        ],
        "apps": ["GVB", "9292", "NS (trains)", "Google Maps"],
        "official_site": "https://en.gvb.nl",
    },
    "bangkok": {
        "city": "Bangkok, Thailand",
        "overview": "Bangkok has the BTS Skytrain, MRT subway, BRT, and extensive express boat network on the Chao Phraya river.",
        "types": [
            {"name": "BTS Skytrain", "description": "Elevated rail with Sukhumvit and Silom lines. Connects major commercial areas.", "icon": "🚇"},
            {"name": "MRT", "description": "Underground metro with Blue, Yellow, and Pink lines.", "icon": "🚇"},
            {"name": "Airport Rail Link", "description": "Express service from Suvarnabhumi Airport to Phaya Thai, 30 min.", "icon": "🚆"},
            {"name": "Chao Phraya Express Boat", "description": "Scenic river transport along the Chao Phraya River.", "icon": "⛴️"},
            {"name": "BRT", "description": "Bus Rapid Transit on a dedicated lane in south Bangkok.", "icon": "🚌"},
            {"name": "Tuk-tuk / Taxi", "description": "For short trips or areas not served by rail. Always meter for taxis.", "icon": "🚕"},
        ],
        "what_to_buy": [
            "Rabbit Card: BTS Skytrain smart card, also works at 7-Eleven",
            "MRT card: stored value for MRT subway",
            "BTS 1-day pass: ฿150, 3-day pass: ฿440",
            "Airport Rail Link single ticket: ฿15–฿45 depending on zone",
            "Grab app for taxis/rideshare (much better than hailing tuk-tuks)",
        ],
        "tourist_tips": [
            "BTS and MRT don't connect seamlessly — you often need to walk between stations",
            "Suvarnabhumi Airport: City Line to Phaya Thai (~30 min, ฿45), then BTS Skytrain",
            "Don Mueang Airport (budget airlines): bus A1/A2 to Mo Chit BTS, or taxi",
            "Grab taxi is essential for areas not on BTS/MRT",
            "Chao Phraya river boat is great for reaching Wat Pho, Wat Arun, Grand Palace",
        ],
        "apps": ["Grab", "Google Maps", "ViaBus"],
        "official_site": "https://www.bts.co.th/eng/",
    },
    "default": {
        "city": "This Destination",
        "overview": "Public transport varies by destination. Use local transport apps and websites for the most up-to-date information.",
        "types": [
            {"name": "Check Local Options", "description": "Most cities have metro, bus, tram, or taxi options. Research local transit on arrival.", "icon": "🔍"},
        ],
        "what_to_buy": [
            "Check if a reloadable transit card is available (often the best value)",
            "Tourist passes often offer unlimited travel for a fixed period",
            "Download local transit apps before arrival",
            "Google Maps works for transit directions in most major cities",
        ],
        "tourist_tips": [
            "Download Citymapper or Google Maps for transit directions worldwide",
            "Ask your accommodation about the best transit options",
            "Keep small change for bus tickets in less digital-friendly cities",
            "Some cities require you to validate/punch your ticket before boarding",
        ],
        "apps": ["Google Maps", "Citymapper", "Moovit"],
        "official_site": None,
    },
}


@app.get("/transit-info")
async def get_transit_info(city: str, current_user: str = Depends(get_current_user)):
    city_lower = city.lower().strip()
    # Try to match city name
    for key in TRANSPORT_INFO:
        if key != "default" and key in city_lower:
            return TRANSPORT_INFO[key]
    return {**TRANSPORT_INFO["default"], "city": city}
