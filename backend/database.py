from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

import os

# Get DATABASE_URL from environment variable, default to SQLite
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database/waiting_system.db")

# Fix Render's postgres:// schema to postgresql:// for SQLAlchemy
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite specific arguments
connect_args = {}
DB_FILE_PATH = None # Global variable for raw file path

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    
    # Ensure database directory exists (for local file-based SQLite)
    if "memory" not in SQLALCHEMY_DATABASE_URL:
        db_path = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "")
        DB_FILE_PATH = db_path # Assign to global
        
        # Remove potential ./ prefix for cleaner path handling if needed, 
        # but os.makedirs handles relative paths fine.
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            try:
                os.makedirs(db_dir)
                print(f"Created database directory: {db_dir}")
            except OSError as e:
                print(f"Error creating database directory {db_dir}: {e}")

# Add pool_pre_ping to allow reconnects
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args=connect_args,
    pool_pre_ping=True
)

# Ensure PostgreSQL sessions use Asia/Seoul timezone
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    from sqlalchemy import event
    @event.listens_for(engine, "connect")
    def set_timezone(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("SET timezone TO 'Asia/Seoul'")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
