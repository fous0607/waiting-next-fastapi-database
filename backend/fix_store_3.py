
from database import SessionLocal
from models import ClassInfo, Store

def fix_store_3():
    db = SessionLocal()
    try:
        # Find Store 3
        store = db.query(Store).filter(Store.id == 3).first()
        if not store:
            print("Store 3 not found")
            return

        print(f"Store 3: {store.name}")
        
        # Find classes for Store 3
        classes = db.query(ClassInfo).filter(
            ClassInfo.store_id == 3
        ).all()
        
        print(f"Found {len(classes)} classes.")
        
        for cls in classes:
            print(f"Updating Class {cls.id} ({cls.class_name}) type from {cls.class_type} to 'all'")
            cls.class_type = 'all'
            
        db.commit()
        print("Update complete.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_store_3()
