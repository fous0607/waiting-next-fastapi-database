from database import SessionLocal
from sqlalchemy import text

def add_column():
    db = SessionLocal()
    try:
        # Check if column exists
        result = db.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row[1] for row in result.fetchall()]
        
        column_name = 'waiting_list_box_size'
        
        if column_name not in columns:
            print(f"Adding {column_name} column to store_settings table...")
            # String column with default value 'medium'
            db.execute(text(f"ALTER TABLE store_settings ADD COLUMN {column_name} VARCHAR DEFAULT 'medium'"))
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
