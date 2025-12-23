const API_BASE = '/api/system';
let franchisesData = [];
let statsData = null;
let currentAnalyticsPeriod = 'hourly';

// 토큰 가져오기
function getToken() {
    return localStorage.getItem('access_token');
}

// API 요청 헤더
function getHeaders() {
    return {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
    };
}

// 통계 로드
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`, {
            headers: getHeaders()
        });

        if (response.ok) {
            statsData = await response.json();
            updateStatsOverview();
        } else {
            const error = await response.json();
            alert(error.detail || '통계 로드 실패');
        }
    } catch (error) {
        console.error('통계 로드 실패:', error);
    }
}

// 통계 개요 업데이트
function updateStatsOverview() {
    const overview = document.getElementById('statsOverview');
    if (!overview) return;

    overview.innerHTML = `
        <div class="stat-card" onclick="showView('franchises')">
            <div class="stat-label">프랜차이즈</div>
            <div class="stat-value">${statsData.active_franchises} <span style="font-size: 16px; color: var(--toss-gray-400);">/ ${statsData.total_franchises}</span></div>
            <div class="stat-change up"><i class="fas fa-check-circle"></i> 활성 상태</div>
        </div>
        <div class="stat-card" onclick="showView('stores')">
            <div class="stat-label">운영 매장</div>
            <div class="stat-value">${statsData.active_stores} <span style="font-size: 16px; color: var(--toss-gray-400);">/ ${statsData.total_stores}</span></div>
            <div class="stat-change up"><i class="fas fa-store"></i> 로컬 운영 중</div>
        </div>
        <div class="stat-card" onclick="showView('users')">
            <div class="stat-label">관리자 계정</div>
            <div class="stat-value">${statsData.active_users} <span style="font-size: 16px; color: var(--toss-gray-400);">/ ${statsData.total_users}</span></div>
            <div class="stat-change up"><i class="fas fa-user-shield"></i> 권한 관리 활성</div>
        </div>
        <div class="stat-card" onclick="showView('members')">
            <div class="stat-label">전체 회원</div>
            <div class="stat-value">${statsData.total_members.toLocaleString()}</div>
            <div class="stat-change up"><i class="fas fa-users"></i> 누적 가입자</div>
        </div>
    `;
}

// 프랜차이즈 목록 로드
async function loadFranchises() {
    try {
        const response = await fetch(`${API_BASE}/franchises`, {
            headers: getHeaders()
        });

        if (response.ok) {
            franchisesData = await response.json();
            updateFranchisesGrid();
        } else {
            const error = await response.json();
            alert(error.detail || '프랜차이즈 목록 로드 실패');
        }
    } catch (error) {
        console.error('프랜차이즈 목록 로드 실패:', error);
    }
}

// 프랜차이즈 그리드 업데이트
function updateFranchisesGrid() {
    const grid = document.getElementById('franchisesGrid');
    if (!grid) return;

    if (franchisesData.length === 0) {
        grid.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">등록된 프랜차이즈가 없습니다.</td></tr>';
        return;
    }

    // 통계 업데이트
    const activeCount = franchisesData.filter(f => f.is_active).length;
    document.getElementById('totalFranchiseCount').textContent = franchisesData.length;
    document.getElementById('activeFranchiseCount').textContent = activeCount;
    document.getElementById('inactiveFranchiseCount').textContent = franchisesData.length - activeCount;

    grid.innerHTML = '';

    franchisesData.forEach(franchise => {
        const stats = statsData?.franchises?.find(f => f.franchise_id === franchise.id);
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td style="font-weight: 700;">${franchise.name}</td>
            <td><code style="background: var(--toss-gray-100); padding: 2px 6px; border-radius: 4px;">${franchise.code}</code></td>
            <td>${stats?.stores_count || 0}개 매장</td>
            <td>
                <span class="status-pill ${franchise.is_active ? 'active' : 'inactive'}">
                    ${franchise.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="toss-btn toss-btn-outline" onclick="manageFranchise(${franchise.id}, '${franchise.name}')">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="toss-btn toss-btn-secondary" onclick="showEditFranchiseModal(${franchise.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${franchise.is_active
                ? `<button class="toss-btn toss-btn-outline" style="color: var(--toss-red);" onclick="deactivateFranchise(${franchise.id})"><i class="fas fa-lock"></i></button>`
                : `<button class="toss-btn toss-btn-primary" onclick="activateFranchise(${franchise.id})"><i class="fas fa-unlock"></i></button>`
            }
                </div>
            </td>
        `;
        grid.appendChild(tr);
    });
}

// 프랜차이즈 필터링
function filterFranchises(query) {
    const q = (query || '').toLowerCase();
    const grid = document.getElementById('franchisesGrid');
    if (!grid) return;

    const filtered = franchisesData.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
        grid.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">검색 결과가 없습니다.</td></tr>';
        return;
    }

    grid.innerHTML = '';
    filtered.forEach(franchise => {
        const stats = statsData?.franchises?.find(f => f.franchise_id === franchise.id);
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td style="font-weight: 700;">${franchise.name}</td>
            <td><code style="background: var(--toss-gray-100); padding: 2px 6px; border-radius: 4px;">${franchise.code}</code></td>
            <td>${stats?.stores_count || 0}개 매장</td>
            <td>
                <span class="status-pill ${franchise.is_active ? 'active' : 'inactive'}">
                    ${franchise.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="toss-btn toss-btn-outline" onclick="manageFranchise(${franchise.id}, '${franchise.name}')">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="toss-btn toss-btn-secondary" onclick="showEditFranchiseModal(${franchise.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${franchise.is_active
                ? `<button class="toss-btn toss-btn-outline" style="color: var(--toss-red);" onclick="deactivateFranchise(${franchise.id})"><i class="fas fa-lock"></i></button>`
                : `<button class="toss-btn toss-btn-primary" onclick="activateFranchise(${franchise.id})"><i class="fas fa-unlock"></i></button>`
            }
                </div>
            </td>
        `;
        grid.appendChild(tr);
    });
}

// 매장 목록 토글
async function toggleStores(franchiseId) {
    const storesSection = document.getElementById(`stores-${franchiseId}`);

    if (storesSection.classList.contains('show')) {
        storesSection.classList.remove('show');
    } else {
        // 매장 목록 로드
        await loadFranchiseStores(franchiseId);
        storesSection.classList.add('show');
    }
}

// 특정 프랜차이즈의 매장 목록 로드
async function loadFranchiseStores(franchiseId) {
    const storesList = document.getElementById(`stores-list-${franchiseId}`);

    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}/stores`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const stores = await response.json();

            if (stores.length === 0) {
                storesList.innerHTML = '<p style="text-align: center; color: #999;">등록된 매장이 없습니다.</p>';
                return;
            }

            storesList.innerHTML = stores.map(store => `
                <div class="store-item">
                    <div class="store-info">
                        <div class="store-name">${store.name}</div>
                        <div class="store-code">코드: ${store.code}</div>
                    </div>
                    <span class="badge ${store.is_active ? 'active' : 'inactive'}">
                        ${store.is_active ? '활성' : '비활성'}
                    </span>
                </div>
            `).join('');
        } else {
            storesList.innerHTML = '<p style="text-align: center; color: #e74c3c;">매장 목록을 불러올 수 없습니다.</p>';
        }
    } catch (error) {
        console.error('매장 목록 로드 실패:', error);
        storesList.innerHTML = '<p style="text-align: center; color: #e74c3c;">오류가 발생했습니다.</p>';
    }
}

// 모달 관리
function showAddFranchiseModal() {
    document.getElementById('addFranchiseModal').classList.add('show');
}

