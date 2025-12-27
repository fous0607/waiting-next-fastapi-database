from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, defer, joinedload
from sqlalchemy import func, and_
from datetime import datetime, date, timedelta, timezone
from typing import List, Dict
import json

from database import get_db
from models import WaitingList, ClassInfo, StoreSettings, DailyClosing, ClassClosure, Store, Holiday
from auth import get_current_store
from schemas import (
    WaitingStatusUpdate,
    WaitingOrderUpdate,
    WaitingClassUpdate,
    BatchAttendance,
    WaitingBoard,
    WaitingBoardItem,
    EmptySeatInsert,
    WaitingNameUpdate
)
from sse_manager import sse_manager
from utils import get_today_date

import logging

# Set up logger
logger = logging.getLogger(__name__)

router = APIRouter()

def get_current_business_date(db: Session, store_id: int) -> date:
    """
    현재 영업일 조회 (Sync with daily_closing.py)
    1. 활성화된 영업일 우선
    2. 없으면 시간 기반 계산
    """
    # 1. 활성화된 영업일 확인
    active_closing = db.query(DailyClosing).filter(
        DailyClosing.store_id == store_id,
        DailyClosing.is_closed == False
    ).order_by(DailyClosing.business_date.desc()).first()

    if active_closing:
        return active_closing.business_date

    # 2. 설정 기반 계산
    # 2. 설정 기반 계산
    start_hour = db.query(StoreSettings.business_day_start).filter(
        StoreSettings.store_id == store_id
    ).scalar()
    
    if start_hour is None:
        start_hour = 5
        
    return get_today_date(start_hour)

# 요일 매핑
WEEKDAY_MAP = {
    0: "mon",   # Monday
    1: "tue",   # Tuesday
    2: "wed",   # Wednesday
    3: "thu",   # Thursday
    4: "fri",   # Friday
    5: "sat",   # Saturday
    6: "sun"    # Sunday
}

DEFAULT_WEEKDAY_SCHEDULE = {
    "mon": True, "tue": True, "wed": True, "thu": True,
    "fri": True, "sat": True, "sun": True
}

def parse_weekday_schedule(schedule_str: str) -> Dict[str, bool]:
    """
    JSON 문자열을 weekday_schedule 딕셔너리로 안전하게 변환
    """
    if not schedule_str:
        return DEFAULT_WEEKDAY_SCHEDULE.copy()

    try:
        schedule = json.loads(schedule_str)
        if not isinstance(schedule, dict):
            return DEFAULT_WEEKDAY_SCHEDULE.copy()
        return schedule
    except (json.JSONDecodeError, TypeError, ValueError):
        return DEFAULT_WEEKDAY_SCHEDULE.copy()

def filter_classes_by_weekday(classes: List[ClassInfo], target_date: date, db: Session, store_id: int) -> List[ClassInfo]:
    """
    특정 날짜의 요일에 맞는 클래스만 필터링
    **공휴일 로직 추가:**
    1. 해당 날짜가 공휴일(Holiday)인지 확인
    2. 공휴일이면 -> class_type == 'holiday' 인 클래스만 반환
    3. 공휴일이 아니면 -> class_type != 'holiday' 중 요일 스케줄이 맞는 것 반환

    Args:
        classes: 필터링할 클래스 목록
        target_date: 기준 날짜
        db: DB 세션
        store_id: 매장 ID

    Returns:
        해당 날짜(요일/공휴일)에 운영되는 클래스 목록
    """
    # 1. 공휴일 여부 확인
    is_holiday = db.query(Holiday).filter(
        Holiday.store_id == store_id,
        Holiday.date == target_date
    ).first()

    filtered_classes = []

    if is_holiday:
        # 공휴일이면 'holiday' 타입인 클래스만 반환
        for cls in classes:
            if hasattr(cls, 'class_type') and cls.class_type == 'holiday':
                filtered_classes.append(cls)
        return filtered_classes

    # 공휴일이 아니면 기존 로직 (단, holiday 타입은 제외)
    weekday = WEEKDAY_MAP[target_date.weekday()]

    for cls in classes:
        # 'holiday' 타입은 평일/주말 스케줄에서 제외
        if hasattr(cls, 'class_type') and cls.class_type == 'holiday':
            continue

        schedule = parse_weekday_schedule(cls.weekday_schedule)
        if schedule.get(weekday, True):
            filtered_classes.append(cls)

    return filtered_classes

def convert_class_to_dict(cls: ClassInfo) -> dict:
    """
    ClassInfo 모델 객체를 dict로 변환 (Pydantic validation용)
    weekday_schedule을 JSON 문자열에서 dict로 파싱

    Args:
        cls: ClassInfo 모델 인스턴스

    Returns:
        dict: 변환된 딕셔너리
    """
    return {
        "id": cls.id,
        "class_number": cls.class_number,
        "class_name": cls.class_name,
        "start_time": cls.start_time,
        "end_time": cls.end_time,
        "max_capacity": cls.max_capacity,
        "is_active": cls.is_active,
        "weekday_schedule": parse_weekday_schedule(cls.weekday_schedule),
        "class_type": cls.class_type if hasattr(cls, 'class_type') else 'all',
        "created_at": cls.created_at,
        "updated_at": cls.updated_at
    }

