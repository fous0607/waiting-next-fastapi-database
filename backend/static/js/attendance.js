// 공통 헤더 설정
function getHeaders() {
    const headers = {};
    const storeId = localStorage.getItem('selected_store_id');
    const token = localStorage.getItem('access_token');
    if (storeId) headers['X-Store-Id'] = storeId;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}



// 전역 변수 (순위 더보기용)
let currentRankingOffset = 0;
const RANKING_LIMIT = 20;
let isRankingLoading = false;
let rankingObserver = null;

// 전역 변수 (신규회원 더보기용)
let currentNewMemberOffset = 0;
let isNewMemberLoading = false;
let newMemberObserver = null;

// SSE(Server-Sent Events) 관련 변수
let eventSource = null;
let sseConnected = false;
let currentTab = 'waiting_status'; // 현재 활성화된 탭 추적

// SSE 연결 초기화
function initSSE() {
    if (eventSource) {
        eventSource.close();
    }

    const storeId = localStorage.getItem('selected_store_id');
    if (!storeId) {
        console.error('Store ID가 없습니다');
        return;
    }

    eventSource = new EventSource(`/api/sse/stream?store_id=${storeId}`);

    eventSource.onopen = () => {
        console.log('SSE 연결됨');
        sseConnected = true;
        updateSSEStatus(true);
    };

    eventSource.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleSSEMessage(message);
        } catch (error) {
            console.error('SSE 메시지 파싱 오류:', error);
        }
    };

    eventSource.onerror = (error) => {
        console.error('SSE 오류:', error);
        sseConnected = false;
        updateSSEStatus(false);

        // 3초 후 재연결 시도
        setTimeout(() => {
            console.log('SSE 재연결 시도...');
            initSSE();
        }, 3000);
    };
}

// SSE 연결 종료
function closeSSE() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
        sseConnected = false;
        updateSSEStatus(false);
    }
}

// SSE 메시지 처리
function handleSSEMessage(message) {
    console.log('SSE 메시지 수신:', message);

    switch (message.event) {
        case 'connected':
            console.log('SSE 연결 확인됨');
            break;

        case 'new_user':
            // 새 대기자 등록 시: 대기현황만 업데이트
            console.log('신규 대기자 등록 이벤트');
            if (currentTab === 'waiting_status') {
                loadWaitingStatus();
            }
            break;

        case 'status_changed':
            // 상태 변경 시: 해당 탭이 활성화되어 있으면 업데이트
            console.log('상태 변경 이벤트 (출석/취소)');
            if (currentTab === 'waiting_status') {
                loadWaitingStatus();
            }
            if (currentTab === 'status') {
                loadStatus();
            }
            break;

        case 'batch_attendance':
            // 일괄 출석 처리 시: 해당 탭이 활성화되어 있으면 업데이트
            console.log('일괄 출석 처리 이벤트');
            if (currentTab === 'waiting_status') {
                loadWaitingStatus();
            }
            if (currentTab === 'status') {
                loadStatus();
            }
            break;

        case 'class_closed':
        case 'class_reopened':
        case 'order_changed':
        case 'class_moved':
            // 기타 대기 관련 이벤트: 대기현황만 업데이트
            console.log('대기 관리 이벤트:', message.event);
            if (currentTab === 'waiting_status') {
                loadWaitingStatus();
            }
            break;

        default:
            console.log('처리하지 않는 이벤트:', message.event);
    }
}

// SSE 상태 UI 업데이트
function updateSSEStatus(connected) {
    // 대기현황 탭 상태 업데이트
    const statusElement = document.getElementById('autoRefreshStatus');
    const indicatorElement = document.getElementById('autoRefreshIndicator');

    // 출석현황 탭 상태 업데이트
    const statusTabElement = document.getElementById('statusTabStatus');
    const statusTabIndicator = document.getElementById('statusTabIndicator');

    if (connected) {
        // 대기현황 탭
        if (statusElement) {
            statusElement.textContent = '실시간 연결';
            statusElement.style.color = '#2ecc71';
        }
        if (indicatorElement) {
            indicatorElement.style.background = '#2ecc71';
            indicatorElement.style.animation = 'pulse 2s infinite';
        }

        // 출석현황 탭
        if (statusTabElement) {
            statusTabElement.textContent = '실시간 연결';
            statusTabElement.style.color = '#2ecc71';
        }
        if (statusTabIndicator) {
            statusTabIndicator.style.background = '#2ecc71';
            statusTabIndicator.style.animation = 'pulse 2s infinite';
        }
    } else {
        // 대기현황 탭
        if (statusElement) {
            statusElement.textContent = '연결 끊김';
            statusElement.style.color = '#e74c3c';
        }
        if (indicatorElement) {
            indicatorElement.style.background = '#e74c3c';
            indicatorElement.style.animation = 'none';
        }

        // 출석현황 탭
        if (statusTabElement) {
            statusTabElement.textContent = '연결 끊김';
            statusTabElement.style.color = '#e74c3c';
        }
        if (statusTabIndicator) {
            statusTabIndicator.style.background = '#e74c3c';
            statusTabIndicator.style.animation = 'none';
        }
    }
}

// 깜빡이는 애니메이션 CSS 추가


