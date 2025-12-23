let currentClassId = null;
let classes = [];
let availableStores = [];

// Theme Management
function applyTheme(themeName) {
    if (!themeName) themeName = 'zinc';
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('selected_theme', themeName);
}

function previewTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
}

// Helper function to get headers with store ID
function getHeaders(additionalHeaders = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...additionalHeaders
    };

    // Add X-Store-Id if selected (for Superadmin context switching)
    const selectedStoreId = localStorage.getItem('selected_store_id');
    if (selectedStoreId) {
        headers['X-Store-Id'] = selectedStoreId;
    }

    return headers;
}

// 알림 모달 표시 함수
function showNotification(message, icon = '✅', title = '알림') {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    document.getElementById('notificationIcon').textContent = icon;
    document.getElementById('notificationModal').classList.add('active');
}

// 알림 모달 닫기
function closeNotificationModal() {
    document.getElementById('notificationModal').classList.remove('active');
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const notificationModal = document.getElementById('notificationModal');
        if (notificationModal.classList.contains('active')) {
            closeNotificationModal();
        }
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal && confirmModal.classList.contains('active')) {
            closeConfirmModal();
        }
        const passwordModal = document.getElementById('passwordModal');
        if (passwordModal && passwordModal.classList.contains('active')) {
            closePasswordModal();
        }
    }
});

// --- Settings Lock Logic ---
let isSettingsLocked = true;
let settingsAdminPassword = ''; // Store hashed or plain from API (be careful with plain)

function toggleSettingsLock(locked, silent = false) {
    isSettingsLocked = locked;
    const unlockBtn = document.getElementById('unlockSettingsBtn');

    // Disable/Enable inputs ONLY within .requires-auth containers
    const selector = '.requires-auth input, .requires-auth select, .requires-auth textarea, .requires-auth button';
    const inputs = document.querySelectorAll(selector);

    inputs.forEach(el => {
        if (el.id === 'unlockSettingsBtn') return;

        if (locked) {
            el.disabled = true;
            el.classList.add('locked-input');
        } else {
            el.disabled = false;
            el.classList.remove('locked-input');
        }
    });

    if (locked) {
        if (unlockBtn) unlockBtn.style.display = 'block';
    } else {
        if (unlockBtn) unlockBtn.style.display = 'none';
        if (!silent) {
            showNotification('설정 잠금이 해제되었습니다.', '🔓');
        }
    }
}

function openPasswordModal() {
    document.getElementById('passwordModal').classList.add('active');
    document.getElementById('unlockPasswordInput').value = '';
    document.getElementById('passwordErrorMsg').style.display = 'none';
    setTimeout(() => document.getElementById('unlockPasswordInput').focus(), 100);
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
}

function checkUnlockPassword() {
    const input = document.getElementById('unlockPasswordInput').value;
    const adminPassword = document.getElementById('adminPassword').value; // Hidden field populated by loadStoreSettings

    // Simple check against loaded settings (Client-side lock is UI-only)
    // If admin_password is empty? Default '1234' usually.
    // NOTE: settings.admin_password might be empty if not loaded yet?
    // We rely on loadStoreSettings having run.

    if (input === adminPassword) {
        closePasswordModal();
        toggleSettingsLock(false);
    } else {
        const errorMsg = document.getElementById('passwordErrorMsg');
        errorMsg.style.display = 'block';
        errorMsg.textContent = '비밀번호가 일치하지 않습니다.';

        // Shake animation?
        const inputEl = document.getElementById('unlockPasswordInput');
        inputEl.style.borderColor = 'red';
        setTimeout(() => inputEl.style.borderColor = '', 500);
    }
}

// 확인 모달 표시 함수 (Promise 기반)
function showConfirmModal(message, icon = '❓', title = '확인') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmIcon').textContent = icon;

        const okBtn = document.getElementById('confirmOkBtn');

        // Remove existing listeners to prevent multiple firings
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);

        newOkBtn.onclick = () => {
            closeConfirmModal();
            resolve(true);
        };

        // Cancel is handled by closeConfirmModal which just closes,
        // but we need to resolve false if user cancels via button or ESC?
        // Simple closeConfirmModal doesn't resolve. 
        // Let's attach a temporary property or handle closure manually?
        // For simplicity, we assume closure = cancel = resolve(false) implicitly if not clicked OK.
        // Actually, we can just hook closeConfirmModal too? No, easier to just handle OK.
        // If modal closed without OK, the promise hangs or we need a way to reject/resolve false.
        // Let's patch closeConfirmModal globally or just add a 'cancel' listener specific here.
        // But closeConfirmModal is global. 
        // Simplified approach: ONLY resolve(true) on OK. If user cancels, we do nothing (promise hangs? memory leak?).
        // Better: Hook the cancel button specifically for this instance.

        // Actually simplest way for this specific usage:
        const cancelBtn = modal.querySelector('.btn-secondary');
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newCancelBtn.onclick = () => {
            closeConfirmModal();
            resolve(false);
        };

        modal.classList.add('active');
    });
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
}

