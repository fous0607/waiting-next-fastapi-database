import requests
import socket
import time
import sys

# Configuration
BACKEND_URL = "http://localhost:8088/api/printer/jobs" # Adjust this to your actual backend URL if different
POLL_INTERVAL = 2 # Seconds
PRINTER_TIMEOUT = 5 # Seconds

def print_raw_data(ip, port, data_list):
    try:
        print(f"Connecting to printer {ip}:{port}...")
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(PRINTER_TIMEOUT)
            s.connect((ip, port))
            
            # Convert list of ints back to bytes
            byte_data = bytes(data_list)
            s.sendall(byte_data)
            
        print("Data sent to printer successfully.")
        return True
    except Exception as e:
        print(f"Print failed: {e}")
        return False

def poll_for_jobs():
    print(f"Starting Print Proxy (Polling Mode)...")
    print(f"Target Backend: {BACKEND_URL}")
    print("Press Ctrl+C to stop.")
    
    while True:
        try:
            # Poll the backend
            try:
                response = requests.get(BACKEND_URL, timeout=5)
            except requests.exceptions.ConnectionError:
                print(f"Cannot connect to backend at {BACKEND_URL}. Retrying in {POLL_INTERVAL}s...")
                time.sleep(POLL_INTERVAL)
                continue

            if response.status_code == 200:
                jobs = response.json()
                if jobs:
                    print(f"Received {len(jobs)} print jobs.")
                    for job in jobs:
                        # Job structure matches Pydantic model: ip, port, data
                        print_raw_data(job['ip'], job['port'], job['data'])
                else:
                    # No jobs, just wait
                    pass
            else:
                print(f"Backend returned error: {response.status_code} {response.text}")

        except Exception as e:
            print(f"Unexpected error in polling loop: {e}")
            
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    # Ensure requests library is installed
    try:
        import requests
    except ImportError:
        print("Error: 'requests' library is missing.")
        print("Please run: pip install requests")
        sys.exit(1)

    poll_for_jobs()
