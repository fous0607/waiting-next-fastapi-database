# Android Print Proxy App

이 프로젝트는 태블릿에서 직접 **로컬 프린트 프록시(Local Print Proxy)**를 실행하여, PC 없이도 웹앱에서 영수증 프린터로 출력을 보낼 수 있게 해주는 안드로이드 앱 소스코드입니다.

## 기능
- **HTTP 서버 실행**: 8000번 포트에서 `/print` 요청을 대기합니다.
- **프린터 중계**: 들어온 요청(IP, Port, Data)을 받아 실제 프린터로 TCP 소켓 전송을 수행합니다.
- **백그라운드 실행**: 앱이 화면에 켜져 있는 동안 동작합니다. (서비스로 고도화 가능)

## 빌드 방법 (Android Studio)

1. **Android Studio**를 실행합니다.
2. **Open Existing Project**를 선택하고, 이 `android_proxy` 폴더를 선택합니다.
   - 만약 Gradle 설정 파일이 부족하다고 나오면, **New Project > Empty Views Activity**로 새 프로젝트를 만든 후, 아래 파일들을 덮어쓰기 하는 것이 더 빠를 수 있습니다.
3. **권한**: `AndroidManifest.xml`에 인터넷 권한이 포함되어 있습니다.
4. **의존성**: `build.gradle`에 `NanoHTTPD` 라이브러리가 추가되어 있어야 합니다.

## 핵심 파일
*   `app/src/main/java/com/waiting/proxy/PrintProxyServer.kt`: HTTP 서버 및 프린터 통신 로직 (Python 코드의 Kotlin 이식본)
*   `app/src/main/java/com/waiting/proxy/MainActivity.kt`: IP 주소 표시 및 서버 시작/중지 UI

## 사용법
1. 앱을 실행하고 **"Start Server"** 버튼을 누릅니다.
2. 화면에 표시된 **IP 주소** (예: `192.168.0.x`)를 확인합니다.
3. 웨이팅 웹앱(태블릿 크롬)에서 **설정 > 영수증 프린터 > 프록시 IP**에 위 IP를 입력합니다. (포트번호 제외)
4. 테스트 출력을 진행합니다.
