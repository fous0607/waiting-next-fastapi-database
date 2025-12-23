"""
불광지점 대기자 일괄 출석 처리 스크립트

영업 종료 후 남아있는 대기자 9명을 출석 처리합니다.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# 데이터베이스 연결
DATABASE_URL = "sqlite:///./waiting.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    # 불광지점 조회 (store_id를 확인해야 함)
    from models import Store, WaitingList
    
    # 불광지점 찾기
    store = db.query(Store).filter(Store.name.like('%불광%')).first()
    
    if not store:
        print("❌ 불광지점을 찾을 수 없습니다.")
        print("사용 가능한 매장:")
        stores = db.query(Store).all()
        for s in stores:
            print(f"  - {s.name} (ID: {s.id})")
    else:
        print(f"✅ 매장 찾음: {store.name} (ID: {store.id})")
        
        # 대기 중인 사용자 조회
        waiting_users = db.query(WaitingList).filter(
            WaitingList.store_id == store.id,
            WaitingList.status == 'waiting'
        ).all()
        
        print(f"\n📊 대기 중인 사용자: {len(waiting_users)}명")
        
        if len(waiting_users) == 0:
            print("✅ 처리할 대기자가 없습니다.")
        else:
            print("\n대기자 목록:")
            for w in waiting_users:
                print(f"  - #{w.waiting_number}: {w.name or w.phone[-4:]} ({w.business_date})")
            
            # 확인
            confirm = input(f"\n{len(waiting_users)}명을 출석 처리하시겠습니까? (yes/no): ")
            
            if confirm.lower() == 'yes':
                for waiting in waiting_users:
                    waiting.status = 'attended'
                    waiting.attended_at = datetime.now()
                    print(f"✅ #{waiting.waiting_number} 출석 처리")
                
                db.commit()
                print(f"\n✅ {len(waiting_users)}명 출석 처리 완료!")
            else:
                print("❌ 취소되었습니다.")

except Exception as e:
    print(f"❌ 오류 발생: {e}")
    db.rollback()
finally:
    db.close()