// 탭 전환
function switchTab(tabId) {
    // 현재 탭 저장
    currentTab = tabId;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 버튼 활성화 (인덱스 기반이 아니라 클릭된 요소 찾기 위해 event.target 대신 쿼리로 매칭)
    const buttons = document.querySelectorAll('.tab-btn');
    if (tabId === 'waiting_status') buttons[0].classList.add('active');
    if (tabId === 'status') buttons[1].classList.add('active');
    if (tabId === 'individual') buttons[2].classList.add('active');
    if (tabId === 'new_members') buttons[3].classList.add('active');
    if (tabId === 'ranking') buttons[4].classList.add('active');

    document.getElementById(tabId + 'Tab').classList.add('active');

    // SSE 연결 제어: 모든 탭에서 SSE 연결 유지
    // SSE는 전체 매장의 이벤트를 수신하므로 연결 유지
    if (!eventSource) {
        initSSE();
    }

    // 탭별 데이터 로드
    if (tabId === 'waiting_status') {
        loadWaitingStatus();
    } else if (tabId === 'status') {
        loadStatus();
    } else if (tabId === 'new_members') {
        loadNewMembers();
    } else if (tabId === 'ranking') {
        loadRanking();
    }
}

// 날짜 관련 유틸리티 함수
function formatDateToDisplay(dateString, period = 'daily') {
    if (!dateString) return '';
    const d = new Date(dateString);

    if (period === 'weekly') {
        // 해당 날짜가 포함된 주(월~일) 계산
        const day = d.getDay(); // 0:Sun, 1:Mon, ...
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(d);
        monday.setDate(diff);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const start = `${monday.getFullYear()}. ${String(monday.getMonth() + 1).padStart(2, '0')}. ${String(monday.getDate()).padStart(2, '0')}`;
        const end = `${sunday.getFullYear()}. ${String(sunday.getMonth() + 1).padStart(2, '0')}. ${String(sunday.getDate()).padStart(2, '0')}`;

        return `${start} ~ ${end}`;
    } else if (period === 'monthly') {
        return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else if (period === 'yearly') {
        return `${d.getFullYear()}`;
    }

    // Default (daily, custom, etc.)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}. ${month}. ${day}`;
}

function updateDateDisplay(input, displayId) {
    const display = document.getElementById(displayId);
    if (!display) return;

    // 어떤 탭의 어떤 기간 설정인지 확인
    // displayId 형식: {prefix}DateDisplay (예: waitingDateDisplay)
    const prefix = displayId.replace('DateDisplay', '').replace('EndDateDisplay', '');
    // EndDateDisplay인 경우는 custom 기간의 종료일이므로 항상 daily 포맷
    if (displayId.includes('EndDate')) {
        display.value = formatDateToDisplay(input.value, 'daily');
        return;
    }

    const periodSelect = document.getElementById(prefix + 'Period');
    const period = periodSelect ? periodSelect.value : 'daily';

    display.value = formatDateToDisplay(input.value, period);

    // 주간 선택 시 입력창 너비 조정 필요할 수 있음
    if (period === 'weekly') {
        display.parentElement.style.width = '240px';
    } else {
        display.parentElement.style.width = '150px';
    }
}

function handlePeriodChange(prefix) {
    const periodSelect = document.getElementById(prefix + 'Period');
    const container = document.getElementById(prefix + 'DateContainer');

    const isCustom = periodSelect.value === 'custom';
    const separator = periodSelect.parentElement.querySelector('.date-separator');
    const endDateWrapper = periodSelect.parentElement.querySelector('.date-end');

    if (separator) separator.style.display = isCustom ? 'inline' : 'none';
    if (endDateWrapper) endDateWrapper.style.display = isCustom ? 'inline-block' : 'none';

    // 기간 변경 시 날짜 표시 업데이트
    const dateInput = document.getElementById(prefix + 'Date');
    if (dateInput) {
        updateDateDisplay(dateInput, prefix + 'DateDisplay');
    }
}

// 날짜 초기화 (오늘)
const today = new Date().toISOString().split('T')[0];
const initialIds = ['waiting', 'status', 'individual', 'newMember', 'ranking'];

initialIds.forEach(id => {
    const dateInput = document.getElementById(id + 'Date');
    const endDateInput = document.getElementById(id + 'EndDate');
    if (dateInput) {
        dateInput.value = today;
        updateDateDisplay(dateInput, id + 'DateDisplay');
    }
    if (endDateInput) {
        endDateInput.value = today;
        updateDateDisplay(endDateInput, id + 'EndDateDisplay');
    }
});


// URL 파라미터에서 매장 정보 가져오기
async function checkUrlStoreParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');

    if (storeParam) {
        try {
            // 매장 코드로 매장 정보 조회
            const response = await fetch(`/api/stores/code/${storeParam}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });
            if (response.ok) {
                const store = await response.json();
                localStorage.setItem('selected_store_id', store.id);
                localStorage.setItem('selected_store_name', store.name);
                localStorage.setItem('selected_franchise_id', store.franchise_id);

                // 상단 제목 업데이트
                const header = document.getElementById('storeName');
                if (header) header.innerHTML = `대기 및 출석 현황 <span style="font-size: 18px; color: #7f8c8d;">(${store.name})</span>`;

                console.log(`URL 매장 파라미터 적용: ${store.name} (코드: ${storeParam})`);

                // SSE 재연결 (매장 ID 변경 시)
                if (eventSource) {
                    eventSource.close();
                    initSSE();
                }

                // 초기 데이터 로드 (매장 ID 설정 후)
                loadBusinessDate();

                // URL 파라미터로 탭이 지정된 경우 해당 탭 로드, 아니면 기본 탭 로드
                // --- 상세 출석 현황 모달 관련 JS ---
                let currentDetailMemberId = null;

                function openDetailModal(memberId, name, phone) {
                    currentDetailMemberId = memberId;
                    document.getElementById('detailMemberInfo').innerHTML = `<span style="font-weight:bold; color:#2c3e50;">${name}</span> <span style="font-size: 16px; color: #666;">(${phone})</span>`;

                    // 초기화: 이번달 기준
                    document.getElementById('detailPeriodType').value = 'monthly';
                    const today = new Date().toISOString().split('T')[0];
                    document.getElementById('detailBaseDate').value = today;
                    document.getElementById('detailStartDate').value = today;
                    document.getElementById('detailEndDate').value = today;

                    handleDetailPeriodChange(); // UI 업데이트

                    // 모달 표시
                    document.getElementById('detailAttendanceModal').style.display = 'flex';

                    // 데이터 로드
                    loadMemberDetailStats();
                }

                function closeDetailModal() {
                    document.getElementById('detailAttendanceModal').style.display = 'none';
                }

                function handleDetailPeriodChange() {
                    const type = document.getElementById('detailPeriodType').value;
                    const customDiv = document.getElementById('detailCustomDateRange');
                    const baseDateDiv = document.getElementById('detailDateContainer');

                    if (type === 'custom') {
                        customDiv.style.display = 'flex';
                        baseDateDiv.style.display = 'none';
                    } else {
                        customDiv.style.display = 'none';
                        baseDateDiv.style.display = 'inline-block';

                        // 날짜 표시 업데이트 추가
                        const dateInput = document.getElementById('detailBaseDate');
                        updateDateDisplay(dateInput, 'detailBaseDateDisplay');
                    }
                }

                async function loadMemberDetailStats() {
                    if (!currentDetailMemberId) return;

                    const period = document.getElementById('detailPeriodType').value;
                    const date = document.getElementById('detailBaseDate').value;

                    // API 호출 URL 생성 (Individual Tab과 동일한 API 사용)
                    let url = `/api/attendance/individual/${currentDetailMemberId}?period=${period}&date=${date}`;

                    if (period === 'custom') {
                        const startDate = document.getElementById('detailStartDate').value;
                        const endDate = document.getElementById('detailEndDate').value;
                        if (!startDate || !endDate) return alert("기간을 선택해주세요.");
                        url += `&start_date=${startDate}&end_date=${endDate}`;
                    }

                    try {
                        const response = await fetch(url, { headers: getHeaders() });
                        if (!response.ok) throw new Error("데이터 로딩 실패");

                        const data = await response.json();
                        // data format: { member, period, total_count, calendar_dates, history }

                        // UI 업데이트
                        document.getElementById('detailPeriodDate').textContent = `${data.period.start} ~ ${data.period.end}`;
                        document.getElementById('detailAttendanceCount').textContent = `${data.total_count}회`;

                        // 리스트 업데이트
                        const listBody = document.getElementById('detailHistoryList');
                        listBody.innerHTML = '';
                        if (data.history.length === 0) {
                            listBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">출석 기록이 없습니다.</td></tr>';
                        } else {
                            data.history.slice(0, 50).forEach(item => {
                                const row = `<tr>
                            <td>${item.date} ${item.time || ''}</td>
                            <td>${item.class_name || '-'}</td> 
                        </tr>`;
                                listBody.innerHTML += row;
                            });
                        }

                        // 캘린더 렌더링 분기
                        if (period === 'yearly') {
                            renderYearlyCalendar(data.period.start, data.period.end, data.calendar_dates);
                        } else {
                            renderDetailCalendar(data.period.start, data.period.end, data.calendar_dates);
                        }

                    } catch (e) {
                        console.error(e);
                        alert('데이터 로딩에 실패했습니다.');
                    }
                }

                function changeDetailMonth(offset) {
                    const dateInput = document.getElementById('detailBaseDate');
                    const currentDate = new Date(dateInput.value);
                    currentDate.setMonth(currentDate.getMonth() + offset);

                    const year = currentDate.getFullYear();
                    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                    const day = String(currentDate.getDate()).padStart(2, '0');
                    dateInput.value = `${year}-${month}-${day}`;

                    // 데이터 로드
                    loadMemberDetailStats();
                }

                // 연간 캘린더 렌더링 함수 추가
                function renderYearlyCalendar(startDate, endDate, attendanceDates) {
                    const calendarTitle = document.getElementById('detailCalendarTitle');
                    const calendarBody = document.getElementById('detailCalendarBody');

                    if (!calendarTitle || !calendarBody) return;

                    const start = new Date(startDate);
                    const year = start.getFullYear();

                    // Update Title
                    calendarTitle.textContent = `${year}년 전체 현황`;

                    const attendanceSet = new Set(attendanceDates);

                    // 12개월 그리드 생성
                    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">';

                    for (let m = 0; m < 12; m++) {
                        const currentMonthStart = new Date(year, m, 1);
                        const currentMonthEnd = new Date(year, m + 1, 0);
                        const monthName = `${m + 1}월`;
                        const startDayOfWeek = currentMonthStart.getDay();

                        html += `
                                <div style="border: 1px solid #eee; border-radius: 8px; padding: 10px; background: #fafafa;">
                                    <h5 style="text-align: center; margin: 0 0 10px 0; color: #2c3e50;">${monthName}</h5>
                                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 11px;">
                                        <div style="color: #e74c3c;">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div style="color: #3498db;">토</div>
                                `;

                        // Empty cells
                        for (let i = 0; i < startDayOfWeek; i++) {
                            html += '<div></div>';
                        }

                        // Days
                        for (let day = 1; day <= currentMonthEnd.getDate(); day++) {
                            const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isAttended = attendanceSet.has(dateStr);

                            const bg = isAttended ? '#2ecc71' : 'transparent';
                            const color = isAttended ? 'white' : '#333';
                            const weight = isAttended ? 'bold' : 'normal';

                            html += `<div style="padding: 4px; border-radius: 3px; background: ${bg}; color: ${color}; font-weight: ${weight};">${day}</div>`;
                        }

                        html += '</div></div>';
                    }

                    html += '</div>';
                    calendarBody.innerHTML = html;

                    // 그리드 레이아웃을 위해 calendarBody의 스타일을 잠시 변경 (기존 grid 컬럼 수 무시)
                    calendarBody.style.display = 'block';
                }

                function renderDetailCalendar(startDate, endDate, attendanceDates) {
                    const calendarTitle = document.getElementById('detailCalendarTitle');
                    const calendarBody = document.getElementById('detailCalendarBody');

                    if (!calendarTitle || !calendarBody) return;

                    // grid 레이아웃 복구 (연간 뷰에서 block으로 변경되었을 수 있음)
                    calendarBody.style.display = 'grid';

                    const start = new Date(startDate);
                    // Ensure we are rendering the month of the start date
                    const year = start.getFullYear();
                    const month = start.getMonth(); // 0-based

                    // Update Title
                    calendarTitle.textContent = `${year}년 ${month + 1}월`;

                    const attendanceSet = new Set(attendanceDates);

                    // Calculate days
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startDayOfWeek = firstDay.getDay(); // 0: Sun, 1: Mon...

                    let html = '';

                    // Empty cells for days before the 1st
                    for (let i = 0; i < startDayOfWeek; i++) {
                        html += '<div class="calendar-day empty"></div>';
                    }

                    // Days of the month
                    for (let day = 1; day <= lastDay.getDate(); day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isAttended = attendanceSet.has(dateStr);

                        // Check if it's Sunday (0) or Saturday (6) for styling
                        const currentDayOfWeek = new Date(year, month, day).getDay();
                        let dateClass = '';
                        if (currentDayOfWeek === 0) dateClass = 'sunday';
                        else if (currentDayOfWeek === 6) dateClass = 'saturday';

                        const cellStyle = `
                                    padding: 10px;
                                    height: 80px;
                                    border-right: 1px solid #eee;
                                    border-bottom: 1px solid #eee;
                                    text-align: left;
                                    position: relative;
                                    background: ${isAttended ? '#e8f8f5' : '#fff'};
                                `;

                        const dayNumberStyle = `
                                    font-weight: bold;
                                    color: ${currentDayOfWeek === 0 ? '#e74c3c' : (currentDayOfWeek === 6 ? '#3498db' : '#333')};
                                `;

                        const badge = isAttended ?
                            `<div style="
                                        position: absolute; 
                                        top: 50%; 
                                        left: 50%; 
                                        transform: translate(-50%, -50%);
                                        background: #2ecc71; 
                                        color: white; 
                                        padding: 4px 8px; 
                                        border-radius: 12px; 
                                        font-size: 12px;
                                        font-weight: bold;
                                    ">출석</div>` : '';

                        html += `
                                    <div style="${cellStyle}">
                                        <div style="${dayNumberStyle}">${day}</div>
                                        ${badge}
                                    </div>
                                `;
                    }

                    // Fill remaining cells to complete the last row (optional, but good for grid)
                    const totalCells = startDayOfWeek + lastDay.getDate();
                    const remainingCells = 7 - (totalCells % 7);
                    if (remainingCells < 7) {
                        for (let i = 0; i < remainingCells; i++) {
                            html += '<div class="calendar-day empty" style="border-right: 1px solid #eee; border-bottom: 1px solid #eee;"></div>';
                        }
                    }

                    calendarBody.innerHTML = html;
                }

                // window 객체에 등록
                window.openDetailModal = openDetailModal;
                window.closeDetailModal = closeDetailModal;
                window.handleDetailPeriodChange = handleDetailPeriodChange;
                window.loadMemberDetailStats = loadMemberDetailStats;
                window.changeDetailMonth = changeDetailMonth;
                window.renderYearlyCalendar = renderYearlyCalendar;
                if (!urlParams.get('tab')) {
                    loadWaitingStatus();
                }
            } else {
                console.error('매장 코드를 찾을 수 없습니다:', storeParam);
            }
        } catch (e) {
            console.error('매장 정보 조회 실패:', e);
        }
    } else {
        // 매장 파라미터가 없으면 로컬 스토리지의 매장 이름 표시
        const storeName = localStorage.getItem('selected_store_name');
        if (storeName) {
            const header = document.getElementById('storeName');
            if (header) header.innerHTML = `대기 및 출석 현황 <span style="font-size: 18px; color: #7f8c8d;">(${storeName})</span>`;
        }
        loadBusinessDate(); // 로컬 스토리지 기반으로 조회
    }
}

