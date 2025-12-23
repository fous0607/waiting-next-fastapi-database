// Helper function to get headers with store ID
function getHeaders(additionalHeaders = {}) {
    const headers = { ...additionalHeaders };
    const storeId = localStorage.getItem('selected_store_id');
    if (storeId) {
        headers['X-Store-Id'] = storeId;
    }
    return headers;
}

let settings = null;
let eventSource = null;
let currentData = { classGroups: {}, waitingMap: {} };

// SSE 연결 상태 UI 업데이트
function updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    const dotEl = statusEl.querySelector('.status-dot');
    const textEl = statusEl.querySelector('.status-text');

    statusEl.className = 'connection-status'; // reset classes

    if (status === 'connected') {
        statusEl.classList.add('connected');
        textEl.textContent = '실시간 연결됨';
    } else if (status === 'disconnected') {
        statusEl.classList.add('disconnected');
        textEl.textContent = '연결 끊김';
    } else {
        textEl.textContent = '연결 대기중';
    }
}

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

// Debounced Functions
const debouncedLoadWaitingBoard = debounce(() => loadWaitingBoard(), 300);

// SSE 연결 초기화 (조건부)
async function initSSE() {
    try {
        // Check if waiting board is enabled
        // URL 수정: /api/store-settings/ -> /api/store/
        let isEnabled = true;
        try {
            const response = await fetch('/api/store/sse-status', { headers: getHeaders() });
            if (response.ok) {
                const status = await response.json();
                isEnabled = status.enable_waiting_board;
            } else {
                console.warn('[SSE] Failed to fetch status, defaulting to enabled. Status:', response.status);
            }
        } catch (fetchError) {
            console.warn('[SSE] Network error fetching status, defaulting to enabled:', fetchError);
        }

        if (!isEnabled) {
            console.log('[SSE] Waiting board is disabled. SSE connection skipped.');
            updateConnectionStatus('disconnected');
            showDisabledMessage();
            return;
        }

        // Waiting board is enabled, proceed with SSE connection
        if (eventSource) {
            eventSource.close();
        }

        const storeId = localStorage.getItem('selected_store_id') || 'default';
        console.log(`SSE 연결 시도: Store ID = ${storeId}`);
        const sseUrl = `/api/sse/stream?store_id=${storeId}`;
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
            console.log('SSE 연결됨');
            updateConnectionStatus('connected');
        };

        eventSource.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                // Heartbeat 처리
                if (message.event === 'ping') {
                    return;
                }
                handleSSEMessage(message);
            } catch (error) {
                console.error('SSE 메시지 파싱 오류:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE 오류:', error);
            updateConnectionStatus('disconnected');
            eventSource.close(); // 명시적 종료

            // 3초 후 재연결 시도
            setTimeout(() => {
                console.log('SSE 재연결 시도...');
                initSSE();
            }, 3000);
        };

    } catch (error) {
        console.error('[SSE] Failed to check status:', error);
        updateConnectionStatus('disconnected');
    }
}

// Show message when waiting board is disabled
function showDisabledMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'position: fixed; top: 80px; right: 30px; background: #f39c12; color: white; padding: 15px 20px; border-radius: 8px; z-index: 9999; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
    messageDiv.innerHTML = '⚠️ 실시간 업데이트가 비활성화되었습니다.<br>페이지를 새로고침하여 최신 정보를 확인하세요.';
    document.body.appendChild(messageDiv);
}

