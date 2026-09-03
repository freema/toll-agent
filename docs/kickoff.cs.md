# toll-agent — kickoff

**Stav:** návrh k odsouhlasení
**Datum:** 2026-09-03
**Licence:** MIT
**Runtime:** TypeScript / Node, žádný Python
**Hosting:** žádný — pouze npm balíček spouštěný lokálně

> Tohle je původní zadání projektu, zachované tak, jak vzniklo. Co je z něj už postavené, je vidět
> v sekci Stav v [README.cs.md](../README.cs.md). Anglická verze: [kickoff.en.md](kickoff.en.md).

---

## 1. Co to je

Nástroj, který ti před cestou po Evropě řekne, jaké dálniční poplatky na trase potřebuješ, ověří co už
máš zaplacené, a nákup ti předvyplní na **oficiálních státních portálech**. Běží lokálně, ve tvém
prohlížeči, tvou kartou.

Existuje kvůli tomu, že mezi řidičem a státním e-shopem se usadila vrstva překupníků s dvaceti až
třicetiprocentní přirážkou. Nic nepřeprodáváme — posíláme lidi rovnou ke zdroji.

Distribuce jako MCP server (stdio, `npx toll-agent`) plus CLI pro lidi bez asistenta.

## 2. Co to není

Tohle jsou hranice projektu, ne dočasná omezení. Neposouvat bez rozmyslu.

- **Neprodáváme.** Žádný katalog, žádná marže, žádná objednávka u nás.
- **Nesaháme na platbu.** Adaptér dojede na platební bránu a zastaví se. Žádné ukládání karet, žádné
  obcházení SCA. Jakmile začneme řešit platbu, přestaneme být nástroj a staneme se tím, proti čemu to
  vzniklo.
- **Nehostujeme.** Žádný backend, žádná databáze, žádné cizí SPZ na našich serverech.
- **Neradíme závazně.** Výstup je doporučení s odkazem na oficiální zdroj. Odpovědnost za správnost SPZ
  a kategorie zůstává na uživateli — stejně jako u státních portálů.

## 3. Oficiální portály

Zdrojem pravdy je rozcestník SFDI/CENDIS na
<https://edalnice.gov.cz/cs/elektronicke-dalnicni-znamky-ve-stredni-evrope>.
Vlastní seznam držíme jako data, ne v kódu, a proti tomuto zdroji ho jednou ročně kontrolujeme.

| Země | Provozovatel | Oficiální e-shop | Poznámka |
|---|---|---|---|
| 🇨🇿 CZ | SFDI / CENDIS | <https://edalnice.gov.cz> | Kontrola platnosti přímo na homepage. Open data: `opendata.edalnice.gov.cz`. Nákup až 30 dní dopředu. |
| 🇸🇰 SK | SkyToll | <https://eznamka.sk> | |
| 🇦🇹 AT | ASFINAG | <https://shop.asfinag.at> | Prodává i úsekové mýto **a slovinskou e-vinjetu** jako autorizovaný partner DARS bez přirážky. |
| 🇭🇺 HU | NÚSZ | <https://nemzetiutdij.hu> | Kromě celostátní D1 i župní známky — jiná logika než jinde. |
| 🇸🇮 SI | DARS | <https://evinjeta.dars.si> | Vše platné okamžitě, nákup až 30 dní dopředu. |
| 🇨🇭 CH | Federální celní správa | <https://via.admin.ch> | |
| 🇷🇴 RO | CNAIR | <https://erovinieta.ro> | |
| 🇧🇬 BG | BGTOLL | <https://bgtoll.bg> | |
| 🇭🇷 HR | HAC / Bina Istra / AZM | <https://hac.hr> | **Známka neexistuje.** Mýto podle ujeté vzdálenosti na branách. Předem nekoupíš nic. |

Nad 3,5 t končí známky a začínají mýtné systémy (GO-Box v AT, DarsGo v SI, `myto.gov.cz` v CZ). Jiný
svět — mimo scope v1.

**Nikdy nelinkovat nic jiného.** Když pro zemi neznáme oficiální portál, řekneme to a odkážeme na
ministerstvo dopravy dané země. Radši mezera než překupník.

## 4. Architektura

Tři vrstvy, které se navzájem nevidí.

### Vrstva 1 — pravidla jako data

Čistá data a deterministický kód. Žádná síť, žádný model.

```ts
resolve(route: CountryCode[], vehicle: Vehicle, dates: DateRange): Requirement[]
```

```ts
type Requirement =
  | { country: 'AT'; kind: 'vignette'; options: Product[] }
  | { country: 'AT'; kind: 'section-toll'; name: 'Karawankentunnel' }
  | { country: 'HR'; kind: 'toll-gate'; note: 'platí se na výjezdu, předem nelze' };
```