function switchTab(tab) {
    // Remove active class from all main tabs
    const mainTabsContainer = document.querySelector('body > .container > .tabs-container');
    const mainTabs = mainTabsContainer.querySelectorAll('.settings-tab');
    mainTabs.forEach(t => t.classList.remove('active'));

    // Hide all tab contents
    // Note: Only direct children tab-contents (generic selector might match nested ones if any)
    // But we use IDs which is safe.
    ['storeTab', 'classTab', 'historyTab', 'backupTab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });

    if (tab === 'store') {
        mainTabs[0].classList.add('active');
        document.getElementById('storeTab').classList.add('active');
        loadStoreSettings();
        loadAvailableStores();
    } else if (tab === 'class') {
        mainTabs[1].classList.add('active');
        document.getElementById('classTab').classList.add('active');
        loadClasses();
    } else if (tab === 'history') {
        mainTabs[2].classList.add('active');
        document.getElementById('historyTab').classList.add('active');
        loadAuditLogs();
    } else if (tab === 'backup') {
        mainTabs[3].classList.add('active');
        document.getElementById('backupTab').classList.add('active');
        loadSnapshots();
    }
}



function switchClassTypeTab(classType) {
    // 서브 탭 버튼 활성화 상태 변경
    const classTab = document.getElementById('classTab');
    const tabButtons = classTab.querySelectorAll('.tabs-container .settings-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    if (classType === 'weekday') {
        tabButtons[0].classList.add('active');
        document.getElementById('weekdayClassTab').classList.add('active');
        document.getElementById('weekendClassTab').classList.remove('active');
        document.getElementById('holidayClassTab').classList.remove('active');
    } else if (classType === 'weekend') {
        tabButtons[1].classList.add('active');
        document.getElementById('weekendClassTab').classList.add('active');
        document.getElementById('weekdayClassTab').classList.remove('active');
        document.getElementById('holidayClassTab').classList.remove('active');
    } else {
        // Holiday
        tabButtons[2].classList.add('active');
        document.getElementById('holidayClassTab').classList.add('active');
        document.getElementById('weekdayClassTab').classList.remove('active');
        document.getElementById('weekendClassTab').classList.remove('active');
        loadHolidays(); // Load holidays when tab is switched
    }
}

// --- Holiday Calendar Logic ---
let currentCalendarDate = new Date();
let holidaysCache = []; // Store holidays for checking

async function loadHolidays() {
    // 캘린더 초기화 및 공휴일 로드
    // API는 전체 공휴일을 반환한다고 가정 (또는 월별 필터링 필요 시 쿼리 추가)
    // 현재는 전체 로드 후 JS에서 필터 (DB가 커지면 월별 조회로 변경 권장)
    try {
        const response = await fetch('/api/holidays/', { headers: getHeaders() });
        if (response.ok) {
            holidaysCache = await response.json();
            renderCalendar(currentCalendarDate);
        } else {
            console.error('Failed to load holidays');
        }
    } catch (e) {
        console.error(e);
    }
}

function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed

    // Header Title Update
    document.getElementById('calendarTitle').textContent = `${year}. ${String(month + 1).padStart(2, '0')}`;

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Last day of current month

    const startDayOfWeek = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = lastDay.getDate();

    // Fill empty cells for previous month
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        grid.appendChild(emptyCell);
    }

    // Fill days
    const today = new Date();
    const isThisMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        // 날짜 객체 생성 (로컬 타임 기준)
        // 주의: UTC 변환 문제 방지를 위해 문자열 조작 권장
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // Find holiday
        const holiday = holidaysCache.find(h => h.date === dateStr);

        // Check day of week for styling
        const currentDayDate = new Date(year, month, d);
        const dayOfWeek = currentDayDate.getDay();
        if (dayOfWeek === 0) cell.classList.add('sun');
        if (dayOfWeek === 6) cell.classList.add('sat');
        if (isThisMonth && today.getDate() === d) cell.classList.add('today');

        if (holiday) {
            cell.classList.add('holiday-marker');
        }

        cell.onclick = () => handleDateClick(dateStr, holiday);

        let html = `<div class="date-number">${d}</div>`;
        if (holiday) {
            html += `<div class="holiday-label">${holiday.name}</div>`;
        }
        cell.innerHTML = html;

        grid.appendChild(cell);
    }
}

function changeHolidayMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar(currentCalendarDate);
}

function goToToday() {
    currentCalendarDate = new Date();
    renderCalendar(currentCalendarDate);
}

