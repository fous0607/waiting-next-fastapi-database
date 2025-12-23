from fastapi import APIRouter, Depends, Request, HTTPException
# from fastapi.responses import HTMLResponse
# from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_, Date
from database import get_db
from models import WaitingList, Member, Store, ClassInfo
from auth import get_current_store
from datetime import datetime, timedelta, date
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(
    tags=["attendance"]
)

# templates = Jinja2Templates(directory="templates")

# --- API Endpoints ---

@router.get("/status")
async def get_attendance_status(
    period: str,
    date: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    start_date_param = start_date
    end_date_param = end_date
    
    # 기간 설정
    start_date = target_date
    end_date = target_date

    if period == 'custom' and start_date_param and end_date_param:
        start_date = datetime.strptime(start_date_param, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_param, "%Y-%m-%d").date()
    elif period == 'weekly':
        start_date = target_date - timedelta(days=target_date.weekday())
        end_date = start_date + timedelta(days=6)
    elif period == 'monthly':
        start_date = target_date.replace(day=1)
        next_month = target_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
    elif period == 'yearly':
        start_date = target_date.replace(month=1, day=1)
        end_date = target_date.replace(month=12, day=31)

    # 전체 출석 조회 (attended 상태인 것만)
    attendance_query = db.query(WaitingList).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.status == 'attended',
        func.cast(WaitingList.attended_at, Date) >= start_date,
        func.cast(WaitingList.attended_at, Date) <= end_date
    )
    
    total_attendance = attendance_query.count()

    # 신규 회원 출석 (해당 기간에 가입한 회원의 출석)
    # 1. 해당 기간에 가입한 회원 ID 조회
    new_member_ids = db.query(Member.id).filter(
        Member.store_id == current_store.id,
        func.date(Member.created_at) >= start_date,
        func.date(Member.created_at) <= end_date
    ).all()
    new_member_ids = [m[0] for m in new_member_ids]

    new_member_attendance = 0
    if new_member_ids:
        new_member_attendance = attendance_query.filter(
            WaitingList.member_id.in_(new_member_ids)
        ).count()

    existing_member_attendance = total_attendance - new_member_attendance

    return {
        "total": total_attendance,
        "existing": existing_member_attendance,
        "new": new_member_attendance
    }