function showEditFranchiseModal(franchiseId) {
    const franchise = franchisesData.find(f => f.id === franchiseId);
    if (!franchise) return;

    document.getElementById('editFranchiseId').value = franchise.id;
    document.getElementById('editFranchiseName').value = franchise.name;
    document.getElementById('editFranchiseCode').value = franchise.code;
    document.getElementById('editFranchiseModal').classList.add('show');
}

async function showAddAdminModal(franchiseId, franchiseName) {
    document.getElementById('adminFranchiseId').value = franchiseId;
    document.getElementById('adminFranchiseName').textContent = franchiseName;

    // 초기화
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminRole').value = 'franchise_admin';
    toggleAdminStoreSelect();

    // 매장 목록 로드
    const storeSelect = document.getElementById('adminStoreId');
    const storeMultiContainer = document.getElementById('adminStoreMultiSelectContainer');

    storeSelect.innerHTML = '<option value="">로딩 중...</option>';
    // Check if storeMultiContainer exists (it should now)
    if (storeMultiContainer) {
        storeMultiContainer.innerHTML = '<p style="color: #999;">로딩 중...</p>';
    }

    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}/stores`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const stores = await response.json();

            // Single Select Populate
            storeSelect.innerHTML = '<option value="">매장을 선택하세요</option>';
            stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.id;
                option.textContent = `${store.name} (${store.code})`;
                storeSelect.appendChild(option);
            });

            // Multi Select Populate
            if (storeMultiContainer) {
                storeMultiContainer.innerHTML = '';
                if (stores.length === 0) {
                    storeMultiContainer.innerHTML = '<p style="color: #999;">등록된 매장이 없습니다.</p>';
                } else {
                    stores.forEach(store => {
                        const div = document.createElement('div');
                        div.style.marginBottom = '5px';
                        div.innerHTML = `
                            <label style="display: flex; align-items: center; cursor: pointer; font-weight: normal;">
                                <input type="checkbox" value="${store.id}" style="width: auto; margin-right: 8px;">
                                ${store.name} (${store.code})
                            </label>
                        `;
                        storeMultiContainer.appendChild(div);
                    });
                }
            }

        } else {
            storeSelect.innerHTML = '<option value="">매장 목록 로드 실패</option>';
            if (storeMultiContainer) storeMultiContainer.innerHTML = '<p style="color: red;">매장 목록 로드 실패</p>';
        }
    } catch (error) {
        console.error('매장 목록 로드 실패:', error);
        storeSelect.innerHTML = '<option value="">오류 발생</option>';
        if (storeMultiContainer) storeMultiContainer.innerHTML = '<p style="color: red;">오류 발생</p>';
    }

    document.getElementById('addAdminModal').classList.add('show');
}

function toggleAdminStoreSelect() {
    const role = document.getElementById('adminRole').value;
    const storeGroup = document.getElementById('adminStoreSelectGroup');
    const storeSelect = document.getElementById('adminStoreId');
    const multiStoreGroup = document.getElementById('adminStoreMultiSelectGroup');

    // Reset visibility
    storeGroup.style.display = 'none';
    if (multiStoreGroup) multiStoreGroup.style.display = 'none';
    storeSelect.required = false;

    if (role === 'store_admin') {
        storeGroup.style.display = 'block';
        storeSelect.required = true;
    } else if (role === 'franchise_manager') {
        if (multiStoreGroup) multiStoreGroup.style.display = 'block';
    } else {
        // franchise_admin
        storeSelect.value = '';
    }
}

function showMemberSettingsModal(franchiseId, franchiseName, memberType) {
    document.getElementById('memberSettingsFranchiseId').value = franchiseId;
    document.getElementById('memberSettingsFranchiseName').textContent = franchiseName;

    // 현재 설정값 선택
    const radioButtons = document.querySelectorAll('input[name="memberType"]');
    radioButtons.forEach(radio => {
        radio.checked = (radio.value === memberType);
        // 선택된 항목 스타일 업데이트
        const label = radio.closest('.radio-option');
        if (radio.checked) {
            label.style.borderColor = '#667eea';
            label.style.backgroundColor = '#f0f4ff';
        } else {
            label.style.borderColor = '#e5e7eb';
            label.style.backgroundColor = 'white';
        }
    });

    document.getElementById('memberSettingsModal').classList.add('show');
}

function showAddStoreModal(franchiseId, franchiseName) {
    document.getElementById('storeFranchiseId').value = franchiseId;
    document.getElementById('storeFranchiseName').textContent = franchiseName;
    document.getElementById('addStoreModal').classList.add('show');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = ''; // Clear inline styles (important for some modals)
    }
}

// 프랜차이즈 추가
document.getElementById('addFranchiseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        name: document.getElementById('franchiseName').value,
        code: document.getElementById('franchiseCode').value
    };

    try {
        const response = await fetch(`${API_BASE}/franchises`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('프랜차이즈가 추가되었습니다.');
            closeModal('addFranchiseModal');
            document.getElementById('addFranchiseForm').reset();
            await loadFranchises();
            await loadStats();
        } else {
            const error = await response.json();
            alert(error.detail || '프랜차이즈 추가 실패');
        }
    } catch (error) {
        console.error('프랜차이즈 추가 실패:', error);
        alert('프랜차이즈 추가 중 오류가 발생했습니다.');
    }
});

// 프랜차이즈 수정
document.getElementById('editFranchiseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const franchiseId = document.getElementById('editFranchiseId').value;
    const data = {
        name: document.getElementById('editFranchiseName').value,
        code: document.getElementById('editFranchiseCode').value
    };

    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('프랜차이즈가 수정되었습니다.');
            closeModal('editFranchiseModal');
            await loadFranchises();
        } else {
            const error = await response.json();
            alert(error.detail || '프랜차이즈 수정 실패');
        }
    } catch (error) {
        console.error('프랜차이즈 수정 실패:', error);
        alert('프랜차이즈 수정 중 오류가 발생했습니다.');
    }
});

// 프랜차이즈 관리자 추가
document.getElementById('addAdminForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const franchiseId = document.getElementById('adminFranchiseId').value;
    const role = document.getElementById('adminRole').value;
    const storeId = document.getElementById('adminStoreId').value;

    const data = {
        username: document.getElementById('adminUsername').value,
        password: document.getElementById('adminPassword').value,
        role: role,
        franchise_id: parseInt(franchiseId),
        store_id: null,
        managed_store_ids: []
    };

    if (role === 'store_admin') {
        if (!storeId) {
            showNotification('매장을 선택해주세요.', '경고');
            return;
        }
        data.store_id = parseInt(storeId);
    } else if (role === 'franchise_manager') {
        const checkboxes = document.querySelectorAll('#adminStoreMultiSelectContainer input[type="checkbox"]:checked');
        const storeIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        if (storeIds.length === 0) {
            showNotification('최소 하나 이상의 매장을 선택해주세요.', '경고');
            return;
        }
        data.managed_store_ids = storeIds;
    }

    try {
        // 엔드포인트 변경: /users (범용 사용자 생성)
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeModal('addAdminModal');
            document.getElementById('addAdminForm').reset();
            await loadStats();
            showNotification('관리자가 생성되었습니다.');
        } else {
            const error = await response.json();
            showNotification(error.detail || '관리자 생성 실패', '오류');
        }
    } catch (error) {
        console.error('관리자 생성 실패:', error);
        showNotification('관리자 생성 중 오류가 발생했습니다.', '오류');
    }
});

async function openEditStoreNameModal(storeId, currentName) {
    document.getElementById('editStoreNameId').value = storeId;
    document.getElementById('editOtherStoreName').value = currentName;
    document.getElementById('editStoreAdminPassword').value = '로딩중...'; // Temporary placeholder

    document.getElementById('editStoreNameModal').classList.add('show');

    // Fetch current settings (for password)
    try {
        const response = await fetch(`/api/system/stores/${storeId}/settings`, { headers: getHeaders() });
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('editStoreAdminPassword').value = settings.admin_password || '';
        } else {
            console.error('Failed to load settings');
            document.getElementById('editStoreAdminPassword').value = '';
        }
    } catch (e) {
        console.error(e);
        document.getElementById('editStoreAdminPassword').value = '';
    }

    // 포커스
    setTimeout(() => document.getElementById('editOtherStoreName').focus(), 100);
}

// 매장 정보 수정 (Name & Settings)
document.getElementById('editStoreNameForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const storeId = document.getElementById('editStoreNameId').value;
    const newName = document.getElementById('editOtherStoreName').value;
    const newPassword = document.getElementById('editStoreAdminPassword').value;

    if (!newName.trim()) {
        showNotification('매장명을 입력해주세요.', '⚠️');
        return;
    }

    try {
        // 1. Update Store Name (Store Model)
        const nameResponse = await fetch(`${API_BASE}/stores/${storeId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ name: newName })
        });

        if (!nameResponse.ok) {
            throw new Error('매장명 변경 실패');
        }

        // 2. Update Store Settings (Password)
        if (newPassword) {
            const settingsResponse = await fetch(`/api/system/stores/${storeId}/settings`, {
                method: 'PUT',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ admin_password: newPassword, store_name: newName })
            });

            if (!settingsResponse.ok) {
                throw new Error('설정(비밀번호) 변경 실패');
            }
        }

        showNotification('매장 정보가 수정되었습니다.', '✅');
        closeModal('editStoreNameModal');
        await loadStats();
        await loadFranchises();

    } catch (error) {
        console.error('매장 수정 실패:', error);
        showNotification(error.message || '매장 정보 수정 중 오류가 발생했습니다.', '❌');
    }
});

