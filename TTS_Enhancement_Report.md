# 음성 안내(TTS) 기능 강화 작업 보고서

**작업 일시**: 2025-12-25  
**작업자**: Antigravity AI Assistant  
**프로젝트**: 대기 관리 시스템 (waiting-next-fastapi-database)

---

## 📋 작업 개요

대기접수 및 호출 시 사용되는 음성 안내(TTS) 기능을 강화하여 다양한 목소리, 속도 조절, 커스텀 메시지 등을 지원하도록 개선하였습니다.

---

## 🎯 주요 구현 기능

### 1. 음성 다양화 (Voice Selection)
- **시스템 목소리 자동 감지**: `window.speechSynthesis.getVoices()`를 통해 한국어(ko-KR) 목소리를 자동으로 검색
- **성별/유형 분류**: 목소리 이름 기반으로 [여성], [남성], [공공/기타]로 자동 분류
- **설정 저장**: 선택한 목소리를 `waiting_voice_name`에 저장하여 지속적으로 사용

### 2. 속도 조절 (Speed Control)
- **5단계 속도 옵션**:
  - 느리게 (0.7x)
  - 조금 느리게 (0.8x)
  - 보통 (1.0x) - 기본값
  - 조금 빠르게 (1.2x)
  - 빠르게 (1.5x)
- **설정 저장**: `waiting_voice_rate`에 float 값으로 저장

### 3. 커스텀 메시지
- **접수 완료 메시지** (`waiting_voice_message`):
  - 예: "{클래스명} {회원명}님 대기 접수 되었습니다."
  - 대기접수 데스크에서 사용
- **호출 시 메시지** (`waiting_call_voice_message`):
  - 예: "{순번}번 {회원명}님, 데스크로 오시기 바랍니다."
  - 대기현황판에서 사용
- **지원 플레이스홀더**: `{클래스명}`, `{회원명}`, `{순번}`

### 4. 미리듣기 기능
- 설정 화면에서 즉시 테스트 가능
- 현재 선택된 목소리, 속도, 메시지로 실제 음성 출력

### 5. 대기현황판 호출 음성 안내
- 관리자가 '호출' 버튼 클릭 시 대기현황판에서 자동으로 음성 안내
- SSE `user_called` 이벤트 수신 시 자동 재생
- 커스텀 메시지 지원

---

## 🔧 수정된 파일

### Backend

#### 1. `/backend/models.py`
```python
# 추가된 필드
waiting_call_voice_message = Column(String, default="{순번}번 {회원명}님, 데스크로 오시기 바랍니다.")
```
호출 시 사용할 커스텀 메시지를 저장하는 필드 추가

#### 2. `/backend/schemas.py`
```python
# StoreSettingsBase에 추가
waiting_call_voice_message: Optional[str] = "{순번}번 {회원명}님, 데스크로 오시기 바랍니다."

# StoreSettingsUpdate에 추가
waiting_call_voice_message: Optional[str] = None
```
API 스키마에 호출 메시지 필드 추가

### Frontend

#### 3. `/frontend/components/settings/GeneralSettings.tsx`
**주요 변경사항**:
- `settingsSchema`에 `waiting_call_voice_message`, `waiting_voice_name`, `waiting_voice_rate`, `waiting_voice_pitch` 추가
- `voices` state 추가 및 `useEffect`로 시스템 목소리 로드
- `handlePreviewVoice` 함수 구현
- UI 추가:
  - 접수 완료 안내 메시지 입력
  - 호출 시 안내 메시지 입력
  - 목소리 선택 드롭다운
  - 말하기 속도 선택
  - 미리듣기 버튼

**라인 76-82** (Schema):
```typescript
waiting_voice_message: z.string().optional().nullable(),
waiting_call_voice_message: z.string().optional().nullable(),
waiting_voice_name: z.string().optional().nullable(),
waiting_voice_rate: z.coerce.number().min(0.1).max(2.0).default(1.0),
waiting_voice_pitch: z.coerce.number().min(0).max(2).default(1.0),
```

**라인 143-175** (Voice Loading):
```typescript
useEffect(() => {
    const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        const koVoices = availableVoices.filter(v => v.lang.includes('ko'));
        setVoices(koVoices.length > 0 ? koVoices : availableVoices);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
}, []);
```

