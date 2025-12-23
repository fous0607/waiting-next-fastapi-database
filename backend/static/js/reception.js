console.log('=== RECEPTION DESK SCRIPT LOADED - Version: 2025-12-07-16:56 ===');

let phoneNumber = '';
let storeSettings = null;

// 요일 매핑 (JavaScript getDay(): 0=일요일, 1=월요일, ...)
const WEEKDAY_MAP = {
    0: "sun",   // Sunday
    1: "mon",   // Monday
    2: "tue",   // Tuesday
    3: "wed",   // Wednesday
    4: "thu",   // Thursday
    5: "fri",   // Friday
    6: "sat"    // Saturday
};

// 오늘 요일에 맞는 클래스만 필터링
function filterClassesByToday(classList) {
    const today = new Date();
    const weekday = WEEKDAY_MAP[today.getDay()];

    return classList.filter(cls => {
        // weekday_schedule이 없으면 모든 요일 운영으로 간주
        if (!cls.weekday_schedule) {
            return true;
        }

        const schedule = typeof cls.weekday_schedule === 'string'
            ? JSON.parse(cls.weekday_schedule)
            : cls.weekday_schedule;

        // 해당 요일이 활성화되어 있으면 포함
        return schedule[weekday] === true;
    });
}

// Helper function to get headers with store ID and Auth token
function getHeaders(additionalHeaders = {}) {
    const headers = { ...additionalHeaders };

    // 매장 ID 설정
    const storeId = localStorage.getItem('selected_store_id');
    if (storeId) {
        headers['X-Store-Id'] = storeId;
    }

    // 인증 토큰 설정
    const token = localStorage.getItem('access_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}

async function loadStoreInfo() {
    try {
        const response = await fetch('/api/store/', {
            headers: getHeaders()
        });

        if (response.status === 401) {
            console.error('인증 실패, 로그인 페이지로 이동');
            window.location.href = '/reception-login';
            return;
        }

        if (!response.ok) {
            throw new Error(`Store API error: ${response.status}`);
        }

        storeSettings = await response.json();
        document.getElementById('storeName').textContent = storeSettings.store_name;

        // 키패드 스타일 적용
        applyKeypadStyles();

        await loadWaitingStatus();
    } catch (error) {
        console.error('매장 정보 조회 실패:', error);
        document.getElementById('waitingCount').textContent = '매장 정보 오류';
        // 인증 토큰이 없거나 만료된 경우 로그인 페이지로 리다이렉트
        if (!localStorage.getItem('access_token')) {
            window.location.href = '/reception-login';
        }
    }
}

function applyKeypadStyles() {
    const container = document.querySelector('.reception-container');
    if (!container || !storeSettings) return;

    // 기존 스타일 클래스 제거
    container.classList.remove('keypad-style-modern', 'keypad-style-bold', 'keypad-style-dark', 'keypad-style-colorful');
    container.classList.remove('keypad-font-small', 'keypad-font-medium', 'keypad-font-large', 'keypad-font-xlarge');

    // 새 스타일 클래스 추가
    const style = storeSettings.keypad_style || 'modern';
    const fontSize = storeSettings.keypad_font_size || 'large';

    container.classList.add(`keypad-style-${style}`);
    container.classList.add(`keypad-font-${fontSize}`);

    console.log(`✅ Keypad style applied: ${style}, Font size: ${fontSize}`);
}

async function loadWaitingStatus() {
    try {
        // Call the Single Source of Truth API
        const response = await fetch('/api/waiting/next-slot', {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        const statusDiv = document.getElementById('waitingStatus');
        const countDiv = document.getElementById('waitingCount');
        const submitBtn = document.getElementById('submitBtn');

        // Display Next Slot Info
        if (data.is_full && data.class_id === -1) {
            // Full or Closed
            statusDiv.className = 'waiting-status full';
            countDiv.textContent = data.class_name; // "접수 마감" or "운영 교시 없음"
            submitBtn.disabled = true;
            submitBtn.textContent = data.class_name;
            isRegistrationClosed = true;
            document.getElementById('closedOverlay').classList.add('active');
        } else {
            // Available
            statusDiv.className = 'waiting-status';
            countDiv.textContent = `${data.class_name} ${data.class_order}번째 / ${data.max_capacity}명`;

            submitBtn.disabled = false;
            submitBtn.textContent = '대기 접수';
            isRegistrationClosed = false;
            document.getElementById('closedOverlay').classList.remove('active');

            // Optional: Warning logic if approaching limit (e.g. 90%)
            const isNearFull = (data.class_order > data.max_capacity * 0.9);
            if (isNearFull) {
                statusDiv.className = 'waiting-status warning';
            }
        }

        // Global Limit Check (if needed, but backend handles it mostly)
        // If using storeSettings.max_waiting_limit, we can check data.total_waiting
        const maxLimit = storeSettings?.max_waiting_limit || 0;
        if (storeSettings?.use_max_waiting_limit && maxLimit > 0) {
            if (data.total_waiting >= maxLimit) {
                statusDiv.className = 'waiting-status full';
                countDiv.textContent = '대기 인원 초과'; // Override
                submitBtn.disabled = true;
                submitBtn.textContent = '대기 인원 초과';
                isRegistrationClosed = true;
                document.getElementById('closedOverlay').classList.add('active');
            }
        }

    } catch (error) {
        console.error('대기 현황 조회 실패:', error);
        document.getElementById('waitingCount').innerHTML = `오류<br><span style="font-size:12px">${error.message}</span>`;
    }
}

async function updateDate() {
    try {
        const response = await fetch('/api/daily/check-status', { headers: getHeaders() });
        const status = await response.json();

        if (status && status.business_date) {
            const dateObj = new Date(status.business_date);
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const day = dateObj.getDate();
            document.getElementById('currentDate').textContent = `${year}년 ${month}월 ${day}일`;
        } else {
            // Fallback to local date if not open or error
            const now = new Date();
            document.getElementById('currentDate').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
        }
    } catch (error) {
        console.error('영업일 조회 실패:', error);
        const now = new Date();
        document.getElementById('currentDate').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
    }
}

let isRegistrationClosed = false; // 접수 마감 상태 추적

// 오디오 컨텍스트 초기화 (Web Audio API)
let audioContext = null;
let speechSynthesisReady = false;

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // AudioContext가 suspended 상태면 resume
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// 음성 합성 초기화 (사용자 상호작용 후 활성화)
function initSpeechSynthesis() {
    if (!speechSynthesisReady && 'speechSynthesis' in window) {
        try {
            // 빈 음성을 재생하여 초기화 (브라우저 보안 정책 회피)
            const utterance = new SpeechSynthesisUtterance('');
            utterance.volume = 0;
            utterance.lang = 'ko-KR';

            // 음성 로드 대기
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                const koreanVoice = voices.find(v => v.lang.startsWith('ko'));
                if (koreanVoice) {
                    utterance.voice = koreanVoice;
                }
            }

            window.speechSynthesis.speak(utterance);
            speechSynthesisReady = true;
            console.log('Speech synthesis initialized');
        } catch (error) {
            console.error('Speech synthesis init error:', error);
        }
    }
}

// 버튼 클릭 소리 (최적화된 버전)
function playClickSound() {
    try {
        initAudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // 800Hz 톤
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);
    } catch (error) {
        console.error('Click sound error:', error);
    }
}

// 제출 버튼 클릭 소리
function playSubmitSound() {
    try {
        initAudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 1200; // 1200Hz 톤 (더 높은 음)
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.error('Submit sound error:', error);
    }
}

// 음성 안내 (Web Speech API)
function speakMessage(message) {
    try {
        if ('speechSynthesis' in window) {
            // 음성 합성이 초기화되지 않았으면 초기화 시도
            if (!speechSynthesisReady) {
                initSpeechSynthesis();
            }

            // 기존 음성 취소
            window.speechSynthesis.cancel();

            // 짧은 대기 후 재생 (취소 후 즉시 재생 방지)
            setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'ko-KR';
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;

                // 한국어 음성 선택
                const voices = window.speechSynthesis.getVoices();
                if (voices.length > 0) {
                    const koreanVoice = voices.find(v => v.lang.startsWith('ko'));
                    if (koreanVoice) {
                        utterance.voice = koreanVoice;
                    }
                }

                // 음성 로드 대기 후 재생
                if (window.speechSynthesis.getVoices().length === 0) {
                    window.speechSynthesis.addEventListener('voiceschanged', function () {
                        window.speechSynthesis.speak(utterance);
                    }, { once: true });
                } else {
                    window.speechSynthesis.speak(utterance);
                }

                console.log('Speech message queued:', message);
            }, 100);
        }
    } catch (error) {
        console.error('Speech synthesis error:', error);
    }
}