@router.get("/display", response_model=WaitingBoard)
async def get_waiting_board(
    store_code: str,
    db: Session = Depends(get_db)
):
    """
    대기현황판 데이터 조회 (공개 엔드포인트 - 인증 불필요)
    - 매장 코드로 매장 조회
    - 매장 설정에 따라 표시할 클래스 개수 결정
    - 대기자 목록을 클래스별로 정렬하여 반환
    """
    # 매장 코드로 매장 조회
    current_store = db.query(Store).filter(Store.code == store_code).first()
    if not current_store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다")
    
    today = get_current_business_date(db, current_store.id)

    # 매장 설정 조회
    settings = db.query(StoreSettings).options(
        defer(StoreSettings.enable_franchise_monitoring)
    ).filter(
        StoreSettings.store_id == current_store.id
    ).first()
    if not settings:
        raise HTTPException(status_code=404, detail="매장 설정을 찾을 수 없습니다.")

    # 영업 정보 조회
    business = db.query(DailyClosing).filter(
        DailyClosing.business_date == today,
        DailyClosing.store_id == current_store.id
    ).first()

    # 대기 중인 목록 조회 (먼저 조회)
    waiting_list = db.query(WaitingList).options(
        joinedload(WaitingList.member)
    ).filter(
        WaitingList.business_date == today,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).order_by(WaitingList.class_id, WaitingList.class_order).all()

    # 대기자가 있는 클래스 ID 목록
    classes_with_waiting = set(w.class_id for w in waiting_list)

    # 일괄 출석이 완료된 클래스 ID 목록 (출석한 사람은 있지만 대기자는 없는 클래스)
    completed_classes = db.query(WaitingList.class_id).filter(
        WaitingList.business_date == today,
        WaitingList.status == "attended",
        WaitingList.store_id == current_store.id
    ).distinct().all()
    completed_class_ids = set(c.class_id for c in completed_classes if c.class_id not in classes_with_waiting)

    # 마감된 클래스 ID 목록
    closed_classes = db.query(ClassClosure.class_id).filter(
        ClassClosure.business_date == today,
        ClassClosure.store_id == current_store.id
    ).all()
    closed_class_ids = set(c.class_id for c in closed_classes)

    # 활성화된 클래스 조회 및 오늘 요일에 맞는 클래스만 필터링
    all_classes_raw = db.query(ClassInfo).filter(
        ClassInfo.is_active == True,
        ClassInfo.store_id == current_store.id
    ).order_by(ClassInfo.class_number).all()

    # 헬퍼 함수를 사용하여 오늘 요일에 맞는 클래스만 필터링 (공휴일 체크 포함)
    all_classes = filter_classes_by_weekday(all_classes_raw, today, db, current_store.id)

    # 완료된 클래스와 마감된 클래스는 제외
    # 대기자가 있는 클래스를 우선 표시하되, 설정된 개수만큼 채우기
    classes_with_waiting_list = [c for c in all_classes if c.id in classes_with_waiting and c.id not in closed_class_ids]
    classes_without_waiting = [c for c in all_classes if c.id not in classes_with_waiting and c.id not in completed_class_ids and c.id not in closed_class_ids]

    # 빈 교시 정렬 개선: 현재 시간 기준 미래/진행 중 교시 우선 (KST 기준)
    if today == date.today():
        # KST(UTC+9) 시간 적용
        kst_timezone = timezone(timedelta(hours=9))
        now_time = datetime.now(kst_timezone).time()
        
        future_classes = []
        past_classes = []
        
        for cls in classes_without_waiting:
            # cls.end_time이 Time 객체인지 확인 (models.py 확인 결과 맞음)
            if cls.end_time >= now_time:
                future_classes.append(cls)
            else:
                past_classes.append(cls)
        
        # 미래/진행중 교시 우선 + 과거 교시 순으로 재배치
        classes_without_waiting = future_classes + past_classes

    # 대기자 있는 클래스 우선 배치 + 부족한 만큼 다음 교시로 채우기
    selected_classes = classes_with_waiting_list[:settings.display_classes_count]
    
    # 설정된 개수에 미달하면 대기자 없는 클래스로 채우기
    remaining_slots = settings.display_classes_count - len(selected_classes)
    if remaining_slots > 0:
        selected_classes.extend(classes_without_waiting[:remaining_slots])
    
    # 최종적으로 화면에는 교시 번호 순서대로 정렬하여 표시
    classes = sorted(selected_classes, key=lambda c: c.class_number)

    # 표시 데이터 변환
    board_items = []
    for waiting in waiting_list:
        class_info = next((c for c in classes if c.id == waiting.class_id), None)
        if not class_info:
            continue

        if waiting.member and waiting.member.name:
            display_name = waiting.member.name
        else:
            display_name = waiting.name if waiting.name else waiting.phone[-4:]

        board_items.append(WaitingBoardItem(
            id=waiting.id,
            waiting_number=waiting.waiting_number,
            display_name=display_name,
            class_id=waiting.class_id,
            class_name=class_info.class_name,
            class_order=waiting.class_order,
            is_empty_seat=waiting.is_empty_seat or False,
            status=waiting.status,
            call_count=waiting.call_count
        ))

    # ClassInfo 객체들을 dict로 변환 (weekday_schedule 파싱 포함)
    classes_dict = [convert_class_to_dict(cls) for cls in classes]

    return WaitingBoard(
        store_name=settings.store_name,
        business_date=today,
        classes=classes_dict,
        waiting_list=board_items,
        rows_per_class=settings.rows_per_class,
        waiting_board_page_size=settings.waiting_board_page_size,
        waiting_board_rotation_interval=settings.waiting_board_rotation_interval,
        waiting_board_transition_effect=settings.waiting_board_transition_effect
    )