async function loadBusinessDate() {
    try {
        const response = await fetch('/api/daily/check-status', { headers: getHeaders() });
        if (response.ok) {
            const status = await response.json();
            const dateDisplay = document.getElementById('businessDateDisplay');

            if (dateDisplay && status.business_date) {
                const dateObj = new Date(status.business_date);
                const year = dateObj.getFullYear();
                const month = dateObj.getMonth() + 1;
                const day = dateObj.getDate();
                dateDisplay.textContent = `${year}년 ${month}월 ${day}일`;
            } else if (dateDisplay) {
                const now = new Date();
                dateDisplay.textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
            }
        }
    } catch (e) {
        console.error('영업일 조회 실패:', e);
    }
}

// 페이지 로드 시 매장 파라미터 확인 실행
checkUrlStoreParam();

// URL 파라미터 처리 (대기자 관리에서 조회 버튼 클릭 시)
const urlParams = new URLSearchParams(window.location.search);
const autoTab = urlParams.get('tab');
const autoPhone = urlParams.get('phone');
const autoLookup = urlParams.get('auto');
const autoName = urlParams.get('name');
const viewMode = urlParams.get('view');

// 최소 뷰 모드 적용
if (viewMode === 'minimal') {
    document.body.classList.add('minimal-view');
}

