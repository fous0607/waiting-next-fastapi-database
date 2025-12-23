// Franchise Admin Dashboard Script
const API_BASE = '/api';
let storesData = [];
let usersData = [];
let membersData = [];
let statsData = null;
let currentAnalyticsPeriod = 'hourly';

// 토큰 가져오기 (쿠키에서)
function getToken() {
    // Try localStorage first (for compatibility)
    const localToken = localStorage.getItem('access_token');
    if (localToken) {
        console.log('[Auth] Token found in localStorage:', localToken.substring(0, 20) + '...');
        return localToken;
    }

    // Read from cookie
    console.log('[Auth] Checking cookies:', document.cookie);
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'access_token') {
            console.log('[Auth] Token found in cookie:', value.substring(0, 20) + '...');
            return value;
        }
    }

    console.error('[Auth] No token found!');
    return null;
}

// API 요청 헤더
function getHeaders() {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('[Auth] Headers prepared with Authorization');
    } else {
        console.error('[Auth] No token available for headers!');
    }

    return headers;
}

// ========== 통계 로드 ==========
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/franchise/stats`, {
            headers: getHeaders()
        });

        if (response.ok) {
            statsData = await response.json();
            updateStatsOverview();
        } else {
            const error = await response.json();
            console.error('통계 로드 실패:', error);
        }
    } catch (error) {
        console.error('통계 로드 실패:', error);
    }
}

// 통계 개요 업데이트
function updateStatsOverview() {
    const overview = document.getElementById('statsOverview');
    if (!overview || !statsData) return;

    overview.innerHTML = `
        <div class="stat-card" onclick="showView('stores')">
            <div class="stat-label">운영 매장</div>
            <div class="stat-value">${statsData.active_stores} <span style="font-size: 16px; color: var(--toss-gray-400);">/ ${statsData.total_stores}</span></div>
            <div class="stat-change up"><i class="fas fa-store"></i> 활성 매장</div>
        </div>
        <div class="stat-card" onclick="showView('users')">
            <div class="stat-label">관리자 계정</div>
            <div class="stat-value">${statsData.total_users}</div>
            <div class="stat-change up"><i class="fas fa-user-shield"></i> 사용자 관리</div>
        </div>
        <div class="stat-card" onclick="showView('members')">
            <div class="stat-label">전체 회원</div>
            <div class="stat-value">${statsData.total_members.toLocaleString()}</div>
            <div class="stat-change up"><i class="fas fa-users"></i> 누적 가입자</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">현재 대기</div>
            <div class="stat-value">${statsData.current_waiting}</div>
            <div class="stat-change up"><i class="fas fa-clock"></i> 대기 중</div>
        </div>
    `;
}

// ========== 매장 관리 ==========
async function loadStores() {
    try {
        // Use slash-less URL to avoid 307 redirect
        const response = await fetch(`${API_BASE}/stores`, {
            headers: getHeaders()
        });

        if (response.ok) {
            storesData = await response.json();
            updateStoresGrid();
        } else {
            console.error('매장 목록 로드 실패');
        }
    } catch (error) {
        console.error('매장 목록 로드 실패:', error);
    }
}

function updateStoresGrid() {
    const grid = document.getElementById('storesGrid');
    if (!grid) return;

    if (storesData.length === 0) {
        grid.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">등록된 매장이 없습니다.</td></tr>';
        return;
    }

    // Update stats
    const activeCount = storesData.filter(s => s.is_active).length;
    const totalCount = document.getElementById('totalStoreCount');
    const activeCountEl = document.getElementById('activeStoreCount');
    const inactiveCountEl = document.getElementById('inactiveStoreCount');

    if (totalCount) totalCount.textContent = storesData.length;
    if (activeCountEl) activeCountEl.textContent = activeCount;
    if (inactiveCountEl) inactiveCountEl.textContent = storesData.length - activeCount;

    grid.innerHTML = '';

    storesData.forEach(store => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700;">${store.name}</td>
            <td><code style="background: var(--toss-gray-100); padding: 2px 6px; border-radius: 4px;">${store.code}</code></td>
            <td>-</td>
            <td>
                <span class="status-pill ${store.is_active ? 'active' : 'inactive'}">
                    ${store.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="toss-btn toss-btn-outline" onclick="openStoreManagement('${store.code}', '${store.name}')">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </div>
            </td>
        `;
        grid.appendChild(tr);
    });
}

function openStoreManagement(storeCode, storeName) {
    window.open(`/?store=${storeCode}`, '_blank');
}

