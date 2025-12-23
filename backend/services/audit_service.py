from sqlalchemy.orm import Session
from models import AuditLog
import json
from datetime import datetime

class AuditService:
    @staticmethod
    def log(
        db: Session,
        action: str,
        target_type: str,
        target_id: int = None,
        user_id: int = None,
        store_id: int = None,
        old_value: dict = None,
        new_value: dict = None,
        ip_address: str = None
    ):
        """
        Create an audit log entry.
        Safe to call from anywhere (catches exceptions to prevent breaking main logic).
        """
        try:
            # Convert dicts to JSON strings
            old_val_str = json.dumps(old_value, default=str, ensure_ascii=False) if old_value else None
            new_val_str = json.dumps(new_value, default=str, ensure_ascii=False) if new_value else None
            
            log_entry = AuditLog(
                store_id=store_id,
                user_id=user_id,
                action=action,
                target_type=target_type,
                target_id=target_id,
                old_value=old_val_str,
                new_value=new_val_str,
                ip_address=ip_address,
                created_at=datetime.now()
            )
            
            db.add(log_entry)
            db.commit()
            
        except Exception as e:
            print(f"Failed to create audit log: {e}")
            # Do not rollback main transaction or raise error, audit logging shouldn't panic app
            pass
