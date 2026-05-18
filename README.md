# Trust Ticket Frontend

Final client split:

- `frontend/`: administrator web console only.
- `frontend/mobile/`: React Native + Expo app for user and organizer flows.

The web project no longer owns user or organizer web routes. User ticketing, resale, QR, and organizer event-operation flows live in the mobile app.

## Web Admin Console

Stack:

- Vite
- React
- React Router
- Axios
- TypeScript

Active web routes:

```text
/                         Admin landing page
/login                    Admin login
/admin                    Admin dashboard
/admin/organizer-approvals Organizer approval
/admin/events             Event supervision
/admin/users              User management
/admin/disputes           Disputes / resale transaction center
/admin/blockchain         Blockchain transaction logs
```

Removed from the web app:

- `/app/*` user web routes
- `/organizer/*` organizer web routes
- web user pages under `src/pages/user`
- web organizer pages under `src/pages/organizer`
- web registration route/page
- web mobile-style user/organizer layouts

## Mobile App

The mobile app remains under `frontend/mobile` and is not part of the admin web cleanup.

Mobile user flow:

```text
Landing -> Auth -> Main -> EventList -> EventDetail -> TicketPurchase -> PurchaseComplete
Landing -> Auth -> Main -> ResaleList -> ResaleDetail -> PurchaseComplete
MyPage -> MyTickets -> TicketDetail -> TicketQr
MyPage -> MyTickets -> TicketDetail -> TicketResaleCreate -> ResaleRegisterComplete
```

Mobile organizer flow:

```text
Landing -> Auth -> Organizer
Organizer -> EventCreate -> TicketIssue
Organizer -> MyEvents -> OrganizerEventDetail
OrganizerEventDetail -> SalesStatus
OrganizerEventDetail -> CheckInStatus
OrganizerEventDetail -> EventSettings
OrganizerEventDetail -> CheckInManage -> CheckInScan
Organizer -> OrganizerProfile
Organizer -> OrganizerLogout
```

## Web Structure

```text
frontend/src/
  App.tsx
  routes.tsx
  styles.css
  components/
    Layout.tsx
    RequireAdmin.tsx
    AdminPagination.tsx
  lib/
    auth.ts
    authRoute.ts
    backend.ts
    config.ts
    http.ts
    blockchain/
      abi.ts
      client.ts
  pages/
    LandingPage.tsx
    LoginPage.tsx
    admin/
      AdminDashboardPage.tsx
      OrganizerApprovalsPage.tsx
      AdminEventsPage.tsx
      AdminUserManagePage.tsx
      AdminDisputeTransactionPage.tsx
      AdminBlockchainLogPage.tsx
```

## API Client And Auth

Web:

- `src/lib/config.ts`: reads `VITE_API_BASE_URL`, chain RPC, chain ID, and contract address.
- `src/lib/auth.ts`: stores the access token in `localStorage`.
- `src/lib/http.ts`: creates the Axios instance, injects `Authorization: Bearer <token>`, clears token on `401`, and unwraps backend `ApiEnvelope<T>`.
- `src/lib/authRoute.ts`: verifies that the logged-in user has `ADMIN`; non-admin users are logged out and blocked.
- `src/lib/backend.ts`: remains broad because admin pages use many user, organizer, event, dispute, resale, and blockchain-log methods. Non-admin/mobile-only wrappers were not removed in this cleanup to avoid accidental breakage and because the mobile app has its own separate wrapper.

Mobile:

- `mobile/src/lib/auth.ts`: stores tokens in `expo-secure-store` on native and `localStorage` on Expo Web.
- `mobile/src/lib/http.ts`: async bearer-token injection and envelope unwrap.
- `mobile/src/lib/backend.ts`: user and organizer app API wrapper.

## Admin API Usage

| Backend API | Web usage |
| --- | --- |
| `POST /auth/email/login` | `LoginPage` |
| `GET /users/me` | `RequireAdmin`, admin pages that verify session/role |
| `GET /admin/dashboard` | `AdminDashboardPage` |
| `GET /organizer-applications` | `OrganizerApprovalsPage` |
| `PATCH /organizer-applications/{applicationId}/review` | `OrganizerApprovalsPage` |
| `GET /admin/events` | `AdminEventsPage` |
| `PATCH /admin/events/{eventId}/flag` | `AdminEventsPage` |
| `PATCH /admin/events/{eventId}/unflag` | `AdminEventsPage` |
| `PATCH /events/{eventId}/status` | `AdminEventsPage` for cancellation/status handling |
| `GET /users` | `AdminUserManagePage` |
| `PATCH /users/{userId}/suspend` | `AdminUserManagePage` |
| `PATCH /users/{userId}/activate` | `AdminUserManagePage` |
| `PATCH /users/{userId}/delete` | `AdminUserManagePage` |
| `PATCH /users/{userId}/validator` | `AdminUserManagePage` |
| `GET /admin/disputes` | `AdminDisputeTransactionPage` |
| `PATCH /admin/disputes/{disputeId}/review` | `AdminDisputeTransactionPage` |
| `GET /admin/resale-transactions` | `AdminDisputeTransactionPage` |
| `GET /admin/blockchain-transactions` | `AdminBlockchainLogPage` |