async function handleDateClick(dateStr, existingHoliday) {
    if (existingHoliday) {
        // Delete
        if (!confirm(`${dateStr} [${existingHoliday.name}]\n공휴일을 삭제하시겠습니까?`)) return;

        try {
            const response = await fetch(`/api/holidays/${dateStr}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (response.ok) {
                showNotification('삭제되었습니다.', '✅');
                loadHolidays(); // Reload to refresh grid
            } else {
                showNotification('삭제 실패', '❌');
            }
        } catch (e) {
            console.error(e);
            showNotification('오류 발생', '❌');
        }
    } else {
        // Create - Open Modal
        openHolidayModal(dateStr);
    }
}

// --- Holiday Modal Logic ---

function openHolidayModal(dateStr) {
    const modal = document.getElementById('holidayModal');
    if (!modal) return;

    // 모달 내용 초기화
    document.getElementById('holidayDateDisplay').textContent = `${dateStr} 공휴일 등록`;
    document.getElementById('holidayDateInput').value = dateStr;
    document.getElementById('holidayNameInput').value = '';

    // Remove inline display style if present, then add active class
    modal.style.display = '';
    modal.classList.add('active');

    // 포커스
    setTimeout(() => {
        document.getElementById('holidayNameInput').focus();
    }, 100);
}

function closeHolidayModal() {
    const modal = document.getElementById('holidayModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function confirmAddHoliday() {
    const dateStr = document.getElementById('holidayDateInput').value;
    const nameInput = document.getElementById('holidayNameInput');
    const name = nameInput.value.trim();

    if (!name) {
        showNotification('공휴일 이름을 입력해주세요.', '⚠️');
        return;
    }

    try {
        const response = await fetch('/api/holidays/', {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ date: dateStr, name: name })
        });

        if (response.ok) {
            showNotification('공휴일이 등록되었습니다.', '✅');
            closeHolidayModal();
            loadHolidays();
        } else {
            const err = await response.json();
            showNotification(err.detail || '등록 실패', '❌');
        }
    } catch (e) {
        console.error(e);
        showNotification('오류 발생', '❌');
    }
}

async function loadAvailableStores() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/stores/', {
            headers: getHeaders()
        });

        if (response.ok) {
            availableStores = await response.json();
            const currentStoreId = localStorage.getItem('selected_store_id');

            const select = document.getElementById('cloneSourceStore');
            select.innerHTML = '<option value="">복제할 매장 선택</option>';

            // 현재 매장을 제외한 다른 매장들만 표시
            availableStores
                .filter(store => store.id !== parseInt(currentStoreId) && store.is_active)
                .forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.id;
                    option.textContent = `${store.name} (${store.code})`;
                    select.appendChild(option);
                });

            // 클래스 복제용 드롭다운도 동일하게 채움
            const selectClass = document.getElementById('cloneSourceStoreForClass');
            if (selectClass) {
                selectClass.innerHTML = '<option value="">복제할 매장 선택</option>';
                availableStores
                    .filter(store => store.id !== parseInt(currentStoreId) && store.is_active)
                    .forEach(store => {
                        const option = document.createElement('option');
                        option.value = store.id;
                        option.textContent = `${store.name} (${store.code})`;
                        selectClass.appendChild(option);
                    });
            }
        }
    } catch (error) {
        console.error('매장 목록 조회 실패:', error);
    }
}

async function cloneSettings() {
    const sourceStoreId = document.getElementById('cloneSourceStore').value;

    if (!sourceStoreId) {
        showNotification('복제할 매장을 선택해주세요.', '⚠️');
        return;
    }

    const sourceStore = availableStores.find(s => s.id === parseInt(sourceStoreId));
    const confirmMsg = `${sourceStore.name}의 설정을 복제하시겠습니까?\n\n현재 매장의 모든 설정값(매장명 제외)이 덮어씌워집니다.`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const response = await fetch(`/api/store/clone/${sourceStoreId}`, {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' })
        });

        if (response.ok) {
            showNotification('설정이 성공적으로 복제되었습니다!', '✅');
            loadStoreSettings(); // 복제된 설정 다시 로드
        } else {
            const error = await response.json();
            showNotification('복제 실패: ' + (error.detail || '알 수 없는 오류'), '❌', '오류');
        }
    } catch (error) {
        console.error('설정 복제 실패:', error);
        showNotification('복제 중 오류가 발생했습니다.', '❌', '오류');
    }
}

async function cloneClasses() {
    const sourceStoreId = document.getElementById('cloneSourceStoreForClass').value;

    if (!sourceStoreId) {
        showNotification('복제할 매장을 선택해주세요.', '⚠️');
        return;
    }

    const sourceStore = availableStores.find(s => s.id === parseInt(sourceStoreId));
    const confirmMsg = `${sourceStore.name}의 클래스 설정을 복제하시겠습니까?\n\n주의: 현재 매장의 모든 클래스 정보가 삭제되고 덮어씌워집니다.`;

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        const response = await fetch(`/api/classes/clone/${sourceStoreId}`, {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' })
        });

        if (response.ok) {
            const result = await response.json();
            showNotification(`클래스 설정이 복제되었습니다! (${result.count}개)`, '✅');
            loadClasses(); // 복제된 클래스 목록 다시 로드
        } else {
            const error = await response.json();
            showNotification('복제 실패: ' + (error.detail || '알 수 없는 오류'), '❌', '오류');
        }
    } catch (error) {
        console.error('클래스 복제 실패:', error);
        showNotification('복제 중 오류가 발생했습니다.', '❌', '오류');
    }
}

function toggleClosingAction(isChecked) {
    const container = document.getElementById('closingActionContainer');
    if (isChecked) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

async function loadStoreSettings() {
    try {
        const response = await fetch('/api/store/', {
            headers: getHeaders()
        });
        const settings = await response.json();

        document.getElementById('storeName').value = settings.store_name;

        // 헤더에 매장명 표시
        const headerStoreName = document.getElementById('headerStoreName');
        if (headerStoreName) {
            headerStoreName.textContent = `(${settings.store_name})`;
        }
        document.getElementById('displayClassesCount').value = settings.display_classes_count;
        document.getElementById('rowsPerClass').value = settings.rows_per_class;
        document.getElementById('listDirection').value = settings.list_direction;
        document.getElementById('managerButtonSize').value = settings.manager_button_size || 'medium';
        document.getElementById('businessDayStart').value = settings.business_day_start !== undefined ? settings.business_day_start : 5;

        // 개점 설정
        const openingRule = settings.daily_opening_rule || 'strict';
        if (openingRule === 'flexible') {
            document.getElementById('openingRuleFlexible').checked = true;
        } else {
            document.getElementById('openingRuleStrict').checked = true;
        }

        // 자동 마감 설정
        const autoClosingCheckbox = document.getElementById('autoClosing');
        autoClosingCheckbox.checked = settings.auto_closing !== false; // Default true

        // 마감 처리 방식 설정
        const closingAction = settings.closing_action || 'reset';
        if (closingAction === 'attended') {
            document.getElementById('actionAttended').checked = true;
        } else {
            document.getElementById('actionReset').checked = true;
        }

        // UI 초기 상태 설정
        toggleClosingAction(autoClosingCheckbox.checked);

        // 이벤트 리스너 추가
        autoClosingCheckbox.addEventListener('change', function () {
            toggleClosingAction(this.checked);
        });

        // 현황판 설정  
        document.getElementById('useMaxWaitingLimit').checked = settings.use_max_waiting_limit !== undefined ? settings.use_max_waiting_limit : true;
        document.getElementById('maxWaitingLimit').value = settings.max_waiting_limit || 50;
        document.getElementById('blockLastClassRegistration').checked = settings.block_last_class_registration || false;
        document.getElementById('autoRegisterMember').checked = settings.auto_register_member || false;
        document.getElementById('adminPassword').value = settings.admin_password;

        // 대기현황판 표시 설정
        document.getElementById('showWaitingNumber').checked = settings.show_waiting_number !== undefined ? settings.show_waiting_number : true;
        document.getElementById('maskCustomerName').checked = settings.mask_customer_name || false;
        document.getElementById('nameDisplayLength').value = settings.name_display_length || 0;
        document.getElementById('showOrderNumber').checked = settings.show_order_number !== undefined ? settings.show_order_number : true;
        document.getElementById('boardDisplayOrder').value = settings.board_display_order || 'number,name,order';

        // 출석 횟수 설정
        const countType = settings.attendance_count_type || 'days';
        if (countType === 'monthly') {
            document.getElementById('countTypeMonthly').checked = true;
        } else {
            document.getElementById('countTypeDays').checked = true;
        }
        document.getElementById('attendanceLookbackDays').value = settings.attendance_lookback_days || 30;
        toggleAttendanceSettings();

        // 폰트 설정
        document.getElementById('managerFontFamily').value = settings.manager_font_family || 'Nanum Gothic';
        document.getElementById('managerFontSize').value = settings.manager_font_size || '15px';
        document.getElementById('managerMaxWidth').value = settings.waiting_manager_max_width || '';
        document.getElementById('boardFontFamily').value = settings.board_font_family || 'Nanum Gothic';
        document.getElementById('boardFontSize').value = settings.board_font_size || '24px';

        // 대기현황판 페이지네이션 설정
        document.getElementById('waitingBoardPageSize').value = settings.waiting_board_page_size || 12;
        document.getElementById('waitingBoardRotationInterval').value = settings.waiting_board_rotation_interval || 5;
        document.getElementById('waitingBoardTransitionEffect').value = settings.waiting_board_transition_effect || 'slide';

        // 대기관리자 버튼 및 리스트 박스 크기 설정
        document.getElementById('managerButtonSize').value = settings.manager_button_size || 'medium';
        document.getElementById('waitingListBoxSize').value = settings.waiting_list_box_size || 'medium';

        // SSE 트래픽 관리
        document.getElementById('enableWaitingBoard').checked = settings.enable_waiting_board !== false; // Default true (since default db is true)
        document.getElementById('enableReceptionDesk').checked = settings.enable_reception_desk !== false; // Default true if undefined

        // Theme setting
        const theme = settings.theme || 'zinc';
        document.getElementById('systemTheme').value = theme;
        applyTheme(theme);

        settingsAdminPassword = settings.admin_password; // Store for lock logic       // 키패드 설정
        document.getElementById('keypadStyle').value = settings.keypad_style || 'modern';
        if (settings.keypad_font_size) {
            document.getElementById('keypadFontSize').value = settings.keypad_font_size;
        }

        // 대기접수 완료 모달 설정
        if (settings.waiting_modal_timeout) {
            document.getElementById('waitingModalTimeout').value = settings.waiting_modal_timeout;
        }

        // 불리언 값 처리 (undefined인 경우 true로 기본값 설정되는 항목 주의)
        document.getElementById('showMemberNameInWaitingModal').checked =
            (settings.show_member_name_in_waiting_modal !== undefined && settings.show_member_name_in_waiting_modal !== null) ? settings.show_member_name_in_waiting_modal : true;

        document.getElementById('showNewMemberTextInWaitingModal').checked =
            (settings.show_new_member_text_in_waiting_modal !== undefined && settings.show_new_member_text_in_waiting_modal !== null) ? settings.show_new_member_text_in_waiting_modal : true;

        document.getElementById('enableWaitingVoiceAlert').checked =
            (settings.enable_waiting_voice_alert !== undefined && settings.enable_waiting_voice_alert !== null) ? settings.enable_waiting_voice_alert : false;

        document.getElementById('waitingVoiceMessage').value = settings.waiting_voice_message || '';

        // 음성 목록 로드 및 선택
        if (window.speechSynthesis) {
            const voiceSelect = document.getElementById('waitingVoiceSelect');
            let voices = [];

            function populateVoices() {
                voices = window.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('ko'));

                // 기존 옵션 유지 (기본 목소리)
                voiceSelect.innerHTML = '<option value="">기본 목소리</option>';

                voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.name;
                    option.textContent = `${voice.name} (${voice.lang})`;
                    voiceSelect.appendChild(option);
                });

                // 저장된 목소리 선택
                if (settings.waiting_voice_name) {
                    voiceSelect.value = settings.waiting_voice_name;
                }
            }

            populateVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = populateVoices;
            }

            // 스타일 프리셋 로직
            const styleSelect = document.getElementById('waitingVoiceStyle');
            let currentRate = settings.waiting_voice_rate || 1.0;
            let currentPitch = settings.waiting_voice_pitch || 1.0;

            // 저장된 rate/pitch로 스타일 추정하여 선택
            // Floating point comparison needs to be careful, but checking simple equality for presets is fine
            if (currentRate === 0.8 && currentPitch === 1.1) styleSelect.value = 'senior';
            else if (currentRate === 0.9 && currentPitch === 0.9) styleSelect.value = 'calm';
            else if (currentRate === 0.9 && currentPitch === 0.95) styleSelect.value = 'soft';
            else if (currentRate === 1.1 && currentPitch === 1.2) styleSelect.value = 'bright';
            else styleSelect.value = 'standard';

            styleSelect.onchange = function () {
                const style = this.value;
                if (style === 'senior') { currentRate = 0.8; currentPitch = 1.1; } // Senior: Slower, slightly higher pitch for clarity
                else if (style === 'calm') { currentRate = 0.9; currentPitch = 0.9; }
                else if (style === 'soft') { currentRate = 0.9; currentPitch = 0.95; } // Soft: Slower, slightly lower pitch
                else if (style === 'bright') { currentRate = 1.1; currentPitch = 1.2; }
                else { currentRate = 1.0; currentPitch = 1.0; } // standard
            };

            // 미리듣기 버튼 이벤트
            document.getElementById('testVoiceBtn').onclick = function () {
                const message = document.getElementById('waitingVoiceMessage').value || "1교시 대기 접수 되었습니다";
                const selectedVoiceName = voiceSelect.value;

                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'ko-KR';
                utterance.rate = currentRate;
                utterance.pitch = currentPitch;

                if (selectedVoiceName) {
                    const selectedVoice = voices.find(voice => voice.name === selectedVoiceName);
                    if (selectedVoice) {
                        utterance.voice = selectedVoice;
                    }
                }

                window.speechSynthesis.speak(utterance);
            };
        }

        // 최대 대기 인원 입력 필드 활성화/비활성화
        toggleMaxWaitingLimitInput();

        // Re-apply current lock state (preserve unlock if already unlocked)
        toggleSettingsLock(isSettingsLocked, true);

    } catch (error) {
        console.error('설정 조회 실패:', error);
    }
}

function toggleAttendanceSettings() {
    const isMonthly = document.getElementById('countTypeMonthly').checked;
    const container = document.getElementById('attendanceLookbackDaysContainer');
    if (isMonthly) {
        container.style.display = 'none';
    } else {
        container.style.display = 'block';
    }
}

async function saveStoreSettings(event) {
    event.preventDefault();

    const storeName = document.getElementById('storeName').value.trim();
    const displayCount = document.getElementById('displayClassesCount').value;
    const rowsPerClass = document.getElementById('rowsPerClass').value;
    const listDirection = document.getElementById('listDirection').value;
    const managerButtonSize = document.getElementById('managerButtonSize').value;
    const businessDayStart = document.getElementById('businessDayStart').value;
    const autoClosing = document.getElementById('autoClosing').checked;
    const closingAction = document.querySelector('input[name="closingAction"]:checked').value;
    const useMaxWaitingLimit = document.getElementById('useMaxWaitingLimit').checked;
    const maxWaitingLimit = document.getElementById('maxWaitingLimit').value;
    const blockLastClassRegistration = document.getElementById('blockLastClassRegistration').checked;
    const autoRegisterMember = document.getElementById('autoRegisterMember').checked;
    const adminPassword = document.getElementById('adminPassword').value;
    const showWaitingNumber = document.getElementById('showWaitingNumber').checked;
    const maskCustomerName = document.getElementById('maskCustomerName').checked;
    const nameDisplayLength = document.getElementById('nameDisplayLength').value;
    const showOrderNumber = document.getElementById('showOrderNumber').checked;
    const boardDisplayOrder = document.getElementById('boardDisplayOrder').value;

    // 출석 횟수 설정
    const attendanceCountType = document.querySelector('input[name="attendanceCountType"]:checked').value;
    const attendanceLookbackDays = document.getElementById('attendanceLookbackDays').value;

    // 폰트 설정
    const managerFontFamily = document.getElementById('managerFontFamily').value;
    const managerFontSize = document.getElementById('managerFontSize').value;
    const boardFontFamily = document.getElementById('boardFontFamily').value;
    const boardFontSize = document.getElementById('boardFontSize').value;

    // 키패드 설정
    const keypadStyle = document.getElementById('keypadStyle').value;
    const keypadFontSize = document.getElementById('keypadFontSize').value;

    // 대기현황판 페이지네이션 설정
    const waitingBoardPageSize = document.getElementById('waitingBoardPageSize').value;
    const waitingBoardRotationInterval = document.getElementById('waitingBoardRotationInterval').value;
    const waitingBoardTransitionEffect = document.getElementById('waitingBoardTransitionEffect').value;

    const settings = {
        store_name: storeName,
        display_classes_count: parseInt(displayCount),
        rows_per_class: parseInt(rowsPerClass),
        list_direction: listDirection,
        manager_button_size: managerButtonSize,
        waiting_list_box_size: document.getElementById('waitingListBoxSize').value,
        business_day_start: parseInt(businessDayStart),
        waiting_board_page_size: parseInt(waitingBoardPageSize),
        waiting_board_rotation_interval: parseInt(waitingBoardRotationInterval),
        waiting_board_transition_effect: waitingBoardTransitionEffect,
        auto_closing: autoClosing,
        closing_action: closingAction,
        use_max_waiting_limit: useMaxWaitingLimit,
        max_waiting_limit: parseInt(maxWaitingLimit),
        block_last_class_registration: blockLastClassRegistration,
        auto_register_member: autoRegisterMember,
        admin_password: adminPassword,
        show_waiting_number: showWaitingNumber,
        mask_customer_name: maskCustomerName,
        name_display_length: parseInt(nameDisplayLength),
        show_order_number: showOrderNumber,
        board_display_order: boardDisplayOrder,
        attendance_count_type: attendanceCountType,
        attendance_lookback_days: parseInt(attendanceLookbackDays),
        // 폰트 설정 추가
        manager_font_family: managerFontFamily,
        manager_font_size: managerFontSize,
        waiting_manager_max_width: document.getElementById('managerMaxWidth').value ? parseInt(document.getElementById('managerMaxWidth').value) : null,
        board_font_family: boardFontFamily,
        board_font_size: boardFontSize,
        // 키패드 설정 추가
        keypad_style: keypadStyle,
        keypad_font_size: keypadFontSize,



        // 대기접수 완료 모달 설정
        waiting_modal_timeout: parseInt(document.getElementById('waitingModalTimeout').value),
        show_member_name_in_waiting_modal: document.getElementById('showMemberNameInWaitingModal').checked,
        show_new_member_text_in_waiting_modal: document.getElementById('showNewMemberTextInWaitingModal').checked,
        enable_waiting_voice_alert: document.getElementById('enableWaitingVoiceAlert').checked,
        waiting_voice_message: document.getElementById('waitingVoiceMessage').value,
        waiting_voice_name: document.getElementById('waitingVoiceSelect').value,
        // 스타일 선택값에서 rate/pitch 도출
        waiting_voice_rate: (function () {
            const style = document.getElementById('waitingVoiceStyle').value;
            if (style === 'senior') return 0.8;
            if (style === 'calm') return 0.9;
            if (style === 'soft') return 0.9;
            if (style === 'bright') return 1.1;
            return 1.0;
        })(),
        waiting_voice_pitch: (function () {
            const style = document.getElementById('waitingVoiceStyle').value;
            if (style === 'senior') return 1.1;
            if (style === 'calm') return 0.9;
            if (style === 'soft') return 0.95;
            if (style === 'bright') return 1.2;
            return 1.0;
        })(),

        // 개점 설정
        daily_opening_rule: document.querySelector('input[name="dailyOpeningRule"]:checked').value,
        // SSE 트래픽 관리 설정
        enable_waiting_board: document.getElementById('enableWaitingBoard').checked,
        enable_reception_desk: document.getElementById('enableReceptionDesk').checked,

        theme: document.getElementById('systemTheme').value
    };

    try {
        const response = await fetch('/api/store/', {
            method: 'PUT',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            showNotification('설정이 저장되었습니다.', '✅');
        } else {
            const error = await response.json();
            showNotification(error.detail || '저장에 실패했습니다.', '❌', '오류');
        }
    } catch (error) {
        console.error('저장 실패:', error);
        showNotification('저장 중 오류가 발생했습니다.', '❌', '오류');
    }
}

async function loadClasses() {
    const weekdayList = document.getElementById('weekdayClassList');
    const weekendList = document.getElementById('weekendClassList');
    weekdayList.innerHTML = '<div class="loading"><div class="spinner"></div><p>로딩 중...</p></div>';
    weekendList.innerHTML = '<div class="loading"><div class="spinner"></div><p>로딩 중...</p></div>';

    try {
        const response = await fetch('/api/classes/?include_inactive=true', { headers: getHeaders() });
        classes = await response.json();

        renderClasses();
    } catch (error) {
        console.error('클래스 조회 실패:', error);
        weekdayList.innerHTML = '<div class="empty-state"><p>데이터 로딩 실패</p></div>';
        weekendList.innerHTML = '<div class="empty-state"><p>데이터 로딩 실패</p></div>';
    }
}

function renderClasses() {
    const weekdayList = document.getElementById('weekdayClassList');
    const weekendList = document.getElementById('weekendClassList');
    const holidayList = document.getElementById('holidayClassList');

    // 평일 및 주말 클래스 분리 (각 타입별로 명확히 구분)
    const weekdayClasses = classes.filter(cls => cls.class_type === 'weekday');
    const weekendClasses = classes.filter(cls => cls.class_type === 'weekend');
    const holidayClasses = classes.filter(cls => cls.class_type === 'holiday');
    const allClasses = classes.filter(cls => cls.class_type === 'all');

    // 평일 클래스 렌더링
    weekdayList.innerHTML = '';
    if (weekdayClasses.length === 0 && allClasses.length === 0) {
        weekdayList.innerHTML = '<div class="empty-state"><div class="icon">📚</div><p>등록된 평일 클래스가 없습니다</p></div>';
    } else {
        weekdayClasses.forEach(cls => {
            weekdayList.appendChild(createClassItem(cls));
        });
        // all 타입 클래스는 회색으로 표시
        allClasses.forEach(cls => {
            weekdayList.appendChild(createClassItem(cls, true));
        });
    }

    // 주말 클래스 렌더링
    weekendList.innerHTML = '';
    if (weekendClasses.length === 0 && allClasses.length === 0) {
        weekendList.innerHTML = '<div class="empty-state"><div class="icon">📚</div><p>등록된 주말 클래스가 없습니다</p></div>';
    } else {
        weekendClasses.forEach(cls => {
            weekendList.appendChild(createClassItem(cls));
        });
        // all 타입 클래스는 회색으로 표시
        allClasses.forEach(cls => {
            weekendList.appendChild(createClassItem(cls, true));
        });

    }

    // 공휴일 클래스 렌더링
    if (holidayList) {
        holidayList.innerHTML = '';
        if (holidayClasses.length === 0) { // holiday 탭에는 'all' 타입 표시 안함 (기획에 따라 다름, 여기선 전용만 표시)
            holidayList.innerHTML = '<div class="empty-state"><div class="icon">📚</div><p>등록된 공휴일 클래스가 없습니다</p></div>';
        } else {
            holidayClasses.forEach(cls => {
                holidayList.appendChild(createClassItem(cls));
            });
            // 만약 'all' 타입도 공휴일에 적용된다면 여기서도 렌더링해야 함.
            // 하지만 현재 로직상 'holiday'는 별도 스케줄이므로 'all'을 포함할지는 선택.
            // 여기서는 깔끔하게 holiday 전용만 보여주거나, all도 보여주되 holiday 전용임을 명시.
            // 일단 'all'은 제외하고 'holiday' 타입만 보여줌 (전용 스케줄 강조).
        }
    }
}

function createClassItem(cls, isAllType = false) {
    const item = document.createElement('div');
    item.className = 'class-item';

    const inactiveBadge = !cls.is_active ? '<span class="inactive-badge">비활성</span>' : '';
    const classTypeLabel = cls.class_type === 'weekday' ? '평일 전용' : cls.class_type === 'weekend' ? '주말 전용' : cls.class_type === 'holiday' ? '공휴일 전용' : '전체 요일';

    // all 타입 클래스는 회색 배경으로 표시
    const allTypeStyle = isAllType ? 'opacity: 0.6; background: #f0f0f0;' : '';
    const allTypeBadge = isAllType ? '<span style="background: #95a5a6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px;">전체 요일</span>' : '';

    item.innerHTML = `
                <div class="class-number-badge" style="${isAllType ? 'background: linear-gradient(135deg, #95a5a6, #7f8c8d);' : ''}">
                    ${cls.class_number}
                </div>
                <div class="class-item-info">
                    <div class="title">
                        ${cls.class_name}${inactiveBadge}${allTypeBadge}
                    </div>
                    <div class="details">
                        <div class="detail-item">
                            <div class="detail-label">수업 시간</div>
                            <div class="detail-value time">${cls.start_time.substring(0, 5)} - ${cls.end_time.substring(0, 5)}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">클래스 타입</div>
                            <div class="detail-value" style="color: ${isAllType ? '#95a5a6' : '#9b59b6'}; font-size: 18px;">${classTypeLabel}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">최대 인원</div>
                            <div class="detail-value capacity">${cls.max_capacity}명</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">현재 대기</div>
                            <div class="detail-value waiting">${cls.current_count || 0}명</div>
                        </div>
                    </div>
                </div>
                <div class="class-item-actions">
                    <button class="btn btn-sm btn-primary" onclick="openEditClassModal(${cls.id})">수정</button>
                    ${cls.is_active ?
            `<button class="btn btn-sm btn-warning" onclick="toggleClassStatus(${cls.id}, false)">비활성화</button>` :
            `<button class="btn btn-sm btn-success" onclick="toggleClassStatus(${cls.id}, true)">활성화</button>`
        }
                </div>
            `;
    return item;
}

function openAddClassModal(classType) {
    currentClassId = null;

    // class_type 설정
    document.getElementById('classType').value = classType;

    // 같은 타입 또는 all 타입의 클래스들을 필터링하여 다음 번호 계산
    const relevantClasses = classes.filter(cls =>
        cls.class_type === classType || cls.class_type === 'all'
    );
    const nextNumber = relevantClasses.length > 0
        ? Math.max(...relevantClasses.map(cls => cls.class_number)) + 1
        : 1;

    const classTypeLabel = classType === 'weekday' ? '평일' : classType === 'weekend' ? '주말' : '공휴일';
    document.getElementById('classModalTitle').textContent = `${classTypeLabel} 클래스 추가`;
    document.getElementById('classNumber').value = nextNumber;
    document.getElementById('className').value = `${nextNumber}교시`;
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('maxCapacity').value = 10;

    document.getElementById('classModal').classList.add('active');
}

function openEditClassModal(classId) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    currentClassId = classId;

    // class_type 설정
    const classType = cls.class_type || 'weekday';
    document.getElementById('classType').value = classType;

    const classTypeLabel = classType === 'weekday' ? '평일' : classType === 'weekend' ? '주말' : '전체';
    document.getElementById('classModalTitle').textContent = `${classTypeLabel} 클래스 수정`;
    document.getElementById('classNumber').value = cls.class_number;
    document.getElementById('className').value = cls.class_name;
    document.getElementById('startTime').value = cls.start_time.substring(0, 5);
    document.getElementById('endTime').value = cls.end_time.substring(0, 5);
    document.getElementById('maxCapacity').value = cls.max_capacity;

    document.getElementById('classModal').classList.add('active');
}

async function saveClass(event) {
    event.preventDefault();

    const classType = document.getElementById('classType').value;
    const startTimeVal = document.getElementById('startTime').value;
    const endTimeVal = document.getElementById('endTime').value;

    if (!startTimeVal || !endTimeVal) {
        showNotification('시작 시간과 종료 시간을 입력해주세요.', '⚠️');
        return;
    }

    // weekday_schedule 기본값 설정 (class_type에 따라)
    let weekday_schedule;
    if (classType === 'weekday') {
        weekday_schedule = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
    } else if (classType === 'weekend') {
        weekday_schedule = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: true, sun: true };
    } else if (classType === 'holiday') {
        // 공휴일은 요일 스케줄과 무관 (DB Schema default or logic ignores it)
        // Explicitly set all to true (or irrelevant)
        weekday_schedule = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true };
    } else {
        // all 타입
        weekday_schedule = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true };
    }

    const classData = {
        class_number: parseInt(document.getElementById('classNumber').value),
        class_name: document.getElementById('className').value.trim(),
        start_time: startTimeVal + ':00',
        end_time: endTimeVal + ':00',
        max_capacity: parseInt(document.getElementById('maxCapacity').value),
        is_active: true,
        class_type: classType,
        weekday_schedule: weekday_schedule
    };

    try {
        let response;
        // Use absolute URL to prevent potential relative path resolution issues
        const baseUrl = window.location.origin;

        if (currentClassId) {
            response = await fetch(`${baseUrl}/api/classes/${currentClassId}`, {
                method: 'PUT',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(classData)
            });
        } else {
            response = await fetch(`${baseUrl}/api/classes/`, {
                method: 'POST',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(classData)
            });
        }

        if (response.ok) {
            showNotification('저장되었습니다.', '✅');
            closeModal('classModal');
            loadClasses();
        } else {
            const error = await response.json();
            showNotification(error.detail || '저장에 실패했습니다.', '❌', '오류');
        }
    } catch (error) {
        console.error('저장 실패:', error);
        showNotification('저장 중 오류가 발생했습니다. (서버 연결 확인 필요)', '❌', '오류');
    }
}

async function toggleClassStatus(classId, activate) {
    const cls = classes.find(c => c.id === classId);
    const action = activate ? '활성화' : '비활성화';

    if (!confirm(`${cls.class_name}을(를) ${action}하시겠습니까?`)) return;

    try {
        const endpoint = activate ? `/api/classes/${classId}/activate` : `/api/classes/${classId}`;
        const method = activate ? 'POST' : 'DELETE';

        const response = await fetch(endpoint, {
            method,
            headers: getHeaders()
        });

        if (response.ok) {
            showNotification(`${action}되었습니다.`, '✅');
            loadClasses();
        } else {
            const error = await response.json();
            showNotification(error.detail || `${action}에 실패했습니다.`, '❌', '오류');
        }
    } catch (error) {
        console.error('상태 변경 실패:', error);
        showNotification('처리 중 오류가 발생했습니다.', '❌', '오류');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// URL 파라미터에서 매장 정보 가져오기
async function checkUrlStoreParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');

    if (storeParam) {
        try {
            const response = await fetch(`/api/stores/code/${storeParam}`, {
                headers: getHeaders()
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

// 최대 대기 인원 입력 필드 활성화/비활성화
function toggleMaxWaitingLimitInput() {
    const useLimit = document.getElementById('useMaxWaitingLimit').checked;
    const limitGroup = document.getElementById('maxWaitingLimitGroup');
    const limitInput = document.getElementById('maxWaitingLimit');

    if (useLimit) {
        limitGroup.style.opacity = '1';
        limitInput.disabled = false;
    } else {
        limitGroup.style.opacity = '0.5';
        limitInput.disabled = true;
    }
}

// 체크박스 변경 시 입력 필드 활성화/비활성화
document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('useMaxWaitingLimit');
    if (checkbox) {
        checkbox.addEventListener('change', toggleMaxWaitingLimitInput);
    }
});

// --- Audit & Snapshot Logic ---
async function loadAuditLogs() {
    const tbody = document.getElementById('auditListBody');
    const storeId = localStorage.getItem('selected_store_id');
    if (!storeId) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">매장이 선택되지 않았습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">로딩 중...</td></tr>';

    try {
        const response = await fetch(`/logs/audit?store_id=${storeId}`, { headers: getHeaders() });
        if (response.ok) {
            const logs = await response.json();
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">이력이 없습니다.</td></tr>';
                return;
            }

            let html = '';
            logs.forEach(log => {
                let details = '';
                if (log.old_value || log.new_value) {
                    // Simple JSON stringify for now, could be prettier
                    if (log.action === 'create_snapshot') {
                        details = `백업 생성: ${JSON.parse(log.new_value || '{}').description || ''}`;
                    } else if (log.action === 'restore_snapshot') {
                        details = `백업 복원: ${JSON.parse(log.new_value || '{}').description || ''}`;
                    } else {
                        details = log.new_value ? '변경됨' : '';
                        // To show diff is complex, just show action type for now
                    }
                }

                // Parse timestamp
                const date = new Date(log.created_at).toLocaleString();

                html += `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 12px;">${date}</td>
                                <td style="padding: 12px;">${log.user_name}</td>
                                <td style="padding: 12px;">${log.action}</td>
                                <td style="padding: 12px; color: #666; font-size: 0.9em;">${details}</td>
                                <td style="padding: 12px; color: #999; font-size: 0.8em;">${log.ip_address || '-'}</td>
                            </tr>
                        `;
            });
            tbody.innerHTML = html;
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">로딩 실패</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">오류 발생</td></tr>';
    }
}

async function loadSnapshots() {
    const tbody = document.getElementById('snapshotListBody');
    const storeId = localStorage.getItem('selected_store_id');
    if (!storeId) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">매장이 선택되지 않았습니다.</td></tr>';
        return;
    }

    try {
        const response = await fetch(`/api/store/snapshots`, { headers: getHeaders() });
        if (response.ok) {
            const snapshots = await response.json();
            if (snapshots.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">백업이 없습니다.</td></tr>';
                return;
            }

            let html = '';
            snapshots.forEach(snap => {
                const date = new Date(snap.created_at).toLocaleString();
                html += `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 12px;">${date}</td>
                                <td style="padding: 12px; font-weight: 500;">${snap.description}</td>
                                <td style="padding: 12px;">${snap.created_by}</td>
                                <td style="padding: 12px; text-align: right;">
                                    <button class="btn btn-sm btn-secondary" onclick="restoreSnapshot(${snap.id})" style="font-size: 12px; padding: 5px 10px;">
                                        🔄 복원
                                    </button>
                                </td>
                            </tr>
                        `;
            });
            tbody.innerHTML = html;
        }
    } catch (e) { console.error(e); }
}

async function createSnapshot() {
    const desc = document.getElementById('snapshotDescription').value;
    if (!desc) {
        showNotification('백업 설명을 입력해주세요.', '⚠️', '알림');
        return;
    }

    const confirmed = await showConfirmModal('현재 설정으로 백업을 생성하시겠습니까?');
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/store/snapshots`, {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ description: desc })
        });

        if (response.ok) {
            showNotification('백업이 생성되었습니다.', '✅');
            document.getElementById('snapshotDescription').value = '';
            loadSnapshots();
        } else {
            showNotification('백업 생성 실패', '❌', '오류');
        }
    } catch (e) {
        console.error(e);
        showNotification('오류가 발생했습니다.', '❌', '오류');
    }
}

