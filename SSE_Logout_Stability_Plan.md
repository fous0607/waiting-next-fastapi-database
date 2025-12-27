# SSE 연결 안정성 및 로그아웃 강화 계획서

**작성일**: 2025-12-25  
**작성자**: Antigravity AI Assistant  
**프로젝트**: 대기 관리 시스템 (waiting-next-fastapi-database)

---

## 📋 개요

이 문서는 Server-Sent Events (SSE) 연결의 안정성 문제와 로그아웃 시 발생하는 **좀비 세션(Zombie Session)** 문제에 대한 분석 및 해결 방안을 제시합니다.

---

## 🔴 문제 현상

### 1. 좀비 세션 문제
사용자가 로그아웃을 했음에도 불구하고 이전에 사용하던 기기의 SSE 세션이 서버에 **'좀비(Zombie)' 상태**로 남아있어, 새 기기에서 접속 시 다음과 같은 문제가 발생합니다:

- ❌ "접속 대수 초과" 오류 메시지 반복
- ❌ "연결이 종료되었습니다" 팝업 반복
- ❌ 정상적인 관리자 화면 접근 불가
- ❌ 사용자 경험 저하

### 2. 다중 탭 세션 관리 문제
- 여러 브라우저 탭을 열어둔 상태에서 한 탭에서 로그아웃을 해도 다른 탭의 SSE 연결은 계속 유지됨
- 각 탭이 독립적으로 SSE 연결을 시도하여 동시 접속 제한에 걸림
- 탭 간 상태 동기화 부재

### 3. 서버 측 세션 정리 지연
- 브라우저 탭이 닫혀도 서버가 TCP 연결 종료를 감지하기까지 시간 지연 (최대 30초)
- 네트워크 불안정 시 연결 상태 불일치
- 메모리 누수 가능성

---

## 🔍 원인 분석

### 1. 토큰 인식 부재로 인한 재연결 루프
**문제점**:
```typescript
// 현재 useSSE 훅 (문제 있는 로직)
useEffect(() => {
    const es = new EventSource(url);
    // access_token 확인 없이 무조건 연결 시도
}, []);
```

**결과**:
- 로그아웃 후에도 `access_token`이 없는 상태로 계속 SSE 연결 시도
- 5초마다 재연결을 반복하여 서버에 불필요한 부하 발생
- "좀비 세션"이 계속 생성됨

---

### 2. 로그아웃 시 SSE 연결 정리 부재
**문제점**:
```typescript
// 로그아웃 시 (문제 있는 로직)
const handleLogout = () => {
    localStorage.removeItem('access_token');
    // SSE 연결은 그대로 유지됨 (연결 종료 코드 없음)
    router.push('/login');
};
```

**결과**:
- 토큰은 삭제되었지만 SSE 연결은 계속 살아있음
- 서버는 여전히 해당 세션을 "활성 상태"로 인식
- 새 기기 접속 시 동시 접속 제한에 걸림

---

### 3. 다중 탭 간 상태 동기화 미흡
**문제점**:
- 각 탭이 독립적인 `localStorage`를 읽지만, 한 탭의 로그아웃이 다른 탭에 전파되지 않음
- SSE 연결이 탭별로 독립적으로 유지됨

**결과**:
- 한 탭에서 로그아웃해도 다른 탭의 SSE는 계속 연결 상태
- 서버 입장에서는 여전히 여러 세션이 활성화된 것으로 보임

---

### 4. 서버 측 세션 정리 메커니즘 한계
**문제점**:
```python
# 현재 서버 로직 (개선 필요)
# 동일 IP + Role만 체크
same_ip_sessions = [s for s in sessions if s.ip == client_ip and s.role == role]
# User Agent, ClientId 등 추가 식별자 미사용
```

**결과**:
- 같은 IP에서 다른 브라우저로 접속 시 세션 구분 불가
- 좀비 세션과 정상 세션을 구분하기 어려움

---

## 💡 해결 방안

### 1. 프론트엔드: 토큰 인식형 SSE 연결 (SSE Token Awareness)

#### 수정 대상: `frontend/hooks/useSSE.ts`

**개선 로직**:
```typescript
import { useEffect, useState, useRef } from 'react';

export const useSSE = (url: string, role: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        // 🔒 토큰 체크: 토큰이 없으면 연결하지 않음
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.log('[SSE] No token found, skipping connection');
            // 기존 연결이 있다면 종료
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
                setIsConnected(false);
            }
            return;
        }

        // SSE 연결 생성
        const eventSource = new EventSource(`${url}?token=${token}&role=${role}`);
        esRef.current = eventSource;

        eventSource.onopen = () => {
            console.log('[SSE] Connected');
            setIsConnected(true);
        };

        eventSource.onerror = () => {
            console.error('[SSE] Connection error');
            setIsConnected(false);
            eventSource.close();
        };

        // 🧹 클린업: 컴포넌트 언마운트 또는 토큰 변경 시 연결 종료
        return () => {
            console.log('[SSE] Cleanup: closing connection');
            eventSource.close();
            esRef.current = null;
            setIsConnected(false);
        };
    }, [url, role]); // 토큰 변경 감지는 상위에서 처리

    return { isConnected };
};
```

