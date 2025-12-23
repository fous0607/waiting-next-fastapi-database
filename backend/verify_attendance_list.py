import requests
from datetime import date
from auth import create_access_token
from database import SessionLocal
from models import User, Franchise

def verify_attendance_list():
    db = SessionLocal()
    # Find a franchise admin
    user = db.query(User).filter(User.role == 'franchise_admin').first()
    if not user:
        print("No franchise admin found")
        return

    franchise_id = user.franchise_id
    print(f"Testing with user: {user.username}, Franchise ID: {franchise_id}")
    
    token = create_access_token(data={"sub": user.username, "role": user.role, "franchise_id": franchise_id})
    headers = {"Authorization": f"Bearer {token}"}

    today = date.today().isoformat()
    
    url = f"http://localhost:8000/api/franchise/stats/{franchise_id}/attendance/list"
    params = {
        "start_date": today,
        "end_date": today
    }

    print(f"Calling URL: {url}")
    try:
        response = requests.get(url, headers=headers, params=params)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Successfully retrieved {len(data)} attendance records.")
            if len(data) > 0:
                print("First record sample:", data[0])
                expected_keys = ["id", "phone", "attended_at", "status", "store_name", "member_name", "member_id"]
                keys_present = all(k in data[0] for k in expected_keys)
                if keys_present:
                    print("✅ Data structure verification PASSED")
                else:
                    print("❌ Data structure verification FAILED")
                    print(f"Expected keys: {expected_keys}")
                    print(f"Actual keys: {list(data[0].keys())}")
            else:
                print("⚠️ No attendance records found for today. Create some attendance data to verify fully.")
        else:
            print("❌ API Request FAILED")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Exception occurred: {e}")

if __name__ == "__main__":
    verify_attendance_list()
