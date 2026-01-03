from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import time
from sqlalchemy.orm import Session
from database import get_db
from models import PrintTemplate, Store

router = APIRouter()

# In-memory queue for simplicity
print_job_queue = []

class PrintJob(BaseModel):
    ip: str
    port: int = 9100
    data: List[int]
    store_id: Optional[str] = None
    created_at: float = time.time()

@router.post("/job")
async def add_print_job(job: PrintJob):
    print(f"[PrinterQueue] Received job for {job.ip}:{job.port}")
    print_job_queue.append(job)
    if len(print_job_queue) > 100:
        print_job_queue.pop(0)
    return {"status": "queued", "queue_length": len(print_job_queue)}

@router.get("/jobs")
async def get_print_jobs():
    if not print_job_queue:
        return []
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
    party_size_details: Optional[str] = None
    teams_ahead: Optional[int] = None
    waiting_order: Optional[int] = None
    store_id: Optional[int] = None # Added for fetching templates

@router.post("/generate-ticket")
async def generate_ticket(ticket: TicketData, db: Session = Depends(get_db)):
    """
    Generate ESC/POS bytes from a template or legacy hardcoded logic.
    """
    try:
        # Check for active template
        template = None
        if ticket.store_id:
            template = db.query(PrintTemplate).filter(
                PrintTemplate.store_id == ticket.store_id,
                PrintTemplate.is_active == True,
                PrintTemplate.template_type == 'waiting_ticket'
            ).first()

        ESC = b'\x1b'
        GS = b'\x1d'
        LF = b'\x0a'
        INIT = ESC + b'@'
        CUT = GS + b'V' + b'\x00'

        # Commands Map
        CMD = {
            "{ALIGN:LEFT}": ESC + b'a' + b'\x00',
            "{ALIGN:CENTER}": ESC + b'a' + b'\x01',
            "{ALIGN:RIGHT}": ESC + b'a' + b'\x02',
            "{BOLD:ON}": ESC + b'E' + b'\x01',
            "{BOLD:OFF}": ESC + b'E' + b'\x00',
            "{SIZE:NORMAL}": GS + b'!' + b'\x00',
            "{SIZE:BIG}": GS + b'!' + b'\x11',
            "{SIZE:HUGE}": GS + b'!' + b'\x22',
            "{CUT}": CUT,
            "{LF}": LF,
        }

        def text_to_bytes(s: str):
            try:
                return s.encode('euc-kr')
            except UnicodeEncodeError:
                return s.encode('euc-kr', errors='replace')

        commands = []
        commands.append(INIT)

        # Legacy Fallback Logic
        if not template:
            print("[PrinterQueue] No active template found. Using legacy logic.")
            # ... Legacy code (pasted below for continuity) or refactored ...
            # For simplicity in this edit, I will include the legacy logic here.
            
            # Store Name
            commands.append(CMD["{ALIGN:CENTER}"])
            commands.append(CMD["{BOLD:ON}"])
            commands.append(CMD["{SIZE:BIG}"])
            commands.append(text_to_bytes(ticket.store_name))
            commands.append(LF)
            
            # Separator
            commands.append(CMD["{SIZE:NORMAL}"])
            commands.append(CMD["{BOLD:OFF}"])
            commands.append(text_to_bytes("--------------------------------"))
            commands.append(LF)
            
            # Waiting Number Label
            commands.append(CMD["{ALIGN:CENTER}"])
            commands.append(CMD["{SIZE:NORMAL}"])
            commands.append(text_to_bytes("대기번호"))
            commands.append(LF)
            
            # Waiting Number Value
            commands.append(CMD["{SIZE:HUGE}"])
            commands.append(CMD["{BOLD:ON}"])
            commands.append(text_to_bytes(str(ticket.waiting_number)))
            commands.append(LF)
            
            # Person Count
            commands.append(CMD["{SIZE:NORMAL}"])
            commands.append(CMD["{BOLD:OFF}"]) # Fix: was ON in original, lets stick to normal
            commands.append(LF)
            
            import json
            details_text = ""
            if ticket.party_size_details:
                try:
                    details = json.loads(ticket.party_size_details)
                    parts = [f"{k} {v}명" for k, v in details.items() if v > 0]
                    if parts:
                        details_text = ", ".join(parts)
                except:
                    pass
            
            if details_text:
                commands.append(text_to_bytes(f"인원수: {details_text}"))
            elif ticket.person_count:
                commands.append(text_to_bytes(f"인원수: {ticket.person_count}명"))
            commands.append(LF)

            # Waiting Stats
            if ticket.teams_ahead is not None or ticket.waiting_order is not None:
                commands.append(LF)
                commands.append(text_to_bytes("--------------------------------"))
                commands.append(LF)
                if ticket.teams_ahead is not None:
                    commands.append(text_to_bytes(f"내 앞 대기: {ticket.teams_ahead}팀"))
                if ticket.waiting_order is not None:
                    if ticket.teams_ahead is not None:
                         commands.append(text_to_bytes("   "))
                    commands.append(text_to_bytes(f"대기순서: {ticket.waiting_order}번째"))
                commands.append(LF)

            # Footer
            commands.append(LF)
            commands.append(text_to_bytes("--------------------------------"))
            commands.append(LF)
            commands.append(text_to_bytes(ticket.date))
            commands.append(LF)
            
            # QR
            if ticket.qr_url and ticket.enable_printer_qr:
                 commands.append(LF)
                 commands.append(CMD["{ALIGN:CENTER}"])
                 qr_data = ticket.qr_url
                 qr_len = len(qr_data) + 3
                 pL = qr_len % 256
                 pH = qr_len // 256
                 size = ticket.printer_qr_size if ticket.printer_qr_size else 4
                 size = max(1, min(16, size))
                 
                 commands.append(b'\x1d(k\x04\x00\x31\x41\x32\x00') # Model
                 commands.append(b'\x1d(k\x03\x00\x31\x43' + bytes([size])) # Size
                 commands.append(b'\x1d(k\x03\x00\x31\x45\x30') # Error Correction
                 commands.append(b'\x1d(k' + bytes([pL, pH]) + b'\x31\x50\x30' + qr_data.encode('utf-8')) # Data
                 commands.append(b'\x1d(k\x03\x00\x31\x51\x30') # Print
                 commands.append(LF)
                 commands.append(text_to_bytes("** completed **"))
                 commands.append(LF)

        else:
            # Dynamic Template Logic
            print(f"[PrinterQueue] Using template: {template.name}")
            
            # Pre-calc variables
            import json
            details_text = ""
            if ticket.party_size_details:
                try:
                    details = json.loads(ticket.party_size_details)
                    parts = [f"{k} {v}명" for k, v in details.items() if v > 0]
                    if parts:
                        details_text = ", ".join(parts)
                except:
                    pass
            people_str = details_text if details_text else (f"{ticket.person_count}명" if ticket.person_count else "")

            VARS = {
                "{STORE_NAME}": ticket.store_name,
                "{WAITING_NUMBER}": ticket.waiting_number,
                "{DATE}": ticket.date,
                "{PEOPLE}": people_str,
                "{TEAMS_AHEAD}": str(ticket.teams_ahead) if ticket.teams_ahead is not None else "",
                "{ORDER}": str(ticket.waiting_order) if ticket.waiting_order is not None else "",
                "{LINE}": "--------------------------------"
            }

            # Normalize newlines
            content = template.content.replace('\r\n', '\n')
            lines = content.split('\n')

            for line in lines:
                # 1. Handle Tags that are whole-line commands or prefix commands
                # We do a simple pass: Process logic tags, then print text.
                
                # Check for explicit commands in the line
                # Note: This simple parser assumes tags are well-formed.
                
                # Split by tags is tricky. simple approach: replace tags with placeholders?
                # Using regex might be better but let's do manual scan for known tags.
                
                # Actually, let's substitute Variables first
                text_line = line
                for k, v in VARS.items():
                    text_line = text_line.replace(k, str(v))
                
                # Handle Special {QR} logic
                if "{QR}" in text_line:
                    # Print QR if enabled and exists
                    if ticket.qr_url and ticket.enable_printer_qr:
                        commands.append(CMD["{ALIGN:CENTER}"]) # Align center for QR by default? Or respect previous align?
                        # Let's respect previous align if user put {ALIGN:CENTER} before {QR}
                        
                        qr_data = ticket.qr_url
                        qr_len = len(qr_data) + 3
                        pL = qr_len % 256
                        pH = qr_len // 256
                        size = ticket.printer_qr_size if ticket.printer_qr_size else 4
                        size = max(1, min(16, size))
                        
                        commands.append(b'\x1d(k\x04\x00\x31\x41\x32\x00') 
                        commands.append(b'\x1d(k\x03\x00\x31\x43' + bytes([size])) 
                        commands.append(b'\x1d(k\x03\x00\x31\x45\x30') 
                        commands.append(b'\x1d(k' + bytes([pL, pH]) + b'\x31\x50\x30' + qr_data.encode('utf-8')) 
                        commands.append(b'\x1d(k\x03\x00\x31\x51\x30')
                    text_line = text_line.replace("{QR}", "") # Remove tag from text
                
                # Process Styling Tags
                # We iterate the line and find tags. 
                # Simplest way: Split by '{' and check keys? No, text can contain {
                # Iterative parsing.
                
                current_text_buffer = ""
                i = 0
                while i < len(text_line):
                    if text_line[i] == '{':
                        # flush buffer
                        if current_text_buffer:
                            commands.append(text_to_bytes(current_text_buffer))
                            current_text_buffer = ""
                        
                        # Find closing '}'
                        close_idx = text_line.find('}', i)
                        if close_idx != -1:
                            tag_candidate = text_line[i:close_idx+1]
                            if tag_candidate in CMD:
                                commands.append(CMD[tag_candidate])
                                i = close_idx + 1
                                continue
                            else:
                                # Not a known tag (maybe part of text), just treat as text
                                current_text_buffer += text_line[i]
                                i += 1
                        else:
                             current_text_buffer += text_line[i]
                             i += 1
                    else:
                        current_text_buffer += text_line[i]
                        i += 1
                
                if current_text_buffer:
                    commands.append(text_to_bytes(current_text_buffer))
                
                # Auto LF at end of line?
                # User template might rely on implicit newlines or explicit {LF}
                # Let's add LF if the line wasn't just commands or if user didn't put {LF}
                # Actually safest is to ALWAYS add LF at end of a text line unless it ends with {LF} (but we replaced it)
                # Let's simply add LF because split('\n') consumed it.
                commands.append(LF)

        # Final Cut
        commands.append(LF)
        commands.append(LF)
        commands.append(LF)
        commands.append(CUT)

        full_command = b''.join(commands)
        return list(full_command)

    except Exception as e:
        print(f"Ticket Generation Error: {e}")
        raise HTTPException(status_code=500, detail=f"Encoding error: {str(e)}")
