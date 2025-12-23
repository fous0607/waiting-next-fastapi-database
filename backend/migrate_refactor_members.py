import sqlite3
import shutil
from datetime import datetime

DB_PATH = 'database/waiting_system.db'
BACKUP_FILE = f"waiting_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"

def migrate():
    # 1. Backup database
    print(f"Backing up database to {BACKUP_FILE}...")
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # 2. Add member_type to franchise table
        print("Adding member_type to franchise table...")
        try:
            cursor.execute("ALTER TABLE franchise ADD COLUMN member_type VARCHAR DEFAULT 'store'")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e):
                print("Column member_type already exists in franchise table.")
            else:
                raise e

        # 3. Recreate members table without unique constraint
        print("Recreating members table...")
        
        # Rename existing table
        cursor.execute("ALTER TABLE members RENAME TO members_old")
        
        # Create new table
        cursor.execute("""
            CREATE TABLE members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id INTEGER NOT NULL,
                name VARCHAR NOT NULL,
                phone VARCHAR NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(store_id) REFERENCES store(id)
            )
        """)
        
        # Copy data
        print("Copying data...")
        cursor.execute("""
            INSERT INTO members (id, store_id, name, phone, created_at, updated_at)
            SELECT id, store_id, name, phone, created_at, updated_at FROM members_old
        """)
        
        # Create indices
        print("Creating indices...")
        cursor.execute("DROP INDEX IF EXISTS ix_members_id")
        cursor.execute("DROP INDEX IF EXISTS ix_members_store_id")
        cursor.execute("DROP INDEX IF EXISTS ix_members_phone")
        
        cursor.execute("CREATE INDEX ix_members_id ON members (id)")
        cursor.execute("CREATE INDEX ix_members_store_id ON members (store_id)")
        cursor.execute("CREATE INDEX ix_members_phone ON members (phone)")
        
        # Drop old table
        print("Dropping old table...")
        cursor.execute("DROP TABLE members_old")
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        # Restore backup
        print("Restoring backup...")
        shutil.copy(BACKUP_FILE, DB_FILE)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
