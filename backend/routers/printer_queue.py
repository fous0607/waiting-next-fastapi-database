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
    person_count: Optional[int] = None
    qr_url: Optional[str] = None
    printer_qr_size: Optional[int] = None
    enable_printer_qr: Optional[bool] = True
    party_size_details: Optional[str] = None  # JSON string e.g. '{"성인": 2, "아동": 1}'
    teams_ahead: Optional[int] = None
    waiting_order: Optional[int] = None

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
        
        # Person Count (Details)
        commands.append(SIZE_NORMAL)
        commands.append(BOLD_ON)
        commands.append(LF)
        
        import json
        details_text = ""
        if ticket.party_size_details:
            try:
                details = json.loads(ticket.party_size_details)
                # Format: "성인 2명, 아동 1명"
                parts = []
                for k, v in details.items():
                    if v > 0:
                        parts.append(f"{k} {v}명")
                if parts:
                    details_text = ", ".join(parts)
            except:
                pass
        
        if details_text:
            commands.append(text(f"인원수: {details_text}"))
        elif ticket.person_count:
            commands.append(text(f"인원수: {ticket.person_count}명"))
        commands.append(LF)

        # Waiting Stats (Teams Ahead & Order)
        if ticket.teams_ahead is not None or ticket.waiting_order is not None:
            commands.append(LF)
            commands.append(text("--------------------------------"))
            commands.append(LF)
            
            # 2 Columns Layout simulation with spaces
            # Left: Teams Ahead, Right: Waiting Order
            
            if ticket.teams_ahead is not None:
                commands.append(text(f"내 앞 대기: {ticket.teams_ahead}팀"))
            
            if ticket.waiting_order is not None:
                # Add spacing if both exist
                if ticket.teams_ahead is not None:
                     commands.append(text("   "))
                commands.append(text(f"대기순서: {ticket.waiting_order}번째"))
            
            commands.append(LF)

        # Footer
        commands.append(SIZE_NORMAL)
        commands.append(BOLD_OFF)
        commands.append(LF)
        commands.append(text("--------------------------------"))
        commands.append(LF)
        commands.append(text(ticket.date))
        commands.append(LF)
        
        # QR Code (New)
        if ticket.qr_url and ticket.enable_printer_qr:
            qr_data = ticket.qr_url
            qr_len = len(qr_data) + 3
            pL = qr_len % 256
            pH = qr_len // 256
            
            commands.append(LF)
            commands.append(ALIGN_CENTER)
            
            # 1. Set Model (Model 2)
            commands.append(b'\x1d(k\x04\x00\x31\x41\x32\x00')
            # 2. Set Module Size (Standard: 4-8, Default: 4)
            size = ticket.printer_qr_size if ticket.printer_qr_size else 4
            # Validate size range (1-16 per spec, practically 2-8)
            size = max(1, min(16, size))
            commands.append(b'\x1d(k\x03\x00\x31\x43' + bytes([size]))
            # 3. Set Error Correction (L=48)
            commands.append(b'\x1d(k\x03\x00\x31\x45\x30')
            # 4. Store Data
            # GS ( k pL pH 49 80 48 d1...dk
            commands.append(b'\x1d(k' + bytes([pL, pH]) + b'\x31\x50\x30' + qr_data.encode('utf-8'))
            # 5. Print QR
            commands.append(b'\x1d(k\x03\x00\x31\x51\x30')
            commands.append(LF)
            
            commands.append(text("** completed **")) # As per user image request
            commands.append(LF)

        commands.append(LF)
        commands.append(LF)
        commands.append(LF)
        commands.append(LF)
        commands.append(LF) # Extra feeds to prevent cut off
        commands.append(CUT)

        # Flatten list of bytes
        full_command = b''.join(commands)
        
        print(f"[PrinterQueue] Generated ticket bytes for {ticket.waiting_number}")
        return list(full_command)

    except Exception as e:
        print(f"Ticket Generation Error: {e}")
        raise HTTPException(status_code=500, detail=f"Encoding error: {str(e)}")