**주요 개선 사항**:
- ✅ `access_token` 존재 여부 체크
- ✅ 토큰이 없으면 연결 시도하지 않음
- ✅ 기존 연결이 있다면 명시적으로 `close()` 호출
- ✅ `useEffect` 클린업에서 연결 정리 보장

---

### 2. 프론트엔드: 전역 로그아웃 감지 및 상태 초기화

#### 수정 대상: `frontend/app/page.tsx` (또는 로그아웃 핸들러)

**개선 로직**:
```typescript
import { useRouter } from 'next/navigation';
import { useWaitingStore } from '@/lib/store/useWaitingStore';

const handleLogout = () => {
    // 1️⃣ 토큰 삭제
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    
    // 2️⃣ Zustand 스토어 초기화 (SSE 상태 포함)
    useWaitingStore.getState().reset(); // 또는 명시적으로 connectionBlockState 초기화
    
    // 3️⃣ 모든 탭에 로그아웃 알림 (BroadcastChannel 사용)
    const logoutChannel = new BroadcastChannel('auth_channel');
    logoutChannel.postMessage({ type: 'LOGOUT' });
    logoutChannel.close();
    
    // 4️⃣ 로그인 페이지로 리다이렉트
    router.push('/login');
};
```

**BroadcastChannel을 통한 다중 탭 동기화**:
```typescript
// 각 탭에서 실행
useEffect(() => {
    const authChannel = new BroadcastChannel('auth_channel');
    
    authChannel.onmessage = (event) => {
        if (event.data.type === 'LOGOUT') {
            // 다른 탭에서 로그아웃 발생 시 현재 탭도 정리
            localStorage.removeItem('access_token');
            useWaitingStore.getState().reset();
            window.location.href = '/login';
        }
    };
    
    return () => authChannel.close();
}, []);
```

---

### 3. 프론트엔드: SSE 상태 관리 개선

#### 수정 대상: `frontend/lib/store/useWaitingStore.ts`

**Zustand 스토어에 reset 액션 추가**:
```typescript
import { create } from 'zustand';

interface WaitingStore {
    connectionBlockState: boolean;
    // ... 기타 상태
    
    reset: () => void; // 🆕 추가
}

export const useWaitingStore = create<WaitingStore>((set) => ({
    connectionBlockState: false,
    // ... 기타 초기값
    
    // 🧹 모든 상태를 초기값으로 리셋
    reset: () => set({
        connectionBlockState: false,
        // 모든 상태를 초기값으로
    }),
}));
```

---

### 4. 백엔드: 세션 관리 로직 강화

#### 수정 대상: `backend/services/sse_manager.py`

**개선 로직**:
```python
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class ConnectionInfo:
    session_id: str
    client_id: str  # 브라우저별 고유 ID
    ip: str
    role: str
    store_id: Optional[int]
    user_agent: str
    connected_at: datetime
    last_activity: datetime  # 🆕 추가

class SSEManager:
    def cleanup_stale_sessions(self, max_idle_seconds: int = 30):
        """오래된 비활성 세션 정리"""
        now = datetime.now()
        stale_sessions = [
            s for s in self.active_sessions.values()
            if (now - s.last_activity).total_seconds() > max_idle_seconds
        ]
        
        for session in stale_sessions:
            await self.disconnect_session(session.session_id, reason="세션 만료 (비활성)")
    
    def cleanup_same_device_sessions(self, client_id: str):
        """같은 기기(ClientId)의 이전 세션 강제 종료"""
        same_device_sessions = [
            s for s in self.active_sessions.values()
            if s.client_id == client_id
        ]
        
        for session in same_device_sessions:
            await self.disconnect_session(session.session_id, reason="같은 기기에서 재접속")
```

**개선 사항**:
- ✅ `last_activity` 추적으로 좀비 세션 감지
- ✅ 주기적 세션 정리 작업 (예: 30초마다)
- ✅ `client_id` 기반 정확한 세션 관리

---

### 5. 백엔드: 로그아웃 API 추가

#### 신규 생성: `backend/routers/auth.py`에 로그아웃 엔드포인트 추가

```python
from fastapi import APIRouter, Depends, Header
from backend.services.sse_manager import sse_manager

@router.post("/logout")
async def logout(
    x_client_id: str = Header(None),
    current_user = Depends(get_current_user)
):
    """
    로그아웃 시 해당 사용자의 모든 SSE 세션 강제 종료
    """
    # ClientId 기반으로 세션 찾아서 종료
    if x_client_id:
        await sse_manager.cleanup_same_device_sessions(x_client_id)
    
    return {"message": "로그아웃 완료"}
```

