# 📅Todaing

> **오늘을 한 장으로**  
> 지출·일정·교통을 한곳에 모은 개인 가계·라이프 기록 웹앱 (PWA)

---

## 프로젝트 소개

**Todaing**은 하루 단위로 **지출(Expense)** 과 **일정(Schedule)** 을 기록하고, 달력·월별 요약으로 흐름을 보는 **개인용 기록 서비스**입니다.

- **Google 로그인**으로 사용자를 구분하고, 데이터는 **Supabase(PostgreSQL) + Prisma**에 저장합니다.
- 지출 작성 시 **교통(지하철·버스)** 입력을 지원하며, 버스 정류장·노선 검색은 **국토부 TAGO**와 **서울 열린데이터광장** 등을 API에서 프록시합니다.
- **PWA**로 설치해 두고 쓸 수 있도록 구성했습니다.

워크스페이스 이름은 `gagye-bbu`이며, 패키지는 `@gagye-bbu/web`(프론트) / `@gagye-bbu/api`(백엔드)로 나뉩니다.

---

## 문제 정의 (왜 만들었나)

- 이동 중에도 **빠르게 지출을 남기고**, 나중에 **날짜·카테고리·결제 수단**으로 다시 보고 싶다.
- **달력·기념일(연간 반복)** 과 지출이 겹칠 때, 한 화면에서 맥락을 잡고 싶다.
- 교통비는 **역·노선·버스 번호**를 손으로 치기보다, **검색으로 고르고** 저장하고 싶다.

👉 Todaing은 **입력 경로를 짧게** 하고, **서버에 안전하게 모아** 두는 데 초점을 맞췄습니다.

---

## 핵심 기능

### 지출 기록 & 타임라인

- 금액, 카테고리, 결제 수단(카드·현금·계좌 등), 할부, 메모
- **개인 / 공동** 범위, 참여자 텍스트
- **다른 날 사용(예정일)** — 결제일과 실제 사용일을 분리해 기록

### 일정 & 달력

- 일정 항목(제목, 시간, 메모)
- 달력에 표시 여부, **매년 반복(기념일)** 옵션

### 교통 입력 (버스·지하철)

- 수도권 전철 역 검색(생성된 역 데이터)
- 버스: **도시코드 + 노선 검색**, 경유 정류장 선택 (TAGO / 서울 소스 조합은 API 설정에 따름)

### 인증 & API

- **Google Identity** 기반 로그인, 세션 JWT
- REST: 지출·일정 CRUD, 교통용 TAGO 프록시 엔드포인트

---

## 기술 선택 이유

### React + Vite (`apps/web`)

- 빠른 HMR과 프로덕션 번들
- `vite-plugin-pwa`로 PWA 기본 골격

### TanStack Query

- 지출·일정·요약 API를 캐시하고 낙관적 업데이트에 활용

### Tailwind CSS

- 화면 단위 UI를 빠르게 맞추고 일관된 간격·타이포 유지

### Express + Prisma (`apps/api`)

- 가벼운 BFF 역할, Prisma로 스키마·마이그레이션 관리

### PostgreSQL (Supabase)

- 호스팅 DB와 연결 문자열만으로 운영 가능

---

## 아키텍처

| 구분 | 선택 |
|------|------|
| **Server state** | TanStack Query |
| **Routing** | React Router v7 |
| **UI 구조** | `RouteShell` + views + sheets (작성·상세 시트) |
| **API** | Express, CORS는 `WEB_ORIGIN`과 개발용 localhost/LAN 허용 |
| **인증** | Google → `/auth/google` POST → 세션 토큰 |

---

## 모노레포 구조

```text
Todaing/
├── apps/
│   ├── web/                 # @gagye-bbu/web — React + Vite PWA
│   │   └── src/
│   │       ├── app/         # 라우터 등 앱 엔트리
│   │       ├── routes/      # 페이지: Main, Today, Month, Calendar, Settings
│   │       ├── ui/          # RouteShell, views, sheets
│   │       ├── components/  # 카드, 시트, 교통 필드, 아이콘
│   │       ├── domain/      # 날짜·정산·교통 페이로드 등 순수 로직
│   │       ├── features/    # expenses·schedules API + transit 클라이언트
│   │       └── lib/         # http, config, auth
│   └── api/                 # @gagye-bbu/api — Express
│       ├── prisma/          # schema, migrations
│       └── src/
│           ├── routes/      # expenses, schedules, tagoTransit
│           └── ...
├── scripts/                 # 예: 수도권 전철 역 데이터 생성
├── package.json             # pnpm workspace 루트, onlyBuiltDependencies(Prisma 등)
├── pnpm-workspace.yaml
└── nixpacks.toml            # Railway(Nixpacks)에서 pnpm 버전 고정 등
```

