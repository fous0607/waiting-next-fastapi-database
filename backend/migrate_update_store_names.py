"""
매장 이름을 실제 상호로 업데이트하는 마이그레이션
- "1호점", "2호점" 등을 실제 매장 상호로 변경
"""

from datetime import datetime
from database import SessionLocal
from models import Store, Franchise

def main():
    db = SessionLocal()

    try:
        # 모든 매장 조회
        stores = db.query(Store).all()

        if not stores:
            print("✓ 업데이트할 매장이 없습니다.")
            return

        print(f"총 {len(stores)}개 매장을 확인합니다...\n")

        updated_count = 0
        for store in stores:
            # 프랜차이즈 정보 가져오기
            franchise = db.query(Franchise).filter(Franchise.id == store.franchise_id).first()
            franchise_name = franchise.name if franchise else "프랜차이즈"

            # 기존 이름이 "호점" 패턴인 경우에만 업데이트
            if "호점" in store.name and len(store.name) <= 4:
                # 코드를 기반으로 지점명 생성 (예: S001 -> 일산점)
                store_suffix = input(f"\n'{franchise_name} - {store.name} (코드: {store.code})'의 새로운 매장명을 입력하세요\n(예: 일산점, 강남점 등): ")

                if store_suffix:
                    new_name = f"{franchise_name} {store_suffix}"
                    old_name = store.name

                    store.name = new_name
                    store.updated_at = datetime.now()

                    print(f"✓ '{old_name}' → '{new_name}'")
                    updated_count += 1
                else:
                    print(f"✗ 건너뜀: {store.name}")
            else:
                print(f"- 변경 불필요: {store.name}")

        if updated_count > 0:
            db.commit()
            print(f"\n✓ {updated_count}개 매장 이름이 업데이트되었습니다.")
        else:
            print("\n✓ 업데이트된 매장이 없습니다.")

        # 업데이트 후 모든 매장 목록 출력
        print("\n" + "=" * 60)
        print("현재 매장 목록:")
        print("=" * 60)
        stores = db.query(Store).all()
        for store in stores:
            franchise = db.query(Franchise).filter(Franchise.id == store.franchise_id).first()
            print(f"- {store.name} (코드: {store.code}, 프랜차이즈: {franchise.name if franchise else 'N/A'})")

    except Exception as e:
        print(f"✗ 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("매장 이름 업데이트")
    print("=" * 60)
    main()
    print("=" * 60)
