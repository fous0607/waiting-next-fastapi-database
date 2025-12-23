from database import SessionLocal
from models import User, Store

db = SessionLocal()
user = db.query(User).filter(User.username == "cellstar01").first()
if user:
    print(f"User found: {user.username}, Role: {user.role}, Store ID: {user.store_id}")
    if user.store_id:
        store = db.query(Store).filter(Store.id == user.store_id).first()
        if store:
            print(f"Store found: {store.name}, Code: {store.code}")
        else:
            print("Store not found for this user.")
    else:
        print("User has no store_id.")
else:
    print("User 'cellstar01' not found.")
