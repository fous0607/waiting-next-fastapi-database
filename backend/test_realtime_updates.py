import requests
import json
from datetime import date

# Test configuration
BASE_URL = "http://localhost:8000"
STORE_CODE = "gangseo"  # 강서점 (Franchise 1의 매장)
TEST_PHONE = "01099998888"  # No hyphens
FRANCHISE_ID = 1  # Admin user's franchise

def get_store_token():
    """Get store token for API calls"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        data={
            "username": "admin",  # Franchise admin
            "password": "admin123"
        }
    )
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.status_code}")
        print(response.text)
        return None

def register_waiting(token):
    """Register a new waiting entry"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "phone": TEST_PHONE,
        "name": "테스트사용자",
        "party_size": 1
    }
    
    print(f"\n=== Registering waiting entry ===")
    print(f"Phone: {TEST_PHONE}")
    print(f"Store: {STORE_CODE}")
    
    response = requests.post(
        f"{BASE_URL}/api/waiting/register?store={STORE_CODE}",
        headers=headers,
        json=data
    )
    
    print(f"\nResponse Status: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"Success! Waiting Number: {result.get('waiting_number')}")
        print(f"Class: {result.get('class_name')}")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result
    else:
        print(f"Failed: {response.text}")
        return None

def check_sse_connection():
    """Check if SSE endpoint is accessible"""
    token = get_store_token()
    if not token:
        return
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    print(f"\n=== Checking SSE endpoint ===")
    url = f"{BASE_URL}/api/franchise/stats/{FRANCHISE_ID}/sse/stream"
    print(f"SSE URL: {url}")
    
    try:
        # Just check if the endpoint responds (don't actually stream)
        response = requests.get(url, headers=headers, stream=True, timeout=2)
        print(f"SSE endpoint status: {response.status_code}")
        if response.status_code == 200:
            print("✓ SSE endpoint is accessible")
        else:
            print(f"✗ SSE endpoint returned error: {response.text}")
    except requests.exceptions.Timeout:
        print("✓ SSE endpoint is streaming (timeout is expected)")
    except Exception as e:
        print(f"✗ Error accessing SSE endpoint: {e}")

if __name__ == "__main__":
    print("=== Testing Real-time Dashboard Updates ===")
    
    # Step 1: Check SSE connection
    check_sse_connection()
    
    # Step 2: Get token
    token = get_store_token()
    if not token:
        print("Failed to get token")
        exit(1)
    
    # Step 3: Register waiting entry
    result = register_waiting(token)
    
    if result:
        print("\n=== Test Complete ===")
        print("Now check the dashboard at:")
        print(f"{BASE_URL}/admin?franchise_id={FRANCHISE_ID}")
        print("The statistics should update automatically.")
        print("\nOpen browser console (F12) to see SSE event logs.")
    else:
        print("\n=== Test Failed ===")
