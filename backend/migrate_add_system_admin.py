"""
시스템 관리자 계정 추가 마이그레이션
- 최상위 시스템 관리자 계정 생성
- 계정: superadmin / superadmin123
"""

import bcrypt
from datetime import datetime
from database import SessionLocal
from models import User

def hash_password(password: str) -> str:
    """비밀번호 해싱"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def main():
    db = SessionLocal()

    try:
        # 시스템 관리자 계정 존재 확인
        existing_admin = db.query(User).filter(
            User.username == "superadmin"
        ).first()

        if existing_admin:
            print("✓ 시스템 관리자 계정이 이미 존재합니다.")
            print(f"  - 사용자명: {existing_admin.username}")
            print(f"  - 역할: {existing_admin.role}")
            return

        # 시스템 관리자 계정 생성
        now = datetime.now()
        password_hash = hash_password("superadmin123")

        system_admin = User(
            username="superadmin",
            password_hash=password_hash,
            role="system_admin",
            franchise_id=None,
            store_id=None,
            is_active=True,
            created_at=now,
            updated_at=now
        )

        db.add(system_admin)
        db.commit()

        print("✓ 시스템 관리자 계정이 생성되었습니다.")
        print(f"  - 사용자명: superadmin")
        print(f"  - 비밀번호: superadmin123")
        print(f"  - 역할: system_admin")
        print(f"  - 로그인 URL: http://127.0.0.1:8000/login")
        print(f"  - 관리 페이지: http://127.0.0.1:8000/superadmin")

    except Exception as e:
        print(f"✗ 오류 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("시스템 관리자 계정 추가")
    print("=" * 60)
    main()
    print("=" * 60)
