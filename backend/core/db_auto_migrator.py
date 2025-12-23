import logging
import sqlalchemy
from sqlalchemy import inspect, text, Column
from sqlalchemy.orm import DeclarativeMeta
from typing import List, Type
from database import engine

# Logger configuration
logger = logging.getLogger("db_migrator")
logging.basicConfig(level=logging.INFO)

def get_column_type_sql(column: Column, dialect) -> str:
    """
    Generate the SQL type string for a given column.
    """
    return column.type.compile(dialect=dialect)

def get_default_value_sql(column: Column):
    """
    Extract the default value from the column definition if possible.
    Returns a SQL-safe string for the DEFAULT clause, or None.
    """
    if column.server_default is not None:
        if hasattr(column.server_default, 'arg'):
            return str(column.server_default.arg)
        return str(column.server_default)
    
    # Check for python-side default, but typically we want server defaults for migration.
    # If the column has a default value (e.g. default="some_value"), we can use it.
    if column.default is not None:
        if hasattr(column.default, 'arg'):
            arg = column.default.arg
            if isinstance(arg, (str, int, float, bool)):
                if isinstance(arg, str):
                    return f"'{arg}'"
                if isinstance(arg, bool):
                    return '1' if arg else '0'
                return str(arg)
    
    return None

def check_and_migrate_table(model: Type[DeclarativeMeta]):
    """
    Check if the table for the given model exists and sync columns.
    If the table doesn't exist, SQLAlchemy's create_all will handle it (usually).
    This function focuses on ALTER TABLE ADD COLUMN for existing tables.
    """
    table_name = model.__tablename__
    inspector = inspect(engine)
    
    # 1. Check if table exists
    if not inspector.has_table(table_name):
        logger.info(f"Table '{table_name}' does not exist. Skipping auto-migration (create_all should handle it).")
        return

    # 2. Get existing columns from Database
    existing_columns = inspector.get_columns(table_name)
    existing_column_names = {col['name'] for col in existing_columns}
    
    # 3. Get defined columns from Model
    model_columns = model.__table__.columns
    
    # 4. Identify missing columns
    missing_columns = [col for col in model_columns if col.name not in existing_column_names]
    
    if not missing_columns:
        logger.info(f"Table '{table_name}' is up to date.")
        return

    logger.info(f"Found {len(missing_columns)} missing columns in '{table_name}': {[c.name for c in missing_columns]}")

    # 5. Add missing columns
    with engine.connect() as conn:
        with conn.begin(): # Start transaction
            for col in missing_columns:
                try:
                    col_type = get_column_type_sql(col, engine.dialect)
                    sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type}'
                    
                    # Handle Defaults
                    default_val = get_default_value_sql(col)
                    if default_val is not None:
                         sql += f" DEFAULT {default_val}"
                    
                    # Handle Nullable
                    if not col.nullable and default_val is None:
                        # Safety: If adding non-null column without default to existing table with rows, it fails.
                        # We force it to be nullable initially to prevent crash, user can update later.
                        logger.warning(f"Column '{col.name}' is not nullable but has no default. Adding as NULLABLE to prevent errors.")
                    elif not col.nullable:
                        sql += " NOT NULL"
                    
                    logger.info(f"Executing: {sql}")
                    conn.execute(text(sql))
                    logger.info(f"Successfully added column '{col.name}' to '{table_name}'.")
                    
                except Exception as e:
                    logger.error(f"Failed to add column '{col.name}' to '{table_name}': {e}")
                    # We don't raise here to attempt adding other columns