let maintenanceStoreId = null;

function openStoreMaintenanceModal(storeId, storeName) {
    maintenanceStoreId = storeId;
    document.getElementById('maintenanceStoreName').textContent = storeName;

    const modal = document.getElementById('storeMaintenanceModal');
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

async function performMaintenance(type) {
    if (!maintenanceStoreId) return;

    const confirmMsg = "초기화하려면 '삭제'를 입력하세요.\n이 작업은 절대 되돌릴 수 없습니다.";
    const userInput = prompt(confirmMsg);

    if (userInput !== '삭제') {
        if (userInput !== null) alert("입력값이 일치하지 않습니다.");
        return;
    }

    if (!confirm("정말로 삭제하시겠습니까?")) return;

    let endpoint = '';
    if (type === 'members') endpoint = `/api/system/stores/${maintenanceStoreId}/reset/members`;
    else if (type === 'waiting') endpoint = `/api/system/stores/${maintenanceStoreId}/reset/waiting`;
    else if (type === 'history') endpoint = `/api/system/stores/${maintenanceStoreId}/reset/history`;

    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (response.ok) {
            const result = await response.json();
            showNotification(result.message);
            closeModal('storeMaintenanceModal');
        } else {
            const error = await response.json();
            showNotification(error.detail || '초기화 실패', '오류');
        }
    } catch (error) {
        console.error('Maintenance error:', error);
        showNotification('작업 중 오류가 발생했습니다.', '오류');
    }
}

// 회원 관리 설정 저장
document.getElementById('memberSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const franchiseId = document.getElementById('memberSettingsFranchiseId').value;
    const memberType = document.querySelector('input[name="memberType"]:checked').value;

    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ member_type: memberType })
        });

        if (response.ok) {
            alert('회원 관리 설정이 저장되었습니다.');
            closeModal('memberSettingsModal');
            await loadFranchises();
        } else {
            const error = await response.json();
            alert(error.detail || '설정 저장 실패');
        }
    } catch (error) {
        console.error('설정 저장 실패:', error);
        alert('설정 저장 중 오류가 발생했습니다.');
    }
});

// 라디오 버튼 선택 시 스타일 업데이트
document.querySelectorAll('input[name="memberType"]').forEach(radio => {
    radio.addEventListener('change', function () {
        document.querySelectorAll('.radio-option').forEach(label => {
            label.style.borderColor = '#e5e7eb';
            label.style.backgroundColor = 'white';
        });
        if (this.checked) {
            const label = this.closest('.radio-option');
            label.style.borderColor = '#667eea';
            label.style.backgroundColor = '#f0f4ff';
        }
    });
});

// 매장 추가 모달 열기 (프랜차이즈 선택 가능)
function showAddStoreModalWithFranchiseSelect() {
    // 프랜차이즈 목록을 드롭다운에 채우기
    const select = document.getElementById('addStoreFranchiseSelect');
    select.innerHTML = '<option value="">프랜차이즈를 선택하세요</option>';

    franchisesData.filter(f => f.is_active).forEach(franchise => {
        const option = document.createElement('option');
        option.value = franchise.id;
        option.textContent = `${franchise.name} (${franchise.code})`;
        select.appendChild(option);
    });

    document.getElementById('addStoreModal').classList.add('show');
}

// 매장 추가
document.getElementById('addStoreForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const franchiseId = document.getElementById('addStoreFranchiseSelect').value;
    const name = document.getElementById('storeName').value;

    if (!franchiseId) {
        showNotification('프랜차이즈를 선택해주세요.', '오류');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}/stores`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name: name })
        });

        if (response.ok) {
            closeModal('addStoreModal');
            document.getElementById('addStoreForm').reset();
            // 매장 목록 및 통계 새로고침
            await loadStats();
            await loadAllStores(false);
            showNotification('매장이 추가되었습니다.');
        } else {
            const error = await response.json();
            showNotification(error.detail || '매장 추가 실패', '오류');
        }
    } catch (error) {
        console.error('매장 추가 실패:', error);
        showNotification('매장 추가 중 오류가 발생했습니다.', '오류');
    }
});

// 프랜차이즈 비활성화
async function deactivateFranchise(franchiseId) {
    if (!confirm('이 프랜차이즈를 비활성화하시겠습니까?')) return;

    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (response.status === 204) {
            alert('프랜차이즈가 비활성화되었습니다.');
            await loadFranchises();
            await loadStats();
        } else {
            const error = await response.json();
            alert(error.detail || '프랜차이즈 비활성화 실패');
        }
    } catch (error) {
        console.error('프랜차이즈 비활성화 실패:', error);
    }
}

// 프랜차이즈 활성화
async function activateFranchise(franchiseId) {
    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}/activate`, {
            method: 'POST',
            headers: getHeaders()
        });

        if (response.ok) {
            alert('프랜차이즈가 활성화되었습니다.');
            await loadFranchises();
            await loadStats();
        } else {
            const error = await response.json();
            alert(error.detail || '프랜차이즈 활성화 실패');
        }
    } catch (error) {
        console.error('프랜차이즈 활성화 실패:', error);
    }
}

// 프랜차이즈 관리 화면으로 이동 (새 탭)
function manageFranchise(franchiseId, franchiseName) {
    // 프랜차이즈 정보를 localStorage에 임시 저장 (새 탭에서 사용)
    const franchiseInfo = {
        id: franchiseId,
        name: franchiseName,
        isSuperAdmin: true
    };
    localStorage.setItem('superadmin_franchise_context', JSON.stringify(franchiseInfo));

    // 새 탭에서 프랜차이즈 관리 페이지 열기
    window.open(`/admin?franchise_id=${franchiseId}`, '_blank');
}

// 로그아웃 (logout.js에서 처리)


// ========== Dashboard 2.0 Logic ==========

let allUsersData = [];

// --- Navigation & View Management ---

