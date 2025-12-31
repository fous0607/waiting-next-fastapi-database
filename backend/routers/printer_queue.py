from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import time

router = APIRouter()

# In-memory queue for simplicity
# In a production environment with multiple workers, Redis would be better.
# But for a single store PC polling, this is sufficient.
print_job_queue = []

class PrintJob(BaseModel):
    ip: str
    port: int = 9100
    data: List[int] # Byte array as list of integers
    store_id: Optional[str] = None # For future multi-store support
    created_at: float = time.time()

@router.post("/job")
async def add_print_job(job: PrintJob):
    """
    Add a print job to the queue.
    Called by the Frontend (Tablet/PC).
    """
    print(f"[PrinterQueue] Received job for {job.ip}:{job.port}")
    print_job_queue.append(job)
    
    # Cleanup old jobs (basic protection against memory leaks)
    if len(print_job_queue) > 100:
        print_job_queue.pop(0)
        
    return {"status": "queued", "queue_length": len(print_job_queue)}

@router.get("/jobs")
async def get_print_jobs():
    """
    Retrieve pending print jobs.
    Called by the Local Print Proxy (polling).
    Returns all pending jobs and clears the queue.
    """
    if not print_job_queue:
        return []
    
    # Return all current jobs and clear the queue
    # This is a simple "pop all" strategy.
    jobs_to_process = list(print_job_queue)
    print_job_queue.clear()
    
    print(f"[PrinterQueue] Dispatching {len(jobs_to_process)} jobs to proxy")
    return jobs_to_process
