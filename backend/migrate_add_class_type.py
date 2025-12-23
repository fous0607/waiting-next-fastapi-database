"""
교시 테이블에 class_type 컬럼 추가

평일과 주말 클래스를 구분하기 위한 class_type 컬럼 추가
- weekday: 평일 전용 클래스
- weekend: 주말 전용 클래스
- all: 모든 요일 운영 (선택적)
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

        if 'class_type' not in columns:
            print("✅ class_type 컬럼 추가 중...")

            # class_type 컬럼 추가 (기본값: 'all')
            cursor.execute("""
                ALTER TABLE class_info
                ADD COLUMN class_type TEXT DEFAULT 'all'
            """)

            # 기존 레코드의 class_type을 weekday_schedule 기반으로 설정
            cursor.execute("SELECT id, weekday_schedule FROM class_info")
            rows = cursor.fetchall()

            for row_id, schedule_str in rows:
                try:
                    schedule = json.loads(schedule_str) if schedule_str else {}

                    # 평일 체크 (월-금)
                    weekdays = [schedule.get('mon'), schedule.get('tue'), schedule.get('wed'),
                               schedule.get('thu'), schedule.get('fri')]
                    # 주말 체크 (토-일)
                    weekends = [schedule.get('sat'), schedule.get('sun')]

                    has_weekday = any(weekdays)
                    has_weekend = any(weekends)

                    if has_weekday and not has_weekend:
                        class_type = 'weekday'
                    elif has_weekend and not has_weekday:
                        class_type = 'weekend'
                    else:
                        class_type = 'all'

                    cursor.execute("UPDATE class_info SET class_type = ? WHERE id = ?",
                                 (class_type, row_id))
                    print(f"   - ID {row_id}: {class_type}")

                except (json.JSONDecodeError, TypeError) as e:
                    print(f"   - ID {row_id}: 기본값 'all' 사용 (파싱 오류)")
                    cursor.execute("UPDATE class_info SET class_type = 'all' WHERE id = ?", (row_id,))

            conn.commit()
            print("✅ class_type 컬럼이 추가되고 기존 데이터가 업데이트되었습니다.")
        else:
            print("ℹ️  class_type 컬럼이 이미 존재합니다.")

    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("ClassInfo 테이블에 class_type 컬럼 추가")
    print("=" * 60)
    migrate()
    print("=" * 60)
    print("✅ 마이그레이션 완료")
    print("=" * 60)
