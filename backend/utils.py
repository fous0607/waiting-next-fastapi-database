from datetime import datetime, date, timedelta, time, timezone

def get_today_date(start_hour: int = 7) -> date:
    """
    현재 영업일(Business Date)을 반환하는 함수.
    KST(UTC+9) 기준으로 계산합니다.
    """
    # KST 시간으로 강제 변환
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    
    # 기준 시간 설정 (0~23)
    if not (0 <= start_hour <= 23):
        start_hour = 7
        
    cutoff_time = time(start_hour, 0, 0)
    
    # KST 기준 시간과 비교 (now는 이미 KST)
    if now.time() < cutoff_time:
        return (now - timedelta(days=1)).date()
    else:
        return now.date()
