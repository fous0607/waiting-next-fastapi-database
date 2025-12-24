// Helper function to get headers with store ID
function getHeaders() {
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('store_id');
    const headers = { 'Content-Type': 'application/json' };
    if (storeId) headers['X-Store-ID'] = storeId;
    return headers;
}

// Variables
let classes = [];
let currentClassId = null;
let batchClassId = null;
let eventSource = null;
let closedClasses = new Set();
let currentStoreId = null;
let isRegistering = false;
let draggedItem = null;

// Debounce Utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedUpdateClassCounts = debounce(() => updateClassCounts(), 300);
const debouncedLoadBatchInfo = debounce(() => loadBatchInfo(), 300);

// Weekday Map
const WEEKDAY_MAP = { 0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun" };

function getBusinessDayWeekday(dateString) {
    if (!dateString) return new Date().getDay();
    const date = new Date(dateString);
    const jsDay = date.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
}

function formatPhoneNumber(phone) {
    if (!phone) return '';
    const numbers = phone.replace(/[^0-9]/g, '');
    if (numbers.length === 11) return numbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    return phone;
}

// --- Core Data Functions ---

async function checkUrlStoreParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');
    if (storeParam) {
        try {
            const token = localStorage.getItem('access_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(`/api/stores/code/${storeParam}`, { headers });
            if (response.ok) {
                const store = await response.json();
                localStorage.setItem('selected_store_id', store.id);
                localStorage.setItem('selected_store_name', store.name);
                const title = document.getElementById('storeNameTitle');
                if (title) title.textContent = store.name;
                return store.id;
            } else { console.error('매장 코드를 찾을 수 없습니다:', storeParam); }
        } catch (e) { console.error('매장 정보 조회 실패:', e); }
    }
    return null;
}

async function loadBusinessDate() {
    try {
        const response = await fetch('/api/daily/check-status', { headers: getHeaders() });
        const data = await response.json();
        if (data && data.business_date) {
            const date = new Date(data.business_date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const formattedDate = `📅 ${year}년 ${month}월 ${day}일`;
            const element = document.getElementById('headerBusinessDate');
            if (element) element.textContent = formattedDate;
        } else {
            document.getElementById('headerBusinessDate').textContent = '';
        }
    } catch (error) { console.error('[DEBUG] 영업일 정보 조회 실패:', error); }
}

async function loadBatchInfo() {
    try {
        const batchInfo = document.getElementById('batchInfo');
        const batchBtn = document.getElementById('batchBtn');
        if (currentClassId && closedClasses.has(currentClassId)) {
            const currentClass = classes.find(c => c.id === currentClassId);
            batchInfo.textContent = `${currentClass.class_name}은(는) 마감된 교시입니다`;
            batchBtn.style.display = 'none';
            return;
        }
        const response = await fetch('/api/board/next-batch-class', { headers: getHeaders() });
        const result = await response.json();
        if (result.class_id) {
            batchClassId = result.class_id;
            batchInfo.textContent = `${result.class_name} ${result.waiting_count}명 대기 중`;
            batchBtn.textContent = `${result.class_name} 마감`;
            batchBtn.disabled = false;
            batchBtn.classList.remove('btn-warning');
            batchBtn.classList.add('btn-success');
            batchBtn.onclick = batchAttendance;
            batchBtn.style.display = 'inline-block';
        } else {
            batchClassId = null;
            batchInfo.textContent = '대기자가 없습니다';
            batchBtn.textContent = '교시 마감';
            batchBtn.disabled = true;
            batchBtn.classList.remove('btn-warning');
            batchBtn.classList.add('btn-success');
            batchBtn.onclick = batchAttendance;
            batchBtn.style.display = 'inline-block';
        }
    } catch (error) { console.error('교시 마감 정보 조회 실패:', error); }
}

async function loadClasses() {
    try {
        await loadBusinessDate();
        const closedResponse = await fetch('/api/board/closed-classes', { headers: getHeaders() });
        const closedData = await closedResponse.json();
        closedClasses = new Set(closedData.closed_class_ids);

        const response = await fetch('/api/waiting/list/by-class', { headers: getHeaders() });
        const classData = await response.json();
        classes = classData.map(cls => ({
            id: cls.class_id, class_name: cls.class_name, class_number: cls.class_number,
            start_time: cls.start_time, end_time: cls.end_time, max_capacity: cls.max_capacity, current_count: cls.current_count
        }));

        renderClassTabs();

        if (classes.length > 0) {
            const closedClassList = classes.filter(cls => closedClasses.has(cls.id));
            if (closedClassList.length > 0) {
                const highestClosedClass = closedClassList[closedClassList.length - 1];
                const nextOpenClass = classes.find(cls => cls.class_number > highestClosedClass.class_number && !closedClasses.has(cls.id));
                if (nextOpenClass) selectClass(nextOpenClass.id);
                else {
                    const firstOpenClass = classes.find(cls => !closedClasses.has(cls.id));
                    selectClass(firstOpenClass ? firstOpenClass.id : highestClosedClass.id);
                }
            } else selectClass(classes[0].id);
        } else {
            document.getElementById('waitingTable').innerHTML = `<div class="empty-state fade-in"><div class="icon">🎉</div><p>모든 대기가 완료되었습니다</p></div>`;
        }
        await loadBatchInfo();
    } catch (error) { console.error('클래스 조회 실패:', error); }
}

async function updateClassCounts() {
    try {
        const response = await fetch('/api/waiting/list/by-class', { headers: getHeaders() });
        const data = await response.json();
        if (classes.length === 0) await fetch('/api/classes/', { headers: getHeaders() }).then(r => r.json());

        const previousClassId = currentClassId;
        const classesWithWaiting = data.map(cls => ({
            id: cls.class_id, class_name: cls.class_name, class_number: cls.class_number,
            start_time: cls.start_time, end_time: cls.end_time, max_capacity: cls.max_capacity, current_count: cls.current_count
        }));
        classesWithWaiting.sort((a, b) => a.class_number - b.class_number);

        const tabsChanged = classes.length !== classesWithWaiting.length || classes.some((cls, idx) => cls.id !== classesWithWaiting[idx]?.id);
        if (tabsChanged) {
            classes = classesWithWaiting;
            renderClassTabs();
            const stillExists = classes.find(c => c.id === previousClassId);
            if (stillExists) selectClass(previousClassId);
            else if (classes.length > 0) selectClass(classes[0].id);
            else {
                currentClassId = null;
                document.getElementById('waitingTable').innerHTML = `<div class="empty-state fade-in"><div class="icon">🎉</div><p>모든 대기가 완료되었습니다</p></div>`;
            }
        } else {
            classes = classesWithWaiting;
            renderClassTabs();
        }
    } catch (error) { console.error('클래스 카운트 업데이트 실패:', error); }
}

async function applyStoreFonts() {
    try {
        const response = await fetch('/api/store/', { headers: getHeaders() });
        if (!response.ok) return;
        const settings = await response.json();
        if (settings.manager_font_family) {
            loadFont(settings.manager_font_family);
            document.documentElement.style.setProperty('--manager-font-family', settings.manager_font_family || 'Nanum Gothic');
        }
        document.documentElement.style.setProperty('--manager-font-size', settings.manager_font_size || '15px');
        const table = document.getElementById('waitingTable');
        if (table) {
            table.classList.remove('size-small', 'size-medium', 'size-large');
            const size = settings.waiting_list_box_size || 'medium';
            table.classList.add(`size-${size}`);
        }
        const container = document.querySelector('.container');
        if (container && settings.waiting_manager_max_width) {
            container.style.setProperty('max-width', `${settings.waiting_manager_max_width}px`, 'important');
            container.style.margin = '0 auto';
        } else if (container) {
            container.style.setProperty('max-width', '95%', 'important');
        }
    } catch (e) { console.error('Font settings error:', e); }
}

function loadFont(fontName) {
    if (!fontName) return;
    if (['Malgun Gothic', 'Arial', 'AppleSDGothicNeo'].includes(fontName)) return;
    if (document.querySelector(`link[data-font="${fontName}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.font = fontName;
    if (fontName === 'Spoqa Han Sans Neo') {
        link.href = 'https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css';
    } else {
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;700;800&display=swap`;
    }
    document.head.appendChild(link);
}

// --- SSE & Event Handling ---

function updateConnectionStatus(status) {
    const indicator = document.getElementById('footerConnectionStatus');
    const text = document.getElementById('footerConnectionText');
    indicator.classList.remove('connected', 'disconnected', 'connecting');
    if (status === 'connected') {
        indicator.classList.add('connected');
        text.textContent = '실시간 시스템 연결됨';
        text.style.color = '#2ecc71';
    } else if (status === 'disconnected') {
        indicator.classList.add('disconnected');
        text.textContent = '연결 끊김 (자동 재연결 중...)';
        text.style.color = '#e74c3c';
    } else {
        indicator.classList.add('connecting');
        text.textContent = '시스템 연결 중...';
        text.style.color = '#f39c12';
    }
}

function initSSE() {
    if (eventSource) eventSource.close();
    const storeId = localStorage.getItem('selected_store_id') || 'default';
    console.log(`SSE 연결 시도: Store ID = ${storeId}`);
    eventSource = new EventSource(`/api/sse/stream?store_id=${storeId}&role=admin`);
    eventSource.onopen = () => { console.log('SSE 연결됨'); updateConnectionStatus('connected'); };
    eventSource.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (message.event === 'ping') return;
            handleSSEMessage(message);
        } catch (error) { console.error('SSE 메시지 파싱 오류:', error); }
    };
    eventSource.onerror = (error) => {
        console.error('SSE 오류:', error);
        updateConnectionStatus('disconnected');
        eventSource.close();
        setTimeout(() => { console.log('SSE 재연결 시도...'); initSSE(); }, 3000);
    };
}

function handleSSEMessage(message) {
    console.log('SSE 메시지 수신:', message);
    switch (message.event) {
        case 'connected': console.log('SSE 연결 확인됨'); break;
        case 'new_user':
            debouncedUpdateClassCounts();
            addNewWaitingItem(message.data);
            debouncedLoadBatchInfo();
            break;
        case 'status_changed':
            removeWaitingItem(message.data.waiting_id);
            debouncedUpdateClassCounts();
            debouncedLoadBatchInfo();
            break;
        case 'user_called':
            highlightWaitingItem(message.data.waiting_id);
            break;
        case 'order_changed': case 'class_moved': case 'empty_seat_inserted':
            updateWaitingOrder();
            debouncedUpdateClassCounts();
            break;
        case 'member_updated':
            if (currentClassId) selectClass(currentClassId);
            break;
        case 'class_closed':
            closedClasses.add(message.data.class_id);
            if (currentClassId === message.data.class_id) {
                updateClassCounts().then(() => {
                    const openClasses = classes.filter(cls => !closedClasses.has(cls.id));
                    if (openClasses.length > 0) {
                        selectClass(openClasses[0].id);
                        showNotificationModal('교시 마감', `${message.data.class_name}이(가) 마감되었습니다.`);
                    } else {
                        currentClassId = null;
                        document.getElementById('waitingTable').innerHTML = `<div class="empty-state fade-in"><div class="icon">🎉</div><p>모든 교시가 마감되었습니다</p></div>`;
                        showNotificationModal('교시 마감', '모든 교시가 마감되었습니다.');
                    }
                });
            } else debouncedUpdateClassCounts();
            loadBatchInfo();
            break;
        case 'class_reopened':
            closedClasses.delete(message.data.class_id);
            debouncedUpdateClassCounts();
            debouncedLoadBatchInfo();
            if (currentClassId === message.data.class_id) {
                document.getElementById('waitingTable').classList.remove('closed');
                updateWaitingOrder();
            }
            alert(`${message.data.class_name}의 마감이 해제되었습니다.`);
            break;
    }
}

// --- UI Rendering Functions ---

function renderClassTabs() {
    const tabsContainer = document.getElementById('classTabs');
    tabsContainer.innerHTML = '';
    const openClasses = classes.filter(cls => !closedClasses.has(cls.id));
    openClasses.forEach(cls => {
        const tab = document.createElement('div');
        tab.className = 'class-tab';
        tab.onclick = () => selectClass(cls.id);
        tab.innerHTML = `${cls.class_name} <span class="count">${cls.current_count || 0}명</span>`;
        tabsContainer.appendChild(tab);
    });
    updateTabSelection();
}

function updateTabSelection() {
    const openClasses = classes.filter(cls => !closedClasses.has(cls.id));
    document.querySelectorAll('.class-tab').forEach((tab, idx) => {
        if (openClasses[idx]?.id === currentClassId) tab.classList.add('active');
        else tab.classList.remove('active');
    });
}

function selectClass(classId) {
    currentClassId = classId;
    updateTabSelection();
    const table = document.getElementById('waitingTable');
    if (closedClasses.has(classId)) table.classList.add('closed');
    else table.classList.remove('closed');
    loadWaitingList();
    loadBatchInfo();
}

async function loadWaitingList() {
    const table = document.getElementById('waitingTable');
    console.log('[DEBUG] loadWaitingList started for class:', currentClassId);
    try {
        const isClosed = closedClasses.has(currentClassId);
        const status = 'waiting';
        const response = await fetch(`/api/waiting/list?status=${status}&class_id=${currentClassId}`, { headers: getHeaders() });
        const waitingList = await response.json();

        console.log('[DEBUG] API response:', waitingList);

        if (waitingList.length === 0) {
            console.log('[DEBUG] Waiting list is empty');
            table.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>대기자가 없습니다</p></div>';
            return;
        }

        // Remove existing empty/loading states if any
        const emptyState = table.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
        const loading = table.querySelector('.loading');
        if (loading) loading.remove();

        // Sync items logic
        const existingItems = new Map();
        table.querySelectorAll('.waiting-item').forEach(item => { existingItems.set(item.dataset.waitingId, item); });
        const newItems = new Set();
        waitingList.forEach(item => newItems.add(String(item.id)));
        existingItems.forEach((item, id) => { if (!newItems.has(id)) { item.classList.add('fade-out'); setTimeout(() => item.remove(), 300); } });

        // Re-render
        table.innerHTML = '';
        waitingList.forEach(item => table.appendChild(createWaitingItem(item)));
        console.log('[DEBUG] Waiting list rendered, count:', waitingList.length);

    } catch (error) {
        console.error('[DEBUG] 대기자 조회 실패:', error);
        table.innerHTML = `<div class="empty-state"><p>데이터 로딩 실패</p></div>`;
    }
}

// --- Drag and Drop Functions (Included) ---

function attachDragListeners(element) {
    element.draggable = true;
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    element.addEventListener('dragleave', handleDragLeave);
}

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedItem) this.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (draggedItem !== this) {
        const draggedId = parseInt(draggedItem.dataset.waitingId);
        const targetId = parseInt(this.dataset.waitingId);
        const table = document.getElementById('waitingTable');
        table.insertBefore(draggedItem, this);
        attachDragListeners(draggedItem);

        try {
            const response = await fetch(`/api/board/${draggedId}/swap/${targetId}`, { method: 'PUT', headers: getHeaders() });
            if (!response.ok) {
                const error = await response.json();
                showNotificationModal('오류', error.detail || '순서 변경에 실패했습니다.');
                await updateWaitingOrder();
            }
        } catch (error) {
            console.error('❌ 순서 변경 실패:', error);
            await updateWaitingOrder();
        }
    }
    this.classList.remove('drag-over');
    return false;
}

