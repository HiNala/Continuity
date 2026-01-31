# Mission 01: System Foundation & Skeleton

## Objective
Establish the minimal end-to-end skeleton of the Continuity system so all future work plugs into a functioning backbone.

## Why This Mission Exists
Nothing else matters unless the system boots, traces, and moves data end-to-end. This mission ensures we always have a runnable system, even if later missions are incomplete.

## Scope
- Initialize Next.js 15 frontend
- Initialize FastAPI backend
- Connect PostgreSQL
- Configure Weave SDK
- Prove one traced backend operation appears in Weave

## In Scope
- Repo setup
- Environment variable wiring
- Basic API route
- Dummy Weave operation

## Out of Scope
- Real agents
- Image generation
- UI polish

## Acceptance Criteria
- Frontend loads locally
- Backend API responds
- PostgreSQL connection works
- A dummy `@weave.op()` call appears in Weave UI

## Stop Condition
You can click a button in the UI, hit the backend, and see a trace in Weave.

---

## Status: ✅ COMPLETE

All acceptance criteria have been implemented. Run `docker compose up --build -d` to verify.
