# Analysis

An honest read of this project: where the value actually sits, what will break, what the law says, and
what the open questions from the kickoff should probably be answered with.

Written 2026-09-03, alongside the M0 implementation.

---

## 1. The short version

The strongest thing here is not the automation. It is **the trap data**.

A person planning a drive from Prague to the Adriatic can find the price of an Austrian vignette in
thirty seconds. What they cannot easily find, in one place, in a form they can act on, is:

- that the two-month one they are about to buy online will not be valid for eighteen days,
- that the Karawanken tunnel is not covered by it,
- that Slovenia will charge them double if their van is 1.31 m above the front axle,
- that Croatia has no vignette at all and the thing being sold to them under that name does not exist,
- and that the Hungarian "weekly" is ten days.

Each of those is a fine or an overpayment. Together they are a document nobody has written properly for
this corridor. The automation is a delivery mechanism for that document; the document is the product.

This has a consequence for sequencing: **M0 and M1 carry most of the value, and M3–M4 carry most of the
risk.** That is a good shape. It also means the project is useful and publishable long before it
automates a single purchase — which is exactly where it stands today.

## 2. The gap it addresses

The reseller layer is not a suspicion, it is documented by the operators themselves:

- ASFINAG's terms of use **exclude the resale of digital toll products** by third parties, and ASFINAG
  publishes warnings about unauthorised sellers.
- DARS **forbids** the sale of e-vinjete through unauthorised shops, and names the authorised ones
  (ASFINAG, Petrol, ADAC), all of which sell at face value.
- The Czech portal tells people to check they are on `edalnice.gov.cz`, warning about overpayment,
  misuse of payment details, and complications administering the vignette.
- Slovakia states plainly that `eznamka.sk` is the only official online sales channel.

Four state operators independently writing "beware of the shops that look like us" is the market
description. The resellers' advantage is not product, it is **search placement and confusion** — and
confusion is the part this tool actually attacks.

One nuance worth keeping: not every intermediary is a parasite. ASFINAG selling the Slovenian e-vinjeta
at face value as an authorised DARS partner is genuinely useful to someone crossing both. The data
models that as an `alternative-source`, not as a warning. The line is the markup and the authorisation,
not the act of being a middleman.

## 3. Where the value concentrates

**`check` is the load-bearing primitive.** It prevents double purchases, it is the only acceptable
proof that a purchase worked, and standalone it answers "is my Slovenian vignette still valid?" — a
question people ask a few times a year and currently answer by digging through email. A tool that only
did `check`, for five countries, would be worth installing. That is why M1 ships before any purchase
automation, and why it is right that it does.

**One thing to establish before writing any browser code for M1:** how much of `check` needs a browser
at all. Slovakia exposes a validity check as a page (`eznamka.sk/selfcare/validity-check`), Czechia
puts one on the portal homepage, and `od.edalnice.gov.cz` advertises open data for the whole vignette
information system (it returned an application error the day this was written, so its contents are
unverified). If any of those is reachable as a plain request, `check` for that country is a fetch and a
parse — no dedicated Chrome profile, no devtools transport, no fingerprint concerns. **Spend the first
day of M1 finding out.** It could remove the project's single largest piece of infrastructure from two
of five countries.

## 4. Technical risks, in order

| # | Risk | Severity | What blunts it |
|---|---|---|---|
| 1 | **Portal redesign breaks an adapter** | High, certain over time | The mandatory manual fallback. Degrading to "here is the page, here are your values" is the difference between a bug report and an uninstall. Already in the interface. |
| 2 | **Rule data goes stale silently** | High | `verifiedAt` on every rule, a staleness warning in the output, and a monthly CI job that opens an issue. Prices move every January and February; the calendar is predictable, so the maintenance is schedulable. |
| 3 | **Terms of service on automated purchase** | Medium–high, unresolved | See §5. This is the real gate on M3–M4, not the engineering. |
| 4 | **A double purchase in a crashed run** | Medium, unrecoverable when it happens | Journal-before-act plus `payment-submitted` never retried. Refunds are effectively impossible: both CZ and AT only allow changes before validity starts. |
| 5 | **The user gets the vehicle class wrong** | Medium | `needs-input` instead of a guessed class, and a plan step that shows the class before anything is bought. Cannot be eliminated — the state portals have the same failure mode. |
| 6 | **Route → countries is on the user** | Medium, UX | The tool asks for a list of countries. People who do not know Slovenia is on their route also do not know they need a vignette. This is the weakest link in the chain and no amount of rule data fixes it. |
| 7 | **CAPTCHA or bot defences on a portal** | Low–medium | Real profile, real fingerprint, human present. If a portal escalates, the fallback is the same manual handoff. |

