# toll-agent

**Jaké dálniční poplatky na trase potřebuješ, kolik stojí a kde je oficiální státní e-shop.**

Běží lokálně. Odkazuje jen na oficiální portály. Na platbu nesahá.

> English: [README.md](README.md)

---

## Proč to existuje

Mezi řidičem a státním e-shopem se usadila vrstva překupníků s dvaceti až třicetiprocentní přirážkou na
produkt, který stát prodává za pevnou cenu. Kupují si reklamu na „název země + známka“ a stojí nad
vládním portálem. Obchodní podmínky ASFINAGu další prodej digitálních mýtných produktů přímo vylučují,
DARS zakazuje prodej přes neautorizované obchody. Děje se to stejně.

Tenhle nástroj nic nepřeprodává. Spočítá, co trasa opravdu potřebuje, řekne ti pasti, kvůli kterým
lidé platí pokuty, a pošle tě na oficiální portál — tam, kde cena je cena.

## Co to umí

Balíček zatím není na npm, takže `npx toll-agent` nefunguje. Instalace z klonu repozitáře je popsaná
v [README.md](README.md#install).

```bash
toll-agent plan --route CZ,AT,SI,HR --from 2026-07-15 --to 2026-07-25 \
  --plate 1AB2345 --front-height 1.25 --buy-on 2026-07-10
```

```
AT  vignette — class car (Multi-track vehicle up to 3.5 t)
   x 10-day                         12.8 EUR   valid 2026-07-15 .. 2026-07-24
       Runs out on 2026-07-24; the trip runs to 2026-07-25.
   x 2-month                          32 EUR   valid 2026-07-28 .. 2026-09-27
       Cannot start before 2026-07-28; the trip starts 2026-07-15.
  [X] No single AT product covers 2026-07-15..2026-07-25 when bought online on 2026-07-10.

HR  pay on site — nothing to buy in advance
  [X] Chorvatsko známku nemá. Mýtné se platí podle ujeté vzdálenosti na bráně při výjezdu.
```

Ta rakouská odpověď je celý smysl nástroje. Dvouměsíční známka koupená online 10. července začne platit
až 28. července, protože rakouský spotřebitelský zákon dává 14 dní na odstoupení a ASFINAG je vyčká.
Lidé ji koupí, druhý den vyjedou a dostanou pokutu. Nástroj to řekne dřív, než zaplatíš.

## Pasti, které zná

| Past | Proč stojí peníze |
|---|---|
| **AT — 18denní lhůta** | Dvouměsíční a roční digitální známka koupená **online** platí nejdřív od 18. dne po nákupu. Jednodenní a desetidenní platí hned. Nákup na benzínce nebo u autoklubu není zásilkový obchod — platí okamžitě. |
| **AT — úsekové mýto zvlášť** | Karawanken, Tauern, Brenner, Arlberg, Bosruck, Gleinalm známka nepokrývá. Koupené online podléhají stejné 18denní lhůtě. |
| **HR — známka neexistuje** | Chorvatsko účtuje podle vzdálenosti na bráně. Nejčastější mylný předpoklad na cestě k moři. Celostátní free-flow (Crolibertas) přijde 1. března 2027. |
| **SI — 1,3 m nad *přední nápravou*** | Ne celková výška, ne hmotnost. Třída 2B stojí přesně dvojnásobek 2A a spousta dodávek a vestaveb je těsně nad hranicí. |
| **HR — 1,9 m *celkové* výšky** | Zase jiné pravidlo. Střešní box tě může posunout o třídu výš. |
| **HU — „týdenní“ platí 10 dní** | Oficiální sazebník 2026 ji uvádí jako *Heti (10 napos)*. A rok platnosti po nákupu nejde opravit. |
| **HU — župní známky** | Jiná struktura než celostátní: jedna na každou župu na trase. Někdy levnější, někdy ne. |
| **CZ — pohon mění cenu** | Nulové emise zdarma (evidence je ale potřeba), CNG/LNG/biometan 50 %, plug-in hybridy do 50 g CO₂/km 25 %. |
| **Nad 3,5 t** | Končí známky a začínají mýtné systémy: GO-Box v AT, DarsGo v SI, myto.gov.cz v CZ, HU-GO v HU, emyto.sk v SK. Mimo rozsah — a nástroj to řekne, místo aby hádal. |

Každá z nich je řádek v [`data/`](data/) s odkazem na zdroj a datem ověření — ne věta v promptu.

## Oficiální portály

Zdrojem pravdy je [rozcestník SFDI/CENDIS](https://edalnice.gov.cz/cs/elektronicke-dalnicni-znamky-ve-stredni-evrope).
Držíme ho jako data a proti té stránce ho kontrolujeme.

| Země | Provozovatel | Oficiální e-shop | v1 |
|---|---|---|---|
| 🇨🇿 CZ | SFDI / CENDIS | <https://edalnice.gov.cz> | pravidla + data |
| 🇸🇰 SK | NDS / SkyToll | <https://eznamka.sk> | pravidla + data |
| 🇦🇹 AT | ASFINAG | <https://shop.asfinag.at> | pravidla + data |
| 🇭🇺 HU | NÚSZ | <https://nemzetiutdij.hu> | pravidla + data |
| 🇸🇮 SI | DARS | <https://evinjeta.dars.si> | pravidla + data |
| 🇭🇷 HR | HAC / Bina-Istra / AZM | <https://hac.hr> | jen informace — předem nejde koupit nic |
| 🇨🇭 CH | BAZG | <https://via.admin.ch> | jen v seznamu |
| 🇷🇴 RO | CNAIR | <https://erovinieta.ro> | jen v seznamu |
| 🇧🇬 BG | BGTOLL | <https://bgtoll.bg> | jen v seznamu |

**Nic jiného nelinkujeme.** Když pro zemi neznáme oficiální portál, řekneme to a odkážeme na její
ministerstvo dopravy. Radši mezera než překupník. Hlídá to test ([`test/data.test.ts`](test/data.test.ts)).

## Co to není

Tohle jsou hranice projektu, ne dočasná omezení.

- **Neprodáváme.** Žádný katalog, žádná marže, žádná objednávka u nás.
- **Nesaháme na platbu.** Adaptér dojede na platební bránu a zastaví se. Žádné ukládání karet, žádné
  obcházení SCA. Jakmile začneme řešit platbu, přestaneme být nástroj a staneme se tím, proti čemu to
  vzniklo.
- **Nehostujeme.** Žádný backend, žádná databáze, žádné cizí SPZ na našich serverech.
- **Neradíme závazně.** Výstup je doporučení s odkazem na oficiální zdroj. Odpovědnost za správnost SPZ
  a kategorie zůstává na uživateli — stejně jako u státních portálů.

## Jak je to postavené

Tři vrstvy, které se navzájem nevidí. Detaily v [docs/kickoff.cs.md](docs/kickoff.cs.md).

1. **Pravidla jako data.** `resolve()` je čistý a deterministický: žádná síť, žádný model. Halucinace ve
   stylu „Slovinsko známku nepotřebuje“ stojí uživatele stovky eur a nemá jak zjistit, že k ní došlo.
2. **Adaptér na zemi.** `check` / `quote` / `purchase`. `check` je nejcennější primitiv — brání dvojímu
   nákupu, potvrzuje úspěch a sám o sobě odpovídá na „mám ještě platnou slovinskou?“.
3. **Orchestrace.** Preflight → plán ke schválení → nákup po zemích až na platební bránu → verify →
   souhrn. „Děkujeme za nákup“ na stránce není důkaz.

Bezpečnostní invarianty jsou v [docs/safety.md](docs/safety.md) a v testech, ne v dokumentaci.

## Stav

**v1 se staví.** M0 (datová vrstva + `resolve()`) je hotový a otestovaný. Adaptéry na prohlížeč zatím
nejsou, takže `check` i `purchase` končí předáním na oficiální portál s předvyplněnými hodnotami.

## Licence

MIT. Viz [LICENSE](LICENSE).

Bez vazby na SFDI, CENDIS, ASFINAG, DARS, NDS, NÚSZ, HAC ani jiného provozovatele. Ceny a pravidla jsou
data ověřená podle nejlepšího vědomí, s odkazy a daty; autoritou je vždy oficiální portál.
