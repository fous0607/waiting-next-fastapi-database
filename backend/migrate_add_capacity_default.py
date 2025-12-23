from database import engine, SessionLocal
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    session = SessionLocal()
    try:
        # Check if columns exist
        result = session.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row.name for row in result]
        
        if 'default_max_capacity' not in columns:
            logger.info("Adding default_max_capacity column...")
            session.execute(text("ALTER TABLE store_settings ADD COLUMN default_max_capacity INTEGER DEFAULT 10"))
                        
        session.commit()
        logger.info("Migration completed successfully.")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
