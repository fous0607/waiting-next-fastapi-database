from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, date
from typing import List, Optional
from utils import get_kst_now

from database import get_db
from models import (
    Store, StoreSettings, WaitingList, ClassInfo, DailyClosing, 
    Member, ClassClosure, Holiday
)
from schemas import (
    WaitingListCreate, WaitingListResponse, 
    StoreBase
)
from routers.waiting import (
    get_current_business_date, filter_classes_by_weekday, 
    get_next_waiting_number
)
from sse_manager import sse_manager
from core.logger import logger

router = APIRouter()

@router.get("/store/{store_code}")
def get_public_store_info(store_code: str, db: Session = Depends(get_db)):
    """
    공용: 매장 기본 정보 조회
    """
    store = db.query(Store).filter(Store.code == store_code, Store.is_active == True).first()
    if not store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
    
    # Store settings for customization
    settings = db.query(StoreSettings).filter(StoreSettings.store_id == store.id).first()
    
    # Calculate current waiting count
    today = get_current_business_date(db, store.id)
    current_waiting_count = db.query(func.count(WaitingList.id)).filter(
        WaitingList.business_date == today,
        WaitingList.status == "waiting",
        WaitingList.store_id == store.id
    ).scalar()

    # Business Hours & Break Time Status
    now_time = get_kst_now().time()
    is_business_hours = True
    is_break_time = False
    
    if settings:
        if hasattr(settings, 'business_start_time') and hasattr(settings, 'business_end_time'):
            if settings.business_start_time and settings.business_end_time:
                if not (settings.business_start_time <= now_time <= settings.business_end_time):
                    is_business_hours = False
        
        if hasattr(settings, 'enable_break_time') and settings.enable_break_time:
            if hasattr(settings, 'break_start_time') and hasattr(settings, 'break_end_time'):
                if settings.break_start_time and settings.break_end_time:
                    if settings.break_start_time <= now_time <= settings.break_end_time:
                        is_break_time = True

    return {
        "id": store.id,
        "name": store.name,
        "current_waiting_count": current_waiting_count,
        "is_business_hours": is_business_hours,
        "is_break_time": is_break_time,
        "business_hours": {
            "start": settings.business_start_time.strftime('%H:%M') if settings and settings.business_start_time else "09:00",
            "end": settings.business_end_time.strftime('%H:%M') if settings and settings.business_end_time else "22:00",
        },
        "break_time": {
            "enabled": settings.enable_break_time if settings else False,
            "start": settings.break_start_time.strftime('%H:%M') if settings and settings.break_start_time else "12:00",
            "end": settings.break_end_time.strftime('%H:%M') if settings and settings.break_end_time else "13:00",
        },
        "settings": {
            "require_member_registration": settings.require_member_registration if settings else False,
            "registration_message": settings.registration_message if settings else "",
            "theme": settings.theme if settings else "zinc",
            "detail_mode": settings.detail_mode if settings else "standard",
            "enable_party_size": settings.enable_party_size if settings else False,
            "party_size_config": settings.party_size_config if settings else None,
            "enable_menu_ordering": settings.enable_menu_ordering if settings else False
        }
    }