function inputNumber(num) {
    if (isRegistrationClosed) {
        return; // 오버레이가 표시되므로 알림 없이 리턴
    }

    initSpeechSynthesis(); // 사용자 상호작용 시 음성 초기화
    playClickSound(); // 클릭 소리 재생

    // 입력 제한 로직 (스마트 감지)
    if (phoneNumber.startsWith('010')) {
        // 전체 핸드폰 번호 (010...) -> 11자리 제한
        if (phoneNumber.length >= 11) {
            // 11자리 입력 완료 시 안내 메시지
            showErrorModal('핸드폰번호가 입력되었습니다.\n대기 접수를 눌러 주세요.');
            return;
        }
    } else {
        // Suffix 모드 (010 없이 입력)
        if (phoneNumber.length >= 8) {
            // 8자리 입력 완료 시 안내 메시지
            showErrorModal('핸드폰번호가 입력되었습니다.\n대기 접수를 눌러 주세요.');
            return;
        }
    }

    phoneNumber += num;
    updateDisplay();
}


function backspace() {
    if (isRegistrationClosed) {
        return; // 오버레이가 표시되므로 알림 없이 리턴
    }
    playClickSound(); // 클릭 소리 재생
    if (phoneNumber.length > 0) {
        phoneNumber = phoneNumber.slice(0, -1);
        updateDisplay();
    }
}