Risk 6 deserves more thought than it got in the kickoff. "Take the output of an existing routing
service" is the right call architecturally, but the user-facing question — *"I'm driving from Brno to
Split, what do I need?"* — is the one people actually have. Answering it needs a country list from
somewhere. For an MCP deployment the assistant can often supply it, which is a genuine advantage of the
MCP form over the CLI, and worth stating in the README as a reason to use it that way.

## 5. Legal reading

None of this is legal advice, and the maintainer is not a lawyer. But the shape is clear enough to
plan around.

**What is comfortably fine:**

- Telling people what tolls they need and linking the official portal. That is a link and a fact.
- Reading a public validity-check page for a plate the user owns. Read-only, unauthenticated, the same
  request a browser makes.
- Publishing prices with attribution and dates. Facts about published tariffs are not anybody's IP.

**What needs checking before M3:**

- **Automating form-filling on a state portal.** Some operators' terms restrict automated access. Since
  the tool stops at the payment gateway and a human completes the purchase in their own browser, this
  is closer to assistive automation than to scraping — but "closer to" is not "checked". Read each
  portal's terms of use before writing its `purchase`, and record the finding in the adapter's file.
  If one forbids it, that country stays at `check` plus manual handoff, and that is an acceptable
  outcome, not a project failure.
- **Rate of automated checks.** One user checking their own plates a few times a year is invisible.
  Nothing in the design should ever make it look otherwise: no polling, no bulk lookups.

**What the project structurally avoids:**

- No payment handling → no payment-intermediary licensing, no PCI scope.
- No hosting → no processing of other people's plates, so GDPR exposure is the user's own machine.
- No resale → none of the operator terms about resale apply to us. Worth stating plainly in the README,
  because the resellers those terms target look superficially similar to a tool that fills in a form.

**One liability to name honestly:** if the data is wrong, someone gets fined. MIT's warranty disclaimer
covers the legal side; the design covers the practical side — sources, dates, staleness warnings, and
explicit gaps rather than confident silence. Keep the "this is a recommendation, the portal is the
authority" line in every output. It is currently printed on every CLI plan.

## 6. Honest criticisms of the design

**Section tolls are listed without knowing the route.** The tool shows all six Austrian section tolls
because it does not know which ones you drive. That is defensible but noisy — and noise is how people
learn to skip warnings. A route-aware version, or at minimum a "which of these are you crossing?"
prompt, would be better. The Karawanken hint (marked as on the usual CZ→SI/HR route) is a partial
patch, not a solution.

**Hungarian county vignettes are named but not computed.** The data says "the option exists and may be
cheaper", which is honest but unfinished. Without a county-to-route mapping the tool cannot tell you
whether three county vignettes beat one national. For a transit route the answer is usually the
national one; for someone driving to a lake house in one county it usually is not. This is the largest
remaining data gap in v1 and it is flagged in `gaps`.

**No multi-product combinations.** An eleven-day trip in Austria has no covering product, and the tool
says so — correctly — but does not suggest "two ten-day vignettes" or "one ten-day plus one one-day".
It should eventually. Today it tells the user the truth and lets them solve it.

**"Sold at most N days in advance" is weakly sourced.** The advance-purchase windows carry low-to-medium
confidence and are marked as gaps. They matter, because the Austrian 18-day rule turns "buy it early"
into the standard advice, and the standard advice is wrong if the portal will not sell it that early.
Verify these five numbers before promoting the project.

**The Croatian answer is right but thin.** "Pay at the gate" is correct and the most valuable correction
in the whole dataset, but the tool does not estimate the amount. Rough per-section tariffs would make
budgeting possible. Deliberately out of v1 — worth revisiting before the 2027 rewrite.

## 7. The open questions, answered

**Chrome or Firefox as primary?** Chrome, documented with a dedicated profile, Firefox supported.
Recorded in [adr/0001](adr/0001-browser-transport.md). The reasoning is reach, not technical merit —
Firefox is the nicer target and has no profile restriction, but the setup instruction "create a
separate Chrome profile" is a smaller ask than "install another browser". Both stay behind the same
transport-agnostic adapter interface. **Caveat:** if §3 turns out to be right and `check` can be done
with plain requests for CZ/SK, this decision only affects M3+ and can be deferred.

**Config file or arguments for vehicles and plates?** Arguments now; a config file later for fixed
dimensions only, never for a silently reused plate. Recorded in
[adr/0004](adr/0004-vehicle-configuration.md). The plate is the one value that must be re-read every
run — it is the thing that cannot be corrected after purchase.

**Accept adapter PRs for countries you do not drive?** Yes, with a mandatory record of a real run in
the PR: which portal, which date, `check` output before and after, and evidence that `purchase` stopped
at the payment gateway. Written into [CONTRIBUTING.md](../CONTRIBUTING.md) and the PR template. The
alternative — refusing them — caps the project at one person's holiday routes.

