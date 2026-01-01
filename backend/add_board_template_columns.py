from sqlalchemy import create_engine, text
import logging

import os

# Database URL
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Correct DB path: backend/database/waiting_system.db
DB_PATH = os.path.join(BASE_DIR, "database", "waiting_system.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

def migrate():
    print(f"Connecting to database at: {DB_PATH}")
    engine = create_engine(DATABASE_URL)
    connection = engine.connect()

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    try:
        # Check if columns exist
        result = connection.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row[1] for row in result.fetchall()]

        if 'board_display_template' not in columns:
            logger.info("Adding 'board_display_template' column...")
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN board_display_template VARCHAR DEFAULT '{순번} {이름}'"))
        else:
            logger.info("'board_display_template' column already exists.")

        if 'enable_privacy_masking' not in columns:
            logger.info("Adding 'enable_privacy_masking' column...")
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN enable_privacy_masking BOOLEAN DEFAULT 0"))
        else:
            logger.info("'enable_privacy_masking' column already exists.")
            
        connection.commit()
        logger.info("Migration completed successfully.")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
