from sqlalchemy import create_engine, text
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "waiting_list.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

def list_tables():
    print(f"Inspecting DB at: {DB_PATH}")
    engine = create_engine(DATABASE_URL)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
        tables = [row[0] for row in result.fetchall()]
        print("Tables found:", tables)

if __name__ == "__main__":
    list_tables()
