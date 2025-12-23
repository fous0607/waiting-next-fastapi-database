import requests
from datetime import date
from auth import create_access_token
from database import SessionLocal
from models import User

def test_api():
    db = SessionLocal()
    # Find a franchise admin for Franchise 2
    user = db.query(User).filter(User.franchise_id == 2, User.role == 'franchise_admin').first()
    if not user:
        print("No franchise admin found for Franchise 2")
        return

    print(f"Testing with user: {user.username}")
    token = create_access_token(data={"sub": user.username, "role": user.role, "franchise_id": user.franchise_id})
    headers = {"Authorization": f"Bearer {token}"}

    today = date.today().isoformat()
    franchise_id = 2
    
    url = f"http://localhost:8000/api/franchise/stats/{franchise_id}/dashboard"
    params = {
        "start_date": today,
        "end_date": today
    }

    print(f"Calling URL: {url}")
    print(f"Params: {params}")

    try:
        response = requests.get(url, headers=headers, params=params)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response JSON:")
            print(response.json())
        else:
            print("Error Response:")
            print(response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_api()