if (autoTab === 'individual' && autoPhone && autoLookup === 'true') {
    // 개인별 출석 탭으로 전환
    switchTab('individual');

    // 로딩 표시
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = '<div class="spinner"></div><p style="margin-top:10px; font-weight:bold;">데이터 조회 중...</p>';
    document.body.appendChild(loadingDiv);

    // 전화번호 자동 입력 및 조회
    setTimeout(() => {
        const phoneInput = document.getElementById('memberSearch');
        if (phoneInput) {
            // 하이픈 제거 후 입력
            const cleanPhone = autoPhone.replace(/[^0-9]/g, '');
            phoneInput.value = cleanPhone;
            // 자동 조회 실행 (자동 선택 활성화)
            searchMember(true).finally(() => {
                loadingDiv.remove();
            });
        } else {
            loadingDiv.remove();
        }
    }, 500);
} else {
    // 기본 탭 활성화
    switchTab('waiting_status');
}

// 초기 탭 활성화 (URL 파라미터가 없는 경우)
if (!autoTab) {
    switchTab('waiting_status');
}
// 0. 대기현황 조회
async function loadWaitingStatus() {
    const period = document.getElementById('waitingPeriod').value;
    const date = document.getElementById('waitingDate').value;
    let url = `/api/attendance/waiting-status?period=${period}&date=${date}`;

    if (period === 'custom') {
        const endDate = document.getElementById('waitingEndDate').value;
        if (!endDate) {
            alert('종료일을 선택해주세요.');
            return;
        }
        if (date > endDate) {
            alert('시작일이 종료일보다 늦을 수 없습니다.');
            return;
        }
        url += `&start_date=${date}&end_date=${endDate}`;
    }

    try {
        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        document.getElementById('totalWaiting').textContent = `${data.total}명`;
        document.getElementById('existingMemberWaiting').textContent = `${data.existing}명`;
        document.getElementById('newMemberWaiting').textContent = `${data.new}명`;

        document.getElementById('currentTotalWaiting').textContent = `${data.current_total}명`;
        document.getElementById('currentExistingWaiting').textContent = `${data.current_existing}명`;
        document.getElementById('currentNewWaiting').textContent = `${data.current_new}명`;

        // 마지막 업데이트 시간 표시
        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        document.getElementById('lastUpdateTime').textContent = `마지막 업데이트: ${timeString}`;
    } catch (e) {
        console.error('대기현황 조회 실패', e);
        alert('데이터 조회 중 오류가 발생했습니다.');
    }
}

