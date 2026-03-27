# iTECify Boilerplate

Boilerplate for a collaborative coding app (VS Code-like direction) with:

- `frontend`: React + TypeScript + Vite
- `backend`: Node.js + TypeScript + Express + Socket.IO
- `docker-compose`: local orchestration and runner-container placeholders for multi-language execution

## Project Structure

- `frontend/`
  - React app shell
  - Placeholder editor layout (files, editor, participants, runtime/output)
  - API client + Socket.IO client stubs
- `backend/`
  - Express API skeleton
  - `GET /api/health`
  - `POST /api/execute` execution placeholder
  - Socket.IO collaboration gateway placeholders (`room:join`, `editor:change`)
- `docker-compose.yml`
  - `frontend`, `backend`
  - optional runner placeholders: `runner-node`, `runner-python`, `runner-cpp`

## Quick Start (Local)

1. Install dependencies:

```bash
npm --prefix frontend install
npm --prefix backend install
```

2. Start backend:

```bash
npm --prefix backend run dev
```

3. Start frontend:

```bash
npm --prefix frontend run dev
```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:3001`.

## Root Scripts

```bash
npm run dev:frontend
npm run dev:backend
npm run build
npm run typecheck
npm run docker:up
npm run docker:down
```

## Docker

Build and run app services:

```bash
docker compose up --build
```

Run with language runner placeholders too:

```bash
docker compose --profile runners up --build
```

## Notes

- This is a scaffold only: no CRDT/OT implementation yet.
- Execution flow is intentionally a safe placeholder API contract, ready to be replaced with real isolated runner jobs.
