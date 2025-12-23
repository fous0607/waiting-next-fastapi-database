
const API_BASE = '/api';
let franchiseData = null;
let storesData = [];
let usersData = [];
let superAdminMode = false;
let targetFranchiseId = null;

// URL 파라미터 가져오기
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// 토큰 가져오기
function getToken() {
    return localStorage.getItem('access_token');
}

// API 요청 헤더
function getHeaders() {
    const headers = {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
    };

    // superadmin 모드이고 특정 프랜차이즈를 관리하는 경우
    if (superAdminMode && targetFranchiseId) {
        headers['X-Franchise-Id'] = targetFranchiseId;
    }

    return headers;
}

// 탭 전환
function showTab(tabName, event) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (event && event.target) {
        event.target.classList.add('active');
    }
    document.getElementById(tabName).classList.add('active');

    // 출석 조회 탭 초기화
    if (tabName === 'attendance') {
        initStats();
        loadAttendanceStats();
    } else if (tabName === 'members') {
        // Trigger load for active sub-tab
        const activeSubTab = document.querySelector('#members .sub-tab-content.active');
        if (activeSubTab) {
            showMemberSubTab(activeSubTab.id);
        } else {
            showMemberSubTab('attendance-status');
        }
    }
}

// 매장 메인 화면으로 이동
function goToStoreMain(storeId, storeName) {
    // 매장 정보를 localStorage에 저장
    localStorage.setItem('selected_store_id', storeId);
    localStorage.setItem('selected_store_name', storeName);

    // 메인 화면으로 이동
    window.location.href = '/';
}