function hideAllViews() {
    // Hide dashboard containers
    const containers = [
        'statsOverviewContainer',
        'healthDashboardContainer',
        'loginMonitorContainer',
        'analyticsDashboardContainer'
    ];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Hide management views
    document.querySelectorAll('.admin-view').forEach(el => el.classList.remove('active'));

    // Hide views container if specifically needed, but usually we just switch active views inside it
    const viewsContainer = document.getElementById('views-container');
    if (viewsContainer) viewsContainer.style.display = 'none';

    // Deactivate sidebar nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
}

function updateViewHeader(title) {
    const headerTitle = document.getElementById('currentViewTitle');
    if (headerTitle) headerTitle.textContent = title;
}

function showDashboard(type) {
    hideAllViews();

    if (type === 'summary') {
        document.getElementById('statsOverviewContainer').style.display = 'block';
        updateViewHeader('종합 현황');
        const navItem = document.querySelector('.nav-item[onclick*="showDashboard(\'summary\')"]');
        if (navItem) navItem.classList.add('active');
        loadStats();
    }
}

async function showView(viewId) {
    hideAllViews();

    const viewsContainer = document.getElementById('views-container');
    if (viewsContainer) viewsContainer.style.display = 'block';

    const viewEl = document.getElementById(`view-${viewId}`);
    if (viewEl) viewEl.classList.add('active');

    const navItem = document.querySelector(`.nav-item[onclick*="showView('${viewId}')"]`);
    if (navItem) navItem.classList.add('active');

    switch (viewId) {
        case 'franchises':
            updateViewHeader('프랜차이즈 관리');
            await loadFranchises();
            break;
        case 'stores':
            updateViewHeader('가맹점 관리');
            await loadAllStores(false);
            break;
        case 'users':
            updateViewHeader('사용자 계정 관리');
            await loadAllUsers();
            break;
        case 'members':
            updateViewHeader('전체 회원 조회');
            await handleMemberSearch();
            break;
    }
    previousActiveView = viewId;
}

function toggleDashboard(type) {
    hideAllViews();

    const navItem = document.querySelector(`.nav-item[onclick*="toggleDashboard('${type}')"]`);
    if (navItem) navItem.classList.add('active');

    switch (type) {
        case 'analytics':
            updateViewHeader('데이터 분석 리포트');
            const analyticsContainer = document.getElementById('analyticsDashboardContainer');
            if (analyticsContainer) {
                analyticsContainer.style.display = 'block';
                loadAnalytics();
            }
            break;
        case 'health':
            updateViewHeader('시스템 서버 헬스');
            const healthContainer = document.getElementById('healthDashboardContainer');
            if (healthContainer) {
                healthContainer.style.display = 'block';
                loadStoreHealth();
            }
            break;
        case 'login':
            updateViewHeader('사용자 로그인 모니터링');
            const loginContainer = document.getElementById('loginMonitorContainer');
            if (loginContainer) {
                loginContainer.style.display = 'block';
                loadLoginMonitor();
            }
            break;
    }
}

// --- Franchise View Logic ---
function toggleFranchiseView(mode) {
    const grid = document.getElementById('franchisesGrid');
    const cards = grid.getElementsByClassName('franchise-card');

    Array.from(cards).forEach(card => {
        if (mode === 'active') {
            const badge = card.querySelector('.badge');
            if (badge.classList.contains('inactive')) {
                card.style.display = 'none';
            } else {
                card.style.display = 'block';
            }
        } else {
            card.style.display = 'block';
        }
    });
}


