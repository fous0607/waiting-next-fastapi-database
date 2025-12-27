from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import List, Dict

from database import get_db
from models import DailyClosing, WaitingList, ClassInfo, Store, StoreSettings
from schemas import DailyClosing as DailyClosingSchema, DailyClosingCreate, DailyStatistics
from auth import get_current_store
from utils import get_today_date

router = APIRouter()

def get_current_business_date(db: Session, store_id: int) -> date:
    """
    현재 영업일 조회
    1. 현재 활성화된(is_closed=False) 영업일이 있으면 그 날짜를 반환 (우선순위 높음 - 당일 2회 개점 등 지원)
    2. 없으면 시간/설정 기반의 자연적인 영업일 반환
    """
    # 1. 활성화된 영업일 확인
    active_closing = db.query(DailyClosing).filter(
        DailyClosing.store_id == store_id,
        DailyClosing.is_closed == False
    ).order_by(DailyClosing.business_date.desc()).first()

    if active_closing:
        return active_closing.business_date

    # 2. 설정 기반 계산
    start_hour = db.query(StoreSettings.business_day_start).filter(
        StoreSettings.store_id == store_id
    ).scalar()
    
    if start_hour is None:
        start_hour = 5
    return get_today_date(start_hour)

@router.get("/predict-date", response_model=Dict[str, str])
async def predict_next_business_date(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    개점 예정 날짜 예측
    - 현재 상태와 설정(Strict/Flexible)을 기반으로 개점 시 사용할 날짜를 계산
    """
    # 현재 활성화된 영업일이 있다면 그 날짜 반환
    active_closing = db.query(DailyClosing).filter(
        DailyClosing.store_id == current_store.id,
        DailyClosing.is_closed == False
    ).order_by(DailyClosing.business_date.desc()).first()

    if active_closing:
        return {"business_date": active_closing.business_date.strftime("%Y-%m-%d")}

    # 없으면 계산
    settings_data = db.query(StoreSettings.business_day_start, StoreSettings.daily_opening_rule).filter(
        StoreSettings.store_id == current_store.id
    ).first()
    
    start_hour = settings_data.business_day_start if settings_data else 5
    today = get_today_date(start_hour)
    
    opening_rule = settings_data.daily_opening_rule if settings_data and settings_data.daily_opening_rule else 'strict'
    target_date = today

    # 로직 시뮬레이션
    while True:
        existing = db.query(DailyClosing).filter(
            DailyClosing.store_id == current_store.id,
            DailyClosing.business_date == target_date
        ).first()

        if not existing:
            break
        
        if not existing.is_closed:
            # 이미 열려있음 (위에서 잡혔겠지만 혹시나)
            break

        # 마감된 경우
        if opening_rule == 'strict':
            if target_date == today:
                 # Strict 모드인데 오늘 이미 마감됨 -> 오늘 개점 불가 (UI에서 처리하겠지만 일단 날짜는 오늘로)
                 # 하지만 에러 상황이므로... 다음날로 안내? 아니면 그대로 오늘?
                 # 사용자는 "개점 날짜"를 보고 싶어함. 
                 # 만약 에러가 날 상황이면 에러 메시지를 보여주는게 맞지만, 
                 # 여기서는 "만약 된다면 언제?"를 묻는 것.
                 # Strict 모드에서 오늘 마감했으면 "개점 불가"가 맞음.
                 # 하지만 일단 오늘 날짜 리턴하고 실제 시도 시 에러 발생시킴.
                 # 하지만 일단 오늘 날짜 리턴하고 실제 시도 시 에러 발생시킴.
                 break 
            else:
                 target_date = target_date + timedelta(days=1)
        else:
            # Flexible -> 다음날
            target_date = target_date + timedelta(days=1)
            
    return {"business_date": target_date.strftime("%Y년 %m월 %d일")}

@router.post("/open", response_model=DailyClosingSchema)
async def open_business(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    영업 개점
    - 새로운 영업일 생성
    - 대기번호 1부터 시작
    """
    today = get_current_business_date(db, current_store.id)

    # --- Opening Logic with Rules ---
    opening_rule = db.query(StoreSettings.daily_opening_rule).filter(
        StoreSettings.store_id == current_store.id
    ).scalar()
    
    if not opening_rule:
        opening_rule = 'strict'

    target_date = today
    
    # 루프를 통해 사용 가능한 영업일 찾기 (flexible 모드 지원을 위해)
    while True:
        existing = db.query(DailyClosing).filter(
            DailyClosing.store_id == current_store.id,
            DailyClosing.business_date == target_date
        ).first()

        if not existing:
            # 해당 날짜에 기록이 없으면 개점 가능 -> target_date로 개점 진행
            break
        
        # 기록이 있는 경우
        if not existing.is_closed:
            # 이미 개점 상태인 경우
            raise HTTPException(status_code=400, detail=f"{target_date.strftime('%Y-%m-%d')} 날짜로 이미 영업 중입니다.")

        # 마감된 기록이 있는 경우
        if opening_rule == 'strict':
            # 당일 개점 1회 제한 (엄격 모드) -> 수정: 당일 재개점 허용
            if target_date == today:
                 # 이미 마감된 기록을 다시 활성화 (재개점)
                 print(f"[OPEN] Reactivating closed business day {target_date} for store {current_store.id}")
                 
                 existing.is_closed = False
                 existing.closing_time = None
                 # 기존 통계는 유지하거나 리셋? -> 일단 유지하고, 마감 시 다시 덮어씌워짐.
                 # 필요하다면 total_waiting 등을 리셋할 수도 있지만, 
                 # "잠깐 닫았다가 다시 여는" 실수 상황을 고려하면 유지가 더 안전함.
                 
                 db.commit()
                 db.refresh(existing)
                 return existing
            else:
                 # 미래 날짜의 마감 기록이 있다면? (이론상 드묾) -> 다음 날짜 확인
                 target_date = target_date + timedelta(days=1)
        else:
            # 2회 이상 개점 허용 (다음 날로 이월 모드)
            # 마감된 날짜가 있으면 다음 날짜로 넘어감
            target_date = target_date + timedelta(days=1)


    # 이월 로직을 위한 '이전 영업일' 기준은?
    # 기본적으로 '오늘 - 1일' 이지만, Next Day 모드에서는 target_date - 1일이 맞음.
    today = target_date # today 변수를 실제 개점할 날짜로 업데이트
    # --- Logic End ---

    # --- Carry Over Logic Start ---
    # 이전 영업일이 있고, 자동 마감이 꺼져있는 경우 대기자 이월
    # 1. 이전 영업일 조회
    last_business_date = today - timedelta(days=1)
    last_daily_closing = db.query(DailyClosing).filter(
        DailyClosing.store_id == current_store.id,
        DailyClosing.business_date == last_business_date
    ).first()

    if last_daily_closing:
        # Fetch auto-closing settings safely
        settings_closing = db.query(
            StoreSettings.auto_closing, 
            StoreSettings.closing_action
        ).filter(StoreSettings.store_id == current_store.id).first()
        
        # 2. 미처리 대기자 처리 (자동 마감인 경우)
        if settings_closing and settings_closing.auto_closing:
            # 2-1. 이전 영업일의 대기 중인 고객 조회
            pending_waitings = db.query(WaitingList).filter(
                WaitingList.store_id == current_store.id,
                WaitingList.business_date == last_business_date,
                WaitingList.status == 'waiting'
            ).all()

            for waiting in pending_waitings:
                if settings_closing.closing_action == 'attended':
                    # 출석 처리
                    waiting.status = 'attended'
                    waiting.attended_at = datetime.now() # 혹은 마감 시간? 현재 시간으로 처리
                else:
                    # 리셋 (취소 처리)
                    waiting.status = 'cancelled'
                    waiting.cancelled_at = datetime.now()

        # 3. 자동 마감이 아닌 경우 (이월 로직 - 기존 로직 유지)
        else:
            # 3-1. 이전 영업일의 대기 중인 고객 조회
            pending_waitings = db.query(WaitingList).filter(
                WaitingList.store_id == current_store.id,
                WaitingList.business_date == last_business_date,
                WaitingList.status == 'waiting'
            ).order_by(WaitingList.waiting_number).all()

            # 3-2. 오늘 날짜로 이월
            current_max_waiting_number = 0
            
            # 오늘 이미 대기자가 있는지 확인 (드문 경우지만)
            today_waitings_count = db.query(WaitingList).filter(
                WaitingList.store_id == current_store.id,
                WaitingList.business_date == today
            ).count()
            
            start_waiting_number = today_waitings_count + 1

            for i, waiting in enumerate(pending_waitings):
                # 새로운 대기 레코드 생성 (이력 관리를 위해 복사본 생성 추천하지만, 여기서는 업데이트로 가정)
                # *중요*: 날짜 기반 파티셔닝이라면 업데이트, 아니라면 새 레코드.
                # 여기서는 WaitingList 모델이 business_date를 PK로 쓰지 않으므로 업데이트 가능.
                # 하지만 '이월'이라는 명시적 기록을 남기려면 어떻게 할지?
                # -> 일단 business_date 변경 및 waiting_number 재발급
                
                # 기존 레코드 정보
                old_waiting_number = waiting.waiting_number
                
                # 정보 업데이트
                waiting.business_date = today
                waiting.waiting_number = start_waiting_number + i
                waiting.registered_at = datetime.now() # 재등록 시간? 아니면 유지? -> 이월됨을 알리기 위해 유지 또는 별도 표시 필요하지만, 일단 날짜 변경.
                
                # (선택사항) 이월 로그 남기기 또는 비고란 추가
        
        db.commit() # 이월 처리 확정
    # --- Carry Over Logic End ---

    # 새로운 영업일 생성
    new_business = DailyClosing(
        store_id=current_store.id,
        business_date=today,
        opening_time=datetime.now(),
        is_closed=False
    )
    db.add(new_business)
    db.commit()
    db.refresh(new_business)

    return new_business

@router.post("/close", response_model=DailyClosingSchema)
async def close_business(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    일마감
    - 현재 영업일 마감
    - 통계 계산 및 저장
    - 대기 중인 고객 자동 처리 (설정에 따라)
    """
    today = get_current_business_date(db, current_store.id)

    # 현재 영업일 조회 (매장별)
    business = db.query(DailyClosing).filter(
        DailyClosing.store_id == current_store.id,
        DailyClosing.business_date == today,
        DailyClosing.is_closed == False
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="개점된 영업일이 없습니다.")

    # 매장 설정 조회 (Safe)
    settings_closing = db.query(
        StoreSettings.auto_closing,
        StoreSettings.closing_action
    ).filter(StoreSettings.store_id == current_store.id).first()
    
    # 마감 시 대기 중인 고객 자동 처리
    if settings_closing and settings_closing.auto_closing:
        pending_waitings = db.query(WaitingList).filter(
            WaitingList.store_id == current_store.id,
            WaitingList.business_date == today,
            WaitingList.status == 'waiting'
        ).all()
        
        print(f"[CLOSING] Processing {len(pending_waitings)} waiting users for store {current_store.id}")
        
        for waiting in pending_waitings:
            if settings_closing.closing_action == 'attended':
                # 출석 처리
                waiting.status = 'attended'
                waiting.attended_at = datetime.now()
                print(f"[CLOSING] Marked waiting #{waiting.waiting_number} as attended")
            else:
                # 취소 처리
                waiting.status = 'cancelled'
                waiting.cancelled_at = datetime.now()
                print(f"[CLOSING] Marked waiting #{waiting.waiting_number} as cancelled")

    # 통계 계산 (매장별) - 처리 후 다시 계산
    total_waiting = db.query(func.count(WaitingList.id)).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.business_date == today
    ).scalar()

    total_attended = db.query(func.count(WaitingList.id)).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.business_date == today,
        WaitingList.status == "attended"
    ).scalar()

    total_cancelled = db.query(func.count(WaitingList.id)).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.business_date == today,
        WaitingList.status.in_(["cancelled", "no_show"])
    ).scalar()

    # 마감 처리
    business.closing_time = datetime.now()
    business.is_closed = True
    business.total_waiting = total_waiting
    business.total_attended = total_attended
    business.total_cancelled = total_cancelled

    db.commit()
    db.refresh(business)

    return business

@router.get("/current", response_model=DailyClosingSchema)
async def get_current_business(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """현재 영업일 조회"""
    today = get_current_business_date(db, current_store.id)

    business = db.query(DailyClosing).filter(
        DailyClosing.store_id == current_store.id,
        DailyClosing.business_date == today
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="영업일 정보가 없습니다. 개점을 진행해주세요.")

    return business

@router.get("/history", response_model=List[DailyClosingSchema])
async def get_business_history(
    limit: int = 30,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """영업일 이력 조회"""
    history = db.query(DailyClosing).filter(
        DailyClosing.store_id == current_store.id
    ).order_by(
        DailyClosing.business_date.desc()
    ).limit(limit).all()

    return history

@router.get("/statistics/{business_date}", response_model=DailyStatistics)
async def get_daily_statistics(
    business_date: date,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """특정 날짜 통계 조회"""
    business = db.query(DailyClosing).filter(
        DailyClosing.store_id == current_store.id,
        DailyClosing.business_date == business_date
    ).first()

    if not business:
        raise HTTPException(status_code=404, detail="해당 날짜의 영업 정보가 없습니다.")

    # 노쇼 수 계산 (매장별)
    total_no_show = db.query(func.count(WaitingList.id)).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.business_date == business_date,
        WaitingList.status == "no_show"
    ).scalar()

    # 출석률 계산
    attendance_rate = (business.total_attended / business.total_waiting * 100) if business.total_waiting > 0 else 0

    # 클래스별 통계 (매장별)
    class_stats = []
    classes = db.query(ClassInfo).filter(
        ClassInfo.store_id == current_store.id,
        ClassInfo.is_active == True
    ).all()

    for cls in classes:
        cls_total = db.query(func.count(WaitingList.id)).filter(
            WaitingList.store_id == current_store.id,
            WaitingList.business_date == business_date,
            WaitingList.class_id == cls.id
        ).scalar()

        cls_attended = db.query(func.count(WaitingList.id)).filter(
            WaitingList.store_id == current_store.id,
            WaitingList.business_date == business_date,
            WaitingList.class_id == cls.id,
            WaitingList.status == "attended"
        ).scalar()

        class_stats.append({
            "class_name": cls.class_name,
            "total": cls_total,
            "attended": cls_attended,
            "attendance_rate": (cls_attended / cls_total * 100) if cls_total > 0 else 0
        })

    return DailyStatistics(
        business_date=business_date,
        total_waiting=business.total_waiting,
        total_attended=business.total_attended,
        total_cancelled=business.total_cancelled,
        total_no_show=total_no_show,
        attendance_rate=round(attendance_rate, 2),
        class_statistics=class_stats
    )

@router.get("/check-status")
async def check_business_status(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    영업 상태 확인
    - 개점 여부 체크
    - 자동 개점 필요 여부 반환
    """
    today = get_current_business_date(db, current_store.id)

    business = db.query(DailyClosing).filter(
        DailyClosing.store_id == current_store.id,
        DailyClosing.business_date == today
    ).first()

    if not business:
        return {
            "is_open": False,
            "need_open": True,
            "message": "영업을 시작해주세요."
        }

    if business.is_closed:
        return {
            "is_open": False,
            "need_open": True,
            "message": "마감된 영업일입니다. 새로운 날짜로 개점해주세요."
        }

    return {
        "is_open": True,
        "need_open": False,
        "business_date": business.business_date,
        "opening_time": business.opening_time
    }