// 매장 메인 페이지로 이동 (새 탭) - superadmin/franchise_admin용
function openStoreManagement(storeId, storeName, storeCode) {
    console.log('openStoreManagement 호출됨:', { storeId, storeName, storeCode });

    // 매장 코드 검증
    if (!storeCode) {
        console.error('매장 코드가 없습니다!', { storeId, storeName, storeCode });
        alert('매장 코드를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        return;
    }

    // 매장 코드를 URL 파라미터로 전달 (매장별 고유 URL)
    // 예: http://localhost:8088/?store=S001
    const url = `/?store=${storeCode}`;
    console.log('새 탭으로 이동:', url);
    window.open(url, '_blank');
}

// 매장 설정 페이지로 이동
function goToStoreSettings(storeId, storeName) {
    // 매장 정보를 localStorage에 저장
    localStorage.setItem('selected_store_id', storeId);
    localStorage.setItem('selected_store_name', storeName);

    // 설정 페이지로 이동
    window.location.href = '/settings';
}

// 프랜차이즈 정보 로드
async function loadFranchiseInfo() {
    try {
        let url;

        if (superAdminMode) {
            // superadmin 모드일 때는 system API 사용
            url = `${API_BASE}/system/franchises/${targetFranchiseId}`;
        } else {
            // 일반 franchise_admin 모드
            // franchise_id 파라미터가 있어도 일반 모드에서는 /api/franchise/ 사용
            // (백엔드에서 토큰으로 프랜차이즈 식별)
            url = `${API_BASE}/franchise/`;
        }

        const response = await fetch(url, {
            headers: getHeaders()
        });

        if (response.ok) {
            franchiseData = await response.json();
            console.log('Franchise data loaded:', franchiseData);

            // 헤더 업데이트
            const franchiseNameElement = document.getElementById('franchiseName');
            if (superAdminMode) {
                franchiseNameElement.innerHTML = `<span style="background: #f5576c; padding: 5px 15px; border-radius: 5px; font-size: 14px; margin-right: 10px;">SUPER ADMIN</span>${franchiseData.name} 프랜차이즈 관리`;
            } else {
                franchiseNameElement.textContent = franchiseData.name + ' 프랜차이즈 관리';
            }

            document.getElementById('overviewName').textContent = franchiseData.name;
            document.getElementById('overviewCode').textContent = franchiseData.code;

            // 회원 관리 설정 로드
            if (franchiseData.member_type) {
                const radio = document.querySelector(`input[name="memberType"][value="${franchiseData.member_type}"]`);
                if (radio) radio.checked = true;
            } else {
                // 기본값 store
                document.querySelector('input[name="memberType"][value="store"]').checked = true;
            }
        } else {
            console.error('Failed to load franchise info:', response.status);
            alert('프랜차이즈 정보를 불러올 수 없습니다.');
        }
    } catch (error) {
        console.error('프랜차이즈 정보 로드 실패:', error);
        alert('프랜차이즈 정보 로드 중 오류가 발생했습니다.');
    }
}

// 매장 목록 로드
async function loadStores() {
    try {
        // superadmin 모드일 때는 system API 사용
        const url = superAdminMode
            ? `${API_BASE}/system/franchises/${targetFranchiseId}/stores`
            : `${API_BASE}/stores/`;

        const response = await fetch(url, {
            headers: getHeaders()
        });

        if (response.ok) {
            storesData = await response.json();
            updateStoresGrid();
            updateOverviewStats();
            populateAllStoreFilters();
        }
    } catch (error) {
        console.error('매장 목록 로드 실패:', error);
    }
}

// 매장 그리드 업데이트
function updateStoresGrid() {
    const grid = document.getElementById('storesGrid');
    grid.innerHTML = '';

    if (storesData.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">등록된 매장이 없습니다.</p>';
        return;
    }

    storesData.forEach(store => {
        const card = document.createElement('div');
        card.className = 'store-card';

        const h3 = document.createElement('h3');
        h3.textContent = store.name;
        h3.title = `클릭하여 ${store.name} 관리 화면으로 이동 (새 탭)`;
        h3.style.cursor = 'pointer';
        h3.onclick = () => openStoreManagement(store.id, store.name, store.code);

        const codeDiv = document.createElement('div');
        codeDiv.className = 'store-code';
        codeDiv.textContent = `코드: ${store.code}`;

        const badge = document.createElement('span');
        badge.className = `badge ${store.is_active ? 'active' : 'inactive'}`;
        badge.textContent = store.is_active ? '활성' : '비활성';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';
        const actionBtn = document.createElement('button');
        actionBtn.className = store.is_active ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-success';
        actionBtn.textContent = store.is_active ? '비활성화' : '활성화';
        actionBtn.onclick = () => store.is_active ? deactivateStore(store.id) : activateStore(store.id);
        actionsDiv.appendChild(actionBtn);

        card.appendChild(h3);
        card.appendChild(codeDiv);
        card.appendChild(badge);
        grid.appendChild(card);
    });
}

// 사용자 목록 로드
async function loadUsers() {
    try {
        // superadmin 모드일 때는 system API 사용
        const url = superAdminMode
            ? `${API_BASE}/system/franchises/${targetFranchiseId}/users`
            : `${API_BASE}/users/`;

        const response = await fetch(url, {
            headers: getHeaders()
        });

        if (response.ok) {
            usersData = await response.json();
            updateUsersTable();
        }
    } catch (error) {
        console.error('사용자 목록 로드 실패:', error);
    }
}

// 사용자 테이블 업데이트
function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    if (usersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">등록된 사용자가 없습니다.</td></tr>';
        return;
    }

    usersData.forEach(user => {
        let roleDisplay = user.role;
        if (user.role === 'franchise_admin') roleDisplay = '프랜차이즈 최종 관리자';
        else if (user.role === 'franchise_manager') roleDisplay = '프랜차이즈 중간 관리자';
        else if (user.role === 'store_admin') roleDisplay = '매장 관리자';

        let storeName = '-';
        if (user.role === 'store_admin') {
            storeName = user.store_id
                ? (storesData.find(s => s.id === user.store_id)?.name || '-')
                : '-';
        } else if (user.role === 'franchise_manager') {
            if (user.managed_stores && user.managed_stores.length > 0) {
                storeName = user.managed_stores.map(s => s.name).join(', ');
                if (storeName.length > 30) storeName = storeName.substring(0, 30) + '...';
            } else {
                storeName = '(지정된 매장 없음)';
            }
        } else {
            storeName = '전체 매장';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
                    <td data-label="사용자명">${user.username}</td>
                    <td data-label="역할">${roleDisplay}</td>
                    <td data-label="매장">${storeName}</td>
                    <td data-label="상태"><span class="badge ${user.is_active ? 'active' : 'inactive'}">${user.is_active ? '활성' : '비활성'}</span></td>
                `;
        tbody.appendChild(row);
    });
}

// 개요 통계 업데이트
function updateOverviewStats() {
    const activeStores = storesData.filter(s => s.is_active).length;
    document.getElementById('overviewStores').textContent = `${storesData.length}개`;
    document.getElementById('overviewActiveStores').textContent = `${activeStores}개`;
}

// 통계 로드
async function loadStats() {
    try {
        // superadmin 모드일 때는 system API 사용
        const url = superAdminMode
            ? `${API_BASE}/system/franchises/${targetFranchiseId}/stats`
            : `${API_BASE}/franchise/stats`;

        const response = await fetch(url, {
            headers: getHeaders()
        });

        if (response.ok) {
            const stats = await response.json();
            const grid = document.getElementById('statsGrid');
            grid.innerHTML = `
                        <div class="stat-card">
                            <h3>총 매장</h3>
                            <div class="value">${stats.total_stores}</div>
                        </div>
                        <div class="stat-card">
                            <h3>활성 매장</h3>
                            <div class="value">${stats.active_stores}</div>
                        </div>
                        <div class="stat-card">
                            <h3>총 사용자</h3>
                            <div class="value">${stats.total_users}</div>
                        </div>
                        <div class="stat-card">
                            <h3>총 회원</h3>
                            <div class="value">${stats.total_members}</div>
                        </div>
                    `;
        }
    } catch (error) {
        console.error('통계 로드 실패:', error);
    }
}

function showAddUserModal() {
    console.log('=== showAddUserModal 시작 ===');

    try {
        loadStoresForSelect();
    } catch (error) {
        console.error('Error loading stores for select:', error);
    }

    const modal = document.getElementById('addUserModal');
    if (!modal) {
        alert('오류: 사용자 모달을 찾을 수 없습니다.');
        return;
    }

    modal.classList.add('show');

    // 인라인 스타일 강제 적용
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.zIndex = '99999';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';

    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.position = 'relative';
        modalContent.style.zIndex = '100000';
    }

    console.log('=== showAddUserModal 완료 ===');
}

function closeModal(modalId) {
    console.log('=== closeModal:', modalId, '===');
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error('Modal not found:', modalId);
        return;
    }
    modal.classList.remove('show');
    modal.style.display = 'none';
    console.log('=== Modal closed ===');
}

function toggleStoreSelect() {
    const role = document.getElementById('userRole').value;
    const storeGroup = document.getElementById('storeSelectGroup');
    const storeMultiGroup = document.getElementById('storeMultiSelectGroup');

    // Reset displays
    storeGroup.style.display = 'none';
    document.getElementById('userStore').required = false;
    storeMultiGroup.style.display = 'none';

    if (role === 'store_admin') {
        storeGroup.style.display = 'block';
        document.getElementById('userStore').required = true;
    } else if (role === 'franchise_manager') {
        storeMultiGroup.style.display = 'block';
        // Checkbox validation is manual in submit
    }
}

function toggleEditStoreSelect() {
    const role = document.getElementById('editUserRole').value;
    const storeGroup = document.getElementById('editStoreSelectGroup');
    const storeMultiGroup = document.getElementById('editStoreMultiSelectGroup');

    storeGroup.style.display = 'none';
    document.getElementById('editUserStore').required = false;
    storeMultiGroup.style.display = 'none';

    if (role === 'store_admin') {
        storeGroup.style.display = 'block';
        document.getElementById('editUserStore').required = true;
    } else if (role === 'franchise_manager') {
        storeMultiGroup.style.display = 'block';
    }
}

function loadStoresForSelect() {
    try {
        // 1. Single Select
        const select = document.getElementById('userStore');
        if (select) {
            select.innerHTML = '<option value="">선택하세요</option>';
            if (storesData && Array.isArray(storesData)) {
                storesData.filter(s => s.is_active).forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.id;
                    option.textContent = store.name;
                    select.appendChild(option);
                });
            }
        }

        // 2. Multi Select
        const multiContainer = document.getElementById('storeMultiSelectContainer');
        if (multiContainer) {
            multiContainer.innerHTML = '';
            if (storesData && Array.isArray(storesData)) {
                storesData.filter(s => s.is_active).forEach(store => {
                    const wrapper = document.createElement('div');
                    wrapper.style.marginBottom = '5px';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.name = 'managedStores';
                    checkbox.value = store.id;
                    checkbox.id = `new_store_${store.id}`;

                    const label = document.createElement('label');
                    label.htmlFor = `new_store_${store.id}`;
                    label.textContent = ` ${store.name}`;
                    label.style.marginLeft = '5px';
                    label.style.cursor = 'pointer';

                    wrapper.appendChild(checkbox);
                    wrapper.appendChild(label);
                    multiContainer.appendChild(wrapper);
                });
            }
        }
    } catch (error) {
        console.error('Error in loadStoresForSelect:', error);
    }
}

function loadEditStoresForSelect() {
    // 1. Single Select
    const select = document.getElementById('editUserStore');
    select.innerHTML = '<option value="">선택하세요</option>';

    storesData.filter(s => s.is_active).forEach(store => {
        const option = document.createElement('option');
        option.value = store.id;
        option.textContent = store.name;
        select.appendChild(option);
    });

    // 2. Multi Select
    const multiContainer = document.getElementById('editStoreMultiSelectContainer');
    if (multiContainer) {
        multiContainer.innerHTML = '';
        storesData.filter(s => s.is_active).forEach(store => {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '5px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = 'editManagedStores';
            checkbox.value = store.id;
            checkbox.id = `edit_store_${store.id}`;

            const label = document.createElement('label');
            label.htmlFor = `edit_store_${store.id}`;
            label.textContent = ` ${store.name}`;
            label.style.marginLeft = '5px';
            label.style.cursor = 'pointer';

            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            multiContainer.appendChild(wrapper);
        });
    }
}

// 사용자 추가 Submit Handler
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Add User Form Submitted');

    const role = document.getElementById('userRole').value;
    const data = {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        role: role
    };

    if (role === 'store_admin') {
        data.store_id = parseInt(document.getElementById('userStore').value);
        if (!data.store_id) { alert('매장을 선택해주세요.'); return; }
    } else if (role === 'franchise_manager') {
        // Collect Multi-select
        const checkboxes = document.querySelectorAll('#storeMultiSelectContainer input[type="checkbox"]:checked');
        const storeIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        if (storeIds.length === 0) {
            alert('최소 하나 이상의 매장을 선택해주세요.');
            return;
        }
        data.managed_store_ids = storeIds;
    }

    try {
        let url;
        if (superAdminMode) {
            url = `${API_BASE}/system/franchises/${targetFranchiseId}/users`;
        } else {
            url = `${API_BASE}/users/`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('사용자가 추가되었습니다.');
            closeModal('addUserModal');
            document.getElementById('addUserForm').reset();
            await loadUsers();
        } else {
            const error = await response.json();
            alert(error.detail || '사용자 추가에 실패했습니다.');
        }
    } catch (error) {
        console.error('사용자 추가 실패 (Exception):', error);
        alert('사용자 추가 중 오류가 발생했습니다: ' + error.message);
    }
});

// 사용자 수정 Submit Handler
document.getElementById('editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const role = document.getElementById('editUserRole').value;
    const data = {
        username: document.getElementById('editUsername').value,
        role: role
    };

    // 비밀번호가 입력된 경우에만 포함
    const password = document.getElementById('editPassword').value;
    if (password) {
        data.password = password;
    }

    if (role === 'store_admin') {
        data.store_id = parseInt(document.getElementById('editUserStore').value);
        data.managed_store_ids = null; // Clear if switching role
        if (!data.store_id) { alert('매장을 선택해주세요.'); return; }
    } else if (role === 'franchise_manager') {
        data.store_id = null;
        // Collect Multi-select
        const checkboxes = document.querySelectorAll('#editStoreMultiSelectContainer input[type="checkbox"]:checked');
        const storeIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        if (storeIds.length === 0) {
            alert('최소 하나 이상의 매장을 선택해주세요.');
            return;
        }
        data.managed_store_ids = storeIds;
    } else {
        data.store_id = null;
        data.managed_store_ids = null;
    }

    try {
        // superadmin 모드일 때는 system API 사용
        const url = superAdminMode
            ? `${API_BASE}/system/users/${currentEditUserId}`
            : `${API_BASE}/users/${currentEditUserId}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('사용자 정보가 수정되었습니다.');
            closeModal('editUserModal');
            document.getElementById('editUserForm').reset();
            await loadUsers();
        } else {
            const error = await response.json();
            alert(error.detail || '사용자 수정에 실패했습니다.');
        }
    } catch (error) {
        console.error('사용자 수정 실패:', error);
        alert('사용자 수정 중 오류가 발생했습니다.');
    }
});

