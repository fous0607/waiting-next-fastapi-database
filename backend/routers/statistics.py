from fastapi import APIRouter, Depends, HTTPException, Query, Request
from starlette.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case, and_, or_, text
from datetime import datetime, date, timedelta
from typing import List, Optional

from database import get_db
from models import Franchise, Store, Member, WaitingList, DailyClosing, User
from auth import require_franchise_admin, get_current_store
from sse_manager import sse_manager, event_generator
import schemas
import models

router = APIRouter()

# Helper function for permission check
def check_franchise_permission(current_user: User, franchise_id: int, store_id: Optional[int] = None) -> Optional[List[int]]:
    """
    권한 체크 및 접근 가능한 매장 ID 목록 반환
    - system_admin: None 반환 (모든 매장 접근 가능)
    - franchise_admin: None 반환 (해당 프랜차이즈 내 모든 매장 접근 가능)
    - franchise_manager: 관리 매장 ID 목록 반환 (store_id가 있으면 검증 포함)
    """
    if current_user.role == "system_admin":
        return None

    if current_user.role == "franchise_admin":
        # Note: franchise_id is int, current_user.franchise_id is int
        if int(current_user.franchise_id) != int(franchise_id):
            raise HTTPException(status_code=403, detail="권한이 없습니다.")
        return None

    if current_user.role == "franchise_manager":
        if int(current_user.franchise_id) != int(franchise_id):
             raise HTTPException(status_code=403, detail="권한이 없습니다.")

        managed_ids = [s.id for s in current_user.managed_stores]
        
        if store_id:
            if store_id not in managed_ids:
                raise HTTPException(status_code=403, detail="해당 매장에 대한 접근 권한이 없습니다.")
            return [store_id]
        
        return managed_ids if managed_ids else []

    raise HTTPException(status_code=403, detail="권한이 없습니다.")

# Duplicate endpoints removed:
# 1. SSE Stream -> Handled in routers/sse.py (or needs to be) and routers/franchise.py
# 2. Dashboard Stats -> Handled in routers/franchise.py (get_franchise_dashboard_stats)

# NOTE: The frontend calls /api/franchise/stats/{id}/dashboard. 
# routers/franchise.py is mounted at /api/franchise, and defines /stats/{id}/dashboard.
# So it handles the request correctly.
# The previous version here in statistics.py (mounted at /api/franchise/stats) would have clashed or been shadowed.
# Removing it clarifies that logic resides in franchise.py.


@router.get("/{franchise_id}/attendance/list")
async def get_attendance_list(
    franchise_id: int,
    start_date: date,
    end_date: date,
    store_id: Optional[int] = None,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """
    출석 목록 상세 조회 (전체 매장 또는 특정 매장)
    - 기간 내 출석 완료된 목록
    """
    allowed_store_ids = check_franchise_permission(current_user, franchise_id, store_id)
    
    # 기본 쿼리: WaitingList와 Store, Member 조인
    query = db.query(
        WaitingList.id,
        WaitingList.phone,
        WaitingList.attended_at,
        WaitingList.status,
        Store.name.label("store_name"),
        Member.name.label("member_name"),
        Member.id.label("member_id")
    ).join(
        Store, WaitingList.store_id == Store.id
    ).outerjoin(
        Member, WaitingList.member_id == Member.id
    ).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True,
        WaitingList.status == 'attended',
        WaitingList.attended_at >= datetime.combine(start_date, datetime.min.time()),
        WaitingList.attended_at <= datetime.combine(end_date, datetime.max.time())
    )
    
    if store_id:
        query = query.filter(WaitingList.store_id == store_id)
    
    if allowed_store_ids is not None:
        query = query.filter(Store.id.in_(allowed_store_ids))
        
    results = query.order_by(
        desc(WaitingList.attended_at)
    ).all()
    
    return [
        {
            "id": r.id,
            "phone": r.phone,
            "attended_at": r.attended_at,
            "status": r.status,
            "store_name": r.store_name,
            "member_name": r.member_name or "비회원",
            "member_id": r.member_id
        }
        for r in results
    ]

