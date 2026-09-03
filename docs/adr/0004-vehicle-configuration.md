# ADR 0004 — Vehicles: arguments now, a config file when it hurts

**Status:** proposed (open question from the kickoff)
**Date:** 2026-09-03

## Context

Most people have one or two vehicles and re-plan a couple of trips a year. Some dimensions — height
above the front axle, powertrain, CO₂ — are annoying to look up and never change. The plate, on the
other hand, is the one value that must be re-read every single time.

## Decision

For now, every value is a CLI argument or an MCP tool parameter. No config file, no stored plates.

If a config file arrives later, it holds the vehicle's fixed dimensions and is explicitly **not** a
place where a plate is silently reused: any run must show the plate for confirmation before a purchase.

## Consequences

- Nothing on disk to leak. Plates exist only in the process, and in the journal if one is enabled —
  both excluded by `.gitignore`.
- The plan step keeps its job: the last place a typo in the plate can be caught before money moves.
- Repeated trips are slightly more typing. That is the cheaper failure.