@router.put("/{waiting_id}/status")
async def update_waiting_status(
    waiting_id: int,
    status_update: WaitingStatusUpdate,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기자 상태 변경 (출석/취소)
    """
    waiting = db.query(WaitingList).filter(
        WaitingList.id == waiting_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not waiting:
        raise HTTPException(status_code=404, detail="대기자를 찾을 수 없습니다.")

    if waiting.status != "waiting":
        raise HTTPException(status_code=400, detail="이미 처리된 대기입니다.")

    old_class_id = waiting.class_id
    old_business_date = waiting.business_date

    waiting.status = status_update.status

    if status_update.status == "attended":
        waiting.attended_at = datetime.now()
    elif status_update.status == "cancelled":
        waiting.cancelled_at = datetime.now()

    # 해당 클래스의 남은 대기자들 순서 정규화: 1번째, 2번째, 3번째... 순서로 재정렬
    remaining_waitings = db.query(WaitingList).filter(
        WaitingList.business_date == old_business_date,
        WaitingList.class_id == old_class_id,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).order_by(WaitingList.class_order).all()

    for idx, w in enumerate(remaining_waitings, start=1):
        w.class_order = idx

    db.commit()

    # SSE 브로드캐스트 분리 전송
    settings = db.query(StoreSettings).options(
        defer(StoreSettings.enable_franchise_monitoring)
    ).filter(StoreSettings.store_id == current_store.id).first()
    
    franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
    target_franchise_id = None
    
    # 프랜차이즈 모니터링 체크
    monitoring_enabled = True
    if settings:
        try:
            monitoring_enabled = settings.enable_franchise_monitoring
        except:
            monitoring_enabled = True
            
    if monitoring_enabled:
        target_franchise_id = franchise_id

    # 1. 관리자(Admin)에게는 무조건 전송
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="status_changed",
        data={
            "waiting_id": waiting_id,
            "status": status_update.status,
            "waiting_number": waiting.waiting_number
        },
        franchise_id=target_franchise_id,
        target_role='admin'
    )

    # 2. 대기현황판(Board)에게 전송
    should_broadcast_board = True
    should_broadcast_reception = True
    
    if settings:
        should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
        should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

    common_data = {
        "waiting_id": waiting_id,
        "status": status_update.status,
        "waiting_number": waiting.waiting_number
    }

    if should_broadcast_board:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="status_changed",
            data=common_data,
            franchise_id=None,
            target_role='board'
        )

    # 3. 접수대(Reception)에게 전송
    if should_broadcast_reception:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="status_changed",
            data=common_data,
            franchise_id=None,
            target_role='reception'
        )

    return {"message": f"상태가 {status_update.status}(으)로 변경되었습니다."}

@router.put("/{waiting_id}/name")
async def update_waiting_name(
    waiting_id: int,
    name_update: WaitingNameUpdate,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기자 이름 변경
    - WaitingList의 이름을 변경하고 연결된 Member가 있는 경우 함께 변경
    """
    from models import Member
    
    waiting = db.query(WaitingList).filter(
        WaitingList.id == waiting_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not waiting:
        raise HTTPException(status_code=404, detail="대기자를 찾을 수 없습니다.")

    old_name = waiting.name
    waiting.name = name_update.name

    # 연결된 회원이 있는 경우 회원 이름도 함께 변경
    if waiting.member_id:
        member = db.query(Member).filter(Member.id == waiting.member_id).first()
        if member:
            member.name = name_update.name

    db.commit()

    # SSE 브로드캐스트 분리 전송
    settings = db.query(StoreSettings).options(
        defer(StoreSettings.enable_franchise_monitoring)
    ).filter(StoreSettings.store_id == current_store.id).first()
    
    franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
    target_franchise_id = None
    
    # 프랜차이즈 모니터링 체크
    monitoring_enabled = True
    if settings:
        try:
            monitoring_enabled = settings.enable_franchise_monitoring
        except:
            monitoring_enabled = True
            
    if monitoring_enabled:
        target_franchise_id = franchise_id

    # 1. 관리자(Admin)에게는 무조건 전송
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="name_updated",
        data={
            "waiting_id": waiting_id,
            "name": name_update.name,
            "display_name": name_update.name
        },
        franchise_id=target_franchise_id,
        target_role='admin'
    )

    # 2. 대기현황판(Board)에게 전송
    should_broadcast_board = True
    should_broadcast_reception = True
    
    if settings:
        should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
        should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

    common_data = {
        "waiting_id": waiting_id,
        "name": name_update.name,
        "display_name": name_update.name
    }

    if should_broadcast_board:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="name_updated",
            data=common_data,
            franchise_id=None,
            target_role='board'
        )

    # 3. 접수대(Reception)에게 전송
    if should_broadcast_reception:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="name_updated",
            data=common_data,
            franchise_id=None,
            target_role='reception'
        )

    return {"message": f"이름이 '{name_update.name}'(으)로 변경되었습니다."}

