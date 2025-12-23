"""
기존 'all' 타입 클래스들을 'weekday' 타입으로 변환

기존 클래스들이 모두 'all' 타입으로 되어 있어 평일/주말 구분이 명확하지 않습니다.
이 스크립트는 'all' 타입 클래스들을 'weekday' 타입으로 변환합니다.
"""

import sqlite3

def migrate():
    conn = sqlite3.connect('database/waiting_system.db')
    cursor = conn.cursor()

    try:
        # 현재 'all' 타입인 클래스 개수 확인
        cursor.execute("SELECT COUNT(*) FROM class_info WHERE class_type = 'all'")
        all_count = cursor.fetchone()[0]

        print(f"✅ 현재 'all' 타입 클래스: {all_count}개")

        if all_count == 0:
            print("ℹ️  변환할 클래스가 없습니다.")
            return

        # 'all' 타입 클래스들을 'weekday' 타입으로 변경
        # weekday_schedule도 평일만 true로 설정
        cursor.execute("""
            UPDATE class_info
            SET class_type = 'weekday',
                weekday_schedule = '{"mon": true, "tue": true, "wed": true, "thu": true, "fri": true, "sat": false, "sun": false}'
            WHERE class_type = 'all'
        """)

        conn.commit()
        print(f"✅ {all_count}개의 클래스를 'all' → 'weekday'로 변환했습니다.")
        print("   평일(월-금)만 운영되도록 설정되었습니다.")

        # 변환 결과 확인
        cursor.execute("""
            SELECT class_type, COUNT(*)
            FROM class_info
            GROUP BY class_type
        """)
        results = cursor.fetchall()

        print("\n📊 변환 후 클래스 타입별 개수:")
        for class_type, count in results:
            type_label = {
                'weekday': '평일',
                'weekend': '주말',
                'all': '전체'
            }.get(class_type, class_type)
            print(f"   - {type_label}: {count}개")

    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("기존 'all' 타입 클래스를 'weekday' 타입으로 변환")
    print("=" * 60)

    response = input("변환을 진행하시겠습니까? (y/n): ")
    if response.lower() == 'y':
        migrate()
        print("=" * 60)
        print("✅ 마이그레이션 완료")
        print("=" * 60)
    else:
        print("마이그레이션이 취소되었습니다.")
