from database import SessionLocal, engine
from sqlalchemy import text

def add_column():
    db = SessionLocal()
    try:
        # Check if column exists
        result = db.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'auto_register_member' not in columns:
            print("Adding auto_register_member column to store_settings table...")
            db.execute(text("ALTER TABLE store_settings ADD COLUMN auto_register_member BOOLEAN DEFAULT 0"))
            db.commit()
            print("Column added successfully.")
        else:
            print("Column already exists.")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_column()
