import requests
from datetime import date, timedelta
from auth import create_access_token
from database import SessionLocal
from models import User, Member

def verify_member_history():
    db = SessionLocal()
    # Find a franchise admin
    user = db.query(User).filter(User.role == 'franchise_admin').first()
    if not user:
        print("No franchise admin found")
        return

    # Find a member with attendance
    # This is a bit tricky without knowing data, so we'll just pick a member
    member = db.query(Member).first()
    if not member:
        print("No members found")
        return

    franchise_id = user.franchise_id
    print(f"Testing with user: {user.username}, Franchise ID: {franchise_id}, Member ID: {member.id} ({member.name})")
    
    token = create_access_token(data={"sub": user.username, "role": user.role, "franchise_id": franchise_id})
    headers = {"Authorization": f"Bearer {token}"}

    end_date = date.today()
    start_date = end_date - timedelta(days=90) # Last 3 months
    
    url = f"http://localhost:8000/api/franchise/stats/{franchise_id}/members/{member.id}/history"
    params = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat()
    }

    print(f"Calling URL: {url}")
    try:
        response = requests.get(url, headers=headers, params=params)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Successfully retrieved {len(data)} history records.")
            if len(data) > 0:
                print("First record sample:", data[0])
                expected_keys = ["attended_at", "store_name", "status"]
                keys_present = all(k in data[0] for k in expected_keys)
                if keys_present:
                    print("✅ Data structure verification PASSED")
                else:
                    print("❌ Data structure verification FAILED")
                    print(f"Expected keys: {expected_keys}")
                    print(f"Actual keys: {list(data[0].keys())}")
        else:
            print("❌ API Request FAILED")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Exception occurred: {e}")

if __name__ == "__main__":
    verify_member_history()
