import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_USERNAME = "admin"  # Franchise Admin for Franchise 1
ADMIN_PASSWORD = "admin123"

def get_token():
    """Get access token for franchise admin"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        data={
            "username": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        }
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.status_code}")
        print(response.text)
        return None

def test_create_store(token):
    """Test creating a new store"""
    print("\n=== Testing Store Creation ===")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "name": "Test Store via Script"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/stores/",
        headers=headers,
        json=data
    )
    
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        print("Success!")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        return response.json()["id"]
    else:
        print("Failed!")
        print(response.text)
        return None

def test_create_user(token, store_id):
    """Test creating a new user"""
    print("\n=== Testing User Creation ===")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Test creating a store admin
    data = {
        "username": "test_store_admin",
        "password": "password123",
        "role": "store_admin",
        "store_id": store_id
    }
    
    response = requests.post(
        f"{BASE_URL}/api/users/",
        headers=headers,
        json=data
    )
    
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        print("Success!")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    else:
        print("Failed!")
        print(response.text)

if __name__ == "__main__":
    token = get_token()
    if token:
        store_id = test_create_store(token)
        if store_id:
            test_create_user(token, store_id)
