Vercel 빌드 시 오류가 자주 발생하는 이유는 크게 TypeScript의 엄격한 검사와 Vercel의 배포 환경 특성 때문입니다. 방금 발생한 오류를 포함하여 주요 원인들을 정리해 드립니다.

1. TypeScript의 '엄격 모드' (Strict Mode)
현재 프로젝트의 
tsconfig.json
 설정에 "strict": true가 활성화되어 있습니다.

원인: 로컬 개발(next dev) 중에는 실시간 화면을 보여주기 위해 엔진이 어느 정도 문법 오류를 유연하게 넘어가 주기도 하지만, Vercel은 배포 전 next build를 실행하며 전체 코드의 타입을 완벽하게 검사합니다.
사례: 방금 발생한 class_number vs class_order 같은 사소한 오타도 타입 정의와 다르면 빌드 서버는 바로 중단됩니다.
2. 정적 페이지 생성(Static Rendering)의 제약
Vercel은 성능 최적화를 위해 페이지를 미리 '빌드' 해두려고 합니다.

원인: useSearchParams() 같은 브라우저 전용 훅을 사용하면서 <Suspense>로 감싸지 않으면, 서버가 페이지를 미리 만들 때 "사용자 정보가 없는데 어떻게 만들지?"라며 오류를 냅니다.
해결: 이전에 /admin 페이지들에서 샌드박스(Suspense) 처리를 했던 이유가 이것 때문입니다.
3. 대소문자 구분 (macOS vs Linux)
사용하시는 macOS는 파일명의 대소문자를 구분하지 않지만, Vercel의 빌드 서버인 Linux는 엄격하게 구분합니다.

원인: 코드에서 import Layout from "./layout"이라고 썼는데 실제 파일명이 Layout.tsx라면, 맥에서는 작동하지만 Vercel에서는 "파일을 찾을 수 없음" 오류가 발생합니다.
4. ESLint 및 Linting 검사
Vercel은 빌드 단계에서 next build 뿐만 아니라 next lint를 기본적으로 수행합니다.

원인: 사용하지 않는 변수가 있거나, 보안상 위험한 태그(<img> 대신 <a> 등)가 있으면 경고가 아닌 '오류'로 판단하여 빌드를 멈춥니다.
오류를 줄이기 위한 팁
로컬 사전 빌드: 수정한 코드를 푸시하기 전에 터미널에서 npm run build를 직접 실행해 보면 Vercel과 동일한 검사 과정을 거치므로 미리 오류를 잡을 수 있습니다.
IDE 오류 확인: 
page.tsx
 등 파일명의 빨간 밑줄(TypeScript 오류)이 사라진 것을 확인하고 푸시하는 것이 안전합니다.
Suspense 생활화: URL 파라미터를 읽는 컴포넌트는 항상 <Suspense>로 감싸는 습관이 필요합니다.
방금 수정된 class_order 건은 이제 정상적으로 빌드될 것입니다. 더 궁금하신 점이 있다면 말씀해 주세요!