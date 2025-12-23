import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/attendance/ranking"

def test_api(period, date_str=None, start_date=None, end_date=None):
    params = {
        "period": period,
        "min_count": 0,
        "store_id": 1 # Assuming verify via query param not cookie for simple test? No, backend needs cookie
    }
    if date_str:
        params["date"] = date_str
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
    
    # We need to extract cookie or mock it? 
    # Backend: current_store = Depends(get_current_store)
    # get_current_store reads request.cookies.get("store_id")
    
    cookies = {"store_id": "1"} 
    
    try:
        response = requests.get(BASE_URL, params=params, cookies=cookies)
        print(f"\nTesting {period} (Date: {date_str})... Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Data Count: {len(data)}")
            if len(data) > 0:
                print(f"Sample: {data[0]['name']} - {data[0]['attendance_count']}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Failed to connect: {e}")

today = datetime.now().strftime("%Y-%m-%d")

test_api("daily", today)
test_api("yearly", today)
test_api("custom", today, "2025-01-01", "2025-12-31")