**라인 648-737** (UI Components):
- 접수 완료 안내 메시지 (`FormField`)
- 호출 시 안내 메시지 (`FormField`)
- 목소리 선택 (`Select`)
- 말하기 속도 (`Select`)
- 미리듣기 버튼 (`Button`)

#### 4. `/frontend/app/board/page.tsx`
**주요 변경사항**:
- `BoardWaitingItem` 인터페이스 정의 (TypeScript 타입 에러 수정)
- `speak` 함수 구현
- `dataRef` 추가로 SSE 핸들러에서 최신 데이터 참조
- `user_called` 이벤트 핸들러에서 음성 안내 로직 추가

**라인 15-28** (Interface):
```typescript
interface BoardWaitingItem {
    id: number;
    waiting_number: number;
    display_name: string;
    class_id: number;
    class_name: string;
    class_order: number;
    is_empty_seat: boolean;
    status: string;
    call_count: number;
}
```

**라인 92-121** (Speak Function):
```typescript
const speak = useCallback((text: string) => {
    if (!storeSettings?.enable_waiting_voice_alert) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    
    const parts = text.split(/(\\s{2,})/);
    let currentTime = 0;

    parts.forEach((part) => {
        if (/^\\s{2,}$/.test(part)) {
            const delayCount = Math.floor(part.length / 2);
            currentTime += delayCount * 500;
        } else if (part.trim()) {
            setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(part.trim());
                utterance.lang = 'ko-KR';
                utterance.rate = storeSettings?.waiting_voice_rate || 1.0;
                utterance.pitch = storeSettings?.waiting_voice_pitch || 1.0;

                if (storeSettings?.waiting_voice_name) {
                    const voices = window.speechSynthesis.getVoices();
                    const voice = voices.find(v => v.name === storeSettings.waiting_voice_name);
                    if (voice) utterance.voice = voice;
                }
                window.speechSynthesis.speak(utterance);
            }, currentTime);
            currentTime += part.length * 100;
        }
    });
}, [storeSettings]);
```

**라인 219-231** (Call Announcement):
```typescript
case 'user_called':
    if (message.data?.waiting_id) {
        const calledItem = dataRef.current?.waiting_list.find(item => item.id === message.data.waiting_id);
        if (calledItem) {
            const customMsg = storeSettings?.waiting_call_voice_message || "{순번}번 {회원명}님, 데스크로 오시기 바랍니다.";
            const announcement = customMsg
                .replace('{회원명}', calledItem.display_name || '')
                .replace('{순번}', calledItem.waiting_number?.toString() || '');
            speak(announcement);
        }
    }
    debouncedReload();
    break;
```

---

## 🐛 해결된 빌드 오류

### 오류 1: Zod Schema 중복 속성
**증상**: `An object literal cannot have multiple properties with the same name`
**원인**: `settingsSchema`에서 `waiting_voice_name`, `waiting_voice_rate`, `waiting_voice_pitch`가 중복 정의됨
**해결**: 라인 93-96의 중복 정의 블록 제거

### 오류 2: TypeScript 타입 에러
**증상**: `Property 'display_name' does not exist on type 'WaitingItem'`
**원인**: `board/page.tsx`에서 `WaitingItem` 타입 사용 시 `display_name` 속성 누락
**해결**: `BoardWaitingItem` 인터페이스를 새로 정의하여 필요한 모든 속성 포함

---

## 📊 데이터베이스 스키마

### `store_settings` 테이블 추가 필드

| 필드명 | 타입 | 기본값 | 설명 |
|--------|------|--------|------|
| `waiting_call_voice_message` | String | "{순번}번 {회원명}님, 데스크로 오시기 바랍니다." | 호출 시 음성 안내 메시지 |
| `waiting_voice_name` | String | NULL | 선택된 목소리 이름 |
| `waiting_voice_rate` | Float | 1.0 | 음성 속도 (0.1 ~ 2.0) |
| `waiting_voice_pitch` | Float | 1.0 | 음성 높낮이 (0 ~ 2) |
| `waiting_voice_message` | String | "{클래스명} {회원명}님 대기 접수 되었습니다." | 접수 완료 시 음성 안내 메시지 |

---

## 🚀 Git 커밋 이력

```
eb109bc - fix: add v2.0 tag for UI verification
034cff8 - fix: remove duplicate properties in settingsSchema
aaf868c - fix: Add display_name to BoardWaitingItem interface
5a0658e - feat: Enhanced TTS with voice selection, speed control, and call announcements
```

