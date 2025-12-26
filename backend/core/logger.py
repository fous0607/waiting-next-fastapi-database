
import logging
import asyncio
import sys
import json
from logging.handlers import RotatingFileHandler
import os
from datetime import datetime

# 1. Ensure logs directory is defined (creation handled in setup_logging)
LOG_DIR = "logs"

# 2. Custom JSON Formatter
# 2. Custom JSON Formatter
from datetime import timedelta, timezone

KST = timezone(timedelta(hours=9))

class JsonFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        dt = datetime.fromtimestamp(record.created, KST)
        return dt.strftime(datefmt) if datefmt else dt.isoformat()

    def format(self, record):
        # Use our custom formatTime or manual conversion
        dt_kst = datetime.fromtimestamp(record.created, KST)
        
        log_record = {
            "timestamp": dt_kst.isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "path": record.pathname 
        }
        
        # Add extra fields if available
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id
            
        if record.exc_info:
             log_record["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_record, ensure_ascii=False)


# 4. SSE Log Handler
class SSELogHandler(logging.Handler):
    """
    Logs records to SSE Manager for real-time broadcast.
    Assuming sse_manager is a singleton accessible via import.
    """
    def emit(self, record):
        try:
            # Avoid circular import issues by importing inside method if necessary
            # or rely on the module loaded. 
            # Ideally sse_manager should be passed or imported at top if no circular dep.
            # Here we import inside to be safe against circular dependency with main/routers.
            from sse_manager import sse_manager
            
            log_entry = self.format(record)
            # format() returns string (JSON because of JsonFormatter? No, depends on handler)
            # We want raw dict or JSON string? 
            # JsonFormatter returns a JSON STRING.
            # broadcast_system expects a dict.
            
            try:
                log_data = json.loads(log_entry)
            except:
                # Fallback if standard formatter is used
                dt_kst = datetime.fromtimestamp(record.created, KST)
                log_data = {
                    "timestamp": dt_kst.isoformat(),
                    "level": record.levelname,
                    "message": record.getMessage(),
                    "module": record.module
                }

            # Fire and forget callback to Async Loop
            try:
                loop = asyncio.get_running_loop()
                if loop and loop.is_running():
                    loop.create_task(sse_manager.broadcast_system(log_data))
            except RuntimeError:
                # No running loop (e.g. startup script or separate thread), skip SSE
                pass
                
        except Exception:
            self.handleError(record)

# Update setup_logging to include SSE Handler
def setup_logging():
    logger = logging.getLogger("waiting_system")
    logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers to avoid duplicates
    logger.handlers = []

    # Handler 1: Console (Human Readable) - ALWAYS enabled
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(module)s:%(funcName)s:%(lineno)d - %(message)s'
    )
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)

    # Check if we are in a read-only environment (like Vercel)
    # Vercel sets 'VERCEL' env var to '1'
    is_vercel = os.environ.get('VERCEL') == '1'
    
    if not is_vercel:
        try:
            # Create logs directory only if not in read-only environment
            os.makedirs(LOG_DIR, exist_ok=True)

            # Handler 2: File (JSON Structured for Analysis)
            file_handler = RotatingFileHandler(
                os.path.join(LOG_DIR, "system.json.log"),
                maxBytes=10*1024*1024, # 10MB
                backupCount=5,
                encoding='utf-8'
            )
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(JsonFormatter())
            logger.addHandler(file_handler)
            
            # Handler 3: Human Readable File (Legacy/Easy Read)
            text_handler = RotatingFileHandler(
                os.path.join(LOG_DIR, "system.log"),
                maxBytes=10*1024*1024, # 10MB
                backupCount=5,
                encoding='utf-8'
            )
            text_handler.setLevel(logging.INFO)
            text_handler.setFormatter(console_format)
            logger.addHandler(text_handler)
        except (OSError, PermissionError):
            # Fallback for read-only environments if detection failed
            sys.stderr.write("WARNING: Could not create log files. File logging disabled.\n")

    # Handler 4: SSE Broadcast
    try:
        sse_handler = SSELogHandler()
        sse_handler.setLevel(logging.INFO) # Broadcast INFO and above to avoid flooding
        sse_handler.setFormatter(JsonFormatter())
        logger.addHandler(sse_handler)
    except Exception:
        pass

    return logger

# Singleton Logger Instance
logger = setup_logging()
