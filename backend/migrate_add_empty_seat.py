"""
데이터베이스 마이그레이션: waiting_list 테이블에 is_empty_seat 컬럼 추가
"""
import sqlite3

def migrate():
    # 데이터베이스 연결
    conn = sqlite3.connect(DB_PATH = 'database/waiting_system.db')
    cursor = conn.cursor()

    try:
        # is_empty_seat 컬럼 추가 (기본값 False)
        cursor.execute('''
            ALTER TABLE waiting_list
            ADD COLUMN is_empty_seat BOOLEAN DEFAULT 0
        ''')

        conn.commit()
        print("✅ 마이그레이션 성공: is_empty_seat 컬럼이 추가되었습니다.")

    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("ℹ️  is_empty_seat 컬럼이 이미 존재합니다.")
        else:
            print(f"❌ 마이그레이션 실패: {e}")
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