// SSE 메시지 처리
function handleSSEMessage(message) {
    console.log('SSE 메시지 수신:', message);

    switch (message.event) {
        case 'connected':
            console.log('SSE 연결 확인됨');
            break;

        case 'new_user':
            // 새로운 대기자 등록 - 부드럽게 추가
            addNewWaitingToBoard(message.data);
            break;


        case 'member_updated':
            console.log('[SSE] 회원 정보 업데이트 알림:', message.data);
            // 전체 보드 리로드 (디바운스 적용)
            debouncedLoadWaitingBoard();
            break;

        case 'status_changed':
            // 상태 변경 (출석/취소) - 해당 항목만 제거
            removeWaitingFromBoard(message.data.waiting_id);
            break;

        case 'user_called':
            // 호출 - 시각적 피드백
            highlightWaitingOnBoard(message.data.waiting_id);
            break;

        case 'order_changed':
        case 'class_moved':
        case 'empty_seat_inserted':
            // 순서 변경, 클래스 이동, 빈 좌석 삽입 - 해당 클래스만 업데이트
            updateClassOnly(message.data);
            break;


        case 'class_closed':
            // 교시 마감 - 전체 다시 로드 (마감된 교시 숨김 처리)
            console.log('교시 마감:', message.data);
            debouncedLoadWaitingBoard();
            break;

        default:
            console.log('알 수 없는 이벤트:', message.event);
    }
}

// 새로운 대기자를 현황판에 추가 (화면 새로고침 없이)
async function addNewWaitingToBoard(data) {
    try {
        // 해당 클래스의 컬럼 찾기
        const columns = document.querySelectorAll('.class-column');
        let targetColumn = null;
        let targetList = null;

        columns.forEach(column => {
            const className = column.querySelector('.class-header h2').textContent;
            if (className === data.class_name) {
                targetColumn = column;
                targetList = column.querySelector('.waiting-list');
            }
        });

        if (!targetColumn || !targetList) {
            // 대상 클래스가 현재 화면에 표시되지 않음
            // 화면에 표시되는 교시 수 제한으로 인해 보이지 않는 교시일 수 있음
            // 이 경우 새로고침하지 않고 무시
            console.log('대상 클래스가 현재 화면에 표시되지 않음 (무시):', data.class_name);
            return;
        }

        // 빈 상태 제거
        const emptyState = targetList.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // 새로운 대기자 항목 생성
        const waitingItem = document.createElement('div');
        waitingItem.className = 'waiting-item';
        waitingItem.dataset.waitingId = data.id; // 실제 DB ID 사용
        waitingItem.style.opacity = '0';
        waitingItem.innerHTML = generateWaitingItemHTML(data);

        // 리스트에 추가
        targetList.appendChild(waitingItem);

        // 애니메이션 효과
        setTimeout(() => {
            waitingItem.style.opacity = '1';
        }, 10);

        // 카운트 업데이트
        updateSingleClassCount(targetColumn);


    } catch (error) {
        console.error('대기자 추가 실패:', error);
        // 실패 시 전체 리로드 (디바운스 적용)
        debouncedLoadWaitingBoard();
    }
}

// 단일 클래스의 카운트 업데이트
function updateSingleClassCount(column) {
    const list = column.querySelector('.waiting-list');
    const items = list.querySelectorAll('.waiting-item:not(.empty-state)');
    const countEl = column.querySelector('.count');

    if (countEl) {
        const match = countEl.textContent.match(/최대 (\d+)명/);
        const maxCapacity = match ? match[1] : '0';
        countEl.textContent = `대기 ${items.length}명 / 최대 ${maxCapacity}명`;
    }
}

// 대기자를 현황판에서 제거 (애니메이션과 함께)
function removeWaitingFromBoard(waitingId) {
    const items = document.querySelectorAll('.waiting-item');
    items.forEach(item => {
        if (item.dataset.waitingId == waitingId) {
            const column = item.closest('.class-column');

            item.style.opacity = '0';
            item.style.transform = 'scale(0.8)';

            setTimeout(() => {
                item.remove();

                // 해당 클래스의 카운트 업데이트
                if (column) {
                    updateSingleClassCount(column);

                    // 빈 상태 체크
                    const list = column.querySelector('.waiting-list');
                    const remainingItems = list.querySelectorAll('.waiting-item');

                    if (remainingItems.length === 0) {
                        list.innerHTML = `
                                    <div class="empty-state">
                                        <div class="icon">📭</div>
                                        <p>대기자가 없습니다</p>
                                    </div>
                                `;
                    }
                }
            }, 300);
        }
    });
}

