"""
대기자 일괄 출석 처리 스크립트 (간단 버전)

사용법:
1. 매장 ID 확인
2. 대기 중인 사용자를 출석 처리
"""

import sqlite3
from datetime import datetime

from database import DB_FILE_PATH

# 데이터베이스 연결
db_path = DB_FILE_PATH or 'database/waiting_system.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 1. 모든 매장 조회
    print("📋 매장 목록:")
    cursor.execute("SELECT id, name FROM store")
    stores = cursor.fetchall()
    
    if not stores:
        print("❌ 매장이 없습니다.")
    else:
        for store_id, store_name in stores:
            print(f"  {store_id}. {store_name}")
        
        # 2. 매장 선택
        store_id = input("\n처리할 매장 ID를 입력하세요: ")
        
        # 3. 대기 중인 사용자 조회
        cursor.execute("""
            SELECT id, waiting_number, name, phone, business_date 
            FROM waiting_list 
            WHERE store_id = ? AND status = 'waiting'
        """, (store_id,))
        
        waiting_users = cursor.fetchall()
        
        print(f"\n📊 대기 중인 사용자: {len(waiting_users)}명")
        
        if len(waiting_users) == 0:
            print("✅ 처리할 대기자가 없습니다.")
        else:
            print("\n대기자 목록:")
            for user_id, num, name, phone, biz_date in waiting_users:
                display_name = name if name else phone[-4:] if phone else "Unknown"
                print(f"  - #{num}: {display_name} ({biz_date})")
            
            # 4. 확인
            confirm = input(f"\n{len(waiting_users)}명을 출석 처리하시겠습니까? (yes/no): ")
            
            if confirm.lower() == 'yes':
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                for user_id, num, name, phone, biz_date in waiting_users:
                    cursor.execute("""
                        UPDATE waiting_list 
                        SET status = 'attended', attended_at = ?
                        WHERE id = ?
                    """, (now, user_id))
                    print(f"✅ #{num} 출석 처리")
                
                conn.commit()
                print(f"\n✅ {len(waiting_users)}명 출석 처리 완료!")
            else:
                print("❌ 취소되었습니다.")

except Exception as e:
    print(f"❌ 오류 발생: {e}")
    conn.rollback()
finally:
    conn.close()
