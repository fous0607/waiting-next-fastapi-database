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

class TicketData(BaseModel):
    store_name: str
    waiting_number: str
    date: str

@router.post("/generate-ticket")
async def generate_ticket(ticket: TicketData):
    """
    Generate ESC/POS commands for a waiting ticket (Korean EUC-KR).
    Returns the byte sequence as a list of integers.
    """
    try:
        # ESC/POS Commands
        ESC = b'\x1b'
        GS = b'\x1d'
        LF = b'\x0a'
        INIT = ESC + b'@'
        ALIGN_CENTER = ESC + b'a' + b'\x01'
        ALIGN_LEFT = ESC + b'a' + b'\x00'
        BOLD_ON = ESC + b'E' + b'\x01'
        BOLD_OFF = ESC + b'E' + b'\x00'
        # Size: GS ! n. 0x00=Normal, 0x11=Double Height+Width, 0x22=Generic Large
        SIZE_NORMAL = GS + b'!' + b'\x00'
        SIZE_BIG = GS + b'!' + b'\x11' 
        SIZE_HUGE = GS + b'!' + b'\x22'
        CUT = GS + b'V' + b'\x00'

        # Helper to encode text to EUC-KR
        def text(s: str):
            try:
                return s.encode('euc-kr')
            except UnicodeEncodeError:
                # Fallback for characters not in EUC-KR (e.g. emojis), replace with ?
                return s.encode('euc-kr', errors='replace')

        commands = []
        commands.append(INIT)
        
        # Store Name
        commands.append(ALIGN_CENTER)
        commands.append(BOLD_ON)
        commands.append(SIZE_BIG)
        commands.append(text(ticket.store_name))
        commands.append(LF)
        
        # Separator
        commands.append(SIZE_NORMAL)
        commands.append(BOLD_OFF)
        commands.append(text("--------------------------------"))
        commands.append(LF)
        
        # Waiting Number Label
        commands.append(ALIGN_CENTER)
        commands.append(SIZE_NORMAL)
        commands.append(text("대기번호"))
        commands.append(LF)
        
        # Waiting Number Value
        commands.append(SIZE_HUGE)
        commands.append(BOLD_ON)
        commands.append(text(str(ticket.waiting_number)))
        commands.append(LF)
        
        # Footer
        commands.append(SIZE_NORMAL)
        commands.append(BOLD_OFF)
        commands.append(LF)
        commands.append(text("--------------------------------"))
        commands.append(LF)
        commands.append(text(ticket.date))
        commands.append(LF)
        commands.append(LF)
        commands.append(LF)
        commands.append(CUT)

        # Flatten list of bytes
        full_command = b''.join(commands)
        
        print(f"[PrinterQueue] Generated ticket bytes for {ticket.waiting_number} (EUC-KR)")
        return list(full_command)

    except Exception as e:
        print(f"Ticket Generation Error: {e}")
        raise HTTPException(status_code=500, detail=f"Encoding error: {str(e)}")
