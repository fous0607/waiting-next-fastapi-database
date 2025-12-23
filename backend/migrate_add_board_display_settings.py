"""
대기현황판 표시 설정 컬럼 추가 마이그레이션

추가되는 컬럼:
- show_waiting_number: 대기번호 표시 유무
- mask_customer_name: 이름 마스킹 유무
- show_order_number: 순번 표시 유무
- board_display_order: 표시 순서
"""

import sqlite3
from pathlib import Path

def migrate():
    db_path = Path(__file__).parent / 'database/waiting_system.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 컬럼 존재 여부 확인
        cursor.execute("PRAGMA table_info(store_settings)")
        columns = [col[1] for col in cursor.fetchall()]

        # show_waiting_number 컬럼 추가
        if 'show_waiting_number' not in columns:
            print("Adding show_waiting_number column...")
            cursor.execute("""
                ALTER TABLE store_settings
                ADD COLUMN show_waiting_number BOOLEAN DEFAULT 1
            """)
            print("✓ show_waiting_number column added")

        # mask_customer_name 컬럼 추가
        if 'mask_customer_name' not in columns:
            print("Adding mask_customer_name column...")
            cursor.execute("""
                ALTER TABLE store_settings
                ADD COLUMN mask_customer_name BOOLEAN DEFAULT 0
            """)
            print("✓ mask_customer_name column added")

        # show_order_number 컬럼 추가
        if 'show_order_number' not in columns:
            print("Adding show_order_number column...")
            cursor.execute("""
                ALTER TABLE store_settings
                ADD COLUMN show_order_number BOOLEAN DEFAULT 1
            """)
            print("✓ show_order_number column added")

        # board_display_order 컬럼 추가
        if 'board_display_order' not in columns:
            print("Adding board_display_order column...")
            cursor.execute("""
                ALTER TABLE store_settings
                ADD COLUMN board_display_order TEXT DEFAULT 'number,name,order'
            """)
            print("✓ board_display_order column added")

        conn.commit()
        print("\n✅ Migration completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