## Admin Feature Semantics

The current admin web UI is wired to the backend policies below. Use this section as the demo script source of truth.

### Event Supervision

- `PATCH /admin/events/{eventId}/flag` and `/unflag` only toggle `EventEntity.flagged`.
- The flag does not change `EventStatus`, ticket purchase availability, resale availability, or check-in availability.
- UI wording uses "검토 표시" to distinguish it from cancellation.
- Admin cancellation uses `PATCH /events/{eventId}/status` with `CANCELED`.
- The same status API is also exposed to organizers in the mobile app (`EventSettingsPage`) and currently allows `ACTIVE`, `INACTIVE`, and `CANCELED`.
- Backend policy today does not make admin cancellation irreversible. Demo wording should treat cancellation as a dangerous operational action, while README/TODO tracks the policy mismatch.

### User Management And Validators

- `PATCH /users/{userId}/validator` grants the global `VALIDATOR` role.
- Backend check-in authorization allows `ADMIN`, global `VALIDATOR`, or an event-specific validator record from `event_validators`.
- If the user has a wallet address, granting global validator also records an `addValidator` blockchain action.
- UI wording uses "입장/체크인 검증자" because this role is for ticket check-in validation, not organizer approval or event review.
- Mobile organizers can separately register event-specific validators through `POST /events/{eventId}/validators`.

### Disputes And Resale Transactions

- The backend has user-facing dispute APIs: `POST /disputes` and `GET /disputes/me`.
- A dispute can be created with either `resaleListingId` or `ticketId`, plus `type` and `description`.
- The admin web only reviews existing disputes through `GET /admin/disputes` and `PATCH /admin/disputes/{disputeId}/review`.
- Current mobile screens import dispute types and admin wrappers, but there is no user-visible dispute-report screen or button wired to `POST /disputes`.
- Resale transaction monitoring reads `GET /admin/resale-transactions`; by default the backend returns non-active resale listings unless a status filter is supplied.

### Blockchain Logs

- Admin blockchain logs read backend-recorded submissions from `GET /admin/blockchain-transactions`.
- `SIMULATED` means `app.blockchain.enabled=false` or missing real chain mode, so `NoopTrustTicketGateway` recorded a fake transaction hash instead of submitting on-chain.
- `SUBMITTED` means `Web3jTrustTicketGateway` submitted a transaction and received a transaction hash. The current backend does not track confirmations, receipts, or finality.
- `FAILED` exists in the enum, but current gateway failures throw before `BlockchainTransactionService.record(...)`, so failed attempts may not appear unless future code records them explicitly.
- Recorded action names can include `addOrganizer`, `addValidator`, `addEventValidator`, `createEvent`, `setEventStatus`, `mintTicket`, `purchaseTicket`, `listTicket`, `purchaseResaleTicket`, `cancelListing`, and `useTicket`.

## Blockchain And Wallet Notes

- The admin web console displays backend-recorded blockchain transactions through `GET /admin/blockchain-transactions`.
- `src/lib/blockchain/client.ts` still contains ethers helpers for direct contract reads/writes and wallet signing experiments, but no active admin route imports them.
- Production admin flows should treat backend transaction logs as the canonical view unless a future task explicitly wires direct contract inspection into an admin page.
- Wallet login and mobile QR signing belong to `frontend/mobile`, not the admin web console.

## Remaining Frontend TODO

- Decide and enforce event cancellation policy:
  - Option A: admin cancellation is irreversible and organizer reactivation is blocked after `CANCELED`.
  - Option B: status recovery is allowed, and admin UI should expose/describe recovery consistently.
- Add a mobile user dispute-report flow wired to `POST /disputes`, plus a "my disputes" screen wired to `GET /disputes/me`.
- Decide whether failed blockchain submissions should be recorded as `FAILED`; current Web3j errors throw before a log row is persisted.
- Add admin filtering for 검토 표시 events using the existing `GET /admin/events?flagged=true` backend parameter if demo needs a dedicated review queue.
- Decide whether `src/lib/blockchain/client.ts` should remain as future admin tooling or be removed if backend-mediated blockchain is the only supported web path.
- Keep `src/lib/backend.ts` broad for now; prune only after confirming no admin page or future admin task depends on the method.
- Add admin explorer links for real blockchain transactions once network/explorer config exists.
- Continue mobile-only TODOs in `frontend/mobile`: event-scoped resale API, wallet connector, QR signing, and user/organizer smoke tests.

## Run

Web admin:

```bash
cd frontend
npm install
npm run dev
```

Mobile app:

```bash
cd frontend/mobile
npm install
npx expo start --web
```

Backend:

```bash
cd backend
./gradlew bootRun
```

## Verification

Web type check:

```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit --incremental false
```

Web tests:

```bash
cd frontend
npm test
```

Mobile type check:

```bash
cd frontend/mobile
npx tsc --noEmit
```
