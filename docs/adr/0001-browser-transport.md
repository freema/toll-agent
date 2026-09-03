# ADR 0001 — Browser transport: devtools MCP, Chrome primary

**Status:** proposed (open question from the kickoff)
**Date:** 2026-09-03

## Context

`purchase` has to drive a real state portal, reach a payment gateway, and let a human complete 3DS in
the same tab. Three options:

1. **Playwright / Puppeteer with a fresh browser.** Clean, scriptable, well documented. Also a fresh
   fingerprint, no logged-in session, and a 3DS flow the user cannot see or finish in their own browser.
   Some portals treat it as a bot.
2. **Chrome devtools MCP against the user's own Chrome.** Real profile, real fingerprint, existing
   sessions, 3DS in the tab the user is already looking at. Chrome ≥ 136 refuses
   `--remote-debugging-port` over the default user data directory — a deliberate defence against cookie
   theft — so it needs a dedicated profile.
3. **Firefox devtools MCP.** Same benefits, no profile restriction, considerably fewer users.

## Decision

Devtools MCP, not Playwright. Chrome as the documented default with a dedicated profile; Firefox
supported and preferred by anyone who does not want to run a second profile.

The adapter interface does not name a browser, so the transport stays swappable. An adapter that cannot
reach its transport returns a manual handoff like any other failure.

## Consequences

- Setup instructions must cover creating the dedicated Chrome profile, and must explain *why* Chrome
  refuses the default one. Users who hit that error otherwise conclude the tool is broken.
- The user watches the purchase happen. That is a feature: the plan step is the last place to catch a
  typo in a plate, and seeing the official portal fill in is the confirmation that we are on it.
- We inherit whatever the user's browser is: extensions, blockers, a stale session. Adapters must fail
  into a manual handoff rather than assume a clean page.

## Revisit when

Chrome changes the remote-debugging rules again, or a portal starts actively blocking automated
sessions on a real profile.
