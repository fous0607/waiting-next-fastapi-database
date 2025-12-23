"""
데이터베이스 테이블 생성/업데이트
"""

from database import engine, Base
from models import Notice, Franchise, Store, User

# 모든 테이블 생성
Base.metadata.create_all(bind=engine)

print("✅ 데이터베이스 테이블이 생성/업데이트되었습니다!")
print("   - Notice 테이블에 franchise_id 필드가 추가되었습니다.")
