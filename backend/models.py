from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Date, Time, Table, Float, func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, date, time

# M:N 관계를 위한 연결 테이블
user_stores = Table('user_stores', Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('store_id', Integer, ForeignKey('store.id'))
)

# Notice Target Stores Association
notice_stores = Table('notice_stores', Base.metadata,
    Column('notice_id', Integer, ForeignKey('notices.id')),
    Column('store_id', Integer, ForeignKey('store.id'))
)

class Franchise(Base):
    """프랜차이즈"""
    __tablename__ = "franchise"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # 프랜차이즈명
    code = Column(String, unique=True, nullable=False, index=True)  # 프랜차이즈 코드
    member_type = Column(String, default="store")  # store: 매장별 관리, franchise: 프랜차이즈 통합 관리
    is_active = Column(Boolean, default=True)  # 활성화 여부
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 관계 설정
    stores = relationship("Store", back_populates="franchise")
    users = relationship("User", back_populates="franchise", foreign_keys="User.franchise_id")

class Holiday(Base):
    """공휴일 정보"""
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)  # 공휴일 날짜
    name = Column(String, nullable=False)  # 공휴일 명칭 (예: 크리스마스, 임시공휴일)
    created_at = Column(DateTime, default=func.now())

    # 관계 설정
    store = relationship("Store", back_populates="holidays")

