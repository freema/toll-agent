# Safety

Every rule here is enforced by a test or by the shape of an interface. Nothing on this page is meant to
be held in place by good intentions.

## 1. Nothing here touches a payment

An adapter's `purchase` drives the official form up to the payment gateway and stops. It does not
submit a payment, does not store card details, and does not work around Strong Customer Authentication.
3DS happens in the user's own browser tab, with the user watching.

The interface encodes this: the best outcome `purchase` can return is
`handed-off-to-payment` — there is no `paid` state for the tool to reach on its own.

**Why:** the moment this project handles money it becomes a payment intermediary, which is exactly the
role the resellers occupy. It would also need a licence, a backend and somebody else's card data.

## 2. No model decides a rule

`resolve()` is pure: same input, same output, no network, no LLM. Prices, validity windows, toll classes
and exemptions come out of `data/`, where each entry carries a `source` URL and a `verifiedAt` date.

**Why:** a hallucinated *"Slovenia doesn't need a vignette"* costs a real person a real fine, and
neither they nor we can tell afterwards that it happened. Wrong data in a file is findable and
fixable; a wrong sentence generated once is not.

An assistant is welcome to phrase the answer. It is not welcome to invent one.

## 3. We do not guess a toll class

When a country decides the class on a dimension the user did not give — Slovenia's height above the
front axle, Croatia's total height — `resolve` returns `needs-input` listing what is missing, instead
of falling through to the cheaper class.

**Why:** the difference between Slovenian 2A and 2B is exactly double the price, and being in the wrong
one is a fine, not a discount. An unasked question is cheaper than a wrong answer.

## 4. Only official URLs, ever

Every URL the tool can show a user comes from `data/portals.json` or from a rule's `source` field.
There is no code path that builds a shop URL out of user input or search results.

`test/data.test.ts` fails the build if any URL in the data resolves to a host outside the official
allowlist, or if a host merely looks like a reseller.

**Why:** this project exists because the first search result is usually not the state portal. If we
ever link one, we become part of the problem.

## 5. Journal before act

`Journal.record()` is called **before** each step that costs money, not after.

```jsonc
{ "run": "2026-07-15-hr", "country": "SI", "state": "payment-submitted", "at": "..." }
```

If the process dies between submitting a payment and confirming it, the next run comes back up in
`payment-submitted` and `canProceed()` returns false. The only allowed recovery is to call `check` and
ask the portal what actually happened.

**Why:** two vignettes for one plate are in practice unrefundable — both CZ and AT only allow changes
before validity starts.

## 6. Verify means the portal said so

An item counts as done only when a `check` against the portal returns it. A *"thank you for your
purchase"* page is not proof: it can appear before the record is created, and it can appear for a
purchase attached to the wrong plate.

`CheckOutcome` distinguishes `ok` (we read it from the portal) from `manual` (we could not, here is
where you look). The manual outcome must never be reported to the user as coverage.

## 7. Never retry a payment step automatically

`UNSAFE_TO_RETRY` contains `payment-submitted`. An unclear state stops the run and asks a human. There
is no back-off, no "probably failed, let's try again".

## 8. Stale data announces itself

Every country file has a `verifiedAt`. When it is older than `maxDataAgeDays` (180 by default),
`resolve` attaches a warning to that country's requirement telling the user how old the numbers are and
where to check them.

**Why:** prices in this region change every January and February. Without this, the repository quietly
turns into something that lies with confidence.

## 9. Known gaps are part of the output

Each country file has a `gaps` array. Anything we could not verify — Slovenia's monthly product for
motorcycles, Slovakia's advance-purchase window, Hungary's county-to-route mapping — is stated in the
output as a known gap rather than papered over.

**Why:** "we don't know" is a usable answer. A confident wrong answer is not.

## 10. Nothing leaves the machine

No backend, no database, no telemetry. Licence plates stay in the user's process and, if a journal is
enabled, on the user's disk. `.gitignore` excludes journal files and browser profiles so a plate cannot
be committed by accident.