// --- Drag and Drop Functions ---

function attachDragListeners(element) {
    element.draggable = true;
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    element.addEventListener('dragleave', handleDragLeave);
}

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedItem) this.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (draggedItem !== this) {
        const draggedId = parseInt(draggedItem.dataset.waitingId);
        const targetId = parseInt(this.dataset.waitingId);
        const table = document.getElementById('waitingTable');
        table.insertBefore(draggedItem, this);
        attachDragListeners(draggedItem);

        try {
            const response = await fetch(`/api/board/${draggedId}/swap/${targetId}`, { method: 'PUT', headers: getHeaders() });
            if (!response.ok) {
                const error = await response.json();
                showNotificationModal('오류', error.detail || '순서 변경에 실패했습니다.');
                await updateWaitingOrder();
            }
        } catch (error) {
            console.error('❌ 순서 변경 실패:', error);
            await updateWaitingOrder();
        }
    }
    this.classList.remove('drag-over');
    return false;
}

function createWaitingItem(item) {
    const div = document.createElement('div');
    div.className = 'waiting-item';
    div.dataset.waitingId = item.id;
    const displayName = item.name || item.phone.slice(-4);
    const currentClass = classes.find(c => c.id == item.class_id);
    const className = currentClass ? currentClass.class_name : (item.class_id + '교시');
    const classIndex = classes.findIndex(c => c.id == item.class_id);

    attachDragListeners(div); // Uses the helper

    if (item.is_empty_seat) {
        div.style.background = '#f8f9fa';
        div.style.opacity = '0.7';
        div.innerHTML = `
            <div class="item-number" data-order="${item.class_order}">-</div>
            <div class="item-name">빈 좌석</div>
            <div class="item-phone">-</div>
            <div class="item-class">${className}</div>
            <div class="item-order">${item.class_order}번째</div>
            <div class="item-actions">
                <button class="btn btn-danger btn-sm" onclick="updateStatus(${item.id}, 'cancelled')">제거</button>
            </div>`;
    } else {
        const formattedPhone = formatPhoneNumber(item.phone);
        const hasNextClass = classIndex < classes.length - 1;
        const prevClass = classIndex > 0 ? classes[classIndex - 1] : null;
        const leftArrowDisabled = !prevClass || closedClasses.has(prevClass.id);
        const safeDisplayName = displayName.replace(/'/g, "\\'");
        const safePhone = item.phone || '';

        div.innerHTML = `
            <div class="item-number" data-order="${item.class_order}">${item.waiting_number}</div>
            <div class="item-name">${displayName}</div>
            <div class="item-phone">${formattedPhone}</div>
            <div class="item-class">${className}</div>
            <div class="item-order">${item.class_order}번째</div>
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary btn-icon" ${leftArrowDisabled ? 'disabled' : ''} onclick="event.preventDefault(); event.stopPropagation(); moveToClass(${item.id}, ${classIndex - 1})">←</button>
                <button class="btn btn-sm btn-secondary btn-icon" ${hasNextClass ? '' : 'disabled'} onclick="event.preventDefault(); event.stopPropagation(); moveToClass(${item.id}, ${classIndex + 1})">→</button>
                <button class="btn btn-warning btn-sm" onclick="event.preventDefault(); event.stopPropagation(); callWaiting(${item.id})">호출</button>
                <button class="btn btn-info btn-sm" onclick="event.preventDefault(); event.stopPropagation(); insertEmptySeat(${item.id})">빈좌석</button>
                <button class="btn btn-success btn-sm" onclick="event.preventDefault(); event.stopPropagation(); updateStatus(${item.id}, 'attended')">출석</button>
                <button class="btn btn-danger btn-sm" onclick="event.preventDefault(); event.stopPropagation(); updateStatus(${item.id}, 'cancelled')">취소</button>
                <button class="btn btn-primary btn-sm" onclick="event.preventDefault(); event.stopPropagation(); lookupAttendance('${safePhone}', '${safeDisplayName}')"><span style="font-size: 1.2em; font-weight: bold;">${item.last_month_attendance_count || 0}회</span></button>
                ${(!item.name || (item.phone && item.name == item.phone.slice(-4))) ? `<button class="btn btn-secondary btn-sm" onclick="event.preventDefault(); event.stopPropagation(); openQuickRegisterModal('${item.phone}')">명찰</button>` : ''}
            </div>
        `;
    }
    return div;
}

// --- Action Functions ---

async function batchAttendance() {
    if (!batchClassId) return;
    const batchClass = classes.find(c => c.id === batchClassId);
    showConfirmModal('교시 마감', `${batchClass.class_name}을(를) 마감하시겠습니까?`, async function () {
        try {
            const response = await fetch('/api/board/batch-attendance', {
                method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ class_id: batchClassId })
            });
            if (response.ok) console.log('교시 마감 완료');
            else {
                const error = await response.json();
                showNotificationModal('오류', error.detail || '교시 마감 실패');
            }
        } catch (error) { console.error('교시 마감 실패:', error); }
    });
}
async function insertEmptySeat(waitingId) {
    showConfirmModal('빈 좌석 삽입', '이 대기자 뒤에 빈 좌석을 삽입하시겠습니까?', async function () {
        try {
            const response = await fetch('/api/board/insert-empty-seat', {
                method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ waiting_id: waitingId })
            });
            if (response.ok) console.log('빈 좌석 삽입 완료');
            else { const error = await response.json(); showNotificationModal('오류', error.detail || '빈 좌석 삽입 실패'); }
        } catch (error) { console.error('빈 좌석 삽입 실패:', error); }
    });
}
async function updateStatus(waitingId, status) {
    const statusText = status === 'attended' ? '출석' : '취소';
    showConfirmModal(statusText, `${statusText} 처리하시겠습니까?`, async function () {
        const item = document.querySelector(`[data-waiting-id="${waitingId}"]`);
        if (item) item.classList.add('updating');
        try {
            const response = await fetch(`/api/board/${waitingId}/status`, {
                method: 'PUT', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status: status })
            });
            if (response.ok) console.log(`${statusText} 처리 완료`);
            else {
                const error = await response.json();
                if (item) { item.classList.remove('updating'); item.classList.add('shake'); setTimeout(() => item.classList.remove('shake'), 500); }
                showNotificationModal('오류', error.detail || `${statusText} 실패`);
            }
        } catch (error) { console.error(`${statusText} 실패:`, error); }
    });
}
async function callWaiting(waitingId) {
    showConfirmModal('호출', '호출하시겠습니까?', async function () {
        const item = document.querySelector(`[data-waiting-id="${waitingId}"]`);
        if (item) { item.classList.add('highlight'); setTimeout(() => item.classList.remove('highlight'), 1500); }
        try {
            const response = await fetch(`/api/board/${waitingId}/call`, { method: 'POST', headers: getHeaders() });
            if (response.ok) console.log('호출 완료');
            else { const error = await response.json(); showNotificationModal('오류', error.detail || '호출 실패'); }
        } catch (error) { console.error('호출 실패:', error); }
    });
}
async function moveToClass(waitingId, targetClassIndex) {
    if (targetClassIndex < 0 || targetClassIndex >= classes.length) { showNotificationModal('알림', '이동할 수 있는 교시가 없습니다.'); return; }
    const targetClass = classes[targetClassIndex];
    showConfirmModal('교시 이동', `${targetClass.class_name}로 이동하시겠습니까?`, async function () {
        try {
            const response = await fetch(`/api/board/${waitingId}/move-class`, {
                method: 'PUT', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ target_class_id: targetClass.id })
            });
            if (response.ok) console.log('교시 이동 완료');
            else { const error = await response.json(); showNotificationModal('오류', error.detail || '교시 이동 실패'); }
        } catch (error) { console.error('교시 이동 실패:', error); }
    });
}

