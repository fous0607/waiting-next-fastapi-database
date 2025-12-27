
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, SQLALCHEMY_DATABASE_URL
from models import User
from auth import get_password_hash
from main import load_env_file

# Load env vars
load_env_file()

# Re-import to get updated URL
from database import SQLALCHEMY_DATABASE_URL

def check_superuser():
    print(f"Checking database at: {SQLALCHEMY_DATABASE_URL.split('@')[1] if '@' in SQLALCHEMY_DATABASE_URL else '...' }")
    
    url = os.environ.get("DATABASE_URL")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Check if user table exists and has entries
        user_count = session.query(User).count()
        print(f"Total users in DB: {user_count}")
        
        admin = session.query(User).filter(User.username == "superadmin").first()
        
        if admin:
            print(f"✅ Superadmin exists. ID: {admin.id}, Role: {admin.role}")
            # Reset password to ensure it's known
            new_hash = get_password_hash("superadmin123")
            admin.password_hash = new_hash
            session.commit()
            print("🔄 Reset superadmin password to 'superadmin123'")
        else:
            print("⚠️ Superadmin NOT found. Creating...")
            password_hash = get_password_hash("superadmin123")
            new_admin = User(
                username="superadmin",
                password_hash=password_hash,
                role="system_admin",
                is_active=True
            )
            session.add(new_admin)
            session.commit()
            print("✅ Created superadmin with password 'superadmin123'")
            
    except Exception as e:
        print(f"❌ Error during check: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    check_superuser()