@router.post("/{waiting_id}/call")
async def call_waiting(
    waiting_id: int,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기자 호출
    """
    waiting = db.query(WaitingList).filter(
        WaitingList.id == waiting_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not waiting:
        raise HTTPException(status_code=404, detail="대기자를 찾을 수 없습니다.")

    waiting.call_count += 1
    waiting.last_called_at = datetime.now()

    db.commit()

    # SSE 브로드캐스트 분리 전송
    settings = db.query(StoreSettings).options(
        defer(StoreSettings.enable_franchise_monitoring)
    ).filter(StoreSettings.store_id == current_store.id).first()
    
    franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
    target_franchise_id = None
    
    monitoring_enabled = True
    if settings:
        try:
            monitoring_enabled = settings.enable_franchise_monitoring 
        except:
             monitoring_enabled = True
             
    if monitoring_enabled:
        target_franchise_id = franchise_id
        
    # 1. 관리자(Admin) 전송
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="user_called",
        data={
            "waiting_id": waiting_id,
            "waiting_number": waiting.waiting_number,
            "call_count": waiting.call_count
        },
        franchise_id=target_franchise_id,
        target_role='admin'
    )

    # 2. 대기현황판(Board) 전송
    should_broadcast_board = True
    should_broadcast_reception = True
    
    if settings:
        should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
        should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

    common_data = {
        "waiting_id": waiting_id,
        "waiting_number": waiting.waiting_number,
        "call_count": waiting.call_count
    }

    if should_broadcast_board:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="user_called",
            data=common_data,
            franchise_id=None,
            target_role='board'
        )

    # 3. 접수대(Reception) 전송
    if should_broadcast_reception:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="user_called",
            data=common_data,
            franchise_id=None,
            target_role='reception'
        )

    return {
        "message": f"대기번호 {waiting.waiting_number}번이 호출되었습니다.",
        "call_count": waiting.call_count
    }

@router.put("/{waiting_id}/swap/{target_id}")
async def swap_waiting_order(
    waiting_id: int,
    target_id: int,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기자를 다른 위치에 삽입 (드래그 앤 드롭용)
    dragged item을 target item 위치에 삽입하고, 나머지 항목들을 이동
    """
    dragged = db.query(WaitingList).filter(
        WaitingList.id == waiting_id,
        WaitingList.store_id == current_store.id
    ).first()
    target = db.query(WaitingList).filter(
        WaitingList.id == target_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not dragged or not target:
        raise HTTPException(status_code=404, detail="대기자를 찾을 수 없습니다.")

    if dragged.status != "waiting" or target.status != "waiting":
        raise HTTPException(status_code=400, detail="대기 중인 상태만 순서 변경이 가능합니다.")

    # 같은 클래스 내에서만 이동 가능
    if dragged.class_id != target.class_id:
        raise HTTPException(status_code=400, detail="같은 클래스 내에서만 순서를 변경할 수 있습니다.")

    old_order = dragged.class_order
    new_order = target.class_order

    # 같은 위치면 아무것도 하지 않음
    if old_order == new_order:
        return {"message": "순서가 변경되지 않았습니다."}

    # 같은 클래스 내의 모든 대기자 조회
    class_waitings = db.query(WaitingList).filter(
        WaitingList.class_id == dragged.class_id,
        WaitingList.business_date == dragged.business_date,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).all()

    # 순서 재조정
    if old_order < new_order:
        # 아래로 이동: old_order < x <= new_order인 항목들을 위로 한 칸씩 올림
        for waiting in class_waitings:
            if waiting.id != dragged.id and old_order < waiting.class_order <= new_order:
                waiting.class_order -= 1
        dragged.class_order = new_order
    else:
        # 위로 이동: new_order <= x < old_order인 항목들을 아래로 한 칸씩 내림
        for waiting in class_waitings:
            if waiting.id != dragged.id and new_order <= waiting.class_order < old_order:
                waiting.class_order += 1
        dragged.class_order = new_order

    # 순서 정규화: 1번째, 2번째, 3번째... 순서로 재정렬
    normalized_waitings = sorted(class_waitings, key=lambda x: x.class_order)
    for idx, waiting in enumerate(normalized_waitings, start=1):
        waiting.class_order = idx

    db.commit()

    # SSE 브로드캐스트 분리 전송
    try:
        franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
        target_franchise_id = None
        
        # 설정 확인
        settings = db.query(StoreSettings).options(
            defer(StoreSettings.enable_franchise_monitoring)
        ).filter(StoreSettings.store_id == current_store.id).first()
        
        monitoring_enabled = True
        if settings:
            try:
                monitoring_enabled = settings.enable_franchise_monitoring
            except:
                monitoring_enabled = True

        if monitoring_enabled:
            target_franchise_id = franchise_id

        # 1. 관리자(Admin) 전송 - 무조건
        logger.info(f"[SWAP] Broadcasting order_changed to ADMIN: store_id={current_store.id}")
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="order_changed",
            data={
                "waiting_id": waiting_id,
                "target_id": target_id
            },
            franchise_id=target_franchise_id,
            target_role='admin'
        )
        
        # 2. 대기현황판(Board) 전송
        should_broadcast_board = True
        should_broadcast_reception = True
        
        if settings:
            should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
            should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

        common_data = {
            "waiting_id": waiting_id,
            "target_id": target_id
        }

        if should_broadcast_board:
            logger.info(f"[SWAP] Broadcasting order_changed to BOARD: store_id={current_store.id}")
            await sse_manager.broadcast(
                store_id=str(current_store.id),
                event_type="order_changed",
                data=common_data,
                franchise_id=None,
                target_role='board'
            )

        # 3. 접수대(Reception) 전송
        if should_broadcast_reception:
            logger.info(f"[SWAP] Broadcasting order_changed to RECEPTION: store_id={current_store.id}")
            await sse_manager.broadcast(
                store_id=str(current_store.id),
                event_type="order_changed",
                data=common_data,
                franchise_id=None,
                target_role='reception'
            )
    except Exception as e:
        logger.error(f"[SWAP] Failed to broadcast SSE: {e}")

    return {"message": "순서가 변경되었습니다."}

@router.put("/{waiting_id}/order")
async def change_waiting_order(
    waiting_id: int,
    order_update: WaitingOrderUpdate,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기 순서 변경 (위/아래)
    """
    waiting = db.query(WaitingList).filter(
        WaitingList.id == waiting_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not waiting:
        raise HTTPException(status_code=404, detail="대기자를 찾을 수 없습니다.")

    if waiting.status != "waiting":
        raise HTTPException(status_code=400, detail="대기 중인 상태만 순서 변경이 가능합니다.")

    # 같은 클래스 내에서 순서 변경
    if order_update.direction == "up":
        # 위로 이동 - 바로 위 대기자와 순서 교체
        target = db.query(WaitingList).filter(
            WaitingList.business_date == waiting.business_date,
            WaitingList.class_id == waiting.class_id,
            WaitingList.class_order < waiting.class_order,
            WaitingList.status == "waiting",
            WaitingList.store_id == current_store.id
        ).order_by(WaitingList.class_order.desc()).first()

        if not target:
            raise HTTPException(status_code=400, detail="이미 맨 위입니다.")

        # 순서 교체
        waiting.class_order, target.class_order = target.class_order, waiting.class_order

    elif order_update.direction == "down":
        # 아래로 이동 - 바로 아래 대기자와 순서 교체
        target = db.query(WaitingList).filter(
            WaitingList.business_date == waiting.business_date,
            WaitingList.class_id == waiting.class_id,
            WaitingList.class_order > waiting.class_order,
            WaitingList.status == "waiting",
            WaitingList.store_id == current_store.id
        ).order_by(WaitingList.class_order).first()

        if not target:
            raise HTTPException(status_code=400, detail="이미 맨 아래입니다.")

        # 순서 교체
        waiting.class_order, target.class_order = target.class_order, waiting.class_order

    db.commit()

    # SSE 브로드캐스트 분리 전송
    settings = db.query(StoreSettings).options(
        defer(StoreSettings.enable_franchise_monitoring)
    ).filter(StoreSettings.store_id == current_store.id).first()
    
    franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
    target_franchise_id = None
    
    monitoring_enabled = True
    if settings:
        try:
            monitoring_enabled = settings.enable_franchise_monitoring
        except:
             monitoring_enabled = True
             
    if monitoring_enabled:
        target_franchise_id = franchise_id

    # 1. 관리자(Admin) 전송
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="order_changed",
        data={
            "waiting_id": waiting_id,
            "direction": order_update.direction
        },
        franchise_id=target_franchise_id,
        target_role='admin'
    )

    # 2. 대기현황판(Board) 전송
    should_broadcast_board = True
    should_broadcast_reception = True
    
    if settings:
        should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
        should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

    common_data = {
        "waiting_id": waiting_id,
        "direction": order_update.direction
    }

    if should_broadcast_board:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="order_changed",
            data=common_data,
            franchise_id=None,
            target_role='board'
        )

    # 3. 접수대(Reception) 전송
    if should_broadcast_reception:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="order_changed",
            data=common_data,
            franchise_id=None,
            target_role='reception'
        )

    return {"message": "순서가 변경되었습니다."}

@router.put("/{waiting_id}/move-class")
async def move_to_another_class(
    waiting_id: int,
    class_update: WaitingClassUpdate,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    다른 클래스로 이동
    """
    waiting = db.query(WaitingList).filter(
        WaitingList.id == waiting_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not waiting:
        raise HTTPException(status_code=404, detail="대기자를 찾을 수 없습니다.")

    if waiting.status != "waiting":
        raise HTTPException(status_code=400, detail="대기 중인 상태만 이동이 가능합니다.")

    # 대상 클래스 확인
    target_class = db.query(ClassInfo).filter(
        ClassInfo.id == class_update.target_class_id,
        ClassInfo.store_id == current_store.id
    ).first()

    if not target_class:
        raise HTTPException(status_code=404, detail="대상 클래스를 찾을 수 없습니다.")

    # 대상 클래스의 마지막 순서 찾기
    max_order = db.query(func.max(WaitingList.class_order)).filter(
        WaitingList.business_date == waiting.business_date,
        WaitingList.class_id == target_class.id,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).scalar()

    new_order = (max_order or 0) + 1

    # 클래스 이동
    old_class_id = waiting.class_id
    old_business_date = waiting.business_date

    waiting.class_id = target_class.id
    waiting.class_order = new_order

    # 변경사항을 DB에 즉시 반영 (쿼리 전에 flush 필수)
    db.flush()

    # 기존 클래스의 순서 정규화: 1번째, 2번째, 3번째... 순서로 재정렬
    old_class_waitings = db.query(WaitingList).filter(
        WaitingList.business_date == old_business_date,
        WaitingList.class_id == old_class_id,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).order_by(WaitingList.class_order).all()

    for idx, w in enumerate(old_class_waitings, start=1):
        w.class_order = idx

    # 새 클래스의 순서 정규화: 1번째, 2번째, 3번째... 순서로 재정렬
    new_class_waitings = db.query(WaitingList).filter(
        WaitingList.business_date == old_business_date,
        WaitingList.class_id == target_class.id,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).order_by(WaitingList.class_order).all()

    for idx, w in enumerate(new_class_waitings, start=1):
        w.class_order = idx

    db.commit()

    # SSE 브로드캐스트 분리 전송
    settings = db.query(StoreSettings).options(
        defer(StoreSettings.enable_franchise_monitoring)
    ).filter(StoreSettings.store_id == current_store.id).first()
    
    franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
    target_franchise_id = None
    
    monitoring_enabled = True
    if settings:
        try:
            monitoring_enabled = settings.enable_franchise_monitoring
        except:
             monitoring_enabled = True
             
    if monitoring_enabled:
        target_franchise_id = franchise_id
        
    # 1. 관리자(Admin) 전송
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="class_moved",
        data={
            "waiting_id": waiting_id,
            "old_class_id": old_class_id,
            "new_class_id": target_class.id,
            "new_class_name": target_class.class_name
        },
        franchise_id=target_franchise_id,
        target_role='admin'
    )
    
    # 2. 대기현황판(Board) 전송
    should_broadcast_board = True
    should_broadcast_reception = True
    
    if settings:
        should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
        should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

    common_data = {
        "waiting_id": waiting_id,
        "old_class_id": old_class_id,
        "new_class_id": target_class.id,
        "new_class_name": target_class.class_name
    }

    if should_broadcast_board:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="class_moved",
            data=common_data,
            franchise_id=None,
            target_role='board'
        )

    # 3. 접수대(Reception) 전송
    if should_broadcast_reception:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="class_moved",
            data=common_data,
            franchise_id=None,
            target_role='reception'
        )

    return {"message": f"{target_class.class_name}(으)로 이동되었습니다."}

