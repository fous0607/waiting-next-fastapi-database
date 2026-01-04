import socket
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import time
import requests
import threading
import os
import sys

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8088") # Default to local backend, change for production
# BACKEND_URL = "https://your-production-backend.com" # Uncomment and set for cloud
POLL_INTERVAL = 2 # Seconds

app = FastAPI()

# Configure CORS to allow requests from the web app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local proxy convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "running",
        "message": "Local Print Proxy is active.",
        "mode": "Hybrid (Direct Server + Cloud Polling)",
        "backend_url": BACKEND_URL
    }

class PrintRequest(BaseModel):
    ip: str
    port: int = 9100
    data: list[int]  # Receive as byte array (list of integers)

def execute_print_job(ip: str, port: int, data: list[int]):
    """Reusable function to send data to printer"""
    print(f"Executing print job for {ip}:{port} ({len(data)} bytes)")
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5)
            s.connect((ip, port))
            byte_data = bytes(data)
            s.sendall(byte_data)
        print("✅ Print successful.")
        return True
    except Exception as e:
        print(f"❌ Print failed: {e}")
        return False

@app.post("/print")
async def print_data(request: PrintRequest):
    print(f"Received direct print request for {request.ip}:{request.port}")
    success = execute_print_job(request.ip, request.port, request.data)
    if success:
        return {"status": "success", "message": "Print data sent to printer"}
    else:
        raise HTTPException(status_code=500, detail="Printer connection failed")

def poll_cloud_queue():
    """Background task to poll backend for print jobs"""
    print(f"☁️ Cloud Queue Poller started. Connecting to: {BACKEND_URL}")
    
    while True:
        try:
            response = requests.get(f"{BACKEND_URL}/api/printer/jobs", timeout=5)
            if response.status_code == 200:
                jobs = response.json()
                if jobs:
                    print(f"📥 Received {len(jobs)} jobs from Cloud Queue")
                    for job in jobs:
                        execute_print_job(job['ip'], job.get('port', 9100), job['data'])
            else:
                # Backend might be down or not reachable, just log occasionally
                # print(f"Cloud poll failed: {response.status_code}")
                pass
        except Exception as e:
            # print(f"Cloud poll error: {e}")
            pass
        
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    print("Starting Local Print Proxy...")
    print(f"Direct Print URL: http://localhost:8000/print")
    
    # Start Poller in Background Thread
    if BACKEND_URL:
        t = threading.Thread(target=poll_cloud_queue, daemon=True)
        t.start()
    else:
        print("⚠️ BACKEND_URL not set. Cloud Queue Polling disabled.")

    uvicorn.run(app, host="0.0.0.0", port=8000)
