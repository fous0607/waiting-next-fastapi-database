let businessStatus = null;

// Helper function to get headers with store ID
function getHeaders(additionalHeaders = {}) {
    const headers = { ...additionalHeaders };
    const storeId = localStorage.getItem('selected_store_id');
    if (storeId) {
        headers['X-Store-Id'] = storeId;
    }
    return headers;
}

async function checkBusinessStatus() {
    try {
        const response = await fetch('/api/daily/check-status', {
            headers: getHeaders()
        });
        businessStatus = await response.json();

        const statusSpan = document.getElementById('businessStatus');
        const dateSpan = document.getElementById('businessDate');
        const openBtn = document.getElementById('openBtn');
        const closeBtn = document.getElementById('closeBtn');

        if (businessStatus.is_open) {
            statusSpan.textContent = '영업 중';
            statusSpan.style.color = '#27ae60';
            dateSpan.textContent = businessStatus.business_date;
            closeBtn.style.display = 'block';
            openBtn.style.display = 'none';
        } else {
            statusSpan.textContent = '영업 종료';
            statusSpan.style.color = '#e74c3c';
            dateSpan.textContent = '-';
            openBtn.style.display = 'block';
            closeBtn.style.display = 'none';
        }

        // 현재 대기 수 조회
        await loadWaitingCount();

    } catch (error) {
        console.error('영업 상태 조회 실패:', error);
    }
}

async function loadWaitingCount() {
    try {
        const response = await fetch('/api/waiting/list?status=waiting', {
            headers: getHeaders()
        });

        if (response.status === 401) {
            // 토큰 만료 또는 유효하지 않음 -> 로그아웃 처리
            console.warn('토큰 만료 감지, 로그아웃 처리');
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return;
        }

        const data = await response.json();
        document.getElementById('waitingCount').textContent = `${data.length}명`;
    } catch (error) {
        console.error('대기자 수 조회 실패:', error);
        // document.getElementById('waitingCount').textContent = '-';
    }
}

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
                localStorage.setItem('selected_store_code', store.code);
                console.log(`URL 매장 파라미터 적용: ${store.name} (코드: ${storeParam})`);

                updateDashboardLinks(store.code);

                // URL 파라미터 유지 (매장별 고유 URL 지원)
                // window.history.replaceState({}, '', '/');
            } else {
                console.error('매장 코드를 찾을 수 없습니다:', storeParam);
                alert(`매장 코드 '${storeParam}'를 찾을 수 없습니다.`);
            }
        } catch (e) {
            console.error('매장 정보 조회 실패:', e);
        }
    }
}

// 매장 컨텍스트 확인 (admin 페이지에서 넘어온 경우)
function checkStoreContext() {
    const storeContext = localStorage.getItem('store_management_context');
    if (storeContext) {
        try {
            const context = JSON.parse(storeContext);
            // 5분 이내의 컨텍스트만 유효
            if (context.timestamp && (Date.now() - context.timestamp < 5 * 60 * 1000)) {
                localStorage.setItem('selected_store_id', context.id);
                localStorage.setItem('selected_store_name', context.name);
                if (context.code) {
                    localStorage.setItem('selected_store_code', context.code);
                    updateDashboardLinks(context.code);
                }
                console.log(`매장 컨텍스트 적용: ${context.name} (ID: ${context.id})`);
            }
            // 사용 후 제거
            localStorage.removeItem('store_management_context');
        } catch (e) {
            console.error('매장 컨텍스트 파싱 실패:', e);
        }
    }
}

function updateDashboardLinks(storeCode) {
    if (!storeCode) return;

    const links = [
        { selector: '.menu-item.board', path: '/board' },
        { selector: '.menu-item.reception', path: '/reception' },
        { selector: '.menu-item.mobile', path: '/mobile' },
        { selector: '.menu-item.manage', path: '/manage' },
        { selector: '.menu-item.members', path: '/members' },
        { selector: '.menu-item.settings', path: '/settings' },
        { selector: '.menu-item.attendance', path: '/attendance' }
    ];

    links.forEach(link => {
        const element = document.querySelector(link.selector);
        if (element) {
            element.href = `${link.path}?store=${storeCode}`;
        }
    });
}

async function loadStoreInfo() {
    try {
        const response = await fetch('/api/store/', {
            headers: getHeaders()
        });
        const store = await response.json();
        document.getElementById('storeName').textContent = store.store_name;

        // 대기현황판 활성화 여부에 따라 버튼 표시/숨김
        const boardBtn = document.querySelector('.menu-item.board');
        if (boardBtn) {
            if (store.enable_waiting_board === false) {
                boardBtn.style.display = 'none';
            } else {
                boardBtn.style.display = '';
            }
        }

        // 대기접수(데스크/모바일) 활성화 여부에 따라 버튼 표시/숨김
        const receptionBtn = document.querySelector('.menu-item.reception');
        const mobileBtn = document.querySelector('.menu-item.mobile');

        if (store.enable_reception_desk === false) {
            if (receptionBtn) receptionBtn.style.display = 'none';
            if (mobileBtn) mobileBtn.style.display = 'none';
        } else {
            if (receptionBtn) receptionBtn.style.display = '';
            if (mobileBtn) mobileBtn.style.display = '';
        }
    } catch (error) {
        console.error('매장 정보 조회 실패:', error);
    }
}

