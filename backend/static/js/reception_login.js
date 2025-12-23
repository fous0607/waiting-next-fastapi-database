        function encodePassword(password) {
            return btoa(encodeURIComponent(password));
        }

        function decodePassword(encoded) {
            try {
                return decodeURIComponent(atob(encoded));
            } catch (e) {
                return '';
            }
        }

        // 페이지 로드 시 저장된 로그인 정보 불러오기
        window.addEventListener('DOMContentLoaded', function () {
            // 아이디 저장 확인
            const saveId = localStorage.getItem('reception_save_id') === 'true';
            const savedUsername = localStorage.getItem('reception_username');

            // 로그인 정보 저장(비밀번호 포함) 확인
            const rememberMe = localStorage.getItem('reception_remember_me') === 'true';
            const savedPassword = localStorage.getItem('reception_password');

            // 아이디 저장 로직
            if (saveId && savedUsername) {
                document.getElementById('username').value = savedUsername;
                document.getElementById('saveId').checked = true;
            }

            // 로그인 정보 저장 로직 (비밀번호 복구 및 아이디 강제 설정)
            if (rememberMe) {
                document.getElementById('rememberMe').checked = true;

                // 로그인 정보 저장이 체크되어 있으면 아이디도 자동으로 채워져야 함 (만약 위에서 안채워졌다면)
                if (savedUsername) {
                    document.getElementById('username').value = savedUsername;
                    // 편의상 아이디 저장 체크박스도 같이 체크해주는 것이 자연스러움
                    document.getElementById('saveId').checked = true;
                }

                if (savedPassword) {
                    document.getElementById('password').value = decodePassword(savedPassword);
                }
            }
        });

        // 체크박스 이벤트 리스너는 필수는 아니지만, 즉각적인 스토리지 정리를 원한다면 추가 가능. 
        // 여기서는 로그인 시점에 일괄 처리하므로 생략하거나 유지.


        async function handleLogin(event) {
            event.preventDefault();

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            const loginBtn = document.getElementById('loginBtn');
            const errorMessage = document.getElementById('errorMessage');

            if (!username || !password) {
                showError('사용자명과 비밀번호를 입력해주세요');
                return;
            }

            // 로딩 상태
            loginBtn.disabled = true;
            loginBtn.classList.add('loading');
            errorMessage.classList.remove('show');

            try {
                // 로그인 API 호출
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

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('사용자명 또는 비밀번호가 올바르지 않습니다');
                    }
                    throw new Error('로그인에 실패했습니다');
                }

                const data = await response.json();

                // 1. 아이디 저장 처리
                const saveId = document.getElementById('saveId').checked;
                if (saveId) {
                    localStorage.setItem('reception_save_id', 'true');
                    localStorage.setItem('reception_username', username);
                } else {
                    localStorage.removeItem('reception_save_id');
                    // 주의: 로그인 정보 저장(rememberMe)이 체크되어 있다면 username을 삭제하면 안 될 수 있음.
                    // 하지만 보통 '아이디 저장'을 끄면 아이디 저장을 안 하겠다는 뜻.
                    // 여기서는 rememberMe가 켜져있으면 username은 유지해야 하므로 아래 로직에서 덮어씀.
                    if (!rememberMe) {
                        localStorage.removeItem('reception_username');
                    }
                }

                // 2. 로그인 정보 저장 처리 (비밀번호)
                if (rememberMe) {
                    localStorage.setItem('reception_remember_me', 'true');
                    localStorage.setItem('reception_username', username); // 기입 보장
                    localStorage.setItem('reception_password', encodePassword(password));
                    // 편의상 아이디 저장 플래그도 true로 설정할 수 있으나, 독립적으로 관리
                } else {
                    localStorage.removeItem('reception_remember_me');
                    localStorage.removeItem('reception_password');
                    // username은 saveId가 false일 때만 위에서 삭제됨.
                }

                // 토큰 저장
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('token_type', data.token_type);



                // 사용자 정보 조회하여 매장 정보 저장
                const userResponse = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${data.access_token}`
                    }
                });

                if (userResponse.ok) {
                    const user = await userResponse.json();

                    // 매장 관리자인 경우 매장 정보 저장
                    if (user.store_id) {
                        localStorage.setItem('selected_store_id', user.store_id);

                        // 매장 정보 조회
                        const storeResponse = await fetch(`/api/stores/${user.store_id}`, {
                            headers: {
                                'Authorization': `Bearer ${data.access_token}`
                            }
                        });

                        if (storeResponse.ok) {
                            const store = await storeResponse.json();
                            localStorage.setItem('selected_store_name', store.name);
                            localStorage.setItem('selected_store_code', store.code);
                        }
                    }
                }

                // 대기접수 화면으로 리다이렉트
                window.location.href = '/reception';

            } catch (error) {
                console.error('Login error:', error);
                showError(error.message || '로그인 중 오류가 발생했습니다');
                loginBtn.disabled = false;
                loginBtn.classList.remove('loading');
            }
        }

        function showError(message) {
            const errorMessage = document.getElementById('errorMessage');
            errorMessage.textContent = message;
            errorMessage.classList.add('show');

            setTimeout(() => {
                errorMessage.classList.remove('show');
            }, 3000);
        }

        // Enter 키 지원
        document.getElementById('password').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                handleLogin(e);
            }
        });
