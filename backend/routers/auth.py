"""
인증 라우터
- 로그인
- 로그아웃
- 현재 사용자 정보 조회
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime

from database import get_db
from models import User, Store
from schemas import Token, User as UserSchema, UserLogin
from auth import (
    verify_password,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_HOURS
)

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """로그인

    Args:
        form_data: OAuth2 폼 데이터 (username, password)

    Returns:
        Token: JWT 액세스 토큰

    HTTP-only 쿠키에도 토큰 저장
    """
    # 사용자 조회
    user = db.query(User).filter(User.username == form_data.username).first()

    # 사용자 존재 여부 및 비밀번호 검증
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자명 또는 비밀번호가 잘못되었습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 비활성화된 사용자 체크
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 사용자입니다"
        )
    
    # 비활성화된 매장 체크 (매장 관리자인 경우)
    if user.role == 'store_admin' and user.store and not user.store.is_active:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 매장이 비활성화되어 로그인이 제한됩니다."
        )

    # 로그인 시간 업데이트
    user.last_login = datetime.now()
    
    # Update store heartbeat if store admin
    if user.store:
        user.store.last_heartbeat = datetime.now()
        
    db.commit()

    # JWT 토큰 생성
    access_token_expires = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    # HTTP-only 쿠키에 토큰 저장
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        secure=False,  # HTTPS 사용 시 True로 변경
        samesite="lax"
    )

    # 매장 정보 포함하여 반환 (매장급 관리자 및 전용 단말기)
    store_info = None
    if user.store and user.role in ['store_admin', 'store_manager', 'store_reception', 'store_board', 'store_mobile']:
        # 소속된 매장 정보를 함께 반환
        store_info = {
            "id": user.store.id,
            "name": user.store.name,
            "code": user.store.code
        }
    # 프랜차이즈 관리자는 store_info를 None으로 유지 (프론트엔드에서 매장 선택)

    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "store": store_info,
        "role": user.role,
        "username": user.username
    }


from sse_manager import sse_manager

@router.post("/logout")
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user)
):
    """로그아웃
    
    1. SSE 세션 정리
    2. 쿠키 삭제
    """
    # SSE 세션 강제 종료
    if current_user:
        await sse_manager.disconnect_user(current_user.id)

    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=False,
        samesite="lax"
    )
    return {"message": "로그아웃 되었습니다"}


@router.get("/me", response_model=UserSchema)
async def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회

    Returns:
        User: 현재 사용자 정보
    """
    return current_user


@router.get("/check")
async def check_auth(current_user: User = Depends(get_current_user)):
    """인증 상태 확인 (프론트엔드용)

    Returns:
        dict: 인증 여부 및 사용자 정보
    """
    return {
        "authenticated": True,
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role,
            "store_id": current_user.store_id,
            "franchise_id": current_user.franchise_id
        }
    }