// 1. 출석현황 조회
async function loadStatus() {
    const period = document.getElementById('statusPeriod').value;
    const date = document.getElementById('statusDate').value;
    let url = `/api/attendance/status?period=${period}&date=${date}`;

    if (period === 'custom') {
        const endDate = document.getElementById('statusEndDate').value;
        if (!endDate) {
            alert('종료일을 선택해주세요.');
            return;
        }
        if (date > endDate) {
            alert('시작일이 종료일보다 늦을 수 없습니다.');
            return;
        }
        url += `&start_date=${date}&end_date=${endDate}`;
    }

    try {
        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        document.getElementById('totalAttendance').textContent = `${data.total}명`;
        document.getElementById('existingMemberAttendance').textContent = `${data.existing}명`;
        document.getElementById('newMemberAttendance').textContent = `${data.new}명`;
    } catch (e) {
        console.error('출석현황 조회 실패', e);
    }
}

// 2. 개인별 출석 조회
async function searchMember(autoSelect = false) {
    let query = document.getElementById('memberSearch').value;
    if (!query) return alert('검색어를 입력해주세요');

    // 숫자만 있는 경우 하이픈 제거 (검색 유연성)
    query = query.replace(/[^0-9a-zA-Z가-힣]/g, '');

    try {
        const response = await fetch(`/api/attendance/individual/search?query=${query}`, { headers: getHeaders() });
        const members = await response.json();

        const resultDiv = document.getElementById('individualResult');

        // 검색 결과 영역 항상 표시
        resultDiv.style.display = 'block';

        // 상세 정보 영역 숨기기
        document.getElementById('memberAttendanceDetail').style.display = 'none';

        if (members.length === 0) {
            resultDiv.innerHTML = '<div class="empty-state"><p>검색 결과가 없습니다.</p></div>';
            return;
        }

        // 자동 선택 로직
        if (autoSelect) {
            // 1. 전화번호가 정확히 일치하는 회원이 있으면 자동 선택 (하이픈 제거 후 비교)
            const exactMatch = members.find(m => m.phone.replace(/[^0-9]/g, '') === query.replace(/[^0-9]/g, ''));
            if (exactMatch) {
                loadMemberDetail(exactMatch.id);
                return;
            }
            // 2. 검색 결과가 1명이면 자동 선택
            if (members.length === 1) {
                loadMemberDetail(members[0].id);
                return;
            }
        }

        let htmlContent = '<div class="member-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 20px;">';
        members.forEach(member => {
            // 핸드폰 번호 포맷팅 (010-0000-0000)
            let formattedPhone = member.phone;
            if (member.phone.length === 11) {
                formattedPhone = member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
            }

            htmlContent += `
                        <div class="member-card" onclick="loadMemberDetail(${member.id})" style="padding: 15px; border: 1px solid #ecf0f1; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: #fff;">
                            <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">${member.name}</div>
                            <div style="color: #2980b9; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">${formattedPhone}</div>
                        </div>
                    `;
        });
        htmlContent += '</div>';
        resultDiv.innerHTML = htmlContent;

    } catch (e) {
        console.error('회원 검색 실패', e);
    }
}

let currentMemberId = null;

