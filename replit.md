# Erfan

An interactive autonomous-agent interface with a reasoning graph, animated orb, agent details, and live status overview.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/erfan run dev` — run the Erfan web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/erfan` — Erfan web app
- `artifacts/api-server` — shared API server
- `lib/api-spec/openapi.yaml` — API contract
- `lib/db/src/schema` — database schema

## Architecture decisions

- The chat is connected server-side to LLM7.io's anonymous `gpt-oss:20b` endpoint. Its free access and limits can change; do not describe the graph or agent cards as connected tools, imply full-duplex audio from the model, or claim the separate Apex humanoid.
- The server enforces a shared in-memory cap of 20 chat requests per minute to protect the anonymous provider quota; this is process-wide, not per user.
- Chat prompts are sent to LLM7.io, and recent chat history stays in the user's browser. Do not send secrets to the model or log prompt contents.
- Voice uses browser speech recognition for live transcription and browser speech synthesis for spoken replies. The LLM endpoint is text-only, so this is turn-based voice, not full-duplex model audio; detect unsupported browsers and keep text chat available.
- The source project is MIT-licensed, but Apex and Reznikov Engineering names/branding are excluded. Keep the upstream license and component credits with redistributed code, and use Erfan branding.
- Weather uses Open-Meteo and browser geolocation; do not display fabricated live conditions.

## Product

Erfan presents an interactive agent constellation around a particle orb. Users can chat with the text model, cycle the illustrative orb state, and open agent detail cards; the overview includes time and weather.

## User preferences

- The interface should be a complete Erfan-branded recreation of the referenced public APEX-UI project.

## Gotchas

- Preserve the source license and community component credits when changing or redistributing the interface.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
