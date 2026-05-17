# Trust Ticket Frontend

Trust Ticket frontend는 모바일 앱과 관리자 웹 포털을 함께 관리하는 클라이언트 프로젝트입니다.

- `frontend/`: Vite + React 기반 관리자 웹 포털
- `frontend/mobile/`: React Native + Expo 기반 사용자/주최자 모바일 앱

## 관리자 웹 포털

#### 주요 경로 :

```text
/                           메인 페이지
/login                      로그인
/register                   회원가입
/admin                      관리자 대시보드
/admin/organizer-approvals  주최자 승인
/admin/events               이벤트 감독
/admin/users                사용자 관리
/admin/disputes             분쟁/거래 센터
/admin/blockchain           블록체인 로그
```

#### 구현된 화면 :

- 관리자 대시보드: 이벤트, 티켓, 입장, 리셀 운영 지표 API 연동
- 주최자 승인: 신청 목록 조회, 승인/거절, 로그인 만료 안내
- 이벤트 감독: 이벤트 목록 조회, 상태 필터, 검색, 플래그/해제, 페이지네이션
- 사용자 관리: 회원 목록 조회, 상태 필터, 검색, 정지/활성화/삭제/검증자 부여, 페이지네이션
- 분쟁/거래 센터: 분쟁 목록과 리셀 거래 목록을 분리 표시, 분쟁 상태 처리, 각각 페이지네이션
- 블록체인 로그: 최근 트랜잭션 상태, 실패 로그, 검색/상태 필터

#### 공통 처리 :

- 관리자 전용 라우트 가드
- 관리자 권한이 없거나 세션이 만료된 경우 재로그인 안내
- 로그인 성공 후 `ADMIN` 권한이 없으면 안내 팝업 후 로그인 화면으로 복귀
- 회원가입 후에도 일반 사용자 계정이면 관리자 진입 차단
- 메인 페이지의 `관리자 포털` 버튼으로 로그인 유지 상태에서 `/admin` 재진입 가능
- 테스트용 개발 관리자 계정 연동

## 테스트용 관리자 계정

백엔드 기본 개발 설정에서는 서버 시작 시 아래 계정이 생성되거나 관리자 계정으로 승격됩니다.

```text
email: dev-admin@local.test
password: Admin1234!
roles: USER, ORGANIZER, ADMIN, VALIDATOR
```

백엔드 서버가 이미 실행 중이었다면 재시작해야 계정 bootstrap이 반영됩니다.

## 모바일 주최자 앱

#### 주요 화면 :

```text
LandingPage                 시작 화면
AuthPage                    이메일/지갑 로그인, 회원가입
OrganizerDashboardPage      주최자 센터
OrganizerProfilePage        내 정보 보기
OrganizerLogoutPage         로그아웃
EventCreatePage             이벤트 등록
TicketIssuePage             티켓 발행
MyEventsPage                내 이벤트 목록
OrganizerEventDetailPage    이벤트 운영 상세
SalesStatusPage             판매 현황 조회
CheckInStatusPage           체크인 현황 조회
EventSettingsPage           이벤트 정보 수정, 상태 변경, 리셀 정책 수정
CheckInManagePage           체크인 관리, 검증자 등록, QR payload 입장 처리
CheckInScanPage             카메라 QR 스캔
```

#### 구현된 주최자 흐름 :

- 시작 화면에서 사용자/주최자 진입 분기
- 이메일 로그인/회원가입 후 권한과 진입 목적에 맞는 화면 이동
- 지갑 로그인 API 흐름 연결: nonce 발급, 서명값 입력, 지갑 로그인
- 일반 사용자는 주최자 신청 화면 표시
- 주최자 신청 상태 표시: 대기, 거절, 재신청, 승인 후 주최자 센터 전환
- 정지/삭제 등 사용할 수 없는 계정은 주최자 기능 차단
- 주최자 센터: 운영 지표, 이벤트 등록, 내 이벤트, 내 정보 이동
- 내 정보 보기: 프로필 조회, 표시 이름 수정, 로그아웃
- 이벤트 등록: 카테고리 선택, 날짜/시간 입력 형식 안내, 가격/수량/리셀 정책 입력
- 이벤트 등록 성공 후 티켓 발행 화면으로 이동
- 티켓 발행: 총 티켓/발행 완료/미발행 기준으로 좌석 구역과 수량 발행
- 내 이벤트 목록: 이벤트 상태 표시, 취소 이벤트 하단 정렬
- 이벤트 운영 상세: 판매/체크인/설정/체크인 관리 화면으로 분기
- 판매 현황: 티켓별 판매 상태와 집계 조회
- 체크인 현황: 입장 완료, 성공 기록, 전체 시도 조회
- 이벤트 설정: 기본 정보, 이미지 URL, 상태, 리셀 정책 수정
- 체크인 관리: 검증자 등록, QR payload 붙여넣기, QR 스캔, 입장 처리 API 연동
- 이벤트 취소: 물리 삭제 대신 `CANCELED` 상태 변경

#### 주의 사항 :

- 이벤트 삭제 API는 없으며, 관리자/주최자 모두 `CANCELED` 상태 변경으로 취소 처리합니다.
- 카메라 QR 스캔은 `expo-camera`를 사용하므로 실제 기기 또는 에뮬레이터 테스트가 필요합니다.
- Expo Web에서는 모바일 앱처럼 드래그 스크롤이 동작하지 않을 수 있어, 주요 액션은 상단에도 배치했습니다.
- 이미지 파일 업로드 UI는 아직 없고, 현재는 이미지 URL 수정 방식으로 이벤트 이미지를 관리합니다.

## 실행

관리자 웹:

```bash
cd frontend
npm install
npm run dev
```

모바일 앱:

```bash
cd frontend/mobile
npm install
npx expo start --web
```

모바일 앱 실제 기기/에뮬레이터:

```bash
cd frontend/mobile
npm install
npm run android
# 또는
npm run ios
```

백엔드:

```bash
cd backend
./gradlew bootRun
```

## 검증

프론트 타입 체크:

```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit --incremental false
```

모바일 타입 체크:

```bash
cd frontend/mobile
npx tsc --noEmit
```

백엔드 컴파일:

```bash
cd backend
./gradlew compileKotlin
```
