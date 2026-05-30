from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
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


def get_collection(db, name):
    if name in db.list_collection_names():
        return db[name]
    return db.create_collection(name)


def build_connection():
    if mongo_uri_env:
        uri = mongo_uri_env          # MongoDB Atlas / full URI (used in production)
    elif username and password:
        encoded_user = urllib.parse.quote_plus(username)
        encoded_pass = urllib.parse.quote_plus(password)
        uri = f"mongodb://{encoded_user}:{encoded_pass}@{host}:{port}/?authSource={auth_source}"
    else:
        uri = f"mongodb://{host}:{port}/"           # local unauthenticated

    client = None
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        print("MongoDB connection successful!")
    except ConnectionFailure as e:
        print(f"MongoDB connection failed: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error connecting to MongoDB: {e}")
        raise

    db = client[db_name]

    return (
        client,
        get_collection(db, "users"),
        get_collection(db, "trips"),
        get_collection(db, "destinations"),
        get_collection(db, "flights"),
        get_collection(db, "itinerary_days"),
        get_collection(db, "activities"),
        get_collection(db, "accommodation"),
        get_collection(db, "food_places"),
        get_collection(db, "esims"),
    )
