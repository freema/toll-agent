import { daysBetween, todayISO } from '../data/dates.js';
import { isSupported, loadCountry, portalFor } from '../data/load.js';
import { match } from '../data/predicate.js';
import type { CountryData, Product, Rule } from '../data/schema.js';
import { classify, vehicleFacts } from './classify.js';
import { coverage } from './validity.js';
import type {
  CountryCode,
  Money,
  Note,
  Option,
  Requirement,
  ResolveInput,
  ResolveResult,
  Vehicle,
} from '../types.js';

const DEFAULT_MAX_DATA_AGE_DAYS = 180;

function noteFromRule(rule: Rule): Note {
  return {
    id: rule.id,
    severity: rule.severity,
    text: rule.text.en,
    source: rule.source,
    verifiedAt: rule.verifiedAt,
  };
}

/** Rules with no `when` always apply; rules with one apply when it holds. */
function applicableRules(country: CountryData, vehicle: Vehicle): Rule[] {
  const facts = vehicleFacts(vehicle);
  return country.rules.filter((rule) => match(rule.when, facts).result === 'yes');
}

function priceFor(product: Product, vehicle: Vehicle, currency: string): Money {
  const facts = vehicleFacts(vehicle);
  for (const variant of product.variants ?? []) {
    if (match(variant.when, facts).result === 'yes') {
      return { amount: variant.price.amount, currency: variant.price.currency ?? currency };
    }
  }
  return { amount: product.price.amount, currency: product.price.currency ?? currency };
}

function stalenessNotes(country: CountryData, today: string, maxAgeDays: number): Note[] {
  const age = daysBetween(country.verifiedAt, today);
  if (age <= maxAgeDays) return [];
  return [
    {
      id: `${country.country.toLowerCase()}-stale-data`,
      severity: 'warning',
      text:
        `Rules for ${country.country} were last verified on ${country.verifiedAt}, ${age} days ago. ` +
        `Prices in this region change every January and February. Re-check against ${country.portal} before you rely on the numbers.`,
      source: country.portal,
      verifiedAt: country.verifiedAt,
    },
  ];
}

function gapNotes(country: CountryData): Note[] {
  return (country.gaps ?? []).map((gap) => ({
    id: gap.id,
    severity: gap.severity,
    text: `Known gap in our data: ${gap.text}`,
    source: country.portal,
  }));
}

