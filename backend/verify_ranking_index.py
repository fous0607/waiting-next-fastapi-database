import sqlite3
import os
from datetime import date

DB_PATH = 'waiting_system.db'

def verify_query_plan():
    if not os.path.exists(DB_PATH):
        print(f"Database file '{DB_PATH}' not found.")
        return

    conn = sqlite3.connect('database/waiting_system.db')
    cursor = conn.cursor()

    # Query from routers/statistics.py get_attendance_ranking logic
    # Simplified for EXPLAIN query
    
    # We want to see if it uses the indices: ix_waiting_list_status, ix_waiting_list_attended_at, ix_waiting_list_member_id
    sql = """
    EXPLAIN QUERY PLAN
    SELECT 
        m.id, m.name, m.phone, s.name, count(w.id), max(w.attended_at)
    FROM 
        members m
    JOIN 
        waiting_list w ON m.id = w.member_id
    JOIN 
        store s ON w.store_id = s.id
    WHERE 
        w.status = 'attended' 
        AND w.attended_at BETWEEN '2024-01-01 00:00:00' AND '2024-12-31 23:59:59'
    GROUP BY 
        m.id, m.name, m.phone, s.name
    ORDER BY 
        count(w.id) DESC
    """
    
    print("Executing EXPLAIN QUERY PLAN...")
    try:
        cursor.execute(sql)
        rows = cursor.fetchall()
        for row in rows:
            print(row)
            
        # Check against expected usage
        # We look for "USING INDEX" and the index names
        output = str(rows)
        if "ix_waiting_list_status" in output or "ix_waiting_list_attended_at" in output or "ix_waiting_list_member_id" in output:
             print("\nSUCCESS: Query is using the new indexes.")
        else:
             print("\nWARNING: Query might NOT be using the new indexes explicitly in the plan (SQLite might optimize differently). Check output detail.")
             
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    verify_query_plan()
