# toll-agent

**Which European road tolls does your trip need, what do they cost, and where is the official state e-shop?**

Runs locally. Links only official portals. Never touches your payment.

[![CI](https://github.com/freema/toll-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/freema/toll-agent/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Česky: [README.cs.md](README.cs.md)

---

## Why this exists

Between a driver and a state e-shop, a layer of resellers has settled in, charging 20–30 % on top of a
product the state sells for a fixed price. They buy ads on the country name plus "vignette" and they
rank above the government portal. ASFINAG's terms of use exclude the resale of digital toll products
outright; DARS forbids sales through unauthorised shops. It happens anyway.

This tool resells nothing. It works out what your trip actually needs, tells you the traps that cost
people fines, and sends you to the official portal — the one where the price is the price.

## What it does

```bash
npx toll-agent plan --route CZ,AT,SI,HR --from 2026-07-15 --to 2026-07-25 \
  --plate 1AB2345 --front-height 1.25 --buy-on 2026-07-10
```

```
AT  vignette — class car (Multi-track vehicle up to 3.5 t)
   x 10-day                         12.8 EUR   valid 2026-07-15 .. 2026-07-24
       Runs out on 2026-07-24; the trip runs to 2026-07-25.
   x 2-month                          32 EUR   valid 2026-07-28 .. 2026-09-27
       Cannot start before 2026-07-28; the trip starts 2026-07-15.
       Bought online, this product is valid at the earliest from 2026-07-28 (18-day rule).
  [X] No single AT product covers 2026-07-15..2026-07-25 when bought online on 2026-07-10.
      Buying earlier or through a physical outlet often fixes it.

HR  pay on site — nothing to buy in advance
  [X] Croatia has no vignette. Motorway toll is distance-based and paid at the gate when you exit.
      Anyone selling you a "Croatian vignette" is selling you something that does not exist.
```

That Austrian answer is the whole point. A two-month vignette bought online on 10 July is not valid
until 28 July, because Austrian consumer law gives you 14 days to withdraw and ASFINAG waits them out.
People buy it, drive the next day, and get fined. The tool says so before you pay.

## The traps it knows about

| Trap | Why it costs money |
|---|---|
| **AT — the 18-day rule** | 2-month and annual digital vignettes bought **online** are valid at the earliest from the 18th day after purchase. 1-day and 10-day are valid immediately. Buying at a petrol station or motoring club is not distance selling — valid at once. |
| **AT — section tolls are separate** | Karawanken, Tauern, Brenner, Arlberg, Bosruck, Gleinalm are not covered by any vignette. Bought online, they carry the same 18-day delay. |
| **HR — there is no vignette** | Croatia charges by distance at a gate. The single most common wrong assumption on the drive to the Adriatic. A nationwide free-flow system (Crolibertas) arrives 1 March 2027. |
| **SI — 1.3 m above the *front axle*** | Not total height, not weight. Class 2B costs exactly twice 2A, and plenty of vans and camper conversions sit just over the line. |
| **HR — 1.9 m *total* height** | A different rule again. A roof box can move you up a class. |
| **HU — the "weekly" is 10 days** | The official 2026 tariff calls it *Heti (10 napos)*. And the year of validity cannot be corrected after purchase. |
| **HU — county vignettes** | A different structure from the national one: one per county crossed. Sometimes cheaper, sometimes not. |
| **CZ — powertrain changes the price** | Zero-emission free (registration still required), CNG/LNG/biomethane 50 %, plug-in hybrids up to 50 g CO₂/km 25 %. |
| **Over 3.5 t** | Vignettes end and distance-based tolling begins: GO-Box in AT, DarsGo in SI, myto.gov.cz in CZ, HU-GO in HU, emyto.sk in SK. Out of scope, and the tool says so rather than guessing. |

Every one of these is a line in [`data/`](data/) with a source URL and the date it was verified — not a
sentence in a prompt.

## Official portals

The source of truth for this list is the [SFDI/CENDIS signpost](https://edalnice.gov.cz/cs/elektronicke-dalnicni-znamky-ve-stredni-evrope).
We keep it as data and re-check it against that page.

| Country | Operator | Official shop | v1 |
|---|---|---|---|
| 🇨🇿 CZ | SFDI / CENDIS | <https://edalnice.gov.cz> | rules + data |
| 🇸🇰 SK | NDS / SkyToll | <https://eznamka.sk> | rules + data |
| 🇦🇹 AT | ASFINAG | <https://shop.asfinag.at> | rules + data |
| 🇭🇺 HU | NÚSZ | <https://nemzetiutdij.hu> | rules + data |
| 🇸🇮 SI | DARS | <https://evinjeta.dars.si> | rules + data |
| 🇭🇷 HR | HAC / Bina-Istra / AZM | <https://hac.hr> | information only — nothing to buy in advance |
| 🇨🇭 CH | BAZG | <https://via.admin.ch> | listed, not modelled |
| 🇷🇴 RO | CNAIR | <https://erovinieta.ro> | listed, not modelled |
| 🇧🇬 BG | BGTOLL | <https://bgtoll.bg> | listed, not modelled |

**We never link anything else.** When a country has no verified official portal in our data, we say so
and point at its ministry of transport. A gap is better than a reseller. There is a test that enforces
this ([`test/data.test.ts`](test/data.test.ts)).

## Install

```bash
npx toll-agent plan --route CZ,AT --from 2026-07-15 --to 2026-07-20
```

As an MCP server (stdio) — add to your MCP client's config:

```json
{
  "mcpServers": {
    "toll-agent": { "command": "npx", "args": ["-y", "toll-agent", "mcp"] }
  }
}
```

Tools it exposes:

| Tool | What it answers |
|---|---|
| `toll_resolve` | Route + vehicle + dates → what to pay, which product covers it, what it costs, what is paid on the spot. |
| `toll_portals` | The official-portal allowlist, with operators and verification dates. |
| `toll_country_rules` | The raw verified rule set for one country, sources included. |
| `toll_check` | What a plate already has. In v1 a manual handoff to the official check page. |

As a library:

```ts
import { resolve } from 'toll-agent';

const plan = resolve({
  route: ['CZ', 'AT', 'SI'],
  vehicle: { category: 'car', maxWeightKg: 1800, heightAboveFrontAxleM: 1.25, plate: '1AB2345' },
  dates: { from: '2026-07-15', to: '2026-07-25' },
  purchase: { on: '2026-07-10', channel: 'online' },
});
```

## What it is not

These are boundaries, not a backlog.

- **It does not sell.** No catalogue, no margin, no order placed here.
- **It does not touch payment.** An adapter drives the official form up to the payment gateway and
  stops. No stored cards, no working around SCA. The moment we handle payment we stop being a tool and
  become the thing this was built against.
- **It does not host.** No backend, no database, nobody else's licence plate on our servers.
- **It does not give binding advice.** Output is a recommendation with a link to the official source.
  The plate and the vehicle class are yours to get right — exactly as on the state portals.

## How it is built

Three layers that cannot see each other.

**1 — Rules as data.** `resolve(route, vehicle, dates)` is pure and deterministic: no network, no model.
A hallucinated *"Slovenia doesn't need a vignette"* costs a real person a real fine and leaves no trace
of how it happened, so an LLM decides none of it. Every rule is a row in `data/` with a source, a
verification date and a test.

**2 — One adapter per portal.** `check` (read-only, no auth), `quote` (static data, no network),
`purchase` (the only thing that touches a browser). `check` is the load-bearing primitive: it prevents
double purchases, it is the only acceptable proof that a purchase worked, and on its own it already
answers *"is my Slovenian vignette still valid?"*. Every adapter has a mandatory fallback — when it
fails it returns a deep link and the values to type in. A tool that can say *"finish this yourself"*
survives a portal redesign. One that crashes gets uninstalled.

**3 — Orchestration.** Preflight (`check` each country) → plan (waits for your approval) → purchase per
country, form filled up to the payment gateway → verify (`check` again) → summary. A *"thank you for
your purchase"* page is not proof. The portal's own answer is.

Safety invariants — journal-before-act idempotence, verify after every purchase, never repeat a payment
step automatically — live in [`docs/safety.md`](docs/safety.md) and in the tests, not in prose.

## Status

**v1 in progress.** M0 (rule data + `resolve()`) is done and tested; the browser adapters are not
written yet, so `check` and `purchase` hand off to the official portal with the values prefilled.

| Milestone | Content | Done when |
|---|---|---|
| **M0** ✅ | Data layer + `resolve()` | "CZ → HR, car, 15–25 July" returns the right list, including that Croatia is paid at the gate |
| M1 | `check` for CZ and AT | "Do I have a valid vignette?" works over the devtools transport |
| M2 | `check` for SI, SK, HU | Preflight for a whole route |
| M3 | `purchase` for CZ | Journal, verify, idempotence — the whole pattern on one country |
| M4 | `purchase` for AT and SI | Proves the abstraction holds across countries |
| M5 | CLI + README + publish | `npx toll-agent` |

M1 is independently useful and shippable. If the project stopped there it would still have a point.

## Contributing

Adapters for countries the maintainer does not drive through are welcome, but a PR that adds one must
include a record of a real run — see [CONTRIBUTING.md](CONTRIBUTING.md). Untestable code in someone
else's repo is a liability, and here the liability is somebody's fine.

Corrections to rule data are the most valuable contribution there is. Every rule carries a source URL
and a date; if one is wrong or out of date, open an issue with the official page that proves it.

## Related

The layering here — one definition, deterministic tools, a hard stop before payment — follows
[anthropics/commerce-agents](https://github.com/anthropics/commerce-agents), Anthropic's reference
blueprint for commerce agents, where *"nothing places an order, charges a card, or changes a live
listing"*. That repo is Python and about shopping agents a business embeds; this one is TypeScript,
runs on your machine, and buys from nine governments instead of one storefront. The shared idea is that
the agent prepares the transaction and a human completes it.

## Licence

MIT. See [LICENSE](LICENSE).

Not affiliated with SFDI, CENDIS, ASFINAG, DARS, NDS, NÚSZ, HAC or any other operator. All prices and
rules are best-effort data with sources and dates attached; the official portal is always the
authority.
