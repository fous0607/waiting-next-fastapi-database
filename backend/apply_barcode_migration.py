import sqlite3
from database import DB_FILE_PATH

def migrate():
    db_path = DB_FILE_PATH or "database/waiting_system.db"
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 1. Check for duplicate barcodes
        print("Checking for duplicate barcodes...")
        cursor.execute("SELECT barcode, COUNT(*) FROM members WHERE barcode IS NOT NULL AND barcode != '' GROUP BY barcode HAVING COUNT(*) > 1")
        duplicates = cursor.fetchall()
        
        if duplicates:
            print("ERROR: Found duplicates in barcode. Cannot apply unique constraint.")
            for code, count in duplicates:
                print(f"  Barcode '{code}': {count} entries")
            print("Please resolve duplicates manually before applying constraint.")
            return

        # 2. Drop existing index if exists (SQLAlchemy likely named it ix_members_barcode)
        print("Dropping old index 'ix_members_barcode' if exists...")
        cursor.execute("DROP INDEX IF EXISTS ix_members_barcode")
        
        # 3. Create Unique Index
        print("Creating UNIQUE INDEX 'ix_members_barcode'...")
        # Note: SQLite allows NULLs in UNIQUE columns to be distinct (multiple NULLs ok).
        # But we also want to ensure empty strings are handled? 
        # Usually barcode is NULL if empty.
        cursor.execute("CREATE UNIQUE INDEX ix_members_barcode ON members (barcode)")
        
        print("Success! Unique constraint applied to 'barcode'.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
