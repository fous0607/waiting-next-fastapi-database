import sqlite3

def migrate():
    conn = sqlite3.connect('database/waiting_system.db')
    cursor = conn.cursor()
    
    columns = [
        ("manager_font_family", "TEXT", "'Nanum Gothic'"),
        ("manager_font_size", "TEXT", "'15px'"),
        ("board_font_family", "TEXT", "'Nanum Gothic'"),
        ("board_font_size", "TEXT", "'24px'")
    ]
    
    for col, type_aff, default in columns:
        try:
            cursor.execute(f"ALTER TABLE store_settings ADD COLUMN {col} {type_aff} DEFAULT {default}")
            print(f"Added column {col}")
        except sqlite3.OperationalError as e:
            print(f"Column {col} already exists or error: {e}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
