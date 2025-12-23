from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Optional
from datetime import date
import json

from database import get_db
from models import ClassInfo, WaitingList, Store
from schemas import (
    ClassInfo as ClassInfoSchema,
    ClassInfoCreate,
    ClassInfoUpdate
)
from auth import get_current_store

router = APIRouter()

# 요일 스케줄 기본값
DEFAULT_WEEKDAY_SCHEDULE = {
    "mon": True,
    "tue": True,
    "wed": True,
    "thu": True,
    "fri": True,
    "sat": True,
    "sun": True
}

def parse_weekday_schedule(schedule_str: str) -> Dict[str, bool]:
    """
    JSON 문자열을 weekday_schedule 딕셔너리로 안전하게 변환

    Args:
        schedule_str: JSON 형식의 weekday_schedule 문자열

    Returns:
        weekday_schedule 딕셔너리
    """
    if not schedule_str:
        return DEFAULT_WEEKDAY_SCHEDULE.copy()

    try:
        schedule = json.loads(schedule_str)
        if not isinstance(schedule, dict):
            return DEFAULT_WEEKDAY_SCHEDULE.copy()

        # 모든 요일 키가 존재하는지 확인하고 없으면 기본값으로 채움
        result = DEFAULT_WEEKDAY_SCHEDULE.copy()
        for key in result.keys():
            if key in schedule:
                result[key] = bool(schedule[key])

        return result
    except (json.JSONDecodeError, TypeError, ValueError):
        return DEFAULT_WEEKDAY_SCHEDULE.copy()

def serialize_weekday_schedule(schedule: Dict[str, bool]) -> str:
    """
    weekday_schedule 딕셔너리를 JSON 문자열로 안전하게 변환

    Args:
        schedule: weekday_schedule 딕셔너리

    Returns:
        JSON 형식의 문자열
    """
    if not schedule:
        schedule = DEFAULT_WEEKDAY_SCHEDULE

    # 모든 요일 키가 존재하는지 확인
    result = DEFAULT_WEEKDAY_SCHEDULE.copy()
    for key in result.keys():
        if key in schedule:
            result[key] = bool(schedule[key])

    return json.dumps(result)

def prepare_class_response(db_class: ClassInfo, db: Session, today: date = None) -> dict:
    """
    ClassInfo 객체를 API 응답용 딕셔너리로 변환

    Args:
        db_class: ClassInfo 모델 인스턴스
        db: 데이터베이스 세션
        today: 기준 날짜 (기본값: 오늘)

    Returns:
        API 응답용 딕셔너리
    """
    if today is None:
        today = date.today()

    # 현재 대기자 수 조회
    current_count = db.query(func.count(WaitingList.id)).filter(
        WaitingList.class_id == db_class.id,
        WaitingList.business_date == today,
        WaitingList.status == "waiting"
    ).scalar() or 0

    # weekday_schedule을 미리 파싱 (Pydantic validation 전에 변환)
    parsed_schedule = parse_weekday_schedule(db_class.weekday_schedule)

    # 수동으로 딕셔너리 생성 (from_orm 대신)
    result = {
        "id": db_class.id,
        "class_number": db_class.class_number,
        "class_name": db_class.class_name,
        "start_time": db_class.start_time,
        "end_time": db_class.end_time,
        "max_capacity": db_class.max_capacity,
        "is_active": db_class.is_active,
        "weekday_schedule": parsed_schedule,
        "class_type": db_class.class_type if hasattr(db_class, 'class_type') else 'all',
        "created_at": db_class.created_at,
        "updated_at": db_class.updated_at,
        "current_count": current_count
    }

    return result

