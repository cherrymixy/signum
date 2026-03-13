# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server on port 3000
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run Next.js ESLint
```

No test framework is configured.

## Environment

Requires `OPENAI_API_KEY` in `.env.local` for the AI agents to function.

## Architecture

Signum is an AI-powered image decoding analysis tool. Users upload an image with a creative intent, and a multi-agent pipeline analyzes the gap between what the creator intends and how target audiences perceive it.

### Data Flow

1. User submits image + intent + target audience via `InputPanel`
2. `useAgentStream` opens an SSE connection to `POST /api/agents/stream`
3. `streamingOrchestrator` runs agents sequentially, emitting SSE events
4. Frontend `handleSSEEvent` dispatches events into the Zustand store
5. `AgentCanvas` re-renders as nodes/edges are added by SSE events
6. User approves a revision → `executeApproval()` → Executor Agent generates image via DALL-E

### Agent Pipeline (6 agents)

Defined in `src/agents/agentDefinitions.ts`, implemented in `src/agents/`:

| Agent | Role |
|---|---|
| Intent Agent | Structures creator's intent (message, tone, CTA) |
| Decoder Agent | Generates audience interpretation hypotheses |
| Gap Analyst | Identifies misalignments between intent and perception |
| Revision Agent | Proposes visual editing suggestions |
| Executor Agent | Generates revised image via DALL-E |
| Orchestrator | Autonomous phase control for enrichment steps |

The pipeline runs in 3 phases: sequential analysis → autonomous enrichment (3–4 LLM-decided steps) → summary + approval request.

### SSE Streaming

`src/lib/sseHelpers.ts` provides the `SSEEmitter` class used on the server. Event types: `agent:status`, `cursor:move/grab/drop/connect`, `node:create/update`, `edge:create`, `approval:request`, `pipeline:done`, `error`.

### State Management

Single Zustand store at `src/stores/agentCanvasStore.ts` manages: canvas nodes/edges, agent states, approval requests, and activity feed.

### Canvas

`src/components/Canvas/AgentCanvas.tsx` uses ReactFlow with custom node types from `src/components/Nodes/`. `src/lib/layoutEngine.ts` handles automatic non-overlapping node placement. `src/lib/cursorBehaviors.ts` drives animated agent cursor movements during live analysis.

### Image Handling

Images are resized client-side (max 1600px, JPEG 0.8 quality) and transmitted as base64. Server body size limit is 10MB (configured in `next.config.js`). Supported formats: JPEG, PNG, GIF, WebP.

### Path Alias

`@/*` maps to `./src/*`.