---

## ⚠️ 현재 이슈

### UI 미노출 문제

**증상**: 사용자가 보는 화면에서 새로운 TTS 설정 UI가 나타나지 않음
**현재 상태**:
- 소스 코드에는 모든 변경사항이 정상 반영됨
- 빌드 성공 및 GitHub 푸시 완료
- 배포 환경 또는 브라우저 캐싱 문제로 추정

**대응**:
1. "대기접수 및 알림 설정" 섹션 제목에 "(v2.0)" 태그 추가
2. 강력 새로고침(Cmd+Shift+R 또는 Ctrl+F5) 요청
3. 버전 태그가 보이는지 확인 필요

**확인 필요 사항**:
- [ ] "(v2.0)" 태그가 보이는가?
- [ ] 태그가 보인다면, 새로운 설정 UI(목소리 선택, 속도 조절 등)가 나타나는가?
- [ ] 태그가 보이지 않는다면, 배포 환경 재확인 필요

---

## 📝 사용 방법

### 관리자 설정 방법
1. **설정 > 일반 설정**으로 이동
2. **"대기접수 및 알림 설정 (v2.0)"** 섹션 펼치기
3. **"음성 안내 사용"** 체크박스 활성화
4. 원하는 설정 조정:
   - 접수 완료 안내 메시지 입력
   - 호출 시 안내 메시지 입력 (대기현황판용)
   - 목소리 선택 (성별/유형별 분류됨)
   - 말하기 속도 선택
5. **"미리듣기 (Preview)"** 버튼으로 테스트
6. **"설정 저장"** 클릭

### 동작 방식
- **대기접수 완료 시**: 대기접수 데스크(`reception/page.tsx`)에서 `speak()` 함수 호출
- **고객 호출 시**: 관리자 화면에서 호출 → SSE 이벤트 → 대기현황판(`board/page.tsx`)에서 자동 음성 안내

---

## 🔍 기술적 세부사항

### TTS API 사용
- **API**: Web Speech API (`window.speechSynthesis`)
- **브라우저 호환성**: Chrome, Edge, Safari, Firefox (최신 버전)
- **목소리 가용성**: 운영체제 및 브라우저에 설치된 TTS 엔진에 의존

### 공백을 이용한 일시정지
- 메시지에 공백 2개 이상 연속 입력 시 0.5초 간격으로 일시정지
- 예: "1번 홍길동님,  데스크로 오시기 바랍니다." (쉼표와 "데스크" 사이에 0.5초 대기)

### SSE 이벤트 플로우
1. 관리자가 대기자 호출(`/board/{id}/call` API 호출)
2. 백엔드가 모든 연결된 클라이언트에 `user_called` 이벤트 브로드캐스트
3. 대기현황판이 이벤트 수신
4. `dataRef.current`에서 해당 대기자 정보 검색
5. 커스텀 메시지 템플릿에 실제 값 대입
6. `speak()` 함수로 음성 출력

---

## ✅ 테스트 체크리스트

- [x] 백엔드 모델에 필드 추가
- [x] 백엔드 스키마 업데이트
- [x] 프론트엔드 Zod 스키마 정의
- [x] 설정 UI 구현
- [x] 목소리 로딩 로직 구현
- [x] 미리듣기 기능 구현
- [x] 대기현황판 음성 안내 구현
- [x] TypeScript 빌드 오류 수정
- [ ] **사용자 환경에서 UI 확인 필요**
- [ ] 실제 음성 출력 테스트
- [ ] 다양한 브라우저에서 호환성 테스트

---

## 📌 향후 개선 사항 (선택)

1. **음성 높낮이(Pitch) UI 추가**: 현재는 스키마에만 정의되어 있고 UI 미구현
2. **음성 볼륨 조절**: `utterance.volume` 속성 활용
3. **다국어 지원**: 영어, 중국어 등 추가 언어 지원
4. **음성 녹음 및 업로드**: 커스텀 음성 파일 사용
5. **대기현황판 자동 반복 안내**: 5초마다 호출 안내 반복

---

## 📞 문의 및 지원

배포 환경 확인이나 추가 수정이 필요한 경우 연락 주시기 바랍니다.

**작성일**: 2025-12-25 22:19  
**버전**: v2.0
