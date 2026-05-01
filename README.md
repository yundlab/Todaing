## 가계뿌 (PWA 가계부)

### 구성
- **Front**: `apps/web` (React + Vite + Tailwind + vite-plugin-pwa + TanStack Query)
- **API**: `apps/api` (Express + Prisma)
- **DB**: Supabase Postgres (`DATABASE_URL`로 연결)

### 요구사항
- Node.js 20+
- `corepack` 사용(전역 pnpm 설치 없이 실행)

### 로컬 실행
1) 의존성 설치

```bash
corepack pnpm install --no-frozen-lockfile
```

2) 환경변수 준비

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3) Supabase에서 `DATABASE_URL` 가져오기
- Supabase Project → **Settings → Database → Connection string**
- `apps/api/.env`의 `DATABASE_URL`에 붙여넣기

4) Prisma 마이그레이션 (첫 실행)

```bash
corepack pnpm -C apps/api prisma:migrate
```

5) 개발 서버 실행(프론트+API 동시)

```bash
corepack pnpm dev
```

### 접속
- **Web(PWA)**: `http://localhost:5173`
- **API health**: `http://localhost:8787/health`
- **Expenses API**
  - `GET /api/expenses` (최근 50건)
  - `POST /api/expenses`

### 다음 확장 포인트(추천 순서)
- Supabase Auth 연동(사용자별 데이터 분리)
- 카테고리/수입/이체/정기지출 모델링
- 오프라인 우선(IndexedDB) + 충돌 해결(동기화 전략)
- 월/주 통계 API + 캐싱(TanStack Query + 서버 집계)

