import { describe, expect, it } from 'vitest';

import { resolve } from '../src/rules/resolve.js';
import type { Requirement, Vehicle } from '../src/types.js';

const car: Vehicle = {
  category: 'car',
  maxWeightKg: 1800,
  heightAboveFrontAxleM: 1.2,
  totalHeightM: 1.5,
  plate: '1AB2345',
  registrationCountry: 'CZ',
};

function find(requirements: Requirement[], country: string, kind: string): Requirement {
  const found = requirements.find((r) => r.country === country && r.kind === kind);
  if (!found) throw new Error(`no ${kind} requirement for ${country}`);
  return found;
}

describe('M0 acceptance: "CZ -> HR, car, 15.-25. 7."', () => {
  const result = resolve({
    route: ['CZ', 'AT', 'SI', 'HR'],
    vehicle: car,
    dates: { from: '2026-07-15', to: '2026-07-25' },
    purchase: { on: '2026-06-01', channel: 'online' },
    today: '2026-06-01',
  });

  it('tells you Croatia is paid at the gate and cannot be prepared', () => {
    const hr = find(result.requirements, 'HR', 'pay-on-site');
    expect(hr.kind).toBe('pay-on-site');
    const texts = hr.notes.map((note) => note.text).join(' ');
    expect(texts).toMatch(/no vignette/i);
    expect(texts).toMatch(/gate/i);
  });

  it('never offers a Croatian product to buy', () => {
    const hrOptions = result.requirements.filter(
      (r) => r.country === 'HR' && r.kind === 'vignette',
    );
    expect(hrOptions).toHaveLength(0);
  });

  it('recommends the cheapest Czech product that actually covers the trip', () => {
    const cz = find(result.requirements, 'CZ', 'vignette');
    if (cz.kind !== 'vignette') throw new Error('wrong kind');
    expect(cz.recommended).toBe('cz-30day');
    const tenDay = cz.options.find((option) => option.productId === 'cz-10day');
    expect(tenDay?.coversTrip).toBe(false);
  });

  it('puts Slovenia in class 2A and recommends the monthly', () => {
    const si = find(result.requirements, 'SI', 'vignette');
    if (si.kind !== 'vignette') throw new Error('wrong kind');
    expect(si.tollClass).toBe('2A');
    expect(si.recommended).toBe('si-monthly-2a');
  });

  it('lists Austrian section tolls separately from the vignette', () => {
    const sections = find(result.requirements, 'AT', 'section-toll');
    if (sections.kind !== 'section-toll') throw new Error('wrong kind');
    expect(sections.tolls.map((toll) => toll.id)).toContain('at-karawanken');
  });

  it('only ever links official portals', () => {
    const urls = JSON.stringify(result).match(/https?:\/\/[^"\s]+/g) ?? [];
    const hosts = new Set(urls.map((url) => new URL(url).host));
    for (const host of hosts) {
      expect(host).toMatch(
        /(gov\.cz|asfinag\.at|dars\.si|eznamka\.sk|nemzetiutdij\.hu|hac\.hr|go-maut\.at|darsgo\.si|emyto\.sk|hu-go\.hu)$/,
      );
    }
  });
});

describe("Austria's 18-day rule", () => {
  const trip = { from: '2026-07-15', to: '2026-07-25' };

  it('blocks an annual vignette bought online eight days before departure', () => {
    const result = resolve({
      route: ['AT'],
      vehicle: car,
      dates: trip,
      purchase: { on: '2026-07-07', channel: 'online' },
      today: '2026-07-07',
    });
    const at = find(result.requirements, 'AT', 'vignette');
    if (at.kind !== 'vignette') throw new Error('wrong kind');
    const annual = at.options.find((option) => option.productId === 'at-annual-car');
    expect(annual?.coversTrip).toBe(false);
    expect(annual?.validFrom).toBe('2026-07-25');
  });

  it('does not apply to the same purchase made at a physical outlet', () => {
    const result = resolve({
      route: ['AT'],
      vehicle: car,
      dates: trip,
      purchase: { on: '2026-07-07', channel: 'retail' },
      today: '2026-07-07',
    });
    const at = find(result.requirements, 'AT', 'vignette');
    if (at.kind !== 'vignette') throw new Error('wrong kind');
    const annual = at.options.find((option) => option.productId === 'at-annual-car');
    expect(annual?.coversTrip).toBe(true);
  });

  it('does not delay the 10-day vignette bought online', () => {
    const result = resolve({
      route: ['AT'],
      vehicle: car,
      dates: { from: '2026-07-15', to: '2026-07-20' },
      purchase: { on: '2026-07-14', channel: 'online' },
      today: '2026-07-14',
    });
    const at = find(result.requirements, 'AT', 'vignette');
    if (at.kind !== 'vignette') throw new Error('wrong kind');
    expect(at.recommended).toBe('at-10day-car');
  });

  it('says so out loud when nothing covers the trip', () => {
    const result = resolve({
      route: ['AT'],
      vehicle: car,
      dates: { from: '2026-07-15', to: '2026-07-25' },
      purchase: { on: '2026-07-10', channel: 'online' },
      today: '2026-07-10',
    });
    const at = find(result.requirements, 'AT', 'vignette');
    if (at.kind !== 'vignette') throw new Error('wrong kind');
    expect(at.recommended).toBeNull();
    expect(at.notes.some((note) => note.severity === 'blocking')).toBe(true);
  });
});

describe('vehicle classes are not guessed', () => {
  it('asks for the height above the front axle instead of assuming 2A in Slovenia', () => {
    const result = resolve({
      route: ['SI'],
      vehicle: { category: 'car', maxWeightKg: 2800, plate: 'ABC123' },
      dates: { from: '2026-07-15', to: '2026-07-25' },
      today: '2026-06-01',
    });
    const si = find(result.requirements, 'SI', 'needs-input');
    if (si.kind !== 'needs-input') throw new Error('wrong kind');
    expect(si.missing).toContain('heightAboveFrontAxleM');
  });

  it('puts a tall van in Slovenian class 2B, at double the price', () => {
    const result = resolve({
      route: ['SI'],
      vehicle: { category: 'car', maxWeightKg: 3000, heightAboveFrontAxleM: 1.45 },
      dates: { from: '2026-07-15', to: '2026-07-25' },
      today: '2026-06-01',
    });
    const si = find(result.requirements, 'SI', 'vignette');
    if (si.kind !== 'vignette') throw new Error('wrong kind');
    expect(si.tollClass).toBe('2B');
    expect(si.recommended).toBe('si-monthly-2b');
    const monthly = si.options.find((option) => option.productId === 'si-monthly-2b');
    expect(monthly?.price.amount).toBe(64.1);
  });

  it('sends anything over 3.5 t out of scope rather than pricing it wrong', () => {
    const result = resolve({
      route: ['CZ', 'AT'],
      vehicle: { category: 'car', maxWeightKg: 7500 },
      dates: { from: '2026-07-15', to: '2026-07-25' },
      today: '2026-06-01',
    });
    expect(result.requirements.every((requirement) => requirement.kind === 'out-of-scope')).toBe(true);
    expect(result.warnings.some((warning) => warning.id === 'over-3500')).toBe(true);
  });
});

describe('country-specific traps', () => {
  it('prices a Czech electric car at zero and still tells you to register it', () => {
    const result = resolve({
      route: ['CZ'],
      vehicle: { category: 'car', maxWeightKg: 2100, powertrain: 'bev', plate: '9EV1234' },
      dates: { from: '2026-07-15', to: '2026-07-25' },
      today: '2026-06-01',
    });
    const cz = find(result.requirements, 'CZ', 'vignette');
    if (cz.kind !== 'vignette') throw new Error('wrong kind');
    const recommended = cz.options.find((option) => option.productId === cz.recommended);
    expect(recommended?.price.amount).toBe(0);
    expect(cz.notes.some((note) => note.id === 'cz-zero-emission-exempt')).toBe(true);
  });

  it('charges a Czech plug-in hybrid under 50 g the quarter rate', () => {
    const result = resolve({
      route: ['CZ'],
      vehicle: { category: 'car', maxWeightKg: 2100, powertrain: 'phev', co2GramsPerKm: 32 },
      dates: { from: '2026-07-15', to: '2026-07-25' },
      today: '2026-06-01',
    });
    const cz = find(result.requirements, 'CZ', 'vignette');
    if (cz.kind !== 'vignette') throw new Error('wrong kind');
    const recommended = cz.options.find((option) => option.productId === cz.recommended);
    expect(recommended?.price.amount).toBe(120);
  });

  it('does not charge a motorcycle in Czechia', () => {
    const result = resolve({
      route: ['CZ'],
      vehicle: { category: 'motorcycle', maxWeightKg: 300 },
      dates: { from: '2026-07-15', to: '2026-07-25' },
      today: '2026-06-01',
    });
    expect(find(result.requirements, 'CZ', 'not-required').kind).toBe('not-required');
  });

  it("treats Hungary's weekly product as the ten days it really is", () => {
    const result = resolve({
      route: ['HU'],
      vehicle: car,
      dates: { from: '2026-07-15', to: '2026-07-24' },
      today: '2026-06-01',
    });
    const hu = find(result.requirements, 'HU', 'vignette');
    if (hu.kind !== 'vignette') throw new Error('wrong kind');
    const weekly = hu.options.find((option) => option.productId === 'hu-weekly-d1');
    expect(weekly?.validTo).toBe('2026-07-24');
    expect(weekly?.coversTrip).toBe(true);
    expect(hu.notes.some((note) => note.id === 'hu-weekly-is-ten-days')).toBe(true);
  });

  it('mentions Hungarian county vignettes as an alternative structure', () => {
    const result = resolve({
      route: ['HU'],
      vehicle: car,
      dates: { from: '2026-07-15', to: '2026-07-25' },
      today: '2026-06-01',
    });
    const hu = find(result.requirements, 'HU', 'vignette');
    if (hu.kind !== 'vignette') throw new Error('wrong kind');
    expect(hu.notes.some((note) => note.id === 'hu-county-structure')).toBe(true);
  });

  it('refuses to model Switzerland and links its portal instead', () => {
    const result = resolve({
      route: ['CH'],
      vehicle: car,
      dates: { from: '2026-07-15', to: '2026-07-25' },
      today: '2026-06-01',
    });
    const ch = find(result.requirements, 'CH', 'unsupported');
    if (ch.kind !== 'unsupported') throw new Error('wrong kind');
    expect(ch.buyUrl).toBe('https://via.admin.ch');
    expect(ch.notes[0]?.text).toMatch(/not modelled/i);
  });
});

describe('honesty about our own data', () => {
  it('warns when the rules are older than the allowed age', () => {
    const result = resolve({
      route: ['CZ'],
      vehicle: car,
      dates: { from: '2027-07-15', to: '2027-07-25' },
      today: '2027-06-01',
      maxDataAgeDays: 180,
    });
    const cz = find(result.requirements, 'CZ', 'vignette');
    expect(cz.notes.some((note) => note.id === 'cz-stale-data')).toBe(true);
  });

  it('says when a trip is further out than the portal sells', () => {
    const result = resolve({
      route: ['SI'],
      vehicle: car,
      dates: { from: '2026-12-01', to: '2026-12-10' },
      purchase: { on: '2026-06-01', channel: 'online' },
      today: '2026-06-01',
    });
    const si = find(result.requirements, 'SI', 'vignette');
    expect(si.notes.some((note) => note.id === 'si-too-early')).toBe(true);
  });

  it('says plainly when the trip starts before the purchase date', () => {
    const result = resolve({
      route: ['HU'],
      vehicle: car,
      dates: { from: '2026-07-15', to: '2026-07-24' },
      purchase: { on: '2026-09-03', channel: 'online' },
      today: '2026-09-03',
    });
    expect(result.warnings.some((warning) => warning.id === 'trip-in-the-past')).toBe(true);
  });

  it('rejects a trip that ends before it starts', () => {
    expect(() =>
      resolve({
        route: ['CZ'],
        vehicle: car,
        dates: { from: '2026-07-25', to: '2026-07-15' },
        today: '2026-06-01',
      }),
    ).toThrow(/before it starts/);
  });

  it('never sums different currencies into one number', () => {
    const result = resolve({
      route: ['CZ', 'AT'],
      vehicle: car,
      dates: { from: '2026-07-15', to: '2026-07-20' },
      purchase: { on: '2026-07-14', channel: 'online' },
      today: '2026-07-14',
    });
    expect(result.estimatedTotal.map((total) => total.currency).sort()).toEqual(['CZK', 'EUR']);
  });
});
