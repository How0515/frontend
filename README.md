# Trust Ticket Frontend

블록체인 기반 티켓 관리 시스템의 프론트엔드 애플리케이션입니다. React와 TypeScript를 기반으로 하며, 관리자, 주최자, 사용자 역할별 기능을 제공합니다.

## 📋 주요 기능

### 랜딩 페이지
- 서비스 소개 및 진입점
- 사용자 인증 연결

### 로그인 페이지
- 사용자 인증
- 역할 기반 리다이렉트

### 관리자 패널
- **대시보드**: 시스템 전체 현황 모니터링
- **주최자 승인**: 신규 주최자 신청 심사 및 승인 관리
- **이벤트 관리**: 전체 이벤트 조회 및 관리
- **사용자 관리**: 사용자 정보 및 권한 관리
- **분쟁 거래 관리**: 거래 분쟁 해결 및 추적
- **블록체인 로그**: 블록체인 거래 기록 조회

## 🛠 기술 스택

- **UI Framework**: React 18.3.1
- **Language**: TypeScript 5.8.3
- **Build Tool**: Vite 5.4.19
- **Router**: React Router 6.30.1
- **HTTP Client**: Axios 1.10.0
- **Blockchain**: ethers.js 6.14.4
- **Test Framework**: Vitest 2.1.9 + React Testing Library 16.3.0

## 📁 프로젝트 구조

```
frontend/
├── src/
│   ├── components/          # 공유 컴포넌트
│   │   ├── Layout.tsx       # 레이아웃 wrapper
│   │   ├── RequireAdmin.tsx # 관리자 권한 보호
│   │   └── AdminPagination.tsx # 페이지네이션
│   ├── pages/               # 페이지 컴포넌트
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── admin/           # 관리자 페이지
│   │       ├── AdminDashboardPage.tsx
│   │       ├── OrganizerApprovalsPage.tsx
│   │       ├── AdminEventsPage.tsx
│   │       ├── AdminUserManagePage.tsx
│   │       ├── AdminDisputeTransactionPage.tsx
│   │       └── AdminBlockchainLogPage.tsx
│   ├── lib/                 # 유틸리티 및 라이브러리
│   │   ├── auth.ts          # 인증 관련 함수
│   │   ├── backend.ts       # 백엔드 API 관련
│   │   ├── config.ts        # 설정
│   │   └── blockchain/      # 블록체인 관련 함수
│   ├── types/               # TypeScript 타입 정의
│   │   └── api.ts           # API 타입
│   ├── App.tsx              # 메인 앱 컴포넌트
│   ├── routes.tsx           # 라우팅 설정
│   └── main.tsx             # 애플리케이션 진입점
├── test/
│   └── setup.ts             # 테스트 설정
├── vite.config.ts           # Vite 설정
├── vitest.config.ts         # Vitest 설정
├── tsconfig.json            # TypeScript 설정
└── package.json
```

## 🚀 설치 및 실행

### 요구사항
- Node.js 18.0.0 이상
- npm 또는 pnpm

### 설치
```bash
cd frontend
npm install
# 또는
pnpm install
```

### 개발 서버 실행
```bash
npm run dev
# 또는
pnpm dev
```
브라우저에서 `http://localhost:5173`로 접속합니다.

### 프로덕션 빌드
```bash
npm run build
# 또는
pnpm build
```

### 빌드 결과 미리보기
```bash
npm run preview
# 또는
pnpm preview
```

### 테스트 실행
```bash
# 단일 실행
npm run test

# Watch 모드
npm run test:watch
```

## 🔐 보안 기능

- **역할 기반 접근 제어 (RBAC)**: `RequireAdmin` 컴포넌트를 통한 관리자 페이지 보호
- **토큰 기반 인증**: JWT 토큰을 이용한 사용자 인증
- **블록체인 통합**: ethers.js를 통한 안전한 거래 처리

## 📱 반응형 디자인

Layout 컴포넌트를 통해 모든 페이지에서 일관된 반응형 UI를 제공합니다.

## 🔗 API 연동

Axios를 통해 백엔드 API와 통신하며, `lib/backend.ts`에서 API 엔드포인트를 관리합니다.

## 📦 모바일 앱

`frontend/mobile/` 디렉토리에 React Native 기반의 모바일 애플리케이션이 별도로 구성되어 있습니다.

## 🤝 기여

이 프로젝트는 BlockChain Ticket 프로젝트의 일부입니다. 기여하려면 기본 개발 가이드라인을 따라주세요.

## 📝 라이선스

BlockChain Ticket 프로젝트와 같은 라이선스를 따릅니다.
