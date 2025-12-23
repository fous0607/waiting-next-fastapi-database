"""
데이터베이스 마이그레이션: store_settings 테이블에 use_max_waiting_limit 컬럼 추가
"""
import sqlite3

DB_PATH = 'database/waiting_system.db'

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # use_max_waiting_limit 컬럼 추가 (기본값 TRUE - 기존 동작 유지)
        cursor.execute("""
            ALTER TABLE store_settings
            ADD COLUMN use_max_waiting_limit BOOLEAN DEFAULT 1
        """)
        
        conn.commit()
        print("✅ 마이그레이션 성공: use_max_waiting_limit 컬럼이 추가되었습니다.")
        print("   기본값: TRUE (기존 동작 유지)")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("ℹ️  use_max_waiting_limit 컬럼이 이미 존재합니다.")
        else:
            print(f"❌ 마이그레이션 실패: {e}")
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
