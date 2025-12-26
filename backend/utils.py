from datetime import datetime, date, timedelta, time

def get_today_date(start_hour: int = 7) -> date:
    """
    현재 영업일(Business Date)을 반환하는 함수.
    
    매장별 설정된 영업 시작 시간(start_hour)을 기준으로 날짜를 계산합니다.
    기본값: 새벽 5시(05:00)까지는 전날의 영업일로 간주
    
    예 (start_hour=5):
    - 12월 7일 02:00 -> 12월 6일 영업일
    - 12월 7일 06:00 -> 12월 7일 영업일
    """
    now = datetime.now()
    
    # 기준 시간 설정 (0~23)
    if not (0 <= start_hour <= 23):
        start_hour = 7  # 유효하지 않은 값이면 기본값 사용
        
    cutoff_time = time(start_hour, 0, 0)
    
    if now.time() < cutoff_time:
        return (now - timedelta(days=1)).date()
    else:
        return now.date()
