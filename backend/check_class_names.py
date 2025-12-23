from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import ClassInfo

from database import SQLALCHEMY_DATABASE_URL
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def check_class_names():
    classes = db.query(ClassInfo).filter(ClassInfo.id.in_([30, 31, 32])).all()
    for c in classes:
        print(f"ID: {c.id} | Name: {c.class_name} | Number: {c.class_number}")

if __name__ == "__main__":
    check_class_names()
    db.close()