function filterStores(query) {
    const q = (query || '').toLowerCase();
    const grid = document.getElementById('storesGrid');
    if (!grid) return;

    const filtered = storesData.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
        grid.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">검색 결과가 없습니다.</td></tr>';
        return;
    }

    grid.innerHTML = '';
    filtered.forEach(store => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700;">${store.name}</td>
            <td><code style="background: var(--toss-gray-100); padding: 2px 6px; border-radius: 4px;">${store.code}</code></td>
            <td>-</td>
            <td>
                <span class="status-pill ${store.is_active ? 'active' : 'inactive'}">
                    ${store.is_active ? '활성' : '비활성'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="toss-btn toss-btn-outline" onclick="openStoreManagement('${store.code}', '${store.name}')">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                </div>
            </td>
        `;
        grid.appendChild(tr);
    });
}

// ========== 사용자 관리 ==========
async function loadUsers() {
    try {
        // Use slash-less URL to avoid 307 redirect
        const response = await fetch(`${API_BASE}/users`, {
            headers: getHeaders()
        });

        if (response.ok) {
            usersData = await response.json();
            updateUsersGrid();
        } else {
            console.error('사용자 목록 로드 실패');
        }
    } catch (error) {
        console.error('사용자 목록 로드 실패:', error);
    }
}

function updateUsersGrid() {
    const grid = document.getElementById('usersGrid');
    if (!grid) return;

    if (usersData.length === 0) {
        grid.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">등록된 사용자가 없습니다.</td></tr>';
        return;
    }

    // Update stats
    const activeCount = usersData.filter(u => u.is_active).length;
    const totalCount = document.getElementById('totalUserCount');
    const activeCountEl = document.getElementById('activeUserCount');
    const inactiveCountEl = document.getElementById('inactiveUserCount');

    if (totalCount) totalCount.textContent = usersData.length;
    if (activeCountEl) activeCountEl.textContent = activeCount;
    if (inactiveCountEl) inactiveCountEl.textContent = usersData.length - activeCount;

    grid.innerHTML = '';

    usersData.forEach(user => {
        const roleMap = {
            'franchise_admin': '프랜차이즈 관리자',
            'franchise_manager': '매장 관리자',
            'store_admin': '매장 운영자'
        };
        const roleDisplay = roleMap[user.role] || user.role;

        let storeName = '-';
        if (user.role === 'store_admin' && user.store) {
            storeName = user.store.name;
        } else if (user.role === 'franchise_manager' && user.managed_stores && user.managed_stores.length > 0) {
            storeName = user.managed_stores.map(s => s.name).join(', ');
            if (storeName.length > 30) storeName = storeName.substring(0, 30) + '...';
        } else if (user.role === 'franchise_admin') {
            storeName = '전체 매장';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700;">${user.username}</td>
            <td>${roleDisplay}</td>
            <td>${storeName}</td>
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
                </div>
            </td>
        `;
        grid.appendChild(tr);
    });
}

