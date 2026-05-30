from pymongo import MongoClient
import urllib.parse
from dotenv import load_dotenv
import os

load_dotenv()

# When deployed (Render + MongoDB Atlas), set MONGO_URI directly in environment variables.
# e.g. mongodb+srv://user:pass@cluster.mongodb.net/tripplannerdb?retryWrites=true&w=majority
# For local dev, leave MONGO_URI unset and use the DB_* variables below instead.
mongo_uri_env = os.getenv("MONGO_URI", "")
username = os.getenv("DB_USERNAME", "")
password = os.getenv("DB_PASSWORD", "")
host = os.getenv("DB_HOST", "localhost")
port = int(os.getenv("DB_PORT", "27017"))
auth_source = os.getenv("DB_AUTH_SOURCE", "admin")
db_name = os.getenv("DB_NAME", "tripplannerdb")


def build_connection():
    if mongo_uri_env:
        uri = mongo_uri_env          # MongoDB Atlas / full URI (used in production)
    elif username and password:
        encoded_user = urllib.parse.quote_plus(username)
        encoded_pass = urllib.parse.quote_plus(password)
        uri = f"mongodb://{encoded_user}:{encoded_pass}@{host}:{port}/?authSource={auth_source}"
    else:
        uri = f"mongodb://{host}:{port}/"           # local unauthenticated

    # MongoClient is lazy — actual connection happens on first DB operation.
    # This prevents the server from crashing at startup if Atlas is temporarily unreachable.
    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    print("MongoDB client created (connection is lazy).")

    db = client[db_name]

    # Collections are auto-created by MongoDB on first write — no need to pre-create them.
    return (
        client,
        db["users"],
        db["trips"],
        db["destinations"],
        db["flights"],
        db["itinerary_days"],
        db["activities"],
        db["accommodation"],
        db["food_places"],
        db["esims"],
    )
