
import sys
import os
from sqlalchemy import create_engine, inspect
from database import Base, SQLALCHEMY_DATABASE_URL
from main import load_env_file

# Explicitly load env file first
load_env_file()

# Re-import to get the updated variable if it wasn't set at module level
from database import SQLALCHEMY_DATABASE_URL

def verify_connection():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("❌ DATABASE_URL not found in environment variables.")
        return False
        
    print(f"Connecting to: {url.split('@')[1] if '@' in url else 'Invalid URL Format'}") 
    
    # Handle postgres:// replacement for SQLAlchemy
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
        
    try:
        engine = create_engine(url)
        connection = engine.connect()
        print("✅ Connection successful!")
        
        # Check if tables exist
        inspector = inspect(engine)
        # Handle case where get_tables might return None or error
        try:
            tables = inspector.get_table_names()
        except:
             # Fallback or specific dialect handling
             tables = inspector.get_tables() if hasattr(inspector, 'get_tables') else []

        print(f"Found {len(tables)} tables: {tables}")
        
        if not tables:
            print("⚠️ No tables found. Running table creation...")
            Base.metadata.create_all(bind=engine)
            print("✅ Tables created successfully.")
            
        connection.close()
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    if verify_connection():
        sys.exit(0)
    else:
        sys.exit(1)
