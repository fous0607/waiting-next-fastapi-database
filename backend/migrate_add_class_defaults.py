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
        
        if 'default_class_minute' not in columns:
            logger.info("Adding default_class_minute column...")
            session.execute(text("ALTER TABLE store_settings ADD COLUMN default_class_minute INTEGER DEFAULT 50"))
            
        if 'default_break_minute' not in columns:
            logger.info("Adding default_break_minute column...")
            session.execute(text("ALTER TABLE store_settings ADD COLUMN default_break_minute INTEGER DEFAULT 10"))
            
        session.commit()
        logger.info("Migration completed successfully.")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
