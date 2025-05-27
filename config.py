# Configuration settings
import os

MONGO_DATABASE_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/your_database_name") # Replace with your actual DB URI and name
DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100
COOKIE_SECRET = os.getenv("COOKIE_SECRET", "__TODO:_GENERATE_YOUR_OWN_RANDOM_VALUE_HERE__") # For secure cookies

# Example roles (can be expanded)
ROLE_WEBAPP_USER = "webapp_user"
ROLE_API_CLIENT = "api_client"
ROLE_ADMIN = "admin" # For potential future admin functionalities

# API Key settings
API_KEY_HEADER = "X-API-Key"