// 대기자 하이라이트 (호출 시)
function highlightWaitingOnBoard(waitingId) {
    const items = document.querySelectorAll('.waiting-item');
    items.forEach(item => {
        if (item.dataset.waitingId == waitingId) {
            item.style.background = 'rgba(255, 255, 255, 0.5)';
            item.style.transform = 'scale(1.05)';
            setTimeout(() => {
                item.style.background = '';
                item.style.transform = '';
            }, 2000);
        }
    });
}

// 클래스별 카운트 업데이트 (전체)
function updateClassCounts() {
    document.querySelectorAll('.class-column').forEach(column => {
        updateSingleClassCount(column);
    });
}

// 특정 클래스만 업데이트 (전체 리로드 없이)
async function updateClassOnly(data) {
    try {
        // 현재 대기현황판 전체 데이터 다시 가져오기
        const response = await fetch('/api/board/display', { headers: getHeaders() });
        const boardData = await response.json();

        // 클래스별로 그룹화
        const classGroups = {};
        boardData.classes.forEach(cls => {
            classGroups[cls.id] = {
                info: cls,
                waiting: []
            };
        });

        boardData.waiting_list.forEach(item => {
            if (classGroups[item.class_id]) {
                classGroups[item.class_id].waiting.push(item);
            }
        });

        // 영향받은 클래스들만 다시 렌더링
        const direction = settings?.list_direction || 'vertical';
        const rowsPerClass = settings?.rows_per_class || 1;

        Object.values(classGroups).forEach(group => {
            const column = document.querySelector(`.class-column[data-class-id="${group.info.id}"]`);
            if (column) {
                // 기존 대기자 리스트 제거하고 새로 렌더링
                const list = column.querySelector('.waiting-list');

                // 클래스와 스타일 재설정 (설정 변경 대응)
                list.className = `waiting-list ${direction}`;
                list.style.gridTemplateColumns = '';

                // 세로 방향이고 2줄 이상인 경우 그리드 레이아웃 적용
                if (direction === 'vertical' && rowsPerClass > 1) {
                    list.classList.add('multi-row');
                    list.style.gridTemplateColumns = `repeat(${rowsPerClass}, 1fr)`;
                }

                list.innerHTML = '';

                if (group.waiting.length === 0) {
                    list.innerHTML = `
                                <div class="empty-state">
                                    <div class="icon">📭</div>
                                    <p>대기자가 없습니다</p>
                                </div>
                            `;
                } else {
                    group.waiting.forEach(item => {
                        const waitingItem = document.createElement('div');
                        waitingItem.className = item.is_empty_seat ? 'waiting-item empty-seat' : 'waiting-item';
                        waitingItem.dataset.waitingId = item.id;
                        waitingItem.dataset.classId = item.class_id;

                        if (!item.is_empty_seat) {
                            waitingItem.draggable = true;
                        }

                        waitingItem.innerHTML = generateWaitingItemHTML(item);

                        // 가로 방향일 때 rowsPerClass에 따라 너비 설정
                        if (direction === 'horizontal') {
                            if (rowsPerClass > 1) {
                                const gapTotal = (rowsPerClass - 1) * 15; // gap 크기
                                const itemWidth = `calc((100% - ${gapTotal}px) / ${rowsPerClass})`;
                                waitingItem.style.flex = `0 0 ${itemWidth}`;
                            } else {
                                // 1줄 설정인 경우 전체 너비 사용
                                waitingItem.style.flex = '0 0 100%';
                            }
                        }

                        list.appendChild(waitingItem);
                    });
                }

                // 카운트 업데이트
                updateSingleClassCount(column);
            }
        });

        // 드래그 앤 드롭 이벤트 리스너 재초기화
        initDragAndDrop();

    } catch (error) {
        console.error('클래스 업데이트 실패:', error);
    }
}

