# Writing an adapter

An adapter is one file per official portal. It is the only part of this project allowed to touch a
browser, and even then only for `purchase`.

```ts
interface Adapter {
  country: CountryCode;
  check(request: CheckRequest): Promise<CheckOutcome>;
  quote(productId: string, vehicle: Vehicle, dates: DateRange): Quote | null;
  purchase(request: PurchaseRequest): Promise<PurchaseOutcome>;
}
```

## Build `check` first

`check` is read-only, needs no authentication, and has no side effects. It is also the most valuable
method in the project:

- it prevents a double purchase,
- it is the only acceptable proof that a purchase worked,
- and on its own it already answers *"is my Slovenian vignette still valid?"* — which is a useful tool
  even with no purchasing at all.

Return `{ outcome: 'ok', coverage, checkedAt }` **only** when the portal actually told you. If the page
changed, the plate lookup failed, or you are not sure: return a manual handoff. Never report absence of
coverage as a fact when the real answer is "we could not read it".

## Failure is a supported outcome

Every adapter must be able to end in `ManualHandoff`:

```ts
{
  outcome: 'manual',
  url: 'https://evinjeta.dars.si',
  prefill: { plate: '1AB2345', product: 'Monthly', validFrom: '2026-07-15' },
  instructions: 'Buy this here. Check the plate character by character before you pay.',
  reason: 'selector-not-found'
}
```

A tool that says *"here is the exact page and the exact values, finish it yourself"* survives a portal
redesign. A tool that throws gets uninstalled. Never `throw` out of an adapter for a portal-shaped
problem — throw only for programmer errors.

## `purchase` stops at the gateway

Fill the form. Reach the payment gateway. Stop. Return `handed-off-to-payment` and let the human do 3DS
in their own tab.

Before every step that costs money:

```ts
const verdict = journal.canProceed(runId, country);
if (!verdict.proceed) return { outcome: 'unsupported', reason: verdict.reason, url: portal };
journal.record({ run: runId, country, state: 'payment-submitted' });
```

Record **before** you act, not after. See [safety.md](safety.md#5-journal-before-act).

## Transport

Browser automation goes through a devtools MCP transport (Chrome or Firefox), not Playwright: a real
profile, a real fingerprint, existing logged-in sessions, and 3DS in the same tab.

Chrome ≥ 136 refuses `--remote-debugging-port` over the default user data directory, so it needs a
dedicated profile. Firefox has no such restriction. See
[adr/0001-browser-transport.md](adr/0001-browser-transport.md).

## Registering

```ts
import { registerAdapter } from 'toll-agent';
registerAdapter(myCzechAdapter);
```

Registration replaces the manual fallback for that country. Until then, every country uses
`manualAdapter`, which automates nothing and links only the official portal.

## Before you open a PR

Adapters for countries the maintainer does not drive through are welcome — with a record of a real run.
See [CONTRIBUTING.md](../CONTRIBUTING.md). Untestable automation in someone else's repository is a
liability, and here the liability is somebody's fine.
