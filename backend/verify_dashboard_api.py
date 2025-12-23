import requests
import json
import sys

BASE_URL = "http://localhost:8000"
USERNAME = "superadmin"
PASSWORD = "superadmin123"

def login():
    try:
        response = requests.post(f"{BASE_URL}/login", data={"username": USERNAME, "password": PASSWORD})
        if response.status_code == 200:
            print("✅ Login Successful")
            return response.json()["access_token"]
        else:
            print(f"❌ Login Failed: {response.status_code} - {response.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Login Error: {e}")
        sys.exit(1)

def verify_dashboard_api(token):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(f"{BASE_URL}/api/system/stats/dashboard", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print("✅ Dashboard API Reachable")
            
            # Schema Validation Checks
            required_keys = ["total_stores", "open_stores", "total_waiting", "total_attendance", "hourly_stats", "store_stats"]
            missing_keys = [k for k in required_keys if k not in data]
            
            if not missing_keys:
                print("✅ JSON Structure Valid")
            else:
                print(f"❌ Missing Keys: {missing_keys}")
                
            # Data Validity Checks
            print(f"\n--- Data Summary ---")
            print(f"Total Stores: {data['total_stores']}")
            print(f"Open Stores: {data['open_stores']}")
            print(f"Total Waiting: {data['total_waiting']}")
            print(f"Wait Stats: Avg {data['waiting_time_stats']['avg']} min")
            print(f"Hourly Data Points: {len(data['hourly_stats'])}")
            print(f"Store Stats Entries: {len(data['store_stats'])}")
            
            if data['total_stores'] >= 0:
                print("✅ Data Logic seems plausible (non-negative counts)")
            else:
                 print("❌ Negative counts detected")
                 
            return True
    except Exception as e:
        print(f"❌ API Error: {e}")
        return False

if __name__ == "__main__":
    print("Starting Backend Verification...")
    token = login()
    verify_dashboard_api(token)
