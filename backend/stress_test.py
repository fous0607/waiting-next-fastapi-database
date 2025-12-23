import asyncio
import httpx
import time
import random

# Configuration
BASE_URL = "http://localhost:8000"
CONCURRENT_STORES = 10  # Start with 10 to avoid crashing the user's dev machine
DEVICES_PER_STORE = 3   # Tablet, Manager, Board
TEST_DURATION = 5       # Seconds to run

async def simulate_store_traffic(store_id, client):
    """
    Simulates a single store's traffic:
    1. Register a customer
    2. Broadcast triggers 3 devices to fetch data
    """
    start_time = time.time()
    
    # 1. Register (Write Operation)
    # Using a fake number to avoid messing up real data too much, or we could delete it later.
    phone = f"0100000{store_id:04d}" 
    try:
        reg_start = time.time()
        # Note: We assume store_id mapping is handled or we just use default store 1 for stress testing the DB lock
        # In a real 100-store sim, they would be different tables or rows, but SQLite lock is FILE based, so it affects all.
        response = await client.post(
            f"{BASE_URL}/api/waiting/register",
            json={"phone": phone},
            headers={"X-Store-Id": "1"} # Forcing all to Store 1 to test worst-case DB lock contention
        )
        reg_time = time.time() - reg_start
        
        if response.status_code != 200:
            return {"status": "fail", "reason": f"Register {response.status_code}", "time": reg_time}

        # 2. Read Operations (Simulating 3 devices reacting)
        # They happen ~300ms later due to debounce, but for server load sizing, we fire them now.
        read_start = time.time()
        
        # Device 1 (Tablet) - Next Slot
        t1 = client.get(f"{BASE_URL}/api/waiting/next-slot", headers={"X-Store-Id": "1"})
        
        # Device 2 (Manager) - List by Class
        t2 = client.get(f"{BASE_URL}/api/waiting/list/by-class", headers={"X-Store-Id": "1"})
        
        # Device 3 (Board) - Display Board
        t3 = client.get(f"{BASE_URL}/api/board/display", headers={"X-Store-Id": "1"})
        
        await asyncio.gather(t1, t2, t3)
        read_time = time.time() - read_start
        
        total_time = time.time() - start_time
        return {"status": "success", "reg_time": reg_time, "read_time": read_time, "total_time": total_time}

    except Exception as e:
        print(f"DEBUG ERROR: {repr(e)}")
        return {"status": "error", "reason": repr(e), "time": 0}

async def main():
    print(f"--- Starting Stress Test ---")
    print(f"Target: {BASE_URL}")
    print(f"Simulating {CONCURRENT_STORES} concurrent stores (acting simultaneously)")
    print(f"Devices per store: {DEVICES_PER_STORE}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [simulate_store_traffic(i, client) for i in range(CONCURRENT_STORES)]
        results = await asyncio.gather(*tasks)

    # Analysis
    success = [r for r in results if r['status'] == 'success']
    failures = [r for r in results if r['status'] != 'success']
    
    avg_total_time = sum(r['total_time'] for r in success) / len(success) if success else 0
    avg_reg_time = sum(r['reg_time'] for r in success) / len(success) if success else 0
    avg_read_time = sum(r['read_time'] for r in success) / len(success) if success else 0
    
    print(f"\n--- Results ---")
    print(f"Successful Transactions: {len(success)} / {CONCURRENT_STORES}")
    print(f"Failed Transactions: {len(failures)}")
    if failures:
        print(f"Failure Reasons: {[f.get('reason') for f in failures[:5]]} ...")
        
    print(f"\n--- Performance Metrics (Average) ---")
    print(f"Total Transaction Time: {avg_total_time:.4f}s")
    print(f"Registration (Write) Time: {avg_reg_time:.4f}s")
    print(f"Data Refresh (Read) Time: {avg_read_time:.4f}s")
    
    print(f"\n--- Projection for 100 Stores ---")
    print(f"If 10 stores took {avg_reg_time:.4f}s for writes, 100 stores on SQLite will likely face blocking.")
    print(f"Estimated CPU Load increase: {len(success) * 5}% (Linear projection - inaccurate but indicative)")

if __name__ == "__main__":
    asyncio.run(main())
