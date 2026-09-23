# Human Stamp

Seal short videos with human-approval receipts that survive platform metadata stripping.

## Architecture

```
human-stamp/
├── packages/core/     # Ed25519 signing, SHA-256 hashing, types
├── apps/cli/          # stamp seal command
└── apps/web/          # Next.js API + verify page
```

**Stack**: TypeScript monorepo (pnpm), Next.js App Router, Prisma + SQLite, Ed25519 signatures

**Dual-trust model**: Tool/stack claims (`tools[]`) are separate from human approval (`mode`, `approver`)

## Quick Start

```bash
# Install dependencies
pnpm install

# Generate Prisma client and push schema
cd apps/web
pnpm prisma:generate
pnpm prisma:push
cd ../..

# Start dev server
pnpm dev

# In another terminal, seal a video
cd apps/cli
pnpm dev seal ../../fixtures/sample.mp4 \
  --mode human \
  --tools "CapCut,Premiere" \
  --approver "Alice"

# Open verify URL printed by CLI
```

## CLI Usage

```bash
stamp seal <file> [options]

Options:
  --mode <mode>          human | human+ai | agent+human-approved (default: human)
  --tools <tools>        Comma-separated tools (e.g., "CapCut,Kling")
  --approver <name>      Human approver display name (default: Anonymous)
  --agent-roles <roles>  Comma-separated agent roles (optional)
  --api <url>            API base URL (default: http://localhost:3000)
```

## API

**POST /api/stamps**
- Accepts multipart `file` + `recipe` JSON
- Returns receipt with `id`, `signature`, `publicKey`

**GET /r/[id]**
- Public verify page
- Shows dual-trust UI: human approval vs tool claims
- Clear anti-overclaim disclaimer

## Tests

```bash
# Run all tests
pnpm test

# Run core package tests only
cd packages/core
pnpm test
```

## What This Stamp Does NOT Prove

This stamp verifies signed assertions at seal time. It does NOT verify authenticity or truth of media content.

## Database

**Development**: SQLite (`apps/web/prisma/dev.db`)

**Production**: Update `DATABASE_URL` in `.env` to Postgres connection string

```bash
# Migrate to Postgres
DATABASE_URL="postgresql://..." pnpm prisma:push
```

## Signing Keys

**Development**: Ephemeral keypair generated on boot (console warning)

**Production**: Set environment variables:
```bash
SIGNING_PRIVATE_KEY=<hex>
SIGNING_PUBLIC_KEY=<hex>
```

Generate production keys:
```typescript
import { generateKeyPair } from '@human-stamp/core';
const keys = await generateKeyPair();
console.log(keys);
```

## Scope Notes

**Slice 0 (current)**:
- Hard bind: SHA-256 only
- No auth, payments, or NFC
- Local SQLite for zero-config dev

**Future** (out of scope for Slice 0):
- Soft-binding / perceptual hash matching
- C2PA CA certificates
- Neural watermarks
