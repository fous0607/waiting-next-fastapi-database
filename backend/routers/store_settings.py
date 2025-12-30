from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, defer
from sqlalchemy.exc import OperationalError, ProgrammingError
from datetime import time
from typing import Optional
from fastapi import Request

from database import get_db
from models import StoreSettings, Store, User
from schemas import (
    StoreSettings as StoreSettingsSchema,
    StoreSettingsCreate,
    StoreSettingsUpdate
)
from auth import get_current_user, get_current_store

router = APIRouter()

@router.post("/", response_model=StoreSettingsSchema)
async def create_store_settings(
    settings: StoreSettingsCreate,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """매장 설정 생성"""
    # 기존 설정이 있는지 확인 (매장별)
    existing = db.query(StoreSettings).filter(
        StoreSettings.store_id == current_store.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="매장 설정이 이미 존재합니다.")

    db_settings = StoreSettings(**settings.dict(), store_id=current_store.id)
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)

    return db_settings

@router.get("", response_model=StoreSettingsSchema)
async def get_store_settings(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """매장 설정 조회"""
    try:
        settings = db.query(StoreSettings).filter(
            StoreSettings.store_id == current_store.id
        ).first()
    except (OperationalError, ProgrammingError):
        # Fallback if new column hasn't been migrated yet
        db.rollback()
        settings = db.query(StoreSettings).options(
            defer(StoreSettings.enable_franchise_monitoring),
            defer(StoreSettings.manager_button_size),
            defer(StoreSettings.waiting_manager_max_width),
            defer(StoreSettings.waiting_list_box_size),
            
            # Additional deferred fields to prevent 500 error if DB is outdated
            defer(StoreSettings.waiting_modal_timeout),
            defer(StoreSettings.show_member_name_in_waiting_modal),
            defer(StoreSettings.show_new_member_text_in_waiting_modal),
            defer(StoreSettings.enable_waiting_voice_alert),
            defer(StoreSettings.enable_calling_voice_alert),
            defer(StoreSettings.waiting_voice_message),
            defer(StoreSettings.waiting_voice_name),
            defer(StoreSettings.waiting_voice_rate),
            defer(StoreSettings.waiting_voice_pitch),
            defer(StoreSettings.waiting_board_page_size),
            defer(StoreSettings.waiting_board_rotation_interval),
            defer(StoreSettings.waiting_board_transition_effect),
            defer(StoreSettings.theme),
            defer(StoreSettings.default_class_minute),
            defer(StoreSettings.default_break_minute),
            defer(StoreSettings.default_max_capacity),
            defer(StoreSettings.require_member_registration),
            defer(StoreSettings.registration_message),
            defer(StoreSettings.max_dashboard_connections),
            defer(StoreSettings.dashboard_connection_policy),
            defer(StoreSettings.dashboard_connection_policy),
            defer(StoreSettings.sequential_closing),
            defer(StoreSettings.enable_revisit_badge),
            defer(StoreSettings.revisit_period_days),
            defer(StoreSettings.revisit_badge_style),
            defer(StoreSettings.business_start_time),
            defer(StoreSettings.business_end_time),
            defer(StoreSettings.enable_break_time),
            defer(StoreSettings.break_start_time),
            defer(StoreSettings.break_end_time),
            defer(StoreSettings.operation_type)
        ).filter(
            StoreSettings.store_id == current_store.id
        ).first()

        # Manually set the deferred field ONLY if they are not already set/available
        # This prevents overwriting actual DB values with defaults every time
        if settings:
            def set_default(obj, field, default_val):
                try:
                    val = getattr(obj, field)
                    if val is None:
                        setattr(obj, field, default_val)
                except (AttributeError, Exception):
                    setattr(obj, field, default_val)

            set_default(settings, 'enable_franchise_monitoring', False)
            set_default(settings, 'manager_button_size', "medium")
            set_default(settings, 'waiting_manager_max_width', None)
            set_default(settings, 'waiting_list_box_size', "medium")
            set_default(settings, 'waiting_modal_timeout', 5)
            set_default(settings, 'show_member_name_in_waiting_modal', True)
            set_default(settings, 'show_new_member_text_in_waiting_modal', True)
            set_default(settings, 'enable_waiting_voice_alert', False)
            set_default(settings, 'enable_calling_voice_alert', True)
            set_default(settings, 'waiting_voice_message', "")
            set_default(settings, 'waiting_voice_name', "유나")
            set_default(settings, 'waiting_voice_rate', 0.8)
            set_default(settings, 'waiting_voice_pitch', 1.0)
            set_default(settings, 'waiting_call_voice_repeat_count', 1)
            set_default(settings, 'enable_duplicate_registration_voice', False)
            set_default(settings, 'duplicate_registration_voice_message', "이미 대기 중인 번호입니다.")
            set_default(settings, 'calling_status_display_second', 60)
            set_default(settings, 'waiting_board_page_size', 12)
            set_default(settings, 'waiting_board_rotation_interval', 5)
            set_default(settings, 'waiting_board_transition_effect', "slide")
            set_default(settings, 'theme', "zinc")
            set_default(settings, 'default_class_minute', 50)
            set_default(settings, 'default_break_minute', 10)
            set_default(settings, 'default_max_capacity', 10)
            set_default(settings, 'require_member_registration', False)
            set_default(settings, 'registration_message', "처음 방문하셨네요!\n성함을 입력해 주세요.")
            set_default(settings, 'max_dashboard_connections', 2)
            set_default(settings, 'dashboard_connection_policy', "eject_old")
            set_default(settings, 'sequential_closing', False)
            set_default(settings, 'enable_revisit_badge', False)
            set_default(settings, 'revisit_period_days', 0)
            set_default(settings, 'revisit_badge_style', "indigo_solid")
            set_default(settings, 'business_start_time', time(9, 0))
            set_default(settings, 'business_end_time', time(22, 0))
            set_default(settings, 'enable_break_time', False)
            set_default(settings, 'break_start_time', time(12, 0))
            set_default(settings, 'break_end_time', time(13, 0))
            set_default(settings, 'operation_type', 'general')

    if not settings:
        # 기본 설정 생성
        default_settings = StoreSettings(
            store_id=current_store.id,
            store_name=current_store.name,
            display_classes_count=3,
            list_direction="vertical",
            rows_per_class=1,
            admin_password="1234",
            max_waiting_limit=50,
            use_max_waiting_limit=True,
            block_last_class_registration=False,
            show_waiting_number=True,
            mask_customer_name=False,
            show_order_number=True,

            board_display_order="number,name,order",
            attendance_count_type="days",
            attendance_lookback_days=30
        )
        db.add(default_settings)
        db.commit()
        db.refresh(default_settings)
        # Inject store code for frontend usage
        default_settings.store_code = current_store.code
        return default_settings

    # Inject store code for frontend usage
    settings.store_code = current_store.code
    return settings

@router.put("", response_model=StoreSettingsSchema)
async def update_store_settings(
    settings: StoreSettingsUpdate,
    request: Request,
    current_store: Store = Depends(get_current_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """매장 설정 수정"""
    db_settings = db.query(StoreSettings).filter(
        StoreSettings.store_id == current_store.id
    ).first()

    if not db_settings:
        raise HTTPException(status_code=404, detail="매장 설정을 찾을 수 없습니다.")

    # 1. Capture Old State (for Audit Log)
    # We convert SQLAlchemy model to dict manually to be safe
    old_state = {c.name: getattr(db_settings, c.name) for c in db_settings.__table__.columns}
    
    # Remove metadata fields if desired, or keep all
    if 'created_at' in old_state: del old_state['created_at']
    if 'updated_at' in old_state: del old_state['updated_at']

    # 2. Update Logic
    # 업데이트할 필드만 수정
    update_data = settings.dict(exclude_unset=True)
    
    # 1차 시도: 모든 필드 업데이트
    for field, value in update_data.items():
        setattr(db_settings, field, value)

    try:
        db.commit()
        db.refresh(db_settings)
        
        # 3. Log Audit
        from services.audit_service import AuditService
        
        # New State
        new_state = {c.name: getattr(db_settings, c.name) for c in db_settings.__table__.columns}
        if 'created_at' in new_state: del new_state['created_at']
        if 'updated_at' in new_state: del new_state['updated_at']
        
        AuditService.log(
            db=db,
            action="update_settings",
            target_type="store_settings",
            target_id=db_settings.id,
            user_id=current_user.id,
            store_id=current_store.id,
            old_value=old_state,
            new_value=new_state,
            ip_address=request.client.host
        )
        
    except (OperationalError, ProgrammingError):
        # 컬럼이 없어서 실패한 경우 (마이그레이션 미적용)
        db.rollback()
        
        try:
            # 2차 시도: 자동 마이그레이션 실행 후 재시도
            from core.db_auto_migrator import check_and_migrate_table
            check_and_migrate_table(StoreSettings)
            
            # 다시 객체 조회 및 업데이트
            db_settings = db.query(StoreSettings).filter(
                StoreSettings.store_id == current_store.id
            ).first()
            
            for field, value in update_data.items():
                setattr(db_settings, field, value)
                
            db.commit()
            db.refresh(db_settings)
            
            # (Optional) Log Audit here too if second try succeeds, but let's keep it simple for now or copy logic
            
        except Exception as migrate_error:
            # 3차 시도: 최후의 수단으로 안전한 필드만 업데이트 (Fallback)
            # 여기서는 마이그레이션 실패 시 에러를 무시하고 진행
            db.rollback()
            db_settings = db.query(StoreSettings).filter(
                StoreSettings.store_id == current_store.id
            ).first()
            
            # 문제되는 새 컬럼들을 제외하고 업데이트 하되,
            # 특정 필드들이 db_settings 객체에 존재한다면(마이그레이션 성공 시) 업데이트에 포함
            for field, value in update_data.items():
                if hasattr(db_settings, field):
                    setattr(db_settings, field, value)
                
            db.commit()
            db.refresh(db_settings)
            
            # Log Audit for Fallback Update
            from services.audit_service import AuditService
            AuditService.log(
                db=db,
                action="update_settings_fallback",
                target_type="store_settings",
                target_id=db_settings.id,
                user_id=current_user.id,
                store_id=current_store.id,
                old_value=old_state,
                new_value={"note": "Update performed with hasattr check"},
                ip_address=request.client.host
            )

    return db_settings

@router.post("/verify-password")
async def verify_password(
    password: str,
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """관리자 비밀번호 확인"""
    settings = db.query(StoreSettings).filter(
        StoreSettings.store_id == current_store.id
    ).first()

    if not settings:
        raise HTTPException(status_code=404, detail="매장 설정을 찾을 수 없습니다.")

    if settings.admin_password != password:
        raise HTTPException(status_code=401, detail="비밀번호가 일치하지 않습니다.")

    return {"message": "인증 성공", "verified": True}


@router.get("/sse-status")
async def get_sse_status(
    current_store: Store = Depends(get_current_store),
    db: Session = Depends(get_db)
):
    """SSE 연결 활성화 상태 조회"""
    settings = db.query(StoreSettings).filter(
        StoreSettings.store_id == current_store.id
    ).first()
    
    return {
        "enable_waiting_board": settings.enable_waiting_board if settings else True,
        "enable_reception_desk": settings.enable_reception_desk if settings else True
    }


@router.post("/clone/{source_store_id}", response_model=StoreSettingsSchema)
async def clone_store_settings(
    source_store_id: int,
    current_store: Store = Depends(get_current_store),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """다른 매장의 설정 복제

    Args:
        source_store_id: 복제할 원본 매장의 ID

    Returns:
        복제된 현재 매장의 설정
    """
    # 원본 매장 조회
    source_store = db.query(Store).filter(Store.id == source_store_id).first()

    if not source_store:
        raise HTTPException(status_code=404, detail="원본 매장을 찾을 수 없습니다.")

    # 같은 프랜차이즈 소속인지 확인
    if source_store.franchise_id != current_store.franchise_id:
        raise HTTPException(
            status_code=403,
            detail="같은 프랜차이즈 소속 매장만 복제할 수 있습니다."
        )

    # 자기 자신을 복제하려는 경우
    if source_store_id == current_store.id:
        raise HTTPException(
            status_code=400,
            detail="같은 매장의 설정은 복제할 수 없습니다."
        )

    # 원본 매장의 설정 조회
    source_settings = db.query(StoreSettings).filter(
        StoreSettings.store_id == source_store_id
    ).first()

    if not source_settings:
        raise HTTPException(
            status_code=404,
            detail="원본 매장의 설정을 찾을 수 없습니다."
        )

    # 현재 매장의 기존 설정 조회
    target_settings = db.query(StoreSettings).filter(
        StoreSettings.store_id == current_store.id
    ).first()

    # 복제할 데이터 준비 (store_id, id 제외)
    settings_data = {
        "store_name": current_store.name,  # 현재 매장 이름 유지
        "display_classes_count": source_settings.display_classes_count,
        "list_direction": source_settings.list_direction,
        "rows_per_class": source_settings.rows_per_class,
        "admin_password": source_settings.admin_password,
        "max_waiting_limit": source_settings.max_waiting_limit,
        "use_max_waiting_limit": source_settings.use_max_waiting_limit,
        "block_last_class_registration": source_settings.block_last_class_registration,
        "auto_register_member": source_settings.auto_register_member,
        "require_member_registration": source_settings.require_member_registration,
        "business_day_start": source_settings.business_day_start,
        "auto_closing": source_settings.auto_closing,
        "closing_action": source_settings.closing_action,
        
        # 출석 횟수 표시 설정
        "attendance_count_type": source_settings.attendance_count_type,
        "attendance_lookback_days": source_settings.attendance_lookback_days,

        # 대기현황판 표시 설정
        "show_waiting_number": source_settings.show_waiting_number,
        "mask_customer_name": source_settings.mask_customer_name,
        "name_display_length": source_settings.name_display_length,
        "show_order_number": source_settings.show_order_number,
        "board_display_order": source_settings.board_display_order,
        
        # 폰트 및 스타일 설정
        "manager_font_family": source_settings.manager_font_family,
        "manager_font_size": source_settings.manager_font_size,
        "board_font_family": source_settings.board_font_family,
        "board_font_size": source_settings.board_font_size,
        "waiting_manager_max_width": source_settings.waiting_manager_max_width,
        
        # 대기접수 키패드 설정
        "keypad_style": source_settings.keypad_style,
        "keypad_font_size": source_settings.keypad_font_size,
        
        # 개점 설정
        "daily_opening_rule": source_settings.daily_opening_rule,
        
        # 대기접수 완료 모달 설정
        "waiting_modal_timeout": source_settings.waiting_modal_timeout,
        "waiting_voice_rate": source_settings.waiting_voice_rate,
        "waiting_voice_pitch": source_settings.waiting_voice_pitch,
        "waiting_call_voice_repeat_count": source_settings.waiting_call_voice_repeat_count,
        "enable_duplicate_registration_voice": source_settings.enable_duplicate_registration_voice,
        "duplicate_registration_voice_message": source_settings.duplicate_registration_voice_message,
        "calling_status_display_second": source_settings.calling_status_display_second,
        
        # 대기관리자 화면 레이아웃 설정
        "waiting_list_box_size": source_settings.waiting_list_box_size,
        
        # SSE 트래픽 관리 설정
        "enable_waiting_board": source_settings.enable_waiting_board,
        "enable_reception_desk": source_settings.enable_reception_desk,
        
        # 프랜차이즈 모니터링 (이미 제거됨, but keeping code clean means ignore/remove if present in dict, but DB model has it)
        # Note: We removed it from UI, but model still has it. Currently defer/migrated logic handles it. 
        # We can copy it or skip it. Let's copy it to be safe in case it's used backend-side.
        # Note: We removed it from UI, but model still has it. Currently defer/migrated logic handles it. 
        # We can copy it or skip it. Let's copy it to be safe in case it's used backend-side.
        "enable_franchise_monitoring": source_settings.enable_franchise_monitoring,
        "sequential_closing": source_settings.sequential_closing,
        
        # 대기자 재방문 설정
        "enable_revisit_badge": source_settings.enable_revisit_badge,
        "revisit_period_days": source_settings.revisit_period_days,
        "revisit_badge_style": source_settings.revisit_badge_style
    }

    if target_settings:
        # 기존 설정이 있으면 업데이트
        for field, value in settings_data.items():
            setattr(target_settings, field, value)
    else:
        # 기존 설정이 없으면 새로 생성
        new_settings = StoreSettings(
            store_id=current_store.id,
            **settings_data
        )
        db.add(new_settings)
    
    # 클래스 정보 복제 (메인 설정 복제에서는 클래스도 같이 복제하는 기존 로직 유지)
    from models import ClassInfo
    
    # 1. 기존 클래스 삭제
    db.query(ClassInfo).filter(ClassInfo.store_id == current_store.id).delete()
    
    # 2. 원본 매장의 클래스 조회
    source_classes = db.query(ClassInfo).filter(ClassInfo.store_id == source_store_id).all()
    
    # 3. 클래스 복사
    for source_class in source_classes:
        new_class = ClassInfo(
            store_id=current_store.id,
            class_number=source_class.class_number,
            class_name=source_class.class_name,
            start_time=source_class.start_time,
            end_time=source_class.end_time,
            max_capacity=source_class.max_capacity,
            is_active=source_class.is_active,
            weekday_schedule=source_class.weekday_schedule,
            class_type=source_class.class_type
        )
        db.add(new_class)

    db.commit()
    
    if target_settings:
        db.refresh(target_settings)
        return target_settings
    else:
        db.refresh(new_settings)
        return new_settings


# New endpoints for advanced settings
from pydantic import BaseModel
from typing import List

class CloneRequest(BaseModel):
    source_store_id: int

@router.get("/all")
async def get_all_stores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all stores accessible to the current user"""
    # If system admin, return all stores
    if current_user.role == "system_admin":
        stores = db.query(Store).filter(Store.is_active == True).all()
    # If franchise admin/manager, return stores in their franchise
    elif current_user.franchise_id:
        stores = db.query(Store).filter(
            Store.franchise_id == current_user.franchise_id,
            Store.is_active == True
        ).all()
    else:
        # Store admin can only see their own store
        stores = db.query(Store).filter(
            Store.id == current_user.store_id,
            Store.is_active == True
        ).all()
    
    return [{"id": s.id, "name": s.name, "code": s.code} for s in stores]


@router.post("/{target_store_id}/clone-settings")
async def clone_settings_to_target(
    target_store_id: int,
    request: CloneRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clone settings from source store to target store"""
    source_store_id = request.source_store_id
    
    # Get source and target stores
    source_store = db.query(Store).filter(Store.id == source_store_id).first()
    target_store = db.query(Store).filter(Store.id == target_store_id).first()
    
    if not source_store or not target_store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
    
    # Check permissions
    if current_user.role not in ["system_admin", "franchise_admin", "franchise_manager"]:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    
    # Get source settings
    source_settings = db.query(StoreSettings).filter(
        StoreSettings.store_id == source_store_id
    ).first()
    
    if not source_settings:
        raise HTTPException(status_code=404, detail="원본 매장의 설정을 찾을 수 없습니다.")
    
    # Get or create target settings
    target_settings = db.query(StoreSettings).filter(
        StoreSettings.store_id == target_store_id
    ).first()
    
    # Copy all settings except ID and store-specific fields
    settings_dict = {
        "store_id": target_store_id,
        "store_name": target_store.name,  # Keep target store name
        "admin_password": target_settings.admin_password if target_settings else "0000",  # Keep target password
    }
    
    # Copy all other fields
    for column in StoreSettings.__table__.columns:
        if column.name not in ['id', 'store_id', 'store_name', 'admin_password', 'created_at', 'updated_at']:
            settings_dict[column.name] = getattr(source_settings, column.name)
    
    if target_settings:
        # Update existing settings
        for key, value in settings_dict.items():
            if key not in ['store_id']:
                setattr(target_settings, key, value)
    else:
        # Create new settings
        target_settings = StoreSettings(**settings_dict)
        db.add(target_settings)
    
    db.commit()
    db.refresh(target_settings)
    
    return {"message": "매장 설정이 성공적으로 복제되었습니다."}


@router.post("/{target_store_id}/clone-classes")
async def clone_classes_to_target(
    target_store_id: int,
    request: CloneRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clone classes from source store to target store"""
    from models import ClassInfo
    
    source_store_id = request.source_store_id
    
    # Get source and target stores
    source_store = db.query(Store).filter(Store.id == source_store_id).first()
    target_store = db.query(Store).filter(Store.id == target_store_id).first()
    
    if not source_store or not target_store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")
    
    # Check permissions
    if current_user.role not in ["system_admin", "franchise_admin", "franchise_manager"]:
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    
    # Delete existing classes in target store
    db.query(ClassInfo).filter(ClassInfo.store_id == target_store_id).delete()
    
    # Get source classes
    source_classes = db.query(ClassInfo).filter(ClassInfo.store_id == source_store_id).all()
    
    # Clone each class
    for source_class in source_classes:
        new_class = ClassInfo(
            store_id=target_store_id,
            class_number=source_class.class_number,
            class_name=source_class.class_name,
            start_time=source_class.start_time,
            end_time=source_class.end_time,
            max_capacity=source_class.max_capacity,
            is_active=source_class.is_active,
            weekday_schedule=source_class.weekday_schedule,
            class_type=source_class.class_type
        )
        db.add(new_class)
    
    db.commit()
    
    return {"message": f"{len(source_classes)}개의 클래스가 성공적으로 복제되었습니다."}


