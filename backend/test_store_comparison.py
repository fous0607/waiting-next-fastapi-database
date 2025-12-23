import requests
from datetime import datetime, timedelta

# Test the store comparison API
base_url = "http://localhost:8000"
franchise_id = 1

# Calculate date range (last month)
end_date = datetime.now().date()
start_date = (datetime.now() - timedelta(days=30)).date()

url = f"{base_url}/api/franchise/stats/{franchise_id}/store_comparison"
params = {
    "start_date": str(start_date),
    "end_date": str(end_date)
}

print(f"Testing URL: {url}")
print(f"Parameters: {params}")
print("-" * 50)

try:
    # Note: This will fail without authentication, but we can test the SQL directly
    response = requests.get(url, params=params)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
    print("\nTesting SQL query directly...")
    
    import sqlite3
    conn = sqlite3.connect('database/waiting_system.db')
    cursor = conn.cursor()
    
    query = """
    SELECT s.id, s.name, 
           COUNT(CASE WHEN w.status = 'attended' THEN w.id ELSE NULL END) as attendance_count
    FROM store s
    LEFT JOIN waiting_list w ON s.id = w.store_id 
        AND w.status = 'attended' 
        AND w.attended_at >= ? 
        AND w.attended_at <= ?
    WHERE s.franchise_id = ? AND s.is_active = 1
    GROUP BY s.id, s.name
    ORDER BY s.name
    """
    
    cursor.execute(query, (
        f"{start_date} 00:00:00",
        f"{end_date} 23:59:59",
        franchise_id
    ))
    
    results = cursor.fetchall()
    print("\nDirect SQL Results:")
    print("-" * 50)
    for row in results:
        print(f"ID: {row[0]}, Name: {row[1]}, Count: {row[2]}")
    
    # Simulate API response
    print("\nSimulated API Response:")
    print("-" * 50)
    api_response = [
        {
            "store_name": row[1].replace("셀스타", "").strip(),
            "count": row[2]
        }
        for row in results
    ]
    print(api_response)
    
    conn.close()