// --- User View Logic ---
async function loadAllUsers() {
    const tbody = document.getElementById('usersContainer');
    if (!tbody) {
        console.error('usersContainer not found');
        return;
    }
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">로딩 중...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/users`, { headers: getHeaders() });
        if (response.ok) {
            allUsersData = await response.json();
            renderUsersTable(allUsersData);
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">데이터 로드 실패</td></tr>';
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">오류 발생</td></tr>';
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersContainer');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">사용자가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td><strong>${user.username}</strong></td>
            <td><span class="status-pill" style="background: var(--toss-gray-100); color: var(--toss-gray-700);">${getRoleName(user.role)}</span></td>
            <td>${user.franchise_name || '<span style="color: var(--toss-gray-400);">-</span>'}</td>
            <td>${user.store_name || '<span style="color: var(--toss-gray-400);">-</span>'}</td>
            <td><span style="font-size: 13px; color: var(--toss-gray-500);">${user.last_login ? new Date(user.last_login).toLocaleString() : '기록 없음'}</span></td>
            <td>
                <span class="status-pill ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="toss-btn toss-btn-secondary" onclick="showEditUserModal(${user.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!['superadmin', 'superadmin123'].includes(user.username) ? `
                        ${user.is_active
                ? `<button class="toss-btn toss-btn-outline" style="color: var(--toss-red);" onclick="toggleUserStatus(${user.id}, true, '${user.username}')"><i class="fas fa-user-slash"></i></button>`
                : `<button class="toss-btn toss-btn-primary" onclick="toggleUserStatus(${user.id}, false, '${user.username}')"><i class="fas fa-user-check"></i></button>`
            }
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// Helper to get role name in Korean
function getRoleName(role) {
    const map = {
        'system_admin': '슈퍼관리자',
        'franchise_admin': '프랜차이즈 관리',
        'franchise_manager': '중간 관리자',
        'store_admin': '매장 관리자'
    };
    return map[role] || role;
}

function filterUsers(query) {
    const q = (query || document.getElementById('userSearch')?.value || '').toLowerCase();
    const filtered = allUsersData.filter(user =>
        user.username.toLowerCase().includes(q) ||
        (user.franchise_name && user.franchise_name.toLowerCase().includes(q)) ||
        (user.store_name && user.store_name.toLowerCase().includes(q)) ||
        (getRoleName(user.role).includes(q))
    );
    renderUsersTable(filtered);
}

// --- Edit User Logic ---
async function showEditUserModal(userId) {
    const user = allUsersData.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserUsername').value = user.username;
    document.getElementById('editUserPassword').value = ''; // Reset password
    document.getElementById('editUserRole').value = user.role;

    // Set Active Checkbox
    const activeCheckbox = document.getElementById('editUserIsActive');
    activeCheckbox.checked = user.is_active;

    // Protect superadmin
    if (['superadmin', 'superadmin123'].includes(user.username)) {
        activeCheckbox.disabled = true;
    } else {
        activeCheckbox.disabled = false;
    }

    // Populate Franchises
    const franchiseSelect = document.getElementById('editUserFranchiseId');
    franchiseSelect.innerHTML = '<option value="">프랜차이즈 선택</option>';

    if (franchisesData && franchisesData.length > 0) {
        franchisesData.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = `${f.name} (${f.code})`;
            franchiseSelect.appendChild(opt);
        });
    }
    if (user.franchise_id) franchiseSelect.value = user.franchise_id;

    // Load Store Data based on franchise
    if (user.role === 'store_admin' || user.role === 'franchise_manager') {
        if (user.franchise_id) {
            await loadEditUserStores(user.franchise_id, user.store_id, user.managed_stores || []);
        }
    }

    toggleEditUserStoreSelect();
    document.getElementById('editUserModal').classList.add('show');
}

async function loadEditUserStores(franchiseId, selectedStoreId, managedStores) {
    const storeSelect = document.getElementById('editUserStoreId');
    const multiStoreContainer = document.getElementById('editUserMultiStoreContainer');

    storeSelect.innerHTML = '<option value="">매장 선택</option>';
    multiStoreContainer.innerHTML = '';

    if (!franchiseId) return;

    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}/stores`, { headers: getHeaders() });
        if (response.ok) {
            const stores = await response.json();

            stores.forEach(s => {
                // Single Select
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = `${s.name} (${s.code})`;
                storeSelect.appendChild(opt);

                // Multi Select
                const div = document.createElement('div');
                div.style.marginBottom = '5px';
                const isChecked = managedStores.some(ms => ms.id === s.id);

                div.innerHTML = `
                     <label style="display: flex; align-items: center; cursor: pointer; font-weight: normal;">
                        <input type="checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} style="width: auto; margin-right: 8px;">
                        ${s.name}
                    </label>
                `;
                multiStoreContainer.appendChild(div);
            });

            if (selectedStoreId) {
                storeSelect.value = selectedStoreId;
            }
        }
    } catch (error) {
        console.error(error);
        storeSelect.innerHTML = '<option value="">로드 실패</option>';
    }
}

function toggleEditUserStoreSelect() {
    const role = document.getElementById('editUserRole').value;
    const singleDiv = document.getElementById('editUserStoreGroup'); // Changed from editUserSingleStoreDiv
    const multiDiv = document.getElementById('editUserMultiStoreGroup'); // Changed from editUserMultiStoreDiv
    const franchiseGroup = document.getElementById('editUserFranchiseGroup');

    // Reset
    franchiseGroup.style.display = 'none';
    singleDiv.style.display = 'none';
    multiDiv.style.display = 'none';

    if (role === 'system_admin') {
        // No franchise/store needed
    } else if (role === 'franchise_admin') {
        franchiseGroup.style.display = 'block';
    } else if (role === 'franchise_manager') {
        franchiseGroup.style.display = 'block';
        multiDiv.style.display = 'block';
    } else if (role === 'store_admin') {
        franchiseGroup.style.display = 'block';
        singleDiv.style.display = 'block';
    }
}

// Handle User Update
document.getElementById('editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('editUserId').value;
    const role = document.getElementById('editUserRole').value;
    const franchiseId = document.getElementById('editUserFranchiseId').value;
    const isActive = document.getElementById('editUserIsActive').checked;
    const username = document.getElementById('editUserUsername').value;

    if (['superadmin', 'superadmin123'].includes(username) && !isActive) {
        showNotification('슈퍼관리자 계정은 비활성화할 수 없습니다.', '경고');
        return;
    }

    const data = {
        role: role,
        franchise_id: franchiseId ? parseInt(franchiseId) : null,
        is_active: isActive
    };

    const password = document.getElementById('editUserPassword').value;
    if (password) data.password = password;

    if (role === 'store_admin') {
        const storeId = document.getElementById('editUserStoreId').value;
        if (!storeId) { showNotification('매장을 선택하세요', '경고'); return; }
        data.store_id = parseInt(storeId);
    } else if (role === 'franchise_manager') {
        const checkboxes = document.querySelectorAll('#editUserMultiStoreContainer input[type="checkbox"]:checked');
        const storeIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        data.managed_store_ids = storeIds;
    }

    try {
        const response = await fetch(`${API_BASE}/users/${userId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showNotification('사용자 정보가 수정되었습니다.');
            closeModal('editUserModal');
            await loadAllUsers();
        } else {
            const error = await response.json();
            showNotification(error.detail || '수정 실패', '오류');
        }
    } catch (error) {
        console.error(error);
        showNotification('오류 발생', '오류');
    }
});

let targetUserId = null;
let targetUserIsActive = null;

function toggleUserStatus(userId, currentIsActive, username) {
    targetUserId = userId;
    targetUserIsActive = currentIsActive;

    const action = currentIsActive ? '비활성화' : '활성화';
    document.getElementById('userStatusConfirmMessage').textContent = `'${username}' 사용자를 정말로 ${action} 하시겠습니까?`;

    const btn = document.getElementById('btnConfirmUserStatus');
    if (currentIsActive) {
        btn.className = 'toss-btn toss-btn-primary';
        btn.textContent = '비활성화';
    } else {
        btn.className = 'toss-btn toss-btn-primary';
        btn.textContent = '활성화';
    }

    document.getElementById('confirmUserStatusModal').classList.add('show');
}

function showNotification(message, title = '알림') {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    document.getElementById('notificationModal').classList.add('show');
}

async function confirmUserStatusChange() {
    if (targetUserId === null) return;

    try {
        let response;
        if (targetUserIsActive) {
            // Deactivate
            response = await fetch(`${API_BASE}/users/${targetUserId}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
        } else {
            // Activate
            response = await fetch(`${API_BASE}/users/${targetUserId}/activate`, {
                method: 'POST',
                headers: getHeaders()
            });
        }

        if (response.ok) {
            const action = targetUserIsActive ? '비활성화' : '활성화';
            closeModal('confirmUserStatusModal');
            await loadAllUsers();
            showNotification(`사용자가 ${action} 되었습니다.`);
        } else {
            let errorMsg = '처리 실패';
            try {
                const error = await response.json();
                errorMsg = error.detail || errorMsg;
            } catch (e) { }
            showNotification(errorMsg, '오류');
        }
    } catch (error) {
        console.error(error);
        showNotification('오류 발생', '오류');
    }
}

// --- Store View Logic ---
let allCachedStores = [];
let currentStoreFilter = 'all';

async function loadAllStores(statusFilter) {
    if (statusFilter !== undefined) currentStoreFilter = statusFilter;

    const container = document.getElementById('storesContainer');
    container.innerHTML = '<p style="text-align: center; padding: 20px;">로딩 중...</p>';

    try {
        const response = await fetch(`${API_BASE}/stores`, { headers: getHeaders() });
        if (response.ok) {
            allCachedStores = await response.json();

            // Populate franchise filter dropdown
            populateFranchiseFilter();

            filterStores();
        } else {
            container.innerHTML = '<p style="text-align: center; color: red;">매장 로드 실패</p>';
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align: center; color: red;">오류 발생</p>';
    }
}

// Populate franchise filter dropdown
function populateFranchiseFilter() {
    const select = document.getElementById('storeFranchiseFilter');
    if (!select) return;

    // Get unique franchises from stores
    const franchises = new Map();
    allCachedStores.forEach(store => {
        if (store.franchise_id && store.franchise_name) {
            franchises.set(store.franchise_id, store.franchise_name);
        }
    });

    // Clear and repopulate
    select.innerHTML = '<option value="">전체 프랜차이즈</option>';
    franchises.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        select.appendChild(option);
    });
}

// Filter stores by franchise
function filterStoresByFranchise() {
    filterStores();
}

function filterStores(query) {
    const searchTerm = (query || document.getElementById('storeSearch')?.value || '').toLowerCase();
    const franchiseFilter = document.getElementById('storeFranchiseFilter')?.value;

    let filtered = allCachedStores;

    // 1. Filter by Franchise
    if (franchiseFilter) {
        filtered = filtered.filter(s => s.franchise_id == franchiseFilter);
    }

    // 2. Filter by Active Status
    if (currentStoreFilter === 'active') {
        filtered = filtered.filter(s => s.is_active);
    } else if (currentStoreFilter === 'inactive') {
        filtered = filtered.filter(s => !s.is_active);
    }

    // 3. Filter by Search Term
    if (searchTerm) {
        filtered = filtered.filter(s =>
            s.name.toLowerCase().includes(searchTerm) ||
            s.code.toLowerCase().includes(searchTerm) ||
            (s.franchise_name && s.franchise_name.toLowerCase().includes(searchTerm))
        );
    }

    renderStoresGrouped(filtered);
}

function updateStoreTabs(btn, status) {
    // Update active state of buttons
    const tabs = btn.parentNode.querySelectorAll('.sub-tab-btn');
    tabs.forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');

    // Load data
    loadAllStores(status);
}

function getStoreHealthStatus(lastHeartbeat) {
    if (!lastHeartbeat) return '<span class="status-pill inactive" style="background:#eee; color:#999;">오프라인</span>';

    const last = new Date(lastHeartbeat);
    const now = new Date();
    const diffMinutes = (now - last) / (1000 * 60);

    if (diffMinutes < 15) {
        return '<span class="status-pill active">온라인</span>';
    } else if (diffMinutes < 60) {
        return '<span class="status-pill" style="background:#fff9db; color:#f08c00;">지연 중</span>';
    } else {
        return '<span class="status-pill inactive">오프라인</span>';
    }
}