async function loadRanking(isLoadMore = false) {
    if (isRankingLoading) return;
    isRankingLoading = true;
    document.getElementById('rankingLoader').style.display = 'block';

    if (!isLoadMore) {
        currentRankingOffset = 0;
        document.getElementById('rankingList').innerHTML = '';
    }

    const storeId = localStorage.getItem('selected_store_id');
    const franchiseId = localStorage.getItem('selected_franchise_id');
    const period = document.getElementById('rankingPeriod').value;
    const startDate = document.getElementById('rankingDate').value;
    const endDate = document.getElementById('rankingEndDate').value;
    const minAttendance = document.getElementById('minAttendance').value;

    try {
        let url = `/api/attendance/ranking`;
        const params = new URLSearchParams();

        // 스토어 파라미터를 추가할 필요 없음 (토큰 인증으로 처리됨)
        // 하지만 checkUrlStoreParam에서 토큰을 설정했는지 확인해야 함.
        // attendance.html은 localStorage의 access_token을 사용하여 getHeaders()를 호출함.

        params.append('period', period);

        // params mapping according to routers/attendance.py
        if (period === 'daily') {
            // routers/attendance.py uses 'date' for daily target
            params.append('date', startDate);
        } else if (period === 'monthly') {
            // routers/attendance.py expects 'date' for monthly target (e.g. 2025-12-01)
            // startDate input is "YYYY-MM" or "YYYY-MM-DD"?
            // attendance.html handles this. 
            // Let's pass 'date' as startDate which is usually correct for monthly logic there
            params.append('date', startDate);
        } else {
            // custom, weekly, etc.
            params.append('start_date', startDate);
            params.append('end_date', endDate);
        }

        if (minAttendance) params.append('min_count', minAttendance);
        params.append('limit', RANKING_LIMIT);
        params.append('skip', currentRankingOffset); // API uses 'skip', not 'offset'

        url += '?' + params.toString();

        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        const tbody = document.getElementById('rankingList');

        if (!Array.isArray(data)) {
            console.error('Data is not an array:', data);
            if (!isLoadMore) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #e74c3c;">데이터 로드 중 오류가 발생했습니다.</td></tr>';
            }
            return;
        }

        if (data.length === 0 && !isLoadMore) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">데이터가 없습니다.</td></tr>';
        } else {
            data.forEach((item, index) => {
                const row = document.createElement('tr');
                const rank = currentRankingOffset + index + 1;
                let rankClass = 'rank-other';
                if (rank === 1) rankClass = 'rank-1';
                else if (rank === 2) rankClass = 'rank-2';
                else if (rank === 3) rankClass = 'rank-3';

                row.innerHTML = `
                            <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                            <td>${item.name}</td>
                            <td>${item.phone}</td>
                            <td><span style="font-weight: bold; color: #2c3e50;">${item.attendance_count}회</span></td>
                            <td>${item.last_attendance}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" style="padding: 5px 10px; font-size: 13px;"
                                    onclick="openDetailModal(${item.member_id}, '${item.name}', '${item.phone}')">
                                    상세보기
                                </button>
                            </td>
                        `;
                tbody.appendChild(row);
            });

            currentRankingOffset += data.length;

            // 더보기 감지 (데이터가 limit보다 적으면 더 이상 데이터 없음)
            if (data.length < RANKING_LIMIT) {
                if (rankingObserver) rankingObserver.disconnect();
            } else if (!isLoadMore) {
                setupRankingObserver();
            }
        }
    } catch (error) {
        console.error('순위 조회 실패:', error);
    } finally {
        isRankingLoading = false;
        document.getElementById('rankingLoader').style.display = 'none';
    }
}

// 무한 스크롤 Observer 설정 (복구됨)
function setupRankingObserver() {
    if (rankingObserver) rankingObserver.disconnect();

    const sentinel = document.getElementById('rankingSentinel');
    if (!sentinel) return;

    rankingObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isRankingLoading) {
            loadRanking(true);
        }
    }, { threshold: 0.1 });

    rankingObserver.observe(sentinel);
}
async function loadMemberDetail(memberId) {
    currentMemberId = memberId;

    // 검색 결과 숨기기
    document.getElementById('individualResult').style.display = 'none';

    // 상세 영역 표시
    const detailSection = document.getElementById('memberAttendanceDetail');
    detailSection.style.display = 'block';

    // 날짜 초기화 (오늘 날짜 기준)
    const today = new Date();
    const dateInput = document.getElementById('individualDate');
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;

    // 기본 기간을 'monthly'로 강제 설정
    const periodSelect = document.getElementById('individualPeriod');
    if (periodSelect) {
        periodSelect.value = 'monthly';
        handlePeriodChange('individual'); // UI 업데이트 (DatePicker 표시 여부 등)
    }

    // 데이터 로드 (monthly 강제 적용)
    await loadMemberDetailWithPeriod('monthly');
}

