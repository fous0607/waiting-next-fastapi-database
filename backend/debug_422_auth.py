
import requests

BASE_URL = "http://localhost:8080"

def get_token():
    url = f"{BASE_URL}/api/auth/login"
    data = {"username": "superadmin", "password": "superadmin123"}
    resp = requests.post(url, data=data)
    if resp.status_code == 200:
        return resp.json()["access_token"]
    print(f"Login failed: {resp.status_code} {resp.text}")
    return None

def test_next_slot():
    token = get_token()
    if not token:
        return

    url = f"{BASE_URL}/api/waiting/next-slot"
    
    headers = {
        "X-Store-Id": "4",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"Requesting {url} with headers {headers}")
    
    try:
        resp = requests.get(url, headers=headers)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")
    except Exception as e:
        print(e)

if __name__ == "__main__":
    test_next_slot()
