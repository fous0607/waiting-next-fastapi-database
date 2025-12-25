from pydantic import BaseModel, Field
from datetime import datetime, date, time
from typing import Optional, List, Dict

# Store Settings
class StoreSettingsBase(BaseModel):
    store_name: str
    display_classes_count: int = 3
    list_direction: str = "vertical"
    rows_per_class: int = 1
    admin_password: str = "1234"
    max_waiting_limit: int = 50
    use_max_waiting_limit: bool = True
    block_last_class_registration: bool = False
    auto_register_member: bool = False
    require_member_registration: bool = False
    registration_message: str = "처음 방문하셨네요!\n성함을 입력해 주세요."
    business_day_start: int = 5  # 영업일 기준 시간 (0~23)
    auto_closing: bool = True  # 영업일 변경 시 자동 마감 및 리셋 여부
    closing_action: str = "reset"
    
    # 출석 횟수 표시 설정
    attendance_count_type: str = "days"
    attendance_lookback_days: int = 30

    # 대기현황판 표시 설정
    show_waiting_number: bool = True
    mask_customer_name: bool = False
    name_display_length: int = 0  # 이름 표시 자릿수 (0 = 전체 표시)
    show_order_number: bool = True
    board_display_order: str = "number,name,order"
    waiting_board_page_size: int = 12
    waiting_board_rotation_interval: int = 5
    
    # 폰트 설정
    manager_font_family: str = "Nanum Gothic"
    manager_font_size: str = "15px"
    board_font_family: str = "Nanum Gothic"
    board_font_size: str = "24px"
    
    # 대기접수 키패드 설정
    keypad_style: str = "modern"  # modern, bold, dark, colorful

    keypad_font_size: str = "large"  # small, medium, large, xlarge
    keypad_sound_enabled: bool = True
    keypad_sound_type: str = "button"

    # 개점 설정
    daily_opening_rule: str = "strict"

    # 대기접수 완료 모달 설정
    waiting_modal_timeout: int = 5
    show_member_name_in_waiting_modal: bool = True
    show_new_member_text_in_waiting_modal: bool = True
    enable_waiting_voice_alert: bool = False
    waiting_voice_message: Optional[str] = None
    waiting_voice_name: Optional[str] = None
    waiting_voice_rate: float = 1.0
    waiting_voice_pitch: float = 1.0

    # 대기관리자 화면 레이아웃 설정
    manager_button_size: str = "medium"  # xsmall, small, medium, large
    waiting_manager_max_width: Optional[int] = None
    waiting_list_box_size: str = "medium"  # small, medium, large
    
    # 프랜차이즈 관리 화면 실시간 현황 공유 설정
    enable_franchise_monitoring: bool = True
    
    # SSE 트래픽 관리 설정
    enable_waiting_board: bool = True  # 대기현황판 사용 여부
    enable_reception_desk: bool = True  # 대기접수 데스크 사용 여부
    
    # 테마 설정
    theme: str = "zinc"  # zinc, blue, green

    # 클래스 시간 설정
    default_class_minute: int = 50
    default_break_minute: int = 10
    default_max_capacity: int = 10

class StoreSettingsCreate(StoreSettingsBase):
    pass

class StoreSettingsUpdate(BaseModel):
    store_name: Optional[str] = None
    display_classes_count: Optional[int] = None
    display_count: Optional[int] = 5
    list_direction: Optional[str] = None
    rows_per_class: Optional[int] = None
    admin_password: Optional[str] = None
    max_waiting_limit: Optional[int] = None
    use_max_waiting_limit: Optional[bool] = None
    block_last_class_registration: Optional[bool] = None
    auto_register_member: Optional[bool] = None
    require_member_registration: Optional[bool] = None
    registration_message: Optional[str] = None
    business_day_start: Optional[int] = 0
    auto_closing: Optional[bool] = True
    closing_action: Optional[str] = "reset"

    # 출석 횟수 표시 설정
    attendance_count_type: Optional[str] = None
    attendance_lookback_days: Optional[int] = None

    # 대기현황판 표시 설정
    show_waiting_number: Optional[bool] = None
    mask_customer_name: Optional[bool] = None
    name_display_length: Optional[int] = None
    show_order_number: Optional[bool] = None
    board_display_order: Optional[str] = None
    waiting_board_page_size: Optional[int] = None
    waiting_board_rotation_interval: Optional[int] = None
    waiting_board_transition_effect: Optional[str] = None

    # 폰트 설정
    manager_font_family: Optional[str] = None
    manager_font_size: Optional[str] = None
    board_font_family: Optional[str] = None
    board_font_size: Optional[str] = None
    
    # 대기접수 키패드 설정
    keypad_style: Optional[str] = None
    keypad_font_size: Optional[str] = None
    keypad_sound_enabled: Optional[bool] = None
    keypad_sound_type: Optional[str] = None
    
    # 대기관리자 화면 버튼 크기
    manager_button_size: Optional[str] = None

    # 개점 설정
    daily_opening_rule: Optional[str] = None

    # 대기접수 완료 모달 설정
    waiting_modal_timeout: Optional[int] = None
    show_member_name_in_waiting_modal: Optional[bool] = None
    show_new_member_text_in_waiting_modal: Optional[bool] = None
    enable_waiting_voice_alert: Optional[bool] = None
    waiting_voice_message: Optional[str] = None
    waiting_voice_name: Optional[str] = None
    waiting_voice_rate: Optional[float] = None
    waiting_voice_pitch: Optional[float] = None
    
    # 대기관리자 화면 레이아웃 설정
    waiting_manager_max_width: Optional[int] = None
    waiting_list_box_size: Optional[str] = None

    # 프랜차이즈 관리 화면 실시간 현황 공유 설정
    enable_franchise_monitoring: Optional[bool] = None
    
    # SSE 트래픽 관리 설정
    enable_waiting_board: Optional[bool] = None
    enable_reception_desk: Optional[bool] = None
    
    # 테마 설정
    theme: Optional[str] = None

    # 클래스 시간 설정
    default_class_minute: Optional[int] = None
    default_break_minute: Optional[int] = None
    default_max_capacity: Optional[int] = None