async function loadMemberDetailWithPeriod(overridePeriod = null) {
    if (!currentMemberId) return;

    const periodSelect = document.getElementById('individualPeriod');
    let period = periodSelect ? periodSelect.value : 'monthly';

    // 오버라이드 값이 있으면 DOM 값보다 우선 사용
    if (overridePeriod) {
        if (periodSelect) periodSelect.value = overridePeriod;
        period = overridePeriod;
        handlePeriodChange('individual'); // UI 업데이트
    }

    const date = document.getElementById('individualDate').value;
    let url = `/api/attendance/individual/${currentMemberId}?period=${period}&date=${date}`;

    if (period === 'custom') {
        const endDate = document.getElementById('individualEndDate').value;
        url += `&start_date=${date}&end_date=${endDate}`;
    }

    try {
        const response = await fetch(url, { headers: getHeaders() });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(errorData.detail || '서버 오류');
        }

        const data = await response.json();

        // 회원 정보 표시
        // 핸드폰 번호 포맷팅
        let formattedPhone = data.member.phone;
        if (data.member.phone.length === 11) {
            formattedPhone = data.member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
        }

        document.getElementById('memberInfo').innerHTML = `<span style="font-size: 24px; font-weight: bold; color: #2c3e50;">${data.member.name}</span> <span style="font-size: 20px; font-weight: bold; color: #2980b9; margin-left: 8px;">(${formattedPhone})</span>`;

        // 출석 횟수도 크게
        document.getElementById('memberAttendanceCount').style.fontSize = "32px";
        document.getElementById('memberAttendanceCount').style.fontWeight = "bold";
        document.getElementById('memberAttendanceCount').style.color = "#2c3e50";
        document.getElementById('memberAttendanceCount').textContent = `${data.total_count}회`;

        // 조회 기간 크게
        document.getElementById('memberPeriodInfo').innerHTML = `<span style="font-size: 20px; font-weight: bold; color: #2c3e50;">${data.period.start} ~ ${data.period.end}</span>`;

        // 출석 내역 테이블
        const historyBody = document.getElementById('memberAttendanceHistory');
        if (data.history.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="2">출석 이력이 없습니다.</td></tr>';
        } else {
            historyBody.innerHTML = data.history.map(h => `
                        <tr>
                            <td>${h.date}</td>
                            <td>${h.class_name}</td>
                        </tr>
                    `).join('');
        }

        // 캘린더 렌더링
        renderAttendanceCalendar(data.period.start, data.period.end, data.calendar_dates);

    } catch (e) {
        console.error('상세 조회 실패:', e);
        alert(`출석 정보를 불러오는데 실패했습니다.\n오류: ${e.message}`);
    }
}