function renderStoresGrouped(stores) {
    const container = document.getElementById('storesContainer');
    if (!container) return;

    if (stores.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">등록된 매장이 없습니다.</td></tr>';
        return;
    }

    container.innerHTML = stores.map(store => `
        <tr>
            <td style="font-weight: 700;">${store.name}</td>
            <td><code style="background: var(--toss-gray-100); padding: 2px 6px; border-radius: 4px;">${store.code}</code></td>
            <td>${store.franchise_name || '<span style="color: var(--toss-gray-400);">없음</span>'}</td>
            <td>${getStoreHealthStatus(store.last_heartbeat)}</td>
            <td>
                <span class="status-pill ${store.is_active ? 'active' : 'inactive'}">
                    ${store.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="toss-btn toss-btn-outline" onclick="openStoreSettings(${store.id}, '${store.code}')">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="toss-btn toss-btn-outline" onclick="openStoreMaintenanceModal(${store.id}, '${store.name}')">
                        <i class="fas fa-tools"></i>
                    </button>
                    <button class="toss-btn toss-btn-secondary" onclick="openEditStoreNameModal(${store.id}, '${store.name}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${store.is_active
            ? `<button class="toss-btn toss-btn-outline" style="color: var(--toss-red);" onclick="toggleStoreStatus(${store.id}, true)"><i class="fas fa-lock"></i></button>`
            : `<button class="toss-btn toss-btn-primary" onclick="toggleStoreStatus(${store.id}, false)"><i class="fas fa-unlock"></i></button>`
        }
                </div>
            </td>
        </tr>
    `).join('');
}

let targetStoreId = null;
let targetIsActive = null;


function openStoreSettings(storeId, storeCode) {
    // Set context and navigate
    localStorage.setItem('selected_store_id', storeId);
    window.location.href = `/settings?store=${storeCode}`;
}

function toggleStoreStatus(storeId, currentIsActive) {
    targetStoreId = storeId;
    targetIsActive = currentIsActive;

    const action = currentIsActive ? '비활성화' : '활성화';
    document.getElementById('storeStatusActionText').textContent = action;
    document.getElementById('storeStatusConfirmMessage').textContent = `정말로 이 매장을 ${action} 하시겠습니까?`;

    // Set button style
    const btn = document.getElementById('btnConfirmStoreStatus');
    if (currentIsActive) {
        btn.className = 'btn btn-danger';
        btn.textContent = '비활성화';
    } else {
        btn.className = 'btn btn-success';
        btn.textContent = '활성화';
    }

    document.getElementById('confirmStoreStatusModal').classList.add('show');
}

async function confirmStoreStatusChange() {
    if (targetStoreId === null) return;

    const endpoint = targetIsActive ? 'deactivate' : 'activate';
    const action = targetIsActive ? '비활성화' : '활성화';

    try {
        const response = await fetch(`${API_BASE}/stores/${targetStoreId}/${endpoint}`, {
            method: 'POST',
            headers: getHeaders()
        });

        if (response.ok) {
            closeModal('confirmStoreStatusModal');
            loadAllStores(false); // Refresh
            showNotification(`매장이 ${action} 되었습니다.`);
        } else {
            const error = await response.json();
            showNotification(error.detail || `${action} 실패`, '오류');
        }
    } catch (error) {
        console.error(error);
        showNotification('오류 발생', '오류');
    }
}

// --- Member Filter Logic ---
async function loadMemberFilterStores(franchiseId) {
    const storeSelect = document.getElementById('memberFilterStore');
    storeSelect.innerHTML = '<option value="">전체 매장</option>';

    if (!franchiseId) return;

    try {
        const response = await fetch(`${API_BASE}/franchises/${franchiseId}/stores`, { headers: getHeaders() });
        if (response.ok) {
            const stores = await response.json();
            stores.forEach(s => {
                if (s.is_active) {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    storeSelect.appendChild(opt);
                }
            });
        }
    } catch (e) {
        console.error(e);
    }
}

// --- Member List Logic (Updated) ---
async function handleMemberSearch() {
    const q = document.getElementById('memberSearchInput').value;
    const franchiseId = document.getElementById('memberFilterFranchise').value;
    const storeId = document.getElementById('memberFilterStore').value;

    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">검색 중...</td></tr>';

    try {
        const params = new URLSearchParams();
        if (q) params.append('q', q);
        if (franchiseId) params.append('franchise_id', franchiseId);
        if (storeId) params.append('store_id', storeId);

        const response = await fetch(`${API_BASE}/members?${params.toString()}`, { headers: getHeaders() });

        if (response.ok) {
            const members = await response.json();
            renderMembersTable(members);
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">검색 실패</td></tr>';
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">오류 발생</td></tr>';
    }
}

function renderMembersTable(members) {
    const tbody = document.getElementById('membersTableBody');
    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">결과가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = members.map(member => `
        <tr>
            <td style="font-weight: 700;">${member.name}</td>
            <td>${member.phone}</td>
            <td>${member.franchise_name || '<span style="color: var(--toss-gray-400);">-</span>'}</td>
            <td>${member.store_name}</td>
            <td><span style="font-size: 13px; color: var(--toss-gray-500);">${new Date(member.created_at).toLocaleDateString()}</span></td>
            <td style="text-align: right;">
                <button class="toss-btn toss-btn-secondary" onclick="showMemberHistory(${member.id}, '${member.name}')">
                    <i class="fas fa-search-plus"></i> 상세
                </button>
            </td>
        </tr>
    `).join('');
}

// 회원 상세 정보 (히스토리) 모달 표시
async function showMemberHistory(memberId, memberName) {
    document.getElementById('memberHistoryName').textContent = memberName;
    const tbody = document.getElementById('memberHistoryTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">로딩 중...</td></tr>';

    document.getElementById('memberHistoryModal').classList.add('show');

    try {
        const response = await fetch(`${API_BASE}/members/${memberId}/history`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const history = await response.json();
            if (history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">활동 기록이 없습니다.</td></tr>';
            } else {
                tbody.innerHTML = history.map(h => `
                    <tr>
                        <td>${new Date(h.created_at).toLocaleString()}</td>
                        <td>${h.store_name}</td>
                        <td>
                            <span class="status-pill ${h.status === 'completed' ? 'active' : 'inactive'}">
                                ${h.status === 'completed' ? '방문완료' : '취소/기타'}
                            </span>
                        </td>
                        <td>${h.order_name || '-'}</td>
                    </tr>
                `).join('');
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">데이터 로드 실패</td></tr>';
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">오류 발생</td></tr>';
    }
}

// Member Stats logic (Aggregation)
async function loadMemberStatsAggregation() {
    const fTbody = document.getElementById('franchiseStatsBody');
    const sTbody = document.getElementById('storeStatsBody');

    fTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px;">로딩 중...</td></tr>';
    sTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">로딩 중...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/stats/members`, { headers: getHeaders() });
        if (response.ok) {
            const data = await response.json();

            // Render Franchise Stats
            if (data.by_franchise.length === 0) {
                fTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px;">데이터가 없습니다.</td></tr>';
            } else {
                fTbody.innerHTML = data.by_franchise.map(f => `
                    <tr>
                        <td style="font-weight: 700;">${f.name}</td>
                        <td style="text-align: right; font-weight: 700; color: var(--toss-blue);">${f.count.toLocaleString()}명</td>
                    </tr>
                `).join('');
            }

            // Render Store Stats
            if (data.by_store.length === 0) {
                sTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">데이터가 없습니다.</td></tr>';
            } else {
                sTbody.innerHTML = data.by_store.map(s => `
                    <tr>
                        <td style="font-weight: 700;">${s.name}</td>
                        <td>${s.franchise_name}</td>
                        <td style="text-align: right; font-weight: 700; color: var(--toss-blue);">${s.count.toLocaleString()}명</td>
                    </tr>
                `).join('');
            }
        } else {
            fTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: var(--toss-red);">로드 실패</td></tr>';
            sTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--toss-red);">로드 실패</td></tr>';
        }
    } catch (error) {
        console.error(error);
    }
}