class StoreSettings(StoreSettingsBase):
    id: int
    store_id: int  # Critical for frontend ID matching
    created_at: datetime
    updated_at: datetime
    store_code: Optional[str] = None  # Added for frontend convenience

    class Config:
        from_attributes = True

# Daily Closing
class DailyClosingBase(BaseModel):
    business_date: date

class DailyClosingCreate(DailyClosingBase):
    pass

class DailyClosing(DailyClosingBase):
    id: int
    opening_time: Optional[datetime]
    closing_time: Optional[datetime]
    is_closed: bool
    total_waiting: int
    total_attended: int
    total_cancelled: int
    created_at: datetime

    class Config:
        from_attributes = True

# Class Info
class ClassInfoBase(BaseModel):
    class_number: int
    class_name: str
    start_time: time
    end_time: time
    max_capacity: int = 10
    is_active: bool = True
    weekday_schedule: Optional[Dict[str, bool]] = None
    class_type: str = 'all'  # weekday, weekend, all

class ClassInfoCreate(ClassInfoBase):
    weekday_schedule: Dict[str, bool] = Field(default_factory=lambda: {
        "mon": True,
        "tue": True,
        "wed": True,
        "thu": True,
        "fri": True,
        "sat": True,
        "sun": True
    })

class ClassInfoUpdate(BaseModel):
    class_number: Optional[int] = None
    class_name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    max_capacity: Optional[int] = None
    is_active: Optional[bool] = None
    weekday_schedule: Optional[Dict[str, bool]] = None
    class_type: Optional[str] = None

class ClassInfo(ClassInfoBase):
    id: int
    created_at: datetime
    updated_at: datetime
    current_count: Optional[int] = 0  # 현재 대기자 수
    weekday_schedule: Dict[str, bool] = Field(default_factory=lambda: {
        "mon": True,
        "tue": True,
        "wed": True,
        "thu": True,
        "fri": True,
        "sat": True,
        "sun": True
    })  # 응답에서는 항상 존재

    class Config:
        from_attributes = True

# Member
class MemberBase(BaseModel):
    name: str
    phone: str = Field(..., pattern=r'^010\d{8}$')
    barcode: Optional[str] = None

class MemberCreate(MemberBase):
    pass

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    barcode: Optional[str] = None

