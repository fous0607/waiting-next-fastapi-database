"""
사용자 관리 라우터
- 사용자 목록 조회
- 사용자 생성
- 사용자 상세 조회
- 사용자 수정
- 사용자 비활성화
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from database import get_db
from models import User, Store
from schemas import User as UserSchema, UserCreate, UserUpdate
from auth import get_current_user, require_franchise_admin, get_password_hash

router = APIRouter()


@router.get("/", response_model=List[UserSchema])
async def get_users(
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """사용자 목록 조회

    프랜차이즈 관리자만 접근 가능
    자신의 프랜차이즈에 속한 사용자만 조회

    Returns:
        List[User]: 프랜차이즈의 모든 사용자 목록
    """
    users = db.query(User).filter(
        User.franchise_id == current_user.franchise_id
    )

    # [수정] 프랜차이즈 중간 관리자(franchise_manager)는 자신과 관리하는 매장의 사용자만 조회 가능
    if current_user.role == 'franchise_manager':
        # 관리하는 매장 ID 목록
        managed_store_ids = [store.id for store in current_user.managed_stores]
        
        # 자신(me) 또는 관리하는 매장에 속한(store_id in managed_store_ids) 사용자만 필터링
        from sqlalchemy import or_
        users = users.filter(
            or_(
                User.id == current_user.id,
                User.store_id.in_(managed_store_ids)
            )
        )

    users = users.order_by(User.created_at.desc()).all()

    return users

    return users


@router.get("", include_in_schema=False)
async def get_users_no_slash(
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """Trailing slash 없는 요청 처리 (Redirect 방지용)"""
    return await get_users(current_user, db)
@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_create: UserCreate,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """사용자 생성

    프랜차이즈 관리자만 접근 가능

    Args:
        user_create: 생성할 사용자 정보

    Returns:
        User: 생성된 사용자 정보
    """
    # 사용자명 중복 체크
    existing_user = db.query(User).filter(User.username == user_create.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 사용자명입니다"
        )

    # 역할 검증
    if user_create.role not in ['franchise_admin', 'store_admin', 'franchise_manager', 'store_reception', 'store_board']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="올바르지 않은 역할입니다."
        )

    # 매장 관리자인 경우 매장 ID 필수
    if user_create.role == 'store_admin' and not user_create.store_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="매장 관리자는 매장 ID가 필요합니다"
        )

    # 매장 ID가 있는 경우 해당 매장이 자신의 프랜차이즈에 속하는지 확인
    if user_create.store_id:
        store = db.query(Store).filter(
            Store.id == user_create.store_id,
            Store.franchise_id == current_user.franchise_id
        ).first()

        if not store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="매장을 찾을 수 없거나 접근 권한이 없습니다"
            )

    # 사용자 생성
    password_hash = get_password_hash(user_create.password)

    new_user = User(
        username=user_create.username,
        password_hash=password_hash,
        role=user_create.role,
        franchise_id=current_user.franchise_id,
        store_id=user_create.store_id,
        is_active=True
    )

    # 중간 관리자의 매장 권한 설정
    if user_create.role == 'franchise_manager' and user_create.managed_store_ids:
        stores = db.query(Store).filter(
            Store.id.in_(user_create.managed_store_ids),
            Store.franchise_id == current_user.franchise_id
        ).all()
        
        if len(stores) != len(user_create.managed_store_ids):
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="일부 매장을 찾을 수 없거나 접근 권한이 없습니다"
            )
        new_user.managed_stores = stores

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("/{user_id}", response_model=UserSchema)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """사용자 상세 조회

    Args:
        user_id: 사용자 ID

    Returns:
        User: 사용자 상세 정보
    """
    user = db.query(User).filter(
        User.id == user_id,
        User.franchise_id == current_user.franchise_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    return user


@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """사용자 정보 수정

    Args:
        user_id: 사용자 ID
        user_update: 수정할 사용자 정보

    Returns:
        User: 수정된 사용자 정보
    """
    user = db.query(User).filter(
        User.id == user_id,
        User.franchise_id == current_user.franchise_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # 사용자명 변경 시 중복 체크
    if user_update.username and user_update.username != user.username:
        existing_user = db.query(User).filter(User.username == user_update.username).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 존재하는 사용자명입니다"
            )

    # 역할 변경 시 검증
    if user_update.role and user_update.role not in ['franchise_admin', 'store_admin', 'franchise_manager', 'store_reception', 'store_board']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="올바르지 않은 역할입니다."
        )

    # 매장 ID 변경 시 검증
    if user_update.store_id:
        store = db.query(Store).filter(
            Store.id == user_update.store_id,
            Store.franchise_id == current_user.franchise_id
        ).first()

        if not store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="매장을 찾을 수 없거나 접근 권한이 없습니다"
            )

    # 수정
    update_data = user_update.dict(exclude_unset=True, exclude={'password', 'managed_store_ids'})
    for key, value in update_data.items():
        setattr(user, key, value)
    
    # 중간 관리자 매장 권한 업데이트
    if user_update.role == 'franchise_manager' or (not user_update.role and user.role == 'franchise_manager'):
        if user_update.managed_store_ids is not None:
             stores = db.query(Store).filter(
                Store.id.in_(user_update.managed_store_ids),
                Store.franchise_id == current_user.franchise_id
            ).all()
             user.managed_stores = stores
    elif user_update.role and user_update.role != 'franchise_manager':
        # 다른 역할로 변경 시 관리 매장 초기화
        user.managed_stores = []

    # 비밀번호 변경이 있는 경우
    if user_update.password:
        user.password_hash = get_password_hash(user_update.password)

    user.updated_at = datetime.now()

    db.commit()
    db.refresh(user)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """사용자 비활성화

    실제로 삭제하지 않고 is_active를 False로 변경
    자기 자신은 비활성화할 수 없음

    Args:
        user_id: 사용자 ID
    """
    # 자기 자신은 비활성화할 수 없음
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신을 비활성화할 수 없습니다"
        )

    user = db.query(User).filter(
        User.id == user_id,
        User.franchise_id == current_user.franchise_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    user.is_active = False
    user.updated_at = datetime.now()

    db.commit()


@router.post("/{user_id}/activate", response_model=UserSchema)
async def activate_user(
    user_id: int,
    current_user: User = Depends(require_franchise_admin),
    db: Session = Depends(get_db)
):
    """사용자 활성화

    Args:
        user_id: 사용자 ID

    Returns:
        User: 활성화된 사용자 정보
    """
    user = db.query(User).filter(
        User.id == user_id,
        User.franchise_id == current_user.franchise_id
    ).first()

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
