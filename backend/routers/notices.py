from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Notice, User, Store, notice_stores
from schemas import NoticeCreate, NoticeResponse
from auth import get_current_active_user

router = APIRouter(
    prefix="/api/notices",
    tags=["notices"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=NoticeResponse)
def create_notice(
    notice: NoticeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in ["system_admin", "franchise_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_notice = Notice(
        title=notice.title,
        content=notice.content,
        target_type=notice.target_type,
        is_active=notice.is_active,
        author_id=current_user.id
    )
    
    if notice.target_type == "selected" and notice.target_store_ids:
        # Fetch stores
        stores = db.query(Store).filter(Store.id.in_(notice.target_store_ids)).all()
        db_notice.target_stores = stores
        
    db.add(db_notice)
    db.commit()
    db.refresh(db_notice)
    
    # Response Construction
    return NoticeResponse(
        id=db_notice.id,
        title=db_notice.title,
        content=db_notice.content,
        target_type=db_notice.target_type,
        created_at=db_notice.created_at,
        author_name=current_user.username
    )

@router.get("/", response_model=List[NoticeResponse])
def get_all_notices(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Only superadmin sees ALL (or maybe filter my own?)
    # For now return all
    from sqlalchemy.orm import joinedload
    
    notices = db.query(Notice).options(
        joinedload(Notice.author)
    ).order_by(Notice.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        NoticeResponse(
            id=n.id,
            title=n.title,
            content=n.content,
            target_type=n.target_type,
            created_at=n.created_at,
            author_name=n.author.username if n.author else "System"
        ) for n in notices
    ]

@router.get("/store", response_model=List[NoticeResponse])
def get_store_notices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """매장 관리자/직원이 볼 수 있는 공지사항 조회
    
    포함되는 공지:
    - target_type='all': 전체 매장 공지
    - target_type='selected': 해당 매장이 선택된 공지
    - target_type='franchise': 해당 매장의 프랜차이즈 공지
    - target_type='program': 프로그램 공지 (매장 설정에서 활성화된 경우)
    """
    if not current_user.store_id:
        return []
        
    store_id = current_user.store_id
    
    from sqlalchemy.orm import joinedload
    from models import StoreSettings
    
    # 매장 정보 조회
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        return []
    
    # 매장 설정 조회 (프로그램 공지 표시 여부)
    store_settings = db.query(StoreSettings).filter(StoreSettings.store_id == store_id).first()
    show_program_notices = True  # 기본값: 표시
    if store_settings and hasattr(store_settings, 'show_program_notices'):
        show_program_notices = store_settings.show_program_notices
    
    notices = []
    
    # 1. 전체 매장 공지 (target_type='all')
    global_notices = db.query(Notice).options(
        joinedload(Notice.author),
        joinedload(Notice.franchise)
    ).filter(Notice.target_type == 'all', Notice.is_active == True).all()
    notices.extend(global_notices)
    
    # 2. 선택된 매장 공지 (target_type='selected')
    targeted_notices = db.query(Notice).options(
        joinedload(Notice.author),
        joinedload(Notice.franchise)
    ).join(Notice.target_stores).filter(
        Store.id == store_id, 
        Notice.is_active == True
    ).all()
    notices.extend(targeted_notices)
    
    # 3. 프랜차이즈 공지 (target_type='franchise')
    if store.franchise_id:
        franchise_notices = db.query(Notice).options(
            joinedload(Notice.author),
            joinedload(Notice.franchise)
        ).filter(
            Notice.target_type == 'franchise',
            Notice.franchise_id == store.franchise_id,
            Notice.is_active == True
        ).all()
        notices.extend(franchise_notices)
    
    # 4. 프로그램 공지 (target_type='program', 설정에 따라)
    if show_program_notices and store.franchise_id:
        program_notices = db.query(Notice).options(
            joinedload(Notice.author),
            joinedload(Notice.franchise)
        ).filter(
            Notice.target_type == 'program',
            Notice.franchise_id == store.franchise_id,
            Notice.is_active == True
        ).all()
        notices.extend(program_notices)
    
    # 중복 제거 및 정렬
    unique_notices = {n.id: n for n in notices}.values()
    sorted_notices = sorted(unique_notices, key=lambda x: x.created_at, reverse=True)
    
    return [
        NoticeResponse(
            id=n.id,
            title=n.title,
            content=n.content,
            target_type=n.target_type,
            created_at=n.created_at,
            author_name=n.author.username if n.author else "System"
        ) for n in sorted_notices
    ]
