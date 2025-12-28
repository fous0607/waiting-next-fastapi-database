"""
시스템 관리자 라우터
- 프랜차이즈 CRUD
- 프랜차이즈 관리자 생성
- 전체 시스템 통계
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from datetime import datetime, date
from typing import List, Optional

from database import get_db, engine
from sqlalchemy import inspect
from models import Franchise, Store, User, Member, DailyClosing, StoreSettings, WaitingList, WaitingHistory, Notice
from schemas import (
    Franchise as FranchiseSchema,
    FranchiseCreate,
    FranchiseUpdate,
    User as UserSchema,
    UserCreate,
    UserUpdate,
    Store as StoreSchema,
    StoreCreate,
    StoreUpdate,
    UserListResponse,
    StoreListResponse,
    StoreListResponse,
    MemberListResponse,
    AnalyticsDashboard,
    HourlyStat,
    StoreOperationStat,
    StoreOperationStat,
    TimeStats,
    StoreSettings as StoreSettingsSchema,
    StoreSettingsUpdate
)
from auth import require_system_admin, get_password_hash

router = APIRouter()

# --- DB Diagnostic Endpoint ---
@router.get("/health/db")
async def check_db_health(db: Session = Depends(get_db)):
    """데이터베이스 연결 상태 진단"""
    result = {"status": "ok", "message": "Database connection successful"}
    try:
        # 1. Basic Connection Check
        db.execute(func.now())
        result["connection_check"] = "pass"
        
        # 2. Schema Check (Users table)
        auth_admin = db.query(User).filter(User.username == "superadmin").first()
        result["schema_check"] = "pass"
        result["superadmin_exists"] = bool(auth_admin)
        
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        # Log error to console as well
        print(f"DB Health Check Failed: {e}")
        
    return result

@router.get("/health/auth-debug")
async def debug_auth(db: Session = Depends(get_db)):
    """인증 로직 디버깅 (로그인 크래시 원인 분석)"""
    result = {"status": "ok", "steps": []}
    try:
        # 1. Check Library Import
        result["steps"].append("Checking imports...")
        import bcrypt
        import passlib
        result["steps"].append("Imports OK")
        
        # 2. Get User
        result["steps"].append("Fetching superadmin...")
        user = db.query(User).filter(User.username == "superadmin").first()
        if not user:
            return {"status": "error", "message": "Superadmin not found"}
        result["steps"].append(f"User found: {user.role}")
        
        # 3. Simulate Verify
        result["steps"].append("Verifying password 'superadmin123'...")
        from auth import verify_password
        is_valid = verify_password("superadmin123", user.password_hash)
        result["steps"].append(f"Password verification result: {is_valid}")
        result["can_login"] = is_valid
        
    except Exception as e:
        import traceback
        result["status"] = "error"
        result["error"] = str(e)
        result["traceback"] = traceback.format_exc()
        
    return result


@router.get("/franchises", response_model=List[FranchiseSchema])
async def get_all_franchises(
    include_stores: bool = False,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """모든 프랜차이즈 조회"""
    if include_stores:
        franchises = db.query(Franchise).options(joinedload(Franchise.stores)).all()
    else:
        franchises = db.query(Franchise).all()
    return franchises


@router.get("/franchises/{franchise_id}", response_model=FranchiseSchema)
async def get_franchise(
    franchise_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """특정 프랜차이즈 조회"""
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    return franchise


@router.get("/franchises/{franchise_id}/stores", response_model=List[StoreSchema])
async def get_franchise_stores(
    franchise_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """특정 프랜차이즈의 매장 목록 조회"""
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    stores = db.query(Store).filter(Store.franchise_id == franchise_id).all()
    return stores


@router.get("/franchises/{franchise_id}/users", response_model=List[UserSchema])
async def get_franchise_users(
    franchise_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """특정 프랜차이즈의 사용자 목록 조회"""
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    users = db.query(User).filter(User.franchise_id == franchise_id).all()
    return users


@router.get("/franchises/{franchise_id}/stats")
async def get_franchise_stats(
    franchise_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """특정 프랜차이즈의 통계 조회"""
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    from datetime import date

    # 매장 수
    total_stores = db.query(func.count(Store.id)).filter(
        Store.franchise_id == franchise_id
    ).scalar()

    # 활성 매장 수
    active_stores = db.query(func.count(Store.id)).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True
    ).scalar()

    # 사용자 수
    total_users = db.query(func.count(User.id)).filter(
        User.franchise_id == franchise_id
    ).scalar()

    # 오늘 날짜
    today = date.today()

    # 프랜차이즈 전체 매장의 오늘 통계
    stores = db.query(Store).filter(
        Store.franchise_id == franchise_id,
        Store.is_active == True
    ).all()

    store_ids = [store.id for store in stores]

    # 총 회원 수 (모든 매장 합계)
    total_members = db.query(func.count(Member.id)).filter(
        Member.store_id.in_(store_ids)
    ).scalar() if store_ids else 0

    return {
        'franchise_id': franchise_id,
        'total_stores': total_stores,
        'active_stores': active_stores,
        'total_users': total_users,
        'total_members': total_members
    }


@router.post("/franchises", response_model=FranchiseSchema, status_code=status.HTTP_201_CREATED)
async def create_franchise(
    franchise: FranchiseCreate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """새 프랜차이즈 생성"""
    # 코드 중복 체크
    existing = db.query(Franchise).filter(Franchise.code == franchise.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"프랜차이즈 코드 '{franchise.code}'가 이미 존재합니다"
        )

    # 프랜차이즈 생성
    new_franchise = Franchise(
        name=franchise.name,
        code=franchise.code,
        member_type=franchise.member_type,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    db.add(new_franchise)
    db.commit()
    db.refresh(new_franchise)

    return new_franchise


@router.put("/franchises/{franchise_id}", response_model=FranchiseSchema)
async def update_franchise(
    franchise_id: int,
    franchise_update: FranchiseUpdate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 정보 수정"""
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    # 코드 중복 체크 (코드 변경 시)
    if franchise_update.code and franchise_update.code != franchise.code:
        existing = db.query(Franchise).filter(Franchise.code == franchise_update.code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"프랜차이즈 코드 '{franchise_update.code}'가 이미 존재합니다"
            )

    # 수정
    update_data = franchise_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(franchise, key, value)

    franchise.updated_at = datetime.now()

    db.commit()
    db.refresh(franchise)

    return franchise


