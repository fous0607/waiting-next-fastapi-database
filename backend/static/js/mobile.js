        // Helper function to get headers with store ID
        function getHeaders(additionalHeaders = {}) {
            const headers = { ...additionalHeaders };
            const storeId = localStorage.getItem('selected_store_id');
            if (storeId) {
                headers['X-Store-Id'] = storeId;
            }
            return headers;
        }

        let phoneNumber = '';
        let storeSettings = null;

        async function loadStoreInfo() {
            try {
                const response = await fetch('/api/store/', { headers: getHeaders() });
                storeSettings = await response.json();
                document.getElementById('storeName').textContent = storeSettings.store_name;
                // waitingStatus 로드 제거 (사용자 요청)
            } catch (error) {
                console.error('매장 정보 조회 실패:', error);
            }
        }

        async function updateDate() {
            try {
                const response = await fetch('/api/daily/check-status', { headers: getHeaders() });
                const status = await response.json();

                if (status && status.business_date) {
                    const dateObj = new Date(status.business_date);
                    const year = dateObj.getFullYear();
                    const month = dateObj.getMonth() + 1;
                    const day = dateObj.getDate();
                    document.getElementById('currentDate').textContent = `${year}년 ${month}월 ${day}일`;
                } else {
                    const now = new Date();
                    document.getElementById('currentDate').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
                }
            } catch (error) {
                console.error('영업일 조회 실패:', error);
                const now = new Date();
                document.getElementById('currentDate').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
            }
        }

        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

            if (tab === 'register') {
                document.querySelectorAll('.tab')[0].classList.add('active');
                document.getElementById('registerTab').classList.add('active');
            } else {
                document.querySelectorAll('.tab')[1].classList.add('active');
                document.getElementById('searchTab').classList.add('active');
            }
        }

        function inputNumber(num) {
            if (phoneNumber.length < 8) {
                phoneNumber += num;
                updateDisplay();
            }
        }

        function backspace() {
            if (phoneNumber.length > 0) {
                phoneNumber = phoneNumber.slice(0, -1);
                updateDisplay();
            }
        }

        function clearInput() {
            phoneNumber = '';
            updateDisplay();
            document.getElementById('registerResult').style.display = 'none';
        }

        function updateDisplay() {
            const display = document.getElementById('phoneDisplay');
            const submitBtn = document.getElementById('submitBtn');

            if (phoneNumber.length === 0) {
                display.textContent = '____-____';
                submitBtn.disabled = true;
            } else if (phoneNumber.length <= 4) {
                const part1 = phoneNumber.padEnd(4, '_');
                display.textContent = `${part1}-____`;
                submitBtn.disabled = true;
            } else {
                const part1 = phoneNumber.substring(0, 4);
                const part2 = phoneNumber.substring(4).padEnd(4, '_');
                display.textContent = `${part1}-${part2}`;
                submitBtn.disabled = phoneNumber.length !== 8;
            }
        }

        async function submitReception() {
            if (phoneNumber.length !== 8) {
                alert('핸드폰번호 8자리를 입력해주세요.');
                return;
            }

            const fullPhone = '010' + phoneNumber;
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = '접수 중...';

            try {
                const response = await fetch('/api/waiting/register', {
                    method: 'POST',
                    headers: getHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        phone: fullPhone
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    showRegisterResult(result);
                } else {
                    const error = await response.json();
                    alert(error.detail || '접수에 실패했습니다.');
                }
            } catch (error) {
                console.error('접수 실패:', error);
                alert('접수 중 오류가 발생했습니다.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '대기 접수';
            }
        }

        function showRegisterResult(result) {
            // 조회 탭으로 전환
            switchTab('search');

            // 조회 결과 표시
            const phoneInput = document.getElementById('phoneDisplay').textContent.replace('010-', '').replace(/-/g, '').replace(/_/g, '');
            document.getElementById('searchPhone').value = phoneInput.substring(0, 4) + (phoneInput.length > 4 ? '-' + phoneInput.substring(4, 8) : '');

            // 대기 정보 표시
            document.getElementById('searchResultNumber').textContent = `${result.waiting_number}번`;
            document.getElementById('searchResultClass').textContent = result.class_name;
            document.getElementById('searchResultDetail').textContent = `${result.class_order}번째 대기`;
            document.getElementById('searchResult').style.display = 'block';
            document.getElementById('searchEmpty').style.display = 'none';

            // 접수 폼 초기화
            phoneNumber = '';
            updateDisplay();
            document.getElementById('registerResult').style.display = 'none';
        }

        async function searchWaiting() {
            let searchPhone = document.getElementById('searchPhone').value.replace(/-/g, '');
            // 숫자만 남기기
            searchPhone = searchPhone.replace(/[^0-9]/g, '');

            if (searchPhone.length !== 8) {
                alert('핸드폰번호 8자리를 입력해주세요.');
                return;
            }

            const fullPhone = '010' + searchPhone;

            try {
                const response = await fetch(`/api/waiting/check/${fullPhone}`, { headers: getHeaders() });
                const result = await response.json();

                if (result.found) {
                    document.getElementById('searchResultNumber').textContent = `${result.waiting_number}번`;
                    document.getElementById('searchResultClass').textContent = result.class_name;
                    document.getElementById('searchResultDetail').textContent = `앞에 ${result.ahead_count}명 대기 중`;
                    document.getElementById('searchResult').style.display = 'block';
                    document.getElementById('searchEmpty').style.display = 'none';
                } else {
                    document.getElementById('searchResult').style.display = 'none';
                    document.getElementById('searchEmpty').style.display = 'block';
                }
            } catch (error) {
                console.error('조회 실패:', error);
                alert('조회 중 오류가 발생했습니다.');
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

        // 화면 높이에 따른 자동 레이아웃 조정
        function adjustLayout() {
            const height = window.innerHeight;
            const container = document.querySelector('.mobile-container');

            // 작은 화면 (예: 키보드가 올라오거나 작은 폰)
            if (height < 600) {
                container.classList.add('compact-mode');
            } else {
                container.classList.remove('compact-mode');
            }
        }

        // 초기 로드
        async function init() {
            // 레이아웃 조정 리스너 등록
            window.addEventListener('resize', adjustLayout);
            adjustLayout();

            await checkUrlStoreParam();
            loadStoreInfo();
            updateDate();
            updateDisplay();
        }

        init();

        // 조회 탭 전화번호 포맷팅
        document.getElementById('searchPhone').addEventListener('input', function (e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length > 4) {
                value = value.slice(0, 4) + '-' + value.slice(4, 8);
            }
            e.target.value = value;
        });
