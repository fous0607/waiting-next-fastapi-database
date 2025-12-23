import sqlite3
import os
from datetime import datetime, timedelta

from database import DB_FILE_PATH
DB_FILE = DB_FILE_PATH or "database/waiting_system.db"

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def setup_test_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        print("Setting up test data for stats...")
        
        # 1. Create Franchise & Store if not exists (reusing existing if possible)
        cursor.execute("SELECT id FROM franchise LIMIT 1")
        franchise = cursor.fetchone()
        if not franchise:
            cursor.execute("INSERT INTO franchise (name, code, is_active) VALUES ('Stats Franchise', 'STATS_FRAN', 1)")
            franchise_id = cursor.lastrowid
        else:
            franchise_id = franchise['id']
            
        cursor.execute("SELECT id FROM store WHERE franchise_id = ? LIMIT 1", (franchise_id,))
        store = cursor.fetchone()
        if not store:
            cursor.execute("INSERT INTO store (franchise_id, name, code, is_active) VALUES (?, 'Stats Store', 'STATS_STORE', 1)", (franchise_id,))
            store_id = cursor.lastrowid
        else:
            store_id = store['id']
            
        # 2. Create Member
        cursor.execute("INSERT INTO members (store_id, name, phone) VALUES (?, 'Stats User', '01088888888')", (store_id,))
        member_id = cursor.lastrowid
        
        # 3. Create Attendance Records
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        
        # Today attendance
        cursor.execute("""
            INSERT INTO waiting_list (store_id, member_id, phone, status, waiting_number, class_id, class_order, call_count, registered_at, attended_at, business_date)
            VALUES (?, ?, '01088888888', 'attended', 1, 1, 1, 0, ?, ?, ?)
        """, (store_id, member_id, datetime.now(), datetime.now(), today))
        
        # Yesterday attendance
        cursor.execute("""
            INSERT INTO waiting_list (store_id, member_id, phone, status, waiting_number, class_id, class_order, call_count, registered_at, attended_at, business_date)
            VALUES (?, ?, '01088888888', 'attended', 1, 1, 1, 0, ?, ?, ?)
        """, (store_id, member_id, datetime.combine(yesterday, datetime.min.time()), datetime.combine(yesterday, datetime.min.time()), yesterday))
        
        conn.commit()
        print(f"Test data created. Franchise ID: {franchise_id}, Member ID: {member_id}")
        return franchise_id, member_id
        
    except Exception as e:
        print(f"Setup failed: {e}")
        conn.rollback()
        return None, None
    finally:
        conn.close()

def verify_stats(franchise_id, member_id):
    # Since we can't easily call the API via HTTP in this script without running server,
    # we will simulate the SQL queries used in the API.
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        print("\nVerifying Statistics Queries...")
        
        # 1. Ranking Query
        print("1. Testing Ranking Query...")
        cursor.execute("""
            SELECT m.name, COUNT(w.id) as count
            FROM members m
            JOIN waiting_list w ON m.id = w.member_id
            WHERE w.status = 'attended'
            GROUP BY m.id
            ORDER BY count DESC
            LIMIT 5
        """)
        rankings = cursor.fetchall()
        for r in rankings:
            print(f"   - {r['name']}: {r['count']} visits")
            if r['name'] == 'Stats User' and r['count'] >= 2:
                print("   -> Ranking Verification PASSED")
                
        # 2. Trends Query (Daily)
        print("\n2. Testing Trends Query (Daily)...")
        cursor.execute("""
            SELECT strftime('%Y-%m-%d', attended_at) as period, COUNT(id) as count
            FROM waiting_list
            WHERE status = 'attended'
            GROUP BY period
            ORDER BY period DESC
            LIMIT 5
        """)
        trends = cursor.fetchall()
        for t in trends:
            print(f"   - {t['period']}: {t['count']}")
            
        print("\nVerification Complete.")
        
        # Cleanup
        cursor.execute("DELETE FROM waiting_list WHERE member_id = ?", (member_id,))
        cursor.execute("DELETE FROM members WHERE id = ?", (member_id,))
        conn.commit()
        
    except Exception as e:
        print(f"Verification failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fid, mid = setup_test_data()
    if fid and mid:
        verify_stats(fid, mid)
