
import requests

def test_next_slot():
    url = "http://localhost:8080/api/waiting/next-slot"
    
    # We need headers. reception.html uses:
    # headers['X-Store-Id'] = storeId;
    # headers['Authorization'] = `Bearer ${token}`; 
    
    # Let's try to grab a valid token first? 
    # Or assume we can just pass X-Store-Id if the backend allows it (depends on auth implementation)
    # The user is logged in as 'reception'.
    
    # Let's try with JUST store id first, seeing 422 might be auth related if Depends(get_current_store) fails?
    # No, Auth failure is 401. 422 is Pydantic.
    
    headers = {
        "X-Store-Id": "4",
        "Content-Type": "application/json"
    }
    
    try:
        resp = requests.get(url, headers=headers)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")
    except Exception as e:
        print(e)

if __name__ == "__main__":
    test_next_slot()