async function restoreSnapshot(id) {
    const confirmed = await showConfirmModal('정말로 이 백업 시점으로 설정을 복원하시겠습니까?\n현재 설정은 덮어씌워집니다.', '⚠️');
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/store/snapshots/${id}/restore`, {
            method: 'POST',
            headers: getHeaders()
        });

        if (response.ok) {
            showNotification('설정이 복원되었습니다.', '✅');
            loadStoreSettings();
        } else {
            showNotification('복원 실패', '❌', '오류');
        }
    } catch (e) {
        console.error(e);
        showNotification('오류가 발생했습니다.', '❌', '오류');
    }
}

async function checkAdminRole() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const response = await fetch('/api/auth/me', {
            headers: getHeaders()
        });

        if (response.ok) {
            const user = await response.json();
            if (user.role === 'system_admin') {
                const container = document.getElementById('headerActions');
                if (container) {
                    // "메인으로" 버튼 숨기고 (내용 비우기) "시스템관리" 버튼만 추가
                    container.innerHTML = '';

                    const btn = document.createElement('a');
                    btn.href = '/superadmin';
                    btn.className = 'btn btn-secondary';
                    btn.innerHTML = '← 시스템관리';
                    container.appendChild(btn);
                }

                // Superadmin Auto Unlock
                console.log("Superadmin detected: Unlocking settings automatically.");
                toggleSettingsLock(false, true); // silent unlock
            }
        }
    } catch (e) {
        console.error('Admin role check failed:', e);
    }
}

// 초기 로드
async function init() {
    await checkUrlStoreParam();
    await loadStoreSettings(); // Lock applied here
    loadAvailableStores();
    checkAdminRole(); // Unlock if superadmin
}

init();

