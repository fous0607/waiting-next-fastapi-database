"""
공지사항 대상 유형 확장 마이그레이션
- target_type에 'franchise', 'program' 추가
- franchise_id 컬럼 추가
"""

from sqlalchemy import create_engine, Column, Integer, text
from sqlalchemy.orm import sessionmaker
import os

# 데이터베이스 URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./waiting.db")

# 엔진 생성
engine = create_engine(DATABASE_URL, echo=True)

def migrate():
    """마이그레이션 실행"""
    with engine.connect() as conn:
        # 1. franchise_id 컬럼 추가 (이미 있으면 무시)
        try:
            conn.execute(text("""
                ALTER TABLE notices 
                ADD COLUMN franchise_id INTEGER REFERENCES franchise(id)
            """))
            conn.commit()
            print("✅ franchise_id 컬럼이 추가되었습니다.")
        except Exception as e:
            print(f"⚠️  franchise_id 컬럼 추가 실패 (이미 존재할 수 있음): {e}")
            conn.rollback()
        
        # 2. 인덱스 추가
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_notices_franchise_id 
                ON notices(franchise_id)
            """))
            conn.commit()
            print("✅ franchise_id 인덱스가 추가되었습니다.")
        except Exception as e:
            print(f"⚠️  인덱스 추가 실패: {e}")
            conn.rollback()
        
        print("\n✅ 마이그레이션이 완료되었습니다!")
        print("   - target_type 값: 'all', 'selected', 'franchise', 'program'")
        print("   - franchise_id: 프랜차이즈 공지용 필드 추가")

if __name__ == "__main__":
    migrate()