function filterUsers(query) {
    const q = (query || '').toLowerCase();
    const grid = document.getElementById('usersGrid');
    if (!grid) return;

    const filtered = usersData.filter(u =>
        u.username.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
        grid.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">검색 결과가 없습니다.</td></tr>';
        return;
    }

    grid.innerHTML = '';
    filtered.forEach(user => {
        const roleMap = {
            'franchise_admin': '프랜차이즈 관리자',
            'franchise_manager': '매장 관리자',
            'store_admin': '매장 운영자'
        };
        const roleDisplay = roleMap[user.role] || user.role;

        let storeName = '-';
        if (user.role === 'store_admin' && user.store) {
            storeName = user.store.name;
        } else if (user.role === 'franchise_manager' && user.managed_stores && user.managed_stores.length > 0) {
            storeName = user.managed_stores.map(s => s.name).join(', ');
        } else if (user.role === 'franchise_admin') {
            storeName = '전체 매장';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700;">${user.username}</td>
            <td>${roleDisplay}</td>
            <td>${storeName}</td>
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
                </div>
            </td>
        `;
        grid.appendChild(tr);
    });
}

// ========== 회원 관리 ==========
async function loadMembers() {
    try {
        // Use slash-less URL to avoid 307 redirect
        const response = await fetch(`${API_BASE}/members?limit=1000`, {
            headers: getHeaders()
        });

        if (response.ok) {
            membersData = await response.json();
            updateMembersGrid();
        } else {
            console.error('회원 목록 로드 실패');
        }
    } catch (error) {
        console.error('회원 목록 로드 실패:', error);
    }
}

function updateMembersGrid() {
    const grid = document.getElementById('membersGrid');
    if (!grid) return;

    if (membersData.length === 0) {
        grid.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">등록된 회원이 없습니다.</td></tr>';
        return;
    }

    // Update stats
    const totalCount = document.getElementById('totalMemberCount');
    if (totalCount) totalCount.textContent = membersData.length;

    grid.innerHTML = '';

    membersData.slice(0, 100).forEach(member => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700;">${member.name}</td>
            <td>${member.phone}</td>
            <td>${member.barcode || '-'}</td>
            <td>${new Date(member.created_at).toLocaleDateString()}</td>
        `;
        grid.appendChild(tr);
    });
}

function filterMembers(query) {
    const q = (query || '').toLowerCase();
    const grid = document.getElementById('membersGrid');
    if (!grid) return;

    const filtered = membersData.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.barcode && m.barcode.includes(q))
    );

    if (filtered.length === 0) {
        grid.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">검색 결과가 없습니다.</td></tr>';
        return;
    }

    grid.innerHTML = '';
    filtered.slice(0, 100).forEach(member => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700;">${member.name}</td>
            <td>${member.phone}</td>
            <td>${member.barcode || '-'}</td>
            <td>${new Date(member.created_at).toLocaleDateString()}</td>
        `;
        grid.appendChild(tr);
    });
}

// ========== 네비게이션 ==========
function hideAllViews() {
    // Hide dashboard containers
    const containers = [
        'statsOverviewContainer',
        'analyticsDashboardContainer',
        'analyticsDetailContainer',
        'noticeDashboardContainer'
    ];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Hide management views
    document.querySelectorAll('.admin-view').forEach(el => el.classList.remove('active'));

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
    // Deprecated 'summary' as standalone. 'summary' is now part of 'stores'.
    toggleDashboard(type);
}

function toggleDashboard(type) {
    hideAllViews();

    if (type === 'notice') {
        const container = document.getElementById('noticeDashboardContainer');
        if (container) {
            container.style.display = 'block';
            updateViewHeader('공지사항');
            const navItem = document.querySelector('.nav-item[onclick*="toggleDashboard(\'notice\')"]');
            if (navItem) navItem.classList.add('active');
            loadNotices();
        }
    } else if (type === 'analytics') {
        const container = document.getElementById('analyticsDashboardContainer');
        if (container) {
            container.style.display = 'block';
            updateViewHeader('분석 대시보드');
            const navItem = document.querySelector('.nav-item[onclick*="toggleDashboard(\'analytics\')"]');
            if (navItem) navItem.classList.add('active');
            loadAnalyticsData();
        }
    } else if (type === 'analytics_detail') {
        const detail = document.getElementById('analyticsDetailContainer');
        if (detail) {
            detail.style.display = 'block';
            updateViewHeader('상세 통계 조회');
            const navItem = document.querySelector('.nav-item[onclick*="toggleDashboard(\'analytics_detail\')"]');
            if (navItem) navItem.classList.add('active');

            if (!detailInitialized) initAnalyticsDetail();
        }
    }
}

function showView(viewName) {
    hideAllViews();

    const viewsContainer = document.getElementById('views-container');
    if (viewsContainer) viewsContainer.style.display = 'block';

    const viewElement = document.getElementById(`view-${viewName}`);
    if (viewElement) {
        viewElement.classList.add('active');

        // Update header and nav
        const titles = {
            'stores': '매장 관리',
            'users': '사용자 관리',
            'members': '회원 조회'
        };
        updateViewHeader(titles[viewName] || viewName);

        const navItem = document.querySelector(`.nav-item[onclick*="showView('${viewName}')"]`);
        if (navItem) navItem.classList.add('active');

        // Move Total Status Logic: If 'stores', show Stats Overview
        if (viewName === 'stores') {
            const stats = document.getElementById('statsOverviewContainer');
            if (stats) {
                stats.style.display = 'block';
                loadStats();
            }
            loadStores();
        } else if (viewName === 'users') {
            loadUsers();
        } else if (viewName === 'members') {
            loadMembers();
        }
    }
}

function toggleDashboard(type) {
    hideAllViews();

    if (type === 'analytics') {
        const container = document.getElementById('analyticsDashboardContainer');
        if (container) {
            container.style.display = 'block';
            updateViewHeader('분석 대시보드');
            const navItem = document.querySelector('.nav-item[onclick*="toggleDashboard(\'analytics\')"]');
            if (navItem) navItem.classList.add('active');
            loadAnalyticsData();
        }
    } else if (type === 'analytics_detail') {
        const detail = document.getElementById('analyticsDetailContainer');
        if (detail) {
            detail.style.display = 'block';
            updateViewHeader('상세 통계 조회');
            const navItem = document.querySelector('.nav-item[onclick*="toggleDashboard(\'analytics_detail\')"]');
            if (navItem) navItem.classList.add('active');

            if (!detailInitialized) initAnalyticsDetail();
            // Load if needed? initAnalyticsDetail might trigger via setDetailDateRange if we implement it that way.
            // Let's call load explicitly or ensure initialization sets defaults.
            // If initialized, loadDetailData()
        }
    }
}

function showView(viewName) {
    hideAllViews();

    const viewsContainer = document.getElementById('views-container');
    if (viewsContainer) viewsContainer.style.display = 'block';

    const viewElement = document.getElementById(`view-${viewName}`);
    if (viewElement) {
        viewElement.classList.add('active');

        // Update header and nav
        const titles = {
            'stores': '가맹점 관리',
            'users': '사용자 관리',
            'members': '회원 조회'
        };
        updateViewHeader(titles[viewName] || viewName);

        const navItem = document.querySelector(`.nav-item[onclick*="showView('${viewName}')"]`);
        if (navItem) navItem.classList.add('active');

        // Load data
        if (viewName === 'stores') loadStores();
        else if (viewName === 'users') loadUsers();
        else if (viewName === 'members') loadMembers();
    }
}

// ========== 모달 관리 ==========
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = '';
    }
}

function showEditUserModal(userId) {
    // Placeholder - implement user editing
    alert('사용자 수정 기능은 준비 중입니다.');
}

// ========== Analytics Dashboard ==========
async function loadAnalyticsStoreList() {
    try {
        // Use slash-less URL to avoid 307 redirect
        const url = `${API_BASE}/stores`;

        const response = await fetch(url, {
            headers: getHeaders()
        });

        if (response.ok) {
            const stores = await response.json();
            const select = document.getElementById('analyticsStoreFilter');
            if (select) {
                select.innerHTML = '<option value="">전체 매장</option>';
                stores.forEach(store => {
                    const option = document.createElement('option');
                    option.value = store.id;
                    option.textContent = `${store.name} (${store.code})`;
                    select.appendChild(option);
                });
            }
        } else {
            console.error(`[Analytics] Store list load failed: ${response.status}`);
            if (response.status === 401) {
                console.error('[Analytics] Authentication failed for store list');
                // Redirect to login if needed? Or show error
            }
        }
    } catch (error) {
        console.error('[Analytics] Store list load error:', error);
    }
}

async function loadAnalyticsData() {
    const storeId = document.getElementById('analyticsStoreFilter')?.value;

    try {
        // Build query params
        const params = new URLSearchParams();
        if (storeId) params.append('store_id', storeId);

        // Add date range
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        params.append('start_date', formatDate(analyticsStartDate));
        params.append('end_date', formatDate(analyticsEndDate));

        // Load analytics data from franchise dashboard stats endpoint
        const response = await fetch(`${API_BASE}/franchise/stats/dashboard?${params}`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            updateAnalyticsDisplay(data);
        } else {
            console.error('분석 데이터 로드 실패');
        }
    } catch (error) {
        console.error('분석 데이터 로드 실패:', error);
    }
}

function updateAnalyticsDisplay(data) {
    // Update KPI cards
    // Update KPI cards
    const waitingTotal = data.total_waiting ? data.total_waiting.total : (data.current_waiting || 0); // Handle both formats just in case
    const attendanceTotal = data.total_attendance ? data.total_attendance.total : (data.today_attendance || 0);
    const cancelledTotal = data.total_cancelled ? data.total_cancelled : (data.today_cancelled || 0); // Check schema

    // StatsService Schema:
    // total_waiting: {total, existing, new}
    // current_waiting: {total, existing, new}
    // total_attendance: {total, ...}
    // waiting_time_stats: {avg, max, min}

    if (data.total_waiting && typeof data.total_waiting === 'object') {
        // StatsService Format
        document.getElementById('ana-total-waiting').textContent = `${(data.current_waiting?.total || 0).toLocaleString()}명`; // Use current waiting for "Total Waiting" Card usually? Or Total Registered? Card says "Total Waiting" (Realtime)
        // Image says "총 매출" (Total Sales) but we mapped to "Realtime Waiting".
        // Wait, "실시간 총 대기" was the label.

        document.getElementById('ana-total-attendance').textContent = `${(data.total_attendance?.total || 0).toLocaleString()}명`;
        document.getElementById('ana-total-cancelled').textContent = `${(data.today_cancelled || 0).toLocaleString()}건`; // StatsService doesn't have cancelled in root return? Check schema.
        // StatsService only has total_waiting, current_waiting, total_attendance.
        // It seems StatsService logic in 1438 might be missing 'cancelled' count in return dict?
        // Checked 1438: It calculates cancellations? No, I don't see cancellation count in the return dict in 1438!
        // It only queries 'attended'.

        document.getElementById('ana-avg-wait').textContent = `${data.waiting_time_stats?.avg || 0}분`;
    } else {
        // Fallback or Old Format
        document.getElementById('ana-total-waiting').textContent = `${(data.current_waiting || 0).toLocaleString()}명`;
        document.getElementById('ana-total-attendance').textContent = `${(data.today_attendance || 0).toLocaleString()}명`;
        document.getElementById('ana-total-cancelled').textContent = `${(data.today_cancelled || 0).toLocaleString()}건`;
        document.getElementById('ana-avg-wait').textContent = `${data.waiting_time_stats?.avg || 0}분`;
    }

    // Update Comparisons (Mock for now)
    document.getElementById('ana-diff-waiting').textContent = `-7%`;
    document.getElementById('ana-diff-attendance').textContent = `-7%`;
    document.getElementById('ana-diff-cancelled').textContent = `-2%`;
    document.getElementById('ana-diff-wait').textContent = `-1%`;

    // Update table (placeholder)
    const tableBody = document.getElementById('analyticsTableBody');
    if (tableBody) {
        // Clear existing
        tableBody.innerHTML = '';

        // If we have store stats, populate table
        if (data.store_stats && data.store_stats.length > 0) {
            data.store_stats.forEach(store => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: 600;">${store.store_name}</td>
                    <td><span class="toss-badge ${store.is_active ? 'blue' : 'gray'}">${store.is_active ? '운영중' : '중지'}</span></td>
                    <td style="font-weight: 600;">${store.waiting_count}명</td>
                    <td>${store.waiting_count + store.attendance_count}</td>
                    <td>${store.attendance_count}</td>
                    <td>0</td> <!-- Cancelled not in StatsService yet -->
                `;
                tableBody.appendChild(tr);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--toss-gray-400);">데이터가 없습니다.</td></tr>';
        }
    }

    // Render Chart
    if (data.hourly_stats) {
        renderAnalyticsChart(data.hourly_stats);
    }

    // Render Doughnut Charts used Real Data
    renderDoughnutCharts(data);
}