@router.post("/batch-attendance")
async def batch_attendance(
    batch: BatchAttendance,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    교시 마감 처리
    - 특정 교시를 마감하여 더 이상 대기자를 등록할 수 없게 함
    - 대기자 상태는 변경하지 않고 그대로 유지 (비활성화 상태로 표시)
    """
    today = get_current_business_date(db, current_store.id)

    # 클래스 정보 조회
    class_info = db.query(ClassInfo).filter(
        ClassInfo.id == batch.class_id,
        ClassInfo.store_id == current_store.id
    ).first()
    if not class_info:
        raise HTTPException(status_code=404, detail="클래스를 찾을 수 없습니다.")

    # 이미 마감된 교시인지 확인
    existing_closure = db.query(ClassClosure).filter(
        ClassClosure.business_date == today,
        ClassClosure.class_id == batch.class_id,
        ClassClosure.store_id == current_store.id
    ).first()

    if existing_closure:
        raise HTTPException(status_code=400, detail="이미 마감된 교시입니다.")

    # 순차 마감 검증: 이전 교시들이 모두 마감되었는지 확인
    # 오늘 운영되는 모든 클래스 조회
    all_classes_raw = db.query(ClassInfo).filter(
        ClassInfo.is_active == True,
        ClassInfo.store_id == current_store.id
    ).order_by(ClassInfo.class_number).all()
    
    # 오늘 요일에 맞는 클래스만 필터링
    from routers.waiting import filter_classes_by_weekday
    all_classes = filter_classes_by_weekday(all_classes_raw, today, db, current_store.id)
    
    # 현재 마감하려는 클래스보다 앞선 클래스들 찾기
    previous_classes = [c for c in all_classes if c.class_number < class_info.class_number]
    
    # 앞선 클래스들이 모두 마감되었는지 확인
    for prev_class in previous_classes:
        prev_closure = db.query(ClassClosure).filter(
            ClassClosure.business_date == today,
            ClassClosure.class_id == prev_class.id,
            ClassClosure.store_id == current_store.id
        ).first()
        
        if not prev_closure:
            raise HTTPException(
                status_code=400, 
                detail=f"{prev_class.class_name}이(가) 아직 마감되지 않았습니다. 교시는 순서대로 마감해야 합니다."
            )

    # 해당 클래스의 대기 중인 목록 조회 (카운트용) -> 상태 변경용으로 수정
    waiting_list = db.query(WaitingList).filter(
        WaitingList.business_date == today,
        WaitingList.class_id == batch.class_id,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).all()
    
    waiting_count = len(waiting_list)

    # 대기자 상태를 'attended'로 변경하고 출석 시간 기록
    for waiting in waiting_list:
        waiting.status = "attended"
        waiting.attended_at = datetime.now()

    # 교시 마감 레코드 생성
    closure = ClassClosure(
        business_date=today,
        class_id=batch.class_id,
        closed_at=datetime.now(),
        store_id=current_store.id
    )
    db.add(closure)
    db.commit()

    # SSE 브로드캐스트 분리 전송
    settings = db.query(StoreSettings).options(
        defer(StoreSettings.enable_franchise_monitoring)
    ).filter(StoreSettings.store_id == current_store.id).first()
    
    franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
    target_franchise_id = None
    
    monitoring_enabled = True
    if settings:
        try:
            monitoring_enabled = settings.enable_franchise_monitoring
        except:
             monitoring_enabled = True
             
    if monitoring_enabled:
        target_franchise_id = franchise_id
        
    # [1] class_closed 이벤트 브로드캐스트
    
    # 1. 관리자(Admin) 전송
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="class_closed",
        data={
            "class_id": batch.class_id,
            "class_name": class_info.class_name,
            "waiting_count": waiting_count
        },
        franchise_id=target_franchise_id,
        target_role='admin'
    )
    
    # 2. 대기현황판(Board) 전송 (설정 확인)
    should_broadcast_board = True
    # 2. 대기현황판(Board)에게 전송
    should_broadcast_board = True
    should_broadcast_reception = True
    
    if settings:
        should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
        should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

    common_data = {
        "class_id": batch.class_id,
        "class_name": class_info.class_name,
        "waiting_count": waiting_count
    }

    if should_broadcast_board:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="class_closed",
            data=common_data,
            franchise_id=None,
            target_role='board'
        )

    # 3. 접수대(Reception)에게 전송
    if should_broadcast_reception:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="class_closed",
            data=common_data,
            franchise_id=None,
            target_role='reception'
        )
    
    # [2] batch_attendance 이벤트 브로드캐스트 (출석현황 업데이트용)
    
    # 1. 관리자(Admin) 전송
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="batch_attendance",
        data={
            "class_id": batch.class_id,
            "class_name": class_info.class_name,
            "count": waiting_count
        },
        franchise_id=target_franchise_id,
        target_role='admin'
    )
    
    # 2. 대기현황판(Board) 전송
    should_broadcast_board = True
    should_broadcast_reception = True
    
    if settings:
        should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
        should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

    common_data = {
        "class_id": batch.class_id,
        "class_name": class_info.class_name,
        "count": waiting_count
    }

    if should_broadcast_board:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="batch_attendance",
            data=common_data,
            franchise_id=None,
            target_role='board'
        )

    # 3. 접수대(Reception) 전송
    if should_broadcast_reception:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="batch_attendance",
            data=common_data,
            franchise_id=None,
            target_role='reception'
        )

    return {
        "message": f"{class_info.class_name}이(가) 마감되고 {waiting_count}명이 일괄 출석 처리되었습니다.",
        "waiting_count": waiting_count
    }

@router.delete("/close-class/{class_id}")
async def unclose_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    교시 마감 해제
    - 실수로 마감한 교시를 다시 열어 대기자를 등록할 수 있게 함
    """
    today = get_current_business_date(db, current_store.id)

    # 마감 레코드 조회
    closure = db.query(ClassClosure).filter(
        ClassClosure.business_date == today,
        ClassClosure.class_id == class_id,
        ClassClosure.store_id == current_store.id
    ).first()

    if not closure:
        raise HTTPException(status_code=404, detail="마감되지 않은 교시입니다.")

    # 클래스 정보 조회
    class_info = db.query(ClassInfo).filter(
        ClassInfo.id == class_id,
        ClassInfo.store_id == current_store.id
    ).first()

    if not class_info:
        raise HTTPException(status_code=404, detail="클래스를 찾을 수 없습니다.")

    # 마감 레코드 삭제
    db.delete(closure)
    db.commit()

    # SSE 브로드캐스트: 교시 마감 해제 알림
    settings = db.query(StoreSettings).options(
        defer(StoreSettings.enable_franchise_monitoring)
    ).filter(StoreSettings.store_id == current_store.id).first()
    
    franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
    
    # 1. Admin
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="class_reopened",
        data={
            "class_id": class_id,
            "class_name": class_info.class_name
        },
        franchise_id=franchise_id,
        target_role='admin'
    )
    
    # 2. Board & Reception
    should_broadcast_board = True
    should_broadcast_reception = True
    
    if settings:
        should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
        should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)
        
    if should_broadcast_board:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="class_reopened",
            data={
                "class_id": class_id,
                "class_name": class_info.class_name
            },
            franchise_id=None,
            target_role='board'
        )
        
    if should_broadcast_reception:
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="class_reopened",
            data={
                "class_id": class_id,
                "class_name": class_info.class_name
            },
            franchise_id=None,
            target_role='reception'
        )

    return {
        "message": f"{class_info.class_name}의 마감이 해제되었습니다."
    }