@router.post("/waiting/{store_code}/register")
async def public_register_waiting(
    store_code: str,
    waiting: WaitingListCreate,
    db: Session = Depends(get_db)
):
    """
    공용: 대기 접수
    (routers/waiting.py 로직을 단순화하여 적용)
    """
    # 1. 매장 확인
    store = db.query(Store).filter(Store.code == store_code, Store.is_active == True).first()
    if not store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
        
    current_store_id = store.id
    today = get_current_business_date(db, current_store_id)
    
    # 2. 영업 확인
    business = db.query(DailyClosing).filter(
        DailyClosing.business_date == today,
        DailyClosing.is_closed == False,
        DailyClosing.store_id == current_store_id
    ).first()

    if not business:
        raise HTTPException(status_code=400, detail="영업 중이 아닙니다.")

    # 3. 중복 대기 확인
    existing = db.query(WaitingList).filter(
        WaitingList.business_date == today,
        WaitingList.phone == waiting.phone,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 대기 중인 번호입니다.")

    # 4. 설정 확인 (Limits & Hours)
    settings = db.query(StoreSettings).filter(StoreSettings.store_id == current_store_id).first()
    
    if settings:
        now_time = get_kst_now().time()
        
        # 영업 시간 체크
        if hasattr(settings, 'business_start_time') and hasattr(settings, 'business_end_time'):
            if settings.business_start_time and settings.business_end_time:
                if not (settings.business_start_time <= now_time <= settings.business_end_time):
                    start_str = settings.business_start_time.strftime('%H:%M')
                    end_str = settings.business_end_time.strftime('%H:%M')
                    raise HTTPException(
                        status_code=400, 
                        detail=f"영업 시간이 아닙니다.\n(영업시간: {start_str} ~ {end_str})"
                    )
        
        # 브레이크 타임 체크
        if hasattr(settings, 'enable_break_time') and settings.enable_break_time:
            if hasattr(settings, 'break_start_time') and hasattr(settings, 'break_end_time'):
                if settings.break_start_time and settings.break_end_time:
                    if settings.break_start_time <= now_time <= settings.break_end_time:
                        break_end_str = settings.break_end_time.strftime('%H:%M')
                        raise HTTPException(
                            status_code=400, 
                            detail=f"지금은 휴게 시간(Break Time)입니다.\n{break_end_str} 이후에 다시 시도해주세요."
                        )

        if settings.use_max_waiting_limit and settings.max_waiting_limit > 0:
            current_waiting_count = db.query(func.count(WaitingList.id)).filter(
                WaitingList.business_date == today,
                WaitingList.status == "waiting",
                WaitingList.store_id == current_store_id
            ).scalar()
            
            if current_waiting_count >= settings.max_waiting_limit:
                 raise HTTPException(status_code=400, detail="대기 인원이 가득 찼습니다.")

    # 5. 멤버 조회 및 생성 (필요 시)
    member = db.query(Member).filter(
        Member.phone == waiting.phone,
        Member.store_id == current_store_id
    ).first()
    
    is_new_member = False
    if not member:
        is_new_member = True
        # 자동 가입 설정이 있거나, public 등록은 기본적으로 가벼운 멤버 생성을 할 수 있음
        # 하지만 기존 로직을 따라 설정이 있을때만 하거나, 아니면 public은 이름만 받아서 WaitingList에만 넣을 수도 있음.
        # 여기서는 WaitingList에 이름 저장 위주로 가되, settings.auto_register_member 체크
        if settings and (settings.auto_register_member or settings.require_member_registration):
             member_name = waiting.name if waiting.name else waiting.phone[-4:]
             new_member = Member(
                store_id=current_store_id,
                name=member_name,
                phone=waiting.phone,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
             db.add(new_member)
             db.flush()
             member = new_member
    
    member_id = member.id if member else None
    name = member.name if member else (waiting.name or "고객")
    
    # 6. 클래스 배정 (기존 로직 재사용)
    all_classes_raw = db.query(ClassInfo).filter(
        ClassInfo.store_id == current_store_id,
        ClassInfo.is_active == True
    ).order_by(ClassInfo.class_number).all()
    
    all_classes = filter_classes_by_weekday(all_classes_raw, today, db, current_store_id)
    if not all_classes:
         raise HTTPException(status_code=400, detail="운영 교시가 없습니다.")
         
    closed_class_ids = [
        cc.class_id for cc in db.query(ClassClosure).filter(
            ClassClosure.store_id == current_store_id,
            ClassClosure.business_date == today
        ).all()
    ]
    
    target_class = None
    class_order = 0
    
    for cls in all_classes:
        if cls.id in closed_class_ids:
            continue
            
        current_count = db.query(func.count(WaitingList.id)).filter(
            WaitingList.class_id == cls.id,
            WaitingList.business_date == today,
            WaitingList.status.in_(["waiting", "called", "attended"]),
            WaitingList.store_id == current_store_id
        ).scalar()
        
        if current_count < cls.max_capacity:
            target_class = cls
            class_order = current_count + 1
            break
            
    if not target_class:
        raise HTTPException(status_code=400, detail="모든 교시가 마감되었습니다.")

    # 7. 대기 등록
    waiting_number = get_next_waiting_number(db, today, current_store_id)
    
    new_waiting = WaitingList(
        business_date=today,
        waiting_number=waiting_number,
        phone=waiting.phone,
        name=name,
        class_id=target_class.id,
        class_order=class_order,
        member_id=member_id,
        status="waiting",
        total_party_size=waiting.person_count,
        party_size_details=waiting.party_size_details,
        registered_at=datetime.now(),
        store_id=current_store_id
    )
    
    db.add(new_waiting)
    db.commit()
    db.refresh(new_waiting)
    
    # 8. SSE Broadcast (중요: 관리자/보드 업데이트용)
    try:
        common_data = {
            "id": new_waiting.id,
            "waiting_id": new_waiting.id,
            "waiting_number": waiting_number,
            "class_id": target_class.id,
            "class_name": target_class.class_name,
            "class_order": class_order,
            "name": name,
            "phone": waiting.phone,
            "display_name": name if name else waiting.phone[-4:]
        }
        
        # Admin
        await sse_manager.broadcast(
            store_id=str(current_store_id),
            event_type="new_user",
            data=common_data,
            target_role='admin'
        )
        # Board/Reception (Check settings if needed, but safe to send)
        await sse_manager.broadcast(
            store_id=str(current_store_id),
            event_type="new_user",
            data=common_data,
            target_role='board'
        )
         
    except Exception as e:
        logger.error(f"Public register broadcast failed: {e}")
        
    return WaitingListResponse(
        id=new_waiting.id,
        waiting_number=waiting_number,
        class_id=target_class.id,
        class_name=target_class.class_name,
        class_order=class_order,
        phone=waiting.phone,
        name=name,
        status="waiting",
        registered_at=new_waiting.registered_at,
        message=f"{target_class.class_name} {class_order}번째 접수되었습니다.",
        is_new_member=is_new_member
    )

@router.get("/waiting/{store_code}/status")
def get_public_waiting_status(
    store_code: str, 
    phone: str, 
    db: Session = Depends(get_db)
):
    """
    공용: 대기 상태 조회
    """
    store = db.query(Store).filter(Store.code == store_code, Store.is_active == True).first()
    if not store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")

    today = get_current_business_date(db, store.id)
    
    waiting = db.query(WaitingList).filter(
        WaitingList.business_date == today,
        WaitingList.phone == phone,
        WaitingList.status == "waiting",
        WaitingList.store_id == store.id
    ).first()
    
    if not waiting:
        return {"found": False, "message": "대기 내역이 없습니다."}
        
    class_info = db.query(ClassInfo).get(waiting.class_id)
    
    ahead_count = db.query(func.count(WaitingList.id)).filter(
        WaitingList.business_date == today,
        WaitingList.status == "waiting",
        WaitingList.waiting_number < waiting.waiting_number,
        WaitingList.store_id == store.id
    ).scalar()
    
    return {
        "found": True,
        "waiting_number": waiting.waiting_number,
        "class_name": class_info.class_name,
        "class_order": waiting.class_order,
        "ahead_count": ahead_count,
        "name": waiting.name,
        "store_name": store.name
    }