// Chart Instances
let analyticsChart = null;
let channelChart = null;
let typeChart = null;

function renderDoughnutCharts(data) {
    if (!data) return;

    // 1. Channel Share (Waiting vs Attended)
    // Label: 대기접수, 출석접수
    const channelCtx = document.getElementById('channelShareChart')?.getContext('2d');
    if (channelCtx) {
        if (channelChart) channelChart.destroy();

        // Extract values safely
        const waitingVal = data.total_waiting ? data.total_waiting.total : (data.current_waiting || 0);
        // Note: total_attendance is from StatsService, might be total attended?
        const attendedVal = data.total_attendance ? data.total_attendance.total : (data.today_attendance || 0);

        const channelData = {
            labels: ['대기접수', '출석접수'],
            datasets: [{
                data: [waitingVal, attendedVal],
                backgroundColor: ['#3182f6', '#2ecc71'], // Blue, Green
                borderWidth: 0,
                hoverOffset: 4
            }]
        };

        const total1 = waitingVal + attendedVal || 1;

        channelChart = new Chart(channelCtx, {
            type: 'doughnut',
            data: channelData,
            options: {
                cutout: '60%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = context.raw;
                                const pct = Math.round((val / total1) * 100);
                                return ` ${context.label}: ${val}명 (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Custom Legend for Channel
        const channelLegend = document.getElementById('channelLegend');
        if (channelLegend) {
            channelLegend.innerHTML = channelData.labels.map((label, i) => {
                const val = channelData.datasets[0].data[i];
                const pct = Math.round((val / total1) * 100);
                return `
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #4e5968;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 10px; height: 10px; background: ${channelData.datasets[0].backgroundColor[i]}; border-radius: 2px;"></span>
                        <span>${label}</span>
                    </div>
                    <div style="font-weight: 600;">${val}명 <span style="font-weight:400; color:#b0b8c1; margin-left:4px;">${pct}%</span></div>
                </div>
            `}).join('');
        }
    }

    // 2. Customer Type Share (New vs Member)
    // Label: 신규, 회원
    const typeCtx = document.getElementById('typeShareChart')?.getContext('2d');
    if (typeCtx) {
        if (typeChart) typeChart.destroy();

        // Extract values
        // data.total_waiting.new vs data.total_waiting.existing
        const newVal = data.current_waiting?.new || (data.total_waiting?.new || 0);
        const existingVal = data.current_waiting?.existing || (data.total_waiting?.existing || 0);

        // Or if using total_waiting instead of current? User said "신규 회원 으로 설정"

        const typeData = {
            labels: ['신규 고객', '기존 회원'],
            datasets: [{
                data: [newVal, existingVal],
                backgroundColor: ['#f04452', '#3182f6'], // Red (New), Blue (Existing)
                borderWidth: 0,
                hoverOffset: 4
            }]
        };

        const total2 = newVal + existingVal || 1;

        typeChart = new Chart(typeCtx, {
            type: 'doughnut',
            data: typeData,
            options: {
                cutout: '60%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = context.raw;
                                const pct = Math.round((val / total2) * 100);
                                return ` ${context.label}: ${val}명 (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
        // Custom Legend for Type
        const typeLegend = document.getElementById('typeLegend');
        if (typeLegend) {
            typeLegend.innerHTML = typeData.labels.map((label, i) => {
                const val = typeData.datasets[0].data[i];
                const pct = Math.round((val / total2) * 100);
                return `
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #4e5968;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 10px; height: 10px; background: ${typeData.datasets[0].backgroundColor[i]}; border-radius: 2px;"></span>
                        <span>${label}</span>
                    </div>
                    <div style="font-weight: 600;">${val}명 <span style="font-weight:400; color:#b0b8c1; margin-left:4px;">${pct}%</span></div>
                </div>
            `}).join('');
        }
    }
}

function renderAnalyticsChart(hourlyStats) {
    const ctx = document.getElementById('hourlyTrendChart')?.getContext('2d');
    if (!ctx) return;

    // Destructure data
    // Handle labels based on period format
    const labels = hourlyStats.map(item => {
        const p = item.period;
        // If hour (00-23 or length <= 2)
        if (p.length <= 2) return parseInt(p) + '시';
        // If date (YYYY-MM-DD)
        if (p.length === 10) {
            const d = new Date(p);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        }
        return p;
    });
    const waitingData = hourlyStats.map(item => item.waiting_count || item.waiting); // Handle both keys if diff

    // Mock "Last Week" data for visual similarity (85% + noise)
    const referenceData = waitingData.map(val => Math.max(0, Math.floor(val * 0.85 + (Math.random() * 2 - 1))));

    if (analyticsChart) {
        analyticsChart.destroy();
    }

    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '오늘',
                    data: waitingData,
                    borderColor: '#3182f6', // Toss Blue
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.3
                },
                {
                    label: '지난주',
                    data: referenceData,
                    borderColor: '#b0b8c1', // Toss Gray
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderDash: [0, 0],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(51, 61, 75, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 8,
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f2f4f6', drawBorder: false },
                    ticks: { color: '#b0b8c1' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#b0b8c1', maxTicksLimit: 8 }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function setAnalyticsPeriod(period) {
    currentAnalyticsPeriod = period;

    // Update button states
    ['hourly', 'daily', 'weekly', 'monthly'].forEach(p => {
        const btn = document.getElementById(`period-btn-${p}`);
        if (btn) {
            if (p === period) {
                btn.className = 'toss-btn toss-btn-sm toss-btn-primary';
            } else {
                btn.className = 'toss-btn toss-btn-sm toss-btn-secondary';
            }
        }
    });

    loadAnalyticsData();
}

// ========== 초기화 ==========
let analyticsStartDate = new Date();
let analyticsEndDate = new Date();

function initAnalyticsDatePicker() {
    // Set today as default
    const today = new Date();
    analyticsStartDate = new Date(today);
    analyticsEndDate = new Date(today);
    updateAnalyticsDateDisplay();

    // Add event listeners to date quick buttons
    const quickButtons = document.querySelectorAll('#analyticsDateQuickGroups .toss-choice-chip');
    quickButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // Remove active class from all buttons
            quickButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');

            const range = this.getAttribute('data-range');
            setAnalyticsDateRange(range);
        });
    });

    // Native Date Picker Listeners
    const startInput = document.getElementById('analyticsStartDateInput');
    const endInput = document.getElementById('analyticsEndDateInput');

    if (startInput) {
        startInput.addEventListener('change', function (e) {
            if (this.value) {
                analyticsStartDate = new Date(this.value);
                updateAnalyticsDateDisplay();
                loadAnalyticsData();
                // Clear active quick buttons
                quickButtons.forEach(b => b.classList.remove('active'));
            }
        });
    }

    if (endInput) {
        endInput.addEventListener('change', function (e) {
            if (this.value) {
                analyticsEndDate = new Date(this.value);
                updateAnalyticsDateDisplay();
                loadAnalyticsData();
                // Clear active quick buttons
                quickButtons.forEach(b => b.classList.remove('active'));
            }
        });
    }
}

function openStartDatePicker() {
    const startInput = document.getElementById('analyticsStartDateInput');
    if (startInput) {
        if (startInput.showPicker) startInput.showPicker();
        else startInput.click();
    }
}

function openEndDatePicker() {
    const endInput = document.getElementById('analyticsEndDateInput');
    if (endInput) {
        if (endInput.showPicker) endInput.showPicker();
        else endInput.click();
    }
}

function setAnalyticsDateRange(range) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (range) {
        case 'yesterday':
            analyticsStartDate = new Date(today);
            analyticsStartDate.setDate(today.getDate() - 1);
            analyticsEndDate = new Date(analyticsStartDate);
            break;
        case 'today':
            analyticsStartDate = new Date(today);
            analyticsEndDate = new Date(today);
            break;
        case 'last_week':
            analyticsEndDate = new Date(today);
            analyticsEndDate.setDate(today.getDate() - 1);
            analyticsStartDate = new Date(analyticsEndDate);
            analyticsStartDate.setDate(analyticsEndDate.getDate() - 6);
            break;
        case 'this_week':
            const dayOfWeek = today.getDay();
            const monday = new Date(today);
            monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
            analyticsStartDate = monday;
            analyticsEndDate = new Date(today);
            break;
        case 'last_month':
            analyticsStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            analyticsEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'this_month':
            analyticsStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
            analyticsEndDate = new Date(today);
            break;
    }

    updateAnalyticsDateDisplay();
    loadAnalyticsData();
}

function updateAnalyticsDateDisplay() {
    const startEl = document.getElementById('analyticsStartDateDisplay');
    const endEl = document.getElementById('analyticsEndDateDisplay');
    // Using simple format YYYY-MM-DD
    const simpleFormat = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (startEl) startEl.textContent = simpleFormat(analyticsStartDate);
    if (endEl) endEl.textContent = simpleFormat(analyticsEndDate);
}



document.addEventListener('DOMContentLoaded', function () {
    // 초기 대시보드 로드
    showDashboard('summary');

    // Load analytics store list when analytics dashboard is opened
    const analyticsNav = document.querySelector('.nav-item[onclick*="toggleDashboard(\'analytics\')"]');
    if (analyticsNav) {
        analyticsNav.addEventListener('click', () => {
            initAnalyticsDatePicker();
            loadAnalyticsStoreList();
            loadAnalyticsData();
        });
    }
});


// ==========================================
// 상세 통계 조회 (Detailed Analytics) Logic
// ==========================================

let detailInitialized = false;
let detailStartDate = new Date();
let detailEndDate = new Date();
let detailPeriod = 'hourly';

function initAnalyticsDetail() {
    if (detailInitialized) {
        loadDetailData();
        return;
    }

    // Default to Today
    const today = new Date();
    detailStartDate = new Date(today);
    detailEndDate = new Date(today);
    updateDetailDateDisplay();

    // Store List
    loadDetailStoreList();

    // Quick Buttons Listeners
    const quickButtons = document.querySelectorAll('#detailDateQuickGroups .toss-choice-chip');
    quickButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            quickButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const range = this.getAttribute('data-range');
            setDetailDateRange(range);
        });
    });

    // Date Pickers Listeners
    const startInput = document.getElementById('detailStartDateInput');
    const endInput = document.getElementById('detailEndDateInput');

    if (startInput) {
        startInput.addEventListener('change', function () {
            if (this.value) {
                detailStartDate = new Date(this.value);
                updateDetailDateDisplay();
                loadDetailData();
                quickButtons.forEach(b => b.classList.remove('active'));
            }
        });
    }
    if (endInput) {
        endInput.addEventListener('change', function () {
            if (this.value) {
                detailEndDate = new Date(this.value);
                updateDetailDateDisplay();
                loadDetailData();
                quickButtons.forEach(b => b.classList.remove('active'));
            }
        });
    }

    detailInitialized = true;
    loadDetailData(); // Initial load
}