// 매장 비활성화/활성화
async function deactivateStore(storeId) {
    if (!confirm('이 매장을 비활성화하시겠습니까?')) return;

    try {
        // superadmin 모드일 때는 system API 사용
        const url = superAdminMode
            ? `${API_BASE}/system/stores/${storeId}/deactivate`
            : `${API_BASE}/stores/${storeId}/deactivate`;

        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders()
        });

        if (response.ok) {
            alert('매장이 비활성화되었습니다.');
            await loadStores();
        } else {
            const error = await response.json();
            alert(error.detail || '매장 비활성화에 실패했습니다.');
        }
    } catch (error) {
        console.error('매장 비활성화 실패:', error);
    }
}

async function activateStore(storeId) {
    try {
        // superadmin 모드일 때는 system API 사용
        const url = superAdminMode
            ? `${API_BASE}/system/stores/${storeId}/activate`
            : `${API_BASE}/stores/${storeId}/activate`;

        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders()
        });

        if (response.ok) {
            alert('매장이 활성화되었습니다.');
            await loadStores();
        } else {
            const error = await response.json();
            alert(error.detail || '매장 활성화에 실패했습니다.');
        }
    } catch (error) {
        console.error('매장 활성화 실패:', error);
    }
}

// 사용자 비활성화/활성화
async function deactivateUser(userId) {
    if (!confirm('이 사용자를 비활성화하시겠습니까?')) return;

    try {
        // superadmin 모드일 때는 system API 사용
        const url = superAdminMode
            ? `${API_BASE}/system/users/${userId}`
            : `${API_BASE}/users/${userId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (response.status === 204) {
            alert('사용자가 비활성화되었습니다.');
            await loadUsers();
        } else {
            const error = await response.json();
            alert(error.detail || '사용자 비활성화에 실패했습니다.');
        }
    } catch (error) {
        console.error('사용자 비활성화 실패:', error);
    }
}

async function activateUser(userId) {
    try {
        // superadmin 모드일 때는 system API 사용
        const url = superAdminMode
            ? `${API_BASE}/system/users/${userId}/activate`
            : `${API_BASE}/users/${userId}/activate`;

        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders()
        });

        if (response.ok) {
            alert('사용자가 활성화되었습니다.');
            await loadUsers();
        } else {
            const error = await response.json();
            alert(error.detail || '사용자 활성화에 실패했습니다.');
        }
    } catch (error) {
        console.error('사용자 활성화 실패:', error);
    }
}

// Load Attendance Stats for main dashboard tab
async function loadAttendanceStats() {
    const franchiseId = superAdminMode ? targetFranchiseId : franchiseData.id;
    const startDate = document.getElementById('statsStartDate').value;
    const endDate = document.getElementById('statsEndDate').value;
    const storeId = document.getElementById('statsStoreFilter').value;

    try {
        const dashboardUrl = new URL(`${API_BASE}/franchise/stats/${franchiseId}/dashboard`, window.location.origin);
        dashboardUrl.searchParams.append('start_date', startDate);
        dashboardUrl.searchParams.append('end_date', endDate);
        if (storeId) dashboardUrl.searchParams.append('store_id', storeId);

        const response = await fetch(dashboardUrl, { headers: getHeaders() });
        const data = await response.json();

        // Update Total Waiting stats
        document.getElementById('totalWaitingTotal').textContent = `${data.total_waiting.total}명`;
        document.getElementById('totalWaitingExisting').textContent = `${data.total_waiting.existing}명`;
        document.getElementById('totalWaitingNew').textContent = `${data.total_waiting.new}명`;

        // Update Current Waiting stats
        document.getElementById('currentWaitingTotal').textContent = `${data.current_waiting.total}명`;
        document.getElementById('currentWaitingExisting').textContent = `${data.current_waiting.existing}명`;
        document.getElementById('currentWaitingNew').textContent = `${data.current_waiting.new}명`;

        // Update Total Attendance stats
        document.getElementById('totalAttendanceTotal').textContent = `${data.total_attendance.total}명`;
        document.getElementById('totalAttendanceExisting').textContent = `${data.total_attendance.existing}명`;
        document.getElementById('totalAttendanceNew').textContent = `${data.total_attendance.new}명`;

        // Update store status table
        const tbody = document.getElementById('storeStatusBody');
        if (tbody && data.store_stats) {
            tbody.innerHTML = '';
            currentStoreStats = data.store_stats; // Store globally for chart rendering

            data.store_stats.forEach(store => {
                const row = document.createElement('tr');
                row.innerHTML = `
                            <td>${store.store_name}</td>
                            <td>${store.waiting_count}명</td>
                            <td>${store.attendance_count}명</td>
                            <td><span class="badge ${store.is_active ? 'active' : 'inactive'}">${store.is_active ? '운영중' : '휴무'}</span></td>
                        `;
                tbody.appendChild(row);
            });

            // Render charts
            renderStoreCharts();
        }

        // Update last updated time
        updateLastUpdatedTime('lastUpdatedTime');
    } catch (error) {
        console.error('Failed to load attendance stats:', error);
    }
}

// --- Chart Functions ---
let waitingChartInstance = null;
let attendanceChartInstance = null;
let currentStoreStats = [];

function renderStoreCharts() {
    if (!currentStoreStats || currentStoreStats.length === 0) return;

    const style = document.getElementById('graphStyleSelect').value;
    const labels = currentStoreStats.map(s => s.store_name);
    const waitingData = currentStoreStats.map(s => s.waiting_count);
    const attendanceData = currentStoreStats.map(s => s.attendance_count);

    // Calculate Max Value from Waiting Data for Sync
    const maxWaiting = Math.max(...waitingData, 0);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    // Attendance Scale Options (Sync with Waiting)
    // Use suggestedMax to ensure the scale covers at least the waiting max.
    // Chart.js will then round this up nicely (e.g., 42 -> 45), matching the Waiting chart's behavior.
    const attendanceOptions = JSON.parse(JSON.stringify(commonOptions));
    attendanceOptions.scales.y.suggestedMax = maxWaiting;

    // 1. Waiting Chart
    const ctxWaiting = document.getElementById('storeWaitingChart');
    if (ctxWaiting) {
        if (waitingChartInstance) waitingChartInstance.destroy();
        waitingChartInstance = new Chart(ctxWaiting, {
            type: style,
            data: {
                labels: labels,
                datasets: [{
                    label: '대기 접수',
                    data: waitingData,
                    backgroundColor: style === 'line' ? 'rgba(52, 152, 219, 0.2)' : [
                        '#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6', '#34495e'
                    ],
                    borderColor: '#3498db',
                    borderWidth: 1,
                    fill: style === 'line'
                }]
            },
            options: commonOptions
        });
    }

    // 2. Attendance Chart
    const ctxAttendance = document.getElementById('storeAttendanceChart');
    if (ctxAttendance) {
        if (attendanceChartInstance) attendanceChartInstance.destroy();
        attendanceChartInstance = new Chart(ctxAttendance, {
            type: style,
            data: {
                labels: labels,
                datasets: [{
                    label: '출석 완료',
                    data: attendanceData,
                    backgroundColor: style === 'line' ? 'rgba(46, 204, 113, 0.2)' : [
                        '#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#34495e'
                    ],
                    borderColor: '#2ecc71',
                    borderWidth: 1,
                    fill: style === 'line'
                }]
            },
            options: attendanceOptions
        });
    }
}

// 초기 로드
async function init() {
    const token = getToken();
    if (!token) {
        alert('로그인이 필요합니다.');
        window.location.href = '/login';
        return;
    }

    // URL 파라미터에서 franchise_id 확인
    const franchiseIdParam = getUrlParameter('franchise_id');


    // 페이지 unload 시 컨텍스트 정리
    window.addEventListener('beforeunload', () => {
        if (superAdminMode) {
            localStorage.removeItem('superadmin_franchise_context');
        }
    });
    const superAdminContext = localStorage.getItem('superadmin_franchise_context');
    if (franchiseIdParam && superAdminContext) {
        const context = JSON.parse(superAdminContext);
        if (context.isSuperAdmin && context.id == franchiseIdParam) {
            superAdminMode = true;
            targetFranchiseId = franchiseIdParam;
        }
    }
    // 일반 franchise_admin 사용자는 URL 파라미터를 무시
    // JWT 토큰의 franchise_id만 사용

    await loadFranchiseInfo();
    await loadStores();
    await loadUsers();
    await loadStats();
    initStats(); // 날짜 초기화 및 매장 필터 설정
}

// --- Member Management Dashboard Functions ---

function populateAllStoreFilters() {
    if (!storesData || !Array.isArray(storesData)) return;

    const filterIds = [
        'statsStoreFilter',
        'waitingStoreFilter',
        'memStoreFilter',
        'newMemStoreFilter',
        'rankStoreFilter'
    ];

    filterIds.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            // Keep first option (All Stores)
            while (select.options.length > 1) select.remove(1);

            storesData.forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = store.name;
                select.appendChild(option);
            });
        }
    });

    // Also call existing select loaders
    loadStoresForSelect();
}

// Sub-tab navigation
function showMemberSubTab(subTabId) {
    // Update buttons
    document.querySelectorAll('.sub-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(subTabId)) {
            btn.classList.add('active');
        }
    });

    // Update content visibility
    document.querySelectorAll('#members .sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(subTabId).classList.add('active');

    // Initialize date ranges for each tab if empty
    if (subTabId === 'waiting-status') {
        if (!document.getElementById('waitingStartDate').value) {
            updateTabDateRange('waiting');
        }
        loadWaitingStatus();
    } else if (subTabId === 'attendance-status') {
        if (!document.getElementById('memStartDate').value) {
            updateTabDateRange('mem');
        }
        loadMemberDashboard();
    } else if (subTabId === 'new-members') {
        if (!document.getElementById('newMemStartDate').value) {
            updateTabDateRange('newMem');
        }
        loadNewMembers();
    } else if (subTabId === 'attendance-ranking') {
        if (!document.getElementById('rankStartDate').value) {
            updateTabDateRange('rank');
        }
        loadAttendanceRanking();
    }
}

// --- Date Range Initialization Functions ---

// Initialize stats tab date ranges and filters
function initStats() {
    // Initialize date range for attendance stats tab
    updateDateRange();

    // Populate store filters
    populateAllStoreFilters();
}

// Update date range for attendance stats tab based on period selector
function updateDateRange() {
    const periodSelect = document.getElementById('statsPeriodFilter');
    const startInput = document.getElementById('statsStartDate');
    const endInput = document.getElementById('statsEndDate');

    if (!periodSelect || !startInput || !endInput) return;

    const period = periodSelect.value || 'day';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (period === 'day') {
        startInput.value = todayStr;
        endInput.value = todayStr;
    } else if (period === 'week') {
        // This week: Monday to Sunday
        const dayOfWeek = now.getDay(); // 0(Sun) ~ 6(Sat)
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

        const monday = new Date(now);
        monday.setDate(diff);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const format = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        startInput.value = format(monday);
        endInput.value = format(sunday);
    } else if (period === 'month') {
        const firstDay = new Date(year, now.getMonth(), 1);
        const lastDay = new Date(year, now.getMonth() + 1, 0);

        const format = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        startInput.value = format(firstDay);
        endInput.value = format(lastDay);
    }
}

// Update last updated time display
function updateLastUpdatedTime(elementId = 'lastUpdatedTime') {
    const element = document.getElementById(elementId);
    if (element) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        element.textContent = `마지막 업데이트: ${timeStr}`;
    }
}

// --- 1. Waiting Status ---
// --- Generic Date Range Helper ---
function updateTabDateRange(prefix) {
    let periodId = prefix + 'Period';
    if (prefix === 'mem') periodId = 'memStatsPeriod'; // Exception for existing ID

    const periodElement = document.getElementById(periodId);
    if (!periodElement) return;

    const period = periodElement.value || 'day'; // Default to 'day' if empty
    const startInput = document.getElementById(prefix + 'StartDate');
    const endInput = document.getElementById(prefix + 'EndDate');

    if (!startInput || !endInput) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    if (period === 'day') {
        startInput.value = todayStr;
        endInput.value = todayStr;
    } else if (period === 'week') {
        // 이번주 월요일 ~ 일요일
        const dayOfWeek = now.getDay(); // 0(Sun) ~ 6(Sat)
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);

        const monday = new Date(now);
        monday.setDate(diff);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const format = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        startInput.value = format(monday);
        endInput.value = format(sunday);
    } else if (period === 'month') {
        const firstDay = new Date(year, now.getMonth(), 1);
        const lastDay = new Date(year, now.getMonth() + 1, 0);

        const format = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };

        startInput.value = format(firstDay);
        endInput.value = format(lastDay);
    }
}

// --- 1. Waiting Status ---
async function loadWaitingStatus() {
    const franchiseId = superAdminMode ? targetFranchiseId : franchiseData.id;
    const storeId = document.getElementById('waitingStoreFilter').value;
    const startDate = document.getElementById('waitingStartDate').value;
    const endDate = document.getElementById('waitingEndDate').value;

    try {
        let url = `${API_BASE}/franchise/stats/${franchiseId}/waiting/list`;
        const params = new URLSearchParams();
        if (storeId) params.append('store_id', storeId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        const tbody = document.getElementById('waitingStatusBody');
        tbody.innerHTML = '';

        // 1. 통계 데이터 로드 (dashboard API 재사용)
        const dashboardUrl = new URL(`${API_BASE}/franchise/stats/${franchiseId}/dashboard`, window.location.origin);
        if (startDate) dashboardUrl.searchParams.append('start_date', startDate);
        if (endDate) dashboardUrl.searchParams.append('end_date', endDate);
        if (storeId) dashboardUrl.searchParams.append('store_id', storeId);

        const dashboardResponse = await fetch(dashboardUrl, { headers: getHeaders() });
        const dashboardData = await dashboardResponse.json();

        // Update statistics displays with server data
        const totalWaiting = dashboardData.total_waiting;
        const currentWaiting = dashboardData.current_waiting;

        document.getElementById('waitingTotalCount').textContent = `${totalWaiting.total}명`;
        document.getElementById('waitingExistingCount').textContent = `${totalWaiting.existing}명`;
        document.getElementById('waitingNewCount').textContent = `${totalWaiting.new}명`;

        document.getElementById('waitingCurrentCount').textContent = `${currentWaiting.total}명`;
        document.getElementById('waitingCurrentExistingCount').textContent = `${currentWaiting.existing}명`;
        document.getElementById('waitingCurrentNewCount').textContent = `${currentWaiting.new}명`;

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">데이터가 없습니다.</td></tr>';
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');

            // Convert status to Korean
            let statusText = item.status;
            if (item.status === 'attended') {
                statusText = '출석';
            } else if (item.status === 'waiting') {
                statusText = '대기중';
            } else if (item.status === 'cancelled') {
                statusText = '취소';
            }

            row.innerHTML = `
                        <td data-label="대기번호">${item.waiting_number}</td>
                        <td data-label="매장">${item.store_name}</td>
                        <td data-label="이름/전화번호">
                            <div>${item.member_name || '이름없음'}</div>
                            <div style="font-size: 12px; color: #888;">${item.phone}</div>
                        </td>
                        <td data-label="상태"><span class="badge active">${statusText}</span></td>
                        <td data-label="선택">
                            ${item.member_id ? `<button class="btn btn-sm btn-outline" onclick="openMemberDetailModal(${item.member_id}, '${item.member_name}', '${item.phone}')">선택</button>` : '-'}
                        </td>
        `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to load waiting status:', error);
    }
}

// --- 2. Attendance Status (Main Dashboard for Members) ---
// updateTabDateRange replaces updateMemDateRange but we keep the old name wrapper if used elsewhere, 
// or just rely on the onclick changes in HTML which now call updateTabDateRange('mem').
// We can remove the old function.

async function loadMemberDashboard() {
    const franchiseId = superAdminMode ? targetFranchiseId : franchiseData.id;
    const startDate = document.getElementById('memStartDate').value;
    const endDate = document.getElementById('memEndDate').value;
    const storeId = document.getElementById('memStoreFilter').value;

    try {
        // 1. 통계 데이터 로드
        const dashboardUrl = new URL(`${API_BASE}/franchise/stats/${franchiseId}/dashboard`, window.location.origin);
        dashboardUrl.searchParams.append('start_date', startDate);
        dashboardUrl.searchParams.append('end_date', endDate);
        if (storeId) dashboardUrl.searchParams.append('store_id', storeId);

        const dashboardResponse = await fetch(dashboardUrl, { headers: getHeaders() });
        const dashboardData = await dashboardResponse.json();

        document.getElementById('memTotalAttendance').textContent = `${dashboardData.total_attendance.total}명`;
        document.getElementById('memExistingAttendance').textContent = `${dashboardData.total_attendance.existing}명`;
        document.getElementById('memNewAttendance').textContent = `${dashboardData.total_attendance.new}명`;

        // 2. 출석 리스트 로드
        const listUrl = new URL(`${API_BASE}/franchise/stats/${franchiseId}/attendance/list`, window.location.origin);
        listUrl.searchParams.append('start_date', startDate);
        listUrl.searchParams.append('end_date', endDate);
        if (storeId) listUrl.searchParams.append('store_id', storeId);

        const listResponse = await fetch(listUrl, { headers: getHeaders() });
        const listData = await listResponse.json();

        const tbody = document.getElementById('attendanceListBody');
        tbody.innerHTML = '';

        if (listData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">출석 이력이 없습니다.</td></tr>';
        } else {
            listData.forEach(item => {
                const row = document.createElement('tr');
                const attendedAt = new Date(item.attended_at).toLocaleString();

                row.innerHTML = `
                            <td data-label="일시">${attendedAt}</td>
                            <td data-label="매장">${item.store_name}</td>
                            <td data-label="이름/전화번호">
                                <div>${item.member_name}</div>
                                <div style="font-size: 12px; color: #888;">${item.phone}</div>
                            </td>
                            <td data-label="상태"><span class="badge active">출석</span></td>
                            <td data-label="상세">
                                <button class="btn btn-sm btn-outline" onclick="openMemberDetailModal(${item.member_id}, '${item.member_name}', '${item.phone}')">선택</button>
                            </td>
                        `;
                tbody.appendChild(row);
            });
        }

        updateLastUpdatedTime('memLastUpdated');
    } catch (error) {
        console.error('Failed to load member dashboard:', error);
    }
}

// --- 3. Individual Attendance ---
async function searchMember() {
    const query = document.getElementById('memberSearchInput').value;
    if (query.length < 2) {
        alert('검색어를 2글자 이상 입력해주세요.');
        return;
    }

    const franchiseId = superAdminMode ? targetFranchiseId : franchiseData.id;
    try {
        const url = `${API_BASE}/franchise/stats/${franchiseId}/members/search?query=${encodeURIComponent(query)}`;
        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        const tbody = document.getElementById('memberSearchBody');
        tbody.innerHTML = '';
        document.getElementById('memberSearchResults').style.display = 'block';
        document.getElementById('memberHistoryContainer').style.display = 'none';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">검색 결과가 없습니다.</td></tr>';
            return;
        }

        data.forEach(mem => {
            const row = document.createElement('tr');
            // Phone formatting
            const phoneFormatted = mem.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');

            row.innerHTML = `
                        <td data-label="이름" style="font-size: 18px; font-weight: bold; color: #2c3e50;">${mem.name}</td>
                        <td data-label="전화번호" style="font-size: 18px; font-weight: bold; color: #2c3e50;">${phoneFormatted}</td>
                        <td data-label="가입일">${new Date(mem.created_at).toLocaleDateString()}</td>
                        <td data-label="가입매장">${mem.store_name}</td>
                        <td data-label="선택"><button class="btn btn-sm btn-outline" onclick="selectMemberForHistory(${mem.id}, '${mem.name}')">선택</button></td>
                    `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Search failed:', error);
    }
}

let currentSelectedMemberId = null;
function selectMemberForHistory(memberId, memberName) {
    currentSelectedMemberId = memberId;
    document.getElementById('selectedMemberName').textContent = memberName;
    document.getElementById('selectedMemberTotal').textContent = ''; // Reset total
    document.getElementById('memberHistoryContainer').style.display = 'block';

    // Default: last 3 months
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    document.getElementById('historyEndDate').valueAsDate = end;
    document.getElementById('historyStartDate').valueAsDate = start;

    loadSelectedMemberHistory();
}

// Calendar State
let currentCalendarDate = new Date();
let currentMemberAttendanceData = []; // Store fetched data for calendar

async function loadSelectedMemberHistory() {
    if (!currentSelectedMemberId) return;

    const franchiseId = superAdminMode ? targetFranchiseId : franchiseData.id;
    const start = document.getElementById('historyStartDate').value;
    const end = document.getElementById('historyEndDate').value;

    try {
        const url = `${API_BASE}/franchise/stats/${franchiseId}/members/${currentSelectedMemberId}/history?start_date=${start}&end_date=${end}`;
        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        const tbody = document.getElementById('memberHistoryListBody');
        tbody.innerHTML = '';

        // Store data for calendar
        currentMemberAttendanceData = data;

        // Update Total Count
        document.getElementById('selectedMemberTotal').textContent = `(총 ${data.length}회 출석)`;

        // Initialize calendar to end date's month or current month
        if (end) {
            currentCalendarDate = new Date(end);
        } else {
            currentCalendarDate = new Date();
        }
        renderCalendar();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">이력이 없습니다.</td></tr>';
            return;
        }

        data.forEach(h => {
            const row = document.createElement('tr');
            row.innerHTML = `
                        <td>${new Date(h.attended_at).toLocaleString()}</td>
                        <td>${h.store_name}</td>
                        <td>${h.status === 'attended' ? '출석' : h.status}</td>
                    `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('History load failed:', error);
    }
}

// Calendar Functions
function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Set Title
    document.getElementById('calendarTitle').textContent = `${year}년 ${month + 1}월`;

    const calendarBody = document.getElementById('calendarBody');
    calendarBody.innerHTML = '';

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Pad empty cells before first day
    let startDayOfWeek = firstDay.getDay(); // 0(Sun) ~ 6(Sat)

    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarBody.appendChild(emptyCell);
    }

    // Process attendance data for efficient lookup
    const attendanceMap = {};
    currentMemberAttendanceData.forEach(item => {
        if (item.status === 'attended' && item.attended_at) {
            const d = new Date(item.attended_at);
            const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!attendanceMap[k]) attendanceMap[k] = 0;
            attendanceMap[k]++;
        }
    });

    // Generate days
    const today = new Date();
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dayDate = new Date(year, month, d);
        const dayKey = `${year}-${month}-${d}`;

        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        // Check if today
        if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === d) {
            cell.classList.add('today');
        }

        // Check for Saturday/Sunday styling
        const dayOfWeek = dayDate.getDay();
        if (dayOfWeek === 0) cell.classList.add('sunday');
        if (dayOfWeek === 6) cell.classList.add('saturday');

        let html = `<span class="day-number">${d}</span>`;

        // Add attendance badge
        if (attendanceMap[dayKey]) {
            html += `<span class="attendance-badge">출석 ${attendanceMap[dayKey]}회</span>`;
            cell.style.backgroundColor = '#f0fff4'; // Light green highlight
        }

        cell.innerHTML = html;
        calendarBody.appendChild(cell);
    }

    // Pad empty cells after last day (optional, to fill grid)
    const remainingCells = 7 - ((startDayOfWeek + lastDay.getDate()) % 7);
    if (remainingCells < 7) {
        for (let i = 0; i < remainingCells; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            calendarBody.appendChild(emptyCell);
        }
    }
}

// --- Member Detail Modal Logic (Refactored) ---
let modalCurrentMemberId = null;
let modalCurrentCalendarDate = new Date();
let modalCurrentAttendanceData = [];

function openMemberDetailModal(memberId, memberName, memberPhone) {
    console.log('openMemberDetailModal called:', memberId, memberName, memberPhone);

    if (!memberId) {
        alert('회원 정보가 없습니다.');
        return;
    }

    modalCurrentMemberId = memberId;
    const nameEl = document.getElementById('modalMemberName');
    if (nameEl) nameEl.textContent = memberName;

    // Set Member Info in Stats Card (Name & Phone)
    document.getElementById('modalMemberNameDisplay').textContent = memberName;

    // Format and Set Phone Number
    if (memberPhone && memberPhone !== 'undefined' && memberPhone !== 'null') {
        // Formatting assumption: 01012345678 -> 010-1234-5678
        const formattedPhone = memberPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
        document.getElementById('modalMemberPhoneDisplay').textContent = `(${formattedPhone})`;
    } else {
        document.getElementById('modalMemberPhoneDisplay').textContent = '';
    }

    // Initialize modalCurrentCalendarDate to today's date for the initial view
    modalCurrentCalendarDate = new Date();

    // Set default date to today for the date picker as well (sync with calendar)
    const dateInput = document.getElementById('modalDate');
    if (dateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    // Ensure period selector is reset to monthly
    const periodSelect = document.getElementById('modalPeriod');
    if (periodSelect) {
        periodSelect.value = 'monthly';
        // Trigger change to set UI state (e.g. show/hide secondary date picker)
        if (typeof handleModalPeriodChange === 'function') {
            handleModalPeriodChange();
        }
    }

    const modal = document.getElementById('memberDetailModal');
    if (!modal) {
        console.error('memberDetailModal element not found!');
        return;
    }

    modal.classList.add('show');
    // Force styles for visibility
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.zIndex = '99999';
    // Ensure background is semi-transparent black if not set by CSS
    if (!modal.style.backgroundColor) {
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    }

    // Force modal content visibility
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.display = 'block';
        modalContent.style.opacity = '1';
        modalContent.style.zIndex = '100000';
    }

    loadModalMemberHistory();
}

// 기간 변경 핸들러
function handleModalPeriodChange() {
    const periodSelect = document.getElementById('modalPeriod');
    const container = document.getElementById('modalDateContainer');

    const isCustom = periodSelect.value === 'custom';
    const separator = container.querySelector('.date-separator');
    const endDateWrapper = container.querySelector('.date-end');

    if (separator) separator.style.display = isCustom ? 'inline' : 'none';
    if (endDateWrapper) endDateWrapper.style.display = isCustom ? 'inline-block' : 'none';

    // Custom 선택 시 종료일이 비어있으면 시작일과 동일하게 설정
    if (isCustom) {
        const dateInput = document.getElementById('modalDate');
        const endDateInput = document.getElementById('modalEndDate');
        if (dateInput && endDateInput && !endDateInput.value) {
            endDateInput.value = dateInput.value;
            // Trigger display update for end date
            updateModalDateDisplay(endDateInput, 'modalEndDateDisplay');
        }
    }

    // 날짜 표시 업데이트
    const dateInput = document.getElementById('modalDate');
    if (dateInput) {
        updateModalDateDisplay(dateInput, 'modalDateDisplay');
    }
}

// 날짜 표시 업데이트 함수
function updateModalDateDisplay(input, displayId) {
    const display = document.getElementById(displayId);
    if (!display) return;

    // EndDateDisplay는 항상 daily 포맷
    if (displayId.includes('EndDate')) {
        display.value = formatDateToDisplay(input.value, 'daily');
        return;
    }

    const periodSelect = document.getElementById('modalPeriod');
    const period = periodSelect ? periodSelect.value : 'daily';

    display.value = formatDateToDisplay(input.value, period);

    // 주간 선택 시 입력창 너비 조정
    if (period === 'weekly') {
        display.parentElement.style.width = '240px';
    } else {
        display.parentElement.style.width = '150px';
    }
}

// 날짜 포맷 유틸리티 (admin.html 내에 없으면 추가 필요, 있으면 재사용)
// Check if formatDateToDisplay exists, if not define it locally or reuse if global
// Assuming it logic from attendance.html needs to be here if not present globally.
// admin.html seemingly doesn't have formatDateToDisplay based on earlier read.
// We'll define a local version or check if we can add it globally.
// Better to define it here to be safe within this block.
function formatDateToDisplay(dateString, period = 'daily') {
    if (!dateString) return '';
    const d = new Date(dateString);

    if (period === 'weekly') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}. ${month}. ${day}`;
}

async function loadModalMemberHistory() {
    if (!modalCurrentMemberId) return;

    const franchiseId = superAdminMode ? targetFranchiseId : franchiseData.id;

    const periodSelect = document.getElementById('modalPeriod');
    let period = periodSelect ? periodSelect.value : 'monthly';
    const date = document.getElementById('modalDate').value;

    // For the calendar, if 'monthly' is selected (default), we want to ensure we have data 
    // for the *displayed* month in the calendar, which might be different from the *query* date.
    // But initially they are synced.
    // To make "interactive navigation" work smoothly without re-fetching every click if possible,
    // or just re-fetch. Re-fetching is safer and easier.

    // However, the existing logic calculates start/end based on "modalDate" input.
    // If we want the calendar to be independent, we should probably fetch based on `modalCurrentCalendarDate` 
    // OR just fetch the range requested by the filter and render the calendar for that range.

    // The user requested: "arrows to move previous/next month". 
    // This implies data fetching or just view shifting? Usually fetching.
    // Let's assume we fetch data based on the *Period Selector* filter.
    // If the user uses the arrows, does it change the *Period Selector*?
    // In the target design (second image), the top filter is "Start ~ End". 
    // The calendar arrows usually just navigate the *calendar view*. 
    // If we want to show attendance for the navigated month, we must have that data.

    // OPTION: Fetch a wider range (e.g. 1 year)? or Fetch on navigation?
    // Let's implement: Fetch on navigation only if needed?
    // Simplest: `changeModalMonth` updates `modalCurrentCalendarDate` AND calls `loadModalMemberHistory`? 
    // No, `loadModalMemberHistory` reads from the DOM inputs.

    // Correct approach matching `attendance.html`:
    // The calendar navigation there updates the *view*. The data is usually "search period".
    // If the search period is "2023-11-01 ~ 2023-11-30", then the calendar only shows marks for Nov.
    // If user clicks "Next" to Dec, it handles the view. If data is not there, it's empty.
    // BUT, usually users expect to see data.

    // Let's stick to the current flow:
    // 1. Filter determines the "History List" and "Stats".
    // 2. Calendar visualizes the attendance *within* that loaded data.
    // 3. Arrows just move the calendar view (month).

    let url = `${API_BASE}/franchise/stats/${franchiseId}/members/${modalCurrentMemberId}?period=${period}&date=${date}`;
    let start, end;

    if (period === 'custom') {
        end = document.getElementById('modalEndDate').value;
        start = date;
        url = `${API_BASE}/franchise/stats/${franchiseId}/members/${modalCurrentMemberId}/history?start_date=${start}&end_date=${end}`;
    } else {
        const dates = calculateDateRange(date, period);
        start = dates.start;
        end = dates.end;
        url = `${API_BASE}/franchise/stats/${franchiseId}/members/${modalCurrentMemberId}/history?start_date=${start}&end_date=${end}`;
    }

    try {
        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        const tbody = document.getElementById('modalHistoryListBody');
        tbody.innerHTML = '';

        // Validate data
        if (!Array.isArray(data)) {
            console.error('Invalid attendance data:', data);
            tbody.innerHTML = '<tr><td colspan="2" style="text-align: center;">데이터를 불러올 수 없습니다.</td></tr>';
            return;
        }

        // Store data for calendar
        modalCurrentAttendanceData = data;

        // Update stats
        const count = data.length;
        // Removed modalAttendanceCount update as element was deleted
        document.getElementById('modalPeriodAttendanceCount').textContent = `${count}회`;

        // Update Period Info
        const pStart = new URL(url, window.location.origin).searchParams.get('start_date') || start;
        const pEnd = new URL(url, window.location.origin).searchParams.get('end_date') || end;
        document.getElementById('modalPeriodInfo').innerHTML = `<span style="font-size: 14px; font-weight: bold; color: #555;">${pStart} ~ ${pEnd}</span>`;

        // Render Calendar
        renderModalCalendar();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">이력이 없습니다.</td></tr>';
            return;
        }

        data.forEach(h => {
            const row = document.createElement('tr');
            row.innerHTML = `
                        <td>${new Date(h.attended_at).toLocaleString()}</td>
                        <td>${h.store_name}</td>
                        <td>${h.status === 'attended' ? '출석' : h.status}</td>
                    `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Modal History load failed:', error);
    }
}

function calculateDateRange(dateStr, period) {
    const date = new Date(dateStr);
    let start, end;
    const y = date.getFullYear();
    const m = date.getMonth();

    if (period === 'daily') {
        start = dateStr;
        end = dateStr;
    } else if (period === 'weekly') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date);
        monday.setDate(diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        start = toYMD(monday);
        end = toYMD(sunday);
    } else if (period === 'monthly') {
        start = toYMD(new Date(y, m, 1));
        end = toYMD(new Date(y, m + 1, 0));
    } else if (period === 'yearly') {
        start = `${y}-01-01`;
        end = `${y}-12-31`;
    } else {
        start = dateStr;
        end = document.getElementById('modalEndDate').value;
    }
    return { start, end };
}

function toYMD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function changeModalMonth(delta) {
    const period = document.getElementById('modalPeriod') ? document.getElementById('modalPeriod').value : 'monthly';

    if (period === 'yearly') {
        // In yearly mode, maybe navigation changes the year?
        // For now, let's assume the top date picker handles year changes.
        // Or if needed, delta +/- 1 year.
        // The current input `modalDate` is `YYYY-MM-DD`.
        // If we want to support year navigation via arrows, we update the year.
        modalCurrentCalendarDate.setFullYear(modalCurrentCalendarDate.getFullYear() + delta);
    } else {
        modalCurrentCalendarDate.setMonth(modalCurrentCalendarDate.getMonth() + delta);
    }
    renderModalCalendar();
}

function renderModalCalendar() {
    const period = document.getElementById('modalPeriod') ? document.getElementById('modalPeriod').value : 'monthly';
    const calendarHeader = document.querySelector('.calendar-header');
    const calendarBody = document.getElementById('modalCalendarBody');

    if (period === 'yearly') {
        if (calendarHeader) calendarHeader.style.display = 'none'; // Hide monthly nav
        renderYearlyCalendar();
    } else {
        if (calendarHeader) calendarHeader.style.display = 'flex'; // Show monthly nav
        renderMonthlyCalendar();
    }
}

function renderMonthlyCalendar() {
    const year = modalCurrentCalendarDate.getFullYear();
    const month = modalCurrentCalendarDate.getMonth();

    document.getElementById('modalCalendarTitle').textContent = `${year}년 ${month + 1}월`;

    const calendarBody = document.getElementById('modalCalendarBody');
    calendarBody.innerHTML = '';

    // Reset grid for monthly view
    calendarBody.style.display = 'grid';
    calendarBody.style.gridTemplateColumns = 'repeat(7, 1fr)';
    calendarBody.style.gap = '5px';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDayOfWeek = firstDay.getDay();

    // Headers
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    let html = '';

    weekDays.forEach((day, index) => {
        const color = index === 0 ? '#e74c3c' : (index === 6 ? '#3498db' : '#333');
        html += `<div style="text-align: center; font-weight: bold; padding: 10px 0; color: ${color};">${day}</div>`;
    });

    // Empty slots
    for (let i = 0; i < startDayOfWeek; i++) {
        html += `<div class="calendar-day empty"></div>`;
    }

    // Attendance Map
    const attendanceMap = {};
    if (modalCurrentAttendanceData) {
        modalCurrentAttendanceData.forEach(item => {
            const dStr = item.attended_at || item.created_at;
            if (dStr) {
                const d = new Date(dStr);
                // Check strictly if it matches current year/month to be safe, though filtered data implies it.
                if (d.getFullYear() === year && d.getMonth() === month) {
                    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                    if (!attendanceMap[k]) attendanceMap[k] = 0;
                    attendanceMap[k]++;
                }
            }
        });
    }

    const today = new Date();
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dayDate = new Date(year, month, d);
        const dayKey = `${year}-${month}-${d}`;
        const count = attendanceMap[dayKey];

        const isToday = (today.getFullYear() === year && today.getMonth() === month && today.getDate() === d);
        const dayOfWeek = dayDate.getDay();

        let bgColor = '#fff';
        let border = '1px solid #f0f0f0';

        if (count) {
            bgColor = '#2ecc71';
            border = '1px solid #2ecc71';
        } else if (isToday) {
            border = '1px solid #3498db';
        }

        const numColor = count ? '#fff' : (dayOfWeek === 0 ? '#e74c3c' : (dayOfWeek === 6 ? '#3498db' : '#333'));

        html += `
                    <div class="calendar-day" style="
                        min-height: 60px;
                        border: ${border};
                        padding: 5px;
                        border-radius: 5px;
                        background-color: ${bgColor};
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                    ">
                        <span style="font-weight: bold; color: ${numColor}; margin-bottom: 2px; font-size: 14px;">${d}</span>
                        ${count ? `<span style="font-size: 16px; font-weight: 800; color: #fff;">${count}회</span>` : ''}
                    </div>
                `;
    }

    // Pad end
    const remainingCells = 7 - ((startDayOfWeek + lastDay.getDate()) % 7);
    if (remainingCells < 7) {
        for (let i = 0; i < remainingCells; i++) {
            html += `<div class="calendar-day empty"></div>`;
        }
    }

    calendarBody.innerHTML = html;
}

