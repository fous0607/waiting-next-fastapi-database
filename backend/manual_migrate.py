from sqlalchemy import create_engine, text
from database import SQLALCHEMY_DATABASE_URL

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    with engine.connect() as conn:
        # Check columns
        try:
            # enable_waiting_board
            try:
                conn.execute(text("SELECT enable_waiting_board FROM store_settings LIMIT 1"))
            except Exception:
                print("Adding enable_waiting_board column...")
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN enable_waiting_board BOOLEAN DEFAULT 1"))
            
            # enable_reception_desk
            try:
                conn.execute(text("SELECT enable_reception_desk FROM store_settings LIMIT 1"))
            except Exception:
                print("Adding enable_reception_desk column...")
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN enable_reception_desk BOOLEAN DEFAULT 1"))
            
            # enable_franchise_monitoring (Also seemingly missing based on code fallback)
            try:
                conn.execute(text("SELECT enable_franchise_monitoring FROM store_settings LIMIT 1"))
            except Exception:
                print("Adding enable_franchise_monitoring column...")
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN enable_franchise_monitoring BOOLEAN DEFAULT 1"))

            conn.commit()
            print("Migration completed successfully.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
