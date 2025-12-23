import sqlite3

def migrate():
    conn = sqlite3.connect('database/waiting_system.db')
    cursor = conn.cursor()
    
    try:
        # daily_opening_rule 컬럼 추가 (기본값: flexible - 기존 동작과 유사하게 다음날로 넘기는 것 등 허용)
        # strict: 1일 1회 개점만 허용
        # flexible: 2회 이상 개점 허용 (다음날로 처리)
        cursor.execute("ALTER TABLE store_settings ADD COLUMN daily_opening_rule TEXT DEFAULT 'strict'")
        print("Added column daily_opening_rule to store_settings")
    except sqlite3.OperationalError as e:
        print(f"Column already exists or error: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
