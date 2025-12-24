
import os
import sys
import sqlalchemy
from sqlalchemy import create_engine, MetaData, Table, insert, select, text, Date, DateTime
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add current directory to path to import models and database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from models import Base
from database import SQLALCHEMY_DATABASE_URL

# Configuration
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
SQLITE_PATH = os.path.join(backend_dir, "database", "waiting_system.db")
SQLITE_URL = f"sqlite:///{SQLITE_PATH}"
# Current SQLALCHEMY_DATABASE_URL is already pointing to PostgreSQL in .env
POSTGRES_URL = SQLALCHEMY_DATABASE_URL

print(f"Migrating from: {SQLITE_URL}")
print(f"Migrating to:   {POSTGRES_URL}")

def migrate():
    sqlite_engine = create_engine(SQLITE_URL)
    postgres_engine = create_engine(POSTGRES_URL)
    
    # Create tables in PostgreSQL
    print("Creating tables in PostgreSQL...")
    Base.metadata.create_all(bind=postgres_engine)
    
    sqlite_meta = MetaData()
    # Do not reflect all tables at once to avoid issues with inconsistent metadata (e.g. members_old)
    # sqlite_meta.reflect(bind=sqlite_engine)
    
    # 2. Get existing tables in SQLite for skip logic
    from sqlalchemy import inspect as sqla_inspect
    sqlite_inspector = sqla_inspect(sqlite_engine)
    existing_tables = sqlite_inspector.get_table_names()
    print(f"Found tables in SQLite: {existing_tables}")
    
    # Tables in order of dependencies
    tables_to_migrate = [
        "franchise",
        "store",
        "users",
        "store_settings",
        "members",
        "class_info",
        "waiting_list",
        "daily_closing",
        "class_closure",
        "holidays",
        "notices",
        "notice_attachments",
        "user_stores",
        "notice_stores",
        "waiting_history",
        "audit_logs",
        "settings_snapshots"
    ]
    
    # Tables in order of dependencies (already set above)
    
    with postgres_engine.connect() as pg_conn:
        # Disable constraints and triggers for migration (PostgreSQL specific)
        print("Disabling PostgreSQL constraints for session...")
        pg_conn.execute(text("SET session_replication_role = 'replica';"))
        
        # Cleanup previously failed migration attempts to avoid PK conflicts
        print("Cleaning up target tables...")
        for table_name in reversed(tables_to_migrate): # Reversed to avoid constraint issues during delete
             if table_name in Base.metadata.tables:
                 pg_conn.execute(Base.metadata.tables[table_name].delete())
        
        for table_name in tables_to_migrate:
            if table_name not in existing_tables:
                print(f"Skipping {table_name} (not found in SQLite)")
                continue
                
            print(f"Migrating table: {table_name}")
            
            # Reflect from SQLite but disable FK resolution to avoid members_old issues
            try:
                sqlite_table = Table(table_name, sqlite_meta, autoload_with=sqlite_engine, resolve_fks=False)
            except Exception as e:
                print(f"  - Error reflecting {table_name} from SQLite: {e}")
                continue
            
            pg_table = Table(table_name, Base.metadata, autoload_with=postgres_engine)
            
            # Identify common columns to avoid "no such column" errors
            sqlite_cols = {c.name for c in sqlite_table.columns}
            pg_cols = {c.name for c in pg_table.columns}
            common_col_names = [c.name for c in sqlite_table.columns if c.name in pg_cols]
            
            print(f"  - Common columns: {common_col_names}")
            
            # Read from SQLite using raw SQL to avoid automatic type conversion errors
            with sqlite_engine.connect() as sl_conn:
                cols_str = ", ".join([f'"{name}"' for name in common_col_names])
                query = text(f'SELECT {cols_str} FROM "{table_name}"')
                rows_raw = sl_conn.execute(query).mappings().all()
            
            if not rows_raw:
                print(f"  - No data in {table_name}")
                continue
            
            # 3. Process rows for type safety (especially for Date/DateTime from SQLite strings)
            from datetime import datetime, date
            import dateutil.parser
            
            rows = []
            for row_dict_raw in rows_raw:
                row_dict = dict(row_dict_raw)
                is_row_corrupt = False
                
                for col_name, value in row_dict.items():
                    if value is None: continue
                    
                    # Target column type in PG
                    pg_col = pg_table.columns[col_name]
                    
                    # Type Enforcement for PostgreSQL
                    if isinstance(pg_col.type, sqlalchemy.Integer):
                        try:
                            # Handle cases where SQLite might have stored a date string in an integer column
                            row_dict[col_name] = int(value)
                        except (ValueError, TypeError):
                            # If it's a critical column like store_id, we might want to skip the row
                            if col_name == 'store_id':
                                print(f"  - Warning: Corrupt store_id '{value}' found in {table_name}. Skipping row.")
                                is_row_corrupt = True
                            else:
                                row_dict[col_name] = 0 # Default fallback
                                
                    elif isinstance(pg_col.type, (sqlalchemy.Date, sqlalchemy.DateTime)):
                        if isinstance(value, str):
                            try:
                                dt = dateutil.parser.parse(value)
                                if isinstance(pg_col.type, sqlalchemy.Date):
                                    row_dict[col_name] = dt.date()
                                else:
                                    row_dict[col_name] = dt
                            except:
                                print(f"  - Warning: Failed to parse date '{value}' in {table_name}.{col_name}")
                
                if not is_row_corrupt:
                    rows.append(row_dict)

            # Insert into PostgreSQL in batches
            batch_size = 500
            for i in range(0, len(rows), batch_size):
                batch = rows[i:i + batch_size]
                pg_conn.execute(insert(pg_table), batch)
            
            print(f"  - Migrated {len(rows)} rows")
        
        # Reset Primary Key Sequences in PostgreSQL (Critical for Auto-Increment to work)
        print("Resetting PostgreSQL sequences...")
        for table_name in tables_to_migrate:
            if table_name in ["user_stores", "notice_stores"]: continue
            try:
                # Find the primary key column name (usually 'id')
                pg_table = Table(table_name, Base.metadata, autoload_with=postgres_engine)
                pk_col = pg_table.primary_key.columns.values()[0].name
                
                seq_sql = f"SELECT setval(pg_get_serial_sequence('\"{table_name}\"', '{pk_col}'), coalesce(max(\"{pk_col}\"), 0) + 1, false) FROM \"{table_name}\";"
                pg_conn.execute(text(seq_sql))
            except Exception as e:
                print(f"  - Skip sequence reset for {table_name}: {e}")

        pg_conn.commit()
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    confirm = input("This will overwrite/append data in PostgreSQL. Continue? (y/n): ")
    if confirm.lower() == 'y':
        migrate()
    else:
        print("Migration cancelled.")
