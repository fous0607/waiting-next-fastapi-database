"""
매장 관리 라우터
- 매장 목록 조회
- 매장 생성
- 매장 상세 조회
- 매장 수정
- 매장 비활성화
- 매장별 통계
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List

from database import get_db
from models import Store, User, WaitingList, DailyClosing, StoreSettings, Member, ClassInfo
from schemas import (
    Store as StoreSchema,
    StoreCreate,
    StoreUpdate
)
from auth import get_current_user, require_franchise_admin

router = APIRouter()


@router.get("", response_model=List[StoreSchema])
async def get_stores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """매장 목록 조회

    프랜차이즈 관리자와 매장 관리자 모두 접근 가능
    각자 자신의 프랜차이즈 매장 목록만 조회 가능

    Returns:
        List[Store]: 프랜차이즈의 모든 매장 목록
    """
    # system_admin은 모든 매장 조회 가능 (필터 없음)
    if current_user.role == 'system_admin':
        stores = db.query(Store).order_by(Store.created_at.desc()).all()
    
    # franchise_manager는 관리하는 매장만 조회
    elif current_user.role == 'franchise_manager':
        if not current_user.managed_stores:
            return []
        
        managed_ids = [s.id for s in current_user.managed_stores]
        stores = db.query(Store).filter(
            Store.id.in_(managed_ids)
        ).order_by(Store.created_at.desc()).all()

    # franchise_admin과 store_admin(및 전용 단말기)은 자신의 프랜차이즈 매장만 조회
    elif current_user.role in ['franchise_admin', 'store_admin', 'store_reception', 'store_board']:
        if not current_user.franchise_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="프랜차이즈 정보가 없습니다"
            )
        stores = db.query(Store).filter(
            Store.franchise_id == current_user.franchise_id
        ).order_by(Store.created_at.desc()).all()
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="매장 목록 조회 권한이 없습니다"
        )

    return stores




@router.post("", response_model=StoreSchema, status_code=status.HTTP_201_CREATED)
async def create_store(
    store_create: StoreCreate,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """매장 생성

    프랜차이즈 관리자만 접근 가능

    Args:
        store_create: 생성할 매장 정보

    Returns:
        Store: 생성된 매장 정보
    """
    # 매장 코드 자동 생성
    from models import Franchise
    franchise = db.query(Franchise).filter(Franchise.id == current_user.franchise_id).first()
    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    # 프랜차이즈 코드의 첫 글자 가져오기
    prefix = franchise.code[0] if franchise.code else "S"

    # 해당 프랜차이즈의 기존 매장 중 같은 prefix를 가진 매장 코드에서 가장 큰 번호 찾기
    stores = db.query(Store).filter(
        Store.franchise_id == current_user.franchise_id
    ).all()

    max_number = 0
    for store in stores:
        if store.code.startswith(prefix) and len(store.code) > 1:
            try:
                number = int(store.code[1:])
                if number > max_number:
                    max_number = number
            except ValueError:
                continue

    # 새로운 매장 코드 생성 (예: S001, S002, S003...)
    new_code = f"{prefix}{str(max_number + 1).zfill(3)}"

    # 매장 생성
    new_store = Store(
        franchise_id=current_user.franchise_id,
        name=store_create.name,
        code=new_code,
        is_active=True
    )

    db.add(new_store)
    db.commit()
    db.refresh(new_store)

    # 기본 매장 설정 생성
    default_settings = StoreSettings(
        store_id=new_store.id,
        store_name=store_create.name,
        display_classes_count=3,
        list_direction="vertical",
        rows_per_class=1,
        admin_password="1234",
        max_waiting_limit=50,
        block_last_class_registration=False,
        show_waiting_number=True,
        mask_customer_name=False,
        show_order_number=True,
        board_display_order="number,name,order"
    )
    db.add(default_settings)
    db.commit()

    return new_store


@router.get("/{store_id}", response_model=StoreSchema)
async def get_store(
    store_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """매장 상세 조회

    Args:
        store_id: 매장 ID

    Returns:
        Store: 매장 상세 정보
    """
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    # 권한 확인
    if current_user.role == 'franchise_admin':
        if current_user.franchise_id != store.franchise_id:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다"
            )
    elif current_user.role == 'franchise_manager':
        managed_ids = [s.id for s in current_user.managed_stores]
        if store_id not in managed_ids:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다"
            )
    elif current_user.role in ['store_admin', 'store_reception', 'store_board']:
        if current_user.store_id != store_id:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="접근 권한이 없습니다"
            )
    elif current_user.role != 'system_admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="접근 권한이 없습니다"
        )

    return store


@router.put("/{store_id}", response_model=StoreSchema)
async def update_store(
    store_id: int,
    store_update: StoreUpdate,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """매장 정보 수정

    Args:
        store_id: 매장 ID
        store_update: 수정할 매장 정보

    Returns:
        Store: 수정된 매장 정보
    """
    store = db.query(Store).filter(
        Store.id == store_id,
        Store.franchise_id == current_user.franchise_id
    ).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    # 매장 코드 변경 시 중복 체크
    if store_update.code and store_update.code != store.code:
        existing_store = db.query(Store).filter(Store.code == store_update.code).first()
        if existing_store:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 존재하는 매장 코드입니다"
            )

    # 수정
    update_data = store_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(store, key, value)

    store.updated_at = datetime.now()

    db.commit()
    db.refresh(store)

    return store


@router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store(
    store_id: int,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """매장 비활성화

    실제로 삭제하지 않고 is_active를 False로 변경

    Args:
        store_id: 매장 ID
    """
    store = db.query(Store).filter(
        Store.id == store_id,
        Store.franchise_id == current_user.franchise_id
    ).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    store.is_active = False
    store.updated_at = datetime.now()

    db.commit()


@router.post("/{store_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_store(
    store_id: int,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """매장 비활성화

    is_active를 False로 변경

    Args:
        store_id: 매장 ID
    """
    store = db.query(Store).filter(
        Store.id == store_id,
        Store.franchise_id == current_user.franchise_id
    ).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    store.is_active = False
    store.updated_at = datetime.now()

    db.commit()


@router.post("/{store_id}/activate", response_model=StoreSchema)
async def activate_store(
    store_id: int,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """매장 활성화

    is_active를 True로 변경

    Args:
        store_id: 매장 ID

    Returns:
        Store: 활성화된 매장 정보
    """
    store = db.query(Store).filter(
        Store.id == store_id,
        Store.franchise_id == current_user.franchise_id
    ).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    store.is_active = True
    store.updated_at = datetime.now()

    db.commit()
    db.refresh(store)

    return store


@router.get("/code/{store_code}", response_model=StoreSchema)
async def get_store_by_code(
    store_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """매장 코드로 매장 조회

    URL 파라미터로 매장을 선택할 수 있도록 매장 코드로 조회
    모든 인증된 사용자가 접근 가능

    Args:
        store_code: 매장 코드 (예: S001, S002)

    Returns:
        Store: 매장 정보
    """
    store = db.query(Store).filter(
        Store.code == store_code,
        Store.is_active == True
    ).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"매장 코드 '{store_code}'를 찾을 수 없습니다"
        )

    return store


@router.get("/{store_id}/stats")
async def get_store_stats(
    store_id: int,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """매장별 통계 조회

    Args:
        store_id: 매장 ID

    Returns:
        dict: 매장 통계 정보
    """
    # 매장 존재 및 권한 확인
    store = db.query(Store).filter(
        Store.id == store_id,
        Store.franchise_id == current_user.franchise_id
    ).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    today = date.today()

    # franchise_manager 권한 확인
    if current_user.role == 'franchise_manager':
        managed_ids = [s.id for s in current_user.managed_stores]
        if store_id not in managed_ids:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="해당 매장에 대한 접근 권한이 없습니다"
            )

    # 오늘의 대기 통계
    today_stats = db.query(DailyClosing).filter(
        DailyClosing.store_id == store_id,
        DailyClosing.business_date == today
    ).first()

    # 현재 대기 중인 고객 수
    current_waiting = db.query(func.count(WaitingList.id)).filter(
        WaitingList.store_id == store_id,
        WaitingList.status == 'waiting'
    ).scalar()

    # 총 회원 수
    total_members = db.query(func.count(Member.id)).filter(
        Member.store_id == store_id
    ).scalar()

    # 운영 중인 수업 수
    active_classes = db.query(func.count(ClassInfo.id)).filter(
        ClassInfo.store_id == store_id,
        ClassInfo.is_active == True
    ).scalar()

    # 최근 7일 통계
    from datetime import timedelta
    week_ago = today - timedelta(days=7)

    weekly_stats = db.query(
        func.coalesce(func.sum(DailyClosing.total_waiting), 0).label('total_waiting'),
        func.coalesce(func.sum(DailyClosing.total_attended), 0).label('total_attended'),
        func.coalesce(func.sum(DailyClosing.total_cancelled), 0).label('total_cancelled')
    ).filter(
        DailyClosing.store_id == store_id,
        DailyClosing.business_date >= week_ago,
        DailyClosing.business_date <= today
    ).first()

    return {
        'store_id': store_id,
        'store_name': store.name,
        'store_code': store.code,
        'is_active': store.is_active,
        'today': {
            'total_waiting': today_stats.total_waiting if today_stats else 0,
            'total_attended': today_stats.total_attended if today_stats else 0,
            'total_cancelled': today_stats.total_cancelled if today_stats else 0,
            'is_open': today_stats.is_closed == False if today_stats else False,
            'opening_time': today_stats.opening_time if today_stats else None,
            'closing_time': today_stats.closing_time if today_stats else None
        },
        'current_waiting': current_waiting,
        'total_members': total_members,
        'active_classes': active_classes,
        'weekly': {
            'total_waiting': weekly_stats.total_waiting if weekly_stats else 0,
            'total_attended': weekly_stats.total_attended if weekly_stats else 0,
            'total_cancelled': weekly_stats.total_cancelled if weekly_stats else 0
        }
    }

from auth import get_current_store
@router.post("/heartbeat")
async def heartbeat(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """
    Update Store Heartbeat (Health Check)
    """
    current_store.last_heartbeat = datetime.now()
    db.commit()
    return {"status": "ok"}

