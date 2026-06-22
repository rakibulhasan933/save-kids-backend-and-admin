# Super Sefty Admin

Next.js App Router admin dashboard and backend API for a parental-control system.

## Stack

- Next.js App Router, TypeScript, `src` directory
- Tailwind CSS and shadcn/ui-style components
- Drizzle ORM with Supabase Postgres through `DATABASE_URL`
- Zod request validation
- HTTP-only JWT admin session cookie

## Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres?sslmode=require"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
JWT_SECRET="replace-with-at-least-32-random-bytes"
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are reserved for later Supabase client usage. Drizzle uses `DATABASE_URL`.

## Setup

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000/register` to create the first admin.

## Main Files

- `src/db/schema.ts` - Drizzle tables and enums.
- `src/db/index.ts` - Supabase Postgres Drizzle client.
- `src/lib/auth.ts` - password hashing, JWT sessions, API/page auth helpers.
- `middleware.ts` - protects `/dashboard` and `/children`.
- `src/app/api/**/route.ts` - route-handler backend API.
- `src/app/(admin)/**` - protected admin pages.
- `src/components/child-detail.tsx` - child overview, app rules, web rules, live screen tab.

## API Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/children`
- `POST /api/children`
- `GET /api/children/:id`
- `PATCH /api/children/:id`
- `DELETE /api/children/:id`
- `GET /api/children/:id/app-rules`
- `POST /api/children/:id/app-rules`
- `PATCH /api/app-rules/:ruleId`
- `DELETE /api/app-rules/:ruleId`
- `GET /api/children/:id/web-rules`
- `POST /api/children/:id/web-rules`
- `PATCH /api/web-rules/:ruleId`
- `DELETE /api/web-rules/:ruleId`
- `GET /api/children/:id/live-screen`
- `POST /api/children/:id/live-screen/request`
- `PATCH /api/live-screen/:sessionId/start`
- `PATCH /api/live-screen/:sessionId/end`
- `PATCH /api/live-screen/:sessionId/fail`

The live screen feature currently stores and updates session control state only. It does not include WebRTC, WebSockets, or video streaming.
