        let members = [];
        let currentMemberId = null;
        let validMembers = [];

        function showNotification(message) {
            document.getElementById('notificationMessage').textContent = message;
            document.getElementById('notificationModal').classList.add('active');
        }

        // Helper function to get headers with store ID
        function getHeaders(additionalHeaders = {}) {
            const headers = { ...additionalHeaders };
            const storeId = localStorage.getItem('selected_store_id');
            if (storeId) {
                headers['X-Store-Id'] = storeId;
            }
            return headers;
        }

        async function loadMembers() {
            const table = document.getElementById('membersTable');
            // 초기 로드 시 안내 메시지만 표시
            table.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <p>이름 또는 핸드폰번호로 회원을 검색하세요</p>
                </div>
            `;
        }

        function renderMembers(data) {
            const table = document.getElementById('membersTable');

            if (data.length === 0) {
                table.innerHTML = '<div class="empty-state"><div class="icon">👥</div><p>등록된 회원이 없습니다</p></div>';
                return;
            }

            table.innerHTML = '';
            data.forEach((member, idx) => {
                const item = document.createElement('div');
                item.className = 'member-item';

                const date = new Date(member.created_at);
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                // 핸드폰 번호 포맷팅 (010-0000-0000)
                let formattedPhone = member.phone;
                if (member.phone.length === 11) {
                    formattedPhone = member.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
                }

                item.innerHTML = `
                    <div class="member-number">${idx + 1}</div>
                    <div class="member-info">
                        <div class="name">${member.name}</div>
                        <div class="date">등록일: ${dateStr}</div>
                    </div>
                    <div style="font-family: monospace; color: #7f8c8d;">${member.barcode || '-'}</div>
                    <div class="member-phone">${formattedPhone}</div>
                    <div class="member-actions">
                        <button class="btn btn-sm btn-primary" onclick="openEditModal(${member.id})">수정</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteMember(${member.id})">삭제</button>
                    </div>
                `;
                table.appendChild(item);
            });
        }

        async function searchMembers() {
            const searchText = document.getElementById('searchInput').value.trim();

            if (!searchText) {
                alert('검색어를 입력해주세요.');
                return;
            }

            const table = document.getElementById('membersTable');
            table.innerHTML = '<div class="loading"><div class="spinner"></div><p>검색 중...</p></div>';

            try {
                const response = await fetch(`/api/members/?search=${encodeURIComponent(searchText)}&limit=1000`, {
                    headers: getHeaders()
                });
                const data = await response.json();

                // 검색 결과를 members 배열에 저장 (수정 시 사용)
                members = data;

                if (data.length === 0) {
                    table.innerHTML = `
                        <div class="empty-state">
                            <div class="icon">🔍</div>
                            <p>검색 결과가 없습니다</p>
                        </div>
                    `;
                } else {
                    renderMembers(data);
                }
            } catch (error) {
                console.error('검색 실패:', error);
                table.innerHTML = '<div class="empty-state"><p>검색 중 오류가 발생했습니다</p></div>';
            }
        }

        function handleSearchKeyup(event) {
            if (event.key === 'Enter') {
                searchMembers();
            }
        }

        function openAddModal() {
            currentMemberId = null;
            document.getElementById('modalTitle').textContent = '회원 등록';
            document.getElementById('memberName').value = '';
            document.getElementById('memberPhone').value = '';
            document.getElementById('memberBarcode').value = '';
            document.getElementById('memberModal').classList.add('active');
        }

        function openEditModal(memberId) {
            const member = members.find(m => m.id === memberId);
            if (!member) return;

            currentMemberId = memberId;
            document.getElementById('modalTitle').textContent = '회원 수정';
            document.getElementById('memberName').value = member.name;
            // 010을 제외한 나머지 부분만 표시 (010XXXXXXXX -> XXXX-XXXX)
            const phoneWithoutPrefix = member.phone.substring(3);
            const formatted = phoneWithoutPrefix.length === 8
                ? phoneWithoutPrefix.substring(0, 4) + '-' + phoneWithoutPrefix.substring(4)
                : phoneWithoutPrefix;
            document.getElementById('memberPhone').value = formatted;
            document.getElementById('memberBarcode').value = member.barcode || '';
            document.getElementById('memberModal').classList.add('active');
        }

        async function saveMember(event) {
            event.preventDefault();

            const name = document.getElementById('memberName').value.trim();
            const phoneInput = document.getElementById('memberPhone').value.trim().replace(/-/g, '');
            const barcode = document.getElementById('memberBarcode').value.trim() || null;

            if (!name || !phoneInput) {
                alert('모든 항목을 입력해주세요.');
                return;
            }

            // 8자리 숫자인지 확인
            if (!/^\d{8}$/.test(phoneInput)) {
                alert('핸드폰번호를 정확히 입력해주세요. (8자리 숫자)');
                return;
            }

            // 010을 앞에 붙여서 완전한 번호 생성
            const phone = '010' + phoneInput;

            try {
                let response;
                if (currentMemberId) {
                    // 수정
                    response = await fetch(`/api/members/${currentMemberId}`, {
                        method: 'PUT',
                        headers: getHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ name, phone, barcode })
                    });
                } else {
                    // 등록
                    response = await fetch('/api/members/', {
                        method: 'POST',
                        headers: getHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ name, phone, barcode })
                    });
                }

                if (response.ok) {
                    showNotification('저장되었습니다.');
                    closeModal('memberModal');
                    // 검색어가 있으면 다시 검색, 없으면 초기 화면
                    const searchText = document.getElementById('searchInput').value.trim();
                    if (searchText) {
                        searchMembers();
                    } else {
                        loadMembers();
                    }
                } else {
                    const error = await response.json();
                    alert(error.detail || '저장에 실패했습니다.');
                }
            } catch (error) {
                console.error('저장 실패:', error);
                alert('저장 중 오류가 발생했습니다.');
            }
        }

        async function deleteMember(memberId) {
            const member = members.find(m => m.id === memberId);
            if (!confirm(`${member.name} 회원을 삭제하시겠습니까?`)) return;

            try {
                const response = await fetch(`/api/members/${memberId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    showNotification('삭제되었습니다.');
                    // 검색어가 있으면 다시 검색, 없으면 초기 화면
                    const searchText = document.getElementById('searchInput').value.trim();
                    if (searchText) {
                        searchMembers();
                    } else {
                        loadMembers();
                    }
                } else {
                    const error = await response.json();
                    alert(error.detail || '삭제에 실패했습니다.');
                }
            } catch (error) {
                console.error('삭제 실패:', error);
                alert('삭제 중 오류가 발생했습니다.');
            }
        }

        function openExcelModal() {
            document.getElementById('excelFile').value = '';
            document.getElementById('excelResult').style.display = 'none';
            document.getElementById('excelModal').classList.add('active');
        }

        async function uploadExcel() {
            const fileInput = document.getElementById('excelFile');
            if (!fileInput.files.length) {
                alert('파일을 선택해주세요.');
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            try {
                const response = await fetch('/api/members/upload-excel', {
                    method: 'POST',
                    headers: getHeaders(),
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    showExcelResult(result);
                } else {
                    const error = await response.json();
                    alert(error.detail || '파일 처리에 실패했습니다.');
                }
            } catch (error) {
                console.error('업로드 실패:', error);
                alert('업로드 중 오류가 발생했습니다.');
            }
        }

        function showExcelResult(result) {
            validMembers = result.valid_members;

            document.getElementById('excelSummary').innerHTML = `
                총 <strong>${result.total_count}</strong>개 항목 중
                <strong style="color:#27ae60;">${result.valid_count}개 유효</strong>,
                <strong style="color:#e74c3c;">${result.invalid_count}개 오류</strong>
            `;

            if (result.invalid_count > 0) {
                const tbody = document.getElementById('invalidTableBody');
                tbody.innerHTML = '';

                result.invalid_members.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.row}</td>
                        <td>${item.name}</td>
                        <td>${item.phone}</td>
                        <td style="color:#e74c3c;">${item.errors.join(', ')}</td>
                    `;
                    tbody.appendChild(tr);
                });

                document.getElementById('invalidList').style.display = 'block';
            }

            document.getElementById('confirmExcelBtn').disabled = result.valid_count === 0;
            document.getElementById('excelResult').style.display = 'block';
        }

        async function confirmExcelUpload() {
            if (!confirm(`${validMembers.length}명을 등록하시겠습니까?`)) return;

            try {
                const response = await fetch('/api/members/bulk', {
                    method: 'POST',
                    headers: getHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ members: validMembers })
                });

                if (response.ok) {
                    const result = await response.json();
                    showNotification(result.message);
                    closeModal('excelModal');
                    // 엑셀 등록 후 초기 화면
                    loadMembers();
                } else {
                    const error = await response.json();
                    alert(error.detail || '등록에 실패했습니다.');
                }
            } catch (error) {
                console.error('등록 실패:', error);
                alert('등록 중 오류가 발생했습니다.');
            }
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        // 전화번호 입력 포맷팅 (0000-0000)
        document.getElementById('memberPhone').addEventListener('input', function (e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length > 4) {
                value = value.slice(0, 4) + '-' + value.slice(4, 8);
            }
            e.target.value = value;
        });

        // 초기 로드
        loadMembers();
