"""
데이터베이스 마이그레이션: store_settings 테이블에 block_last_class_registration 컬럼 추가
"""
import sqlite3

def migrate():
    # 데이터베이스 연결
    DB_PATH = 'database/waiting_system.db'
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # block_last_class_registration 컬럼 추가 (기본값 0 = False)
        cursor.execute('''
            ALTER TABLE store_settings
            ADD COLUMN block_last_class_registration INTEGER DEFAULT 0
        ''')

        conn.commit()
        print("✅ 마이그레이션 성공: block_last_class_registration 컬럼이 추가되었습니다.")

    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("ℹ️  block_last_class_registration 컬럼이 이미 존재합니다.")
        else:
            print(f"❌ 마이그레이션 실패: {e}")
            raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
