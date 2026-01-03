"""
인증 유틸리티
- 비밀번호 해싱 및 검증
- JWT 토큰 생성 및 검증
- 현재 사용자 가져오기 (dependency)
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Cookie, Request, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from database import get_db
from models import User, Store
from schemas import TokenData

# 설정
SECRET_KEY = "your-secret-key-change-this-in-production-123456789"  # 실제 환경에서는 환경변수로 관리
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

# OAuth2 (선택적 토큰, 쿠키도 지원)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """비밀번호 해싱"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """JWT 액세스 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """JWT 토큰 디코딩"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return TokenData(username=username)
    except JWTError:
        return None


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    access_token: Optional[str] = Cookie(None),
    token_query: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db)
) -> User:
    """현재 로그인한 사용자 가져오기

    Args (토큰 우선순위):
        1. Authorization 헤더의 Bearer 토큰
        2. Cookie의 access_token
        3. Query Parameter의 token (SSE용)

    Raises:
        HTTPException: 인증 실패 시
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증이 필요합니다",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 토큰 가져오기 (Authorization 헤더 우선, 그 다음 쿠키, 마지막으로 쿼리 파라미터)
    token_to_use = token if token else (access_token if access_token else token_query)
    
    import logging
    logger = logging.getLogger(__name__)

    # Log only important events
    # logger.info(f"[Auth] Token to use: {token_to_use[:20] if token_to_use else 'None'}...")
    
    if not token_to_use:
        # logger.error("[Auth] No token provided")
        raise credentials_exception

    # 토큰 디코딩
    token_data = decode_access_token(token_to_use)
    if token_data is None or token_data.username is None:
        logger.warning(f"[Auth] Token decode failed")
        raise credentials_exception

    # 사용자 조회
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        logger.warning(f"[Auth] User not found: {token_data.username}")
        raise credentials_exception

    if not user.is_active:
        logger.warning(f"[Auth] User is inactive: {token_data.username}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 사용자입니다"
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """현재 활성화된 사용자 가져오기"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 사용자입니다"
        )
    return current_user


async def require_franchise_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """프랜차이즈 관리자(최종/중간) 또는 시스템 관리자 권한 필요"""
    if current_user.role not in ["franchise_admin", "system_admin", "franchise_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="프랜차이즈 관리자 권한이 필요합니다"
        )
    return current_user


async def require_system_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """시스템 관리자 권한 필요 (최상위 관리자)"""
    if current_user.role != "system_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="시스템 관리자 권한이 필요합니다"
        )
    return current_user


async def get_current_store(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    store_id: int = None,
    request: Request = None
) -> Store:
    """현재 사용자의 매장 가져오기

    - franchise_admin: 매장 선택 필요 (헤더, 쿼리 파라미터, 또는 첫 번째 매장)
    - franchise_manager: 관리 권한이 있는 매장 중에서만 선택 가능
    - store_admin: 자신의 매장 자동 반환
    """
    if current_user.role in ["store_admin", "store_reception", "store_board", "store_owner"]:
        if not current_user.store_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="매장 정보가 없습니다"
            )

        try:
            store = db.query(Store).filter(Store.id == current_user.store_id).first()
        except Exception:
            db.rollback()
            try:
                from core.db_auto_migrator import check_and_migrate_table
                check_and_migrate_table(Store)
                store = db.query(Store).filter(Store.id == current_user.store_id).first()
            except Exception:
                store = None

        if not store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="매장을 찾을 수 없습니다"
            )
        return store

    # system_admin은 모든 매장 접근 가능 (활성화 상태 무관)
    if current_user.role == "system_admin":
        selected_store_id_raw = store_id
        
        if not selected_store_id_raw and request:
            # X-Store-Id 헤더에서 가져오기
            selected_store_id_raw = request.headers.get('X-Store-Id')
        
        if selected_store_id_raw:
            # 1. 시도: 숫자 ID로 조회
            try:
                sid = int(selected_store_id_raw)
                store = db.query(Store).filter(Store.id == sid).first()
                if store:
                    return store
            except (ValueError, TypeError):
                # 2. 시도: 매장 코드로 조회
                store = db.query(Store).filter(Store.code == str(selected_store_id_raw)).first()
                if store:
                    return store
        
        # 기본값: 첫 번째 매장 (활성화 상태 무관)
        store = db.query(Store).first()
        if not store:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="매장이 없습니다"
            )
        return store

    # franchise_admin 또는 franchise_manager인 경우
    selected_store_id_raw = store_id

    if not selected_store_id_raw and request:
        # X-Store-Id 헤더에서 가져오기
        selected_store_id_raw = request.headers.get('X-Store-Id')

    if selected_store_id_raw:
        # 1. 시도: 숫자 ID로 조회
        resolved_store = None
        try:
            sid = int(selected_store_id_raw)
            resolved_store = db.query(Store).filter(
                Store.id == sid,
                Store.franchise_id == current_user.franchise_id
            ).first()
        except (ValueError, TypeError):
            # 2. 시도: 매장 코드로 조회
            resolved_store = db.query(Store).filter(
                Store.code == str(selected_store_id_raw),
                Store.franchise_id == current_user.franchise_id
            ).first()

        if resolved_store:
            # franchise_manager 권한 검증
            if current_user.role == 'franchise_manager':
                managed_ids = [s.id for s in current_user.managed_stores]
                if resolved_store.id not in managed_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="해당 매장에 대한 접근 권한이 없습니다"
                    )
            return resolved_store

    # 기본값 처리 (선택된 매장이 없거나 잘못된 경우)
    if current_user.role == 'franchise_manager':
        # 첫 번째 관리 매장
        if current_user.managed_stores:
            return current_user.managed_stores[0]
        else:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="관리할 수 있는 매장이 없습니다"
            )
            
    # franchise_admin: 프랜차이즈의 첫 번째 활성 매장
    store = db.query(Store).filter(
        Store.franchise_id == current_user.franchise_id,
        Store.is_active == True
    ).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="활성화된 매장이 없습니다"
        )
    return store


def require_store_access(store_id: int):
    """특정 매장 접근 권한 체크"""
    async def check_access(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        # franchise_admin은 모든 매장 접근 가능
        if current_user.role == "franchise_admin":
            return current_user
        
        # franchise_manager는 관리 매장만 접근 가능
        if current_user.role == "franchise_manager":
             managed_ids = [s.id for s in current_user.managed_stores]
             if store_id not in managed_ids:
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="해당 매장에 대한 권한이 없습니다"
                )
             return current_user

        # store_admin은 자신의 매장만 접근 가능
        if current_user.role in ["store_admin", "store_reception", "store_board", "store_owner"]:
            if current_user.store_id != store_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="해당 매장에 대한 권한이 없습니다"
                )
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다"
        )

    return check_access
