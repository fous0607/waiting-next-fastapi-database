from sqlalchemy.orm import Session
from models import User
from auth import get_password_hash
from core.logger import logger

def create_initial_superuser(db: Session):
    """
    시스템 시작 시 초기 슈퍼 관리자가 없으면 생성
    """
    try:
        # 시스템 관리자 존재 여부 확인
        system_admin = db.query(User).filter(User.role == "system_admin").first()
        
        if not system_admin:
            logger.info("No system admin found. Creating default superuser...")
            
            # 기본 슈퍼 관리자 생성
            password_hash = get_password_hash("superadmin123")
            
            super_user = User(
                username="superadmin",
                password_hash=password_hash,
                role="system_admin",
                is_active=True,
                # 프랜차이즈나 매장에 속하지 않음
                franchise_id=None,
                store_id=None
            )
            
            db.add(super_user)
            db.commit()
            db.refresh(super_user)
            
            logger.info(f"Default superuser created: username=superadmin, password=superadmin123")
            return True
            
        return False
    except Exception as e:
        logger.error(f"Failed to create initial superuser: {str(e)}")
        db.rollback()
        return False