let modalCallback = null;

function showNotificationModal(title, message) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').innerHTML = message.replace(/\n/g, '<br>');

    // 버튼 설정 (알림용)
    const btnContainer = document.getElementById('modalButtons');
    btnContainer.innerHTML = `<button class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 16px;" onclick="closeNotificationModal()">확인</button>`;

    modalCallback = null;
    document.getElementById('notificationModal').classList.add('show');
}

function showConfirmModal(title, message, callback) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').innerHTML = message.replace(/\n/g, '<br>');

    // 버튼 설정 (확인/취소용)
    const btnContainer = document.getElementById('modalButtons');
    btnContainer.innerHTML = `
                <button class="btn btn-secondary" style="flex: 1; padding: 12px; font-size: 16px; background-color: #95a5a6;" onclick="closeNotificationModal()">취소</button>
                <button class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 16px;" id="confirmModalBtn">확인</button>
            `;

    // 콜백 설정
    document.getElementById('confirmModalBtn').onclick = function () {
        closeNotificationModal();
        if (callback) callback();
    };

    document.getElementById('notificationModal').classList.add('show');
}

function closeNotificationModal() {
    document.getElementById('notificationModal').classList.remove('show');
    // Reset title font size
    document.getElementById('notificationTitle').style.fontSize = '20px';
}

async function openBusiness(event) {
    if (event) event.stopPropagation();
    try {
        // 서버에서 예상 개점 날짜 가져오기
        const dateResponse = await fetch('/api/daily/predict-date', {
            headers: getHeaders()
        });
        const dateData = await dateResponse.json();
        const businessDate = dateData.business_date;

        showConfirmModal(
            '영업 개점',
            `<span style="font-size: 26px; font-weight: bold; display: block; margin-bottom: 15px;">영업을 개점하시겠습니까?</span><div style="font-size: 28px; font-weight: bold; color: #2c3e50; background: #ecf0f1; padding: 15px; border-radius: 10px; text-align: center;">📅 영업 개점일<br>${businessDate}</div>`,
            async function () {
                try {
                    const response = await fetch('/api/daily/open', {
                        method: 'POST',
                        headers: getHeaders()
                    });

                    if (response.ok) {
                        showNotificationModal('성공', '영업이 개점되었습니다.');
                        checkBusinessStatus();
                    } else {
                        const error = await response.json();
                        showNotificationModal('알림', error.detail || '개점에 실패했습니다.');
                        document.getElementById('notificationTitle').style.fontSize = '24px'; // 오류 시 타이틀 크기 복구
                    }
                } catch (error) {
                    console.error('개점 실패:', error);
                    showNotificationModal('오류', '개점 중 오류가 발생했습니다.');
                    document.getElementById('notificationTitle').style.fontSize = '24px';
                }
            }
        );

        // 개점 모달의 경우 타이틀을 아주 크게 설정
        document.getElementById('notificationTitle').style.fontSize = '40px';
    } catch (error) {
        console.error('개점 예정일 조회 실패:', error);
        showNotificationModal('오류', '서버 통신 중 오류가 발생했습니다.');
    }
}

async function closeBusiness(event) {
    if (event) event.stopPropagation();
    showConfirmModal('일마감', '일마감을 진행하시겠습니까?\n마감 후에는 다시 개점해야 합니다.', async function () {
        try {
            const response = await fetch('/api/daily/close', {
                method: 'POST',
                headers: getHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                showNotificationModal('마감 완료', `일마감이 완료되었습니다.<br><br>총 대기: ${result.total_waiting}명<br>출석: ${result.total_attended}명<br>취소: ${result.total_cancelled}명`);
                checkBusinessStatus();
            } else {
                const error = await response.json();
                showNotificationModal('오류', error.detail || '마감에 실패했습니다.');
            }
        } catch (error) {
            console.error('마감 실패:', error);
            showNotificationModal('오류', '마감 중 오류가 발생했습니다.');
        }
    });
}

function handleManageClick(event) {
    // businessStatus가 로드되지 않았거나 영업 중이 아니면 차단 -> 해제 (관리 필요성)
    // if (!businessStatus || !businessStatus.is_open) {
    //    event.preventDefault(); // 페이지 이동 막기
    //    showNotificationModal('알림', '영업을 개점해주세요.');
    // }
    // 영업 중이면 href="/manage"로 정상 이동
    // (지금은 항상 이동 허용)
}

document.getElementById('openBtn').addEventListener('click', openBusiness);
document.getElementById('closeBtn').addEventListener('click', closeBusiness);

// 초기 로드
async function init() {
    // 토큰 확인 (로그인 강제)
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // 매장 이름 즉시 표시
    const storeName = localStorage.getItem('selected_store_name');
    if (storeName) {
        document.getElementById('storeName').textContent = storeName;
        document.getElementById('storeSubtitle').textContent = '매장 대기 관리 시스템';
    }

    // 저장된 매장 코드가 있으면 링크 업데이트
    const storeCode = localStorage.getItem('selected_store_code');
    if (storeCode) {
        updateDashboardLinks(storeCode);
    }

    await checkUrlStoreParam();  // URL 파라미터 먼저 확인
    checkStoreContext();  // 매장 컨텍스트 확인

    // 매장 이름 다시 업데이트 (URL 파라미터나 컨텍스트에서 변경되었을 수 있음)
    const updatedStoreName = localStorage.getItem('selected_store_name');
    if (updatedStoreName) {
        document.getElementById('storeName').textContent = updatedStoreName;
    }

    checkBusinessStatus();
    // updateWaitingCount -> loadWaitingCount 이름 불일치 수정
    loadWaitingCount();
    loadStoreInfo(); // 매장 설정 및 이름 로드
    loadStoreNotices(); // 공지사항 로드
}

init();

// SSE 연결로 실시간 업데이트 (폴링 제거)
const storeId = localStorage.getItem('selected_store_id');
if (storeId) {
    window.eventSource = new EventSource(`/api/sse/stream?store_id=${storeId}`);

    window.eventSource.onopen = () => {
        console.log('[SSE] Dashboard connected');
    };

    // 새로운 대기자 등록 시 카운트 업데이트
    window.eventSource.addEventListener('new_user', () => {
        console.log('[SSE] New user registered, updating count');
        loadWaitingCount();
    });

    // 상태 변경 시 카운트 업데이트
    window.eventSource.addEventListener('status_change', () => {
        console.log('[SSE] Status changed, updating count');
        loadWaitingCount();
    });

    window.eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
    };
}