function loadDetailStoreList() {
    const select = document.getElementById('detailStoreFilter');
    if (!select) return;

    // If storesData is available
    if (storesData && storesData.length > 0) {
        select.innerHTML = '<option value="">전체 매장</option>';
        storesData.forEach(store => {
            const opt = document.createElement('option');
            opt.value = store.id;
            opt.textContent = store.name;
            select.appendChild(opt);
        });
    } else {
        // Fallback: copy from analyticsStoreFilter if populated
        const source = document.getElementById('analyticsStoreFilter');
        if (source && source.options.length > 1) {
            select.innerHTML = source.innerHTML;
        }
    }
}


function setDetailDateRange(range) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (range) {
        case 'yesterday':
            detailStartDate = new Date(today);
            detailStartDate.setDate(today.getDate() - 1);
            detailEndDate = new Date(detailStartDate);
            break;
        case 'today':
            detailStartDate = new Date(today);
            detailEndDate = new Date(today);
            break;
        case 'last_week':
            const day = today.getDay();
            const diff = today.getDate() - day + (day == 0 ? -6 : 1) - 7; // Last Monday
            detailStartDate = new Date(today.setDate(diff));
            detailEndDate = new Date(detailStartDate);
            detailEndDate.setDate(detailStartDate.getDate() + 6);
            break;
        case 'this_week':
            const d = new Date();
            const day1 = d.getDay();
            const diff1 = d.getDate() - day1 + (day1 == 0 ? -6 : 1); // Monday
            detailStartDate = new Date(d.setDate(diff1));
            detailEndDate = new Date();
            break;
        case 'this_month':
            detailStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
            detailEndDate = new Date();
            break;
    }
    updateDetailDateDisplay();
    loadDetailData();
}

