from sqlalchemy import create_engine, text
import sys
import os

# Add parent directory to path to import models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SQLALCHEMY_DATABASE_URL as DATABASE_URL

def migrate():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if table exists
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='print_templates'"))
        if result.fetchone():
            print("Table 'print_templates' already exists.")
            return

        print("Creating 'print_templates' table...")
        
        # Create table manually to avoid alembic/model issues for this hot-fix style adding
        conn.execute(text("""
            CREATE TABLE print_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id INTEGER NOT NULL,
                name VARCHAR NOT NULL,
                content TEXT NOT NULL,
                template_type VARCHAR DEFAULT 'waiting_ticket',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(store_id) REFERENCES store(id)
            )
        """))
        
        # Add index
        conn.execute(text("CREATE INDEX ix_print_templates_store_id ON print_templates (store_id)"))
        conn.execute(text("CREATE INDEX ix_print_templates_id ON print_templates (id)"))
        
        conn.commit()
        print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
