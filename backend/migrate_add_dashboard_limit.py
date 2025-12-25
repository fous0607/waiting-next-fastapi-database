import os
from dotenv import load_dotenv

# Load env variables explicitly BEFORE importing database
load_dotenv()
if not os.getenv("DATABASE_URL"):
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

from database import engine, SessionLocal
from sqlalchemy import text, inspect
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    session = SessionLocal()
    try:
        # Use SQLAlchemy Inspector for DB-agnostic column checking
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('store_settings')]
        
        if 'max_dashboard_connections' not in columns:
            logger.info("Adding max_dashboard_connections column...")
            # PostgreSQL/SQLite compatible ALTER TABLE
            # Note: PostgreSQL requires DEFAULT 2, SQLite also supports it.
            session.execute(text("ALTER TABLE store_settings ADD COLUMN max_dashboard_connections INTEGER DEFAULT 2"))
            session.commit()
            logger.info("Column added successfully.")
        else:
            logger.info("Column max_dashboard_connections already exists.")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