**프론트엔드에서 호출**:
```typescript
const handleLogout = async () => {
    const clientId = localStorage.getItem('client_id');
    
    // 서버에 로그아웃 요청 (SSE 세션 정리)
    await api.post('/auth/logout', {}, {
        headers: { 'X-Client-Id': clientId }
    });
    
    // 로컬 정리
    localStorage.clear();
    router.push('/login');
};
```

---

## 📊 구현 우선순위

| 항목 | 수정 파일 | 난이도 | 영향도 | 예상 시간 |
|------|----------|--------|--------|----------|
| 1. SSE 토큰 인식 | `useSSE.ts` | 하 | 높음 | 30분 |
| 2. 로그아웃 시 연결 정리 | `page.tsx` (로그아웃 핸들러) | 하 | 높음 | 20분 |
| 3. BroadcastChannel 구현 | 각 페이지 컴포넌트 | 중 | 중 | 1시간 |
| 4. Zustand reset 액션 | `useWaitingStore.ts` | 하 | 중 | 15분 |
| 5. 서버 세션 정리 로직 | `sse_manager.py` | 중 | 높음 | 1시간 |
| 6. 로그아웃 API | `auth.py` | 하 | 중 | 30분 |

**총 예상 시간**: 약 3~4시간

---

## 🧪 검증 계획

### 테스트 시나리오 1: 기본 로그아웃
1. **기기 A**에서 관리자 로그인 및 대기 화면 접속
2. **기기 A**에서 로그아웃 버튼 클릭
3. **즉시 기기 B**에서 로그인 시도
4. ✅ **예상 결과**: "접속 대수 초과" 없이 즉시 접속 성공

### 테스트 시나리오 2: 다중 탭 환경
1. **브라우저**에서 관리자 화면을 3개 탭으로 오픈
2. **탭 1**에서 로그아웃
3. ✅ **예상 결과**: 
   - 탭 2, 3도 자동으로 로그인 페이지로 리다이렉트
   - 모든 SSE 연결 종료

### 테스트 시나리오 3: 네트워크 불안정
1. 관리자 화면 접속 후 **네트워크 차단** (개발자 도구 Offline 모드)
2. 30초 대기
3. **네트워크 복구**
4. ✅ **예상 결과**: 자동 재연결되거나 좀비 세션 정리 후 새 연결 생성

### 테스트 시나리오 4: 강제 종료
1. 관리자 화면 접속
2. **브라우저 탭 강제 종료** (X 버튼)
3. 새 브라우저/탭에서 즉시 재접속
4. ✅ **예상 결과**: 
   - 이전 세션 자동 정리 (최대 30초 이내)
   - 정상 접속

---

## 📈 기대 효과

### 사용자 경험 개선
- ✅ 로그아웃 후 즉시 재접속 가능
- ✅ "접속 대수 초과" 오류 해소
- ✅ 다중 탭 사용 시 일관된 로그아웃 경험

### 시스템 안정성 향상
- ✅ 좀비 세션 자동 정리로 메모리 누수 방지
- ✅ 서버 부하 감소 (불필요한 재연결 시도 제거)
- ✅ SSE 연결 상태의 정확성 향상

### 유지보수성 개선
- ✅ ClientId 기반 명확한 세션 관리
- ✅ 로그 추적 용이
- ✅ 디버깅 시간 단축

---

## ⚠️ 주의사항 및 제약

### 1. BroadcastChannel 브라우저 호환성
- **지원**: Chrome 54+, Firefox 38+, Safari 15.4+
- **미지원**: Internet Explorer
- **대응**: localStorage 이벤트를 fallback으로 사용

### 2. 서버 세션 정리 주기
- 너무 짧으면: 일시적 네트워크 끊김 시에도 세션 종료
- 너무 길면: 좀비 세션이 오래 남아있음
- **권장**: 30초 (조정 가능)

### 3. 로그아웃 API 호출 실패 시
- 네트워크 오류로 API 호출 실패 가능
- 프론트엔드에서 로컬 정리는 반드시 수행
- 서버는 주기적 정리 작업으로 보완

---

## 🔗 관련 파일

### 프론트엔드
- `frontend/hooks/useSSE.ts` - SSE 연결 관리
- `frontend/app/page.tsx` - 로그아웃 핸들러
- `frontend/lib/store/useWaitingStore.ts` - 상태 관리

### 백엔드
- `backend/services/sse_manager.py` - SSE 세션 관리
- `backend/routers/auth.py` - 인증/로그아웃 API
- `backend/routers/sse.py` - SSE 엔드포인트

---

## 📝 참고 자료

### 기술 문서
- [MDN - Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN - BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

### 관련 이슈
- 접속 제한 정책 분석 (`Connection_Policy_Analysis.md`)
- SSE 500 에러 핫픽스 (`hotfix_sse_500.md`)

---

**작성일**: 2025-12-25  
**버전**: v1.0  
**상태**: 검토 완료, 구현 대기
