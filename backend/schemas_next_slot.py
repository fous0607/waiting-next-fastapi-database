
from pydantic import BaseModel

class NextSlotResponse(BaseModel):
    class_id: int
    class_name: str
    class_order: int
    max_capacity: int
    is_full: bool
    total_waiting: int # For the store
