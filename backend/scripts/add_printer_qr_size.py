from database import SessionLocal, engine
from sqlalchemy import text

def migrate():
    session = SessionLocal()
    try:
        # Check if column exists
        result = session.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'printer_qr_size' not in columns:
            print("Adding printer_qr_size column to store_settings...")
            try:
                session.execute(text("ALTER TABLE store_settings ADD COLUMN printer_qr_size INTEGER DEFAULT 4"))
                session.commit()
                print("Column added successfully.")
            except Exception as e:
                print(f"Error adding column: {e}")
                session.rollback()
        else:
            print("printer_qr_size column already exists.")
            
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
