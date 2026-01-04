from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import time
from sqlalchemy.orm import Session
from database import get_db
from models import Store

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
    custom_content: Optional[str] = None # For testing unsaved templates
    ticket_format_config: Optional[str] = None # JSON string
    ticket_custom_footer: Optional[str] = None

@router.post("/generate-ticket")
async def generate_ticket(ticket: TicketData):
    """
    Generate ESC/POS bytes using a dynamic template based on ticket_format_config.
    """
    try:
        # Dynamic Template Construction
        import json
        
        # Default Config
        config = {
            "show_store_name": True,
            "show_waiting_number": True,
            "show_date": True,
            "show_person_count": True,
            "show_teams_ahead": True,
            "show_waiting_order": True
        }

        # Parse Config if provided
        if ticket.ticket_format_config:
            try:
                parsed_config = json.loads(ticket.ticket_format_config)
                config.update(parsed_config)
            except:
                print("Failed to parse ticket_format_config, using defaults")

        # Build Template
        template_parts = []
        
        # Store Name
        if config["show_store_name"]:
            template_parts.append("{ALIGN:CENTER}{BOLD:ON}{SIZE:BIG}{STORE_NAME}")
            template_parts.append("{SIZE:NORMAL}{BOLD:OFF}--------------------------------")

        # Waiting Number (Always centered)
        if config["show_waiting_number"]:
            template_parts.append("{ALIGN:CENTER}{SIZE:NORMAL}대기번호")
            template_parts.append("{SIZE:HUGE}{BOLD:ON}{WAITING_NUMBER}")
            template_parts.append("{SIZE:NORMAL}{BOLD:OFF}--------------------------------")

        # Date & Person Count
        date_line = "{DATE}" if config.get("show_date") else ""
        people_line = "{PEOPLE}" if config.get("show_person_count") else ""
        
        # Combine Date and People
        if config.get("show_date") and config.get("show_person_count"):
             template_parts.append(f"{{ALIGN:LEFT}}{date_line}") 
             template_parts.append(f"{{ALIGN:RIGHT}}{people_line}")
        elif config.get("show_date"):
             template_parts.append(f"{{ALIGN:LEFT}}{date_line}")
        elif config.get("show_person_count"):
             template_parts.append(f"{{ALIGN:RIGHT}}{people_line}")

        # Info Block (Teams Ahead / Order)
        if config.get("show_teams_ahead"):
            template_parts.append("{ALIGN:CENTER}내 앞 대기: {TEAMS_AHEAD}팀")
        
        if config.get("show_waiting_order"):
            template_parts.append("{ALIGN:CENTER}입장 순서: {ORDER}번째")

        # QR Code Placeholder (Always add, conditional logic handles actual print)
        template_parts.append("{ALIGN:CENTER}{QR}")

        # Custom Footer
        if ticket.ticket_custom_footer:
            template_parts.append("{ALIGN:CENTER}{BOLD:OFF}{SIZE:NORMAL}")
            template_parts.append(ticket.ticket_custom_footer)

        template_parts.append("{CUT}")
        
        template_content = "\n".join(template_parts)

        # Override template if custom content provided (Test Print)
        if ticket.custom_content:
            template_content = ticket.custom_content
            print(f"[PrinterQueue] Using CUSTOM content for generation.")
        else:
            print(f"[PrinterQueue] Using Dynamic template.")

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

        # Pre-calc variables
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
        if people_str and config.get("show_person_count"):
             people_str = f"인원: {people_str}"

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
        content = template_content.replace('\r\n', '\n')
        lines = content.split('\n')

        for line in lines:
            text_line = line
            for k, v in VARS.items():
                text_line = text_line.replace(k, str(v))
            
            # Handle Special {QR} logic
            if "{QR}" in text_line:
                if ticket.qr_url and ticket.enable_printer_qr:
                    commands.append(CMD["{ALIGN:CENTER}"]) 
                    
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
                text_line = text_line.replace("{QR}", "") 
            
            # Process Styling Tags
            current_text_buffer = ""
            i = 0
            while i < len(text_line):
                if text_line[i] == '{':
                    if current_text_buffer:
                        commands.append(text_to_bytes(current_text_buffer))
                        current_text_buffer = ""
                    
                    close_idx = text_line.find('}', i)
                    if close_idx != -1:
                        tag_candidate = text_line[i:close_idx+1]
                        if tag_candidate in CMD:
                            commands.append(CMD[tag_candidate])
                            i = close_idx + 1
                            continue
                        else:
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
            
            commands.append(LF)

        # Final Cut - Increase margin significantly (Default SAFE 15 lines)
        cut_margin = config.get("cutting_margin", 15)
        # Ensure it's an integer
        if isinstance(cut_margin, str):
            cut_margin = int(cut_margin)
            
        for _ in range(cut_margin):
            commands.append(LF)
        commands.append(CUT)

        full_command = b''.join(commands)
        return list(full_command)

    except Exception as e:
        print(f"Ticket Generation Error: {e}")
        raise HTTPException(status_code=500, detail=f"Encoding error: {str(e)}")
