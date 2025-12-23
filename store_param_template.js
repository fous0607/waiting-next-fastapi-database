// Common store parameter handling function
// Add this to all pages that need store context

async function checkUrlStoreParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeParam = urlParams.get('store');

    if (storeParam) {
        try {
            // 매장 코드로 매장 정보 조회
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
                alert(`매장 코드 '${storeParam}'를 찾을 수 없습니다.`);
            }
        } catch (e) {
            console.error('매장 정보 조회 실패:', e);
        }
    }
}