// 이름 마스킹 함수 (예: "홍길동" → "홍O동")
function maskName(name) {
    if (!name || name.length === 0) return name;
    if (name.length === 1) return name;
    if (name.length === 2) return name[0] + 'O';

    // 3글자 이상인 경우: 첫 글자와 마지막 글자만 보여주고 중간은 O로
    const first = name[0];
    const last = name[name.length - 1];
    const middle = 'O'.repeat(name.length - 2);
    return first + middle + last;
}

// 대기자 항목 HTML 생성 (설정에 따라 동적으로)
function generateWaitingItemHTML(item) {
    if (item.is_empty_seat) {
        // 빈 좌석은 설정과 무관하게 고정 표시
        return `
                    <div class="waiting-number">-</div>
                    <div class="waiting-name">빈 좌석</div>
                    <div class="waiting-order">${item.class_order}번째</div>
                `;
    }

    // 설정 가져오기 (기본값 설정)
    const showWaitingNumber = settings?.show_waiting_number !== false;
    const maskCustomerName = settings?.mask_customer_name || false;
    const nameDisplayLength = settings?.name_display_length || 0;
    const showOrderNumber = settings?.show_order_number !== false;
    const displayOrder = settings?.board_display_order || 'number,name,order';

    // 각 요소 생성
    const elements = {};

    if (showWaitingNumber) {
        elements.number = `<div class="waiting-number">대기 ${item.waiting_number}번</div>`;
    }

    // 이름 처리: 마스킹 -> 자릿수 제한 순서로 적용
    let displayName = item.display_name;

    // 전화번호 뒷자리 4자리인지 확인 (숫자 4자리)
    const isPhoneNumber = /^\d{4}$/.test(displayName);

    if (maskCustomerName && !isPhoneNumber) {
        // 전화번호가 아닌 경우에만 마스킹 적용
        displayName = maskName(displayName);
    }
    if (nameDisplayLength > 0 && displayName.length > nameDisplayLength && !isPhoneNumber) {
        // 전화번호가 아닌 경우에만 자릿수 제한 적용
        displayName = displayName.substring(0, nameDisplayLength);
    }
    elements.name = `<div class="waiting-name">${displayName}</div>`;

    if (showOrderNumber) {
        elements.order = `<div class="waiting-order">${item.class_order}번째</div>`;
    }

    // 대기번호가 숨겨진 경우, 순번을 맨 앞에 배치하고 이름을 그 다음에 배치
    let html = '';
    if (!showWaitingNumber && showOrderNumber) {
        // 대기번호 없고 순번 있을 때: [순번] [이름]
        html += elements.order || '';
        html += elements.name || '';
    } else {
        // 그 외의 경우: 설정된 순서대로
        const orderArray = displayOrder.split(',');
        orderArray.forEach(key => {
            if (elements[key]) {
                html += elements[key];
            }
        });
    }

    return html;
}

