// 화면 크기 및 방향 모니터링 (태블릿 최적화 디버깅)
function logScreenInfo() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation = width > height ? 'landscape' : 'portrait';
    const deviceType = width < 600 ? 'mobile' :
        width < 768 ? 'small-tablet' :
            width < 1024 ? 'tablet' : 'large-tablet/desktop';

    console.log(`📱 Screen Info: ${width}x${height} (${orientation}) - ${deviceType}`);
}

// 초기 로드 시 화면 정보 출력
window.addEventListener('DOMContentLoaded', () => {
    logScreenInfo();
});

// 화면 크기 변경 시 정보 출력 (회전 등)
window.addEventListener('resize', () => {
    logScreenInfo();
});
