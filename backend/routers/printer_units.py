from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from auth import get_current_user

router = APIRouter(prefix="/printer-units", tags=["Printer Units"])

@router.get("/", response_model=schemas.UnitRegistryResponse)
def get_units(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.store_id:
        raise HTTPException(status_code=400, detail="User not assigned to a store")
    
    proxies = db.query(models.ProxyUnit).filter(models.ProxyUnit.store_id == current_user.store_id).all()
    printers = db.query(models.PrinterUnit).filter(models.PrinterUnit.store_id == current_user.store_id).all()
    
    return {"proxies": proxies, "printers": printers}

@router.post("/proxies", response_model=schemas.ProxyUnit)
def create_proxy(
    proxy: schemas.ProxyUnitCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.store_id:
        raise HTTPException(status_code=400, detail="User not assigned to a store")
    
    db_proxy = models.ProxyUnit(**proxy.model_dump(), store_id=current_user.store_id)
    db.add(db_proxy)
    db.commit()
    db.refresh(db_proxy)
    return db_proxy

@router.delete("/proxies/{proxy_id}")
def delete_proxy(
    proxy_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    proxy = db.query(models.ProxyUnit).filter(
        models.ProxyUnit.id == proxy_id,
        models.ProxyUnit.store_id == current_user.store_id
    ).first()
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    
    db.delete(proxy)
    db.commit()
    return {"status": "success"}

@router.post("/printers", response_model=schemas.PrinterUnit)
def create_printer(
    printer: schemas.PrinterUnitCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.store_id:
        raise HTTPException(status_code=400, detail="User not assigned to a store")
    
    db_printer = models.PrinterUnit(**printer.model_dump(), store_id=current_user.store_id)
    db.add(db_printer)
    db.commit()
    db.refresh(db_printer)
    return db_printer

@router.delete("/printers/{printer_id}")
def delete_printer(
    printer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    printer = db.query(models.PrinterUnit).filter(
        models.PrinterUnit.id == printer_id,
        models.PrinterUnit.store_id == current_user.store_id
    ).first()
    if not printer:
        raise HTTPException(status_code=404, detail="Printer not found")
    
    db.delete(printer)
    db.commit()
    return {"status": "success"}