@router.delete("/franchises/{franchise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_franchise(
    franchise_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 삭제 (비활성화)"""
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    # 비활성화
    franchise.is_active = False
    franchise.updated_at = datetime.now()

    db.commit()

    return None


@router.post("/franchises/{franchise_id}/activate", response_model=FranchiseSchema)
async def activate_franchise(
    franchise_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 활성화"""
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()

    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    franchise.is_active = True
    franchise.updated_at = datetime.now()

    db.commit()
    db.refresh(franchise)

    return franchise


@router.post("/franchises/{franchise_id}/admin", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_franchise_admin(
    franchise_id: int,
    user_create: UserCreate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """프랜차이즈 관리자 생성"""
    # 프랜차이즈 존재 확인
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()
    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    # 사용자명 중복 확인
    existing_user = db.query(User).filter(User.username == user_create.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"사용자명 '{user_create.username}'가 이미 존재합니다"
        )

    # 프랜차이즈 관리자만 생성 가능
    if user_create.role != "franchise_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이 엔드포인트는 프랜차이즈 관리자 생성 전용입니다"
        )

    # 사용자 생성
    password_hash = get_password_hash(user_create.password)
    new_user = User(
        username=user_create.username,
        password_hash=password_hash,
        role="franchise_admin",
        franchise_id=franchise_id,
        store_id=None,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("/stats")
async def get_system_stats(
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """전체 시스템 통계"""
    # 프랜차이즈 수
    total_franchises = db.query(func.count(Franchise.id)).scalar()
    active_franchises = db.query(func.count(Franchise.id)).filter(
        Franchise.is_active == True
    ).scalar()

    # 매장 수
    total_stores = db.query(func.count(Store.id)).scalar()
    active_stores = db.query(func.count(Store.id)).filter(
        Store.is_active == True
    ).scalar()

    # 사용자 수
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(
        User.is_active == True
    ).scalar()

    # 회원 수
    total_members = db.query(func.count(Member.id)).scalar()

    # 프랜차이즈별 통계
    franchises = db.query(Franchise).all()
    franchise_stats = []

    for franchise in franchises:
        # 프랜차이즈의 매장 수
        stores_count = db.query(func.count(Store.id)).filter(
            Store.franchise_id == franchise.id
        ).scalar()

        # 프랜차이즈의 활성 매장 수
        active_stores_count = db.query(func.count(Store.id)).filter(
            Store.franchise_id == franchise.id,
            Store.is_active == True
        ).scalar()

        # 프랜차이즈의 사용자 수
        users_count = db.query(func.count(User.id)).filter(
            User.franchise_id == franchise.id
        ).scalar()

        # 프랜차이즈의 매장 ID 목록
        store_ids = [s.id for s in db.query(Store.id).filter(
            Store.franchise_id == franchise.id
        ).all()]

        # 프랜차이즈의 회원 수
        members_count = db.query(func.count(Member.id)).filter(
            Member.store_id.in_(store_ids)
        ).scalar() if store_ids else 0

        franchise_stats.append({
            "franchise_id": franchise.id,
            "franchise_name": franchise.name,
            "franchise_code": franchise.code,
            "is_active": franchise.is_active,
            "stores_count": stores_count,
            "active_stores_count": active_stores_count,
            "users_count": users_count,
            "members_count": members_count
        })

    return {
        "total_franchises": total_franchises,
        "active_franchises": active_franchises,
        "total_stores": total_stores,
        "active_stores": active_stores,
        "total_users": total_users,
        "active_users": active_users,
        "total_members": total_members,
        "franchises": franchise_stats
    }


# ========== 데이터 초기화 (Superadmin - Danger Zone) ==========

@router.delete("/stores/{store_id}/reset/members")
async def reset_store_members(
    store_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    [Danger] 특정 매장의 회원 정보 초기화 (전체 삭제)
    """
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    # 1. WaitingList의 member_id 참조 제거 (Set Null)
    subquery = db.query(Member.id).filter(Member.store_id == store_id)
    db.query(WaitingList).filter(
        WaitingList.member_id.in_(subquery)
    ).update({WaitingList.member_id: None}, synchronize_session=False)

    # 2. 회원 삭제
    deleted_count = db.query(Member).filter(Member.store_id == store_id).delete(synchronize_session=False)
    
    db.commit()

    return {"message": f"매장 [{store.name}]의 회원 정보 {deleted_count}건이 초기화되었습니다."}


@router.delete("/stores/{store_id}/reset/waiting")
async def reset_store_waiting(
    store_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    [Danger] 특정 매장의 대기 정보 초기화 (WaitingList 전체 삭제)
    """
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    deleted_count = db.query(WaitingList).filter(
        WaitingList.store_id == store_id
    ).delete(synchronize_session=False)
    
    db.commit()

    return {"message": f"매장 [{store.name}]의 대기 정보 {deleted_count}건이 초기화되었습니다."}


@router.delete("/stores/{store_id}/reset/history")
async def reset_store_history(
    store_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    [Danger] 특정 매장의 출석/마감 이력 초기화 (WaitingHistory, DailyClosing 삭제)
    """
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    # 1. WaitingHistory 삭제
    history_deleted = db.query(WaitingHistory).filter(
        WaitingHistory.store_id == store_id
    ).delete(synchronize_session=False)

    # 2. DailyClosing 삭제
    closing_deleted = db.query(DailyClosing).filter(
        DailyClosing.store_id == store_id
    ).delete(synchronize_session=False)
    
    db.commit()

    return {"message": f"매장 [{store.name}]의 대기 이력 {history_deleted}건, 마감 이력 {closing_deleted}건이 초기화되었습니다."}


# ========== 매장 관리 (Superadmin) ==========

@router.post("/franchises/{franchise_id}/stores", response_model=StoreSchema, status_code=status.HTTP_201_CREATED)
async def create_store_for_franchise(
    franchise_id: int,
    store_create: StoreCreate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """특정 프랜차이즈의 매장 생성 (Superadmin 전용)"""
    # 프랜차이즈 존재 확인
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()
    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    # 매장 코드 자동 생성 (전체 매장에서 유니크해야 함)
    prefix = franchise.code[0] if franchise.code else "S"

    # 전체 매장 중 같은 prefix를 가진 매장 코드에서 가장 큰 번호 찾기
    all_stores = db.query(Store).all()

    max_number = 0
    for store in all_stores:
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
        franchise_id=franchise_id,
        name=store_create.name,
        code=new_code,
        is_active=True
    )

    db.add(new_store)
    db.commit()
    db.refresh(new_store)

    # 매장 설정 자동 생성
    store_settings = StoreSettings(
        store_id=new_store.id,
        store_name=new_store.name,
        admin_password="0000"  # 기본 비밀번호
    )
    db.add(store_settings)
    db.commit()

    return new_store


@router.post("/stores/{store_id}/activate", response_model=StoreSchema)
async def activate_store(
    store_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """매장 활성화 (Superadmin 전용)"""
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    store.is_active = True
    db.commit()
    db.refresh(store)

    return store


@router.post("/stores/{store_id}/deactivate", response_model=StoreSchema)
async def deactivate_store(
    store_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """매장 비활성화 (Superadmin 전용)"""
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )

    store.is_active = False
    db.commit()
    db.refresh(store)

    store.is_active = False
    db.commit()
    db.refresh(store)

    return store


@router.get("/stores/{store_id}/settings", response_model=StoreSettingsSchema)
async def get_store_settings_admin(
    store_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    [Superadmin] 특정 매장의 설정 조회 (비밀번호 포함)
    """
    settings = db.query(StoreSettings).filter(StoreSettings.store_id == store_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="설정을 찾을 수 없습니다.")
    return settings


@router.put("/stores/{store_id}/settings", response_model=StoreSettingsSchema)
async def update_store_settings_admin(
    store_id: int,
    settings_update: StoreSettingsUpdate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """
    [Superadmin] 특정 매장의 설정 수정 (비밀번호 등)
    """
    settings = db.query(StoreSettings).filter(StoreSettings.store_id == store_id).first()
    if not settings:
        # 설정이 없으면 생성 (방어 코드)
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
        
        settings = StoreSettings(store_id=store_id, store_name=store.name)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # 업데이트
    update_data = settings_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)
    return settings
    db.refresh(store)

    return store


@router.put("/stores/{store_id}", response_model=StoreSchema)
async def update_store(
    store_id: int,
    store_update: StoreUpdate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """매장 정보 수정 (Superadmin 전용)"""
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매장을 찾을 수 없습니다"
        )
    
    # 이름 변경
    if store_update.name:
        store.name = store_update.name
    
    # is_active 변경 (StoreUpdate에 있다면)
    if store_update.is_active is not None:
        store.is_active = store_update.is_active

    db.commit()
    db.refresh(store)

    # 매장 설정(StoreSettings)의 매장명도 동기화
    # store_settings = db.query(StoreSettings).filter(StoreSettings.store_id == store_id).first()
    # Implicitly updated if using ORM relationship, but StoreSettings.store_name is a separate column.
    # So we must update it manually.
    
    store_settings = db.query(StoreSettings).filter(StoreSettings.store_id == store_id).first()
    if store_settings and store.name:
        store_settings.store_name = store.name
        db.commit()
        db.refresh(store_settings)

    return store


# ========== 사용자 관리 (Superadmin) ==========

@router.post("/franchises/{franchise_id}/users", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user_for_franchise(
    franchise_id: int,
    user_create: UserCreate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """특정 프랜차이즈의 사용자 생성 (Superadmin 전용)"""
    # 프랜차이즈 존재 확인
    franchise = db.query(Franchise).filter(Franchise.id == franchise_id).first()
    if not franchise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프랜차이즈를 찾을 수 없습니다"
        )

    # 사용자명 중복 확인
    existing_user = db.query(User).filter(User.username == user_create.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 사용자명입니다"
        )

    # 역할 검증
    if user_create.role not in ['franchise_admin', 'store_admin', 'franchise_manager', 'store_reception', 'store_board', 'store_owner', 'store_mobile']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="올바르지 않은 역할입니다."
        )

    # 매장 관리자인 경우 매장 ID 필수
    if user_create.role in ['store_admin', 'store_owner', 'store_mobile'] and not user_create.store_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="매장 관리자/사장님/모바일 관리자는 매장 ID가 필요합니다"
        )

    # 매장 ID가 있는 경우 해당 매장이 프랜차이즈에 속하는지 확인
    if user_create.store_id:
        store = db.query(Store).filter(
            Store.id == user_create.store_id,
            Store.franchise_id == franchise_id
        ).first()

        if not store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="매장을 찾을 수 없거나 해당 프랜차이즈에 속하지 않습니다"
            )

    # 사용자 생성
    password_hash = get_password_hash(user_create.password)

    new_user = User(
        username=user_create.username,
        password_hash=password_hash,
        role=user_create.role,
        franchise_id=franchise_id,
        store_id=user_create.store_id,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    # 중간 관리자의 매장 권한 설정
    if user_create.role == 'franchise_manager' and user_create.managed_store_ids:
        stores = db.query(Store).filter(
            Store.id.in_(user_create.managed_store_ids),
            Store.franchise_id == franchise_id
        ).all()
        
        if len(stores) != len(user_create.managed_store_ids):
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="일부 매장을 찾을 수 없거나 해당 프랜차이즈에 속하지 않습니다"
            )
        new_user.managed_stores = stores

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.put("/users/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """사용자 정보 수정 (Superadmin 전용)"""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # 사용자명 변경 시 중복 확인
    if user_update.username and user_update.username != user.username:
        existing_user = db.query(User).filter(User.username == user_update.username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 존재하는 사용자명입니다"
            )

    # 역할 변경 시 검증
    if user_update.role and user_update.role not in ['franchise_admin', 'store_admin', 'franchise_manager', 'system_admin', 'store_reception', 'store_board', 'store_owner', 'store_mobile']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="올바르지 않은 역할입니다."
        )

    # 매장 ID 변경 시 검증
    if user_update.store_id:
        store = db.query(Store).filter(Store.id == user_update.store_id).first()
        if not store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="매장을 찾을 수 없습니다"
            )

    # 수정
    update_data = user_update.dict(exclude_unset=True, exclude={'password', 'managed_store_ids'})
    for key, value in update_data.items():
        setattr(user, key, value)
        
    # 중간 관리자의 매장 권한 수정
    if user_update.role == 'franchise_manager' and user_update.managed_store_ids is not None:
        stores = db.query(Store).filter(
            Store.id.in_(user_update.managed_store_ids),
            Store.franchise_id == user.franchise_id
        ).all()
        user.managed_stores = stores
    elif user_update.role != 'franchise_manager':
        user.managed_stores = []


    # 비밀번호 변경이 있는 경우
    if user_update.password:
        user.password_hash = get_password_hash(user_update.password)

    user.updated_at = datetime.now()

    db.commit()
    db.refresh(user)

    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """사용자 비활성화 (Superadmin 전용)"""
    # 자기 자신은 비활성화할 수 없음
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신을 비활성화할 수 없습니다"
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    user.is_active = False
    user.updated_at = datetime.now()

    db.commit()

    return None


@router.post("/users/{user_id}/activate", response_model=UserSchema)
async def activate_user(
    user_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """사용자 활성화 (Superadmin 전용)"""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    user.is_active = True
    user.updated_at = datetime.now()

    db.commit()
    db.refresh(user)

    return user


@router.get("/users", response_model=List[UserListResponse])
async def get_all_users(
    skip: int = 0,
    limit: int = 1000,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """전체 사용자 조회 (System Admin)"""
    users = db.query(User).options(
        joinedload(User.franchise),
        joinedload(User.store)
    ).offset(skip).limit(limit).all()

    response = []
    for user in users:
        user_dict = UserListResponse.from_orm(user)
        if user.franchise:
            user_dict.franchise_name = user.franchise.name
        if user.store:
            user_dict.store_name = user.store.name
        response.append(user_dict)
    
    return response


@router.get("/stores", response_model=List[StoreListResponse])
async def get_all_stores(
    skip: int = 0,
    limit: int = 1000,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """전체 매장 조회 (System Admin)"""
    stores = db.query(Store).options(
        joinedload(Store.franchise)
    ).offset(skip).limit(limit).all()

    response = []
    for store in stores:
        store_dict = StoreListResponse.from_orm(store)
        if store.franchise:
            store_dict.franchise_name = store.franchise.name
        response.append(store_dict)
    
    return response


@router.get("/members", response_model=List[MemberListResponse])
async def search_members(
    q: str = None,
    franchise_id: int = None,
    store_id: int = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """회원 검색 및 조회 (System Admin)"""
    query = db.query(Member).options(
        joinedload(Member.store).joinedload(Store.franchise)
    )

    if franchise_id:
        query = query.join(Store).filter(Store.franchise_id == franchise_id)
    
    if store_id:
        # If already joined Store (via franchise_id check), this is fine. 
        # But if only store_id provided, we need join. optimize:
        if not franchise_id:
             query = query.join(Store)
        query = query.filter(Member.store_id == store_id)

    if q:
        query = query.filter(
            (Member.name.ilike(f"%{q}%")) | 
            (Member.phone.ilike(f"%{q}%"))
        )

    members = query.order_by(Member.created_at.desc()).offset(skip).limit(limit).all()

    response = []
    for member in members:
        member_dict = MemberListResponse.from_orm(member)
        if member.store:
            member_dict.store_name = member.store.name
            if member.store.franchise:
                member_dict.franchise_name = member.store.franchise.name
        response.append(member_dict)
    
    return response


@router.get("/members/{member_id}/history")
async def get_system_member_history(
    member_id: int,
    start_date: date,
    end_date: date,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """특정 회원의 출석 이력 조회 (System Admin)"""
    from models import WaitingList
    
    # 회원 존재 확인
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    # 출석 이력 조회 (통계 서비스와 동일한 로직)
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


@router.get("/stats/members")
async def get_member_aggregation(
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """회원 집계 조회 (프랜차이즈별, 매장별)"""
    
    # 1. 프랜차이즈별 회원 수
    # Member -> Store -> Franchise
    franchise_results = db.query(
        Franchise.id,
        Franchise.name,
        func.count(Member.id).label('member_count')
    ).join(Store, Franchise.id == Store.franchise_id)\
     .outerjoin(Member, Store.id == Member.store_id)\
     .group_by(Franchise.id, Franchise.name)\
     .all()
     
    franchise_stats = [
        {"id": r.id, "name": r.name, "count": r.member_count}
        for r in franchise_results
    ]
    
    # 2. 매장별 회원 수
    # Store -> Franchise (for name)
    # Store -> Member (for count)
    store_results = db.query(
        Store.id,
        Store.name,
        Franchise.name.label('franchise_name'),
        func.count(Member.id).label('member_count')
    ).join(Franchise, Store.franchise_id == Franchise.id)\
     .outerjoin(Member, Store.id == Member.store_id)\
     .group_by(Store.id, Store.name, Franchise.name)\
     .all()
     
    store_stats = [
        {
            "id": r.id, 
            "name": r.name, 
            "franchise_name": r.franchise_name, 
            "count": r.member_count
        }
        for r in store_results
    ]
    
    # Sort by count desc
    franchise_stats.sort(key=lambda x: x['count'], reverse=True)
    store_stats.sort(key=lambda x: x['count'], reverse=True)
    
    return {
        "by_franchise": franchise_stats,
        "by_store": store_stats
    }


@router.get("/debug/columns/{table_name}")
async def debug_table_schema(
    table_name: str,
    current_user: User = Depends(require_system_admin)
):
    """
    [디버그] 특정 테이블의 컬럼 목록 조회
    사용법: /api/system/debug/columns/store_settings
    """
    try:
        inspector = inspect(engine)
        columns = inspector.get_columns(table_name)
        return {
            "table": table_name,
            "columns": [
                {
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col["nullable"]
                }
                for col in columns
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"테이블 정보 조회 중 오류 발생: {str(e)}"
        )

@router.get("/stats/dashboard", response_model=AnalyticsDashboard)
async def get_analytics_dashboard(
    franchise_id: int = None,
    store_id: int = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    통합 분석 대시보드 데이터 조회
    """
    try:
        # 1. Scope definition
        store_query = db.query(Store).filter(Store.is_active == True)
        if franchise_id:
            store_query = store_query.filter(Store.franchise_id == franchise_id)
        if store_id:
            store_query = store_query.filter(Store.id == store_id)
        
        stores = store_query.all()
        target_store_ids = [s.id for s in stores]
        
        if not target_store_ids:
            return AnalyticsDashboard(
                total_stores=0, open_stores=0, total_waiting=0, total_attendance=0,
                waiting_time_stats=TimeStats(),
                attendance_time_stats=TimeStats(),
                hourly_stats=[],
                store_stats=[]
            )

        today = date.today()
        # Ensure dates are valid
        if not start_date:
            start_date = today
        if not end_date:
            end_date = today
            
        # 2. Open Stores Check (DailyClosing)
        open_ops = db.query(DailyClosing).filter(
            DailyClosing.store_id.in_(target_store_ids),
            DailyClosing.business_date == today,
            DailyClosing.is_closed == False
        ).all()
        
        open_store_ids = {op.store_id for op in open_ops}
        
        # 3. Waiting & Attendance Data (Period)
        waitings = db.query(WaitingList).filter(
            WaitingList.store_id.in_(target_store_ids),
            WaitingList.business_date >= start_date,
            WaitingList.business_date <= end_date
        ).all()
        
        # Calculate Stats
        total_waiting_cnt = len(waitings)
        attended_waitings = [w for w in waitings if w.status == 'attended']
        total_attendance_cnt = len(attended_waitings)
        
        # Time Stats
        wait_times = []
        for w in attended_waitings:
            if w.attended_at and w.created_at:
                mins = (w.attended_at - w.created_at).total_seconds() / 60
                wait_times.append(mins)
                
        w_stats = TimeStats()
        if wait_times:
            w_stats.max = int(max(wait_times))
            w_stats.min = int(min(wait_times))
            w_stats.avg = round(sum(wait_times) / len(wait_times), 1)
            
        a_stats = TimeStats() 

        # 4. Hourly Stats
        hourly_map = {h: {'waiting': 0, 'attendance': 0} for h in range(24)}
        
        for w in waitings:
            # Defensively check created_at
            if w.created_at:
                h = w.created_at.hour
                hourly_map[h]['waiting'] += 1
            
            if w.attended_at:
                ah = w.attended_at.hour
                hourly_map[ah]['attendance'] += 1
                
        hourly_stats_list = [
            HourlyStat(
                hour=h, 
                label=f"{h}시", 
                waiting_count=v['waiting'], 
                attendance_count=v['attendance']
            )
            for h, v in hourly_map.items()
        ]
        
        # 5. Store Stats (Detailed)
        store_stats_list = []
        map_ops = {op.store_id: op for op in open_ops}
        
        from collections import defaultdict
        store_waiting_cnt = defaultdict(int)
        store_attendance_cnt = defaultdict(int)
        store_current_cnt = defaultdict(int)
        
        for w in waitings:
            store_waiting_cnt[w.store_id] += 1
            if w.status == 'waiting':
                 store_current_cnt[w.store_id] += 1
            if w.status == 'attended':
                 store_attendance_cnt[w.store_id] += 1

        for s in stores:
            op = map_ops.get(s.id)
            is_open = op is not None
            
            open_time = op.created_at.strftime("%H:%M") if op and op.created_at else None
            close_time = None 
            
            store_stats_list.append(StoreOperationStat(
                store_name=s.name,
                is_open=is_open,
                open_time=open_time,
                close_time=close_time,
                current_waiting=store_current_cnt[s.id],
                total_waiting=store_waiting_cnt[s.id],
                total_attendance=store_attendance_cnt[s.id]
            ))

        return AnalyticsDashboard(
            total_stores=len(stores),
            open_stores=len(open_store_ids),
            total_waiting=total_waiting_cnt,
            total_attendance=total_attendance_cnt,
            waiting_time_stats=w_stats,
            attendance_time_stats=a_stats,
            hourly_stats=hourly_stats_list,
            store_stats=store_stats_list,
            top_churn_members=[] 
        )

    except Exception as e:
        import traceback
        print(f"Dashboard Stats Error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Dashboard Error: {str(e)}"
        )


# ========== 공지사항 관리 (Superadmin) ==========

from fastapi import Body

@router.get("/notices", response_model=List[dict])
async def get_all_notices_system(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    category: str = None,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """전체 공지사항 조회 (System Admin) - 검색 및 필터링 지원"""
    query = db.query(Notice).options(
        joinedload(Notice.author),
        joinedload(Notice.franchise),
        joinedload(Notice.target_stores)
    )
    
    # 검색 필터
    if search:
        query = query.filter(
            (Notice.title.contains(search)) | (Notice.content.contains(search))
        )
    
    # 카테고리 필터
    if category and category != "all":
        query = query.filter(Notice.category == category)
    
    notices = query.order_by(Notice.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "target_type": n.target_type,
            "category": n.category if hasattr(n, 'category') else "general",
            "is_active": n.is_active,
            "franchise_id": n.franchise_id,
            "franchise_name": n.franchise.name if n.franchise else None,
            "target_store_ids": [s.id for s in n.target_stores],
            "created_at": n.created_at.isoformat(),
            "author_name": n.author.username if n.author else "System"
        } for n in notices
    ]



@router.post("/notices", response_model=dict)
async def create_notice_system(
    notice_data: dict = Body(...),
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """공지사항 생성 (System Admin)"""
    from models import NoticeAttachment
    title = notice_data.get("title")
    content = notice_data.get("content")
    target_type = notice_data.get("target_type", "all")
    target_store_ids = notice_data.get("target_store_ids", [])
    franchise_id = notice_data.get("franchise_id")
    attachment_ids = notice_data.get("attachment_ids", [])
    category = notice_data.get("category", "general")
    is_active = notice_data.get("is_active", True)
    
    db_notice = Notice(
        title=title,
        content=content,
        target_type=target_type,
        category=category,
        is_active=is_active,
        author_id=current_user.id,
        franchise_id=franchise_id if target_type in ["franchise", "program"] else None
    )
    
    if target_type == "selected" and target_store_ids:
        stores = db.query(Store).filter(Store.id.in_(target_store_ids)).all()
        db_notice.target_stores = stores
        
    db.add(db_notice)
    db.commit()
    db.refresh(db_notice)
    
    
    # 첨부파일 연결
    if attachment_ids:
        db.query(NoticeAttachment).filter(
            NoticeAttachment.id.in_(attachment_ids)
        ).update({"notice_id": db_notice.id}, synchronize_session=False)
        db.commit()
    
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



@router.put("/notices/{notice_id}", response_model=dict)
async def update_notice_system(
    notice_id: int,
    notice_data: dict = Body(...),
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """공지사항 수정 (System Admin)"""
    from models import NoticeAttachment
    
    db_notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not db_notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")
    
    # 업데이트할 필드들
    if "title" in notice_data:
        db_notice.title = notice_data["title"]
    if "content" in notice_data:
        db_notice.content = notice_data["content"]
    if "target_type" in notice_data:
        db_notice.target_type = notice_data["target_type"]
    if "category" in notice_data:
        db_notice.category = notice_data["category"]
    if "is_active" in notice_data:
        db_notice.is_active = notice_data["is_active"]
    if "franchise_id" in notice_data:
        db_notice.franchise_id = notice_data["franchise_id"]
    
    # 선택된 매장 업데이트
    if "target_store_ids" in notice_data:
        target_store_ids = notice_data["target_store_ids"]
        if db_notice.target_type == "selected" and target_store_ids:
            stores = db.query(Store).filter(Store.id.in_(target_store_ids)).all()
            db_notice.target_stores = stores
        else:
            db_notice.target_stores = []
    
    # 첨부파일 업데이트
    if "attachment_ids" in notice_data:
        attachment_ids = notice_data["attachment_ids"]
        # 기존 첨부파일 연결 해제
        db.query(NoticeAttachment).filter(
            NoticeAttachment.notice_id == notice_id
        ).update({"notice_id": 0}, synchronize_session=False)
        
        # 새 첨부파일 연결
        if attachment_ids:
            db.query(NoticeAttachment).filter(
                NoticeAttachment.id.in_(attachment_ids)
            ).update({"notice_id": notice_id}, synchronize_session=False)
    
    db.commit()
    db.refresh(db_notice)
    
    return {
        "id": db_notice.id,
        "title": db_notice.title,
        "content": db_notice.content,
        "target_type": db_notice.target_type,
        "category": db_notice.category if hasattr(db_notice, 'category') else "general",
        "is_active": db_notice.is_active,
        "franchise_id": db_notice.franchise_id,
        "created_at": db_notice.created_at.isoformat(),
        "updated_at": db_notice.updated_at.isoformat(),
        "author_name": db_notice.author.username if db_notice.author else "System"
    }


@router.delete("/notices/{notice_id}")
async def delete_notice_system(
    notice_id: int,
    current_user: User = Depends(require_system_admin),
    db: Session = Depends(get_db)
):
    """공지사항 삭제 (System Admin)"""
    db_notice = db.query(Notice).filter(Notice.id == notice_id).first()
    if not db_notice:
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")
    
    db.delete(db_notice)
    db.commit()
    
    return {"message": "공지사항이 삭제되었습니다"}
