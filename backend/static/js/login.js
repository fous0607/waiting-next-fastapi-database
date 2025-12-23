const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const alertBox = document.getElementById('alert');

function showAlert(message, type = 'info') {
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    alertBox.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 3000);
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const username = usernameInput.value;
    const password = passwordInput.value;
    const saveId = document.getElementById('saveId').checked;
    const savePw = document.getElementById('savePw').checked;

    if (!username || !password) {
        showAlert('사용자명과 비밀번호를 입력해주세요.', 'error');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '로그인 중...';
    alertBox.style.display = 'none';

    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // 토큰 저장 (세션용)
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('username', username);

            // 아이디/비밀번호 저장 (옵션)
            if (saveId) {
                localStorage.setItem('saved_username', username);
                localStorage.setItem('remember_id', 'true');
            } else {
                localStorage.removeItem('saved_username');
                localStorage.removeItem('remember_id');
            }

            if (savePw) {
                localStorage.setItem('saved_password', password);
                localStorage.setItem('remember_pw', 'true');
            } else {
                localStorage.removeItem('saved_password');
                localStorage.removeItem('remember_pw');
            }

            showAlert('로그인 성공! 페이지를 이동합니다...', 'success');

            // 사용자 정보 가져오기 및 리다이렉트 (기존 로직 유지)
            setTimeout(async () => {
                try {
                    const userResponse = await fetch('/api/auth/me', {
                        headers: {
                            'Authorization': `Bearer ${data.access_token}`
                        }
                    });

                    if (userResponse.ok) {
                        const currentUser = await userResponse.json();

                        if (currentUser) {
                            localStorage.setItem('user_role', currentUser.role);

                            // 역할에 따라 다른 페이지로 이동
                            if (currentUser.role === 'system_admin') {
                                window.location.href = '/superadmin';
                            } else if (currentUser.role === 'franchise_admin' || currentUser.role === 'franchise_manager') {
                                if (currentUser.franchise_id) {
                                    window.location.href = `/admin?franchise_id=${currentUser.franchise_id}`;
                                } else {
                                    window.location.href = '/admin';
                                }
                            } else if (currentUser.role === 'store_admin') {
                                if (currentUser.store_id) {
                                    try {
                                        const storeResponse = await fetch(`/api/stores/${currentUser.store_id}`, {
                                            headers: {
                                                'Authorization': `Bearer ${data.access_token}`
                                            }
                                        });
                                        if (storeResponse.ok) {
                                            const store = await storeResponse.json();
                                            if (store && store.code) {
                                                window.location.href = `/dashboard?store=${store.code}`;
                                            } else {
                                                window.location.href = '/dashboard';
                                            }
                                        } else {
                                            window.location.href = '/dashboard';
                                        }
                                    } catch (e) {
                                        console.error('매장 정보 조회 실패:', e);
                                        window.location.href = '/dashboard';
                                    }
                                } else {
                                    window.location.href = '/dashboard';
                                }
                            }
                        }
                    } else {
                        window.location.href = '/login';
                    }
                } catch (error) {
                    window.location.href = '/login';
                }
            }, 1000);
        } else {
            showAlert(data.detail || '로그인에 실패했습니다.', 'error');
            loginBtn.disabled = false;
            loginBtn.textContent = '로그인';
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('서버 연결에 실패했습니다.', 'error');
        loginBtn.disabled = false;
        loginBtn.textContent = '로그인';
    }
});

// 페이지 로드 시 초기화 및 저장된 정보 로드
window.addEventListener('load', () => {
    // 1. 기존 세션 정보 삭제 (자동 로그인 방지)
    // 사용자가 명시적으로 /login에 접속했거나 로그아웃 후 리다이렉트 된 경우입니다.
    // 따라서 기존 토큰이 있어도 삭제하거나 무시하여 로그인 창을 보여주는 것이 맞습니다.
    // 만약 '자동 로그인' 기능을 원한다면 이 부분을 수정해야 하지만, 
    // 현재 요청사항(주소 입력 -> 로그인 창)에 따르면 항상 로그인 창이 뜨는 것이 안전합니다.

    // localStorage.removeItem('access_token'); // -> 삭제하면 대시보드 접근시 재로그인 필요. 
    // 대시보드 접근 권한이 없어서 튕겨나온 경우라면 삭제가 맞음.
    // 하지만 실수로 로그인 페이지 왔다면?
    // 일단 안전하게, 로그인 페이지에서는 아무런 자동 리다이렉트를 하지 않고 폼만 보여줍니다.
    // 사용자가 '로그인' 버튼을 눌러야 이동합니다.

    localStorage.removeItem('username');
    localStorage.removeItem('user_role');

    // 2. 저장된 아이디/비밀번호 불러오기
    const savedUsername = localStorage.getItem('saved_username');
    const rememberId = localStorage.getItem('remember_id');
    const savedPassword = localStorage.getItem('saved_password');
    const rememberPw = localStorage.getItem('remember_pw');

    if (rememberId === 'true' && savedUsername) {
        document.getElementById('username').value = savedUsername;
        document.getElementById('saveId').checked = true;
    }

    if (rememberPw === 'true' && savedPassword) {
        document.getElementById('password').value = savedPassword;
        document.getElementById('savePw').checked = true;
    }
});