function resolveCountry(
  code: CountryCode,
  input: Required<Pick<ResolveInput, 'vehicle' | 'dates'>> & {
    purchaseOn: string;
    channel: 'online' | 'retail';
    today: string;
    maxDataAgeDays: number;
  },
): Requirement[] {
  const { vehicle, dates, purchaseOn, channel, today, maxDataAgeDays } = input;

  if (!isSupported(code)) {
    const portal = portalFor(code);
    return [
      {
        country: code,
        kind: 'unsupported',
        buyUrl: portal?.shop,
        notes: [
          {
            id: `${code.toLowerCase()}-not-modelled`,
            severity: 'warning',
            text: portal
              ? `${code} is not modelled in v1. Its official portal is ${portal.shop} (${portal.operator}). We do not guess prices or rules for it.`
              : `${code} has no verified official portal in our data. We would rather leave a gap than send you to a reseller — check that country's ministry of transport.`,
            source: portal?.shop,
          },
        ],
      },
    ];
  }

  const country = loadCountry(code);
  const baseNotes = [...gapNotes(country), ...stalenessNotes(country, today, maxDataAgeDays)];
  const rules = applicableRules(country, vehicle);
  const ruleNotes = rules.map(noteFromRule);

  const outOfScope = rules.find((rule) => rule.effect === 'out-of-scope');
  if (outOfScope) {
    return [
      {
        country: code,
        kind: 'out-of-scope',
        seeAlso: country.scopeLimit.aboveLimit,
        notes: [noteFromRule(outOfScope), ...baseNotes],
      },
    ];
  }

  const notRequired = rules.find((rule) => rule.effect === 'not-required');
  if (notRequired) {
    return [{ country: code, kind: 'not-required', notes: [noteFromRule(notRequired), ...baseNotes] }];
  }

  const requirements: Requirement[] = [];

  if (country.system === 'toll-gate') {
    requirements.push({
      country: code,
      kind: 'pay-on-site',
      buyUrl: country.portal,
      notes: [...ruleNotes, ...baseNotes],
    });
    return requirements;
  }

  const classification = classify(country, vehicle);
  if (classification.kind === 'needs-input') {
    return [
      {
        country: code,
        kind: 'needs-input',
        missing: classification.missing,
        notes: [
          {
            id: `${code.toLowerCase()}-needs-input`,
            severity: 'blocking',
            text: `${code} decides the toll class on ${classification.missing.join(', ')}, which you have not given us. We will not guess — the wrong class is a fine, not a discount.`,
            source: country.portal,
          },
          ...ruleNotes,
          ...baseNotes,
        ],
      },
    ];
  }
  if (classification.kind === 'no-class') {
    return [
      {
        country: code,
        kind: 'out-of-scope',
        seeAlso: country.scopeLimit.aboveLimit,
        notes: [
          {
            id: `${code.toLowerCase()}-no-class`,
            severity: 'blocking',
            text: `No ${code} toll class in our data matches this vehicle. That usually means it is outside the up-to-3.5 t scope of v1.`,
            source: country.portal,
          },
          ...baseNotes,
        ],
      },
    ];
  }

  const options: Option[] = country.products
    .filter((product) => product.class === classification.classId)
    .map((product) => {
      const verdict = coverage({ product, trip: dates, purchaseOn, channel });
      const notes: string[] = [];
      if (product.note) notes.push(product.note);
      if (product.coverage) notes.push(product.coverage);
      if (product.online && product.online.validFromDays > 0 && channel === 'online') {
        notes.push(
          `Bought online, this product is valid at the earliest from ${verdict.window.from} (${product.online.validFromDays}-day rule).`,
        );
      }
      const option: Option = {
        productId: product.id,
        label: product.label.en,
        kind: product.kind,
        price: priceFor(product, vehicle, country.currency),
        validFrom: verdict.window.from,
        validTo: verdict.window.to,
        coversTrip: verdict.coversTrip,
        buyUrl: country.portal,
        source: product.source,
        verifiedAt: product.verifiedAt,
        notes,
      };
      if (verdict.reason) option.reason = verdict.reason;
      return option;
    })
    .sort((a, b) => Number(b.coversTrip) - Number(a.coversTrip) || a.price.amount - b.price.amount);

  const cheapestCovering = options.find((option) => option.coversTrip);
  const notes: Note[] = [...ruleNotes, ...baseNotes];

  if (!cheapestCovering && options.length > 0) {
    notes.push({
      id: `${code.toLowerCase()}-no-single-product`,
      severity: 'blocking',
      text: `No single ${code} product covers ${dates.from}..${dates.to} when bought ${channel} on ${purchaseOn}. Options above show why. Buying earlier or through a physical outlet often fixes it.`,
      source: country.portal,
    });
  }

  const daysAhead = daysBetween(purchaseOn, dates.from);
  if (daysAhead > country.purchase.advanceDays) {
    notes.push({
      id: `${code.toLowerCase()}-too-early`,
      severity: 'warning',
      text: `${code} sells at most ${country.purchase.advanceDays} days in advance (confidence: ${country.purchase.confidence ?? 'unknown'}), and your trip starts ${daysAhead} days out. You may have to come back closer to the date.`,
      source: country.purchase.source,
      verifiedAt: country.purchase.verifiedAt,
    });
  }

  const requirement: Requirement = {
    country: code,
    kind: 'vignette',
    tollClass: classification.classId,
    tollClassLabel: classification.label,
    options,
    recommended: cheapestCovering?.productId ?? null,
    buyUrl: country.portal,
    notes,
  };
  if (country.checkUrl) {
    (requirement as Extract<Requirement, { kind: 'vignette' }>).checkUrl = country.checkUrl;
  }
  requirements.push(requirement);

  if (country.sectionTolls && country.sectionTolls.length > 0) {
    requirements.push({
      country: code,
      kind: 'section-toll',
      buyUrl: country.portal,
      tolls: country.sectionTolls.map((toll) => ({
        id: toll.id,
        name: toll.name,
        price: toll.singleTripPrice
          ? { amount: toll.singleTripPrice.amount, currency: country.currency }
          : null,
        ...(toll.hint ? { hint: toll.hint } : {}),
      })),
      notes: [
        {
          id: `${code.toLowerCase()}-section-tolls-listed`,
          severity: 'info',
          text: `These ${code} sections are not covered by any vignette. We list all of them because we do not know your exact route — only the ones you actually drive cost money.`,
          source: country.sectionTolls[0]?.source,
          verifiedAt: country.sectionTolls[0]?.verifiedAt,
        },
      ],
    });
  }

  // A trailer can be a separate chargeable unit. Say so rather than absorb it.
  if (vehicle.trailer) {
    const trailerClass = classify(country, vehicle, true);
    if (trailerClass.kind === 'matched') {
      const combination = vehicle.maxWeightKg + vehicle.trailer.maxWeightKg;
      notes.push({
        id: `${code.toLowerCase()}-trailer`,
        severity: 'warning',
        text: `You are towing. ${code} has a separate toll class for trailers (${trailerClass.label}); your combination is ${combination} kg. Check whether it needs its own product.`,
        source: country.portal,
      });
    }
  }

  return requirements;
}