@router.get("/{franchise_id}/attendance/ranking")
async def get_attendance_ranking(
    franchise_id: int,
    start_date: date,
    end_date: date,
    store_id: Optional[int] = None,
    limit: int = 10,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """
    회원 출석 순위 조회
    - 기간별, 매장별(옵션) 출석이 많은 순으로 조회
    """
    allowed_store_ids = check_franchise_permission(current_user, franchise_id, store_id)

    # 기본 쿼리: WaitingList와 Member, Store 조인
    query = db.query(
        Member.id,
        Member.name,
        Member.phone,
        Store.name.label("store_name"),
        func.count(WaitingList.id).label("attendance_count"),
        func.max(WaitingList.attended_at).label("last_attended_at")
    ).join(
        WaitingList, Member.id == WaitingList.member_id
    ).join(
        Store, WaitingList.store_id == Store.id
    ).filter(
        WaitingList.status == "attended",
        WaitingList.attended_at >= datetime.combine(start_date, datetime.min.time()),
        WaitingList.attended_at <= datetime.combine(end_date, datetime.max.time())
    )

    # 매장 필터링
    if store_id:
        query = query.filter(WaitingList.store_id == store_id)
    else:
        # 프랜차이즈 내 모든 매장 (또는 허용된 매장)
        if allowed_store_ids is not None:
            query = query.filter(WaitingList.store_id.in_(allowed_store_ids))
        else:
            store_ids = db.query(Store.id).filter(Store.franchise_id == franchise_id).all()
            store_ids = [s[0] for s in store_ids]
            query = query.filter(WaitingList.store_id.in_(store_ids))

    # 그룹화 및 정렬
    results = query.group_by(
        Member.id, Member.name, Member.phone, Store.name
    ).order_by(
        desc("attendance_count")
    ).limit(limit).all()

    return [
        {
            "member_id": r.id,
            "name": r.name,
            "phone": r.phone,
            "store_name": r.store_name,
            "attendance_count": r.attendance_count,
            "last_attended_at": r.last_attended_at
        }
        for r in results
    ]

@router.get("/{franchise_id}/attendance/trends")
async def get_attendance_trends(
    franchise_id: int,
    start_date: date,
    end_date: date,
    period: str = Query("day", enum=["day", "month", "week"]),
    store_id: Optional[int] = None,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """
    출석 추세 조회 (일별/주별/월별)
    """
    # 권한 체크: system_admin은 모든 프랜차이즈 접근 가능, franchise_admin은 자신의 프랜차이즈만
    if current_user.role == "franchise_admin" and current_user.franchise_id != franchise_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    # 날짜 포맷 설정 (SQLite 기준)
    if period == "month":
        date_format = "%Y-%m"
    elif period == "week":
        date_format = "%Y-%W"
    else:
        date_format = "%Y-%m-%d"

    # 날짜 포맷팅: DB 종속성을 피하기 위해 Python에서 처리하거나
    # dialect에 따라 분기 처리를 해야 함.
    # Postgres uses to_char, SQLite uses strftime.
    # Here we can simplify: group by the date object and format in python,
    # or use extract/trunc which is more standard.
    
    # Using generic dispatch or simple check
    is_sqlite = 'sqlite' in str(db.get_bind().url)
    
    if is_sqlite:
        period_col = func.strftime(date_format, WaitingList.attended_at).label("period")
    else:
        # Postgres: to_char(timestamp, format)
        # format mapping:
        pg_format = 'YYYY-MM-DD'
        if period == 'month': pg_format = 'YYYY-MM'
        elif period == 'week': pg_format = 'IYYY-IW' # ISO Week
        
        period_col = func.to_char(WaitingList.attended_at, pg_format).label("period")

    query = db.query(
        period_col,
        func.count(WaitingList.id).label("count")
    ).filter(
        WaitingList.status == "attended",
        WaitingList.attended_at >= datetime.combine(start_date, datetime.min.time()),
        WaitingList.attended_at <= datetime.combine(end_date, datetime.max.time())
    )


    # 매장 필터링
    if store_id:
        query = query.filter(WaitingList.store_id == store_id)
    else:
        store_ids = db.query(Store.id).filter(Store.franchise_id == franchise_id).all()
        store_ids = [s[0] for s in store_ids]
        query = query.filter(WaitingList.store_id.in_(store_ids))

    # 그룹화 및 정렬
    results = query.group_by("period").order_by("period").all()

    return [
        {
            "period": r.period,
            "count": r.count
        }
        for r in results
    ]

@router.get("/{franchise_id}/members/{member_id}/history")
async def get_member_history(
    franchise_id: int,
    member_id: int,
    start_date: date,
    end_date: date,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """
    특정 회원의 출석 이력 조회
    """
    # 권한 체크: system_admin은 모든 프랜차이즈 접근 가능, franchise_admin은 자신의 프랜차이즈만
    if current_user.role == "franchise_admin" and current_user.franchise_id != franchise_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")

    # 회원 존재 확인 및 프랜차이즈 소속 확인 (간소화: 멤버 ID로 조회)
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    # 출석 이력 조회
    history = db.query(
        WaitingList.attended_at,
        Store.name.label("store_name"),
        WaitingList.status
    ).join(
        Store, WaitingList.store_id == Store.id
    ).filter(
        WaitingList.member_id == member_id,
        WaitingList.status == "attended",
        WaitingList.attended_at >= datetime.combine(start_date, datetime.min.time()),
        WaitingList.attended_at <= datetime.combine(end_date, datetime.max.time())
    ).order_by(
        desc(WaitingList.attended_at)
    ).all()

    return [
        {
            "attended_at": r.attended_at,
            "store_name": r.store_name,
            "status": r.status
        }
        for r in history
    ]

@router.get("/{franchise_id}/store_comparison")
async def get_store_comparison(
    franchise_id: int,
    start_date: date,
    end_date: date,
    store_id: Optional[int] = None,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """
    매장별 출석 비교 조회
    """
    allowed_store_ids = check_franchise_permission(current_user, franchise_id, store_id)

    # 프랜차이즈 정보 조회 (이름 제거용)
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()
    franchise_name = franchise.name if franchise else ""

    # LEFT JOIN을 사용하여 출석 기록이 없는 매장도 포함
    # business_date 기준으로 기간 필터링
    query = db.query(
        Store.id,
        Store.name,
        func.count(WaitingList.id).label("waiting_count"),
        func.count(
            case(
                (WaitingList.status == "attended", WaitingList.id),
                else_=None
            )
        ).label("attendance_count")
    ).outerjoin(
        WaitingList,
        (Store.id == WaitingList.store_id) &
        (WaitingList.business_date >= start_date) &
        (WaitingList.business_date <= end_date)
    ).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True
    )
    
    # 특정 매장 필터링
    if store_id:
        query = query.filter(Store.id == store_id)
        
    if allowed_store_ids is not None:
        query = query.filter(Store.id.in_(allowed_store_ids))
    
    results = query.group_by(
        Store.id, Store.name
    ).order_by(
        Store.name
    ).all()

    return [
        {
            "store_id": r.id,
            "store_name": r.name,
            "waiting_count": r.waiting_count,
            "attendance_count": r.attendance_count
        }
        for r in results
    ]

@router.get("/{franchise_id}/waiting/list")
async def get_waiting_list_details(
    franchise_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    store_id: Optional[int] = None,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """
    대기 목록 상세 조회 (전체 매장 또는 특정 매장)
    - start_date, end_date가 없으면 오늘 날짜 기준
    - 있으면 해당 기간의 대기 목록 조회
    """
    allowed_store_ids = check_franchise_permission(current_user, franchise_id, store_id)
    
    # 날짜 기본값 설정
    today = date.today()
    if not start_date:
        start_date = today
    if not end_date:
        end_date = today
    
    query = db.query(
        WaitingList.id,
        WaitingList.waiting_number,
        WaitingList.phone,
        WaitingList.created_at,
        WaitingList.business_date,
        WaitingList.status,
        Store.name.label("store_name"),
        Member.name.label("member_name"),
        Member.id.label("member_id"),
        Member.created_at.label("member_created_at")
    ).join(
        Store, WaitingList.store_id == Store.id
    ).outerjoin( # 비회원 대기도 있을 수 있으므로 outerjoin
        Member, WaitingList.member_id == Member.id
    ).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True,
        WaitingList.business_date >= start_date,
        WaitingList.business_date <= end_date
    )
    
    if store_id:
        query = query.filter(WaitingList.store_id == store_id)
        
    if allowed_store_ids is not None:
        query = query.filter(Store.id.in_(allowed_store_ids))

    results = query.order_by(
        WaitingList.created_at
    ).all()
    
    return [
        {
            "id": r.id,
            "waiting_number": r.waiting_number,
            "phone": r.phone,
            "party_size": 1,  # DB에 컬럼이 없어서 기본값 1로 고정
            "created_at": r.created_at,
            "business_date": r.business_date,
            "status": r.status,
            "store_name": r.store_name,
            "member_name": r.member_name or "비회원",
            "member_id": r.member_id,
            "member_created_at": r.member_created_at
        }
        for r in results
    ]

@router.get("/{franchise_id}/members/new")
async def get_new_members(
    franchise_id: int,
    start_date: date,
    end_date: date,
    store_id: Optional[int] = None,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """
    신규 회원 목록 조회
    """
    allowed_store_ids = check_franchise_permission(current_user, franchise_id, store_id)

    # 프랜차이즈 내 모든 매장 ID 조회
    store_ids_query = db.query(Store.id).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True
    )
    
    if store_id:
        store_ids_query = store_ids_query.filter(Store.id == store_id)
    
    if allowed_store_ids is not None:
        store_ids_query = store_ids_query.filter(Store.id.in_(allowed_store_ids))
        
    store_ids = [s[0] for s in store_ids_query.all()]
    
    if not store_ids:
        return []

    # 신규 회원 조회
    query = db.query(
        Member.id,
        Member.name,
        Member.phone,
        Member.created_at,
        Store.name.label("store_name")
    ).join(
        Store, Member.store_id == Store.id
    ).filter(
        Member.store_id.in_(store_ids),
        Member.created_at >= datetime.combine(start_date, datetime.min.time()),
        Member.created_at <= datetime.combine(end_date, datetime.max.time())
    ).order_by(
        desc(Member.created_at)
    )
    
    results = query.all()
    
    return [
        {
            "id": r.id,
            "name": r.name,
            "phone": r.phone,
            "created_at": r.created_at,
            "store_name": r.store_name
        }
        for r in results
    ]

@router.get("/{franchise_id}/members/search")
async def search_members(
    franchise_id: int,
    query: str,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """
    회원 검색 (프랜차이즈 전체)
    """
    # This also needs checking, though store_id param is not present.
    # Helper without store_id returns all allowed stores.
    allowed_store_ids = check_franchise_permission(current_user, franchise_id)
    # If None, query all in franchise. If List, query only those.

    if not query or len(query) < 2:
        return [] # 검색어 너무 짧으면 빈 배열

    # 프랜차이즈 내 모든 매장 ID 조회
    store_ids_query = db.query(Store.id).filter(
        Store.franchise_id == franchise_id
    )
    
    if allowed_store_ids is not None:
        store_ids_query = store_ids_query.filter(Store.id.in_(allowed_store_ids))

    store_ids = [s[0] for s in store_ids_query.all()]
    
    if not store_ids:
        return []
        
    # 검색
    results = db.query(
        Member.id,
        Member.name,
        Member.phone,
        Member.created_at,
        Store.name.label("store_name")
    ).join(
        Store, Member.store_id == Store.id
    ).filter(
        Member.store_id.in_(store_ids),
        or_(
            Member.name.contains(query),
            Member.phone.endswith(query)
        )
    ).limit(20).all()
    
    return [
        {
            "id": r.id,
            "name": r.name,
            "phone": r.phone,
            "created_at": r.created_at,
            "store_name": r.store_name
        }
        for r in results
    ]
@router.get("/{franchise_id}/sse/stream")
async def franchise_sse_stream(
    franchise_id: int,
    request: Request,
    current_user: User = Depends(require_franchise_admin)
):
    """
    프랜차이즈 SSE 스트림 엔드포인트
    """
    # 권한 체크
    if current_user.franchise_id != franchise_id:
         raise HTTPException(status_code=403, detail="권한이 없습니다.")
         
    print(f"[SSE] Franchise Connection Request: franchise_id={franchise_id}")
    queue = await sse_manager.connect_franchise(str(franchise_id))
    
    async def cleanup():
        sse_manager.disconnect_franchise(str(franchise_id), queue)
        
    return StreamingResponse(
        event_generator(queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
        background=cleanup
    )
@router.get("/store-dashboard", response_model=schemas.AnalyticsDashboard)
async def get_store_analytics_dashboard(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    period: str = Query("hourly", enum=["hourly", "daily", "weekly", "monthly"]),
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    매장용 분석 대시보드 데이터 조회
    - period: hourly(기본), daily, weekly, monthly
    """
    today = date.today()
    if not start_date:
        if period == 'daily':
            # "This Week" (Monday to Sunday)
            start_date = today - timedelta(days=today.weekday())
        else:
            start_date = today
            
    if not end_date:
        end_date = today

    store_id = current_store.id

    # 1. Open Status Check (Today)
    open_op = db.query(DailyClosing).filter(
        DailyClosing.store_id == store_id,
        DailyClosing.business_date == today,
        DailyClosing.is_closed == False
    ).first()
    
    # 2. Waiting & Attendance Data (Period)
    # 전체 기간 데이터 조회 (KPI 계산용)
    waitings_query = db.query(WaitingList).filter(
        WaitingList.store_id == store_id,
        WaitingList.business_date >= start_date,
        WaitingList.business_date <= end_date
    )
    waitings = waitings_query.all()

    # Calculate Stats
    total_waiting_cnt = len(waitings)
    attended_waitings = [w for w in waitings if w.status == 'attended']
    total_attendance_cnt = len(attended_waitings)

    # Time Stats (Waiting)
    wait_times = []
    for w in attended_waitings:
        if w.attended_at and w.created_at:
            mins = (w.attended_at - w.created_at).total_seconds() / 60
            wait_times.append(mins)
            
    w_stats = schemas.TimeStats()
    if wait_times:
        w_stats.max = int(max(wait_times))
        w_stats.min = int(min(wait_times))
        w_stats.avg = round(sum(wait_times) / len(wait_times), 1)

    a_stats = schemas.TimeStats() 

    # 3. Trends (Dynamic Aggregation)
    is_sqlite = 'sqlite' in str(db.get_bind().url)
    
    # Label formatting helper
    if period == "hourly":
        # Existing logic for hourly (0-23)
        hourly_map = {h: {'waiting': 0, 'attendance': 0} for h in range(24)}
        for w in waitings:
            # KST Adjustment (+9 hours)
            # Use registered_at instead of created_at for better consistency
            if w.registered_at and hasattr(w.registered_at, 'hour'): 
                try:
                    h = (w.registered_at + timedelta(hours=9)).hour
                    if 0 <= h < 24:
                        hourly_map[h]['waiting'] += 1
                except (Exception):
                    pass
            
            if w.attended_at and hasattr(w.attended_at, 'hour'):
                try:
                    ah = (w.attended_at + timedelta(hours=9)).hour
                    if 0 <= ah < 24:
                        hourly_map[ah]['attendance'] += 1
                except (Exception):
                    pass
                
        # Determine Start Hour
        # Priority 1: Actual Opening Time for TODAY (if available) to match user expectation ("I opened at 9")
        # Priority 2: Configured Business Day Start (default 5)
        
        from models import DailyClosing
        from utils import get_today_date
        
        start_hour = 0
        business_start_setting = 5
        
        if current_store.store_settings and len(current_store.store_settings) > 0:
            business_start_setting = current_store.store_settings[0].business_day_start
            start_hour = business_start_setting

        # Check if we should use actual opening time for today's chart
        # Only if period='hourly' (implied by this block) and viewing 'today' (start_date is today)
        # Getting today's date in KST/System
        today_date = get_today_date(business_start_setting) 
        
        # We can loosely check if start_date matches today_date
        # start_date is passed as argument.
        if start_date == today_date:
            daily_closing = db.query(DailyClosing).filter(
                DailyClosing.store_id == store_id,
                DailyClosing.business_date == today_date,
                DailyClosing.is_closed == False
            ).first()
            
            if daily_closing and daily_closing.opening_time:
                # Use actual opening hour
                # opening_time is DateTime. Inspect if we need KST adjustment? 
                # opening_time is likely KST if saved via datetime.now() on local server, 
                # or UTC if server is UTC.
                # Assuming opening_time is localized or we take the hour directly if system is consistent.
                # If we assume consistent system time usage:
                h_open = daily_closing.opening_time.hour
                # If opening_time is UTC and we need KST:
                # Check is_sqlite logic for consistency.
                if is_sqlite:
                     # If registered_at needs +9, then opening_time likely needs +9 if stored as UTC.
                     # However, daily_closing.opening_time might be saved as naive local time by `waiting.py`.
                     # Let's assume it's naive local (KST) based on usual pattern for this codebase.
                     pass 
                
                # If the opening time is reasonably close to business_start (e.g. same day), use it.
                # If user opened at 9 AM, use 9.
                start_hour = h_open

        # Reorder hours based on start_hour
        trends_list = []
        for i in range(24):
            h = (start_hour + i) % 24
            v = hourly_map[h]
            trends_list.append(
                schemas.HourlyStat(
                    hour=h, 
                    label=f"{h}시",
                    waiting_count=v['waiting'], 
                    attendance_count=v['attendance']
                )
            )
        
    else:
        # DB Grouping for Daily/Weekly/Monthly -> Use business_date for consistency
        if is_sqlite:
            date_fmt = "%Y-%m-%d"
            if period == "daily":
                date_fmt = "%m-%d" # Frontend expects MM-DD for daily chart
            elif period == "weekly":
                date_fmt = "%Y-%W"
            elif period == "monthly":
                date_fmt = "%Y-%m"
            
            # Use business_date for BOTH waiting and attendance counts to avoid mismatches
            period_col = func.strftime(date_fmt, WaitingList.business_date).label("period")
            period_col_attend = func.strftime(date_fmt, WaitingList.business_date).label("period")
        else:
            # Postgres
            fmt = 'YYYY-MM-DD'
            if period == 'daily': fmt = 'MM-DD'
            elif period == 'weekly': fmt = 'YYYY-IW'
            elif period == 'monthly': fmt = 'YYYY-MM'
            
            # Use business_date for consistency
            period_col = func.to_char(WaitingList.business_date, fmt).label("period")
            period_col_attend = func.to_char(WaitingList.business_date, fmt).label("period")

        # 1. Waiting Counts
        w_groups = db.query(period_col, func.count(WaitingList.id)).filter(
            WaitingList.store_id == store_id,
            WaitingList.business_date >= start_date,
            WaitingList.business_date <= end_date
        ).group_by(period_col).all()
        w_map = {str(r[0]): r[1] for r in w_groups if r[0] is not None}

        # 2. Attendance Counts
        a_groups = db.query(period_col_attend, func.count(WaitingList.id)).filter(
            WaitingList.store_id == store_id,
            WaitingList.status == 'attended',
            WaitingList.business_date >= start_date,
            WaitingList.business_date <= end_date 
        ).group_by(period_col_attend).all()
        a_map = {str(r[0]): r[1] for r in a_groups if r[0] is not None}

        # Merge keys
        all_keys = sorted(set(w_map.keys()) | set(a_map.keys()))
        
        trends_list = [
            schemas.HourlyStat(
                label=k,
                waiting_count=w_map.get(k, 0),
                attendance_count=a_map.get(k, 0)
            )
            for k in all_keys
        ]

    # 4. Store Stats
    current_waiting_cnt = db.query(func.count(WaitingList.id)).filter(
        WaitingList.store_id == store_id,
        WaitingList.status == 'waiting',
        WaitingList.business_date == today
    ).scalar() or 0

    store_stats_list = [
        schemas.StoreOperationStat(
            store_name=current_store.name,
            is_open=open_op is not None,
            open_time=open_op.created_at.strftime("%H:%M") if open_op and open_op.created_at else None,
            close_time=None,
            current_waiting=current_waiting_cnt,
            total_waiting=total_waiting_cnt,
            total_attendance=total_attendance_cnt
        )
    ]
    
    # 신규 회원 수 계산
    new_members_cnt = db.query(Member).filter(
        Member.store_id == store_id,
        Member.created_at >= datetime.combine(start_date, datetime.min.time()),
        Member.created_at <= datetime.combine(end_date, datetime.max.time())
    ).count()

    # 재방문율 가계산 (기간 방문자 중 신규 제외)
    unique_visiting_members = len(set(w.member_id for w in waitings if w.member_id))
    visited_returning = unique_visiting_members - new_members_cnt
    if visited_returning < 0: visited_returning = 0
    retention_rate = (visited_returning / unique_visiting_members * 100) if unique_visiting_members > 0 else 0.0

    # 매출 가계산 (출석 인원 * 평균 객단가 15,000원 가정)
    total_revenue = total_attendance_cnt * 15000

    # Construct response
    return schemas.AnalyticsDashboard(
        total_stores=1,
        open_stores=1 if open_op else 0,
        total_waiting=total_waiting_cnt,
        total_attendance=total_attendance_cnt,
        waiting_time_stats=w_stats,
        attendance_time_stats=a_stats,
        hourly_stats=trends_list,
        store_stats=store_stats_list,
        new_members=new_members_cnt,
        total_revenue=total_revenue,
        total_visitors=total_waiting_cnt,
        retention_rate=round(retention_rate, 1),
        top_churn_members=[] 
    )


@router.get("/member-history/{member_id}")
async def get_member_visit_history(
    member_id: int,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    회원 상세 방문 히스토리 조회 (매장용)
    """
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    # 해당 매장에서의 방문 기록만 조회
    history = db.query(WaitingList).filter(
        WaitingList.member_id == member_id,
        WaitingList.store_id == current_store.id
    ).order_by(desc(WaitingList.business_date), desc(WaitingList.registered_at)).all()

    # 통계 계산
    total_visits = len(history)
    attended_visits = [h for h in history if h.status == 'attended']
    last_visit = history[0].business_date if history else None

    # response mapping
    history_list = []
    for h in history:
        # Get class name safely
        class_info = db.query(models.ClassInfo).filter(models.ClassInfo.id == h.class_id).first()
        history_list.append({
            "id": h.id,
            "business_date": h.business_date.strftime("%Y.%m.%d"),
            "registered_at": h.registered_at.isoformat(),
            "attended_at": h.attended_at.isoformat() if h.attended_at else None,
            "status": h.status,
            "class_name": class_info.class_name if class_info else f"{h.class_order}교시"
        })

    return {
        "member": {
            "id": member.id,
            "name": member.name,
            "phone": member.phone
        },
        "total_visits": total_visits,
        "total_attended": len(attended_visits),
        "last_visit": last_visit.isoformat() if last_visit else None,
        "history": history_list
    }


@router.get("/new-members")
async def get_store_new_members(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """지정 기간 내 가입한 신규 회원 리스트 조회"""
    query = db.query(Member).filter(Member.store_id == current_store.id)
    
    if start_date:
        query = query.filter(Member.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Member.created_at <= datetime.combine(end_date, datetime.max.time()))
        
    new_members = query.order_by(desc(Member.created_at)).all()
    
    return [
        {
            "id": m.id,
            "name": m.name,
            "phone": m.phone,
            "created_at": m.created_at.strftime("%Y.%m.%d %H:%M"),
            "store_name": current_store.name
        } for m in new_members
    ]


@router.get("/attendance-ranking")
async def get_attendance_ranking(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(50, ge=1),
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """지정 기간 내 출석 횟수 순위 조회"""
    query = db.query(
        Member.id,
        Member.name,
        Member.phone,
        func.count(WaitingList.id).label("visit_count")
    ).join(WaitingList, Member.id == WaitingList.member_id)\
    .filter(
        WaitingList.store_id == current_store.id,
        WaitingList.status == 'attended'
    )
    
    if start_date:
        query = query.filter(WaitingList.business_date >= start_date)
    if end_date:
        query = query.filter(WaitingList.business_date <= end_date)
        
    ranking = query.group_by(Member.id)\
        .order_by(desc("visit_count"))\
        .limit(limit).all()
        
    return [
        {
            "id": r.id,
            "name": r.name,
            "phone": r.phone,
            "visit_count": r.visit_count
        } for r in ranking
    ]


@router.get("/inactive-members")
async def get_inactive_members(
    days: int = Query(30, ge=1),
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """장기 미방문자 조회 (마케팅 활용)"""
    threshold_date = date.today() - timedelta(days=days)
    
    # 1. 매장 방문 회원 목록
    visited_member_ids = db.query(WaitingList.member_id)\
        .filter(WaitingList.store_id == current_store.id)\
        .distinct().all()
    visited_member_ids = [m[0] for m in visited_member_ids if m[0]]
    
    # 2. 최근 방문 회원 목록 (threshold 이후)
    recent_member_ids = db.query(WaitingList.member_id)\
        .filter(
            WaitingList.store_id == current_store.id,
            WaitingList.business_date >= threshold_date
        ).distinct().all()
    recent_member_ids = [m[0] for m in recent_member_ids if m[0]]
    
    # 3. 비활성 회원 = (1) - (2)
    inactive_ids = list(set(visited_member_ids) - set(recent_member_ids))
    
    if not inactive_ids:
        return []
        
    inactive_members = db.query(Member).filter(Member.id.in_(inactive_ids)).all()
    
    result = []
    for m in inactive_members:
        last_visit = db.query(func.max(WaitingList.business_date))\
            .filter(WaitingList.member_id == m.id, WaitingList.store_id == current_store.id)\
            .scalar()
        
        result.append({
            "id": m.id,
            "name": m.name,
            "phone": m.phone,
            "last_visit": last_visit.strftime("%Y.%m.%d") if last_visit else None,
            "days_since": (date.today() - last_visit).days if last_visit else None
        })
        
    return sorted(result, key=lambda x: x['days_since'] if x['days_since'] else 0, reverse=True)


@router.get("/attendance-list")
async def get_attendance_list(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """지정 기간 내 전체 출석 목록 조회"""
    query = db.query(WaitingList).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.status == 'attended'
    )
    
    if start_date:
        query = query.filter(WaitingList.business_date >= start_date)
    if end_date:
        query = query.filter(WaitingList.business_date <= end_date)
        
    attendances = query.order_by(desc(WaitingList.business_date), desc(WaitingList.attended_at)).all()
    
    result = []
    for a in attendances:
        member = db.query(Member).filter(Member.id == a.member_id).first()
        class_info = db.query(models.ClassInfo).filter(models.ClassInfo.id == a.class_id).first()
        
        result.append({
            "id": a.id,
            "business_date": a.business_date.strftime("%Y.%m.%d"),
            "member_name": member.name if member else a.name,
            "phone": member.phone if member else a.phone,
            "class_name": class_info.class_name if class_info else f"{a.class_order}교시",
            "attended_at": a.attended_at.strftime("%H:%M") if a.attended_at else None
        })
        
    return result