O tomhle **nesmí rozhodovat LLM**. Halucinace ve stylu „Slovinsko známku nepotřebuje“ stojí uživatele
stovky eur pokuty a nemá jak zjistit, že k ní došlo. Každé pravidlo je řádek v datech s odkazem na
zdroj, datem ověření a testem.

Trasa → seznam zemí se neřeší vlastním routingem. Buď se zeptáme, nebo vezmeme výstup existující
routovací služby.

### Vrstva 2 — adaptér na zemi

Jeden soubor na portál, tři metody:

```ts
interface Adapter {
  country: CountryCode;
  check(plate: Plate): Promise<Coverage[]>;      // read-only, žádná autentizace
  quote(req: Request): Quote;                     // ze statických dat, bez sítě
  purchase(req: Request): Promise<Outcome>;       // jediné, co sahá na browser
}
```

`check` je nejcennější primitiv celého projektu. Dělá tři věci najednou: brání dvojímu nákupu,
potvrzuje úspěch a sám o sobě odpovídá na „mám ještě platnou slovinskou?“. Staví se první.

Adaptéry jsou opt-in a každý má povinný fallback: když selže, vrátí deep link a předvyplněné hodnoty
k ručnímu zadání. Nástroj, který v nejhorším řekne „doklikej si to sám“, přežije redesign portálu.
Nástroj, který spadne, si lidi odinstalují.

### Vrstva 3 — orchestrace

Browser přes **devtools MCP** (Chrome nebo Firefox), ne Playwright. Reálný profil, reálný fingerprint,
přihlášené session, a 3DS proběhne v tom samém tabu — agent jen počká na redirect.

> Chrome ≥ 136 odmítá `--remote-debugging-port` nad defaultním user data direm (obrana proti krádeži
> cookies). Potřebuje dedikovaný profil. Firefox tohle omezení nemá.

Běh:

1. **Preflight** — `check` pro každou zemi. Co už platí, odpadá.
2. **Plán** — co zbývá, za kolik, kdy začne platnost. Čeká na schválení. Poslední místo, kde uživatel
   chytí překlep ve značce.
3. **Nákup po zemích** — formulář až po platební bránu, pak stop. Uživatel potvrdí 3DS.
4. **Verify** — znovu `check`. Teprve potvrzení od portálu znamená hotovo. „Děkujeme za nákup“ na
   stránce není důkaz.
5. **Souhrn** — co je koupené, co se platí na místě.

## 5. Bezpečnostní invarianty

Tohle jsou věci, které nesmí selhat. Patří do testů, ne do dokumentace.

**Idempotence.** Journal na disk *před* každým krokem:

```
{ run: "2026-07-15-hr", country: "SI", state: "payment-submitted", at: "..." }
```

Když proces spadne mezi odesláním platby a potvrzením, po restartu jsme ve stavu `payment-submitted`
a **nesmíme opakovat**. Místo toho zavoláme `check` a zeptáme se portálu. Bez tohohle si dřív nebo
později koupíš dvě známky — a vrátit se to prakticky nedá, změny jdou v CZ i AT jen před začátkem
platnosti.

**Verify po každém nákupu.** Bez potvrzení od portálu se položka nepovažuje za hotovou.

**Nikdy neopakovat platební krok automaticky.** Nejasný stav = zastavit a zeptat se.

**Datum ověření u každého pravidla.** Ceny se mění každý leden a únor. Nástroj hlásí, když jsou data
starší než X měsíců. Jinak z toho za rok bude repo, které lže s jistotou.

## 6. Pravidla, která musí být v datech od začátku

Tohle jsou reálné pasti, kvůli kterým lidi platí pokuty. Zároveň to je největší část hodnoty celého
projektu.

- **AT, 18denní lhůta.** Dvouměsíční a roční digitální známka koupená online soukromou osobou platí
  **až od 18. dne** (14 dní na odstoupení + poštovní lhůta). Jednodenní a desetidenní jsou při online
  nákupu platné okamžitě. Koupě u ÖAMTC / ARBÖ / ADAC / na benzínce lhůtu obchází — není to zásilkový
  obchod.
- **AT, úsekové mýto zvlášť.** Karawanken, Tauern, Brenner, Arlberg, Bosruck, Gleinalm nejsou pokryté
  známkou. A online koupené digitální úsekové mýto podléhá stejné 18denní lhůtě.
- **HR nemá známku.** Nejčastější mylný předpoklad u českých řidičů mířících k moři.
- **AT jednostopé vs. vícestopé**, **SI podle výšky nad přední nápravou**, **HR podle výšky 1,9 m** —
  kategorie se počítají v každé zemi jinak.
- **HU župní známky** — jiná struktura než celostátní.
- **Osvobození pro elektromobily** — mění se, patří k datu ověření.
- **Přívěs / souprava** — vlastní pravidla, země od země.

