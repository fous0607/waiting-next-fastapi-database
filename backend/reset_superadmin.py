from database import SessionLocal
from models import User
from auth import get_password_hash
from core.logger import logger

def reset_superadmin():
    db = SessionLocal()
    try:
        # Check if superadmin already exists
        user = db.query(User).filter(User.username == "superadmin").first()
        
        password_hash = get_password_hash("superadmin123")
        
        if user:
            logger.info("Superadmin already exists. Resetting password and role...")
            user.password_hash = password_hash
            user.role = "system_admin"
            user.is_active = True
        else:
            logger.info("Superadmin does not exist. Creating new superadmin...")
            user = User(
                username="superadmin",
                password_hash=password_hash,
                role="system_admin",
                is_active=True,
                franchise_id=None,
                store_id=None
            )
            db.add(user)
        
        db.commit()
        logger.info("Superadmin account has been successfully reset: username=superadmin, password=superadmin123")
        print("Superadmin account has been successfully reset: username=superadmin, password=superadmin123")
    except Exception as e:
        logger.error(f"Failed to reset superadmin: {e}")
        print(f"Failed to reset superadmin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_superadmin()
