from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse, FileResponse
import uvicorn
import os

# Load environment variables from .env file manually - MUST BE DONE BEFORE IMPORTS
def load_env_file():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

load_env_file()

from database import engine, Base

from routers import (
    auth,
    system_admin,
    franchise,
    stores,
    users,
    store_settings,
    class_management,
    waiting,
    waiting_board,
    members,
    daily_closing,
    sse,
    statistics,
    attendance,
    logs, # New Logger Router
    snapshots, # New Snapshots Router
    holidays, # New Holidays Router
    notices, # New Notices Router
    file_upload, # File Upload Router
    system, # System/SSE Monitoring Router
    polling, # Polling Optimization Router
    public # Public Router (QR/Mobile)
)
from core.logger import logger
import time
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title="Waiting System")

from fastapi.middleware.cors import CORSMiddleware

# CORS Configuration - allow local network and common development ports
origins = [
    "*", # Allow all origins for tablet/mobile compatibility in local network
]

app.add_middleware(
    CORSMiddleware,
    # allow_origins=origins, # Disable explicit list to use regex for wildcard with credentials
    allow_origin_regex=".*", # Allow all origins via regex to support credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터베이스 테이블 생성 (Vercel 환경에서는 생략)
if not os.environ.get("VERCEL"):
    Base.metadata.create_all(bind=engine)

# 정적 파일 및 템플릿 설정
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/static", StaticFiles(directory="static"), name="static")
# templates = Jinja2Templates(directory="templates")

from create_initial_superuser import create_initial_superuser
from database import SessionLocal
from core.db_auto_migrator import check_and_migrate_table
from models import StoreSettings, Store, User

@app.on_event("startup")
async def startup_event():
    # Auto-migrate database changes (Generic System)
    try:
        logger.info("Running auto-migration system...")
        check_and_migrate_table(StoreSettings)
        check_and_migrate_table(Store) # Add Store migration for last_heartbeat
        check_and_migrate_table(User)  # Add User migration for last_login
        # You can add other models here if needed in the future
    except Exception as e:
        logger.error(f"Auto-migration system failed: {e}")
        
    db = SessionLocal()
    try:
        create_initial_superuser(db)
    finally:
        db.close()

# Logging Middleware (Disabled to prevent SSE interference)
# class RequestLoggingMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         start_time = time.time()
#         logger.info(f"Incoming Request: {request.method} {request.url.path}")
#         try:
#             response = await call_next(request)
#             process_time = time.time() - start_time
#             logger.info(f"Request Completed: {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.4f}s")
#             return response
#         except Exception as e:
#             logger.error(f"Request Failed: {request.method} {request.url.path} - Error: {str(e)}", exc_info=True)
#             raise e

# app.add_middleware(RequestLoggingMiddleware)

# 라우터 등록
# 인증 및 관리 라우터
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(system_admin.router, prefix="/api/system", tags=["System Administration"])
app.include_router(franchise.router, prefix="/api/franchise", tags=["Franchise Management"])
app.include_router(statistics.router, prefix="/api/franchise/stats", tags=["Franchise Statistics"])
app.include_router(stores.router, prefix="/api/stores", tags=["Store Management"])
app.include_router(users.router, prefix="/api/users", tags=["User Management"])

# 매장 운영 라우터
app.include_router(store_settings.router, prefix="/api/store", tags=["Store Settings"])
app.include_router(class_management.router, prefix="/api/classes", tags=["Class Management"])
app.include_router(waiting.router, prefix="/api/waiting", tags=["Waiting"])
app.include_router(waiting_board.router, prefix="/api/board", tags=["Waiting Board"])
app.include_router(members.router, prefix="/api/members", tags=["Members"])
app.include_router(daily_closing.router, prefix="/api/daily", tags=["Daily Closing"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(sse.router, prefix="/api/sse", tags=["SSE"])
app.include_router(logs.router) # Log Viewer Router
app.include_router(snapshots.router, prefix="/api/store/snapshots", tags=["Configuration Snapshots"])
app.include_router(holidays.router, prefix="/api/holidays", tags=["Holiday Management"])
app.include_router(notices.router)
app.include_router(file_upload.router, prefix="/api/files", tags=["File Upload"])
app.include_router(system.router, prefix="/api/system", tags=["System Monitoring"])
app.include_router(polling.router, prefix="/api/polling", tags=["Polling Optimization"])
app.include_router(public.router, prefix="/api/public", tags=["Public Access"])

@app.get("/")
async def main_page(request: Request):
    """메인 페이지 - Redirect to Next.js frontend"""
    return RedirectResponse(url="http://localhost:3000")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse("static/favicon.ico")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8088, reload=True)