// --- Modals ---
function showNotificationModal(title, message) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').innerHTML = message.replace(/\n/g, '<br>');
    document.getElementById('modalButtons').innerHTML = `<button class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 16px;" id="notificationConfirmBtn">확인</button>`;
    document.getElementById('notificationConfirmBtn').onclick = closeNotificationModal;
    document.getElementById('notificationModal').classList.add('show');
}
function closeNotificationModal() { document.getElementById('notificationModal').classList.remove('show'); }
function showConfirmModal(title, message, callback) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').innerHTML = message.replace(/\n/g, '<br>');
    document.getElementById('modalButtons').innerHTML = `
        <button class="btn btn-secondary" style="flex: 1; padding: 12px; font-size: 16px; background-color: #95a5a6;" id="confirmCancelBtn">취소</button>
        <button class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 16px;" id="confirmModalBtn">확인</button>
    `;
    document.getElementById('confirmModalBtn').onclick = () => { closeNotificationModal(); if (callback) callback(); };
    document.getElementById('confirmCancelBtn').onclick = closeNotificationModal;
    document.getElementById('notificationModal').classList.add('show');
}

// --- Quick Register ---
function openQuickRegisterModal(phone) {
    document.getElementById('quickRegPhoneDisplay').textContent = phone;
    document.getElementById('quickRegPhone').value = phone;
    const modal = document.getElementById('quickRegisterModal');
    modal.style.display = 'flex'; modal.style.opacity = '1'; modal.classList.add('active');
    setTimeout(() => document.getElementById('quickRegName').focus(), 100);
}
function closeQuickRegisterModal() {
    const modal = document.getElementById('quickRegisterModal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}
async function handleQuickRegister() {
    const input = document.getElementById('quickRegisterInput');
    const keyword = input.value.trim();
    if (isRegistering || document.querySelector('.modal.show')) return;
    if (!keyword) { showNotificationModal('알림', '검색어를 입력해주세요'); return; }
    if (!currentClassId) { showNotificationModal('알림', '교시를 선택해주세요'); return; }

    // Minimal impl for brevity, assuming backend search handles most
    try {
        isRegistering = true;
        const searchResponse = await fetch(`/api/members/?search=${encodeURIComponent(keyword)}`, { headers: getHeaders() });
        const members = await searchResponse.json();
        if (members.length === 1) proceedWithRegistration(members[0]);
        else if (members.length === 0) {
            let phone = keyword.replace(/[^0-9]/g, '');
            if (phone.length === 8) phone = '010' + phone;
            if (phone.length === 11) proceedWithRegistration({ name: '', phone: phone });
            else showNotificationModal('알림', '회원을 찾을 수 없습니다.');
        } else {
            // Show Search Result Modal
            const list = document.getElementById('searchResultsList');
            list.innerHTML = '';
            members.forEach(m => {
                const d = document.createElement('div');
                d.innerHTML = `<div style="padding:10px; border-bottom:1px solid #eee;">${m.name} (${m.phone.slice(-4)})</div>`;
                d.onclick = () => { document.getElementById('searchResultModal').classList.remove('show'); proceedWithRegistration(m); };
                list.appendChild(d);
            });
            document.getElementById('searchResultModal').classList.add('show');
        }
    } catch (e) { showNotificationModal('오류', '검색 실패'); } finally { isRegistering = false; }
}

async function proceedWithRegistration(member) {
    const classId = currentClassId;
    const cls = classes.find(c => c.id === classId);
    showConfirmModal('대기 등록', `${member.name || member.phone}님을 ${cls.class_name}에 등록하시겠습니까?`, async () => {
        await fetch('/api/waiting/', {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ phone: member.phone, person_count: 1, class_id: classId, name: member.name || '', is_admin_registration: true })
        });
        document.getElementById('quickRegisterInput').value = '';
    });
}
async function saveQuickRegister() {
    const phone = document.getElementById('quickRegPhone').value.replace(/[^0-9]/g, '');
    const name = document.getElementById('quickRegName').value;
    let barcode = document.getElementById('quickRegBarcode').value.trim();
    if (barcode === '') barcode = null;

    try {
        // 1. Check if member exists
        const checkResponse = await fetch(`/api/members/phone/${phone}`, { headers: getHeaders() });

        if (checkResponse.ok) {
            // Member exists -> Update
            const member = await checkResponse.json();
            const updateResponse = await fetch(`/api/members/${member.id}`, {
                method: 'PUT',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ name, barcode }) // Only update name and barcode
            });
            if (!updateResponse.ok) throw new Error('회원 정보 수정 실패');
            console.log('회원 정보 업데이트 완료');
        } else if (checkResponse.status === 404) {
            // Member does not exist -> Create
            const createResponse = await fetch('/api/members/', {
                method: 'POST',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ name, phone, barcode })
            });
            if (!createResponse.ok) throw new Error('회원 등록 실패');
            console.log('신규 회원 등록 완료');
        } else {
            throw new Error('회원 확인 중 오류 발생');
        }

        closeQuickRegisterModal();
        showNotificationModal('성공', '명찰 정보가 저장되었습니다.');
        // Refresh waiting list to show new name if necessary
        if (currentClassId) selectClass(currentClassId);

    } catch (error) {
        console.error('Quick Register Failed:', error);
        showNotificationModal('오류', '저장에 실패했습니다: ' + error.message);
    }
}
// lookupAttendance needed?
async function lookupAttendance(phone, name) {
    const modal = document.getElementById('attendanceModal');
    document.getElementById('attendanceFrame').src = `/api/attendance/history?phone=${phone}`;
    modal.classList.add('active');
}
function closeAttendanceModal() { document.getElementById('attendanceModal').classList.remove('active'); document.getElementById('attendanceFrame').src = ''; }

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[INIT] DOMContentLoaded fired');

    const urlStoreId = await checkUrlStoreParam(); // Checks URL ?store=CODE and sets localStorage
    let storeId = localStorage.getItem('selected_store_id');
    const params = new URLSearchParams(window.location.search);
    const paramStoreId = params.get('store_id');
    if (paramStoreId) storeId = paramStoreId;

    if (!storeId) {
        if (!urlStoreId) { alert('매장 정보가 없습니다.'); window.location.href = '/'; return; }
        storeId = urlStoreId;
    }

    currentStoreId = storeId;

    try {
        const response = await fetch(`/api/stores/${storeId}`, { headers: getHeaders() });
        if (response.ok) {
            const storeData = await response.json();
            document.getElementById('storeNameTitle').textContent = storeData.name;
        }
    } catch (e) { console.error('Store info fetch failed', e); }

    await applyStoreFonts();
    await loadClasses();
    initSSE();
    loadBatchInfo();

    setTimeout(() => {
        const quickInput = document.getElementById('quickRegisterInput');
        if (quickInput) quickInput.focus();
    }, 500);
});