function updateDetailDateDisplay() {
    const startEl = document.getElementById('detailStartDateDisplay');
    const endEl = document.getElementById('detailEndDateDisplay');
    const simpleFormat = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    if (startEl) startEl.textContent = simpleFormat(detailStartDate);
    if (endEl) endEl.textContent = simpleFormat(detailEndDate);
}

function openDetailStartDatePicker() {
    const el = document.getElementById('detailStartDateInput');
    if (el) el.showPicker ? el.showPicker() : el.click();
}
function openDetailEndDatePicker() {
    const el = document.getElementById('detailEndDateInput');
    if (el) el.showPicker ? el.showPicker() : el.click();
}
function resetDetailDate() {
    setDetailDateRange('today');
}

function switchDetailTab(period) {
    detailPeriod = period;
    document.querySelectorAll('#analyticsDetailContainer .toss-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${period}`)?.classList.add('active');

    const headerRow = document.getElementById('detailTableHeader');
    if (headerRow) {
        let firstCol = '시간';
        if (period === 'daily') firstCol = '일자';
        if (period === 'weekly') firstCol = '주차';
        if (period === 'monthly') firstCol = '월';
        headerRow.cells[0].textContent = firstCol;
    }

    loadDetailData();
}

async function loadDetailData() {
    const tableBody = document.getElementById('detailTableBody');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">데이터 로딩 중...</td></tr>';

    try {
        const params = new URLSearchParams();
        const simpleFormat = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        params.append('start_date', simpleFormat(detailStartDate));
        params.append('end_date', simpleFormat(detailEndDate));

        const storeId = document.getElementById('detailStoreFilter')?.value;
        if (storeId) params.append('store_id', storeId);

        params.append('period', detailPeriod);

        const response = await fetch(`${API_BASE}/franchise/stats/dashboard?${params}`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            renderDetailTable(data);
        } else {
            console.error('Failed to load detail stats');
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">데이터 로드 실패</td></tr>';
        }
    } catch (e) {
        console.error(e);
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">오류 발생</td></tr>';
    }
}

function renderDetailTable(data) {
    const tableBody = document.getElementById('detailTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const list = data.hourly_stats || [];

    if (list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #b0b8c1;">데이터가 없습니다.</td></tr>';
        return;
    }

    const storeSel = document.getElementById('detailStoreFilter');
    const storeNameDisplay = (storeSel && storeSel.selectedIndex >= 0) ? storeSel.options[storeSel.selectedIndex].text : '전체 매장';

    list.forEach(item => {
        let timeLabel = item.period;
        if (detailPeriod === 'hourly' && item.period.length <= 2) timeLabel = `${item.period}시`;

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f2f4f6';
        tr.innerHTML = `
            <td style="padding: 14px 24px; color: #333d4b;">${timeLabel}</td>
            <td style="padding: 14px; color: #4e5968;">${storeNameDisplay}</td>
            <td style="padding: 14px; text-align: right; font-weight: 500;">${(item.waiting || 0).toLocaleString()}</td>
            <td style="padding: 14px; text-align: right;">${(item.attendance || 0).toLocaleString()}</td>
            <td style="padding: 14px; text-align: right;">${(item.cancelled || 0).toLocaleString()}</td>
            <td style="padding: 14px; text-align: right;">${item.avg_wait || 0}분</td>
        `;
        tableBody.appendChild(tr);
    });
}


// ==========================================
// Custom Dual Calendar Logic
// ==========================================

let calViewDate = new Date(); // Tracks the Year/Month of Left Calendar
let calSelection = { start: null, end: null, state: 'none' };
const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

function toggleDualCalendar() {
    const el = document.getElementById('dualCalendarContainer');
    if (!el) return;

    if (el.style.display === 'none') {
        el.style.display = 'block';
        // Init view with current Start Date or Today
        calViewDate = new Date(detailStartDate || new Date());
        calViewDate.setDate(1); // First day of month

        // Sync selection state
        calSelection.start = new Date(detailStartDate);
        calSelection.end = new Date(detailEndDate);
        calSelection.state = 'end'; // Range fully selected

        renderDualCalendar();

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', closeCalOnClickOutside);
        }, 0);
    } else {
        el.style.display = 'none';
        document.removeEventListener('click', closeCalOnClickOutside);
    }
}

