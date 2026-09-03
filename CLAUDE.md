# toll-agent — notes for Claude Code

## What this is

A local tool that works out which European road tolls a trip needs and links the **official state
e-shop**. It resells nothing, hosts nothing, and never touches a payment.

## Hard rules

1. **Never link a non-official URL.** Every URL shown to a user comes from `data/portals.json` or a
   rule's `source`. There is a test enforcing the allowlist; do not add an exception to it.
2. **Never put a rule, price or validity window in code or a prompt.** It goes in `data/` with a
   `source` URL and a `verifiedAt` date, or it does not exist. See
   [docs/adr/0003-rules-as-data.md](docs/adr/0003-rules-as-data.md).
3. **Never invent a price.** If you cannot verify it against an official page, add it to that country's
   `gaps` array instead.
4. **Nothing may submit a payment.** `purchase` stops at the gateway. No card storage, no SCA
   workarounds.
5. **Do not guess a toll class.** Missing dimension → `needs-input`, never the cheaper class.
6. **Journal before act.** Anything that costs money records its state before it happens, and
   `payment-submitted` is never retried automatically.

## Layout

```
data/            rules as data — the actual product
src/rules/       resolve(), classification, validity. Pure, deterministic, no I/O.
src/adapters/    one per portal; manual.ts is the fallback every country starts with
src/journal/     append-only idempotence journal
src/mcp/         stdio MCP server
src/cli/         the CLI
test/            resolve, data integrity, journal, adapters
docs/            kickoff (cs/en), safety, adapters, data model, ADRs
```

## Commands

```bash
npm test
npm run typecheck
npm run cli -- plan --route CZ,AT,SI --from 2026-07-15 --to 2026-07-25
npm run mcp
```

## Conventions

- TypeScript, ESM, Node ≥ 20.10. No Python.
- English in code, comments, tests and commits. Rule text in data carries `en` and `cs`.
- Prefer adding a failing test in `test/resolve.test.ts` before changing rule behaviour.
- Comments explain *why* a rule exists (which fine it prevents), not what the code does.
