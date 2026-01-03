from fastapi import APIRouter, Depends, HTTPException
from core.logger import logger
from sqlalchemy.orm import Session, joinedload, defer
from sqlalchemy import func, and_
from datetime import datetime, date, time
from typing import List, Optional, Dict
import json

from database import get_db
from models import WaitingList, ClassInfo, Member, DailyClosing, ClassClosure, Store, StoreSettings, WaitingHistory, Holiday
from auth import get_current_store
from schemas import (
    WaitingListCreate,
    WaitingListResponse,
    WaitingList as WaitingListSchema,
    WaitingListDetail
)
from sse_manager import sse_manager
from utils import get_today_date, get_kst_now

router = APIRouter()

from sqlalchemy.exc import OperationalError

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
    start_hour = 7
    try:
        # Select specific column to avoid error if new columns are missing in DB
        start_hour_scalar = db.query(StoreSettings.business_day_start).filter(
            StoreSettings.store_id == store_id
        ).scalar()
        
        if start_hour_scalar is not None:
             start_hour = start_hour_scalar
             
    except OperationalError:
        # 컬럼이 없는 경우 기본값 사용 (마이그레이션 과도기 대응)
        pass
    except Exception as e:
        # 기타 에러는 로그만 남기고 기본값 사용
        logger.error(f"Error fetching business_day_start: {e}")
        pass
        
    return get_today_date(start_hour)

# 요일 매핑
WEEKDAY_MAP = {
    0: "mon", 1: "tue", 2: "wed", 3: "thu",
    4: "fri", 5: "sat", 6: "sun"
}

DEFAULT_WEEKDAY_SCHEDULE = {
    "mon": True, "tue": True, "wed": True, "thu": True,
    "fri": True, "sat": True, "sun": True
}