## 7. Rozsah v1

Koridor, který sám jezdím. Pět zemí pořádně je lepší repo než patnáct odhadem.

**Uvnitř:** CZ, AT, SI, SK, HU. Vozidla do 3,5 t. HR jako informace, ne nákup.

**Venku:** nad 3,5 t, GO-Box a DarsGo, CH/RO/BG (jen v seznamu portálů), routing z GPS trasy, jakýkoli
hosting.

### Milníky

| # | Obsah | Hotovo když |
|---|---|---|
| M0 | Datová vrstva + `resolve()` | „CZ → HR, osobák, 15.–25. 7.“ vrátí správný seznam včetně toho, že HR se platí na bráně |
| M1 | `check` pro CZ a AT | MCP tool „mám platnou známku?“ funguje. Ověřuje transport přes devtools. |
| M2 | `check` pro SI, SK, HU | Preflight pro celou trasu |
| M3 | `purchase` pro CZ | Journal, verify, idempotence — celý pattern na jedné zemi |
| M4 | `purchase` pro AT a SI | Potvrzuje, že abstrakce mezi zeměmi sedí |
| M5 | CLI + README + publish | `npx toll-agent` |

M1 je samostatně užitečný a publikovatelný. Kdyby projekt skončil tam, pořád má smysl.

## 8. Otevřené otázky

- Chrome nebo Firefox devtools MCP jako primární? Firefox nemá to omezení profilu, ale Chrome má víc
  uživatelů.
- Jak řešit vícero vozidel a SPZ — konfigurační soubor, nebo pokaždé argument?
- Přijímat PR s adaptéry na země, kam sám nejezdím? Riziko: neotestovatelný kód v mém repu. Návrh: ano,
  ale s povinným záznamem reálného průchodu v PR.
- Jazyk dokumentace — anglicky kvůli dosahu, nebo dvojjazyčně? Cílovka je středoevropská.

## 9. Zdroje

Vše ověřeno 2026-09-03. U každého pravidla v datech drž odkaz a datum zvlášť.

- SFDI/CENDIS, rozcestník oficiálních e-shopů:
  <https://edalnice.gov.cz/cs/elektronicke-dalnicni-znamky-ve-stredni-evrope>
- ASFINAG Mautshop (známky, úsekové mýto, slovinská e-vinjeta): <https://shop.asfinag.at>
- DARS e-vinjeta: <https://evinjeta.dars.si>
- ASFINAG: varování před neautorizovanými prodejci; další prodej digitálních mýtných produktů je
  vyloučen obchodními podmínkami
- Ministerstvo dopravy ČR: stížnosti na předražené známky přes ČOI

### Poznámka k roadmapě

Chorvatsko spouští celostátní free-flow systém k **1. březnu 2027** — registrace SPZ a ENC bez závor.
Do té doby v HR není co kupovat předem, potom to bude nový adaptér.

Rakousko od února 2027 ruší nálepku a jede jen digitálně. Tím zmizí cesta „koupím na benzínce a mám to
hned platné“, což 18denní lhůtu udělá ještě důležitější.

---

## Dodatek: co se při stavbě M0 ověřilo a upřesnilo

Doplněno 2026-09-03 při implementaci datové vrstvy. Původní text výše zůstává beze změny.

- **18denní lhůta potvrzena doslovně od ASFINAGu:** „2-Monats- und Jahres-Vignetten sind aufgrund des
  Konsumentenschutzes auch weiterhin frühestens ab dem 18. Tag nach dem Online-Kauf gültig.“
- **Maďarská „týdenní“ e-matrica platí 10 dní**, ne 7 — oficiální sazebník NÚSZ pro 2026 ji uvádí jako
  *Heti (10 napos)*. To v seznamu pastí chybělo a je to přesně ten typ chyby, kvůli které se platí
  pokuta.
- **Chorvatský free-flow systém se jmenuje Crolibertas**, spouští se 1. 3. 2027, dodává ho konsorcium
  SkyToll (SK) + TollNet (CZ). Tedy stejní lidé, co provozují slovenský a český systém.
- **CZ sazby podle pohonu** jsou jemnější než „elektromobily zdarma“: nulové emise 0 %, CNG/LNG/biometan
  50 %, plug-in hybridy do 50 g CO₂/km 25 %.
- **SI třída 1 (motocykly)** má na ceníku roční a týdenní, měsíční se nám ověřit nepodařilo. Vedeno
  jako mezera v datech, ne jako „měsíční neexistuje“.
- **Open data eDálnice** (`od.edalnice.gov.cz`) při ověřování vracela chybu aplikace. Jestli má API pro
  ověření SPZ, je otevřená otázka — a pokud ano, `check` pro CZ nepotřebuje prohlížeč vůbec. Stojí za
  to to zjistit dřív, než se začne psát M1.