function renderYearlyCalendar() {
    const year = modalCurrentCalendarDate.getFullYear();
    const calendarBody = document.getElementById('modalCalendarBody');

    calendarBody.innerHTML = '';
    // Yearly Grid: 3 columns (matching the image)
    // Use auto-fit or fixed 3 columns? Image shows 3 columns clearly.
    calendarBody.style.display = 'grid';
    calendarBody.style.gridTemplateColumns = 'repeat(3, 1fr)';
    calendarBody.style.gap = '20px';

    // Generate map for the WHOLE year
    const attendanceMap = {};
    if (modalCurrentAttendanceData) {
        modalCurrentAttendanceData.forEach(item => {
            const dStr = item.attended_at || item.created_at;
            if (dStr) {
                const d = new Date(dStr);
                // Filter for current render year
                if (d.getFullYear() === year) {
                    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                    if (!attendanceMap[k]) attendanceMap[k] = 0;
                    attendanceMap[k]++;
                }
            }
        });
    }

    for (let m = 0; m < 12; m++) {
        const firstDay = new Date(year, m, 1);
        const lastDay = new Date(year, m + 1, 0);
        const startDayOfWeek = firstDay.getDay();

        // Create Month Card
        const monthCard = document.createElement('div');
        monthCard.className = 'month-card';
        monthCard.style.border = '1px solid #e0e0e0';
        monthCard.style.borderRadius = '8px';
        monthCard.style.padding = '15px';
        monthCard.style.backgroundColor = '#fff';

        // Header with arrows (Visual mostly, per image)
        let headerHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <span style="cursor: pointer;">◀</span>
                        <span style="font-weight: bold; font-size: 16px; color: #333;">${year}년 ${m + 1}월</span>
                        <span style="cursor: pointer;">▶</span>
                    </div>
                `;

        // Days Grid (Mini)
        let gridHtml = `<div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; gap: 2px;">`;

        // Weekday Headers
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        weekDays.forEach((day, idx) => {
            const color = idx === 0 ? '#e74c3c' : (idx === 6 ? '#3498db' : '#333');
            gridHtml += `<div style="font-size: 12px; font-weight: bold; color: ${color}; padding: 5px 0;">${day}</div>`;
        });

        // Empty slots
        for (let i = 0; i < startDayOfWeek; i++) {
            gridHtml += `<div></div>`;
        }

        // Days
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dayKey = `${year}-${m}-${d}`;
            const count = attendanceMap[dayKey];
            const dayDate = new Date(year, m, d);
            const dayOfWeek = dayDate.getDay();

            let bg = '#f8f9fa';
            let fg = '#333';
            if (count) {
                bg = '#2ecc71'; // Green for attended
                fg = '#fff';
            }

            // Simple styling for mini calendar days
            const numColor = count ? '#fff' : (dayOfWeek === 0 ? '#e74c3c' : (dayOfWeek === 6 ? '#3498db' : '#333'));

            gridHtml += `
                        <div style="
                            padding: 8px 0; 
                            font-size: 13px; 
                            background: ${count ? '#2ecc71' : '#f8f9fa'}; 
                            color: ${count ? '#fff' : numColor};
                            border-radius: 4px;
                            margin: 1px;
                        ">${d}</div>
                    `;
        }

        gridHtml += `</div>`; // Close grid

        monthCard.innerHTML = headerHtml + gridHtml;
        calendarBody.appendChild(monthCard);
    }
}

