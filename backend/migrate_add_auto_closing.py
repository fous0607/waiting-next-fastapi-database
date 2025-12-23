import sqlite3

def migrate():
    # 데이터베이스 연결
    conn = sqlite3.connect("database/waiting_system.db")
    cursor = conn.cursor()

    try:
        # store_settings 테이블에 auto_closing 컬럼 추가
        # BOOLEAN 타입은 SQLite에서 INTEGER로 처리됨 (True=1, False=0)
        # 기본값은 True (1)
        cursor.execute("ALTER TABLE store_settings ADD COLUMN auto_closing BOOLEAN DEFAULT 1")
        conn.commit()
        print("Successfully added 'auto_closing' column to 'store_settings' table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'auto_closing' already exists.")
        else:
            print(f"Error adding column: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
