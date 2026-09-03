# The data model

`data/` is the product. The code is what reads it.

```
data/
├── portals.json          the allowlist: one official shop per country
└── countries/
    ├── cz.json  at.json  si.json  sk.json  hu.json  hr.json
```

Every file is validated against a zod schema at load time (`src/data/schema.ts`), so a broken rule
fails loudly on startup rather than quietly producing a wrong plan.

## A country file

| Field | Meaning |
|---|---|
| `system` | `vignette`, `vignette+section-toll` or `toll-gate`. Croatia is `toll-gate`, which is why it has no products. |
| `scopeLimit` | Where v1 stops (3.5 t) and which system takes over above it. |
| `tollClasses` | Ordered. First match wins. Each has a `when` predicate. |
| `products` | What can be bought, with price, validity and online rules. |
| `sectionTolls` | Not covered by any vignette. Austria only, so far. |
| `purchase` | Advance-purchase window, whether validity can start immediately, what the product binds to. |
| `rules` | The traps. Each carries `severity`, `effect`, `source`, `verifiedAt`, optionally a verbatim `quote`. |
| `gaps` | What we could not verify. Stated in the output rather than hidden. |

## Predicates

A tiny declarative matcher shared by toll classes, price variants and rules:

```jsonc
{ "category": "car", "maxWeightKg": { "lte": 3500 }, "heightAboveFrontAxleM": { "gte": 1.3 } }
```

Supported: a literal value, or `{ lt, lte, gt, gte, in, not }`.

The match is three-valued: `yes`, `no`, or `unknown` when the vehicle does not carry a field the
predicate needs. `unknown` is why the tool asks for a dimension instead of guessing a toll class.

## Validity

| Type | Meaning | Example |
|---|---|---|
| `rolling-days` | `n` consecutive days from the chosen start | CZ 10-day, HU "weekly" (10 days) |
| `rolling-months` | `n` months from the chosen start | AT 2-month |
| `season` | A fixed window | AT annual 2026: 2025-12-01 → 2027-01-31 |

`online.validFromDays` delays the start when bought online — this is where Austria's 18-day rule lives.
`online.immediateChannels` lists the channels that escape it (`retail`: petrol stations, motoring
clubs), because buying at a counter is not distance selling.

## Prices and variants

A product has one `price` and optional `variants`, each with its own predicate. The first matching
variant wins. Czech powertrain discounts are variants rather than multipliers in code, so every number
in the output is a number somebody read off an official price list:

```jsonc
"variants": [
  { "when": { "powertrain": { "in": ["bev", "hydrogen"] } }, "price": { "amount": 0 } },
  { "when": { "powertrain": "phev", "co2GramsPerKm": { "lte": 50 } }, "price": { "amount": 640 } }
]
```

## Adding or correcting a rule

1. Change the data file, not the code. If the code has to change to express a rule, the model is
   missing something — say so in the PR.
2. Give it a `source` that is an official portal URL, and a `verifiedAt` you personally checked.
3. Add a test in `test/resolve.test.ts` that fails without the change.
4. `npm test` also enforces: unique product ids, products pointing at classes that exist, no URL
   outside the official allowlist, no verification date in the future.