**Documentation language?** Both, English first. The mechanism is in place: `README.md` and
`docs/kickoff.en.md` in English, `README.cs.md` and `docs/kickoff.cs.md` in Czech, and rule text in the
data carrying `en` and `cs` so the CLI can be localised later without touching the code. English first
because MCP-server discovery, GitHub search and any coverage outside the region all run in English; the
Czech pages exist because the people who actually get fined at the Slovenian border are reading Czech.

## 8. Timing, and why it is unusually good

Two structural changes land in the next eighteen months, and both increase this project's value:

**Austria goes digital-only on 1 February 2027.** The sticker disappears, and with it the escape hatch
from the 18-day rule — "buy it at a petrol station and drive today". After that date, an online buyer
who has not planned eighteen days ahead has no fallback except the 1-day and 10-day products. The
single most valuable rule in this dataset gets more valuable, and there is no equivalent tool warning
people about it.

**Croatia switches to nationwide free-flow (Crolibertas) on 1 March 2027** — plate registration and ENC,
no barriers, built by SkyToll (SK) and TollNet (CZ), the same operators behind the Slovak and Czech
systems. Today Croatia is the one country where the honest answer is "we cannot help you buy anything".
In March 2027 it becomes an adapter — and, given who is building it, quite possibly one that resembles
the Slovak one.

So: publish now with the trap data and `check`, be the thing that already exists when both changes
land. A tool that has been right about Austria for a year is in a much better position in February 2027
than one that launches that month.

## 9. What it costs to keep alive

The maintenance load is small but non-optional, and it is the thing that kills projects like this.

- **Every January–February:** re-verify prices for six countries. Six official price pages, roughly
  fifty numbers. Half a day if the pages have not moved.
- **Annually:** re-check the portal list against the SFDI/CENDIS signpost. Ten minutes.
- **Whenever an adapter breaks:** a portal redesign, once every year or two per country. The manual
  fallback means this degrades service rather than ending it, which buys time to fix it properly.
- **Continuously:** nothing. There is no server, no queue, no database, no on-call.

The monthly CI job that opens an issue when data passes 180 days is the mechanism that turns "I should
check that" into a notification. That job is the difference between this repository being useful in
2028 and being a repository that lies with confidence.

## 10. Relationship to anthropics/commerce-agents

The kickoff asked to take the shape from Anthropic's
[commerce-agents](https://github.com/anthropics/commerce-agents) reference blueprint. What actually
transfers:

| commerce-agents | toll-agent |
|---|---|
| Agent defined once — prompt, tools, gates — and runs on several runtimes | Rules defined once in `data/`, consumed by the MCP server, the CLI and the library |
| `StorefrontBackend` / `MerchantBackend` interfaces per deployment | `Adapter` interface per country portal |
| *"Nothing places an order, charges a card, or changes a live listing"* — checkout renders the cart for the host to complete | `purchase` stops at the payment gateway; the human completes 3DS |
| Merchant writes staged until a human approves | Plan step waits for approval before anything is bought |
| Grounding and provenance gates inside the tool call | Every rule carries `source` and `verifiedAt`; no rule may originate from a model |

What does not transfer: it is Python, it is a blueprint for a business embedding an agent in its own
storefront, and its safety story is about protecting a merchant's live data. This is TypeScript, runs
on the driver's own machine, and its safety story is about protecting the driver from a fine and from a
double purchase. The shared conviction is the useful part: **the agent prepares the transaction and a
human completes it.** Everything else is a different problem.

## 11. What was verified while writing M0

Every number in `data/` was read off an official page on 2026-09-03. The ones worth naming, because
they contradict or sharpen the kickoff:

- **The 18-day rule, verbatim from ASFINAG:** *"2-Monats- und Jahres-Vignetten sind aufgrund des
  Konsumentenschutzes auch weiterhin frühestens ab dem 18. Tag nach dem Online-Kauf gültig."*
- **The Hungarian "weekly" is 10 days** — the official 2026 NÚSZ tariff calls it *Heti (10 napos)*.
  This was not in the kickoff's trap list, and it is exactly the shape of the ones that were.
- **Czech rates by powertrain are finer than "EVs are free":** zero-emission 0, CNG/LNG/biomethane 50 %,
  plug-in hybrids up to 50 g CO₂/km 25 %.
- **Croatia's free-flow system is called Crolibertas**, launching 1 March 2027, built by SkyToll +
  TollNet.
- **Slovenian class 1 monthly could not be verified** — recorded as a gap rather than as "does not
  exist".
- **`od.edalnice.gov.cz` returned an application error** — whether Czech open data can answer a plate
  query is unresolved, and it is the first thing M1 should find out.
