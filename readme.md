# iTECify

iTECify is a collaborative coding platform with:

- React + TypeScript frontend (Vite)
- Node.js + TypeScript backend (Express + Socket.IO)
- PostgreSQL persistence for users, rooms, file tree, and file versions
- Docker-based code execution sandbox for multiple languages
- JWT authentication and protected collaboration APIs

## Current Architecture

- `client/`: UI, auth screens, projects hub, collaborative editor shell
- `server/`: REST API, Socket.IO gateway, auth, room management, execution/sandbox services
- `docker-compose.yml`: PostgreSQL + backend + frontend services

## Features Implemented

- Authentication:
  - Register and login
  - JWT-based protected routes
- Collaboration:
  - Room creation and join by invite code
  - File tree sync and node creation
  - Real-time editor operations with versioning
  - Cursor updates, AI proposal broadcast events, room snapshots
- Execution:
  - Sandboxed runs for `node`, `python`, `c`, `cpp`, `rust`
  - Server-sent events stream for execution output
  - Execution stop endpoint
  - Baseline vulnerability scan before run request in socket flow
- AI:
  - Protected endpoint for AI-assisted file editing (DeepSeek integration)

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop (required for code execution sandbox)
- Docker Compose

## Quick Start (Local Development)

1. Install dependencies:

```bash
npm --prefix server install
npm --prefix client install
```

2. Create backend environment file:

```bash
copy server\.env.example server\.env
```

3. Start only PostgreSQL via Docker:

```bash
docker compose up -d itec_db
```

4. Start backend:

```bash
npm --prefix server run dev
```

5. Start frontend:

```bash
npm --prefix client run dev
```

6. Open:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health endpoint: http://localhost:3001/api/health

## Run Full Stack With Docker

Build and run DB + backend + frontend:

```bash
docker compose up --build
```

Container ports:

- Frontend: http://localhost:4173
- Backend: http://localhost:3001
- Postgres: localhost:5433

Stop services:

```bash
docker compose down
```

## Environment Variables (server/.env)

Use `server/.env.example` as template.

Core:

- `HOST` (default `0.0.0.0`)
- `PORT` (default `3001`)
- `CORS_ORIGIN` comma-separated origins

Database:

- `DB_HOST` (default `itecdb`)
- `DB_PORT` (default `5432`)
- `DB_USER` (default `postgres`)
- `DB_PASSWORD` (default `postgres`)
- `DB_NAME` (default `itec_db`)

Auth:

- `JWT_SECRET` (set a secure value in non-local environments)
- `JWT_EXPIRES_IN` (default `1h`)

DeepSeek (AI edit endpoint):

- `DEEPSEEK_API_BASE_URL`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_TIMEOUT_MS`

Execution:

- `EXECUTION_TIMEOUT_MS` (default `10000`)

Frontend variables (optional, in client environment):

- `VITE_API_BASE_URL` (default `http://localhost:3001`)
- `VITE_SOCKET_URL` (default `http://localhost:3001`)

## Scripts

Server (`server/package.json`):

- `npm --prefix server run dev` - run with ts-node-dev
- `npm --prefix server run build` - build TypeScript
- `npm --prefix server run start` - run compiled app
- `npm --prefix server run typecheck` - TypeScript check

Client (`client/package.json`):

- `npm --prefix client run dev` - Vite dev server
- `npm --prefix client run build` - type-check + build
- `npm --prefix client run preview` - preview build
- `npm --prefix client run lint` - ESLint

## REST API Overview

Public:

- `GET /api/health` - health + DB probe
- `POST /api/auth/register` - register user
- `POST /api/auth/login` - login
- `POST /api/execute` - start execution session
- `POST /api/execute/:sessionId/stop` - stop execution
- `GET /api/execute/:sessionId/stream` - SSE event stream
- `GET /api/auth/users` - list users

Protected (Bearer token required):

- `POST /api/rooms` - create room
- `POST /api/rooms/join` - join by invite code
- `GET /api/rooms` - list current user rooms
- `POST /api/ai/edit-file` - AI edit file content + diff chunks

## Socket.IO Events (Collaboration Gateway)

Client to server:

- `room:join`
- `tree:sync`
- `tree:create`
- `editor:change`
- `cursor:move`
- `ai:propose-block`
- `ai:decision`
- `terminal:stream`
- `code:execute` (security precheck event flow)
- `room:snapshots:request`
- `room:save_snapshot`

Server to client:

- `room:state-sync`
- `room:user-joined`
- `tree:state-sync`
- `tree:node-created`
- `editor:patch`
- `cursor:update`
- `ai:block-proposed`
- `ai:decision-applied`
- `terminal:output`
- `security:chaos_detected`
- `security:precheck_passed`
- `room:snapshots`
- `socket:error`

## Data and Persistence

On backend bootstrap, required tables are created/ensured for:

- users
- collaboration rooms/memberships
- room file tree nodes
- room file versions

## Security Notes

- JWT is required for protected room and AI routes.
- Socket room actions verify room membership.
- Rate limits are applied per socket/event for high-volume events.
- Baseline source scanning blocks suspicious code patterns before execution in socket precheck flow.
- Update `JWT_SECRET` and `DEEPSEEK_API_KEY` before any non-local deployment.

## Known Repository Mismatch

Root `package.json` scripts currently reference `frontend/` and `backend/`, while this repository uses `client/` and `server/`.

Use the direct commands in this README (`npm --prefix client ...`, `npm --prefix server ...`) unless root scripts are updated.

## Troubleshooting

- Backend cannot reach DB:
  - Confirm `itec_db` is up: `docker compose ps`
  - Check DB env values in `server/.env`
- Code execution does not run:
  - Ensure Docker Desktop is running
  - If backend runs in Docker, confirm docker socket mount is available
- CORS/auth errors:
  - Verify `CORS_ORIGIN` includes the frontend URL
  - Ensure token is present in `Authorization: Bearer <token>` for protected endpoints
