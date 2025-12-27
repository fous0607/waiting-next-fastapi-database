import psycopg2
import os

def diagnose_postgres():
    """Diagnose waiting board issue in PostgreSQL database"""
    
    # Connection string from .env
    db_url = "postgresql://root:mariushostingroot@posagent.kr:2665/waiting_system"
    
    try:
        print(f"🔌 Connecting to PostgreSQL...")
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Find ss012 store
        cursor.execute("SELECT id, code, name FROM store WHERE code='ss012'")
        store = cursor.fetchone()
        
        if not store:
            print("✗ Store 'ss012' not found in database")
            return
        
        store_id, store_code, store_name = store
        print(f"\n✓ Found store: {store_name} (ID: {store_id}, Code: {store_code})")
        
        # Check store settings
        cursor.execute("""
            SELECT enable_waiting_board, enable_reception_desk 
            FROM store_settings 
            WHERE store_id = %s
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
                print(f"   1. Via Settings UI: Settings → Operation Rules → Enable '대기현황판 사용'")
                print(f"   2. Via SQL:")
                print(f"      UPDATE store_settings SET enable_waiting_board = true WHERE store_id = {store_id};")
                
                # Offer to fix it
                fix = input(f"\n❓ Do you want to enable it now? (y/n): ")
                if fix.lower() == 'y':
                    cursor.execute("""
                        UPDATE store_settings 
                        SET enable_waiting_board = true 
                        WHERE store_id = %s
                    """, (store_id,))
                    conn.commit()
                    print(f"✅ enable_waiting_board has been ENABLED for {store_name}")
                    print(f"   Please refresh the waiting board page to reconnect.")
            else:
                print(f"\n✓ enable_waiting_board is ENABLED")
                print(f"\n🤔 The setting is correct. Other possible issues:")
                print(f"   1. Check browser console for JavaScript errors")
                print(f"   2. Verify localStorage has correct 'selected_store_id' = {store_id}")
                print(f"   3. Check network tab for /api/sse/stream connection")
        else:
            print(f"\n✗ No settings found for store_id {store_id}")
            
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"\n✗ Error: {e}")

if __name__ == "__main__":
    diagnose_postgres()