class Store(Base):
    """매장"""
    __tablename__ = "store"

    id = Column(Integer, primary_key=True, index=True)
    franchise_id = Column(Integer, ForeignKey("franchise.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # 매장명
    code = Column(String, unique=True, nullable=False, index=True)  # 매장 코드
    is_active = Column(Boolean, default=True)  # 활성화 여부
    last_heartbeat = Column(DateTime, nullable=True)  # 마지막 활동 시간 (Health check)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 관계 설정
    franchise = relationship("Franchise", back_populates="stores")
    users = relationship("User", back_populates="store", foreign_keys="User.store_id")
    store_settings = relationship("StoreSettings", back_populates="store")
    daily_closings = relationship("DailyClosing", back_populates="store")
    classes = relationship("ClassInfo", back_populates="store")
    members = relationship("Member", back_populates="store")
    waiting_list = relationship("WaitingList", back_populates="store")
    holidays = relationship("Holiday", back_populates="store")
    
    # New relationship for Multi-Store Managers
    managers = relationship("User", secondary=user_stores, back_populates="managed_stores")

class User(Base):
    """사용자 (인증)"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)  # 로그인 ID
    password_hash = Column(String, nullable=False)  # 비밀번호 해시
    role = Column(String, nullable=False)  # system_admin, franchise_admin, store_admin, franchise_manager, store_owner
    franchise_id = Column(Integer, ForeignKey("franchise.id"), nullable=True, index=True)  # 프랜차이즈 관리자인 경우
    store_id = Column(Integer, ForeignKey("store.id"), nullable=True, index=True)  # 매장 관리자인 경우 relative
    is_active = Column(Boolean, default=True)  # 활성화 여부
    last_login = Column(DateTime, nullable=True)  # 마지막 로그인 시간
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 관계 설정
    franchise = relationship("Franchise", back_populates="users", foreign_keys=[franchise_id])
    store = relationship("Store", back_populates="users", foreign_keys=[store_id])
    
    # New relationship for Multi-Store Managers
    managed_stores = relationship("Store", secondary=user_stores, back_populates="managers")

class StoreSettings(Base):
    """매장 설정"""
    __tablename__ = "store_settings"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)  # 매장 ID
    store_name = Column(String, nullable=False)
    display_classes_count = Column(Integer, default=3)  # 대기현황판에 보여줄 클래스 수
    list_direction = Column(String, default="vertical")  # vertical or horizontal
    rows_per_class = Column(Integer, default=1)  # 클래스당 줄 수
    admin_password = Column(String, default="1234")
    max_waiting_limit = Column(Integer, default=50)  # 최대 대기 등록 제한 (0 = 무제한)
    use_max_waiting_limit = Column(Boolean, default=True)  # 최대 대기 인원 제한 사용 여부
    block_last_class_registration = Column(Boolean, default=False)  # 마지막 교시 정원 초과 시 대기접수 차단
    auto_register_member = Column(Boolean, default=False)  # 대기 등록 시 자동 회원가입
    require_member_registration = Column(Boolean, default=False)  # 대기 등록 시 회원가입 필수 (프론트에서 이름 입력 화면 표시)
    registration_message = Column(String, default="처음 방문하셨네요!\n성함을 입력해 주세요.") # 신규 회원 등록 화면 문구
    business_day_start = Column(Integer, default=7)  # 영업일 기준 시간 (0~23)
    auto_closing = Column(Boolean, default=True)  # 영업일 변경 시 자동 마감 및 리셋 여부 (False: 대기자 이월)
    closing_action = Column(String, default="reset") # 자동 마감 시 미처리 대기자 처리 방식 ('reset' or 'attended')
    
    # 출석 횟수 표시 설정
    attendance_count_type = Column(String, default="days")  # 'days': 최근 N일, 'monthly': 이번 달
    attendance_lookback_days = Column(Integer, default=30)  # N일 (기본 30일)

    # 대기현황판 표시 설정
    show_waiting_number = Column(Boolean, default=True)  # 대기번호 표시 유무
    mask_customer_name = Column(Boolean, default=False)  # 이름 마스킹 (홍O동)
    name_display_length = Column(Integer, default=0)  # 이름 표시 자릿수 (0 = 전체 표시)
    show_order_number = Column(Boolean, default=True)  # 순번(1번째) 표시 유무
    board_display_order = Column(String, default="number,name,order")  # 표시 순서
    
    # 페이지네이션 설정
    waiting_board_page_size = Column(Integer, default=12)  # 대기현황판 페이지 당 표시 개수
    waiting_board_rotation_interval = Column(Integer, default=5)  # 대기현황판 페이지 회전 간격 (초)
    waiting_board_transition_effect = Column(String, default="slide")  # 대기현황판 페이지 전환 효과 (slide, fade, scale, none)
    
    # 폰트 설정
    manager_font_family = Column(String, default="Nanum Gothic")
    manager_font_size = Column(String, default="15px")
    board_font_family = Column(String, default="Nanum Gothic")
    board_font_size = Column(String, default="24px")
    
    # 대기접수 키패드 설정
    keypad_style = Column(String, default="modern")  # modern, bold, dark, colorful
    keypad_font_size = Column(String, default="large")  # small, medium, large, xlarge
    keypad_sound_enabled = Column(Boolean, default=True)  # 키패드 효과음 사용 여부
    keypad_sound_type = Column(String, default="button")  # 키패드 효과음 종류 (button, soft, atm, elevator, touch, classic_beep)

    # 대기관리자 화면 레이아웃 설정
    manager_button_size = Column(String, default="medium")  # xsmall, small, medium, large

    # 개점 설정
    daily_opening_rule = Column(String, default="strict")  # strict: 1일 1회, flexible: 2회 이상(다음날)

    # 대기자 재방문 설정 (Revisit Badge)
    enable_revisit_badge = Column(Boolean, default=False)  # 재방문 배지 사용 여부
    revisit_period_days = Column(Integer, default=0)  # 재방문 카운트 기간 (0 = 전체 기간, N = 최근 N일)
    revisit_badge_style = Column(String, default="indigo_solid")  # 재방문 배지 스타일 (indigo_solid, amber_outline, emerald_pill, rose_gradient, sky_glass)

    # 대기접수 완료 모달 설정
    waiting_modal_timeout = Column(Integer, default=5)  # 대기접수 모달 타이머 (초)
    show_member_name_in_waiting_modal = Column(Boolean, default=True)  # 대기접수 모달 회원명 표시 여부
    show_new_member_text_in_waiting_modal = Column(Boolean, default=True)  # 대기접수 모달 신규회원 문구 표시 여부
    enable_waiting_voice_alert = Column(Boolean, default=False)  # 대기접수 완료 음성 안내 여부
    waiting_voice_message = Column(String, default="{클래스명}  {회원명}님 대기 접수 되었습니다.")  # 대기접수 완료 음성 안내 커스텀 메시지
    waiting_call_voice_message = Column(String, default="{순번}번 {회원명}님, 데스크로 오시기 바랍니다.") # 호출 시 음성 안내 커스텀 메시지
    enable_calling_voice_alert = Column(Boolean, default=True)  # 호출 시 음성 안내 (대기현황판)
    
    # Manager Voice Settings (Emergency/Independent)
    enable_manager_calling_voice_alert = Column(Boolean, default=False)
    manager_calling_voice_message = Column(String, default="{순번}번 {회원명}님, 호출되었습니다.")
    enable_manager_entry_voice_alert = Column(Boolean, default=False)
    manager_entry_voice_message = Column(String, default="{순번}번 {회원명}님, 입장해주세요.")
    
    waiting_voice_name = Column(String, nullable=True)  # 대기접수 완료 음성 안내 선택된 목소리 이름
    waiting_voice_rate = Column(Float, default=1.0)  # 대기접수 완료 음성 안내 속도 (0.1 ~ 10, 기본 1.0)
    waiting_voice_pitch = Column(Float, default=1.0)  # 대기접수 완료 음성 안내 높낮이 (0 ~ 2, 기본 1.0)
    waiting_call_voice_repeat_count = Column(Integer, default=1) # 호출 음성 안내 반복 횟수
    enable_duplicate_registration_voice = Column(Boolean, default=False) # 중복 접수 시 음성 안내 여부
    duplicate_registration_voice_message = Column(String, default="이미 대기 중인 번호입니다.") # 중복 접수 시 음성 안내 메시지
    
    # 대기현황판 표시 설정
    calling_status_display_second = Column(Integer, default=60) # 호출중 배지 표시 시간 (초)

    # 대기관리자 화면 레이아웃 설정
    waiting_manager_max_width = Column(Integer, nullable=True)  # 대기관리자 화면 최대 너비 (px), None이면 기본값(95%)
    waiting_list_box_size = Column(String, default="medium")  # 대기자 리스트 박스 크기: small, medium, large
    enable_franchise_monitoring = Column(Boolean, default=True)  # 프랜차이즈 관리 화면에 실시간 현황 공유 여부

    # SSE 트래픽 관리 설정
    enable_waiting_board = Column(Boolean, default=True)  # 대기현황판 사용 여부 (SSE 연결 제어)
    enable_reception_desk = Column(Boolean, default=True)  # 대기접수 데스크 사용 여부 (SSE 연결 제어)
    max_dashboard_connections = Column(Integer, default=2)  # 동시 대시보드 접속 허용 대수
    dashboard_connection_policy = Column(String, default="eject_old")  # eject_old(밀어내기) or block_new(차단)
    
    # 테마 설정
    theme = Column(String, default="zinc")  # zinc, blue, green
    operation_type = Column(String, default="general") # general: 일반 매장, dining: 외식 매장
    enable_party_size = Column(Boolean, default=False)
    enable_menu_ordering = Column(Boolean, default=False)
    party_size_config = Column(String, nullable=True) # JSON string for party size categories
    detail_mode = Column(String, default="standard") # standard (table), pickup (cafe)

    # 순차적 마감 설정
    sequential_closing = Column(Boolean, default=False)  # 순차적 마감 사용 여부
    
    # 영수증 프린터 설정
    enable_printer = Column(Boolean, default=False)
    printer_connection_type = Column(String, default="lan") # lan, bluetooth
    printer_connection_mode = Column(String, default="local_proxy") # local_proxy (Direct), cloud_queue (Server)
    printer_ip_address = Column(String, nullable=True) # Target Printer IP
    printer_proxy_ip = Column(String, default="localhost") # Local Proxy Server IP (for Tablet)
    printer_port = Column(Integer, default=9100)
    auto_print_registration = Column(Boolean, default=True)

    # 클래스 시간 설정
    default_class_minute = Column(Integer, default=50)  # 기본 수업 시간 (분)
    default_break_minute = Column(Integer, default=10)  # 기본 쉬는 시간 (분)
    default_max_capacity = Column(Integer, default=10)  # 기본 정원 (명)

    # 영업 시간 및 브레이크 타임 설정
    business_start_time = Column(Time, default=time(9, 0))
    business_end_time = Column(Time, default=time(22, 0))
    enable_break_time = Column(Boolean, default=False)
    break_start_time = Column(Time, default=time(12, 0))
    break_end_time = Column(Time, default=time(13, 0))

    # 공지사항 설정
    show_program_notices = Column(Boolean, default=True)  # 프로그램 공지 표시 여부


    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 관계 설정
    store = relationship("Store", back_populates="store_settings")

class DailyClosing(Base):
    """일마감"""
    __tablename__ = "daily_closing"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)  # 매장 ID
    business_date = Column(Date, nullable=False, index=True)  # 영업일
    opening_time = Column(DateTime)  # 개점 시간
    closing_time = Column(DateTime)  # 마감 시간
    is_closed = Column(Boolean, default=False)  # 마감 여부
    total_waiting = Column(Integer, default=0)  # 총 대기 수
    total_attended = Column(Integer, default=0)  # 총 출석 수
    total_cancelled = Column(Integer, default=0)  # 총 취소 수
    created_at = Column(DateTime, default=func.now())

    # 관계 설정
    store = relationship("Store", back_populates="daily_closings")

class ClassInfo(Base):
    """클래스(교시) 정보"""
    __tablename__ = "class_info"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)  # 매장 ID
    class_number = Column(Integer, nullable=False)  # 교시 번호 (1, 2, 3, ...)
    class_name = Column(String, nullable=False)  # 교시명 (1교시, 2교시, ...)
    start_time = Column(Time, nullable=False)  # 시작 시간
    end_time = Column(Time, nullable=False)  # 종료 시간
    max_capacity = Column(Integer, default=10)  # 최대 수용 인원
    is_active = Column(Boolean, default=True)  # 활성화 여부
    weekday_schedule = Column(String, default='{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":true,"sun":true}')  # 요일 스케줄 (JSON)
    class_type = Column(String, default='all')  # 클래스 타입: weekday(평일), weekend(주말), all(전체)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 관계 설정
    store = relationship("Store", back_populates="classes")
    waiting_list = relationship("WaitingList", back_populates="class_info")

class Member(Base):
    """회원 정보"""
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)  # 매장 ID
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False, index=True)  # unique 제거 (매장별/프랜차이즈별 로직으로 처리)
    barcode = Column(String, unique=True, nullable=True, index=True)  # 바코드 (유일 코드)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 관계 설정
    store = relationship("Store", back_populates="members")
    waiting_list = relationship("WaitingList", back_populates="member")

class WaitingList(Base):
    """대기자 목록"""
    __tablename__ = "waiting_list"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)  # 매장 ID
    business_date = Column(Date, nullable=False, index=True)  # 영업일
    waiting_number = Column(Integer, nullable=False)  # 대기번호
    phone = Column(String, nullable=False)  # 핸드폰번호
    name = Column(String)  # 대기자명 (회원인 경우 자동 입력)
    total_party_size = Column(Integer, default=0) # 총 인원수
    party_size_details = Column(String, nullable=True) # JSON string for detailed party size (e.g. {"adult": 2, "child": 1})

    class_id = Column(Integer, ForeignKey("class_info.id"), nullable=False)
    class_order = Column(Integer, nullable=False)  # 해당 클래스 내 순서

    member_id = Column(Integer, ForeignKey("members.id"), index=True)  # 회원 ID (있는 경우)

    is_empty_seat = Column(Boolean, default=False)  # 빈 좌석 여부

    status = Column(String, default="waiting", index=True)  # waiting, attended, cancelled, no_show

    registered_at = Column(DateTime, default=func.now())  # 접수 시간
    attended_at = Column(DateTime, index=True)  # 출석 시간
    cancelled_at = Column(DateTime)  # 취소 시간

    call_count = Column(Integer, default=0)  # 호출 횟수
    last_called_at = Column(DateTime)  # 마지막 호출 시간

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # 관계 설정
    store = relationship("Store", back_populates="waiting_list")
    class_info = relationship("ClassInfo", back_populates="waiting_list")
    member = relationship("Member", back_populates="waiting_list")

class ClassClosure(Base):
    """교시 마감 정보"""
    __tablename__ = "class_closure"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)  # 매장 ID
    business_date = Column(Date, nullable=False, index=True)  # 영업일
    class_id = Column(Integer, ForeignKey("class_info.id"), nullable=False)  # 교시 ID
    closed_at = Column(DateTime, default=func.now())  # 마감 시간
    created_at = Column(DateTime, default=func.now())

class WaitingHistory(Base):
    """대기 이력 (통계용)"""
    __tablename__ = "waiting_history"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)  # 매장 ID
    business_date = Column(Date, nullable=False, index=True)
    waiting_number = Column(Integer, nullable=False)
    phone = Column(String, nullable=False)
    name = Column(String)
    class_id = Column(Integer)
    class_name = Column(String)
    status = Column(String)  # attended, cancelled, no_show
    registered_at = Column(DateTime)
    completed_at = Column(DateTime)
    waiting_time_minutes = Column(Integer)  # 대기 시간 (분)
    created_at = Column(DateTime, default=func.now())

class AuditLog(Base):
    """시스템 감사 로그 (변경 이력)"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, nullable=False, index=True)  # e.g., 'update_settings', 'login'
    target_type = Column(String, nullable=False)  # e.g., 'store_settings', 'class'
    target_id = Column(Integer, nullable=True)
    old_value = Column(String, nullable=True)  # JSON String
    new_value = Column(String, nullable=True)  # JSON String
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now(), index=True)

    # Relationships
    store = relationship("Store")
    user = relationship("User")

class SettingsSnapshot(Base):
    """설정 스냅샷 (복원용)"""
    __tablename__ = "settings_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("store.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    settings = Column(String, nullable=False)  # JSON String of all settings
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

class Notice(Base):
    """공지사항"""
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)  # HTML or Text
    target_type = Column(String, default="all")  # all, selected, franchise, program
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    franchise_id = Column(Integer, ForeignKey("franchise.id"), nullable=True, index=True)  # 프랜차이즈 공지용
    category = Column(String, default="general")  # franchise, store, selected, program, general


    # Relationships
    author = relationship("User")
    franchise = relationship("Franchise")
    target_stores = relationship("Store", secondary=notice_stores, backref="notices")
    attachments = relationship("NoticeAttachment", back_populates="notice", cascade="all, delete-orphan")



class NoticeAttachment(Base):
    """공지사항 첨부파일"""
    __tablename__ = "notice_attachments"

    id = Column(Integer, primary_key=True, index=True)
    notice_id = Column(Integer, ForeignKey("notices.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)  # 원본 파일명
    stored_filename = Column(String, nullable=False)  # 저장된 파일명 (UUID)
    file_size = Column(Integer, nullable=False)  # 파일 크기 (bytes)
    file_type = Column(String, nullable=False)  # MIME type
    created_at = Column(DateTime, default=func.now())

    # Relationships
    notice = relationship("Notice", back_populates="attachments")
