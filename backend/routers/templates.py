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
    template_type: str = "waiting_ticket"
    is_active: bool = False

class TemplateCreate(TemplateBase):
    store_id: int

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    template_type: Optional[str] = None
    is_active: Optional[bool] = None

class TemplateResponse(TemplateBase):
    id: int
    store_id: int
    created_at: str
    updated_at: str

    class Config:
        orm_mode = True

@router.get("/{store_id}", response_model=List[TemplateResponse])
def get_templates(store_id: int, db: Session = Depends(get_db)):
    """Get all templates for a store"""
    templates = db.query(PrintTemplate).filter(PrintTemplate.store_id == store_id).all()
    # Pydantic v1/v2 compatibility: Manually map if needed, but orm_mode should handle it
    # Converting datetime to string for simple JSON response if needed, but Pydantic handles it.
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
