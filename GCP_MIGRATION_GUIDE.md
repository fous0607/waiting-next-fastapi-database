# Google Cloud Build & Cloud Run 마이그레이션 가이드

Render에서 Google Cloud Platform(GCP)의 Cloud Build와 Cloud Run으로 이전하기 위한 단계별 가이드입니다.

## 사전 준비 (Prerequisites)

1.  **GCP 계정 및 프로젝트**: [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트가 생성되어 있어야 합니다.
2.  **결제 활성화**: 프로젝트에 결제 계정이 연결되어 있어야 합니다 (Cloud Build 및 Cloud Run 사용을 위해 필수).
3.  **Google Cloud SDK 설치**: [gcloud CLI 설치 가이드](https://cloud.google.com/sdk/docs/install)를 참고하여 로컬에 설치합니다.

---

## 1단계: 필수 API 활성화 및 초기 설정

터미널에서 다음 명령어를 순서대로 실행하여 필요한 서비스를 활성화합니다. (웹 콘솔에서도 가능합니다)

```bash
# 1. GCP 로그인 (브라우저가 열리면 로그인)
gcloud auth login

# 2. 사용할 프로젝트 설정 (PROJECT_ID를 본인의 프로젝트 ID로 변경)
gcloud config set project [YOUR_PROJECT_ID]

# 3. 필수 API 활성화 (Cloud Build, Cloud Run, Container Registry)
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com
```

## 2단계: 서비스 계정 권한 설정

Cloud Build가 배포를 수행할 수 있도록 기본 서비스 계정에 권한을 부여합니다.

```bash
# 프로젝트 번호 가져오기
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# Cloud Build 서비스 계정에 Cloud Run 관리자 권한 부여
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin"

# Cloud Build 서비스 계정에 서비스 계정 사용자 권한 부여 (배포 시 필요)
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"
```

## 3단계: GitHub 저장소 연결 및 트리거 생성 (자동 배포)

코드를 푸시할 때마다 자동으로 배포되도록 설정합니다.

1.  **[Cloud Build 트리거 페이지](https://console.cloud.google.com/cloud-build/triggers)**로 이동합니다.
2.  **'트리거 만들기'** 버튼을 클릭합니다.
3.  **소스**:
    *   **저장소**: GitHub를 선택하고 본인의 저장소(`wating-service`)를 연결합니다.
    *   **분기**: `^main$` (main 브랜치에 푸시될 때 작동)
4.  **구성**:
    *   **유형**: `Cloud Build 구성 파일 (yaml 또는 json)` 선택
    *   **위치**: `cloudbuild.yaml` (기본값)
5.  **만들기**를 클릭하여 저장합니다.

## 4단계: 파일 업로드 및 첫 배포 테스트

이제 생성된 설정 파일들을 GitHub에 업로드하여 첫 배포를 시작합니다.

```bash
git add Dockerfile .dockerignore cloudbuild.yaml GCP_MIGRATION_GUIDE.md
git commit -m "Chore: Add Google Cloud Build & Run configuration"
git push origin main
```

**확인 방법:**
1.  **[Cloud Build 대시보드](https://console.cloud.google.com/cloud-build/dashboard)**에서 빌드가 시작되었는지 확인합니다.
2.  빌드가 '성공'하면 **[Cloud Run 콘솔](https://console.cloud.google.com/run)**로 이동합니다.
3.  `waiting-service`라는 서비스가 생성되었을 것입니다.
4.  서비스 URL을 클릭하여 접속이 잘 되는지 확인합니다.

---

> [!TIP]
> **Cloud Run 장점**:
> - 트래픽이 없으면 0개로 축소되어 비용이 거의 발생하지 않습니다 (설정에 따라 다름).
> - 요청이 들어오면 수 초내로 빠르게 스케일업됩니다.
> - Render 무료 버전보다 더 안정적이고 빠릅니다.

> [!WARNING]
> 만약 DB(SQLite) 파일을 컨테이너 내부에 저장하고 있다면, **배포할 때마다 데이터가 초기화**될 수 있습니다.
> Cloud Run은 상태비저장(Stateless) 컨테이너이므로, 영구 데이터는 **Cloud SQL(PostgreSQL)**이나 **Google Cloud Storage** 같은 외부 저장소를 사용해야 합니다.
> *현재 SQLite를 사용 중이라면, 데이터 유실 방지를 위해 추후 Cloud SQL로의 마이그레이션을 강력히 권장합니다.*
