# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Chrome Extension

A Manifest V3 Chrome extension lives in `chrome-extension/`. It is a pure static project (no build step required) and is loaded directly into Chrome as an unpacked extension.

### File Structure

```
chrome-extension/
├── manifest.json        — 확장 프로그램 설정 (권한, 파일 등록)
├── service-worker.js    — 백그라운드 워커 (OpenAI API 호출, 메시지 라우팅)
├── content-script.js    — 웹페이지 주입 스크립트 (드래그 감지, 플로팅 버튼)
├── sidepanel.html       — 사이드 패널 UI
├── sidepanel.js         — 사이드 패널 로직
├── styles.css           — content-script 삽입 스타일 (플로팅 버튼, 인라인 카드)
└── panel.css            — 사이드 패널 스타일
```

### Key Design Decisions

- API key stored in `chrome.storage.local` — never hardcoded
- OpenAI API called from service-worker only (keeps key off content-script)
- Message passing: `TRANSLATE_REQUEST`, `SELECTION_TO_SIDEPANEL`, `FILL_SIDEPANEL`, `SAVE_SETTINGS`, `LOAD_SETTINGS`
- Default target language persisted in `chrome.storage.local`