// --- 4. New Members ---
async function loadNewMembers() {
    const franchiseId = superAdminMode ? targetFranchiseId : franchiseData.id;
    const start = document.getElementById('newMemStartDate').value;
    const end = document.getElementById('newMemEndDate').value;
    const storeId = document.getElementById('newMemStoreFilter').value;

    try {
        let url = `${API_BASE}/franchise/stats/${franchiseId}/members/new?start_date=${start}&end_date=${end}`;
        if (storeId) url += `&store_id=${storeId}`;

        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        const tbody = document.getElementById('newMembersBody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">신규 회원이 없습니다.</td></tr>';
            return;
        }

        data.forEach(m => {
            const row = document.createElement('tr');
            row.innerHTML = `
                        <td data-label="이름">${m.name}</td>
                        <td data-label="전화번호" style="font-weight: bold; font-family: monospace; font-size: 15px;">${m.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</td>
                        <td data-label="가입일시">${new Date(m.created_at).toLocaleString()}</td>
                        <td data-label="가입매장">${m.store_name}</td>
                        <td data-label="선택">
                            <button class="btn btn-sm btn-outline" onclick="openMemberDetailModal(${m.id}, '${m.name}', '${m.phone}')">선택</button>
                        </td>
                     `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('New members load failed:', error);
    }
}

// --- 5. Attendance Ranking ---
async function loadAttendanceRanking() {
    const franchiseId = superAdminMode ? targetFranchiseId : franchiseData.id;
    const start = document.getElementById('rankStartDate').value;
    const end = document.getElementById('rankEndDate').value;
    const storeId = document.getElementById('rankStoreFilter').value;

    try {
        let url = `${API_BASE}/franchise/stats/${franchiseId}/attendance/ranking?start_date=${start}&end_date=${end}&limit=20`;
        if (storeId) url += `&store_id=${storeId}`;

        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();

        const tbody = document.getElementById('attendanceRankingBody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">데이터가 없습니다.</td></tr>';
            return;
        }

        data.forEach((r, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                        <td data-label="순위">${index + 1}</td>
                        <td data-label="이름">${r.name}</td>
                        <td data-label="전화번호" style="font-weight: bold; font-family: monospace; font-size: 15px;">${r.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</td>
                        <td data-label="출석횟수"><b>${r.attendance_count}회</b></td>
                        <td data-label="최근 출석">${r.last_attended_at ? new Date(r.last_attended_at).toLocaleDateString() : '-'}</td>
                        <td data-label="매장">${r.store_name || '-'}</td>
                        <td data-label="선택">
                            <button class="btn btn-sm btn-outline" onclick="openMemberDetailModal(${r.member_id}, '${r.name}', '${r.phone}')">선택</button>
                        </td>
                     `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Ranking load failed:', error);
    }
}

// Init
init();
