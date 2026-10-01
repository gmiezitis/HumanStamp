# Human Stamp

Ship the exact cut your client approved. HumanStamp keeps final-file approval decisions and declared AI use together in a shareable, signed handoff record.

## Agency first-value experience

The public homepage includes an account-free, local-only interactive example: play the original sample video, approve it or request changes, inspect an unsigned example handoff, and simulate a replacement that needs fresh approval. The demo never submits real decisions or sends email. Its downloadable JSON is explicitly an unsigned example.

Agency users can start at `/dashboard/start` to create an agency workspace, new client, and campaign in one form, then upload the delivery cut. AI use must be explicitly declared; it is not inferred by an AI detector. Authenticated agency previews and token-based client previews stream the exact bound file with byte-range seeking. Expired or cancelled incomplete review links cannot preview media; completed links may reopen the original file.

Run the dedicated browser suite with `pnpm --filter @human-stamp/web exec playwright test --config=playwright.approvals.config.ts`. It covers the anonymous desktop/mobile example, actual first-project creation and upload, and the real review/notification/receipt workflow against local SMTP. The original demo clip and poster in `apps/web/public/demo` were generated for this project, with no third-party footage.

These improvements demonstrate the workflow; they do not establish market demand or promise a measured time saving. Agency interviews and controlled pilots are still needed. See `APPROVAL_WORKFLOW.md` for email and release configuration.

Exact-file hashing changes after platform re-encoding. A record documents approvals and claims, not legal compliance, media authenticity, or independently verified reviewer identity.

## Architecture

```
human-stamp/
├── packages/core/     # Ed25519 signing, SHA-256 hashing, types
├── apps/cli/          # stamp seal command
└── apps/web/          # Next.js API + verify page
```

**Stack**: TypeScript monorepo (pnpm), Next.js App Router, Prisma + PostgreSQL, Ed25519 signatures

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

**Slice 0**:
- Hard bind: SHA-256 only
- Ed25519 signatures
- Dual-trust UI (human approval vs tools)
- Local SQLite for zero-config dev

**Slice 1 (current)**:
- Soft-bind: perceptual fingerprinting (dHash on ~8 frames)
- Verify-by-upload: SHA-256 exact match or fingerprint recovery
- Match type display: exact vs fingerprint with similarity score
- Strip survival: works after platform re-encoding/metadata removal

**Why dHash?** Difference hash computes horizontal gradient differences per frame, making it resilient to re-encoding, minor compression, and metadata stripping while remaining fast and deterministic.

**Future** (out of scope for Slice 1):
- C2PA CA certificates
- Neural watermarks
- Identity Claims Aggregation
- Light stake / commitment
