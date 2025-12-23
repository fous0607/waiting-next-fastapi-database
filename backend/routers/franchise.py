"""
프랜차이즈 관리 라우터
- 프랜차이즈 정보 조회
- 프랜차이즈 수정
- 프랜차이즈 전체 통계
"""

from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date

from database import get_db
from models import Franchise, Store, User, WaitingList, DailyClosing, Member
from schemas import Franchise as FranchiseSchema, FranchiseUpdate
from auth import get_current_user, require_franchise_admin

router = APIRouter()


@router.get("/", response_model=FranchiseSchema)
async def get_franchise(
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 정보 조회

    Returns:
        Franchise: 프랜차이즈 정보
    """
    franchise = db.query(Franchise).filter(
        Franchise.id == current_user.franchise_id
    ).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    return franchise


@router.put("/{franchise_id}", response_model=FranchiseSchema)
async def update_franchise(
    franchise_id: int,
    franchise_update: FranchiseUpdate,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 정보 수정

    Args:
        franchise_id: 프랜차이즈 ID
        franchise_update: 수정할 프랜차이즈 정보

    Returns:
        Franchise: 수정된 프랜차이즈 정보
    """
    # 권한 체크: 자신의 프랜차이즈만 수정 가능
    if current_user.franchise_id != franchise_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="다른 프랜차이즈를 수정할 권한이 없습니다"
        )

    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    # 수정
    update_data = franchise_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(franchise, key, value)

    franchise.updated_at = datetime.now()

    db.commit()
    db.refresh(franchise)

    return franchise


@router.get("/stats")
async def get_franchise_stats(
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 전체 통계 조회

    Returns:
        dict: 프랜차이즈 전체 통계 정보
    """
    franchise_id = current_user.franchise_id
    today = date.today()

    # 매장 쿼리 준비
    store_query = db.query(Store).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True
    )

    # franchise_manager인 경우 관리 매장만 필터링
    managed_ids = []
    if current_user.role == 'franchise_manager':
        managed_ids = [s.id for s in current_user.managed_stores]
        if not managed_ids:
             # 관리 매장이 없는 경우 빈 결과 반환
            return {
                'franchise_id': franchise_id,
                'total_stores': 0,
                'active_stores': 0,
                'total_users': 1, # 자신 포함
                'total_members': 0,
                'today_stats': {
                    'total_waiting': 0,
                    'total_attended': 0,
                    'total_cancelled': 0
                },
                'current_waiting': 0,
                'stores': []
            }
        store_query = store_query.filter(Store.id.in_(managed_ids))
    
    stores = store_query.all()
    store_ids = [store.id for store in stores]

    # 매장 수 (필터링된 목록 기준)
    total_stores = len(stores) # 활성 매장만 조회했으므로
    active_stores = total_stores

    # 만약 비활성 매장도 포함해서 카운트해야 한다면 쿼리를 분리해야 함. 
    # 하지만 현재 로직 상 store_query가 is_active=True를 포함하고 있음.
    # 일반적으로 개요에는 활성 매장만 보여주는 것이 맞음.
    
    # [수정] 총 사용자 수 (권한 기반 필터링)
    user_query = db.query(func.count(User.id)).filter(User.franchise_id == franchise_id)
    if current_user.role == 'franchise_manager':
        from sqlalchemy import or_
        user_query = user_query.filter(
            or_(
                User.id == current_user.id,
                User.store_id.in_(managed_ids)
            )
        )
    total_users = user_query.scalar()

    # 오늘의 대기 통계 (모든 매장 합계)
    today_stats = db.query(
        func.coalesce(func.sum(DailyClosing.total_waiting), 0).label('total_waiting'),
        func.coalesce(func.sum(DailyClosing.total_attended), 0).label('total_attended'),
        func.coalesce(func.sum(DailyClosing.total_cancelled), 0).label('total_cancelled')
    ).filter(
        DailyClosing.store_id.in_(store_ids),
        DailyClosing.business_date == today
    ).first()

    # 현재 대기 중인 고객 수 (모든 매장 합계)
    current_waiting = db.query(func.count(WaitingList.id)).filter(
        WaitingList.store_id.in_(store_ids),
        WaitingList.status == 'waiting'
    ).scalar()



    # 총 회원 수 (모든 매장 합계)
    total_members = db.query(func.count(Member.id)).filter(
        Member.store_id.in_(store_ids)
    ).scalar() if store_ids else 0

    # 매장별 간단한 통계
    store_stats = []
    for store in stores:
        # 매장의 오늘 통계
        store_today = db.query(DailyClosing).filter(
            DailyClosing.store_id == store.id,
            DailyClosing.business_date == today
        ).first()

        # 매장의 현재 대기 수
        store_waiting = db.query(func.count(WaitingList.id)).filter(
            WaitingList.store_id == store.id,
            WaitingList.status == 'waiting'
        ).scalar()

        store_stats.append({
            'store_id': store.id,
            'store_name': store.name,
            'store_code': store.code,
            'current_waiting': store_waiting,
            'today_total': store_today.total_waiting if store_today else 0,
            'today_attended': store_today.total_attended if store_today else 0,
            'today_cancelled': store_today.total_cancelled if store_today else 0,
            'is_open': store_today.is_closed == False if store_today else False
        })

    return {
        'franchise_id': franchise_id,
        'total_stores': total_stores,
        'active_stores': active_stores,
        'total_users': total_users,
        'total_members': total_members,
        'today_stats': {
            'total_waiting': today_stats.total_waiting if today_stats else 0,
            'total_attended': today_stats.total_attended if today_stats else 0,
            'total_cancelled': today_stats.total_cancelled if today_stats else 0
        },
        'current_waiting': current_waiting,
        'stores': store_stats
    }

@router.get("/stats/{franchise_id}/dashboard")
async def get_franchise_dashboard_stats(
    franchise_id: int,
    start_date: date,
    end_date: date,
    store_id: Optional[int] = None,
    period: str = "hourly",
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 대시보드 통계 조회 (기간별)"""
    
    # 권한 체크 (시스템 관리자는 패스)
    is_system_admin = current_user.role == "system_admin"
    if not is_system_admin and current_user.franchise_id != franchise_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다"
        )

    # 1. 대상 매장 ID 목록 추출
    store_query = db.query(Store.id).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True
    )
    
    # franchise_manager: 관리 매장만
    if current_user.role == 'franchise_manager':
        managed_ids = [s.id for s in current_user.managed_stores]
        if not managed_ids:
            return StatsService._empty_dashboard_stats()
        store_query = store_query.filter(Store.id.in_(managed_ids))
    
    # 특정 매장 필터
    if store_id:
        store_query = store_query.filter(Store.id == store_id)
        
    target_store_ids = [s[0] for s in store_query.all()]
    
    if not target_store_ids:
        from services.stats_service import StatsService
        return StatsService._empty_dashboard_stats()

    # Use Service
    from services.stats_service import StatsService
    return StatsService.get_dashboard_stats(
        db, 
        franchise_id, 
        start_date, 
        end_date, 
        target_store_ids,
        period
    )

