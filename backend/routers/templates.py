from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import PrintTemplate, Store
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter()

class TemplateBase(BaseModel):
    name: str
    content: str
    options: Optional[str] = None # JSON string, e.g. {"fontSize": "normal", ...}
    template_type: str = "waiting_ticket"
    is_active: bool = False

class TemplateCreate(TemplateBase):
    store_id: int

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    options: Optional[str] = None
    template_type: Optional[str] = None
    is_active: Optional[bool] = None

class TemplateResponse(TemplateBase):
    id: int
    store_id: int
    created_at: str
    updated_at: str

    class Config:
        orm_mode = True

@router.get("/", response_model=List[TemplateResponse])
def get_templates_root():
    """Handle root access (missing store_id)"""
    return [] 

@router.get("/{store_id}", response_model=List[TemplateResponse])
def get_templates(store_id: int, db: Session = Depends(get_db)):
    """Get all templates for a store"""
    templates = db.query(PrintTemplate).filter(PrintTemplate.store_id == store_id).all()
    return templates

@router.post("/", response_model=TemplateResponse)
def create_template(template: TemplateCreate, db: Session = Depends(get_db)):
    """Create a new template"""
    # If this is the first template or set to active, handle active toggle?
    # For now, just create.
    
    db_template = PrintTemplate(
        store_id=template.store_id,
        name=template.name,
        content=template.content,
        options=template.options,
        template_type=template.template_type,
        is_active=template.is_active
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    
    # If this template is active, deactivate others of the same type?
    if template.is_active:
        # Deactivate others
        others = db.query(PrintTemplate).filter(
            PrintTemplate.store_id == template.store_id,
            PrintTemplate.template_type == template.template_type,
            PrintTemplate.id != db_template.id
        ).all()
        for t in others:
            t.is_active = False
        db.commit()
        
    return db_template

@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(template_id: int, template: TemplateUpdate, db: Session = Depends(get_db)):
    """Update a template"""
    db_template = db.query(PrintTemplate).filter(PrintTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template.name is not None:
        db_template.name = template.name
    if template.content is not None:
        db_template.content = template.content
    if template.options is not None:
        db_template.options = template.options
    if template.template_type is not None:
        db_template.template_type = template.template_type
    
    if template.is_active is not None:
        db_template.is_active = template.is_active
        if template.is_active:
            # Deactivate others
            others = db.query(PrintTemplate).filter(
                PrintTemplate.store_id == db_template.store_id,
                PrintTemplate.template_type == db_template.template_type,
                PrintTemplate.id != template_id
            ).all()
            for t in others:
                t.is_active = False
    
    db.commit()
    db.refresh(db_template)
    return db_template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete a template"""
    db_template = db.query(PrintTemplate).filter(PrintTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(db_template)
    db.commit()
    return {"status": "success"}

@router.post("/preview")
def preview_template(content: str):
    """
    Generate bytes for a given template content.
    This is for the 'Test Print' button in the editor.
    """
    # Import the generator logic (not yet moved to a shared place, but will reside in printer_queue or a utils file)
    # For now, return a placeholder or call the logic if possible.
    # To keep things clean, I will implement the parser in `printer_queue` or a new `printer_parser` module and import it here.
    # For this step, I'll return empty bytes or simple text to confirm API works.
    return {"bytes": []}

@router.post("/{store_id}/init-samples")
def init_sample_templates(store_id: int, db: Session = Depends(get_db)):
    """Initialize sample templates for a store"""
    # Check if duplicates exist? Or just add.
    # The requirement is to register samples.
    
    samples = [
        {
            "name": "일반 대기표",
            "type": "waiting_ticket",
            "content": """{ALIGN:CENTER}{BOLD:ON}{SIZE:BIG}{STORE_NAME}

{SIZE:NORMAL}{BOLD:OFF}--------------------------------

{ALIGN:CENTER}{SIZE:NORMAL}대기번호
{SIZE:HUGE}{BOLD:ON}{WAITING_NUMBER}

{SIZE:NORMAL}{BOLD:OFF}--------------------------------

{DATE}

{ALIGN:CENTER}내 앞 대기: {TEAMS_AHEAD}팀
{ALIGN:CENTER}입장 순서: {ORDER}번째

{ALIGN:CENTER}{QR}
{CUT}""",
            "is_active": True
        },
        {
            "name": "간편 대기표",
            "type": "waiting_ticket",
            "content": """{ALIGN:CENTER}{SIZE:HUGE}{WAITING_NUMBER}

{ALIGN:CENTER}{SIZE:NORMAL}내 앞 대기: {TEAMS_AHEAD}팀
{CUT}""",
            "is_active": False
        },
        {
             "name": "주방 주문서",
             "type": "kitchen_order",
             "content": """{ALIGN:CENTER}[주방 주문서]
{DATE}

{SIZE:BIG}테이블: {TABLE_NO}
--------------------------------
{ORDER_ITEMS}
--------------------------------
{CUT}""",
             "is_active": False
        }
    ]
    
    created_templates = []
    for sample in samples:
        # Check specific existence by name to avoid duplicates if button clicked multiple times
        exists = db.query(PrintTemplate).filter(
            PrintTemplate.store_id == store_id,
            PrintTemplate.name == sample["name"]
        ).first()
        
        if not exists:
            db_template = PrintTemplate(
                store_id=store_id,
                name=sample["name"],
                content=sample["content"],
                template_type=sample["type"],
                is_active=sample["is_active"],
                options="{}"
            )
            db.add(db_template)
            created_templates.append(db_template)
    
    if created_templates:
        db.commit()
        for t in created_templates:
            db.refresh(t)
            
    return db.query(PrintTemplate).filter(PrintTemplate.store_id == store_id).all()