// 공지사항 로직
let storeNotices = [];

async function loadStoreNotices() {
    try {
        const res = await fetch('/api/notices/store', { headers: getHeaders() });
        if (!res.ok) return;
        const notices = await res.json();
        storeNotices = notices; // Store globally regarding the list modal

        const widget = document.getElementById('noticeWidget');
        const list = document.getElementById('noticeList');

        if (notices.length > 0) {
            widget.style.display = 'block';
            list.innerHTML = '';

            // Show recent 2
            notices.slice(0, 2).forEach(n => {
                const div = document.createElement('div');
                div.style.padding = '6px 10px'; // Extremely reduced padding
                div.style.background = '#f9fafb';
                div.style.borderRadius = '6px';
                div.style.cursor = 'pointer';
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.alignItems = 'center';
                div.style.gap = '10px';
                div.style.transition = 'background 0.2s';

                div.onmouseover = () => div.style.background = '#f2f4f6';
                div.onmouseout = () => div.style.background = '#f9fafb';

                div.innerHTML = `
                    <div style="font-weight: 500; font-size: 13px; color: #191f28; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${n.title}</div>
                    <div style="font-size: 11px; color: #8b95a1; white-space: nowrap; text-align: right;">
                        ${new Date(n.created_at).toLocaleDateString()} | ${n.author_name || '관리자'}
                    </div>
                `;
                div.onclick = () => showNoticeDetail(n);
                list.appendChild(div);
            });

            // Update header to act as "View All" if there are notices
            const header = widget.querySelector('h3');
            if (header) {
                header.style.cursor = 'pointer';
                header.title = "전체 공지사항 보기";
                header.onclick = showAllNoticesModal;
            }

        } else {
            widget.style.display = 'none';
        }
    } catch (e) { console.error('Notices Error', e); }
}

function showAllNoticesModal() {
    const listContainer = document.getElementById('allNoticesList');
    if (!listContainer) return; // Modal HTML must exist

    listContainer.innerHTML = '';

    storeNotices.forEach(n => {
        const div = document.createElement('div');
        div.style.padding = '12px';
        div.style.borderBottom = '1px solid #eee';
        div.style.cursor = 'pointer';
        div.style.transition = 'background 0.1s';

        div.onmouseover = () => div.style.background = '#f8f9fa';
        div.onmouseout = () => div.style.background = 'white';
        div.onclick = () => showNoticeDetail(n);

        div.innerHTML = `
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">${n.title}</div>
            <div style="font-size: 13px; color: #888;">
                ${new Date(n.created_at).toLocaleDateString()} | ${n.author_name || '관리자'}
            </div>
        `;
        listContainer.appendChild(div);
    });

    document.getElementById('allNoticesModal').style.display = 'block';
}

function showNoticeDetail(notice) {
    document.getElementById('noticeDetailTitle').textContent = notice.title;
    document.getElementById('noticeDetailMeta').textContent = `작성일: ${new Date(notice.created_at).toLocaleDateString()} | 작성자: ${notice.author_name || '관리자'}`;

    // Unescape HTML if needed and set innerHTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = notice.content;
    const decodedContent = tempDiv.textContent || tempDiv.innerText || "";

    const txt = document.createElement("textarea");
    txt.innerHTML = notice.content;
    let finalContent = txt.value; // This decodes entities like &lt; to <

    document.getElementById('noticeDetailContent').innerHTML = finalContent;
    document.getElementById('noticeDetailModal').style.display = 'block';
}