function renderAttendanceCalendar(startDate, endDate, attendanceDates) {
    const calendarDiv = document.getElementById('attendanceCalendar');
    const start = new Date(startDate);
    const end = new Date(endDate);

    // 출석 날짜를 Set으로 변환 (빠른 검색)
    const attendanceSet = new Set(attendanceDates);

    // 월별로 그룹화
    const months = [];
    let current = new Date(start);
    // 1일로 설정하여 해당 월의 처음부터 체크
    current.setDate(1);

    while (current <= end) {
        const year = current.getFullYear();
        const month = current.getMonth();
        const monthKey = `${year}-${month}`;

        // 중복 방지 및 범위 체크: 해당 월이 표시 범위와 겹치는지
        const monthEnd = new Date(year, month + 1, 0);
        const monthStart = new Date(year, month, 1);

        if (monthEnd >= start && monthStart <= end) {
            if (!months.find(m => m.key === monthKey)) {
                months.push({
                    key: monthKey,
                    year: year,
                    month: month,
                    monthName: current.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
                });
            }
        }

        current.setMonth(current.getMonth() + 1);
    }

    // 캘린더 HTML 생성
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';

    months.forEach(monthInfo => {
        const firstDay = new Date(monthInfo.year, monthInfo.month, 1);
        const lastDay = new Date(monthInfo.year, monthInfo.month + 1, 0);
        const startDay = firstDay.getDay(); // 0 = Sunday

        html += `
                    <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <button class="btn btn-sm btn-outline-secondary" onclick="changeAttendanceMonth(-1)" style="border: none; background: none; font-size: 18px; cursor: pointer;">
                        ◀
                    </button>
                    <h4 style="text-align: center; margin: 0; color: #2c3e50; font-size: 18px;">${monthInfo.monthName}</h4>
                    <button class="btn btn-sm btn-outline-secondary" onclick="changeAttendanceMonth(1)" style="border: none; background: none; font-size: 18px; cursor: pointer;">
                        ▶
                    </button>
                </div>
                        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center;">
                            <div style="font-weight: bold; color: #e74c3c;">일</div>
                            <div style="font-weight: bold;">월</div>
                            <div style="font-weight: bold;">화</div>
                            <div style="font-weight: bold;">수</div>
                            <div style="font-weight: bold;">목</div>
                            <div style="font-weight: bold;">금</div>
                            <div style="font-weight: bold; color: #3498db;">토</div>
                `;

        // 빈 칸 추가 (월 시작 전)
        for (let i = 0; i < startDay; i++) {
            html += '<div></div>';
        }

        // 날짜 추가
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dateStr = `${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isAttended = attendanceSet.has(dateStr);
            const isInRange = new Date(dateStr) >= start && new Date(dateStr) <= end;

            // 출석한 날은 녹색 배경, 흰색 글씨, 굵게
            const bgColor = isAttended ? '#2ecc71' : (isInRange ? '#ecf0f1' : '#f8f9fa');
            const textColor = isAttended ? '#fff' : '#2c3e50';
            const fontWeight = isAttended ? 'bold' : 'normal';

            html += `
                        <div style="
                            padding: 8px;
                            background: ${bgColor};
                            color: ${textColor};
                            font-weight: ${fontWeight};
                            border-radius: 4px;
                            ${isAttended ? 'box-shadow: 0 2px 4px rgba(46, 204, 113, 0.3); transform: scale(1.05);' : ''}
                            transition: all 0.2s;
                        ">
                            ${day}
                        </div>
                    `;
        }

        html += '</div></div>';
    });

    html += '</div>';
    calendarDiv.innerHTML = html;
}

// 캘린더 월 이동 함수
function changeAttendanceMonth(offset) {
    const dateInput = document.getElementById('individualDate');
    const currentDate = new Date(dateInput.value);

    // 월 변경
    currentDate.setMonth(currentDate.getMonth() + offset);

    // 변경된 날짜 설정
    // toISOString()은 UTC 기준이므로 로컬 시간대 반영 필요
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;

    // 'daily'나 'custom'이 아닌 경우 날짜 변경 시 조회 트리거
    // 'monthly'인 경우 날짜만 변경하고 조회 호출
    loadMemberDetailWithPeriod();
}

// 3. 신규회원 조회
async function loadNewMembers(isLoadMore = false) {
    const period = document.getElementById('newMemberPeriod').value;
    let date = document.getElementById('newMemberDate').value;

    // 날짜가 비어있으면 오늘로 설정
    if (!date) {
        date = new Date().toISOString().split('T')[0];
        document.getElementById('newMemberDate').value = date;
    }

    if (isNewMemberLoading) return;
    isNewMemberLoading = true;

    const loader = document.getElementById('newMemberLoader');
    if (isLoadMore && loader) loader.style.display = 'inline-block';

    if (!isLoadMore) {
        currentNewMemberOffset = 0;
    }

    let url = `/api/attendance/new-members?period=${period}&date=${date}&skip=${currentNewMemberOffset}&limit=${RANKING_LIMIT}`;
    if (period === 'custom') {
        const endDate = document.getElementById('newMemberEndDate').value;
        if (date > endDate) {
            alert('시작일이 종료일보다 늦을 수 없습니다.');
            isNewMemberLoading = false;
            return;
        }
        url += `&start_date=${date}&end_date=${endDate}`;
    }

    try {
        const response = await fetch(url, { headers: getHeaders() });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!isLoadMore) {
            document.getElementById('newMemberCount').textContent = `${data.count}명`;
            document.getElementById('newMemberTotalAttendance').textContent = `${data.total_attendance}회`;
            document.getElementById('newMemberAvgAttendance').textContent = `${data.avg_attendance}회`;
        }

        const tbody = document.getElementById('newMemberList');
        const members = data.new_members || []; // 백엔드 키 확인 (new_members)

        if (members.length === 0) {
            if (!isLoadMore) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:#95a5a6;">해당 기간에 가입한 신규회원이 없습니다.</td></tr>';
            }
            if (newMemberObserver) newMemberObserver.disconnect();
            if (loader) loader.style.display = 'none';
            isNewMemberLoading = false;
            return;
        }

        const html = members.map((m, index) => {
            const realIndex = currentNewMemberOffset + index;
            let rankClass = 'rank-other';
            if (realIndex === 0) rankClass = 'rank-1';
            if (realIndex === 1) rankClass = 'rank-2';
            if (realIndex === 2) rankClass = 'rank-3';

            return `
                    <tr>
                        <td><span class="rank-badge ${rankClass}">${realIndex + 1}</span></td>
                        <td>${m.name}</td>
                        <td>${m.phone}</td>
                        <td><strong>${m.attendance_count}회</strong></td>
                        <td>${m.joined_at}</td>
                        <td>${m.first_attendance || '-'}</td>
                        <td>${m.last_attendance || '-'}</td>
                    </tr>
                    `;
        }).join('');

        if (isLoadMore) {
            tbody.insertAdjacentHTML('beforeend', html);
        } else {
            tbody.innerHTML = html;
            setupNewMemberObserver();
        }

        currentNewMemberOffset += RANKING_LIMIT;

        if (members.length < RANKING_LIMIT) {
            if (newMemberObserver) newMemberObserver.disconnect();
        }

    } catch (e) {
        console.error('신규회원 조회 실패:', e);
        const tbody = document.getElementById('newMemberList');
        if (!isLoadMore) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:#e74c3c;">데이터 로딩 실패. 다시 시도해주세요.</td></tr>';
        }
    } finally {
        isNewMemberLoading = false;
        if (loader) loader.style.display = 'none';
    }
}

// 신규회원 무한 스크롤 Observer 설정
function setupNewMemberObserver() {
    if (newMemberObserver) newMemberObserver.disconnect();

    const sentinel = document.getElementById('newMemberSentinel');

    newMemberObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isNewMemberLoading) {
            loadNewMembers(true);
        }
    }, { threshold: 0.1 });

    newMemberObserver.observe(sentinel);
}

// 4. 출석순위 조회 (상단에 정의된 loadRanking 함수와 중복되어 제거됨)


// 날짜 필드 초기화 (영업일 기준)
async function initializeDates() {
    try {
        // 영업일 조회
        const response = await fetch('/api/daily/check-status', { headers: getHeaders() });
        let targetDate = new Date().toISOString().split('T')[0]; // 기본값: 오늘

        if (response.ok) {
            const status = await response.json();
            if (status.business_date) {
                targetDate = status.business_date;
            }
        }

        // 각 탭의 날짜 필드 설정 및 디스플레이 업데이트
        const dateFields = [
            { input: 'waitingDate', display: 'waitingDateDisplay' },
            { input: 'statusDate', display: 'statusDateDisplay' },
            { input: 'newMemberDate', display: 'newMemberDateDisplay' },
            { input: 'rankingDate', display: 'rankingDateDisplay' },
            { input: 'individualDate', display: 'individualDateDisplay' }
        ];

        dateFields.forEach(field => {
            const inputEl = document.getElementById(field.input);
            if (inputEl) {
                inputEl.value = targetDate;
                // 디스플레이 업데이트 (formatDateToDisplay 호출)
                updateDateDisplay(inputEl, field.display);
            }
        });

        console.log('Date fields initialized to:', targetDate);

    } catch (error) {
        console.error('Initial date setup failed:', error);
        // 실패 시 오늘 날짜로 폴백
        const today = new Date().toISOString().split('T')[0];
        const fields = ['waitingDate', 'statusDate', 'newMemberDate', 'rankingDate', 'individualDate'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = today;
        });
    }
}

// 페이지 초기화 함수
async function initPage() {
    await initializeDates(); // 날짜 먼저 설정
    loadWaitingStatus();     // 그 다음 데이터 로드
    initSSE();              // SSE 연결
}

// 초기 로드 실행
initPage();

// 페이지 종료 시 SSE 연결 닫기
document.addEventListener('DOMContentLoaded', function () {
    window.addEventListener('beforeunload', () => {
        closeSSE();
    });
});
