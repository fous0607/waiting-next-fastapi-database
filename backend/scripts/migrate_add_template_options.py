
from sqlalchemy import create_engine, text
import os

# Database URL
DATABASE_URL = "sqlite:///./backend/database/waiting_system.db"  # Adjust if your DB path is different
if not os.path.exists("./backend/database/waiting_system.db"):
    DATABASE_URL = "sqlite:///./database/waiting_system.db"

def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        try:
            # Check if column exists
            result = conn.execute(text("PRAGMA table_info(print_templates)"))
            columns = [row[1] for row in result.fetchall()]
            
            if "options" not in columns:
                print("Adding 'options' column to print_templates table...")
                conn.execute(text("ALTER TABLE print_templates ADD COLUMN options TEXT"))
                print("Column added successfully.")
            else:
                print("'options' column already exists.")
                
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
