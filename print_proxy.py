import socket
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import time

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
    return {"status": "running", "message": "Local Print Proxy is active. You can now use the printer from the web app."}

class PrintRequest(BaseModel):
    ip: str
    port: int = 9100
    data: list[int]  # Receive as byte array (list of integers)

@app.post("/print")
async def print_data(request: PrintRequest):
    print(f"Received print request for {request.ip}:{request.port}")
    
    try:
        # Create a socket object
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5) # 5 second timeout
            s.connect((request.ip, request.port))
            
            # Convert list of ints back to bytes
            byte_data = bytes(request.data)
            s.sendall(byte_data)
            
        print("Print data sent successfully.")
        return {"status": "success", "message": "Print data sent to printer"}
        
    except Exception as e:
        print(f"Print failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("Starting Local Print Proxy on http://localhost:8000")
    print("Keep this window open to allow printing.")
    uvicorn.run(app, host="0.0.0.0", port=8000)