/**
 * Route + vehicle + dates -> what you have to pay, where, and by when.
 *
 * Pure and deterministic: same input, same output, no network, no model. Every
 * claim it makes is traceable to a line in `data/` with a source URL and a
 * verification date.
 */
export function resolve(input: ResolveInput): ResolveResult {
  const today = input.today ?? todayISO();
  const purchaseOn = input.purchase?.on ?? today;
  const channel = input.purchase?.channel ?? 'online';
  const maxDataAgeDays = input.maxDataAgeDays ?? DEFAULT_MAX_DATA_AGE_DAYS;

  if (input.dates.to < input.dates.from) {
    throw new Error(`Trip ends (${input.dates.to}) before it starts (${input.dates.from}).`);
  }

  const warnings: Note[] = [];
  const seen = new Set<CountryCode>();
  const requirements: Requirement[] = [];

  for (const code of input.route) {
    if (seen.has(code)) continue;
    seen.add(code);
    requirements.push(
      ...resolveCountry(code, {
        vehicle: input.vehicle,
        dates: input.dates,
        purchaseOn,
        channel,
        today,
        maxDataAgeDays,
      }),
    );
  }

  if (input.dates.from < purchaseOn) {
    warnings.push({
      id: 'trip-in-the-past',
      severity: 'warning',
      text: `The trip starts ${input.dates.from} but the purchase date is ${purchaseOn}. Nothing can be bought with retroactive validity anywhere in this region, so every option below will look like it starts too late. Pass --buy-on if you are planning a past-dated scenario.`,
    });
  }

  if (input.vehicle.maxWeightKg > 3500) {
    warnings.push({
      id: 'over-3500',
      severity: 'blocking',
      text: 'Above 3.5 t the vignette world ends and distance-based tolling begins (GO-Box in AT, DarsGo in SI, myto.gov.cz in CZ, HU-GO in HU, emyto.sk in SK). This tool does not model any of it.',
    });
  }
  if (!input.vehicle.plate) {
    warnings.push({
      id: 'no-plate',
      severity: 'info',
      text: 'No licence plate given, so nothing can be checked against a portal. Every product in this region is bound to the plate, and the plate is the one thing you must get right.',
    });
  }

  const totals = new Map<string, number>();
  for (const requirement of requirements) {
    if (requirement.kind !== 'vignette' || !requirement.recommended) continue;
    const option = requirement.options.find((o) => o.productId === requirement.recommended);
    if (!option) continue;
    totals.set(option.price.currency, (totals.get(option.price.currency) ?? 0) + option.price.amount);
  }

  return {
    input,
    requirements,
    warnings,
    estimatedTotal: [...totals.entries()]
      .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    generatedAt: today,
  };
}