@router.post("", response_model=ClassInfoSchema)
async def create_class(
    class_info: ClassInfoCreate,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """클래스(교시) 생성"""
    # 같은 번호의 클래스가 있는지 확인 (매장별, class_type별)
    existing = db.query(ClassInfo).filter(
        ClassInfo.store_id == current_store.id,
        ClassInfo.class_number == class_info.class_number,
        ClassInfo.class_type == class_info.class_type
    ).first()

    if existing:
        class_type_name = {'weekday': '평일', 'weekend': '주말', 'all': '전체'}[class_info.class_type]
        raise HTTPException(
            status_code=400,
            detail=f"{class_type_name} {class_info.class_number}교시가 이미 존재합니다."
        )

    # weekday_schedule을 JSON 문자열로 안전하게 변환
    data = class_info.dict()
    if 'weekday_schedule' in data:
        data['weekday_schedule'] = serialize_weekday_schedule(data['weekday_schedule'])

    db_class = ClassInfo(**data, store_id=current_store.id)
    db.add(db_class)
    db.commit()
    db.refresh(db_class)

    # 헬퍼 함수를 사용하여 응답 생성
    return prepare_class_response(db_class, db)

@router.get("", response_model=List[ClassInfoSchema])
async def get_classes(
    include_inactive: bool = False,
    class_type: Optional[str] = None,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """클래스 목록 조회"""
    query = db.query(ClassInfo).filter(ClassInfo.store_id == current_store.id)

    if not include_inactive:
        query = query.filter(ClassInfo.is_active == True)

    # class_type 필터링
    if class_type:
        query = query.filter(ClassInfo.class_type == class_type)

    classes = query.order_by(ClassInfo.class_number).all()

    # 헬퍼 함수를 사용하여 각 클래스 정보 변환
    today = date.today()
    result = [prepare_class_response(cls, db, today) for cls in classes]

    return result

@router.get("/{class_id}", response_model=ClassInfoSchema)
async def get_class(
    class_id: int,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """클래스 상세 조회"""
    class_info = db.query(ClassInfo).filter(
        ClassInfo.id == class_id,
        ClassInfo.store_id == current_store.id
    ).first()

    if not class_info:
        raise HTTPException(status_code=404, detail="클래스를 찾을 수 없습니다.")

    # 헬퍼 함수를 사용하여 응답 생성
    return prepare_class_response(class_info, db)

@router.put("/{class_id}", response_model=ClassInfoSchema)
async def update_class(
    class_id: int,
    class_info: ClassInfoUpdate,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """클래스 수정"""
    db_class = db.query(ClassInfo).filter(
        ClassInfo.id == class_id,
        ClassInfo.store_id == current_store.id
    ).first()

    if not db_class:
        raise HTTPException(status_code=404, detail="클래스를 찾을 수 없습니다.")

    # 업데이트할 필드만 수정
    update_data = class_info.dict(exclude_unset=True)

    # 클래스 번호 또는 타입 변경 시 중복 체크 (매장별, class_type별)
    if "class_number" in update_data or "class_type" in update_data:
        check_class_number = update_data.get("class_number", db_class.class_number)
        check_class_type = update_data.get("class_type", db_class.class_type)

        existing = db.query(ClassInfo).filter(
            ClassInfo.store_id == current_store.id,
            ClassInfo.class_number == check_class_number,
            ClassInfo.class_type == check_class_type,
            ClassInfo.id != class_id
        ).first()

        if existing:
            class_type_name = {'weekday': '평일', 'weekend': '주말', 'all': '전체'}[check_class_type]
            raise HTTPException(
                status_code=400,
                detail=f"{class_type_name} {check_class_number}교시가 이미 존재합니다."
            )

    # weekday_schedule을 JSON 문자열로 안전하게 변환
    if 'weekday_schedule' in update_data:
        update_data['weekday_schedule'] = serialize_weekday_schedule(update_data['weekday_schedule'])

    for field, value in update_data.items():
        setattr(db_class, field, value)

    db.commit()
    db.refresh(db_class)

    # 헬퍼 함수를 사용하여 응답 생성
    return prepare_class_response(db_class, db)

@router.delete("/{class_id}")
async def delete_class(
    class_id: int,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """클래스 삭제 (비활성화)"""
    db_class = db.query(ClassInfo).filter(
        ClassInfo.id == class_id,
        ClassInfo.store_id == current_store.id
    ).first()

    if not db_class:
        raise HTTPException(status_code=404, detail="클래스를 찾을 수 없습니다.")

    # 실제 삭제 대신 비활성화
    db_class.is_active = False
    db.commit()

    return {"message": f"{db_class.class_name}이(가) 비활성화되었습니다."}

@router.post("/{class_id}/activate")
async def activate_class(
    class_id: int,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """클래스 활성화"""
    db_class = db.query(ClassInfo).filter(
        ClassInfo.id == class_id,
        ClassInfo.store_id == current_store.id
    ).first()

    if not db_class:
        raise HTTPException(status_code=404, detail="클래스를 찾을 수 없습니다.")

    db_class.is_active = True
    db.commit()

    return {"message": f"{db_class.class_name}이(가) 활성화되었습니다."}

@router.get("/available/next")
async def get_next_available_class(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    다음 배치 가능한 클래스 조회
    - 각 클래스의 현재 인원과 최대 수용 인원을 비교
    - 여유가 있는 첫 번째 클래스 반환
    """
    today = date.today()
    classes = db.query(ClassInfo).filter(
        ClassInfo.store_id == current_store.id,
        ClassInfo.is_active == True
    ).order_by(ClassInfo.class_number).all()

    for cls in classes:
        current_count = db.query(func.count(WaitingList.id)).filter(
            WaitingList.class_id == cls.id,
            WaitingList.business_date == today,
            WaitingList.status == "waiting"
        ).scalar()

        if current_count < cls.max_capacity:
            return {
                "class_id": cls.id,
                "class_name": cls.class_name,
                "class_number": cls.class_number,
                "current_count": current_count,
                "max_capacity": cls.max_capacity,
                "available_slots": cls.max_capacity - current_count
            }

    # 모든 클래스가 가득 찬 경우
    raise HTTPException(status_code=400, detail="모든 클래스가 만석입니다.")

@router.post("/clone/{source_store_id}")
async def clone_classes(
    source_store_id: int,
    current_store: Store = Depends(get_current_store),
    current_user = Depends(get_current_store), # Using store dependency to get user context if needed, but here we need user for franchise check 
    # Wait, get_current_store returns store. To check franchise, we can use store.franchise_id.
    # But usually we want to ensure the USER has permission. 
    # Let's import User dependency.
    db: Session = Depends(get_db)
):
    """다른 매장의 클래스 설정 복제"""
    # 원본 매장 조회
    source_store = db.query(Store).filter(Store.id == source_store_id).first()

    if not source_store:
        raise HTTPException(status_code=404, detail="원본 매장을 찾을 수 없습니다.")

    # 같은 프랜차이즈 소속인지 확인
    if source_store.franchise_id != current_store.franchise_id:
        raise HTTPException(
            status_code=403,
            detail="같은 프랜차이즈 소속 매장만 복제할 수 있습니다."
        )

    # 자기 자신을 복제하려는 경우
    if source_store_id == current_store.id:
        raise HTTPException(
            status_code=400,
            detail="같은 매장의 설정은 복제할 수 없습니다."
        )

    # 원본 매장의 클래스 조회
    source_classes = db.query(ClassInfo).filter(ClassInfo.store_id == source_store_id).all()
    
    if not source_classes:
         raise HTTPException(
            status_code=404,
            detail="원본 매장에 등록된 클래스가 없습니다."
        )

    # 1. 기존 클래스 삭제
    db.query(ClassInfo).filter(ClassInfo.store_id == current_store.id).delete()
    
    # 2. 클래스 복사
    for source_class in source_classes:
        new_class = ClassInfo(
            store_id=current_store.id,
            class_number=source_class.class_number,
            class_name=source_class.class_name,
            start_time=source_class.start_time,
            end_time=source_class.end_time,
            max_capacity=source_class.max_capacity,
            is_active=source_class.is_active,
            weekday_schedule=source_class.weekday_schedule,
            class_type=source_class.class_type
        )
        db.add(new_class)

    db.commit()
    
    return {"message": "클래스 설정이 성공적으로 복제되었습니다.", "count": len(source_classes)}
