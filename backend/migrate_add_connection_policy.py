import os
import logging
from dotenv import load_dotenv

# 1. Load Environment Variables FIRST
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
print(f"Loading .env from: {env_path}")
load_dotenv(dotenv_path=env_path)

# Fallback manual loading if needed
if not os.getenv("DATABASE_URL"):
    print("DATABASE_URL not found via dotenv, trying manual load...")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

print(f"DATABASE_URL: {os.getenv('DATABASE_URL')}")

# 2. Import Database modules AFTER env loading
from database import engine, SessionLocal
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    session = SessionLocal()
    try:
        # Check if column exists using raw SQL for PostgreSQL reliability
        query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'store_settings' 
            AND column_name = 'dashboard_connection_policy'
        """)
        result = session.execute(query).fetchone()
        
        if not result:
            logger.info("Adding dashboard_connection_policy column...")
            session.execute(text("ALTER TABLE store_settings ADD COLUMN dashboard_connection_policy VARCHAR(20) DEFAULT 'eject_old'"))
            session.commit()
            logger.info("Column added successfully.")
        else:
            logger.info("Column dashboard_connection_policy already exists.")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
