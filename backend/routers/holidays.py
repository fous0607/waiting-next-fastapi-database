from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime

from database import get_db
from models import Holiday, Store
from auth import get_current_store
from pydantic import BaseModel

router = APIRouter(
    tags=["holidays"]
)

class HolidayCreate(BaseModel):
    date: date
    name: str

class HolidayResponse(BaseModel):
    id: int
    date: date
    name: str

    class Config:
        from_attributes = True

@router.get("", response_model=List[HolidayResponse])
def get_holidays(
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    return db.query(Holiday).filter(
        Holiday.store_id == current_store.id
    ).order_by(Holiday.date).all()

@router.post("", response_model=HolidayResponse)
def create_holiday(
    holiday: HolidayCreate,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    exists = db.query(Holiday).filter(
        Holiday.store_id == current_store.id,
        Holiday.date == holiday.date
    ).first()
    
    if exists:
        raise HTTPException(status_code=400, detail="이미 등록된 공휴일입니다.")

    new_holiday = Holiday(
        store_id=current_store.id,
        date=holiday.date,
        name=holiday.name
    )
    db.add(new_holiday)
    db.commit()
    db.refresh(new_holiday)
    return new_holiday

@router.delete("/{date}")
def delete_holiday(
    date: date,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    holiday = db.query(Holiday).filter(
        Holiday.store_id == current_store.id,
        Holiday.date == date
    ).first()
    
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
        
    db.delete(holiday)
    db.commit()
    return {"status": "success"}

@router.post("/import/{year}")
def import_holidays(
    year: int,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    공공데이터포털에서 해당 연도의 공휴일을 불러와서 저장
    """
    from services.holiday_service import fetch_korean_holidays
    
    try:
        # 공공데이터 API에서 공휴일 가져오기
        holidays = fetch_korean_holidays(year)
        
        if not holidays:
            return {
                "message": f"{year}년에 등록된 공휴일이 없습니다.",
                "imported_count": 0,
                "skipped_count": 0,
                "total_count": 0
            }
        
        imported_count = 0
        skipped_count = 0
        
        for holiday_data in holidays:
            # 날짜 문자열을 date 객체로 변환
            date_obj = datetime.strptime(holiday_data["date"], "%Y-%m-%d").date()
            
            # 중복 체크
            existing = db.query(Holiday).filter(
                Holiday.store_id == current_store.id,
                Holiday.date == date_obj
            ).first()
            
            if existing:
                skipped_count += 1
                continue
            
            # 새 공휴일 추가
            new_holiday = Holiday(
                store_id=current_store.id,
                date=date_obj,
                name=holiday_data["name"]
            )
            db.add(new_holiday)
            imported_count += 1
        
        db.commit()
        
        return {
            "message": f"{year}년 공휴일 {imported_count}개를 불러왔습니다. (중복 {skipped_count}개 제외)",
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "total_count": len(holidays)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"공휴일 불러오기 실패: {str(e)}")
