"""
데이터베이스 마이그레이션: class_closure 테이블 추가
"""
import sqlite3

DB_PATH = 'database/waiting_system.db'

def migrate():
    # 데이터베이스 연결
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # class_closure 테이블 생성
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS class_closure (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_date DATE NOT NULL,
                class_id INTEGER NOT NULL,
                closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES class_info (id)
            )
        ''')

        # 인덱스 생성
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_class_closure_business_date
            ON class_closure (business_date)
        ''')

        conn.commit()
        print("✅ 마이그레이션 성공: class_closure 테이블이 추가되었습니다.")

    except sqlite3.OperationalError as e:
        print(f"❌ 마이그레이션 실패: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