def parse_weekday_schedule(schedule_str: str) -> Dict[str, bool]:
    """JSON 문자열을 weekday_schedule 딕셔너리로 안전하게 변환"""
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
    """
    # 1. 공휴일 여부 확인
    is_holiday = db.query(Holiday).filter(
        Holiday.store_id == store_id,
        Holiday.date == target_date
    ).first()

    filtered_classes = []
    
    if is_holiday:
        # 공휴일이면 'holiday' 타입만 사용 (TODO: 'all' 타입도 포함할지? 기획상 '공휴일 클래스' 탭이 따로 있으므로 holiday만)
        for cls in classes:
            if hasattr(cls, 'class_type') and cls.class_type == 'holiday':
                filtered_classes.append(cls)
        return filtered_classes

    # 공휴일이 아니면 기존 로직 (단, holiday 타입은 제외)
    weekday_idx = target_date.weekday()
    weekday = WEEKDAY_MAP[weekday_idx]
    is_weekend = weekday_idx >= 5  # 5: Sat, 6: Sun

    for cls in classes:
        # 'holiday' 타입은 평일/주말 스케줄에서 제외
        if hasattr(cls, 'class_type'):
            if cls.class_type == 'holiday':
                continue
            
            # class_type에 따른 평일/주말 필터링 강제 적용
            if cls.class_type == 'weekday' and is_weekend:
                continue
            if cls.class_type == 'weekend' and not is_weekend:
                continue
            
        schedule = parse_weekday_schedule(cls.weekday_schedule)
        if schedule.get(weekday, True):
            filtered_classes.append(cls)

    return filtered_classes

def get_next_waiting_number(db: Session, business_date: date, store_id: int) -> int:
    """다음 대기번호 생성"""
    max_number = db.query(func.max(WaitingList.waiting_number)).filter(
        WaitingList.business_date == business_date,
        WaitingList.store_id == store_id
    ).scalar()

    return (max_number or 0) + 1

def get_available_class(db: Session, business_date: date, store_id: int):
    """배치 가능한 클래스 찾기 - 순차적으로 다음 클래스에 배치 (마감된 교시 제외)"""
    classes_raw = db.query(ClassInfo).filter(
        ClassInfo.is_active == True,
        ClassInfo.store_id == store_id
    ).order_by(ClassInfo.class_number).all()

    # 헬퍼 함수를 사용하여 오늘 요일에 맞는 클래스만 필터링
    classes = filter_classes_by_weekday(classes_raw, business_date, db, store_id)

    if not classes:
        raise HTTPException(status_code=400, detail="오늘 운영하는 클래스가 없습니다.")

    # 마감된 교시 ID 목록 조회
    closed_class_ids = db.query(ClassClosure.class_id).filter(
        ClassClosure.business_date == business_date,
        ClassClosure.store_id == store_id
    ).all()
    closed_class_ids = set(c.class_id for c in closed_class_ids)

    # 마감되지 않은 교시만 필터링
    available_classes = [c for c in classes if c.id not in closed_class_ids]

    if not available_classes:
        raise HTTPException(status_code=400, detail="모든 교시가 마감되었습니다. 대기 접수를 받을 수 없습니다.")

    # 순차적 배정 로직 개선: 1교시부터 차레대로 빈 자리 확인
    logger.debug(f"[ClassAssign] Finding slot for Store {store_id} on {business_date}")
    
    # 순차적 배정 로직 개선: 1교시부터 차레대로 빈 자리 확인
    # "마지막 등록자" 기준이 아니라 "빈 자리" 기준으로 변경하여 중간에 빈 교시가 있으면 채워넣도록 함
    
    for cls in available_classes:
        # 해당 클래스의 총 정원 점유율 계산 (Waiting + Called + Attended)
        total_occupancy = db.query(func.count(WaitingList.id)).filter(
            WaitingList.class_id == cls.id,
            WaitingList.business_date == business_date,
            WaitingList.status.in_(["waiting", "called", "attended"]),
            WaitingList.store_id == store_id
        ).scalar()
        
        logger.debug(f"[ClassAssign] Checking {cls.class_name} (ID: {cls.id}): {total_occupancy}/{cls.max_capacity}")

        if total_occupancy < cls.max_capacity:
            # 순번은 대기 중인 사람(waiting, called)만 카운트 (attended 제외)
            queue_count = db.query(func.count(WaitingList.id)).filter(
                WaitingList.class_id == cls.id,
                WaitingList.business_date == business_date,
                WaitingList.status.in_(["waiting", "called"]),
                WaitingList.store_id == store_id
            ).scalar()
            
            logger.info(f"[ClassAssign] Assigned {cls.class_name} (ID: {cls.id}). Occupancy: {total_occupancy}, Queue: {queue_count}")
            return cls, queue_count + 1
            
    # 모든 교시가 꽉 찬 경우
    logger.warning("[ClassAssign] All classes are full.")
    raise HTTPException(status_code=400, detail="모든 교시의 정원이 마감되었습니다.")


from sse_manager import sse_manager

@router.post("/register", response_model=WaitingListResponse)
async def register_waiting(
    waiting: WaitingListCreate,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기 접수
    - 핸드폰번호로 접수
    - 회원인 경우 자동으로 이름 매칭
    - 자동으로 클래스 배치
    """
    current_store.last_heartbeat = datetime.now()
    today = get_current_business_date(db, current_store.id)

    # 영업 중인지 확인
    business = db.query(DailyClosing).filter(
        DailyClosing.business_date == today,
        DailyClosing.is_closed == False,
        DailyClosing.store_id == current_store.id
    ).first()

    if not business:
        raise HTTPException(status_code=400, detail="영업 중이 아닙니다. 개점을 먼저 진행해주세요.")

    # 이미 대기 중인지 확인
    existing = db.query(WaitingList).filter(
        WaitingList.business_date == today,
        WaitingList.phone == waiting.phone,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="이미 대기 중인 번호입니다.\n핸드폰번호를 다시 확인하여 주세요.")

    # 매장 설정 조회
    from models import StoreSettings
    settings = db.query(StoreSettings).filter(StoreSettings.store_id == current_store.id).first()
    
    # 영업 시간 및 브레이크 타임 체크 (관리자 수동 등록은 제외)
    if settings and not waiting.is_admin_registration:
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
    
    # 1. 최대 대기 인원 제한 체크 (use_max_waiting_limit가 활성화된 경우에만)
    if settings:
        # 대기접수 데스크 사용 여부 확인 (신규 추가)
        # Note: settings.enable_reception_desk default is True
        if hasattr(settings, 'enable_reception_desk') and not settings.enable_reception_desk:
            # 관리자(대기관리) 페이지에서의 등록은 예외 허용
            if not waiting.is_admin_registration:
                 raise HTTPException(
                    status_code=403, 
                    detail="대기접수가 비활성화되었습니다. 관리자에게 문의해주세요."
                )

        if settings.use_max_waiting_limit and settings.max_waiting_limit > 0:
            # 현재 대기 중인 총 인원 확인
            current_waiting_count = db.query(func.count(WaitingList.id)).filter(
                WaitingList.business_date == today,
                WaitingList.status == "waiting",
                WaitingList.store_id == current_store.id
            ).scalar()

            if current_waiting_count >= settings.max_waiting_limit:
                raise HTTPException(
                    status_code=400,
                    detail=f"대기 인원이 가득 찼습니다. (최대 {settings.max_waiting_limit}명)"
                )
    
    # 2. 마지막 교시 정원 초과 차단 체크
    if settings and settings.block_last_class_registration:
        # 오늘 운영되는 클래스 조회
        classes_raw = db.query(ClassInfo).filter(
            ClassInfo.is_active == True,
            ClassInfo.store_id == current_store.id
        ).order_by(ClassInfo.class_number).all()
        
        # 오늘 요일에 맞는 클래스만 필터링
        classes = filter_classes_by_weekday(classes_raw, today, db, current_store.id)
        
        if classes:
            # 마지막 교시 찾기 (class_number가 가장 큰 것)
            last_class = max(classes, key=lambda c: c.class_number)
            
            # 마지막 교시의 현재 대기 인원 확인
            # Current count must include waiting and attended users to respect total capacity
            last_class_count = db.query(func.count(WaitingList.id)).filter(
                WaitingList.class_id == last_class.id,
                WaitingList.business_date == today,
                WaitingList.status.in_(["waiting", "called", "attended"]),
                WaitingList.store_id == current_store.id
            ).scalar()
            
            # 정원 초과 시 차단
            if last_class_count >= last_class.max_capacity:
                raise HTTPException(
                    status_code=400,
                    detail="교시 접수가 마감되었습니다."
                )

    # 회원 정보 조회
    member = db.query(Member).filter(
        Member.phone == waiting.phone,
        Member.store_id == current_store.id
    ).first()

    is_new_member = (member is None)

    # 자동 회원가입 로직 (auto_register_member 또는 require_member_registration이 활성화된 경우)
    should_auto_register = False
    if settings:
        should_auto_register = getattr(settings, 'auto_register_member', False) or \
                              getattr(settings, 'require_member_registration', False)

    if not member and should_auto_register:
        # 이름이 없는 경우 핸드폰 번호 뒷자리 사용
        member_name = waiting.name if waiting.name else waiting.phone[-4:]
        
        new_member = Member(
            store_id=current_store.id,
            name=member_name,
            phone=waiting.phone,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        db.add(new_member)
        db.flush()  # ID 생성을 위해 flush
        member = new_member
        print(f"자동 회원가입 완료: {member.name} ({member.phone})")

    member_id = member.id if member else None
    name = member.name if member else waiting.name

    # 다음 대기번호 생성
    waiting_number = get_next_waiting_number(db, today, current_store.id)

    # 배치 가능한 클래스 찾기
    all_classes_raw = db.query(ClassInfo).filter(
        ClassInfo.store_id == current_store.id,
        ClassInfo.is_active == True
    ).order_by(ClassInfo.class_number).all()
    
    # 오늘 요일에 운영되는 클래스만 필터링
    all_classes = filter_classes_by_weekday(all_classes_raw, today, db, current_store.id)

    if not all_classes:
        raise HTTPException(status_code=400, detail="오늘 운영하는 교시가 없습니다.")

    # 마감된 교시 목록 조회
    closed_class_ids = [
        cc.class_id for cc in db.query(ClassClosure).filter(
            ClassClosure.store_id == current_store.id,
            ClassClosure.business_date == today
        ).all()
    ]

    # 시작 교시 인덱스 결정 및 유효성 검증
    start_index = 0
    if waiting.class_id:
        # 요청된 class_id가 실제로 오늘 운영되는 교시 목록에 있는지 확인
        class_found = False
        for i, cls in enumerate(all_classes):
            if cls.id == waiting.class_id:
                start_index = i
                class_found = True
                print(f"[REGISTER] Requested class_id={waiting.class_id} found at index {i}")
                break
        
        if not class_found:
            # 요청된 교시가 없으면 경고 로그 출력하고 자동 배치로 전환
            print(f"[WARNING] Requested class_id={waiting.class_id} not found in active classes for today. Available class IDs: {[c.id for c in all_classes]}")
            print(f"[REGISTER] Falling back to automatic class assignment")
            start_index = 0
    
    # 순차 탐색 (Overflow Logic)
    target_class = None
    class_order = 0
    
    for i in range(start_index, len(all_classes)):
        cls = all_classes[i]
        
        # 1. 마감 여부 체크
        if cls.id in closed_class_ids:
            print(f"[REGISTER] Class {cls.id} ({cls.class_name}) is closed, skipping")
            continue
            
        # 2. 정원 체크 (대기 + 호출 + 출석 모두 포함)
        current_count = db.query(func.count(WaitingList.id)).filter(
            WaitingList.class_id == cls.id,
            WaitingList.business_date == today,
            WaitingList.status.in_(["waiting", "called", "attended"]),
            WaitingList.store_id == current_store.id
        ).scalar()
        
        print(f"[REGISTER] Class {cls.id} ({cls.class_name}): {current_count}/{cls.max_capacity}")
        
        if current_count < cls.max_capacity:
            target_class = cls
            
            # 순번은 대기 중인 사람(waiting, called)만 카운트
            queue_count = db.query(func.count(WaitingList.id)).filter(
                WaitingList.class_id == cls.id,
                WaitingList.business_date == today,
                WaitingList.status.in_(["waiting", "called"]),
                WaitingList.store_id == current_store.id
            ).scalar()
            
            class_order = queue_count + 1
            print(f"[REGISTER] Assigned to class {cls.id} ({cls.class_name}) as order {class_order}")
            break
            
    if not target_class:
        # 모든 교시가 마감되었거나 정원 초과
        print(f"[REGISTER ERROR] No available class found. Requested class_id={waiting.class_id}, Available classes: {len(all_classes)}, Closed: {len(closed_class_ids)}")
        if waiting.class_id:
             raise HTTPException(status_code=400, detail="선택한 교시 및 이후 모든 교시가 마감되었거나 정원이 초과되었습니다.")
        else:
             raise HTTPException(status_code=400, detail="등록 가능한 교시가 없습니다 (모두 마감 또는 정원 초과).")

    # 인원수 설정 (total_party_size가 0이면 기존 person_count 사용)
    total_size = waiting.total_party_size if (waiting.total_party_size and waiting.total_party_size > 0) else (waiting.person_count or 1)

    # 대기자 등록
    new_waiting = WaitingList(
        business_date=today,
        waiting_number=waiting_number,
        phone=waiting.phone,
        name=name,
        class_id=target_class.id,
        class_order=class_order,
        member_id=member_id,
        status="waiting",
        registered_at=datetime.now(),
        store_id=current_store.id,
        total_party_size=total_size,
        party_size_details=waiting.party_size_details
    )

    db.add(new_waiting)
    db.commit()
    db.refresh(new_waiting)

    # SSE 브로드캐스트: 새로운 대기자 등록 알림
    # SSE 실패가 등록 자체를 실패하게 하면 안됨 -> try/except 처리
    try:
        franchise_id = str(current_store.franchise_id) if current_store.franchise_id else None
        target_franchise_id = None
        
        if franchise_id:
            # 설정 확인: 프랜차이즈 모니터링이 켜져있을 때만 브로드캐스트
            monitoring_enabled = True
            if settings:
                try:
                    monitoring_enabled = settings.enable_franchise_monitoring
                except:
                    monitoring_enabled = True # Default if column missing

            if monitoring_enabled:
             if monitoring_enabled:
                  target_franchise_id = franchise_id
                  logger.debug(f"Broadcasting new_user event: store_id={current_store.id}, franchise_id={franchise_id}")
             else:
                  logger.debug(f"Skipping franchise broadcast (disabled by settings): store_id={current_store.id}")
        


        # SSE 브로드캐스트 분리 전송
        # 1. 관리자(Admin)에게는 무조건 전송 (설정과 무관하게 업데이트)
        await sse_manager.broadcast(
            store_id=str(current_store.id),
            event_type="new_user",
            data={
                "id": new_waiting.id,
                "waiting_id": new_waiting.id,
                "waiting_number": waiting_number,
                "class_id": target_class.id,
                "class_name": target_class.class_name,
                "class_order": class_order,
                "name": name,
                "phone": waiting.phone,
                "display_name": name if name else waiting.phone[-4:]
            },
            franchise_id=target_franchise_id,
            target_role='admin' # Optimization: Send only to admin here. Board/Reception happen below.
        )

        # 2. 대기현황판(Board)에게 전송
        should_broadcast_board = True
        should_broadcast_reception = True
        
        if settings:
            should_broadcast_board = getattr(settings, 'enable_waiting_board', True) 
            should_broadcast_reception = getattr(settings, 'enable_reception_desk', True)

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

        if should_broadcast_board:
            await sse_manager.broadcast(
                store_id=str(current_store.id),
                event_type="new_user",
                data=common_data,
                franchise_id=None, 
                target_role='board'
            )
            
        # 3. 접수대(Reception)에게 전송
        if should_broadcast_reception:
            await sse_manager.broadcast(
                store_id=str(current_store.id),
                event_type="new_user",
                data=common_data,
                franchise_id=None, 
                target_role='reception'
            )
            
    except Exception as e:
        logger.error(f"Failed to broadcast SSE event: {str(e)}")
        # SSE 실패는 무시하고 진행


    # 응답 메시지 생성
    message = f"대기번호: {waiting_number}번\n{target_class.class_name} {class_order}번째\n대기 등록이 완료되었습니다."

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
        message=message,
        is_new_member=is_new_member
    )
