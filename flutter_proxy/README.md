# Flutter Print Proxy App

이 프로젝트는 `print_proxy.py`의 기능을 Flutter로 구현한 크로스 플랫폼 앱입니다.
Android 태블릿, iPad, Windows PC 등 다양한 기기에서 프록시 서버를 실행할 수 있습니다.

## 기능
- **HTTP 서버 실행**: 8000번 포트 (Shelf 패키지 사용)
- **프린터 중계**: TCP 소켓 통신
- **화면 켜짐 유지**: Wakelock 적용

## 실행 방법 (개발 모드)
Flutter SDK가 설치된 환경에서:
```bash
cd flutter_proxy
flutter pub get
flutter run
```

## 빌드 방법 (Android APK)
```bash
cd flutter_proxy
flutter build apk --release
```
생성된 `build/app/outputs/flutter-apk/app-release.apk` 파일을 태블릿에 설치하세요.