function loadFont(fontName) {
    if (!fontName) return;
    // System fonts (no download needed)
    if (['Malgun Gothic', 'Arial', 'AppleSDGothicNeo'].includes(fontName)) return;

    // Check if already loaded
    if (document.querySelector(`link[data-font="${fontName}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.font = fontName;

    if (fontName === 'Spoqa Han Sans Neo') {
        link.href = 'https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css';
    } else {
        // Default to Google Fonts
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;700;800&display=swap`;
    }

    document.head.appendChild(link);
}

async function loadSettings() {
    try {
        const response = await fetch('/api/store/', { headers: getHeaders() });
        settings = await response.json();
        document.getElementById('storeName').textContent = settings.store_name;

        // Font Settings
        if (settings.board_font_family) {
            loadFont(settings.board_font_family);
            document.documentElement.style.setProperty('--board-font-family', `"${settings.board_font_family}", sans-serif`);
        }
        if (settings.board_font_size) {
            document.documentElement.style.setProperty('--board-font-size', settings.board_font_size);
        }

    } catch (error) {
        console.error('설정 조회 실패:', error);
    }
}

async function loadWaitingBoard() {
    try {
        const response = await fetch('/api/board/display', { headers: getHeaders() });
        const data = await response.json();

        // 날짜 표시
        const dateObj = new Date(data.business_date);
        document.getElementById('currentDate').textContent =
            `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;

        // 클래스별로 그룹화
        const classGroups = {};
        data.classes.forEach(cls => {
            classGroups[cls.id] = {
                info: cls,
                waiting: []
            };
        });

        data.waiting_list.forEach(item => {
            if (classGroups[item.class_id]) {
                classGroups[item.class_id].waiting.push(item);
            }
        });

        // 화면 렌더링
        renderBoard(classGroups);

    } catch (error) {
        console.error('대기현황판 조회 실패:', error);
    }
}

function renderBoard(classGroups) {
    const container = document.getElementById('classesContainer');
    container.innerHTML = '';

    const direction = settings?.list_direction || 'vertical';
    const rowsPerClass = settings?.rows_per_class || 1;

    Object.values(classGroups).forEach(group => {
        const column = document.createElement('div');
        column.className = 'class-column';

        // 클래스 헤더
        const header = document.createElement('div');
        header.className = 'class-header';
        header.innerHTML = `
                    <h2>${group.info.class_name}</h2>
                    <div class="class-header-info">
                        <div class="time">${group.info.start_time.substring(0, 5)} ~ ${group.info.end_time.substring(0, 5)}</div>
                        <div class="count">대기 ${group.waiting.length}명 / 최대 ${group.info.max_capacity}명</div>
                    </div>
                `;
        column.appendChild(header);

        // 대기자 목록
        const list = document.createElement('div');
        list.className = `waiting-list ${direction}`;

        // 세로 방향이고 2줄 이상인 경우 그리드 레이아웃 적용
        if (direction === 'vertical' && rowsPerClass > 1) {
            list.classList.add('multi-row');
            list.style.gridTemplateColumns = `repeat(${rowsPerClass}, 1fr)`;
        }

        if (group.waiting.length === 0) {
            list.innerHTML = `
                        <div class="empty-state">
                            <div class="icon">📭</div>
                            <p>대기자가 없습니다</p>
                        </div>
                    `;
        } else {
            group.waiting.forEach(item => {
                const waitingItem = document.createElement('div');
                waitingItem.className = item.is_empty_seat ? 'waiting-item empty-seat' : 'waiting-item';
                waitingItem.dataset.waitingId = item.id; // 실제 DB ID로 식별
                waitingItem.dataset.classId = item.class_id; // 클래스 ID 저장

                // 드래그 가능하도록 설정 (빈 좌석 제외)
                if (!item.is_empty_seat) {
                    waitingItem.draggable = true;
                }

                waitingItem.innerHTML = generateWaitingItemHTML(item);

                // 가로 방향일 때 rowsPerClass에 따라 너비 설정
                if (direction === 'horizontal') {
                    if (rowsPerClass > 1) {
                        const gapTotal = (rowsPerClass - 1) * 15; // gap 크기
                        const itemWidth = `calc((100% - ${gapTotal}px) / ${rowsPerClass})`;
                        waitingItem.style.flex = `0 0 ${itemWidth}`;
                    } else {
                        // 1줄 설정인 경우 전체 너비 사용
                        waitingItem.style.flex = '0 0 100%';
                    }
                }

                list.appendChild(waitingItem);
            });
        }

        column.appendChild(list);
        column.dataset.classId = group.info.id; // 클래스 ID 저장
        container.appendChild(column);
    });

    // 드래그 앤 드롭 이벤트 리스너 추가
    initDragAndDrop();
}

let draggedItem = null;
let draggedFromClassId = null;

function initDragAndDrop() {
    const waitingItems = document.querySelectorAll('.waiting-item[draggable="true"]');

    waitingItems.forEach(item => {
        // 드래그 시작
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            draggedFromClassId = item.dataset.classId;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
        });

        // 드래그 종료
        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
            // 모든 drag-over 클래스 제거
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
            document.querySelectorAll('.drag-target').forEach(el => {
                el.classList.remove('drag-target');
            });
        });

        // 드래그 오버 (다른 대기자 위로)
        item.addEventListener('dragover', (e) => {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';

            if (draggedItem !== item) {
                item.classList.add('drag-over');
            }
            return false;
        });

        // 드래그 나가기
        item.addEventListener('dragleave', (e) => {
            item.classList.remove('drag-over');
        });

        // 드롭 (다른 대기자 위에 드롭)
        item.addEventListener('drop', async (e) => {
            if (e.stopPropagation) {
                e.stopPropagation();
            }

            if (draggedItem !== item) {
                const draggedWaitingId = parseInt(draggedItem.dataset.waitingId);
                const targetWaitingId = parseInt(item.dataset.waitingId);
                const targetClassId = item.dataset.classId;

                // 같은 클래스 내에서 순서 변경
                if (draggedFromClassId === targetClassId) {
                    await swapWaitingOrder(draggedWaitingId, targetWaitingId);
                } else {
                    // 다른 클래스로 이동
                    await moveToClass(draggedWaitingId, targetClassId);
                }
            }

            item.classList.remove('drag-over');
            return false;
        });
    });

    // 클래스 컬럼에도 드롭 이벤트 추가 (빈 공간에 드롭)
    const classColumns = document.querySelectorAll('.class-column');
    classColumns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            column.classList.add('drag-target');
            return false;
        });

        column.addEventListener('dragleave', (e) => {
            // 컬럼 밖으로 나갈 때만 제거
            if (e.target === column) {
                column.classList.remove('drag-target');
            }
        });

        column.addEventListener('drop', async (e) => {
            if (e.stopPropagation) {
                e.stopPropagation();
            }

            const targetClassId = column.dataset.classId;
            const draggedWaitingId = parseInt(draggedItem.dataset.waitingId);

            // 다른 클래스로 이동
            if (draggedFromClassId !== targetClassId) {
                await moveToClass(draggedWaitingId, targetClassId);
            }

            column.classList.remove('drag-target');
            return false;
        });
    });
}

// 같은 클래스 내에서 두 대기자의 순서 교체
async function swapWaitingOrder(waitingId1, waitingId2) {
    try {
        const response = await fetch(`/api/board/${waitingId1}/swap/${waitingId2}`, {
            method: 'PUT',
            headers: getHeaders({ 'Content-Type': 'application/json' })
        });

        if (response.ok) {
            console.log('순서 교체 성공');
            // SSE로 자동 리로드됨
        } else {
            const error = await response.json();
            console.error('순서 교체 실패:', error.detail);
        }
    } catch (error) {
        console.error('순서 교체 실패:', error);
    }
}

// 다른 클래스로 이동
async function moveToClass(waitingId, targetClassId) {
    try {
        const response = await fetch(`/api/board/${waitingId}/move-class`, {
            method: 'PUT',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                target_class_id: parseInt(targetClassId)
            })
        });

        if (response.ok) {
            console.log('클래스 이동 성공');
            // SSE로 자동 리로드됨
        } else {
            const error = await response.json();
            console.error('클래스 이동 실패:', error.detail);
        }
    } catch (error) {
        console.error('클래스 이동 중 오류:', error);
    }
}

// URL 파라미터에서 매장 정보 가져오기
async function checkUrlStoreParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');

    if (storeParam) {
        try {
            const response = await fetch(`/api/stores/code/${storeParam}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });
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

async function initialize() {
    await checkUrlStoreParam();  // URL 파라미터 먼저 확인
    await loadSettings();
    await loadWaitingBoard();

    // SSE 연결 초기화
    initSSE();
}

// 초기화
initialize();

// 페이지 벗어날 때 SSE 연결 닫기
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
});