👉 기능은 `features/`·`domain/`에, 화면 조립은 `routes/`·`ui/`에 두어 확장 시 충돌을 줄였습니다.

---

## 주요 화면 (라우트)

| 경로 | 설명 |
|------|------|
| `/` | 홈 — 오늘 요약, 타임라인, 작성 진입 |
| `/today/:day` | 특정 일자 상세 |
| `/month/:month` | 월 상세 |
| `/calendar/:month` | 달력 뷰 |
| `/settings` | 설정 |

---

## 사용자 흐름 (예시)

1. Google 로그인  
2. 홈에서 **지출/일정 작성** 시트 열기  
3. 필요 시 **교통** 필드에서 역·버스 정류장 검색  
4. 일별·월별·달력에서 기록 확인  

---

## 개발 포인트

1. **프론트 ↔ API**  
   로컬에서는 Vite 프록시로 `/api`·`/auth`를 API(기본 `8787`)로 넘깁니다. 배포 시에는 `VITE_API_BASE_URL`과 API의 `WEB_ORIGIN`을 실제 도메인에 맞춥니다.

2. **교통 공공 API**  
   TAGO·서울 키는 **API 서버 환경 변수**에만 두고, 브라우저에 노출하지 않습니다.

3. **Prisma**  
   스키마 변경 후 `pnpm -C apps/api prisma:migrate`로 마이그레이션합니다.

---

## 백엔드·외부 연동

- **Node.js (Express)** — `apps/api`
- **PostgreSQL** — Supabase (`DATABASE_URL`)
- **Prisma** — ORM·마이그레이션
- **국토부 TAGO** — 버스 도시코드·노선 등 (API `TAGO_SERVICE_KEY`)
- **서울 열린데이터광장 / ws.bus** — 선택 설정 (`SEOUL_*` 환경 변수, 코드 주석·`.env.example` 참고)
- **Google OAuth / GIS** — 웹 `VITE_GOOGLE_CLIENT_ID`, API `WEB_ORIGIN` 정합

---

## 시작하기

### 요구 사항

- **Node.js** ≥ 20.11  
- **pnpm** — 전역 설치 없이 `corepack`으로 실행하는 것을 권장합니다.

### 1) 클론 & 설치

```bash
git clone https://github.com/yundlab/Todaing.git
cd Todaing
corepack enable
corepack pnpm install
```

### 2) 환경 변수

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

- `apps/api/.env`: `DATABASE_URL`, `AUTH_SESSION_SECRET`, `WEB_ORIGIN`, `TAGO_SERVICE_KEY` 등  
- Supabase: **Project → Settings → Database → Connection string** 을 `DATABASE_URL`에 넣습니다.

### 3) DB 마이그레이션 (최초 1회)

```bash
corepack pnpm --filter @gagye-bbu/api prisma:migrate
```

### 4) 개발 서버 (웹 + API 동시)

```bash
corepack pnpm dev
```

- **웹**: `http://localhost:5176` (Vite `server.port`)  
- **API health**: `http://localhost:8787/health`

---

## 스크립트 (루트)

| 명령 | 설명 |
|------|------|
| `corepack pnpm dev` | `apps/web` + `apps/api` 병렬 개발 서버 |
| `corepack pnpm build` | 웹·API 프로덕션 빌드 |
| `corepack pnpm lint` | ESLint (워크스페이스 전체) |
| `corepack pnpm typecheck` | TypeScript 검사 |
| `corepack pnpm knip` | 미사용 코드 검사 |
| `corepack pnpm build:stations` | 수도권 전철 역 데이터 생성 스크립트 |

개별 패키지는 예: `corepack pnpm --filter @gagye-bbu/api build`

---

## 배포 (참고)

- **웹**: Vercel 등 정적 호스팅 — `VITE_API_BASE_URL`에 공개 API URL (`https://...`)  
- **API**: Railway 등 — `WEB_ORIGIN`을 **실제 웹 origin**과 동일하게 (CORS)  
- **pnpm 11 / Prisma 빌드 스크립트 이슈**가 있으면 루트 `nixpacks.toml`의 `NIXPACKS_PNPM_VERSION` 또는 호스트 문서를 참고해 pnpm 9.x로 맞춥니다.

---

## 향후 개선 아이디어

- 오프라인 우선(IndexedDB) + 동기화 전략  
- 월/주 서버 집계 API + 캐시  
- 수입·이체·정기 지출 모델 확장  
- 알림·공유 정산 고도화  

---

## 라이선스

리포지토리 소유자 정책에 따릅니다.
