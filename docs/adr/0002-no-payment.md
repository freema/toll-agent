# ADR 0002 — The tool stops at the payment gateway

**Status:** accepted
**Date:** 2026-09-03

## Context

The obvious "next feature" for a tool that fills in a purchase form is to finish the purchase. Card on
file, one-click, done. It is also the point at which the project would stop being a tool.

## Decision

`purchase` fills the official form, reaches the payment gateway and stops. The best outcome the
interface can express is `handed-off-to-payment`. There is no state for "paid" that the tool can reach
on its own, no card storage, and no path around Strong Customer Authentication.

## Consequences

- Every purchase needs a human at the keyboard. Batch buying for a fleet is out of reach, by design.
- We never hold card data, never need PCI scope, never need a payment licence, and never become a
  payment intermediary — which is precisely the role the resellers occupy.
- The one thing a user must check — the licence plate — is checked at a moment when they are already
  looking at the screen.

## Rejected alternative

Storing a card "for convenience" behind a local keychain. It moves the project across the line the
README draws, and the first support request after a mis-typed plate would be about money we moved.