function closeCalOnClickOutside(e) {
    const cal = document.getElementById('dualCalendarContainer');
    const trigger = document.querySelector('.toss-date-picker-trigger')?.parentElement?.parentElement; // The relative wrapper
    if (cal && !cal.contains(e.target) && (!trigger || !trigger.contains(e.target))) { // Fix: ensure trigger check is safe
        // Only close if click is NOT on the trigger area
        // The trigger area onclick toggles it, but if we click outside we want to close.
        // Let's refine: if click target is not inside container -> close.
        cal.style.display = 'none';
        document.removeEventListener('click', closeCalOnClickOutside);
    }
}

function calPrevMonth(e) {
    e.stopPropagation();
    calViewDate.setMonth(calViewDate.getMonth() - 1);
    renderDualCalendar();
}
function calNextMonth(e) {
    e.stopPropagation();
    calViewDate.setMonth(calViewDate.getMonth() + 1);
    renderDualCalendar();
}

function renderDualCalendar() {
    const leftDate = new Date(calViewDate);
    const rightDate = new Date(calViewDate);
    rightDate.setMonth(rightDate.getMonth() + 1);

    document.getElementById('calTitleLeft').textContent = `${leftDate.getFullYear()}년 ${leftDate.getMonth() + 1}월`;
    document.getElementById('calTitleRight').textContent = `${rightDate.getFullYear()}년 ${rightDate.getMonth() + 1}월`;

    renderCalGrid('calGridLeft', leftDate.getFullYear(), leftDate.getMonth());
    renderCalGrid('calGridRight', rightDate.getFullYear(), rightDate.getMonth());
}

function renderCalGrid(elementId, year, month) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // Weekdays Header
    weekDays.forEach(day => {
        const d = document.createElement('div');
        d.className = 'calendar-weekday';
        d.textContent = day;
        grid.appendChild(d);
    });

    // Days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
        const d = document.createElement('div');
        d.className = 'calendar-day empty';
        grid.appendChild(d);
    }

    // Day cells
    for (let i = 1; i <= totalDays; i++) {
        const d = document.createElement('div');
        d.className = 'calendar-day';
        d.textContent = i;

        const currentD = new Date(year, month, i);
        currentD.setHours(0, 0, 0, 0);

        // CSS Classes for Selection
        const s = calSelection.start ? new Date(calSelection.start) : null;
        if (s) s.setHours(0, 0, 0, 0);

        const e = calSelection.end ? new Date(calSelection.end) : null;
        if (e) e.setHours(0, 0, 0, 0);

        // Selected Start
        if (s && currentD.getTime() === s.getTime()) {
            d.classList.add('selected', 'range-start');
        }

        // Selected End
        if (e && currentD.getTime() === e.getTime()) {
            d.classList.add('selected', 'range-end');
        }

        // In Range
        if (s && e && currentD > s && currentD < e) {
            d.classList.add('in-range');
        }

        d.onclick = (evt) => {
            evt.stopPropagation();
            handleCalDaySelect(year, month, i);
        };

        grid.appendChild(d);
    }

    container.appendChild(grid);
}