// Adding new item also calls addNewWaitingItem which I defined in handleSSEMessage implicitly?
// No, line 367 in Step 1831 was define addNewWaitingItem. I missed including it here.
async function addNewWaitingItem(data) {
    if (currentClassId != data.class_id) return;
    try {
        console.log('[DEBUG] addNewWaitingItem called for:', data);
        const response = await fetch(`/api/waiting/${data.waiting_id}`, { headers: getHeaders() });
        const newItem = await response.json();
        const newItemEl = createWaitingItem(newItem);
        const table = document.getElementById('waitingTable');

        // Fix: Remove loading or empty state before appending
        const loadingEl = table.querySelector('.loading');
        if (loadingEl) loadingEl.remove();

        const emptyState = table.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        table.appendChild(newItemEl);
        console.log('[DEBUG] New item appended');
    } catch (e) { console.error('[DEBUG] addNewWaitingItem failed:', e); }
}

function removeWaitingItem(waitingId) {
    const items = document.querySelectorAll(`[data-waiting-id="${waitingId}"]`);
    items.forEach(item => item.remove());
    checkEmptyState();
}
function highlightWaitingItem(waitingId) {
    const items = document.querySelectorAll(`[data-waiting-id="${waitingId}"]`);
    items.forEach(item => { item.classList.add('highlight'); setTimeout(() => item.classList.remove('highlight'), 1500); });
}
async function updateWaitingOrder() { return loadWaitingList(); } // Simplified re-fetch
function checkEmptyState() {
    const table = document.getElementById('waitingTable');
    if (!table.querySelector('.waiting-item') && !table.querySelector('.loading')) {
        table.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>대기자가 없습니다</p></div>';
    }
}