class Member(MemberBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MemberBulkCreate(BaseModel):
    members: List[MemberBase]

# Waiting List
class WaitingListBase(BaseModel):
    phone: str = Field(..., pattern=r'^010\d{8}$')
    name: Optional[str] = None

class WaitingListCreate(WaitingListBase):
    class_id: Optional[int] = None
    person_count: Optional[int] = 1
    is_admin_registration: bool = False

class QuickRegisterRequest(BaseModel):
    input_value: str
    class_id: int
    person_count: int = 1





class WaitingListResponse(BaseModel):
    id: int
    waiting_number: int
    class_id: int
    class_name: str
    class_order: int
    phone: str
    name: Optional[str]
    status: str
    registered_at: datetime
    message: str
    last_month_attendance_count: int = 0
    is_new_member: bool = False

    class Config:
        from_attributes = True

class QuickRegisterResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[WaitingListResponse] = None
    candidates: Optional[List[Member]] = None


class WaitingList(BaseModel):
    id: int
    business_date: date
    waiting_number: int
    phone: str
    name: Optional[str]
    class_id: int
    class_order: int
    member_id: Optional[int]
    is_empty_seat: bool = False
    status: str
    registered_at: datetime
    attended_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    call_count: int
    last_called_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WaitingListDetail(WaitingList):
    class_info: ClassInfo
    member: Optional[Member] = None

class WaitingBoardItem(BaseModel):
    id: int  # 대기자 고유 ID
    waiting_number: int
    display_name: str  # 이름 또는 폰번호 뒷자리 4자리
    class_id: int
    class_name: str
    class_order: int
    is_empty_seat: bool = False
    status: str
    call_count: int = 0

class WaitingBoard(BaseModel):
    store_name: str
    business_date: date
    classes: List[ClassInfo]
    waiting_list: List[WaitingBoardItem]
    rows_per_class: int = 1
    waiting_board_page_size: int = 12
    waiting_board_rotation_interval: int = 5
    waiting_board_transition_effect: str = "slide"

# Waiting Management
class WaitingStatusUpdate(BaseModel):
    status: str  # attended, cancelled

class WaitingOrderUpdate(BaseModel):
    direction: str  # up, down

class WaitingClassUpdate(BaseModel):
    target_class_id: int

class WaitingNameUpdate(BaseModel):
    name: str

class BatchAttendance(BaseModel):
    class_id: int

class EmptySeatInsert(BaseModel):
    waiting_id: int  # 이 대기자 뒤에 빈 좌석 삽입

# Statistics
class DailyStatistics(BaseModel):
    business_date: date
    total_waiting: int
    total_attended: int
    total_cancelled: int
    total_no_show: int
    attendance_rate: float
    class_statistics: List[dict]

# Franchise
class FranchiseBase(BaseModel):
    name: str
    code: str
    member_type: str = "store"

class FranchiseCreate(FranchiseBase):
    pass

class FranchiseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    member_type: Optional[str] = None
    is_active: Optional[bool] = None

class Franchise(FranchiseBase):
    id: int
    member_type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    stores: List['Store'] = []

    class Config:
        from_attributes = True

# Store
class StoreBase(BaseModel):
    franchise_id: int
    name: str
    code: str

class StoreCreate(BaseModel):
    name: str
    # code는 자동 생성되므로 입력받지 않음

class StoreUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None

class Store(StoreBase):
    id: int
    is_active: bool
    last_heartbeat: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# User
class UserBase(BaseModel):
    username: str
    role: str  # system_admin, franchise_admin, store_admin
    franchise_id: Optional[int] = None
    store_id: Optional[int] = None

class UserCreate(UserBase):
    password: str  # 평문 비밀번호 (해싱되어 저장됨)
    managed_store_ids: Optional[List[int]] = []

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    franchise_id: Optional[int] = None
    store_id: Optional[int] = None
    is_active: Optional[bool] = None
    managed_store_ids: Optional[List[int]] = None

class User(UserBase):
    id: int
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    managed_stores: List[Store] = []

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: Optional[str] = None
    username: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None

# System Admin Response Schemas
class UserListResponse(User):
    franchise_name: Optional[str] = None
    store_name: Optional[str] = None

class StoreListResponse(Store):
    franchise_name: Optional[str] = None

class MemberListResponse(Member):
    franchise_name: Optional[str] = None
    store_name: Optional[str] = None
    store_name: Optional[str] = None

# Analytics Dashboard Schemas
class HourlyStat(BaseModel):
    hour: Optional[int] = None
    label: str  # Display label (e.g., "10시", "2024-07-29")
    waiting_count: int = 0
    attendance_count: int = 0

class ChartData(BaseModel):
    labels: List[str]
    values: List[float]
    colors: Optional[List[str]] = None

class StoreComparisonStat(BaseModel):
    store_id: int
    store_name: str
    total_sales: int = 0
    waiting_count: int = 0
    attendance_count: int = 0
    avg_sales_per_person: int = 0
    conversion_rate: float = 0.0

class StoreOperationStat(BaseModel):
    store_name: str
    is_open: bool
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    current_waiting: int = 0
    total_waiting: int = 0
    total_attendance: int = 0

class TimeStats(BaseModel):
    max: int = 0  # minutes
    min: int = 0  # minutes
    avg: float = 0.0  # minutes

class AnalyticsDashboard(BaseModel):
    total_stores: int
    open_stores: int
    total_waiting: int
    total_attendance: int
    waiting_time_stats: TimeStats
    attendance_time_stats: TimeStats
    hourly_stats: List[HourlyStat]
    store_stats: List[StoreOperationStat]
    
    # KPI fields
    total_revenue: int = 0
    total_visitors: int = 0
    new_members: int = 0
    retention_rate: float = 0.0
    
    # New fields for Enhanced Dashboard
    store_comparison: List[StoreComparisonStat] = []
    payment_stats: Optional[ChartData] = None
    channel_stats: Optional[ChartData] = None

    top_churn_members: List[dict] = []  # Marketing data (simple dict for now)
# Update forward references
Franchise.model_rebuild()
User.model_rebuild()

class Token(BaseModel):
    access_token: str
    token_type: str
    role: Optional[str] = None
    username: Optional[str] = None
    store: Optional[dict] = None  # Add store info

# Notice Schemas
class NoticeCreate(BaseModel):
    title: str
    content: str
    target_type: str = "all" # all, selected
    target_store_ids: Optional[List[int]] = []
    is_active: bool = True

class NoticeResponse(BaseModel):
    id: int
    title: str
    content: str
    target_type: str
    created_at: datetime
    author_name: Optional[str] = None
    
    class Config:
        from_attributes = True
