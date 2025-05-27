# utils.py
import bcrypt
import os
import binascii
from datetime import datetime, timezone

def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')

def check_password(password: str, hashed_password_str: str) -> bool:
    """Checks a password against a stored bcrypt hash."""
    if not password or not hashed_password_str:
        return False
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password_str.encode('utf-8'))

def generate_api_key(length=32) -> tuple[str, str]:
    """
    Generates a new API key and its bcrypt hash.
    Returns the raw API key (to be given to the client) and its hash (to be stored).
    """
    raw_key = binascii.hexlify(os.urandom(length)).decode()
    hashed_key = hash_password(raw_key) # Re-use password hashing for simplicity
    return raw_key, hashed_key


if __name__ == '__main__':
    # Example usage:
    
    # User password management
    # new_password = "supersecretuserpassword"
    # hashed = hash_password(new_password)
    # print(f"Original: {new_password}")
    # print(f"Hashed: {hashed}")
    # print(f"Check correct: {check_password(new_password, hashed)}")
    # print(f"Check incorrect: {check_password('wrongpassword', hashed)}")

    # # API Key generation
    # client_api_key, stored_api_key_hash = generate_api_key()
    # print(f"\nGenerated API Key (give to client): {client_api_key}")
    # print(f"Stored API Key Hash (save in DB): {stored_api_key_hash}")
    
    # # Simulating API key check (backend would do this)
    # # Client sends: client_api_key
    # # Backend has: stored_api_key_hash
    # print(f"Check API key correct: {check_password(client_api_key, stored_api_key_hash)}")
    # print(f"Check API key incorrect: {check_password('fakeapikey', stored_api_key_hash)}")

    # To manually create a user for testing:
    test_username = "testuser"
    test_password = "testpassword123"
    hashed_test_password = hash_password(test_password)
    print(f"\n--- Test User ---")
    print(f"Username: {test_username}")
    print(f"Password: {test_password}")
    print(f"Hashed Password (for DB): {hashed_test_password}")
    print("Roles (example): ['webapp_user']")
    print(f"Created At (example): {datetime.now(timezone.utc).isoformat()}")
    # Command to insert into MongoDB (example):
    # db.users.insertOne({{
    #   username: "{test_username}",
    #   hashed_password: "{hashed_test_password}",
    #   roles: ["webapp_user"],
    #   created_at: new Date()
    # }});

    # To manually create an API key for testing:
    client_name = "Test API Client"
    generated_key, hashed_key_for_db = generate_api_key()
    print(f"\n--- Test API Key ---")
    print(f"Client Name: {client_name}")
    print(f"Generated API Key (give to client): {generated_key}")
    print(f"Hashed Key (for DB): {hashed_key_for_db}")
    print("Roles (example): ['api_client_tier1', 'readonly_insights']")
    print(f"Is Active: true")
    print(f"Created At (example): {datetime.now(timezone.utc).isoformat()}")
    # Command to insert into MongoDB (example):
    # db.api_keys.insertOne({{
    #   key_hash: "{hashed_key_for_db}",
    #   client_name: "{client_name}",
    #   roles: ["api_client_tier1", "readonly_insights"],
    #   is_active: true,
    #   created_at: new Date()
    # }});
    pass