// 초기 로드
async function init() {
    const token = getToken();
    const role = localStorage.getItem('user_role');

    if (!token || role !== 'system_admin') {
        alert('관리자 권한이 없거나 로그인이 필요합니다.');
        window.location.href = '/login';
        return;
    }

    await loadStats();
    await loadFranchises();
}

init();

// --- Analytics Dashboard Logic ---
let analyticsChart = null;
let analyticsDataStore = null;

// Populate filters on load
function populateAnalyticsFilters() {
    const fSelect = document.getElementById('analyticsFranchiseFilter');
    const sSelect = document.getElementById('analyticsStoreFilter');

    // Clear existing options (keep default)
    fSelect.innerHTML = '<option value="">전체 프랜차이즈</option>';

    if (franchisesData) {
        franchisesData.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name;
            fSelect.appendChild(opt);
        });
    }
}

// Handle Franchise Change -> Update Store Filter
document.getElementById('analyticsFranchiseFilter').addEventListener('change', function () {
    const franchiseId = this.value;
    const sSelect = document.getElementById('analyticsStoreFilter');
    sSelect.innerHTML = '<option value="">전체 매장</option>';

    if (franchiseId && franchisesData) {
        const franchise = franchisesData.find(f => f.id == franchiseId);
        if (franchise && franchise.stores) {
            franchise.stores.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                sSelect.appendChild(opt);
            });
        }
    } else {
        // If no franchise selected, or generic -> could load all stores? 
        // For now keep simple: only show stores if franchise selected or leave generic 'All'
    }
    loadAnalyticsData();
});

// 날짜 범위 계산 유틸리티
function calculateDateRange(rangeType) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);
    let end = new Date(today);

    switch (rangeType) {
        case 'yesterday':
            start.setDate(today.getDate() - 1);
            end.setDate(today.getDate() - 1);
            break;
        case 'last_week':
            // 지난 주 월~일
            const lastWeekEnd = new Date(today);
            lastWeekEnd.setDate(today.getDate() - today.getDay());
            const lastWeekStart = new Date(lastWeekEnd);
            lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
            start = lastWeekStart;
            end = lastWeekEnd;
            break;
        case 'this_week':
            // 이번 주 월~오늘
            start.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
            break;
        case 'last_month':
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'this_month':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'today':
        default:
            // Default is today (start=today, end=today)
            break;
    }

    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

// 분석 날짜 선택기 초기화
function initAnalyticsDateRange() {
    const quickBtns = document.querySelectorAll('#analyticsDateQuickGroups .date-quick-btn');
    const displayStart = document.getElementById('analyticsStartDate');
    const displayEnd = document.getElementById('analyticsEndDate');
    const inputStart = document.getElementById('analyticsStartDateInput');
    const inputEnd = document.getElementById('analyticsEndDateInput');

    function updateDisplay(start, end) {
        displayStart.textContent = start.replace(/-/g, '.');
        displayEnd.textContent = end.replace(/-/g, '.');
        inputStart.value = start;
        inputEnd.value = end;
    }

    // 초기값 세팅 (오늘)
    const initial = calculateDateRange('today');
    updateDisplay(initial.start, initial.end);

    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            quickBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const range = calculateDateRange(btn.dataset.range);
            updateDisplay(range.start, range.end);
            loadAnalyticsData();
        });
    });

    // 수동 선택 이벤트 (필요 시 확장)
    document.getElementById('analyticsDateClear').addEventListener('click', () => {
        const todayRange = calculateDateRange('today');
        updateDisplay(todayRange.start, todayRange.end);
        quickBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-range="today"]').classList.add('active');
        loadAnalyticsData();
    });

    // Date Picker Input Handlers
    const startInput = document.getElementById('analyticsStartDateInput');
    const endInput = document.getElementById('analyticsEndDateInput');

    // Trigger update when date inputs change
    const handleDateChange = () => {
        const start = startInput.value;
        const end = endInput.value;
        if (start && end) {
            updateDisplay(start, end);
            // Clear quick buttons
            quickBtns.forEach(b => b.classList.remove('active'));
            loadAnalyticsData();
        }
    };

    startInput.addEventListener('change', () => {
        if (endInput.value === '') endInput.showPicker(); // Chain pickers
        handleDateChange();
    });
    endInput.addEventListener('change', handleDateChange);
}

// Open native date picker for start date
function openDatePicker() {
    const startInput = document.getElementById('analyticsStartDateInput');
    if (startInput && startInput.showPicker) {
        startInput.showPicker();
    } else {
        startInput.click(); // Fallback
    }
}

// Period switching logic
function setAnalyticsPeriod(period) {
    currentAnalyticsPeriod = period;

    // Update button styles
    const buttons = document.querySelectorAll('.period-selector button');
    buttons.forEach(btn => {
        if (btn.id === `period-btn-${period}`) {
            btn.classList.remove('toss-btn-secondary');
            btn.classList.add('toss-btn-primary');
        } else {
            btn.classList.remove('toss-btn-primary');
            btn.classList.add('toss-btn-secondary');
        }
    });

    loadAnalyticsData();
}