@router.get("/next-batch-class")
async def get_next_batch_class(
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    다음 교시 마감 대상 클래스 조회
    - 대기자가 있고 마감되지 않은 첫 번째 클래스 반환
    """
    today = get_current_business_date(db, current_store.id)

    # 이미 마감된 교시 ID 목록
    closed_class_ids = db.query(ClassClosure.class_id).filter(
        ClassClosure.business_date == today,
        ClassClosure.store_id == current_store.id
    ).all()
    closed_class_ids = set(c.class_id for c in closed_class_ids)

    # 활성화된 클래스 조회 및 오늘 요일에 맞는 클래스만 필터링
    classes_raw = db.query(ClassInfo).filter(
        ClassInfo.is_active == True,
        ClassInfo.store_id == current_store.id
    ).order_by(ClassInfo.class_number).all()

    # 헬퍼 함수를 사용하여 오늘 요일에 맞는 클래스만 필터링 (공휴일 체크 포함)
    classes = filter_classes_by_weekday(classes_raw, today, db, current_store.id)

    for cls in classes:
        # 마감된 교시는 건너뜀
        if cls.id in closed_class_ids:
            continue

        count = db.query(func.count(WaitingList.id)).filter(
            WaitingList.business_date == today,
            WaitingList.class_id == cls.id,
            WaitingList.status == "waiting",
            WaitingList.store_id == current_store.id
        ).scalar()

        if count > 0:
            return {
                "class_id": cls.id,
                "class_name": cls.class_name,
                "class_number": cls.class_number,
                "waiting_count": count
            }

    return {
        "class_id": None,
        "message": "대기자가 없습니다."
    }

@router.get("/closed-classes")
async def get_closed_classes(
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    오늘 마감된 교시 목록 조회
    """
    today = get_current_business_date(db, current_store.id)

    closed_classes = db.query(ClassClosure).filter(
        ClassClosure.business_date == today,
        ClassClosure.store_id == current_store.id
    ).all()

    return {
        "closed_class_ids": [c.class_id for c in closed_classes]
    }

@router.post("/insert-empty-seat")
async def insert_empty_seat(
    empty_seat: EmptySeatInsert,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    빈 좌석 삽입
    - 선택한 대기자 뒤에 빈 좌석을 삽입
    - 뒤의 대기자들 순서는 자동으로 밀림
    """
    # 기준 대기자 조회
    base_waiting = db.query(WaitingList).filter(
        WaitingList.id == empty_seat.waiting_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not base_waiting:
        raise HTTPException(status_code=404, detail="대기자를 찾을 수 없습니다.")

    if base_waiting.status != "waiting":
        raise HTTPException(status_code=400, detail="대기 중인 상태만 빈 좌석을 삽입할 수 있습니다.")

    today = get_current_business_date(db, current_store.id)

    # 해당 클래스에서 기준 대기자보다 뒤에 있는 모든 대기자들의 순서를 1씩 증가
    following_waitings = db.query(WaitingList).filter(
        WaitingList.business_date == today,
        WaitingList.class_id == base_waiting.class_id,
        WaitingList.class_order > base_waiting.class_order,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).all()

    for waiting in following_waitings:
        waiting.class_order += 1

    # 빈 좌석 생성 (기준 대기자 바로 뒤)
    empty_seat_entry = WaitingList(
        business_date=today,
        waiting_number=0,  # 빈 좌석은 대기번호 0
        phone="empty",
        name="빈좌석",
        class_id=base_waiting.class_id,
        class_order=base_waiting.class_order + 1,
        is_empty_seat=True,
        status="waiting",
        registered_at=datetime.now(),
        store_id=current_store.id
    )

    db.add(empty_seat_entry)

    # 해당 클래스의 모든 대기자 순서 정규화: 1번째, 2번째, 3번째... 순서로 재정렬
    all_class_waitings = db.query(WaitingList).filter(
        WaitingList.business_date == today,
        WaitingList.class_id == base_waiting.class_id,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).order_by(WaitingList.class_order).all()

    for idx, w in enumerate(all_class_waitings, start=1):
        w.class_order = idx

    db.commit()
    db.refresh(empty_seat_entry)

    # 클래스 정보 조회
    class_info = db.query(ClassInfo).filter(
        ClassInfo.id == base_waiting.class_id,
        ClassInfo.store_id == current_store.id
    ).first()

    # SSE 브로드캐스트: 빈 좌석 삽입 알림
    await sse_manager.broadcast(
        store_id=str(current_store.id),
        event_type="empty_seat_inserted",
        data={
            "id": empty_seat_entry.id,
            "class_id": base_waiting.class_id,
            "class_name": class_info.class_name,
            "class_order": empty_seat_entry.class_order
        }
    )

    return {
        "message": f"{class_info.class_name} {base_waiting.class_order}번 뒤에 빈 좌석이 삽입되었습니다.",
        "empty_seat_id": empty_seat_entry.id
    }
