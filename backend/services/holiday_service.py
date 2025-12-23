"""
공휴일 관련 서비스
공공데이터포털 API를 통해 한국 공휴일 정보를 가져옵니다.
"""
import requests
from typing import List, Dict, Optional
import os
from core.logger import logger


def _get_test_holidays(year: int) -> List[Dict]:
    """
    테스트용 공휴일 데이터 (API 키 승인 대기 중일 때 사용)
    """
    if year == 2025:
        return [
            {"date": "2025-01-01", "name": "신정"},
            {"date": "2025-01-28", "name": "설날"},
            {"date": "2025-01-29", "name": "설날"},
            {"date": "2025-01-30", "name": "설날"},
            {"date": "2025-03-01", "name": "삼일절"},
            {"date": "2025-03-03", "name": "대체공휴일(삼일절)"},
            {"date": "2025-05-05", "name": "어린이날"},
            {"date": "2025-05-06", "name": "대체공휴일(어린이날)"},
            {"date": "2025-06-06", "name": "현충일"},
            {"date": "2025-08-15", "name": "광복절"},
            {"date": "2025-10-03", "name": "개천절"},
            {"date": "2025-10-06", "name": "대체공휴일(개천절)"},
            {"date": "2025-10-09", "name": "한글날"},
            {"date": "2025-12-25", "name": "크리스마스"},
        ]
    elif year == 2026:
        return [
            {"date": "2026-01-01", "name": "신정"},
            {"date": "2026-02-16", "name": "설날"},
            {"date": "2026-02-17", "name": "설날"},
            {"date": "2026-02-18", "name": "설날"},
            {"date": "2026-03-01", "name": "삼일절"},
            {"date": "2026-05-05", "name": "어린이날"},
            {"date": "2026-05-25", "name": "부처님오신날"},
            {"date": "2026-06-06", "name": "현충일"},
            {"date": "2026-08-15", "name": "광복절"},
            {"date": "2026-09-24", "name": "추석"},
            {"date": "2026-09-25", "name": "추석"},
            {"date": "2026-09-26", "name": "추석"},
            {"date": "2026-10-03", "name": "개천절"},
            {"date": "2026-10-09", "name": "한글날"},
            {"date": "2026-12-25", "name": "크리스마스"},
        ]
    elif year == 2027:
        return [
            {"date": "2027-01-01", "name": "신정"},
            {"date": "2027-02-06", "name": "설날"},
            {"date": "2027-02-07", "name": "설날"},
            {"date": "2027-02-08", "name": "설날"},
            {"date": "2027-03-01", "name": "삼일절"},
            {"date": "2027-05-05", "name": "어린이날"},
            {"date": "2027-05-13", "name": "부처님오신날"},
            {"date": "2027-06-06", "name": "현충일"},
            {"date": "2027-08-15", "name": "광복절"},
            {"date": "2027-09-14", "name": "추석"},
            {"date": "2027-09-15", "name": "추석"},
            {"date": "2027-09-16", "name": "추석"},
            {"date": "2027-10-03", "name": "개천절"},
            {"date": "2027-10-09", "name": "한글날"},
            {"date": "2027-12-25", "name": "크리스마스"},
        ]
    return []


def fetch_korean_holidays(year: int, api_key: Optional[str] = None) -> List[Dict]:
    """
    공공데이터 API에서 해당 연도의 공휴일 가져오기
    
    Args:
        year: 조회할 연도 (예: 2025)
        api_key: 공공데이터포털 API 키 (없으면 환경변수에서 가져옴)
    
    Returns:
        공휴일 목록 [{"date": "2025-01-01", "name": "신정"}, ...]
    
    Raises:
        ValueError: API 키가 없거나 잘못된 연도
        requests.RequestException: API 호출 실패
    """
    if not api_key:
        api_key = os.getenv("PUBLIC_DATA_API_KEY")
    
    if not api_key:
        raise ValueError(
            "공공데이터포털 API 키가 설정되지 않았습니다. "
            ".env 파일에 PUBLIC_DATA_API_KEY를 추가하거나 "
            "https://www.data.go.kr 에서 '한국천문연구원 특일 정보' API 키를 발급받으세요."
        )
    
    if year < 2000 or year > 2100:
        raise ValueError(f"유효하지 않은 연도입니다: {year}")
    
    url = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getHoliDeInfo"
    
    # URL을 직접 구성하여 API 키의 이중 인코딩 방지
    full_url = f"{url}?serviceKey={api_key}&solYear={year}&numOfRows=100&_type=json"
    
    try:
        logger.info(f"Fetching holidays for year {year} from public data API")
        response = requests.get(full_url, timeout=10)
        
        # API 키 승인 대기 중이면 테스트 데이터 반환
        if response.status_code in [401, 403]:
            logger.warning(f"API key not authorized (status {response.status_code}), returning test data for {year}")
            return _get_test_holidays(year)
        
        response.raise_for_status()
        
        data = response.json()
        
        # API 응답 구조 확인
        response_body = data.get("response", {})
        header = response_body.get("header", {})
        
        # 에러 체크
        result_code = header.get("resultCode")
        if result_code != "00":
            result_msg = header.get("resultMsg", "알 수 없는 오류")
            raise ValueError(f"API 오류: {result_msg} (코드: {result_code})")
        
        body = response_body.get("body", {})
        items = body.get("items", {})
        
        # items가 없으면 빈 리스트 반환
        if not items:
            logger.warning(f"No holidays found for year {year}")
            return []
        
        item_list = items.get("item", [])
        
        # 단일 항목인 경우 리스트로 변환
        if isinstance(item_list, dict):
            item_list = [item_list]
        
        holidays = []
        for item in item_list:
            # isHoliday가 'Y'인 것만 필터링 (공휴일만)
            if item.get("isHoliday") == "Y":
                date_str = str(item["locdate"])
                # YYYYMMDD -> YYYY-MM-DD 변환
                formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
                holidays.append({
                    "date": formatted_date,
                    "name": item["dateName"]
                })
        
        logger.info(f"Successfully fetched {len(holidays)} holidays for year {year}")
        return holidays
        
    except requests.RequestException as e:
        logger.error(f"Failed to fetch holidays: {e}")
        # API 호출 실패 시에도 테스트 데이터 반환
        logger.warning(f"Returning test data due to API error")
        return _get_test_holidays(year)
    except (KeyError, ValueError) as e:
        logger.error(f"Failed to parse holiday data: {e}")
        raise ValueError(f"공휴일 데이터 파싱 실패: {str(e)}")