function clearInput() {
    if (isRegistrationClosed) {
        return; // 오버레이가 표시되므로 알림 없이 리턴
    }
    playClickSound(); // 클릭 소리 재생
    phoneNumber = '';
    updateDisplay();
}

function updateDisplay() {
    const display = document.getElementById('phoneDisplay');
    const submitBtn = document.getElementById('submitBtn');

    if (phoneNumber.length === 0) {
        display.textContent = '010-____-____'; // Default hint
        submitBtn.disabled = true;
        return;
    }

    // Case 1: Full Phone Number (Starts with 010)
    if (phoneNumber.startsWith('010')) {
        let formatted = phoneNumber;
        if (phoneNumber.length > 7) {
            formatted = phoneNumber.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
        } else if (phoneNumber.length > 3) {
            formatted = phoneNumber.replace(/(\d{3})(\d{1,4})/, '$1-$2');
        }
        display.textContent = formatted;

        // Enable submit if valid length (11 for phone)
        submitBtn.disabled = (phoneNumber.length !== 11);
        return;
    }

    // Case 2: Barcode / Long Number (Length > 8 and NO 010 prefix)
    if (phoneNumber.length > 8) {
        // Show raw digits
        display.textContent = phoneNumber;
        submitBtn.disabled = false; // Allow submission of barcode
        return;
    }

    // Case 3: Phone Suffix (Length <= 8, treated as 010 suffix)
    // Suffix formatting: XXXX-XXXX
    let part1 = '', part2 = '';
    if (phoneNumber.length <= 4) {
        part1 = phoneNumber.padEnd(4, '_');
        part2 = '____';
    } else {
        part1 = phoneNumber.substring(0, 4);
        part2 = phoneNumber.substring(4).padEnd(4, '_');
    }
    display.textContent = `010-${part1}-${part2}`;
    submitBtn.disabled = (phoneNumber.length !== 8);
}

