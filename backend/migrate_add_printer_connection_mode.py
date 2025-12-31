from sqlalchemy import create_engine, text
import os

# DB 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "waiting_list.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

def migrate():
    engine = create_engine(DATABASE_URL)
    connection = engine.connect()

    print(f"Migrating database at {DB_PATH}...")

    try:
        # 1. printer_connection_mode 추가
        try:
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN printer_connection_mode VARCHAR DEFAULT 'local_proxy'"))
            print("Added column: printer_connection_mode")
        except Exception as e:
            print(f"Skipping printer_connection_mode (might exist): {e}")

        # 2. printer_proxy_ip 추가
        try:
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN printer_proxy_ip VARCHAR DEFAULT 'localhost'"))
            print("Added column: printer_proxy_ip")
        except Exception as e:
            print(f"Skipping printer_proxy_ip (might exist): {e}")

        connection.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