async function loadAnalyticsData() {
    const container = document.getElementById('analyticsDashboardContainer');
    if (!container) return;

    const franchiseId = document.getElementById('analyticsFranchiseFilter').value;
    const storeId = document.getElementById('analyticsStoreFilter').value;
    const startDate = document.getElementById('analyticsStartDateInput').value;
    const endDate = document.getElementById('analyticsEndDateInput').value;

    // Build query params
    const params = new URLSearchParams();
    if (franchiseId) params.append('franchise_id', franchiseId);
    if (storeId) params.append('store_id', storeId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    // Period Param
    params.append('period', currentAnalyticsPeriod);

    try {
        const response = await fetch(`${API_BASE}/stats/dashboard?${params.toString()}`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            analyticsDataStore = data;
            renderAnalyticsDashboard(data);
        } else {
            const error = await response.json();
            // alert(error.detail || '데이터 로드 실패');
        }
    } catch (err) {
        console.error('Analytics load failed:', err);
    }
}

function renderAnalyticsDashboard(data) {
    // KPI Cards
    document.getElementById('ana-open-stores').textContent = data.open_stores;
    document.getElementById('ana-total-stores').textContent = `전체 ${data.total_stores}개 중`;

    document.getElementById('ana-total-waiting').textContent = data.total_waiting.total; // Updated structure

    // Wait Time Stats - Check if exists or handle gracefully
    // Backend service returns specific structure. Check if waiting_time_stats is there?
    // Wait, StatsService response does NOT include waiting_time_stats!
    // I missed adding waiting_time_stats to StatsService.
    // I should fix StatsService later or handle it here.
    // existing superadmin.js expects data.waiting_time_stats.

    if (data.waiting_time_stats) {
        const wStats = data.waiting_time_stats;
        document.getElementById('ana-avg-wait').textContent = wStats.avg + '분';
        document.getElementById('ana-max-min-wait').textContent = `최대 ${wStats.max}분 / 최소 ${wStats.min}분`;
    } else {
        document.getElementById('ana-avg-wait').textContent = '-';
        document.getElementById('ana-max-min-wait').textContent = '-';
    }

    document.getElementById('ana-total-attendance').textContent = data.total_attendance.total; // Updated structure

    // Chart.js render
    renderHourlyChart(data.hourly_stats);

    // Render Tables
    renderStoreTopList(data.store_stats);
    renderDetailedTable(data.store_stats);
}

function renderHourlyChart(hourlyStats) {
    const ctx = document.getElementById('hourlyTrendChart').getContext('2d');

    if (analyticsChart) {
        analyticsChart.destroy();
    }

    // Prepare data
    // Use label from backend, or fallback
    const labels = hourlyStats.map(s => s.label || (s.hour !== undefined ? s.hour + '시' : ''));
    const waitData = hourlyStats.map(s => s.waiting_count);
    const attendData = hourlyStats.map(s => s.attendance_count);

    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '대기 접수',
                    data: waitData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '출석 완료',
                    data: attendData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderStoreTopList(storeStats) {
    const container = document.getElementById('storeTopList');
    if (!container) return;

    // Sort by current waiting descending
    const sorted = [...storeStats].sort((a, b) => b.total_waiting - a.total_waiting).slice(0, 5);

    if (sorted.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--toss-gray-400); padding: 20px;">데이터가 없습니다.</p>';
        return;
    }

    container.innerHTML = sorted.map((s, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: var(--toss-gray-50); border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="width: 24px; height: 24px; background: ${idx < 3 ? 'var(--toss-blue)' : 'var(--toss-gray-300)'}; color: white; border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 13px; font-weight: 800;">${idx + 1}</span>
                <span style="font-weight: 600; color: var(--toss-gray-800);">${s.store_name}</span>
            </div>
            <div style="font-weight: 700; color: var(--toss-blue); font-size: 16px;">${s.total_waiting}<span style="font-size: 12px; font-weight: normal; color: var(--toss-gray-400); margin-left: 2px;">명</span></div>
        </div>
    `).join('');
}

// Detailed analytics table rendering
function renderDetailedTable(storeStats) {
    const tbody = document.getElementById('analyticsTableBody');
    if (!tbody) return;

    if (storeStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">데이터가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = storeStats.map(s => `
        <tr>
            <td style="font-weight: 700;">${s.store_name}</td>
            <td>${getStoreHealthStatus(s.last_heartbeat)}</td>
            <td style="color: var(--toss-gray-500); font-size: 13px;">${s.open_time || '-'}</td>
            <td style="font-weight: 700; color: var(--toss-blue);">${s.total_waiting}명</td>
            <td>${s.today_total_waiting}건</td>
            <td>${s.today_total_attendance}건</td>
        </tr>
    `).join('');
}

// Analytics data loading entry point
function loadAnalytics() {
    populateAnalyticsFilters();
    initAnalyticsDateRange();
    loadAnalyticsData();
}

// Dashboard components are loaded via unified toggleDashboard above

// --- Health Dashboard Logic ---
let currentHealthFilter = 'all';
let storeHealthData = [];

async function loadStoreHealth() {
    const tbody = document.getElementById('healthStoreListBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">로딩 중...</td></tr>';

    // Update timestamp
    document.getElementById('healthLastUpdated').textContent = '갱신: ' + new Date().toLocaleTimeString();

    try {
        // Fetch all franchises with stores
        const response = await fetch('/api/system/franchises?include_stores=true', {
            headers: getHeaders()
        });

        if (response.ok) {
            const franchises = await response.json();

            // Flatten to store list
            let allStores = [];
            franchises.forEach(f => {
                if (f.stores) {
                    f.stores.forEach(s => {
                        allStores.push({
                            ...s,
                            franchise_name: f.name
                        });
                    });
                }
            });

            storeHealthData = allStores;
            renderStoreHealth();
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">로드 실패</td></tr>';
        }
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">오류 발생</td></tr>';
    }
}

function filterStoreHealth(status) {
    currentHealthFilter = status;

    // Update active button state in sub-tabs
    const buttons = document.querySelectorAll('#healthDashboardContainer .sub-tab-btn');
    buttons.forEach(btn => {
        const text = btn.textContent;
        if (text === '전체' && status === 'all') btn.classList.add('active');
        else if (text === '온라인' && status === 'online') btn.classList.add('active');
        else if (text === '지연' && status === 'warning') btn.classList.add('active');
        else if (text === '오프라인' && status === 'offline') btn.classList.add('active');
        else btn.classList.remove('active');
    });

    renderStoreHealth();
}

function getHealthStatusKey(lastHeartbeat) {
    if (!lastHeartbeat) return 'offline';
    const last = new Date(lastHeartbeat);
    const now = new Date();
    const diffMinutes = (now - last) / (1000 * 60);

    if (diffMinutes < 15) return 'online'; // Relaxed from 5 to 15 mins
    if (diffMinutes < 60) return 'warning'; // Relaxed from 30 to 60 mins
    return 'offline';
}

function renderStoreHealth() {
    const tbody = document.getElementById('healthStoreListBody');
    if (!tbody) return;

    let filtered = storeHealthData;

    if (currentHealthFilter !== 'all') {
        filtered = filtered.filter(s => getHealthStatusKey(s.last_heartbeat) === currentHealthFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color: var(--toss-gray-400);">해당하는 매장이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td style="font-weight: 700;">${s.name}</td>
            <td style="color: var(--toss-gray-500);">${s.franchise_name}</td>
            <td style="text-align: center;">${getStoreHealthStatus(s.last_heartbeat)}</td>
            <td style="text-align: right; color: var(--toss-gray-400); font-family: 'JetBrains Mono', monospace; font-size: 13px;">
                ${s.last_heartbeat ? new Date(s.last_heartbeat).toLocaleString() : '-'}
            </td>
        </tr>
    `).join('');
}

// --- Login Monitor Logic ---
let loginMonitorData = [];

async function loadLoginMonitor() {
    const tbody = document.getElementById('loginUserListBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">로딩 중...</td></tr>';

    try {
        const response = await fetch('/api/system/users', {
            headers: getHeaders()
        });

        if (response.ok) {
            let users = await response.json();
            // Filter out system_admin usually, show franchise managers/store admins
            loginMonitorData = users.filter(u => u.role !== 'system_admin');
            renderLoginMonitor();
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">로드 실패</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">오류 발생</td></tr>';
    }
}

function filterLoginMonitor() {
    renderLoginMonitor();
}

// Role names are handled by getRoleNameText

function renderLoginMonitor() {
    const tbody = document.getElementById('loginUserListBody');
    if (!tbody) return;

    const searchInput = document.getElementById('loginMonitorSearchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';

    let filtered = loginMonitorData.filter(u =>
        (u.username && u.username.toLowerCase().includes(search)) ||
        (u.franchise_name && u.franchise_name.toLowerCase().includes(search)) ||
        (u.store_name && u.store_name.toLowerCase().includes(search))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--toss-gray-400);">검색 결과가 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(u => `
        <tr>
            <td style="font-weight: 700;">${u.username}</td>
            <td style="color: var(--toss-gray-600);">
                ${u.franchise_name || '<span style="color: var(--toss-gray-300);">-</span>'} 
                ${u.store_name ? '<i class="fas fa-chevron-right" style="font-size: 10px; margin: 0 4px; color: var(--toss-gray-300);"></i> ' + u.store_name : ''}
            </td>
            <td>
                <span class="status-pill" style="background: var(--toss-gray-100); color: var(--toss-gray-600); font-size: 11px;">
                    ${getRoleNameText(u.role)}
                </span>
            </td>
            <td style="text-align: center;">
                <span class="status-pill ${u.is_active ? 'active' : 'inactive'}">
                    ${u.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td style="text-align: right; color: var(--toss-gray-900); font-weight: 500;">
                ${u.last_login ? new Date(u.last_login).toLocaleString() : '<span style="color: var(--toss-gray-300);">기록 없음</span>'}
            </td>
        </tr>
    `).join('');
}

function getRoleNameText(role) {
    return getRoleName(role);
}
