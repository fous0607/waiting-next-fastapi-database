import sqlite3
import os

def diagnose_waiting_board_issue():
    """Diagnose waiting board SSE connection issue for ss012"""
    
    # Find the correct database
    db_paths = [
        './backend/database/waiting_system.db',
        './backend/waiting.db',
        './backend/database.sqlite'
    ]
    
    db_path = None
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            print(f"✓ Found database: {path}")
            break
    
    if not db_path:
        print("✗ No database found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        if not tables:
            print("✗ Database is empty (no tables found)")
            return
        
        print(f"\n📊 Tables found: {', '.join(tables)}")
        
        # Find ss012 store
        if 'store' in tables:
            cursor.execute("SELECT id, code, name FROM store WHERE code='ss012'")
            store = cursor.fetchone()
            
            if not store:
                print("\n✗ Store 'ss012' not found in database")
                return
            
            store_id, store_code, store_name = store
            print(f"\n✓ Found store: {store_name} (ID: {store_id}, Code: {store_code})")
            
            # Check store settings
            if 'store_settings' in tables:
                cursor.execute("""
                    SELECT enable_waiting_board, enable_reception_desk 
                    FROM store_settings 
                    WHERE store_id = ?
                """, (store_id,))
                settings = cursor.fetchone()
                
                if settings:
                    enable_board, enable_reception = settings
                    print(f"\n📋 Store Settings:")
                    print(f"   enable_waiting_board: {bool(enable_board)}")
                    print(f"   enable_reception_desk: {bool(enable_reception)}")
                    
                    if not enable_board:
                        print(f"\n🔴 ISSUE FOUND: enable_waiting_board is DISABLED")
                        print(f"   This is why the waiting board cannot connect to SSE!")
                        print(f"\n💡 Solution:")
                        print(f"   Run this SQL to fix:")
                        print(f"   UPDATE store_settings SET enable_waiting_board = 1 WHERE store_id = {store_id};")
                    else:
                        print(f"\n✓ enable_waiting_board is enabled (no issue here)")
                else:
                    print(f"\n✗ No settings found for store_id {store_id}")
            else:
                print("\n✗ store_settings table not found")
        else:
            print("\n✗ store table not found")
            
    except Exception as e:
        print(f"\n✗ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    diagnose_waiting_board_issue()
