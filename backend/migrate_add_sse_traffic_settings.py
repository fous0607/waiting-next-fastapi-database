from database import SessionLocal
from sqlalchemy import text

def add_columns():
    db = SessionLocal()
    try:
        # Check if columns exist
        result = db.execute(text("PRAGMA table_info(store_settings)"))
        columns = [row[1] for row in result.fetchall()]
        
        columns_to_add = [
            ('enable_waiting_board', 'INTEGER DEFAULT 1'),  # SQLite uses INTEGER for BOOLEAN
            ('enable_reception_desk', 'INTEGER DEFAULT 1')
        ]
        
        for column_name, column_type in columns_to_add:
            if column_name not in columns:
                print(f"Adding {column_name} column to store_settings table...")
                db.execute(text(f"ALTER TABLE store_settings ADD COLUMN {column_name} {column_type}"))
                db.commit()
                print(f"Column {column_name} added successfully.")
            else:
                print(f"Column {column_name} already exists.")
                
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_columns()
