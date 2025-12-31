from sqlalchemy import create_engine, text
import os

# DB 경로 설정 (필요시 수정)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "waiting_list.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

def migrate():
    engine = create_engine(DATABASE_URL)
    connection = engine.connect()

    print(f"Migrating database at {DB_PATH}...")

    try:
        # 1. enable_printer 추가
        try:
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN enable_printer BOOLEAN DEFAULT 0"))
            print("Added column: enable_printer")
        except Exception as e:
            print(f"Skipping enable_printer (might exist): {e}")

        # 2. printer_connection_type 추가
        try:
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN printer_connection_type VARCHAR DEFAULT 'lan'"))
            print("Added column: printer_connection_type")
        except Exception as e:
            print(f"Skipping printer_connection_type (might exist): {e}")

        # 3. printer_ip_address 추가
        try:
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN printer_ip_address VARCHAR NULL"))
            print("Added column: printer_ip_address")
        except Exception as e:
            print(f"Skipping printer_ip_address (might exist): {e}")

        # 4. printer_port 추가
        try:
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN printer_port INTEGER DEFAULT 9100"))
            print("Added column: printer_port")
        except Exception as e:
            print(f"Skipping printer_port (might exist): {e}")
            
        # 5. auto_print_registration 추가
        try:
            connection.execute(text("ALTER TABLE store_settings ADD COLUMN auto_print_registration BOOLEAN DEFAULT 1"))
            print("Added column: auto_print_registration")
        except Exception as e:
            print(f"Skipping auto_print_registration (might exist): {e}")

        connection.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