async function submitReception() {
    let payload = {};

    // Smart input classification for payload
    if (phoneNumber.startsWith('010')) {
        if (phoneNumber.length !== 11) {
            showErrorModal('전체 핸드폰번호 11자리를 입력해주세요.');
            return;
        }
        payload = { phone: phoneNumber };
    } else if (phoneNumber.length > 8) {
        // Barcode Lookup Logic
        try {
            const searchRes = await fetch(`/api/members/?search=${phoneNumber}`, { headers: getHeaders() });
            if (searchRes.ok) {
                const members = await searchRes.json();
                if (members && members.length > 0) {
                    // Found member! Use their phone.
                    payload = { phone: members[0].phone };
                } else {
                    showErrorModal('해당 바코드로 등록된 회원이 없습니다.');
                    return;
                }
            } else {
                // Search failed
                showErrorModal('회원 조회 중 오류가 발생했습니다.');
                return;
            }
        } catch (e) {
            console.error("Member lookup failed", e);
            showErrorModal("시스템 오류");
            return;
        }

    } else {
        // Suffix (8 digits)
        if (phoneNumber.length !== 8) {
            showErrorModal('핸드폰번호 뒷자리 8자를 입력해주세요.');
            return;
        }
        payload = { phone: '010' + phoneNumber };
    }

    playSubmitSound(); // 제출 버튼 클릭 소리 재생
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '접수 중...';

    try {
        const response = await fetch('/api/waiting/register', {
            method: 'POST',
            headers: getHeaders({
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            showResult(result);
            showResult(result);

            // 음성 안내 재생 (설정이 켜져있는 경우)
            if (storeSettings && storeSettings.enable_waiting_voice_alert) {
                let voiceMessage = `${result.class_name} 대기 접수 되었습니다`;
                // 커스텀 메시지가 있으면 그것을 사용
                if (storeSettings.waiting_voice_message && storeSettings.waiting_voice_message.trim() !== '') {
                    voiceMessage = storeSettings.waiting_voice_message;
                }
                speakMessage(
                    voiceMessage,
                    storeSettings.waiting_voice_name,
                    storeSettings.waiting_voice_rate || 1.0,
                    storeSettings.waiting_voice_pitch || 1.0
                );
            }

            clearInput();
            // 대기 현황 업데이트
            await loadWaitingStatus();
        } else {
            const error = await response.json();
            // 교시 접수 마감 에러 처리
            if (error.detail && error.detail.includes('교시 접수가 마감')) {
                showErrorModal(error.detail);
                await loadWaitingStatus(); // 상태 새로고침
            } else {
                showErrorModal(error.detail || '접수에 실패했습니다.');
            }
        }
    } catch (error) {
        console.error('접수 실패:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        showErrorModal('접수 중 오류가 발생했습니다. 콘솔을 확인해주세요.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '대기 접수';
    }
}

function showResult(result) {
    const message = document.getElementById('resultMessage');

    // Settings (Default fallback)
    const timeout = (storeSettings && storeSettings.waiting_modal_timeout) ? storeSettings.waiting_modal_timeout * 1000 : 5000;
    const showName = (storeSettings && storeSettings.show_member_name_in_waiting_modal !== undefined) ? storeSettings.show_member_name_in_waiting_modal : true;
    const showNew = (storeSettings && storeSettings.show_new_member_text_in_waiting_modal !== undefined) ? storeSettings.show_new_member_text_in_waiting_modal : true;

    // Display Logic
    let greeting = '';
    if (result.is_new_member) {
        if (showNew) {
            greeting = '<span style="color: #ff6b6b">신규회원님</span>';
        }
    } else {
        if (showName) {
            greeting = result.name ? `<span style="color: #2c3e50">${result.name}님</span>` : '회원님';
        }
    }

    let greetingHtml = '';
    if (greeting) {
        greetingHtml = `<div style="font-size: 42px; font-weight: 700; margin-bottom: 10px;">${greeting}</div>`;
    }

    message.innerHTML = `
                ${greetingHtml}
                <div style="font-size: 80px; font-weight: 700; color: #3498db; margin-bottom: 30px;">
                    ${result.waiting_number}번
                </div>
                <div style="font-size: 56px; font-weight: 700; color: #2c3e50; margin-bottom: 20px;">
                    ${result.class_name}
                </div>
                <div style="font-size: 36px; color: #7f8c8d;">
                    ${result.class_order}번째 대기 <span style="color: #e74c3c; font-weight: 800; margin-left: 10px;">접수 되었습니다.</span>
                </div>
            `;

    const modal = document.getElementById('resultModal');
    modal.classList.add('active');

    // Auto-close based on settings
    if (window.resultModalTimer) clearTimeout(window.resultModalTimer);
    window.resultModalTimer = setTimeout(() => {
        closeModal();
    }, timeout);
}

function closeModal() {
    const modal = document.getElementById('resultModal');
    modal.classList.remove('active');
    if (window.resultModalTimer) {
        clearTimeout(window.resultModalTimer);
        window.resultModalTimer = null;
    }
}

let errorModalTimer = null;

function showErrorModal(message) {
    // 메시지를 줄바꿈(\n)으로 분리
    const lines = message.split('\n');
    const mainMessage = lines[0] || message; // 첫 번째 줄
    const subMessage = lines.slice(1).join('\n'); // 나머지 줄들

    const errorMessageMain = document.getElementById('errorMessageMain');
    const errorMessageSub = document.getElementById('errorMessageSub');

    errorMessageMain.textContent = mainMessage;
    errorMessageSub.textContent = subMessage;

    const modal = document.getElementById('errorModal');
    modal.classList.add('active');

    // Clear existing timer if any
    if (errorModalTimer) {
        clearTimeout(errorModalTimer);
    }

    // Auto-close after 3 seconds
    errorModalTimer = setTimeout(() => {
        closeErrorModal();
    }, 3000);
}

function closeErrorModal() {
    const modal = document.getElementById('errorModal');
    modal.classList.remove('active');

    // Clear timer when manually closed
    if (errorModalTimer) {
        clearTimeout(errorModalTimer);
        errorModalTimer = null;
    }
}

// 키보드 입력 지원
document.addEventListener('keydown', (e) => {
    // ESC 키로 에러 모달 닫기
    if (e.key === 'Escape') {
        const errorModal = document.getElementById('errorModal');
        const resultModal = document.getElementById('resultModal');

        if (errorModal.classList.contains('active')) {
            closeErrorModal();
            return;
        } else if (resultModal.classList.contains('active')) {
            closeModal();
            return;
        } else {
            clearInput();
            return;
        }
    }

    if (e.key >= '0' && e.key <= '9') {
        inputNumber(e.key);
    } else if (e.key === 'Backspace') {
        backspace();
    } else if (e.key === 'Enter' && phoneNumber.length === 8) {
        submitReception();
    }
});

// 모달 외부 클릭 시 닫기
document.getElementById('errorModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeErrorModal();
    }
});

document.getElementById('resultModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeModal();
    }
});