function handleCalDaySelect(year, month, day) {
    const selected = new Date(year, month, day);

    if (calSelection.state === 'none' || calSelection.state === 'end') {
        // Start new selection
        calSelection.start = selected;
        calSelection.end = null;
        calSelection.state = 'start';
    } else if (calSelection.state === 'start') {
        if (selected < calSelection.start) {
            // New start
            calSelection.start = selected;
        } else {
            // End selection
            calSelection.end = selected;
            calSelection.state = 'end';

            // Apply Selection
            applyCalSelection();
        }
    }
    renderDualCalendar();
}

function applyCalSelection() {
    if (calSelection.start && calSelection.end) {
        detailStartDate = new Date(calSelection.start);
        detailEndDate = new Date(calSelection.end);

        updateDetailDateDisplay();
        loadDetailData();

        // Clear active quick buttons
        document.querySelectorAll('#detailDateQuickGroups .toss-choice-chip').forEach(b => b.classList.remove('active'));

        // Hide calendar
        document.getElementById('dualCalendarContainer').style.display = 'none';
        document.removeEventListener('click', closeCalOnClickOutside);
    }
}
// ==========================================
// 공지사항 관리 (Notices)
// ==========================================

async function loadNotices() {
    try {
        const res = await fetch('/api/notices', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed');
        const notices = await res.json();
        renderNoticeList(notices);
    } catch (e) {
        console.error(e);
    }
}

function renderNoticeList(notices) {
    const tbody = document.getElementById('noticeListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (notices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color:#8b95a1;">등록된 공지사항이 없습니다.</td></tr>';
        return;
    }

    notices.forEach((n, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'notice-row';
        tr.onclick = () => toggleNoticeDetails(n.id);

        let targetText = '전체 매장';
        if (n.target_type === 'selected') targetText = '일부 매장';

        tr.innerHTML = `
            <td style="text-align: center;">${notices.length - idx}</td>
            <td style="font-weight: 600;">${n.title}</td>
            <td><span class="toss-badge ${n.target_type === 'all' ? 'blue' : 'gray'}">${targetText}</span></td>
            <td>${n.author_name || '관리자'}</td>
            <td>${new Date(n.created_at).toLocaleDateString()}</td>
            <td style="text-align: center;">
                <span class="toss-badge" style="color:#333;">게시중</span> 
            </td>
        `;

        const trDetail = document.createElement('tr');
        trDetail.id = `noticeDetail-${n.id}`;
        trDetail.className = 'notice-details-row';
        trDetail.innerHTML = `
            <td colspan="6">
                <div class="notice-details-content">${n.content}</div>
                <!-- Delete Button Could Go Here -->
            </td>
        `;

        tbody.appendChild(tr);
        tbody.appendChild(trDetail);
    });
}

function toggleNoticeDetails(id) {
    const row = document.getElementById(`noticeDetail-${id}`);
    if (row) {
        row.style.display = row.style.display === 'table-row' ? 'none' : 'table-row';
    }
}

function openNoticeModal() {
    document.getElementById('noticeModal').style.display = 'block';
    document.getElementById('noticeModalBackdrop').style.display = 'block';

    // Load stores just in case selector is needed
    loadNoticeStoreList();
}

function closeNoticeModal() {
    document.getElementById('noticeModal').style.display = 'none';
    document.getElementById('noticeModalBackdrop').style.display = 'none';
    // Reset inputs
    document.getElementById('noticeTitleInput').value = '';
    document.getElementById('noticeContentInput').value = '';
    document.querySelector('input[name="noticeTarget"][value="all"]').checked = true;
    toggleNoticeStoreSelect();
}

function toggleNoticeStoreSelect() {
    const type = document.querySelector('input[name="noticeTarget"]:checked').value;
    const selector = document.getElementById('noticeStoreSelector');
    if (type === 'selected') {
        selector.style.display = 'block';
    } else {
        selector.style.display = 'none';
    }
}

async function loadNoticeStoreList() {
    const selector = document.getElementById('noticeStoreSelector');
    if (selector.children.length > 0) return; // Already loaded

    try {
        const res = await fetch('/api/stores', { headers: getAuthHeaders() });
        const stores = await res.json();

        stores.forEach(s => {
            const div = document.createElement('div');
            div.style.marginBottom = '6px';
            div.innerHTML = `
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" name="noticeStoreCheck" value="${s.id}">
                    <span style="font-size: 14px;">${s.name} (${s.code})</span>
                </label>
            `;
            selector.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function submitNotice() {
    const title = document.getElementById('noticeTitleInput').value.trim();
    const content = document.getElementById('noticeContentInput').value.trim();
    if (!title || !content) {
        alert('제목과 내용을 입력해주세요.');
        return;
    }

    const targetType = document.querySelector('input[name="noticeTarget"]:checked').value;
    let targetStoreIds = [];

    if (targetType === 'selected') {
        const checks = document.querySelectorAll('input[name="noticeStoreCheck"]:checked');
        checks.forEach(c => targetStoreIds.push(parseInt(c.value)));
        if (targetStoreIds.length === 0) {
            alert('대상 매장을 선택해주세요.');
            return;
        }
    }

    const payload = {
        title,
        content,
        target_type: targetType,
        target_store_ids: targetStoreIds,
        is_active: true
    };

    try {
        const res = await fetch('/api/notices/', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('공지사항이 등록되었습니다.');
            closeNoticeModal();
            loadNotices();
        } else {
            alert('등록 실패');
        }
    } catch (e) {
        console.error(e);
        alert('오류 발생');
    }
}
