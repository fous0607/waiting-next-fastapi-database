from sqlalchemy import create_engine, text
from database import SQLALCHEMY_DATABASE_URL as DATABASE_URL
import os

# 데이터베이스 파일 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
conn = sqlite3.connect('database/waiting_system.db')
DATABASE_URL = f"sqlite:///{DB_PATH}"

def migrate():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Checking store_settings table...")
        
        # closing_action 컬럼 확인
        try:
            result = conn.execute(text("SELECT closing_action FROM store_settings LIMIT 1"))
            print("closing_action column already exists.")
        except Exception:
            print("Adding closing_action column...")
            try:
                # SQLite에서는 ALTER TABLE로 컬럼 추가 가능
                conn.execute(text("ALTER TABLE store_settings ADD COLUMN closing_action VARCHAR DEFAULT 'reset'"))
                conn.commit()
                print("Successfully added closing_action column.")
            except Exception as e:
                print(f"Error adding column: {e}")

if __name__ == "__main__":
    migrate()
