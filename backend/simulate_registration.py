
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from routers.waiting import get_available_class
from database import get_db
from models import Store
from datetime import date
import sqlite3 # Added import for sqlite3

# Setup DB
# The original instruction was syntactically incorrect.
# Assuming the intent was to change the database path for SQLAlchemy,
# and potentially introduce a direct sqlite3 connection for other purposes,
# but keep the SQLAlchemy setup for the existing code.
# If the intent was to replace SQLAlchemy entirely, more changes would be needed.
# For now, I'm interpreting "Update sqlite3.connect path" as changing the path
# for the SQLite database, and the `conn = sqlite3.connect(...)` as an
# additional line the user wanted to add, possibly for direct interaction.
# However, to maintain syntactical correctness and the existing SQLAlchemy flow,
# I will update the SQLALCHEMY_DATABASE_URL to reflect the new path
# and add the sqlite3.connect line as a separate, new line.

SQLALCHEMY_DATABASE_URL = "sqlite:///database/waiting_system.db" # Updated path
conn = sqlite3.connect('database/waiting_system.db') # Added this line as per instruction
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def test_logic():
    print("--- Simulating Class Assignment Logic ---")
    store_id = 4
    business_date = date(2025, 12, 8)
    
    try:
        available_class, count = get_available_class(db, business_date, store_id)
        print(f"RESULT: Assigned to Class '{available_class.class_name}' (ID: {available_class.id})")
        print(f"Wait Count: {count}")
        
        if available_class.id == 33:
            print("SUCCESS: Correctly assigned to 4th period.")
        elif available_class.id == 34:
            print("FAILURE: Assigned to 5th period (Skipped 4th).")
        else:
            print(f"FAILURE: Assigned to {available_class.class_name} (ID {available_class.id})")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    test_logic()
