"""
교시 테이블에 요일 스케줄 컬럼 추가

ClassInfo 테이블에 weekday_schedule 컬럼을 추가하여
평일/주말 또는 특정 요일별로 클래스를 운영할 수 있도록 합니다.

weekday_schedule 형식 (JSON):
{
    "mon": true,
    "tue": true,
    "wed": true,
    "thu": true,
    "fri": true,
    "sat": false,
    "sun": false
}
"""

import sqlite3
import json

DB_PATH = 'database/waiting_system.db'

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 컬럼 존재 여부 확인
        cursor.execute("PRAGMA table_info(class_info)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'weekday_schedule' not in columns:
            print("✅ weekday_schedule 컬럼 추가 중...")

            # 기본값: 모든 요일 활성화 (JSON 문자열)
            default_schedule = json.dumps({
                "mon": True,
                "tue": True,
                "wed": True,
                "thu": True,
                "fri": True,
                "sat": True,
                "sun": True
            })

            # weekday_schedule 컬럼 추가 (기본값: 모든 요일 활성화)
            cursor.execute(f"""
                ALTER TABLE class_info
                ADD COLUMN weekday_schedule TEXT DEFAULT '{default_schedule}'
            """)

            # 기존 레코드에 기본값 설정
            cursor.execute(f"""
                UPDATE class_info
                SET weekday_schedule = '{default_schedule}'
                WHERE weekday_schedule IS NULL
            """)

            conn.commit()
            print("✅ weekday_schedule 컬럼이 추가되었습니다.")
            print(f"   기본값: 모든 요일 활성화")
        else:
            print("ℹ️  weekday_schedule 컬럼이 이미 존재합니다.")

    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 50)
    print("ClassInfo 테이블에 weekday_schedule 컬럼 추가")
    print("=" * 50)
    migrate()
    print("=" * 50)
    print("✅ 마이그레이션 완료")
    print("=" * 50)