@router.get("/stats/dashboard")
async def get_my_franchise_dashboard_stats(
    start_date: date,
    end_date: date,
    store_id: Optional[int] = None,
    period: str = "hourly",
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """(Frontend Wrapper) Logged-in franchise admin dashboard stats"""
    if not current_user.franchise_id:
         raise HTTPException(status_code=400, detail="Franchise ID not found for user")
         
    return await get_franchise_dashboard_stats(
        franchise_id=current_user.franchise_id,
        start_date=start_date,
        end_date=end_date,
        store_id=store_id,
        period=period,
        current_user=current_user,
        db=db
    )

# ========== 프랜차이즈 공지사항 관리 ==========

@router.get("/notices", response_model=List[dict])
async def get_franchise_notices(
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 관리자가 볼 수 있는 공지사항 조회
    
    포함되는 공지:
    - target_type='franchise': 자신의 프랜차이즈 공지
    - target_type='program': 자신의 프랜차이즈 프로그램 공지
    """
    from models import Notice
    from sqlalchemy.orm import joinedload
    
    if not current_user.franchise_id:
        return []
    
    franchise_id = current_user.franchise_id
    
    # 프랜차이즈 공지 + 프로그램 공지
    notices = db.query(Notice).options(
        joinedload(Notice.author),
        joinedload(Notice.franchise)
    ).filter(
        Notice.franchise_id == franchise_id,
        Notice.target_type.in_(['franchise', 'program']),
        Notice.is_active == True
    ).order_by(Notice.created_at.desc()).all()
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "target_type": n.target_type,
            "is_active": n.is_active,
            "franchise_id": n.franchise_id,
            "franchise_name": n.franchise.name if n.franchise else None,
            "created_at": n.created_at.isoformat(),
            "author_name": n.author.username if n.author else "System"
        } for n in notices
    ]


@router.post("/notices", response_model=dict)
async def create_franchise_notice(
    notice_data: dict,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 관리자가 공지사항 생성
    
    프랜차이즈 관리자는 자신의 프랜차이즈에 대한 공지만 생성 가능
    """
    from models import Notice
    from fastapi import Body
    
    if not current_user.franchise_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="프랜차이즈 정보가 없습니다"
        )
    
    title = notice_data.get("title")
    content = notice_data.get("content")
    target_type = notice_data.get("target_type", "franchise")
    
    # 프랜차이즈 관리자는 franchise, program 타입만 생성 가능
    if target_type not in ['franchise', 'program']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="프랜차이즈 관리자는 프랜차이즈 공지 또는 프로그램 공지만 생성할 수 있습니다"
        )
    
    db_notice = Notice(
        title=title,
        content=content,
        target_type=target_type,
        is_active=True,
        author_id=current_user.id,
        franchise_id=current_user.franchise_id
    )
    
    db.add(db_notice)
    db.commit()
    db.refresh(db_notice)
    
    return {
        "id": db_notice.id,
        "title": db_notice.title,
        "content": db_notice.content,
        "target_type": db_notice.target_type,
        "is_active": db_notice.is_active,
        "franchise_id": db_notice.franchise_id,
        "created_at": db_notice.created_at.isoformat(),
        "author_name": current_user.username
    }