@router.post("", response_model=WaitingListResponse)
async def create_waiting(
    waiting: WaitingListCreate,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기 접수 (Alias for /register)
    - dashboard 등에서 호출 표준화
    """
    return await register_waiting(waiting, db, current_store)


@router.get("/next-slot")
async def get_next_slot(
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    다음 대기 등록 시 배정될 예정인 교시 조회 (Reception Desk용 Single Source of Truth)
    """
    today = get_current_business_date(db, current_store.id)
    
    # 총 대기 인원 (waiting only) for overall status
    total_waiting = db.query(func.count(WaitingList.id)).filter(
        WaitingList.business_date == today,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).scalar()

    # Fetch settings
    from models import StoreSettings
    settings = db.query(StoreSettings).filter(StoreSettings.store_id == current_store.id).first()

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

    # 1. Available Classes (Same logic as register_waiting)
    all_classes_raw = db.query(ClassInfo).filter(
        ClassInfo.store_id == current_store.id,
        ClassInfo.is_active == True
    ).order_by(ClassInfo.class_number).all()
    
    classes = filter_classes_by_weekday(all_classes_raw, today, db, current_store.id)
    
    if not classes:
         return {
            "class_id": -1,
            "class_name": "운영 교시 없음",
            "class_order": 0,
            "max_capacity": 0,
            "is_full": True,
            "is_business_hours": is_business_hours,
            "is_break_time": is_break_time,
            "total_waiting": total_waiting 
        }

    # 2. Closed Classes
    closed_ids = [
        cc.class_id for cc in db.query(ClassClosure).filter(
            ClassClosure.store_id == current_store.id,
            ClassClosure.business_date == today
        ).all()
    ]
    
    # 3. Find First Available Slot (Sequential)
    next_class = None
    next_order = 0
    is_fully_booked = True
    
    for cls in classes:
        if cls.id in closed_ids:
            continue
            
        # Get Occupancy (Waiting + Called + Attended)
        total_occupancy = db.query(func.count(WaitingList.id)).filter(
            WaitingList.class_id == cls.id,
            WaitingList.business_date == today,
            WaitingList.status.in_(["waiting", "called", "attended"]),
            WaitingList.store_id == current_store.id
        ).scalar()
        
        if total_occupancy < cls.max_capacity:
            next_class = cls
            
            # 순번은 대기 중인 사람(waiting, called)만 카운트
            queue_count = db.query(func.count(WaitingList.id)).filter(
                WaitingList.class_id == cls.id,
                WaitingList.business_date == today,
                WaitingList.status.in_(["waiting", "called"]),
                WaitingList.store_id == current_store.id
            ).scalar()
            
            next_order = queue_count + 1
            is_fully_booked = False
            break
            
    if is_fully_booked:
        return {
            "class_id": -1,
            "class_name": "접수 마감",
            "class_order": 0,
            "max_capacity": 0,
            "is_full": True,
            "is_business_hours": is_business_hours,
            "is_break_time": is_break_time,
            "total_waiting": total_waiting
        }
        
    return {
        "class_id": next_class.id,
        "class_name": next_class.class_name,
        "class_order": next_order,
        "max_capacity": next_class.max_capacity,
        "is_full": False,
        "is_business_hours": is_business_hours,
        "is_break_time": is_break_time,
        "total_waiting": total_waiting,
        "business_hours": {
            "start": settings.business_start_time.strftime('%H:%M') if settings and settings.business_start_time else "09:00",
            "end": settings.business_end_time.strftime('%H:%M') if settings and settings.business_end_time else "22:00",
        },
        "break_time": {
            "enabled": settings.enable_break_time if settings else False,
            "start": settings.break_start_time.strftime('%H:%M') if settings and settings.break_start_time else "12:00",
            "end": settings.break_end_time.strftime('%H:%M') if settings and settings.break_end_time else "13:00",
        },
        "voice_settings": {
            "enable_waiting_voice_alert": getattr(settings, 'enable_waiting_voice_alert', True) if settings else True,
            "waiting_voice_message": getattr(settings, 'waiting_voice_message', None) if settings else None,
            "waiting_call_voice_message": getattr(settings, 'waiting_call_voice_message', None) if settings else None,
            "waiting_voice_name": getattr(settings, 'waiting_voice_name', None) if settings else None,
            "waiting_voice_rate": getattr(settings, 'waiting_voice_rate', 1.0) if settings else 1.0,
            "waiting_voice_pitch": getattr(settings, 'waiting_voice_pitch', 1.0) if settings else 1.0,
            "waiting_call_voice_repeat_count": getattr(settings, 'waiting_call_voice_repeat_count', 1) if settings else 1,
            "enable_duplicate_registration_voice": getattr(settings, 'enable_duplicate_registration_voice', True) if settings else True,
            "duplicate_registration_voice_message": getattr(settings, 'duplicate_registration_voice_message', None) if settings else None,
            "enable_calling_voice_alert": getattr(settings, 'enable_calling_voice_alert', True) if settings else True
        }
    }


@router.get("/check/{phone}")
async def check_waiting_status(
    phone: str,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기 현황 조회 (모바일용)
    - 핸드폰번호로 조회
    """
    today = date.today()

    waiting = db.query(WaitingList).filter(
        WaitingList.business_date == today,
        WaitingList.phone == phone,
        WaitingList.status == "waiting",
        WaitingList.store_id == current_store.id
    ).first()

    if not waiting:
        return {
            "found": False,
            "message": "대기 내역이 없습니다."
        }

    # 클래스 정보 조회
    class_info = db.query(ClassInfo).filter(
        ClassInfo.id == waiting.class_id,
        ClassInfo.store_id == current_store.id
    ).first()

    # 앞에 대기 중인 사람 수 계산
    ahead_count = db.query(func.count(WaitingList.id)).filter(
        WaitingList.business_date == today,
        WaitingList.status == "waiting",
        WaitingList.waiting_number < waiting.waiting_number,
        WaitingList.store_id == current_store.id
    ).scalar()

    return {
        "found": True,
        "waiting_number": waiting.waiting_number,
        "class_name": class_info.class_name,
        "class_order": waiting.class_order,
        "ahead_count": ahead_count,
        "registered_at": waiting.registered_at,
        "message": f"대기번호 {waiting.waiting_number}번\n{class_info.class_name} {waiting.class_order}번째\n앞에 {ahead_count}명 대기 중"
    }

@router.get("/list")
async def get_waiting_list(
    business_date: Optional[date] = None,
    status: Optional[str] = None,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기자 목록 조회
    - 날짜별, 상태별, 클래스별 필터링 가능

    수동으로 응답 형식을 생성하여 weekday_schedule 파싱 문제 해결
    """
    if not business_date:
        business_date = get_current_business_date(db, current_store.id)

    # class_info와 member를 eager load
    query = db.query(WaitingList).options(
        joinedload(WaitingList.class_info),
        joinedload(WaitingList.member)
    ).filter(
        WaitingList.business_date == business_date,
        WaitingList.store_id == current_store.id
    )

    if status:
        if ',' in status:
            status_list = status.split(',')
            query = query.filter(WaitingList.status.in_(status_list))
        else:
            query = query.filter(WaitingList.status == status)

    if class_id:
        query = query.filter(WaitingList.class_id == class_id)

    # 교시별로 정렬 (class_id 우선, 그 다음 교시 내 순서인 class_order)
    waiting_list = query.order_by(
        WaitingList.class_id,
        WaitingList.class_order
    ).all()

    # 최근 30일 출석 수 일괄 조회 (N+1 문제 방지)
    member_ids = [w.member_id for w in waiting_list if w.member_id]
    member_attendance_counts = {}
    revisit_counts = {}  # 재방문 횟수 (설정 기반)
    
    if member_ids:
        from datetime import timedelta
        
        # 출석 카운트 설정 및 재방문 배지 설정 조회
        settings_data = db.query(
            StoreSettings.attendance_count_type,
            StoreSettings.attendance_lookback_days,
            StoreSettings.enable_revisit_badge,
            StoreSettings.revisit_period_days
        ).filter(StoreSettings.store_id == current_store.id).first()
        
        # 1. 출석 카운트 (기존 로직)
        count_type = settings_data.attendance_count_type if settings_data else 'days'
        lookback_days = settings_data.attendance_lookback_days if settings_data else 30
        
        start_date = business_date
        
        if count_type == 'monthly':
            # 이번 달 1일 부터 조회
            start_date = business_date.replace(day=1)
        else:
            # 최근 N일 (기본 30일)
            start_date = business_date - timedelta(days=lookback_days)
        
        attendance_counts = db.query(
            WaitingList.member_id,
            func.count(WaitingList.id)
        ).filter(
            WaitingList.member_id.in_(member_ids),
            WaitingList.status == 'attended',
            WaitingList.business_date >= start_date,
            WaitingList.business_date <= business_date  # 미래 날짜 제외
        ).group_by(WaitingList.member_id).all()
        
        member_attendance_counts = {member_id: count for member_id, count in attendance_counts}
        
        # 2. 재방문 카운트 (새로운 로직)
        enable_revisit_badge = settings_data.enable_revisit_badge if settings_data else False
        if enable_revisit_badge:
            revisit_period_days = settings_data.revisit_period_days if settings_data else 0
            
            revisit_query = db.query(
                WaitingList.member_id,
                func.count(WaitingList.id)
            ).filter(
                WaitingList.member_id.in_(member_ids),
                WaitingList.status == 'attended'
            )
            
            # 기간 설정이 있는 경우 날짜 필터링 추가
            if revisit_period_days > 0:
                revisit_start_date = business_date - timedelta(days=revisit_period_days)
                revisit_query = revisit_query.filter(WaitingList.business_date >= revisit_start_date)
                
            revisit_query = revisit_query.filter(WaitingList.business_date <= business_date) # 미래 제외
            revisit_results = revisit_query.group_by(WaitingList.member_id).all()
            
            revisit_counts = {member_id: count for member_id, count in revisit_results}

    # 수동으로 dict 생성 (weekday_schedule 파싱 포함)
    result = []
    for waiting in waiting_list:
        # class_info 변환
        class_info_dict = {
            "id": waiting.class_info.id,
            "class_number": waiting.class_info.class_number,
            "class_name": waiting.class_info.class_name,
            "start_time": waiting.class_info.start_time,
            "end_time": waiting.class_info.end_time,
            "max_capacity": waiting.class_info.max_capacity,
            "is_active": waiting.class_info.is_active,
            "weekday_schedule": parse_weekday_schedule(waiting.class_info.weekday_schedule) if isinstance(waiting.class_info.weekday_schedule, str) else waiting.class_info.weekday_schedule,
            "class_type": waiting.class_info.class_type if hasattr(waiting.class_info, 'class_type') else 'all',
            "created_at": waiting.class_info.created_at,
            "updated_at": waiting.class_info.updated_at,
            "current_count": 0  # 이 엔드포인트에서는 current_count 계산하지 않음
        }

        # member 변환 (있는 경우)
        member_dict = None
        if waiting.member:
            member_dict = {
                "id": waiting.member.id,
                "name": waiting.member.name,
                "phone": waiting.member.phone,
                "created_at": waiting.member.created_at
            }

        # waiting 정보 + class_info + member
        waiting_dict = {
            "id": waiting.id,
            "business_date": waiting.business_date,
            "waiting_number": waiting.waiting_number,
            "phone": waiting.phone,
            "name": waiting.member.name if waiting.member and waiting.member.name else waiting.name,
            "class_id": waiting.class_id,
            "class_order": waiting.class_order,
            "member_id": waiting.member_id,
            "is_empty_seat": waiting.is_empty_seat,
            "status": waiting.status,
            "registered_at": waiting.registered_at,
            "attended_at": waiting.attended_at,
            "cancelled_at": waiting.cancelled_at,
            "call_count": waiting.call_count,
            "last_called_at": waiting.last_called_at,
            "message": f"대기번호 {waiting.waiting_number}번\n{waiting.class_info.class_name} {waiting.class_order}번째",
            # 최근 30일 출석 수 (회원이 없는 경우 0)
            "last_month_attendance_count": member_attendance_counts.get(waiting.member_id, 0),
            # 재방문 횟수 (설정 미사용 시 0, 회원이면 계산된 값)
            "revisit_count": revisit_counts.get(waiting.member_id, 0),
            "created_at": waiting.created_at,
            "updated_at": waiting.updated_at,
            "class_info": class_info_dict,
            "member": member_dict,
            "total_party_size": waiting.total_party_size,
            "party_size_details": waiting.party_size_details
        }

        result.append(waiting_dict)

    return result

@router.get("/list/by-class")
async def get_waiting_list_by_class(
    business_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    클래스별로 그룹화된 대기자 목록 조회
    오늘 요일에 운영되는 클래스만 반환
    """
    if not business_date:
        business_date = get_current_business_date(db, current_store.id)

    # 모든 활성 클래스 조회
    classes_raw = db.query(ClassInfo).filter(
        ClassInfo.is_active == True,
        ClassInfo.store_id == current_store.id
    ).order_by(ClassInfo.class_number).all()

    # 헬퍼 함수를 사용하여 오늘 요일에 맞는 클래스만 필터링
    classes = filter_classes_by_weekday(classes_raw, business_date, db, current_store.id)

    result = []

    for cls in classes:
        waiting_list = db.query(WaitingList).options(
            joinedload(WaitingList.member)
        ).filter(
            WaitingList.business_date == business_date,
            WaitingList.class_id == cls.id,
            WaitingList.status == "waiting",
            WaitingList.store_id == current_store.id
        ).order_by(WaitingList.class_order).all()

        # 현재 대기 중인 인원 수 (Display용)
        current_count = len(waiting_list)
        
        # 총 정원 계산용 (Waiting + Called + Attended)
        total_registered_count = db.query(func.count(WaitingList.id)).filter(
            WaitingList.class_id == cls.id,
            WaitingList.business_date == business_date,
            WaitingList.status.in_(["waiting", "called", "attended"]),
            WaitingList.store_id == current_store.id
        ).scalar()

        # Member 이름 우선 사용 로직
        def get_display_name(w):
            if w.member and w.member.name:
                return w.member.name
            return w.name if w.name else w.phone[-4:]

        result.append({
            "class_id": cls.id,
            "class_name": cls.class_name,
            "class_number": cls.class_number,
            "start_time": cls.start_time.strftime("%H:%M"),
            "end_time": cls.end_time.strftime("%H:%M"),
            "max_capacity": cls.max_capacity,
            "current_count": current_count,
            "total_count": total_registered_count, # Predict Logic용
            "waiting_list": [
                {
                    "id": w.id,
                    "waiting_number": w.waiting_number,
                    "name": w.member.name if w.member and w.member.name else w.name,
                    "phone": w.phone,
                    "display_name": get_display_name(w),
                    "class_order": w.class_order,
                    "registered_at": w.registered_at,
                    "member_id": w.member_id,
                    "total_party_size": w.total_party_size,
                    "party_size_details": w.party_size_details
                }
                for w in waiting_list
            ]
        })

    return result

@router.get("/{waiting_id}", response_model=WaitingListResponse)
async def get_waiting_detail(
    waiting_id: int,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기 상세 조회
    """
    waiting = db.query(WaitingList).options(
        joinedload(WaitingList.class_info),
        joinedload(WaitingList.member)
    ).filter(
        WaitingList.id == waiting_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not waiting:
        raise HTTPException(status_code=404, detail="대기 내역을 찾을 수 없습니다.")

    # 응답 메시지 생성
    message = f"대기번호: {waiting.waiting_number}번\n{waiting.class_info.class_name} {waiting.class_order}번째\n대기 중입니다."

    return WaitingListResponse(
        id=waiting.id,
        waiting_number=waiting.waiting_number,
        class_id=waiting.class_id,
        class_name=waiting.class_info.class_name,
        class_order=waiting.class_order,
        phone=waiting.phone,
        name=waiting.member.name if waiting.member and waiting.member.name else waiting.name,
        status=waiting.status,
        registered_at=waiting.registered_at,
        message=message
    )

@router.delete("/{waiting_id}")
async def cancel_waiting(
    waiting_id: int,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    """
    대기 취소
    - 대기자가 직접 취소하는 경우
    """
    waiting = db.query(WaitingList).filter(
        WaitingList.id == waiting_id,
        WaitingList.store_id == current_store.id
    ).first()

    if not waiting:
        raise HTTPException(status_code=404, detail="대기 내역을 찾을 수 없습니다.")

    if waiting.status != "waiting":
        raise HTTPException(status_code=400, detail="이미 처리된 대기입니다.")

    waiting.status = "cancelled"
    waiting.cancelled_at = datetime.now()

    db.commit()

    return {"message": "대기가 취소되었습니다."}




