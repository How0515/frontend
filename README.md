# Trust Ticket Frontend

## 1. 프론트엔드 역할 분리

- `frontend/`: 관리자 전용 웹 콘솔입니다.
- `frontend/mobile/`: 사용자/주최자 모바일 앱입니다.
- 웹 사용자/주최자 라우트는 제거되었습니다. 예매, 리셀, QR, 주최자 운영 흐름은 모바일 앱에서 담당합니다.

## 2. 빠른 실행

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
npm run web
```

백엔드:

```bash
cd backend
./gradlew bootRun
```

## 3. 관리자 웹 콘솔

### 기술 스택

- Vite
- React
- React Router
- Axios
- TypeScript

### 활성 라우트

`src/routes.tsx` 기준 활성 웹 라우트입니다.

| 라우트 | 화면 |
| --- | --- |
| `/` | 관리자 랜딩 |
| `/login` | 관리자 로그인 |
| `/admin` | 관리자 대시보드 |
| `/admin/organizer-approvals` | 주최자 승인 |
| `/admin/events` | 이벤트 감독 |
| `/admin/users` | 사용자 관리 |
| `/admin/disputes` | 분쟁/거래 센터 |
| `/admin/blockchain` | 블록체인 로그 |

### 주요 화면

- `AdminDashboardPage`: 승인 대기, 검토 이벤트, 미처리 분쟁과 운영 지표를 요약합니다.
- `OrganizerApprovalsPage`: 주최자 권한 신청을 승인하거나 거절합니다.
- `AdminEventsPage`: 이벤트 상태를 확인하고 검토 지정, 관리자 취소, 다시 활성화를 처리합니다.
- `AdminUserManagePage`: 사용자 상태와 전역 검증자 권한 부여를 관리합니다.
- `AdminDisputeTransactionPage`: 사용자 분쟁을 검토하고 리셀 거래 내역을 모니터링합니다.
- `AdminBlockchainLogPage`: 서버가 기록한 체인 제출 또는 시뮬레이션 작업을 조회합니다.

### 관리자 API 연결 요약

| API | 사용 화면 |
| --- | --- |
| `POST /auth/email/login` | 로그인 |
| `GET /users/me` | 관리자 권한 확인 |
| `GET /admin/dashboard` | 대시보드 |
| `GET /organizer-applications` | 주최자 승인 |
| `PATCH /organizer-applications/{applicationId}/review` | 주최자 승인/거절 |
| `GET /admin/events` | 이벤트 감독 |
| `PATCH /admin/events/{eventId}/flag` | 이벤트 검토 지정 |
| `PATCH /admin/events/{eventId}/unflag` | 이벤트 검토 해제 |
| `PATCH /events/{eventId}/status` | 이벤트 취소/다시 활성화 |
| `GET /users` | 사용자 관리 |
| `PATCH /users/{userId}/suspend` | 사용자 정지 |
| `PATCH /users/{userId}/activate` | 사용자 다시 활성화 |
| `PATCH /users/{userId}/delete` | 사용자 삭제 처리 |
| `PATCH /users/{userId}/validator` | 전역 검증자 권한 부여 |
| `GET /admin/disputes` | 분쟁 목록 |
| `PATCH /admin/disputes/{disputeId}/review` | 분쟁 상태 변경 |
| `GET /admin/resale-transactions` | 리셀 거래 모니터링 |
| `GET /admin/blockchain-transactions` | 블록체인 로그 |

## 4. 모바일 앱

모바일 앱은 `frontend/mobile/App.tsx`의 React Navigation 스택을 기준으로 동작합니다.

### 사용자 흐름

- 인증: `Landing -> Auth`
- 이벤트 예매: `Main -> EventList -> EventDetail -> TicketPurchase -> PurchaseComplete`
- 리셀 구매: `Main -> ResaleList -> ResaleDetail -> PurchaseComplete`
- 내 티켓/QR: `MyPage -> MyTickets -> TicketDetail -> TicketQr`
- 리셀 등록: `TicketDetail -> TicketResaleCreate -> ResaleRegisterComplete`
- 분쟁: `TicketDetail` 또는 `ResaleDetail`에서 `DisputeCreate`, `MyPage -> MyDisputes`

### 주최자/검증자 흐름

- 주최자 홈: `Organizer`
- 이벤트 운영: `EventCreate`, `MyEvents`, `OrganizerEventDetail`
- 티켓 발행: `TicketIssue`
- 운영 현황: `SalesStatus`, `CheckInStatus`
- 설정/검증자: `EventSettings`, `CheckInManage`, `CheckInScan`
- 계정: `OrganizerProfile`, `OrganizerLogout`

## 5. 주요 정책

### 이벤트 검토 지정과 취소/복구

- 검토는 운영자가 다시 확인해야 하는 이벤트를 표시하는 기능입니다.
- 검토를 지정해도 이벤트 상태, 판매, 리셀, 체크인은 바뀌지 않습니다.
- 관리자 취소는 이벤트를 `CANCELED` 상태로 변경하고 티켓 구매, 리셀, 체크인을 중단합니다.
- 정책은 `관리자 취소 -> 주최자 복구 불가, 관리자 복구 가능`입니다.
- 백엔드는 `adminCanceled` 값을 통해 관리자 취소 여부를 구분합니다.

### 전역 검증자와 이벤트별 검증자

- 전역 검증자는 모든 이벤트의 QR 체크인을 처리할 수 있는 `VALIDATOR` 역할입니다.
- 관리자 웹은 `PATCH /users/{userId}/validator`로 전역 검증자 권한을 부여합니다.
- 이벤트별 검증자는 특정 이벤트에만 등록된 검증자이며 `POST /events/{eventId}/validators`를 사용합니다.
- 현재 관리자 웹에는 전역 검증자 권한 해제 기능이 없습니다.

### 분쟁 생성/처리

- 모바일 앱은 `POST /disputes`로 분쟁을 생성하고 `GET /disputes/me`로 내 분쟁을 조회합니다.
- 관리자 웹은 `GET /admin/disputes`로 접수된 분쟁을 조회하고 `PATCH /admin/disputes/{disputeId}/review`로 상태를 변경합니다.
- 리셀 거래 모니터링은 `GET /admin/resale-transactions`를 사용합니다.

### 블록체인 로그 상태

- `SIMULATED`: 실제 체인 전송 없이 서버가 시뮬레이션으로 기록한 상태입니다.
- `SUBMITTED`: 체인 제출 후 트랜잭션 해시를 받은 상태입니다.
- `FAILED`: 제출 또는 기록 실패 상태입니다.
- 현재 화면은 컨펌 수, receipt, finality까지 추적하지 않습니다.

## 6. 남은 TODO

- 관리자 웹에서 전역 검증자 권한 해제 API와 UI를 추가할지 결정해야 합니다.
- 블록체인 제출 실패를 항상 `FAILED` 로그로 남길지 백엔드 정책을 확정해야 합니다.
- 실제 네트워크 설정이 생기면 블록체인 로그에 explorer 링크를 추가합니다.
- 모바일 QR 서명은 시연 중심 구현입니다. 실제 모바일 지갑 서명 연동이 필요합니다.
- 관리자 이벤트 감독의 검토 이벤트를 별도 작업 큐로 분리할지 현재 필터 방식으로 유지할지 결정해야 합니다.

## 7. 검증 명령어

관리자 웹 타입 체크:

```bash
cd frontend
npx tsc -b
```

관리자 웹 테스트:

```bash
cd frontend
npm test
```

관리자 웹 프로덕션 빌드:

```bash
cd frontend
npm run build
```

모바일 타입 체크:

```bash
cd frontend/mobile
npx tsc --noEmit
```