@router.get("/waiting-status")
async def get_waiting_status(
    period: str,
    date: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    start_date_param = start_date
    end_date_param = end_date
    
    # 기간 설정
    start_date = target_date
    end_date = target_date

    if period == 'custom' and start_date_param and end_date_param:
        start_date = datetime.strptime(start_date_param, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_param, "%Y-%m-%d").date()
    elif period == 'weekly':
        start_date = target_date - timedelta(days=target_date.weekday())
        end_date = start_date + timedelta(days=6)
    elif period == 'monthly':
        start_date = target_date.replace(day=1)
        next_month = target_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
    elif period == 'yearly':
        start_date = target_date.replace(month=1, day=1)
        end_date = target_date.replace(month=12, day=31)

    # 전체 대기 조회 (waiting 상태인 것만)
    # 주의: 대기 현황은 보통 '현재' 기준이지만, 기간별 통계라면 '해당 기간에 대기 등록된 수' 또는 '해당 기간에 대기했던 수'를 의미할 수 있음.
    # 여기서는 '해당 기간에 등록된 대기(registered_at)'를 기준으로 하되, status는 상관없이 '대기 등록' 자체를 카운트할지, 아니면 '현재 waiting' 상태인 것만 카운트할지 결정해야 함.
    # 사용자가 "대기현황"이라고 했고 "총 대기"라고 했으므로, 해당 기간의 "총 대기 등록 건수"를 의미하는 것이 일반적임 (취소/출석 포함).
    # 하지만 "대기현황"이라는 말은 "현재 대기 중인 사람"을 의미할 수도 있음.
    # 탭이 "출석현황"과 대등하게 있다면 "기간 내 대기 등록 수"가 맞을 듯함.
    # 출석현황은 "attended" 상태인 것만 셌음.
    # 대기현황은 "waiting" 상태인 것만 세면 과거 날짜는 0일 확률이 높음 (다 처리되었을 테니).
    # 따라서 "대기현황"은 "해당 기간에 발생한 총 대기 건수" (status 무관) 또는 "waiting" 상태였던 것?
    # 요구사항: "총 대기 / 기존회원 대기 / 신규회원 대기"
    # 아마도 "총 접수 건수"를 의미할 가능성이 높음.
    
    # 전체 대기 조회 (기간 내 등록된 대기)
    # 수정: 등록일 기준뿐만 아니라, 해당 기간에 출석/취소된 건도 포함해야 함 (이월된 대기자 등)
    waiting_query = db.query(WaitingList).filter(
        WaitingList.store_id == current_store.id,
        or_(
            # 1. 해당 기간에 등록된 건 (상태 불문)
            and_(func.cast(WaitingList.registered_at, Date) >= start_date, func.cast(WaitingList.registered_at, Date) <= end_date),
            # 2. 해당 기간에 출석한 건 (등록일과 무관하게 포함 - 이월 된 대기자 처리)
            and_(
                WaitingList.status == 'attended',
                func.cast(WaitingList.attended_at, Date) >= start_date,
                func.cast(WaitingList.attended_at, Date) <= end_date
            )
            # 취소/노쇼는 등록일 기준이 아니면 포함하지 않음 (이월 된 대기자의 일괄 취소/마감 등은 통계에서 제외)
        )
    )
    
    total_waiting = waiting_query.count()

    # 현 대기 조회 (기간 내 등록/활동이 있었던 대기 중 현재 status가 waiting인 것)
    # 다만, '과거 날짜'를 조회할 때 '현재 waiting'인 것은 의미가 모호할 수 있음 (조회 시점 기준으론 waiting이지만, 그 날짜 기준으론 아닐 수 있음)
    # 하지만 시스템상 'status'는 현재 상태만 가지고 있음.
    # 따라서 여기서의 current_waiting은 '해당 기간에 관여된 사람 중 아직도 대기 중인 사람'을 의미하게 됨.
    current_waiting_query = waiting_query.filter(WaitingList.status == 'waiting')
    current_total = current_waiting_query.count()

    # 신규 회원 대기 (해당 기간에 가입한 회원의 대기)
    new_member_ids = db.query(Member.id).filter(
        Member.store_id == current_store.id,
        func.cast(Member.created_at, Date) >= start_date,
        func.cast(Member.created_at, Date) <= end_date
    ).all()
    new_member_ids = [m[0] for m in new_member_ids]

    new_member_waiting = 0
    current_new = 0
    
    if new_member_ids:
        # 총 신규회원 대기
        new_member_waiting = waiting_query.filter(
            WaitingList.member_id.in_(new_member_ids)
        ).count()
        
        # 현 신규회원 대기
        current_new = current_waiting_query.filter(
            WaitingList.member_id.in_(new_member_ids)
        ).count()

    existing_member_waiting = total_waiting - new_member_waiting
    current_existing = current_total - current_new

    return {
        "total": total_waiting,
        "existing": existing_member_waiting,
        "new": new_member_waiting,
        "current_total": current_total,
        "current_existing": current_existing,
        "current_new": current_new
    }

@router.get("/individual/search")
async def search_member_for_attendance(
    query: str,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    # 이름 또는 전화번호 뒷자리로 검색
    members = db.query(Member).filter(
        Member.store_id == current_store.id,
        (Member.name.contains(query)) | (Member.phone.endswith(query))
    ).limit(20).all()

    return [
        {"id": m.id, "name": m.name, "phone": m.phone}
        for m in members
    ]

@router.get("/individual/{member_id}")
async def get_member_attendance_detail(
    member_id: int,
    period: str = 'monthly',
    date: str = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    try:
        # 날짜 파라미터 처리
        if date:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        else:
            target_date = datetime.now().date()
        
        # 기간 설정
        start_date_val = target_date
        end_date_val = target_date

        if period == 'custom' and start_date and end_date:
            start_date_val = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_val = datetime.strptime(end_date, "%Y-%m-%d").date()
        elif period == 'weekly':
            start_date_val = target_date - timedelta(days=target_date.weekday())
            end_date_val = start_date_val + timedelta(days=6)
        elif period == 'monthly':
            start_date_val = target_date.replace(day=1)
            next_month = target_date.replace(day=28) + timedelta(days=4)
            end_date_val = next_month - timedelta(days=next_month.day)
        elif period == 'yearly':
            start_date_val = target_date.replace(month=1, day=1)
            end_date_val = target_date.replace(month=12, day=31)
        elif period == 'all':
            start_date_val = datetime.strptime("2000-01-01", "%Y-%m-%d").date()
            end_date_val = datetime.strptime("2099-12-31", "%Y-%m-%d").date()

        # 회원 정보 조회
        member = db.query(Member).filter(
            Member.id == member_id,
            Member.store_id == current_store.id
        ).first()
        
        if not member:
            raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

        # 기간 내 출석 내역 조회 (attended_at이 NULL이 아닌 것만)
        query = db.query(WaitingList).filter(
            WaitingList.member_id == member_id,
            WaitingList.store_id == current_store.id,
            WaitingList.status == 'attended',
            WaitingList.attended_at.isnot(None)  # NULL 체크 추가
        )
        
        if period != 'all':
            query = query.filter(
                func.date(WaitingList.attended_at) >= start_date_val,
                func.date(WaitingList.attended_at) <= end_date_val
            )
        
        # 총 출석 횟수
        total_count = query.count()
        
        # 최근 20개 출석 내역
        history = query.order_by(desc(WaitingList.attended_at)).limit(20).all()
        
        # 캘린더용 출석 날짜 목록 (기간 내 모든 출석 날짜)
        attendance_dates = db.query(
            func.date(WaitingList.attended_at).label('date')
        ).filter(
            WaitingList.member_id == member_id,
            WaitingList.store_id == current_store.id,
            WaitingList.status == 'attended',
            WaitingList.attended_at.isnot(None),  # NULL 체크 추가
            func.date(WaitingList.attended_at) >= start_date_val,
            func.date(WaitingList.attended_at) <= end_date_val
        ).distinct().all()
        
        # 날짜를 문자열 리스트로 변환 (func.date()는 이미 문자열을 반환함)
        calendar_dates = []
        for d in attendance_dates:
            if d.date:  # NULL 체크
                # func.date()가 이미 문자열이면 그대로 사용, date 객체면 변환
                if isinstance(d.date, str):
                    calendar_dates.append(d.date)
                else:
                    calendar_dates.append(d.date.strftime("%Y-%m-%d"))

        return {
            "member": {
                "id": member.id,
                "name": member.name,
                "phone": member.phone
            },
            "period": {
                "type": period,
                "start": start_date_val.strftime("%Y-%m-%d"),
                "end": end_date_val.strftime("%Y-%m-%d")
            },
            "total_count": total_count,
            "calendar_dates": calendar_dates,
            "history": [
                {
                    "id": h.id,
                    "date": h.attended_at.strftime("%Y-%m-%d %H:%M") if h.attended_at else "N/A",
                    "class_name": db.query(ClassInfo.class_name).filter(ClassInfo.id == h.class_id).scalar() or "N/A"
                }
                for h in history
            ]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"날짜 형식 오류: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 오류: {str(e)}")

@router.get("/new-members")
async def get_new_members(
    period: str,
    date: str = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    # 날짜가 없으면 오늘로 설정
    if not date or date == '':
        target_date = datetime.now().date()
    else:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            # 날짜 형식이 잘못된 경우 오늘로 설정
            target_date = datetime.now().date()
    
    start_date_param = start_date
    end_date_param = end_date

    start_date = target_date
    end_date = target_date

    if period == 'custom' and start_date_param and end_date_param:
        start_date = datetime.strptime(start_date_param, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_param, "%Y-%m-%d").date()
    elif period == 'weekly':
        start_date = target_date - timedelta(days=target_date.weekday())
        end_date = start_date + timedelta(days=6)
    elif period == 'monthly':
        start_date = target_date.replace(day=1)
        next_month = target_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
    elif period == 'yearly':
        start_date = target_date.replace(month=1, day=1)
        end_date = target_date.replace(month=12, day=31)

    new_members = db.query(Member).filter(
        Member.store_id == current_store.id,
        func.cast(Member.created_at, Date) >= start_date,
        func.cast(Member.created_at, Date) <= end_date
    ).all()

    # 전체 회원 수 조회 (총원원수)
    total_members_count = db.query(func.count(Member.id)).filter(
        Member.store_id == current_store.id
    ).scalar() or 0

    result = []
    total_attendance = 0

    for member in new_members:
        # 출석 횟수 조회
        attendance_count = db.query(func.count(WaitingList.id)).filter(
            WaitingList.member_id == member.id,
            WaitingList.status == 'attended'
        ).scalar() or 0

        # 최초 출석일 조회
        first_attendance = db.query(WaitingList).filter(
            WaitingList.member_id == member.id,
            WaitingList.status == 'attended'
        ).order_by(WaitingList.attended_at).first()

        # 최근 출석일 조회
        last_attendance = db.query(WaitingList).filter(
            WaitingList.member_id == member.id,
            WaitingList.status == 'attended'
        ).order_by(desc(WaitingList.attended_at)).first()

        total_attendance += attendance_count

        result.append({
            "name": member.name,
            "phone": member.phone,
            "joined_at": member.created_at.strftime("%Y-%m-%d"),
            "first_attendance": first_attendance.attended_at.strftime("%Y-%m-%d") if first_attendance and first_attendance.attended_at else None,
            "last_attendance": last_attendance.attended_at.strftime("%Y-%m-%d") if last_attendance and last_attendance.attended_at else None,
            "attendance_count": attendance_count
        })

    # 출석순으로 정렬 (출석 횟수가 많은 순)
    result.sort(key=lambda x: x['attendance_count'], reverse=True)

    # 평균 출석 횟수 계산
    avg_attendance = round(total_attendance / len(new_members), 1) if new_members else 0
    
    # 페이징 적용 (Python Slicing)
    paginated_result = result[skip : skip + limit]

    return {
        "count": len(new_members),
        "new_members": paginated_result,
        "total_members_count": total_members_count,
        "total_attendance": total_attendance,
        "avg_attendance": avg_attendance
    }

@router.get("/ranking")
async def get_attendance_ranking(
    period: str,
    min_count: int = 0,
    date: str = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_store: Store = Depends(get_current_store)
):
    # 날짜 처리
    if not date or date == '':
        target_date = datetime.now().date()
    else:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            target_date = datetime.now().date()

    start_date_param = start_date
    end_date_param = end_date
    
    start_date = target_date
    end_date = target_date

    if period == 'custom' and start_date_param and end_date_param:
        start_date = datetime.strptime(start_date_param, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_param, "%Y-%m-%d").date()
    elif period == 'weekly':
        start_date = target_date - timedelta(days=target_date.weekday())
        end_date = start_date + timedelta(days=6)
    elif period == 'monthly':
        start_date = target_date.replace(day=1)
        next_month = target_date.replace(day=28) + timedelta(days=4)
        end_date = next_month - timedelta(days=next_month.day)
    elif period == 'yearly':
        start_date = target_date.replace(month=1, day=1)
        end_date = target_date.replace(month=12, day=31)

    query = db.query(
        Member.id,
        Member.name,
        Member.phone,
        func.count(WaitingList.id).label('attendance_count'),
        func.max(WaitingList.attended_at).label('last_attendance')
    ).join(WaitingList, Member.id == WaitingList.member_id).filter(
        WaitingList.store_id == current_store.id,
        WaitingList.status == 'attended',
        func.date(WaitingList.attended_at) >= start_date,
        func.date(WaitingList.attended_at) <= end_date
    )

    query = query.group_by(Member.id).having(func.count(WaitingList.id) >= min_count)
    query = query.order_by(desc('attendance_count'), desc('last_attendance'))
    
    # 페이징 적용
    query = query.offset(skip).limit(limit)
    
    rankings = query.all()

    return [
        {
            "member_id": r.id,
            "name": r.name,
            "phone": r.phone,
            "attendance_count": r.attendance_count,
            "last_attendance": r.last_attendance.strftime("%Y-%m-%d") if r.last_attendance else "-"
        }
        for r in rankings
    ]

# @router.get("/history", response_class=HTMLResponse)
# async def get_attendance_history_page(
#     request: Request,
#     phone: str,
#     db: Session = Depends(get_db),
#     current_store: Store = Depends(get_current_store)
# ):
#     member = db.query(Member).filter(
#         Member.store_id == current_store.id,
#         Member.phone == phone
#     ).first()

#     if not member:
#         return templates.TemplateResponse("attendance_history.html", {
#             "request": request,
#             "member": {"name": "알 수 없음", "phone": phone},
#             "history": [],
#             "total_count": 0
#         })

#     # 전체 출석 이력 조회
#     history_query = db.query(WaitingList).filter(
#         WaitingList.member_id == member.id,
#         WaitingList.store_id == current_store.id,
#         WaitingList.status == 'attended'
#     ).order_by(desc(WaitingList.attended_at))

#     total_count = history_query.count()
#     history_items = history_query.limit(50).all() # 최근 50개만 표시

#     formatted_history = []
#     for item in history_items:
#         class_name = db.query(ClassInfo.class_name).filter(ClassInfo.id == item.class_id).scalar() or "삭제된 클래스"
#         formatted_history.append({
#             "date": item.attended_at.strftime("%Y-%m-%d"),
#             "time": item.attended_at.strftime("%H:%M"),
#             "class_name": class_name
#         })

#     return templates.TemplateResponse("attendance_history.html", {
#         "request": request,
#         "member": member,
#         "history": formatted_history,
#         "total_count": total_count
#     })
