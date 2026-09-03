# toll-agent — kickoff

**Status:** design, agreed
**Date:** 2026-09-03
**Licence:** MIT
**Runtime:** TypeScript / Node, no Python
**Hosting:** none — an npm package you run locally

> Translation of the original Czech design document, [kickoff.cs.md](kickoff.cs.md). Where the two
> disagree, the Czech one is the original.

---

## 1. What it is

A tool that tells you, before a European road trip, which road tolls the route needs, checks what you
have already paid for, and prefills the purchase on the **official state portals**. It runs locally, in
your browser, on your card.

It exists because a layer of resellers has settled between the driver and the state e-shop, charging
20–30 % on top. We resell nothing — we send people straight to the source.

Distributed as an MCP server (stdio, `npx toll-agent`) plus a CLI for people without an assistant.

## 2. What it is not

These are boundaries, not temporary limitations. Do not move them casually.

- **We do not sell.** No catalogue, no margin, no order placed here.
- **We do not touch payment.** The adapter drives up to the payment gateway and stops. No stored cards,
  no working around SCA. The moment we start handling payment we stop being a tool and become the thing
  this was built against.
- **We do not host.** No backend, no database, nobody else's licence plate on our servers.
- **We do not give binding advice.** The output is a recommendation with a link to the official source.
  Responsibility for the plate and the vehicle class stays with the user — exactly as on the state
  portals.

## 3. Official portals

The source of truth is the SFDI/CENDIS signpost at
<https://edalnice.gov.cz/cs/elektronicke-dalnicni-znamky-ve-stredni-evrope>. We keep our own list as
data, not in code, and re-check it against that source once a year.

See the table in [README.md](../README.md#official-portals).

Above 3.5 t vignettes end and distance-based toll systems begin (GO-Box in AT, DarsGo in SI,
`myto.gov.cz` in CZ). A different world — out of scope for v1.

**Never link anything else.** When we do not know a country's official portal, we say so and link that
country's ministry of transport. A gap is better than a reseller.

## 4. Architecture

Three layers that cannot see each other.

### Layer 1 — rules as data

Pure data and deterministic code. No network, no model.

```ts
resolve(route: CountryCode[], vehicle: Vehicle, dates: DateRange): Requirement[]
```

**No LLM decides any of this.** A hallucinated *"Slovenia doesn't need a vignette"* costs the user
hundreds of euros in fines and leaves them no way of knowing it happened. Every rule is a row in the
data with a source link, a verification date and a test.

Route → list of countries is not solved with our own routing. We either ask, or take the output of an
existing routing service.

### Layer 2 — one adapter per country

One file per portal, three methods:

```ts
interface Adapter {
  country: CountryCode;
  check(plate: Plate): Promise<Coverage[]>;      // read-only, no authentication
  quote(req: Request): Quote;                     // from static data, no network
  purchase(req: Request): Promise<Outcome>;       // the only thing that touches a browser
}
```

`check` is the most valuable primitive in the project. It does three things at once: it prevents double
purchases, it confirms success, and on its own it answers *"is my Slovenian vignette still valid?"*.
It gets built first.

Adapters are opt-in and each has a mandatory fallback: when it fails it returns a deep link and
prefilled values for manual entry. A tool that can say *"click it through yourself"* survives a portal
redesign. A tool that crashes gets uninstalled.

### Layer 3 — orchestration

Browser through **devtools MCP** (Chrome or Firefox), not Playwright. A real profile, a real
fingerprint, logged-in sessions, and 3DS happens in the same tab — the agent just waits for the
redirect.

> Chrome ≥ 136 refuses `--remote-debugging-port` over the default user data dir (a defence against
> cookie theft). It needs a dedicated profile. Firefox has no such restriction.

The run:

1. **Preflight** — `check` for every country. Whatever is already valid drops out.
2. **Plan** — what is left, at what price, starting when. Waits for approval. The last place the user
   catches a typo in the plate.
3. **Purchase per country** — the form up to the payment gateway, then stop. The user confirms 3DS.
4. **Verify** — `check` again. Only the portal's confirmation counts as done. A *"thank you for your
   purchase"* page is not proof.
5. **Summary** — what is bought, what is paid on the spot.

## 5. Safety invariants

Things that must not fail. They belong in tests, not in documentation. See [safety.md](safety.md).

**Idempotence.** A journal written to disk *before* every step. If the process dies between submitting
a payment and confirming it, we come back up in `payment-submitted` and **must not repeat it**. We call
`check` and ask the portal instead. Without this you will eventually buy two vignettes — and you
practically cannot get the money back, since both CZ and AT only allow changes before validity starts.

**Verify after every purchase.** Without the portal's confirmation, an item is not done.

**Never repeat a payment step automatically.** An unclear state means stop and ask.

**A verification date on every rule.** Prices change every January and February. The tool warns when
data is older than X months. Otherwise, in a year, this becomes a repository that lies with confidence.

## 6. Rules that have to be in the data from day one

The real traps that make people pay fines — and the largest part of this project's value. See the table
in [README.md](../README.md#the-traps-it-knows-about).

## 7. Scope of v1

The corridor I drive myself. Five countries done properly beats fifteen done by guesswork.

**In:** CZ, AT, SI, SK, HU. Vehicles up to 3.5 t. HR as information, not as a purchase.

**Out:** over 3.5 t, GO-Box and DarsGo, CH/RO/BG (portal list only), routing from a GPS track, any
hosting.

### Milestones

See the table in [README.md](../README.md#status). M1 is independently useful and publishable — if the
project stopped there it would still have a point.

## 8. Open questions

- Chrome or Firefox devtools MCP as the primary transport? Firefox has no profile restriction, Chrome
  has more users. → recorded in [adr/0001-browser-transport.md](adr/0001-browser-transport.md).
- Multiple vehicles and plates — a config file, or an argument every time?
- Accept PRs with adapters for countries I do not drive through? Risk: untestable code in my repo.
  Proposal: yes, but with a mandatory record of a real run in the PR. → [CONTRIBUTING.md](../CONTRIBUTING.md).
- Documentation language — English for reach, or bilingual? The audience is Central European.
  → both, English first.

## 9. Sources

Everything verified 2026-09-03. Each rule in the data carries its own link and date.

- SFDI/CENDIS, signpost of official e-shops:
  <https://edalnice.gov.cz/cs/elektronicke-dalnicni-znamky-ve-stredni-evrope>
- ASFINAG Mautshop (vignettes, section tolls, Slovenian e-vinjeta): <https://shop.asfinag.at>
- DARS e-vinjeta: <https://evinjeta.dars.si>
- ASFINAG: warning about unauthorised sellers; resale of digital toll products is excluded by the terms
  of use
- Czech Ministry of Transport: complaints about overpriced vignettes go through the trade inspection

### Roadmap note

Croatia launches a nationwide free-flow system on **1 March 2027** — plate registration and ENC without
barriers. Until then there is nothing to buy in advance in HR; after that it is a new adapter.

Austria drops the sticker in February 2027 and goes digital-only. That removes the "buy it at a petrol
station and have it valid now" escape hatch, which makes the 18-day rule matter even more.
