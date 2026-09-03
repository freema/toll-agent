# ADR 0003 — Rules live in data, never in a model

**Status:** accepted
**Date:** 2026-09-03

## Context

An LLM could answer "which vignettes do I need for CZ → HR in July" directly, and would sound right
most of the time. The failure mode is the problem: *"Slovenia doesn't need a vignette"* is a fluent,
confident sentence that costs a real person a real fine, and neither they nor we can tell afterwards
that it happened.

## Decision

`resolve()` is pure and deterministic. Prices, validity windows, toll classes, exemptions and traps
come from `data/`, where every entry carries a `source` URL and a `verifiedAt` date. No network call,
no model, in that path.

An assistant may phrase the answer. It may not invent one. The MCP server's instructions say so
explicitly, and the tools return sources with every claim so the model has something to cite instead of
recall.

## Consequences

- Coverage grows one verified country at a time instead of appearing all at once. Five countries done
  properly beats fifteen done by guesswork.
- Wrongness becomes findable: a bad price is a line in a file with a date on it, and a test can fail on
  it. A hallucination has no line and no date.
- Maintenance is real work. Prices change every January and February, so the tool warns when its data
  is older than 180 days rather than pretending nothing moved.
- When we do not know something, we say so: `gaps` in each country file surface in the output.