// URL 파라미터에서 매장 정보 가져오기
async function checkUrlStoreParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');

    if (storeParam) {
        try {
            const response = await fetch(`/ api / stores / code / ${storeParam} `);
            if (response.ok) {
                const store = await response.json();
                localStorage.setItem('selected_store_id', store.id);
                localStorage.setItem('selected_store_name', store.name);
                console.log(`URL 매장 파라미터 적용: ${store.name} (코드: ${storeParam})`);
            } else {
                console.error('매장 코드를 찾을 수 없습니다:', storeParam);
            }
        } catch (e) {
            console.error('매장 정보 조회 실패:', e);
        }
    }
}

// 음성 안내 함수
function speakMessage(message, voiceName = null, rate = 1.0, pitch = 1.0) {
    if (!window.speechSynthesis) return;

    // 기존 음성 중지
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'ko-KR';
    utterance.rate = rate;
    utterance.pitch = pitch;

    if (voiceName) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(voice => voice.name === voiceName);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
    }

    window.speechSynthesis.speak(utterance);
}

// 초기 로드
async function init() {
    console.log('[INIT] Starting reception desk initialization...');
    await checkUrlStoreParam();
    loadStoreInfo();
    updateDate();
    updateDisplay();
    console.log('[INIT] Basic initialization complete, setting up SSE...');

    // SSE 연결 설정 (실시간 업데이트 - 트래픽 효율적)
    const storeId = localStorage.getItem('selected_store_id');
    console.log('[SSE] Initializing SSE connection for store:', storeId);

    if (storeId) {
        const sseUrl = `/api/sse/stream?store_id=${storeId}`;
        console.log('[SSE] Connecting to:', sseUrl);

        let eventSource = null;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        async function connectSSE() {
            try {
                // Check if reception desk is enabled
                // URL 수정: /api/store/sse-status> /api/store/
                let isEnabled = true;
                try {
                    const statusResponse = await fetch('/api/store/sse-status', { headers: getHeaders() });
                    if (statusResponse.ok) {
                        const status = await statusResponse.json();
                        isEnabled = status.enable_reception_desk;
                    } else {
                        console.warn('[SSE] Failed to fetch status, defaulting to enabled. Status:', statusResponse.status);
                    }
                } catch (fetchError) {
                    console.warn('[SSE] Network error fetching status, defaulting to enabled:', fetchError);
                }

                if (!isEnabled) {
                    console.log('[SSE] Reception desk is disabled. Registration blocked.');
                    // Show disabled overlay
                    showDisabledOverlay();
                    // Poll for status change every 30 seconds
                    setTimeout(connectSSE, 30000);
                    return;
                } else {
                    // Enable interface if previously disabled
                    hideDisabledOverlay();
                }

                // Reception desk is enabled, proceed with SSE connection
                // Debounce Utility
                function debounce(func, wait) {
                    let timeout;
                    return function executedFunction(...args) {
                        const later = () => {
                            clearTimeout(timeout);
                            func(...args);
                        };
                        clearTimeout(timeout);
                        timeout = setTimeout(later, wait);
                    };
                }

                // Debounced loadWaitingStatus
                const debouncedLoadWaitingStatus = debounce(() => loadWaitingStatus(), 300);

                eventSource = new EventSource(sseUrl);

                eventSource.onopen = () => {
                    console.log('[SSE] ✅ Connection opened successfully');
                    reconnectAttempts = 0; // 연결 성공 시 재시도 카운터 리셋
                };

                // 백엔드(sse_manager.py)가 모든 이벤트를 generic 'message' 타입으로 보내고
                // 페이로드 내부에 event 타입을 포함하는 방식이므로, onmessage 하나로 처리합니다.
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        // console.log('[SSE] 📥 Message received:', data);

                        // data.event 필드로 이벤트 타입 확인
                        if (data.event === 'new_user') {
                            console.log('[SSE] 📥 new_user event detected');
                            debouncedLoadWaitingStatus();
                        }
                        else if (data.event === 'status_change' || data.event === 'status_changed') {
                            console.log('[SSE] 📥 status_change event detected');
                            debouncedLoadWaitingStatus();
                        }
                        else if (data.event === 'class_closed' || data.event === 'class_reopened') {
                            console.log('[SSE] 📥 class status changed');
                            debouncedLoadWaitingStatus();
                        }
                        else if (data.event === 'ping') {
                            // Heartbeat - ignore
                        }
                        else if (data.event === 'connected') {
                            console.log('[SSE] Connected confirmed');
                        }
                    } catch (e) {
                        console.error('[SSE] Error parsing event data:', e);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error('[SSE] ❌ Connection error');

                    // EventSource는 자동으로 재연결을 시도하지만,
                    // 완전히 실패한 경우 수동 재연결
                    if (eventSource.readyState === EventSource.CLOSED) {
                        eventSource.close();

                        if (reconnectAttempts < maxReconnectAttempts) {
                            reconnectAttempts++;
                            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // 지수 백오프 (최대 30초)
                            console.log(`[SSE] 🔄 Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
                            setTimeout(connectSSE, delay);
                        } else {
                            console.error('[SSE] ⛔ Max reconnection attempts reached. Please refresh the page.');
                        }
                    }
                };
            } catch (e) {
                console.error('[SSE] Failed to check status or create EventSource:', e);
            }
        }

        // 초기 연결 시작
        connectSSE();

    } else {
        console.warn('[SSE] ⚠️ No store ID found in localStorage');
        console.warn('[SSE] Please select a store first');
    }

    // 첫 번째 사용자 상호작용 시 오디오 및 음성 합성 초기화
    const initAudio = () => {
        initAudioContext();
        initSpeechSynthesis();
    };

    // 클릭 또는 터치 시 한 번만 실행
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
}

init();

