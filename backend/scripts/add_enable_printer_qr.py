from database import SessionLocal
from sqlalchemy import text

def migrate():
    session = SessionLocal()
    try:
        # Check if column exists
        result = session.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'enable_printer_qr' not in columns:
            print("Adding enable_printer_qr column to store_settings...")
            try:
                session.execute(text("ALTER TABLE store_settings ADD COLUMN enable_printer_qr BOOLEAN DEFAULT 1"))
                session.commit()
                print("Column added successfully.")
            except Exception as e:
                print(f"Error adding column: {e}")
                session.rollback()
        else:
            print("enable_printer_qr column already exists.")
            
    finally:
        session.close()

if __name__ == "__main__":
    migrate()
